import { FastifyReply, FastifyRequest } from "fastify";
import { ContainerService } from "../services/container.service";
import { incidentService } from "../services/incident.service";
import { blastRadiusService } from "../services/blast-radius.service";
import { recoveryPlannerService } from "../services/recovery-planner.service";
import { policyEvaluatorService } from "../services/policy-evaluator.service";
import { actionExecutorService } from "../services/action-executor.service";
import { loadPolicies } from "../config/policies";
import { SystemStatusResponse } from "../types/sentinel";

export async function indexHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    service: "Sentinel SRE Agent Control Plane",
    port: 8000,
    status_endpoint: "/api/status",
    docs: "/docs",
  });
}

export async function getStatusHandler(_req: FastifyRequest, reply: FastifyReply) {
  const dbRunning = await ContainerService.checkContainerRunning("sentinel-db");
  const apiRunning = await ContainerService.checkContainerRunning("dummy-api");

  const databaseStatus =
    dbRunning && incidentService.getDatabaseStatus() !== "DOWN"
      ? "UP"
      : dbRunning && !incidentService.isActiveIncident()
      ? "UP"
      : "DOWN";

  const response: SystemStatusResponse = {
    system_health: incidentService.getSystemHealth(),
    dummy_api_status: incidentService.getDummyApiStatus(),
    database_status: databaseStatus,
    containers: {
      sentinel_db: dbRunning ? "RUNNING" : "STOPPED",
      dummy_api: apiRunning ? "RUNNING" : "STOPPED",
    },
    last_ping_time: incidentService.getLastPingTime(),
    last_ping_code: incidentService.getLastPingCode(),
    active_incident: incidentService.isActiveIncident(),
    current_incident: incidentService.getCurrentIncident(),
    blast_radius: blastRadiusService.getLatestAnalysis(),
    recovery_plan: recoveryPlannerService.getLatestPlan(),
    latest_policy_decision: policyEvaluatorService.getLatestDecision(),
    latest_execution_receipt: actionExecutorService.getLatestReceipt() || undefined,
    ai_reasoning: incidentService.aiReasoning.toArray(),
    incident_logs: incidentService.incidentLogs.toArray(),
    pending_approvals: incidentService.pendingApprovals.toArray(),
    policies: loadPolicies(),
  };

  return reply.send(response);
}
