import { env } from "../config/env";
import { ContainerService } from "./container.service";
import { incidentService } from "./incident.service";
import { callLlmSreAgent } from "../agent/agent";
import { logger } from "../utils/logger";
import { emitSentinelEvent } from "../realtime/socket";
import { IncidentRepository } from "../repositories/incident.repository";
import { safePersist } from "../utils/persistence";

export class HealthMonitorService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isPolling: boolean = false;

  start(intervalMs: number = 3000): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    logger.info(`Starting background health monitor (interval: ${intervalMs / 1000}s)...`);

    const poll = async () => {
      if (!this.isRunning || this.isPolling) {
        return;
      }
      this.isPolling = true;
      try {
        await this.checkHealth();
      } catch (err) {
        logger.error({ err }, "Unexpected error in health monitor loop");
      } finally {
        this.isPolling = false;
        if (this.isRunning) {
          this.timer = setTimeout(poll, intervalMs);
        }
      }
    };

    // Run first check immediately, then schedule
    void poll();
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info("Background health monitor stopped");
  }

  private async checkHealth(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(env.DUMMY_API_URL, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const statusCode = resp.status;
      const respText = await resp.text();

      incidentService.setLastPingTime(new Date().toISOString());
      incidentService.setLastPingCode(statusCode);

      // Check container level status non-blockingly
      const dbRunning = await ContainerService.checkContainerRunning("sentinel-db");
      incidentService.setDatabaseStatus(dbRunning ? "UP" : "DOWN");

      if (statusCode === 200) {
        incidentService.setDummyApiStatus("UP");
        incidentService.setDatabaseStatus("UP");

        const activeIncident = incidentService.isActiveIncident();
        const currentIncident = incidentService.getCurrentIncident();

        if (activeIncident && currentIncident) {
          const detectedDt = new Date(currentIncident.detected_at).getTime();
          const elapsedSec = Math.max(1, Math.floor((Date.now() - detectedDt) / 1000));
          const recoveryStr = `System Recovered in ${elapsedSec}s.`;

          currentIncident.resolved_at = new Date().toISOString();
          currentIncident.recovery_time = `${elapsedSec}s`;
          currentIncident.status = "RESOLVED";

          incidentService.setActiveIncident(false);
          incidentService.setSystemHealth("HEALTHY");

          // Asynchronous write-through to PostgreSQL
          void safePersist("IncidentRepository", "update", currentIncident.id, () =>
            IncidentRepository.update(currentIncident.id, {
              status: "RESOLVED",
              resolved_at: currentIncident.resolved_at,
              recovery_time: currentIncident.recovery_time,
            })
          );

          incidentService.logEvent(`🎉 ${recoveryStr}`);
          incidentService.addAiReasoning(recoveryStr, "verify_health", "200 OK", {
            incident_id: currentIncident.id,
            source: "health_monitor",
          });
          emitSentinelEvent("service.recovered", { recovery_time: `${elapsedSec}s` });
        }
      } else if (statusCode >= 500) {
        incidentService.setDummyApiStatus("DOWN");
        incidentService.setDatabaseStatus("DOWN");

        if (!incidentService.isActiveIncident()) {
          const incidentId = `INC-${Math.floor(Date.now() / 1000)}`;
          const incidentData = {
            id: incidentId,
            detected_at: new Date().toISOString(),
            error: respText,
            status: "INVESTIGATING",
          };

          // Establish durable incident record in DB first
          await safePersist("IncidentRepository", "create", incidentId, () =>
            IncidentRepository.create({
              id: incidentId,
              status: incidentData.status,
              detected_at: incidentData.detected_at,
              service: "dummy-api",
              error: incidentData.error,
            })
          );

          incidentService.setActiveIncident(true);
          incidentService.setCurrentIncident(incidentData);
          incidentService.logEvent(
            `⚠️ Health check returned HTTP ${statusCode} from ${env.DUMMY_API_URL}: ${respText}`,
            "ERROR"
          );

          // Asynchronously trigger the autonomous agent
          void callLlmSreAgent(incidentData);
        }
      } else {
        incidentService.setDummyApiStatus(`STATUS_${statusCode}`);
      }
    } catch (exc: unknown) {
      incidentService.setLastPingTime(new Date().toISOString());
      incidentService.setLastPingCode(0);
      incidentService.setDummyApiStatus("DOWN");

      const dbRunning = await ContainerService.checkContainerRunning("sentinel-db");
      incidentService.setDatabaseStatus(dbRunning ? "UP" : "DOWN");

      if (!incidentService.isActiveIncident()) {
        const incidentId = `INC-${Math.floor(Date.now() / 1000)}`;
        const errDetail = exc instanceof Error ? exc.message : String(exc);
        const incidentData = {
          id: incidentId,
          detected_at: new Date().toISOString(),
          error: `Service unreachable: ${errDetail}`,
          status: "INVESTIGATING",
        };

        // Establish durable incident record in DB first
        await safePersist("IncidentRepository", "create", incidentId, () =>
          IncidentRepository.create({
            id: incidentId,
            status: incidentData.status,
            detected_at: incidentData.detected_at,
            service: "dummy-api",
            error: incidentData.error,
          })
        );

        incidentService.setActiveIncident(true);
        incidentService.setCurrentIncident(incidentData);
        incidentService.logEvent(`⚠️ Health ping connection failed: ${errDetail}`, "ERROR");

        // Asynchronously trigger the autonomous agent
        void callLlmSreAgent(incidentData);
      }
    }
  }
}

export const healthMonitorService = new HealthMonitorService();
