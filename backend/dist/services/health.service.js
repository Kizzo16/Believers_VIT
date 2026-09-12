"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthMonitorService = exports.HealthMonitorService = void 0;
const env_1 = require("../config/env");
const container_service_1 = require("./container.service");
const incident_service_1 = require("./incident.service");
const agent_1 = require("../agent/agent");
const logger_1 = require("../utils/logger");
const socket_1 = require("../realtime/socket");
const incident_repository_1 = require("../repositories/incident.repository");
const persistence_1 = require("../utils/persistence");
class HealthMonitorService {
    timer = null;
    isRunning = false;
    isPolling = false;
    start(intervalMs = 3000) {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        logger_1.logger.info(`Starting background health monitor (interval: ${intervalMs / 1000}s)...`);
        const poll = async () => {
            if (!this.isRunning || this.isPolling) {
                return;
            }
            this.isPolling = true;
            try {
                await this.checkHealth();
            }
            catch (err) {
                logger_1.logger.error({ err }, "Unexpected error in health monitor loop");
            }
            finally {
                this.isPolling = false;
                if (this.isRunning) {
                    this.timer = setTimeout(poll, intervalMs);
                }
            }
        };
        // Run first check immediately, then schedule
        void poll();
    }
    stop() {
        this.isRunning = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        logger_1.logger.info("Background health monitor stopped");
    }
    async checkHealth() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const resp = await fetch(env_1.env.DUMMY_API_URL, {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const statusCode = resp.status;
            const respText = await resp.text();
            incident_service_1.incidentService.setLastPingTime(new Date().toISOString());
            incident_service_1.incidentService.setLastPingCode(statusCode);
            // Check container level status non-blockingly
            const dbRunning = await container_service_1.ContainerService.checkContainerRunning("sentinel-db");
            incident_service_1.incidentService.setDatabaseStatus(dbRunning ? "UP" : "DOWN");
            if (statusCode === 200) {
                incident_service_1.incidentService.setDummyApiStatus("UP");
                incident_service_1.incidentService.setDatabaseStatus("UP");
                const activeIncident = incident_service_1.incidentService.isActiveIncident();
                const currentIncident = incident_service_1.incidentService.getCurrentIncident();
                if (activeIncident && currentIncident) {
                    const detectedDt = new Date(currentIncident.detected_at).getTime();
                    const elapsedSec = Math.max(1, Math.floor((Date.now() - detectedDt) / 1000));
                    const recoveryStr = `System Recovered in ${elapsedSec}s.`;
                    currentIncident.resolved_at = new Date().toISOString();
                    currentIncident.recovery_time = `${elapsedSec}s`;
                    currentIncident.status = "RESOLVED";
                    incident_service_1.incidentService.setActiveIncident(false);
                    incident_service_1.incidentService.setSystemHealth("HEALTHY");
                    // Asynchronous write-through to PostgreSQL
                    void (0, persistence_1.safePersist)("IncidentRepository", "update", currentIncident.id, () => incident_repository_1.IncidentRepository.update(currentIncident.id, {
                        status: "RESOLVED",
                        resolved_at: currentIncident.resolved_at,
                        recovery_time: currentIncident.recovery_time,
                    }));
                    incident_service_1.incidentService.logEvent(`🎉 ${recoveryStr}`);
                    incident_service_1.incidentService.addAiReasoning(recoveryStr, "verify_health", "200 OK", {
                        incident_id: currentIncident.id,
                        source: "health_monitor",
                    });
                    (0, socket_1.emitSentinelEvent)("service.recovered", { recovery_time: `${elapsedSec}s` });
                }
            }
            else if (statusCode >= 500) {
                incident_service_1.incidentService.setDummyApiStatus("DOWN");
                incident_service_1.incidentService.setDatabaseStatus("DOWN");
                if (!incident_service_1.incidentService.isActiveIncident()) {
                    const incidentId = `INC-${Math.floor(Date.now() / 1000)}`;
                    const incidentData = {
                        id: incidentId,
                        detected_at: new Date().toISOString(),
                        error: respText,
                        status: "INVESTIGATING",
                    };
                    // Establish durable incident record in DB first
                    await (0, persistence_1.safePersist)("IncidentRepository", "create", incidentId, () => incident_repository_1.IncidentRepository.create({
                        id: incidentId,
                        status: incidentData.status,
                        detected_at: incidentData.detected_at,
                        service: "dummy-api",
                        error: incidentData.error,
                    }));
                    incident_service_1.incidentService.setActiveIncident(true);
                    incident_service_1.incidentService.setCurrentIncident(incidentData);
                    incident_service_1.incidentService.logEvent(`⚠️ Health check returned HTTP ${statusCode} from ${env_1.env.DUMMY_API_URL}: ${respText}`, "ERROR");
                    // Asynchronously trigger the autonomous agent
                    void (0, agent_1.callLlmSreAgent)(incidentData);
                }
            }
            else {
                incident_service_1.incidentService.setDummyApiStatus(`STATUS_${statusCode}`);
            }
        }
        catch (exc) {
            incident_service_1.incidentService.setLastPingTime(new Date().toISOString());
            incident_service_1.incidentService.setLastPingCode(0);
            incident_service_1.incidentService.setDummyApiStatus("DOWN");
            const dbRunning = await container_service_1.ContainerService.checkContainerRunning("sentinel-db");
            incident_service_1.incidentService.setDatabaseStatus(dbRunning ? "UP" : "DOWN");
            if (!incident_service_1.incidentService.isActiveIncident()) {
                const incidentId = `INC-${Math.floor(Date.now() / 1000)}`;
                const errDetail = exc instanceof Error ? exc.message : String(exc);
                const incidentData = {
                    id: incidentId,
                    detected_at: new Date().toISOString(),
                    error: `Service unreachable: ${errDetail}`,
                    status: "INVESTIGATING",
                };
                // Establish durable incident record in DB first
                await (0, persistence_1.safePersist)("IncidentRepository", "create", incidentId, () => incident_repository_1.IncidentRepository.create({
                    id: incidentId,
                    status: incidentData.status,
                    detected_at: incidentData.detected_at,
                    service: "dummy-api",
                    error: incidentData.error,
                }));
                incident_service_1.incidentService.setActiveIncident(true);
                incident_service_1.incidentService.setCurrentIncident(incidentData);
                incident_service_1.incidentService.logEvent(`⚠️ Health ping connection failed: ${errDetail}`, "ERROR");
                // Asynchronously trigger the autonomous agent
                void (0, agent_1.callLlmSreAgent)(incidentData);
            }
        }
    }
}
exports.HealthMonitorService = HealthMonitorService;
exports.healthMonitorService = new HealthMonitorService();
