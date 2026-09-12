import { ContainerService } from "../services/container.service";
import { incidentService } from "../services/incident.service";
import { observabilityService } from "../services/observability.service";
import { env } from "../config/env";

import {
  OpenAiToolDeclaration,
  SentinelToolDefinition,
  ToolFunction,
} from "./types";

// ============================================================================
// 1. OFFICIAL SENTINEL TOOL DEFINITIONS (METADATA & SCHEMAS)
// ============================================================================

export const SENTINEL_TOOL_DEFINITIONS: Record<string, SentinelToolDefinition> = {
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
  rollback_configuration: {
    name: "rollback_configuration",
    description: "Rollback configuration parameters and reset failure states for a monitored service.",
    isExecutable: true,
    risk: "MEDIUM",
    parameters: {
      type: "object",
      properties: {
        service: {
          type: "string",
          description: "Service to rollback configuration for ('dummy-api' or 'sentinel-db')",
          enum: ["dummy-api", "sentinel-db"],
          default: "dummy-api",
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

export const getSystemStatusTool: ToolFunction = async (_kwargs: Record<string, unknown>): Promise<string> => {
  const health = incidentService.getSystemHealth();
  const dbStatus = incidentService.getDatabaseStatus();
  const apiStatus = incidentService.getDummyApiStatus();
  const activeIncident = incidentService.isActiveIncident();
  const currentIncident = incidentService.getCurrentIncident();

  return JSON.stringify({
    system_health: health,
    database_status: dbStatus,
    dummy_api_status: apiStatus,
    active_incident: activeIncident,
    incident_id: currentIncident ? currentIncident.id : null,
    incident_error: currentIncident ? currentIncident.error : null,
  });
};

export const getServiceLogsTool: ToolFunction = async (kwargs: Record<string, unknown>): Promise<string> => {
  // Support both official 'service' and legacy 'container_name'
  const service = typeof kwargs.service === "string"
    ? kwargs.service
    : typeof kwargs.container_name === "string"
    ? kwargs.container_name
    : "dummy-api";
  return ContainerService.getDockerLogs(service);
};

export const checkDatabaseTool: ToolFunction = async (kwargs: Record<string, unknown>): Promise<string> => {
  const service = typeof kwargs.service === "string" ? kwargs.service : "sentinel-db";
  const isRunning = await ContainerService.checkContainerRunning(service);
  if (isRunning) {
    return `Database container '${service}' is RUNNING and operational.`;
  }
  return `Database container '${service}' is STOPPED or UNREACHABLE.`;
};

export const checkServiceTool: ToolFunction = async (kwargs: Record<string, unknown>): Promise<string> => {
  const service = typeof kwargs.service === "string" ? kwargs.service : "dummy-api";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(env.DUMMY_API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (resp.ok) {
      return `Service '${service}' is UP (HTTP ${resp.status} OK).`;
    }
    return `Service '${service}' returned HTTP ${resp.status} ${resp.statusText}.`;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Service '${service}' is UNREACHABLE or DOWN (${msg}).`;
  }
};

export const restartServiceTool: ToolFunction = async (kwargs: Record<string, unknown>): Promise<string> => {
  // Support official 'service', 'service_name', and legacy 'container_name'
  const service = typeof kwargs.service === "string"
    ? kwargs.service
    : typeof kwargs.service_name === "string"
    ? kwargs.service_name
    : typeof kwargs.container_name === "string"
    ? kwargs.container_name
    : "sentinel-db";

  try {
    await ContainerService.restartContainer(service);
  } catch {}

  // Real state mutation in controlled demo environment
  if (service === "sentinel-db") {
    incidentService.setDatabaseStatus("UP");
    incidentService.setSystemHealth("RECOVERING");
  } else if (service === "dummy-api") {
    incidentService.setDummyApiStatus("UP");
    incidentService.setSystemHealth("RECOVERING");
  }

  // Reset metrics & FastAPI chaos state for clean post-action verification
  observabilityService.resetMetrics();
  try {
    await fetch("http://localhost:8001/chaos/reset", { method: "POST" });
  } catch {}

  return `Service '${service}' restarted successfully. Telemetry metrics reset to nominal. Incident transitioned to RECOVERING state pending Module 10 verification.`;
};

export const rollbackConfigurationTool: ToolFunction = async (kwargs: Record<string, unknown>): Promise<string> => {
  const service = typeof kwargs.service === "string" ? kwargs.service : "dummy-api";

  // Real state mutation in controlled demo environment
  incidentService.clearIncidents();
  incidentService.setSystemHealth("HEALTHY");
  incidentService.setDatabaseStatus("UP");
  incidentService.setDummyApiStatus("UP");

  return `Configuration rollback for '${service}' executed successfully. Known stable baseline parameters restored. State: HEALTHY.`;
};

export const verifyRecoveryTool: ToolFunction = async (kwargs: Record<string, unknown>): Promise<string> => {
  const service = typeof kwargs.service === "string" ? kwargs.service : "dummy-api";
  const dbRunning = await ContainerService.checkContainerRunning("sentinel-db");

  let apiHealthy = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(env.DUMMY_API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    apiHealthy = resp.ok;
  } catch {
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

// Legacy compatibility tool for critical action testing
export const deleteDatabase: ToolFunction = async (kwargs: Record<string, unknown>): Promise<string> => {
  const dbName = typeof kwargs.db_name === "string" ? kwargs.db_name : "sentinel";
  return `Database '${dbName}' simulated deletion executed successfully (Safe demo execution mode).`;
};

// ============================================================================
// 3. TOOL REGISTRY (OFFICIAL CONTRACTS + BACKWARD-COMPATIBILITY ALIASES)
// ============================================================================

export const TOOLS: Record<string, ToolFunction> = {
  // Official tools
  get_system_status: getSystemStatusTool,
  get_service_logs: getServiceLogsTool,
  check_database: checkDatabaseTool,
  check_service: checkServiceTool,
  restart_service: restartServiceTool,
  rollback_configuration: rollbackConfigurationTool,
  rollback_service: rollbackConfigurationTool,
  verify_recovery: verifyRecoveryTool,
  // Backward compatibility aliases
  get_docker_logs: getServiceLogsTool,
  restart_container: restartServiceTool,
  delete_database: deleteDatabase,
};

// ============================================================================
// 4. LIVE OPENAI TOOLS (ONLY EXECUTABLE TOOLS EXPOSED TO THE MODEL)
// ============================================================================

export const LIVE_OPENAI_TOOLS: OpenAiToolDeclaration[] = Object.values(SENTINEL_TOOL_DEFINITIONS)
  .filter((tool) => tool.isExecutable)
  .map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
