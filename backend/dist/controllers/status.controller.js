"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexHandler = indexHandler;
exports.getStatusHandler = getStatusHandler;
const container_service_1 = require("../services/container.service");
const incident_service_1 = require("../services/incident.service");
const policies_1 = require("../config/policies");
async function indexHandler(_req, reply) {
    return reply.send({
        service: "Sentinel SRE Agent Control Plane",
        port: 8000,
        status_endpoint: "/api/status",
        docs: "/docs",
    });
}
async function getStatusHandler(_req, reply) {
    const dbRunning = await container_service_1.ContainerService.checkContainerRunning("sentinel-db");
    const apiRunning = await container_service_1.ContainerService.checkContainerRunning("dummy-api");
    const databaseStatus = dbRunning && incident_service_1.incidentService.getDatabaseStatus() !== "DOWN"
        ? "UP"
        : dbRunning && !incident_service_1.incidentService.isActiveIncident()
            ? "UP"
            : "DOWN";
    const response = {
        system_health: incident_service_1.incidentService.getSystemHealth(),
        dummy_api_status: incident_service_1.incidentService.getDummyApiStatus(),
        database_status: databaseStatus,
        containers: {
            sentinel_db: dbRunning ? "RUNNING" : "STOPPED",
            dummy_api: apiRunning ? "RUNNING" : "STOPPED",
        },
        last_ping_time: incident_service_1.incidentService.getLastPingTime(),
        last_ping_code: incident_service_1.incidentService.getLastPingCode(),
        active_incident: incident_service_1.incidentService.isActiveIncident(),
        current_incident: incident_service_1.incidentService.getCurrentIncident(),
        ai_reasoning: incident_service_1.incidentService.aiReasoning.toArray(),
        incident_logs: incident_service_1.incidentService.incidentLogs.toArray(),
        pending_approvals: incident_service_1.incidentService.pendingApprovals.toArray(),
        policies: (0, policies_1.loadPolicies)(),
    };
    return reply.send(response);
}
