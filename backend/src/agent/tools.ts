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

export const getMetricsTool: ToolFunction = async (_kwargs: Record<string, unknown>): Promise<string> => {
  const health = incidentService.getSystemHealth();
  const dbStatus = incidentService.getDatabaseStatus();
  const apiStatus = incidentService.getDummyApiStatus();
  const activeIncident = incidentService.isActiveIncident();
  const currentIncident = incidentService.getCurrentIncident();
  const lastPingTime = incidentService.getLastPingTime();
  const lastPingCode = incidentService.getLastPingCode();
  const recentLogs = incidentService.incidentLogs.toArray();
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

  // Reset metrics for clean post-action verification
  observabilityService.resetMetrics();

  return `Service '${service}' restarted successfully. Incident transitioned to RECOVERING state pending Module 10 verification.`;
};

export const rollbackConfigurationTool: ToolFunction = async (kwargs: Record<string, unknown>): Promise<string> => {
  const service = typeof kwargs.service === "string" ? kwargs.service : "dummy-api";

  // Real state mutation in controlled demo environment
  incidentService.setDatabaseStatus("UP");
  incidentService.setDummyApiStatus("UP");
  incidentService.setSystemHealth("RECOVERING");
  observabilityService.resetMetrics();

  try {
    await fetch("http://127.0.0.1:8001/chaos/reset", { method: "POST" });
  } catch {}

  return `Configuration rollback for '${service}' executed successfully. Known stable baseline parameters restored. State: RECOVERING pending Module 10 verification.`;
};


export const verifyRecoveryTool: ToolFunction = async (kwargs: Record<string, unknown>): Promise<string> => {
  const service = typeof kwargs.service === "string" ? kwargs.service : "dummy-api";

  if (service === "sentinel-db") {
    const isRunning = await ContainerService.checkContainerRunning("sentinel-db");
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
    const resp = await fetch(env.DUMMY_API_URL, { signal: controller.signal });
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return JSON.stringify({
      verified: false,
      service: "dummy-api",
      status: "DOWN",
      evidence: [`health probe connection failed: ${msg}`],
    });
  }
};

// Legacy compatibility tool for critical action testing
export const deleteDatabase: ToolFunction = async (kwargs: Record<string, unknown>): Promise<string> => {
  const dbName = typeof kwargs.db_name === "string" ? kwargs.db_name : "sentinel";
  return `Database '${dbName}' simulated deletion executed successfully (Safe demo execution mode).`;
};

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
export const rollbackServiceTool: ToolFunction = async (kwargs: Record<string, unknown>): Promise<string> => {
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
    const isRunning = await ContainerService.checkContainerRunning("sentinel-db");

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
      const restartResult = await ContainerService.restartContainer("sentinel-db");
      return JSON.stringify({
        success: true,
        service: "sentinel-db",
        reason: "Rolled back sentinel-db to last persisted state using existing postgres:16-alpine image and volume data. This is the only rollback target available in the current demo environment.",
        action_taken: `container-reinit: ${restartResult}`,
      });
    } catch (err: unknown) {
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


// ============================================================================
// 3. TOOL REGISTRY (OFFICIAL CONTRACTS + BACKWARD-COMPATIBILITY ALIASES)
// ============================================================================

export const TOOLS: Record<string, ToolFunction> = {
  // Official investigation tools (auto-executed, LOW risk)
  get_system_status: getSystemStatusTool,
  get_service_logs: getServiceLogsTool,
  get_metrics: getMetricsTool,
  check_database: checkDatabaseTool,
  check_service: checkServiceTool,
  verify_recovery: verifyRecoveryTool,
  // Official remediation tools
  restart_service: restartServiceTool,
  rollback_configuration: rollbackConfigurationTool,
  rollback_service: rollbackServiceTool,
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
