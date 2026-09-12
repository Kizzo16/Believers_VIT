"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIVE_OPENAI_TOOLS = exports.TOOLS = exports.deleteDatabase = exports.verifyRecoveryTool = exports.restartServiceTool = exports.checkServiceTool = exports.checkDatabaseTool = exports.getServiceLogsTool = exports.getSystemStatusTool = exports.SENTINEL_TOOL_DEFINITIONS = void 0;
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
        description: "Fetch real-time latency, throughput, error rates, and CPU/memory utilization metrics.",
        isExecutable: false, // Contract defined internally, not exposed to live model yet
        risk: "LOW",
        parameters: {
            type: "object",
            properties: {
                service: {
                    type: "string",
                    description: "Name of the target service to inspect metrics for",
                },
            },
            required: ["service"],
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
        description: "Rollback a deployed service container to the previous known stable version.",
        isExecutable: false, // Contract defined internally, not exposed to live model yet
        risk: "HIGH",
        parameters: {
            type: "object",
            properties: {
                service: {
                    type: "string",
                    description: "Service name to rollback",
                },
            },
            required: ["service"],
            additionalProperties: false,
        },
    },
    verify_recovery: {
        name: "verify_recovery",
        description: "Verify that all affected services and databases have recovered to HEALTHY state.",
        isExecutable: true,
        risk: "LOW",
        parameters: {
            type: "object",
            properties: {
                service: {
                    type: "string",
                    description: "Service to verify recovery for ('dummy-api' or 'sentinel-db')",
                    enum: ["dummy-api", "sentinel-db"],
                    default: "dummy-api",
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
    const dbRunning = await container_service_1.ContainerService.checkContainerRunning("sentinel-db");
    let apiHealthy = false;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const resp = await fetch(env_1.env.DUMMY_API_URL, { signal: controller.signal });
        clearTimeout(timeoutId);
        apiHealthy = resp.ok;
    }
    catch {
        apiHealthy = false;
    }
    if (dbRunning && apiHealthy) {
        return `Recovery verified: sentinel-db is RUNNING and ${service} is responding HTTP 200 OK.`;
    }
    if (!dbRunning) {
        return `Recovery verification FAILED: sentinel-db is not running.`;
    }
    return `Recovery verification FAILED: ${service} is not yet responding with HTTP 200.`;
};
exports.verifyRecoveryTool = verifyRecoveryTool;
// Legacy compatibility tool for critical action testing
const deleteDatabase = async (kwargs) => {
    const dbName = typeof kwargs.db_name === "string" ? kwargs.db_name : "sentinel";
    return `Database '${dbName}' simulated deletion executed successfully (Safe demo execution mode).`;
};
exports.deleteDatabase = deleteDatabase;
// ============================================================================
// 3. TOOL REGISTRY (OFFICIAL CONTRACTS + BACKWARD-COMPATIBILITY ALIASES)
// ============================================================================
exports.TOOLS = {
    // Official tools
    get_system_status: exports.getSystemStatusTool,
    get_service_logs: exports.getServiceLogsTool,
    check_database: exports.checkDatabaseTool,
    check_service: exports.checkServiceTool,
    restart_service: exports.restartServiceTool,
    verify_recovery: exports.verifyRecoveryTool,
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
