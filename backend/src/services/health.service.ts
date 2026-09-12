import { env } from "../config/env";
import { ContainerService } from "./container.service";
import { incidentService } from "./incident.service";
import { observabilityService } from "./observability.service";
import { incidentDetectorService } from "./incident-detector.service";
import { logger } from "../utils/logger";
import { emitSentinelEvent } from "../realtime/socket";

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
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(env.DUMMY_API_URL, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;
      const statusCode = resp.status;
      const respText = await resp.text();

      observabilityService.recordRequest(statusCode, latencyMs);

      incidentService.setLastPingTime(new Date().toISOString());
      incidentService.setLastPingCode(statusCode);

      // Check container level status non-blockingly
      const dbRunning = await ContainerService.checkContainerRunning("sentinel-db");
      incidentService.setDatabaseStatus(dbRunning ? "UP" : statusCode === 200 ? "UP" : "DOWN");

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

          incidentService.logEvent(`🎉 ${recoveryStr}`);
          incidentService.addAiReasoning(recoveryStr, "verify_health", "200 OK");
          emitSentinelEvent("service.recovered", { recovery_time: `${elapsedSec}s` });
        }
      } else if (statusCode >= 500) {
        incidentService.setDummyApiStatus("DOWN");
        incidentService.setDatabaseStatus("DOWN");

        // Module 3 Automated Incident Detection
        incidentDetectorService.processEvidenceAndDetect();
      } else {
        incidentService.setDummyApiStatus(`STATUS_${statusCode}`);
      }
    } catch (exc: unknown) {
      const latencyMs = Date.now() - startTime;
      observabilityService.recordRequest(0, latencyMs);

      incidentService.setLastPingTime(new Date().toISOString());
      incidentService.setLastPingCode(0);
      incidentService.setDummyApiStatus("DOWN");

      const dbRunning = await ContainerService.checkContainerRunning("sentinel-db");
      incidentService.setDatabaseStatus(dbRunning ? "UP" : "DOWN");

      // Module 3 Automated Incident Detection
      incidentDetectorService.processEvidenceAndDetect();
    }
  }
}

export const healthMonitorService = new HealthMonitorService();

