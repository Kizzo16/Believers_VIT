"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIVE_OPENAI_TOOLS = exports.TOOLS = exports.rollbackServiceTool = exports.deleteDatabase = exports.verifyRecoveryTool = exports.restartServiceTool = exports.checkServiceTool = exports.checkDatabaseTool = exports.getServiceLogsTool = exports.getMetricsTool = exports.getSystemStatusTool = exports.SENTINEL_TOOL_DEFINITIONS = void 0;
const container_service_1 = require("../services/container.service");
const incident_service_1 = require("../services/incident.service");
const env_1 = require("../config/env");
// ============================================================================
// 1. OFFICIAL SENTINEL TOOL DEFINITIONS (METADATA & SCHEMAS)
// ============================================================================
exports.SENTINEL_TOOL_DEFINITIONS = {
    get_system_status: {
        name: "get_system_status",
        description: "Query overall operational health status, database state, API state, and active incident summary.",
        isExecutable: true,
        risk: "LOW",
        parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
        },
    },
    get_service_logs: {
        name: "get_service_logs",
        description: "Fetch recent stderr/stdout logs from a monitored service (sentinel-db or dummy-api).",
        isExecutable: true,
        risk: "LOW",
        parameters: {
            type: "object",
            properties: {
                service: {
                    type: "string",
                    description: "Name of the target service ('dummy-api' or 'sentinel-db')",
                    enum: ["dummy-api", "sentinel-db"],
                    default: "dummy-api",
                },
            },
            required: ["service"],
            additionalProperties: false,
        },
    },
    get_metrics: {
        name: "get_metrics",
        description: "Return a real-time operational metrics snapshot for the Sentinel-monitored environment: system health state, service/database up/down status, last API probe time and HTTP status code, active incident flag, and recent observation counts. This tool is read-only and performs no remediation.",
        isExecutable: true,
        risk: "LOW",
        parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
        },
    },
    check_database: {
        name: "check_database",
        description: "Probe PostgreSQL database container status, availability, and running state.",
        isExecutable: true,
        risk: "LOW",
        parameters: {
            type: "object",
            properties: {
                service: {
                    type: "string",
                    description: "Database service name ('sentinel-db')",
                    enum: ["sentinel-db"],
                    default: "sentinel-db",
                },
            },
            required: ["service"],
            additionalProperties: false,
        },
    },
    check_service: {
        name: "check_service",
        description: "Perform an active HTTP health probe against a monitored microservice endpoint.",
        isExecutable: true,
        risk: "LOW",
        parameters: {
            type: "object",
            properties: {
                service: {
                    type: "string",
                    description: "Target service name ('dummy-api')",
                    enum: ["dummy-api"],
                    default: "dummy-api",
                },
            },
            required: ["service"],
            additionalProperties: false,
        },
    },
    restart_service: {
        name: "restart_service",
        description: "Restart a containerized service ('sentinel-db' or 'dummy-api') to recover from failures.",
        isExecutable: true,
        risk: "LOW",
        parameters: {
            type: "object",
            properties: {
                service: {
                    type: "string",
                    description: "Service name to restart ('sentinel-db' or 'dummy-api')",
                    enum: ["sentinel-db", "dummy-api"],
                    default: "sentinel-db",
                },
            },
            required: ["service"],
            additionalProperties: false,
        },
    },
    rollback_service: {
        name: "rollback_service",
        description: "Rollback a containerized service to its last known stable state. HIGH-risk remediation action — requires human approval. Not exposed to AI investigation tools; only reachable via structured RCA proposed_action.",
        isExecutable: false, // Intentionally excluded from LIVE_OPENAI_TOOLS — model cannot select this during Turn 1
        risk: "HIGH",
        parameters: {
            type: "object",
            properties: {
                service: {
                    type: "string",
                    description: "Allowlisted service to rollback ('dummy-api' or 'sentinel-db')",
                    enum: ["sentinel-db", "dummy-api"],
                },
            },
            required: ["service"],
            additionalProperties: false,
        },
    },
    verify_recovery: {
        name: "verify_recovery",
        description: "Verify that all affected services and databases have recovered to HEALTHY state using real runtime probes.",
        isExecutable: true,
        risk: "LOW",
        parameters: {
            type: "object",
            properties: {
                service: {
                    type: "string",
                    description: "Service to verify recovery for ('dummy-api' or 'sentinel-db')",
                    enum: ["dummy-api", "sentinel-db"],
                },
            },
            required: ["service"],
            additionalProperties: false,
        },
    },
};
// ============================================================================
// 2. EXECUTABLE TOOL IMPLEMENTATIONS
// ============================================================================
const getSystemStatusTool = async (_kwargs) => {
    const health = incident_service_1.incidentService.getSystemHealth();
    const dbStatus = incident_service_1.incidentService.getDatabaseStatus();
    const apiStatus = incident_service_1.incidentService.getDummyApiStatus();
    const activeIncident = incident_service_1.incidentService.isActiveIncident();
    const currentIncident = incident_service_1.incidentService.getCurrentIncident();
    return JSON.stringify({
        system_health: health,
        database_status: dbStatus,
        dummy_api_status: apiStatus,
        active_incident: activeIncident,
        incident_id: currentIncident ? currentIncident.id : null,
        incident_error: currentIncident ? currentIncident.error : null,
    });
};
exports.getSystemStatusTool = getSystemStatusTool;
const getMetricsTool = async (_kwargs) => {
    const health = incident_service_1.incidentService.getSystemHealth();
    const dbStatus = incident_service_1.incidentService.getDatabaseStatus();
    const apiStatus = incident_service_1.incidentService.getDummyApiStatus();
    const activeIncident = incident_service_1.incidentService.isActiveIncident();
    const currentIncident = incident_service_1.incidentService.getCurrentIncident();
    const lastPingTime = incident_service_1.incidentService.getLastPingTime();
    const lastPingCode = incident_service_1.incidentService.getLastPingCode();
    const recentLogs = incident_service_1.incidentService.incidentLogs.toArray();
    const recentErrors = recentLogs.filter((l) => l.level === "ERROR");
    const recentWarnings = recentLogs.filter((l) => l.level === "WARNING");
    const now = new Date();
    const lastPingAgeMs = lastPingTime ? now.getTime() - new Date(lastPingTime).getTime() : null;
    const metrics = {
        observed_at: now.toISOString(),
        system: {
            health: health,
            active_incident: activeIncident,
            incident_id: currentIncident?.id ?? null,
            incident_error: currentIncident?.error ?? null,
            incident_status: currentIncident?.status ?? null,
        },
        services: {
            dummy_api: {
                status: apiStatus,
                last_probe_time: lastPingTime,
                last_probe_http_code: lastPingCode,
                last_probe_age_ms: lastPingAgeMs,
            },
            sentinel_db: {
                status: dbStatus,
            },
        },
        observations: {
            total_log_entries: recentLogs.length,
            error_count: recentErrors.length,
            warning_count: recentWarnings.length,
            recent_errors: recentErrors.slice(-3).map((l) => ({ timestamp: l.timestamp, message: l.message })),
        },
    };
    return JSON.stringify(metrics, null, 2);
};
exports.getMetricsTool = getMetricsTool;
const getServiceLogsTool = async (kwargs) => {
    // Support both official 'service' and legacy 'container_name'
    const service = typeof kwargs.service === "string"
        ? kwargs.service
        : typeof kwargs.container_name === "string"
            ? kwargs.container_name
            : "dummy-api";
    return container_service_1.ContainerService.getDockerLogs(service);
};
exports.getServiceLogsTool = getServiceLogsTool;
const checkDatabaseTool = async (kwargs) => {
    const service = typeof kwargs.service === "string" ? kwargs.service : "sentinel-db";
    const isRunning = await container_service_1.ContainerService.checkContainerRunning(service);
    if (isRunning) {
        return `Database container '${service}' is RUNNING and operational.`;
    }
    return `Database container '${service}' is STOPPED or UNREACHABLE.`;
};
exports.checkDatabaseTool = checkDatabaseTool;
const checkServiceTool = async (kwargs) => {
    const service = typeof kwargs.service === "string" ? kwargs.service : "dummy-api";
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const resp = await fetch(env_1.env.DUMMY_API_URL, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (resp.ok) {
            return `Service '${service}' is UP (HTTP ${resp.status} OK).`;
        }
        return `Service '${service}' returned HTTP ${resp.status} ${resp.statusText}.`;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Service '${service}' is UNREACHABLE or DOWN (${msg}).`;
    }
};
exports.checkServiceTool = checkServiceTool;
const restartServiceTool = async (kwargs) => {
    // Support both official 'service' and legacy 'container_name'
    const service = typeof kwargs.service === "string"
        ? kwargs.service
        : typeof kwargs.container_name === "string"
            ? kwargs.container_name
            : "sentinel-db";
    return container_service_1.ContainerService.restartContainer(service);
};
exports.restartServiceTool = restartServiceTool;
const verifyRecoveryTool = async (kwargs) => {
    const service = typeof kwargs.service === "string" ? kwargs.service : "dummy-api";
    if (service === "sentinel-db") {
        const isRunning = await container_service_1.ContainerService.checkContainerRunning("sentinel-db");
        if (isRunning) {
            return JSON.stringify({
                verified: true,
                service: "sentinel-db",
                status: "UP",
                evidence: ["Database container 'sentinel-db' is RUNNING and operational"],
            });
        }
        return JSON.stringify({
            verified: false,
            service: "sentinel-db",
            status: "DOWN",
            evidence: ["Database container 'sentinel-db' is STOPPED or UNREACHABLE"],
        });
    }
    // service === "dummy-api" (or default fallback)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const resp = await fetch(env_1.env.DUMMY_API_URL, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (resp.status === 200) {
            return JSON.stringify({
                verified: true,
                service: "dummy-api",
                status: "UP",
                evidence: ["health probe returned HTTP 200 OK"],
            });
        }
        return JSON.stringify({
            verified: false,
            service: "dummy-api",
            status: "DOWN",
            evidence: [`health probe returned HTTP ${resp.status} ${resp.statusText}`],
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return JSON.stringify({
            verified: false,
            service: "dummy-api",
            status: "DOWN",
            evidence: [`health probe connection failed: ${msg}`],
        });
    }
};
exports.verifyRecoveryTool = verifyRecoveryTool;
// Legacy compatibility tool for critical action testing
const deleteDatabase = async (kwargs) => {
    const dbName = typeof kwargs.db_name === "string" ? kwargs.db_name : "sentinel";
    return `Database '${dbName}' simulated deletion executed successfully (Safe demo execution mode).`;
};
exports.deleteDatabase = deleteDatabase;
// ============================================================================
// rollback_service: safe bounded rollback abstraction
//
// Design decision: Neither sentinel-db nor dummy-api has a versioned image
// history in this demo environment.
//
//   sentinel-db  — uses postgres:16-alpine (fixed tag). The "previous stable
//                  state" for a database service is a container re-init from
//                  the same image. We perform docker rm + docker run (via
//                  compose re-up) only if the container is currently stopped.
//                  This restores the last persisted volume state, which is the
//                  only honest rollback target available.
//
//   dummy-api    — built locally from ./dummy-api/Dockerfile with no tagged
//                  image history. No rollback target exists. Returns no-target
//                  result without performing any destructive action.
//
// This implementation is TRUTHFUL: it never claims success when no genuine
// rollback target or mechanism exists.
// ============================================================================
const rollbackServiceTool = async (kwargs) => {
    const service = typeof kwargs.service === "string" ? kwargs.service : "";
    if (service === "dummy-api") {
        // dummy-api is a locally-built image with no version history.
        // Honest response: no rollback target available.
        return JSON.stringify({
            success: false,
            service: "dummy-api",
            reason: "No rollback target is available for dummy-api in the current demo environment. The service is built from a local Dockerfile with no previous image version stored. Use restart_service to recover from a crash.",
            action_taken: null,
        });
    }
    if (service === "sentinel-db") {
        // sentinel-db uses postgres:16-alpine. The rollback target in this
        // environment is the same image + existing volume data (last persisted
        // state). We can only attempt this if the container is currently DOWN.
        const isRunning = await container_service_1.ContainerService.checkContainerRunning("sentinel-db");
        if (isRunning) {
            return JSON.stringify({
                success: false,
                service: "sentinel-db",
                reason: "Rollback is only applicable when sentinel-db is in a failed/stopped state. The container is currently RUNNING. Use verify_recovery to confirm health, or restart_service if a crash occurs.",
                action_taken: null,
            });
        }
        // Container is stopped — attempt restart from existing image (honest
        // rollback to last persisted volume state: the only valid target).
        try {
            const restartResult = await container_service_1.ContainerService.restartContainer("sentinel-db");
            return JSON.stringify({
                success: true,
                service: "sentinel-db",
                reason: "Rolled back sentinel-db to last persisted state using existing postgres:16-alpine image and volume data. This is the only rollback target available in the current demo environment.",
                action_taken: `container-reinit: ${restartResult}`,
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return JSON.stringify({
                success: false,
                service: "sentinel-db",
                reason: `Rollback attempt failed during container restart: ${msg}`,
                action_taken: null,
            });
        }
    }
    // Allowlist enforced by Zod schema — this path should never be reached
    return JSON.stringify({
        success: false,
        service,
        reason: `Service '${service}' is not in the Sentinel rollback allowlist.`,
        action_taken: null,
    });
};
exports.rollbackServiceTool = rollbackServiceTool;
// ============================================================================
// 3. TOOL REGISTRY (OFFICIAL CONTRACTS + BACKWARD-COMPATIBILITY ALIASES)
// ============================================================================
exports.TOOLS = {
    // Official investigation tools (auto-executed, LOW risk)
    get_system_status: exports.getSystemStatusTool,
    get_service_logs: exports.getServiceLogsTool,
    get_metrics: exports.getMetricsTool,
    check_database: exports.checkDatabaseTool,
    check_service: exports.checkServiceTool,
    verify_recovery: exports.verifyRecoveryTool,
    // Official remediation tools
    restart_service: exports.restartServiceTool,
    rollback_service: exports.rollbackServiceTool, // HIGH risk: requires human approval via guardrail
    // Backward compatibility aliases
    get_docker_logs: exports.getServiceLogsTool,
    restart_container: exports.restartServiceTool,
    delete_database: exports.deleteDatabase,
};
// ============================================================================
// 4. LIVE OPENAI TOOLS (ONLY EXECUTABLE TOOLS EXPOSED TO THE MODEL)
// ============================================================================
exports.LIVE_OPENAI_TOOLS = Object.values(exports.SENTINEL_TOOL_DEFINITIONS)
    .filter((tool) => tool.isExecutable)
    .map((tool) => ({
    type: "function",
    function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
    },
}));
