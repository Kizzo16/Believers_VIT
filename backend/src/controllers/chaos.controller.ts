import { FastifyReply, FastifyRequest } from "fastify";
import { ContainerService } from "../services/container.service";
import { incidentService } from "../services/incident.service";
import { executeToolWithGuardrail } from "../safety/policy-engine";
import { loadPolicies, savePolicies } from "../config/policies";
import { PolicyUpdateSchema } from "../safety/schemas";

export async function killDbHandler(_req: FastifyRequest, reply: FastifyReply) {
  incidentService.logEvent("💥 [Chaos Engineering] Triggered: 'Kill Database' action invoked from UI");

  try {
    const res = await ContainerService.stopContainer("sentinel-db");
    incidentService.setDatabaseStatus("DOWN");
    incidentService.setSystemHealth("DEGRADED");
    return reply.send({
      status: "SUCCESS",
      action: "kill_database",
      container: "sentinel-db",
      output: res.stdout,
      message: "Database stopped. SRE Autonomous Agent will detect 500 error and initiate recovery.",
    });
  } catch {
    // Also trigger dummy-api endpoint if docker stop unavailable or container inside network
    try {
      await fetch("http://localhost:8001/chaos/db-failure", { method: "POST" });
    } catch {}
    incidentService.setDatabaseStatus("DOWN");
    incidentService.setSystemHealth("DEGRADED");
    return reply.send({
      status: "SUCCESS",
      action: "kill_database",
      message: "Database failure state triggered in demo environment.",
    });
  }
}

export async function killApiHandler(_req: FastifyRequest, reply: FastifyReply) {
  incidentService.logEvent("💥 [Chaos Engineering] Triggered: 'API Failure' action invoked from UI");

  try {
    await fetch("http://localhost:8001/chaos/api-failure", { method: "POST" });
  } catch {}

  incidentService.setApiServiceStatus("DOWN");
  incidentService.setSystemHealth("DEGRADED");

  return reply.send({
    status: "SUCCESS",
    action: "kill_api",
    message: "API Failure state triggered. REST API now returning HTTP 500 internal server errors.",
  });
}

export async function configFailureHandler(_req: FastifyRequest, reply: FastifyReply) {
  incidentService.logEvent("💥 [Chaos Engineering] Triggered: 'Configuration Failure' action invoked from UI");

  try {
    await fetch("http://localhost:8001/chaos/config-failure", { method: "POST" });
  } catch {}

  incidentService.setDatabaseStatus("DOWN");
  incidentService.setSystemHealth("DEGRADED");

  return reply.send({
    status: "SUCCESS",
    action: "config_failure",
    message: "Configuration Failure triggered. Database connection parameters corrupted.",
  });
}

export async function resetEnvironmentHandler(_req: FastifyRequest, reply: FastifyReply) {
  incidentService.logEvent("🔄 [Chaos Engineering] Triggered: 'Reset Environment' action invoked from UI");

  try {
    await ContainerService.startContainer("sentinel-db");
  } catch {}

  try {
    await ContainerService.startContainer("dummy-api");
  } catch {}

  try {
    await fetch("http://localhost:8001/chaos/reset", { method: "POST" });
  } catch {}

  incidentService.setDatabaseStatus("HEALTHY");
  incidentService.setApiServiceStatus("HEALTHY");
  incidentService.setSystemHealth("HEALTHY");
  incidentService.clearIncidents();

  return reply.send({
    status: "SUCCESS",
    action: "reset_environment",
    message: "Environment successfully reset to NORMAL state. All containers & services healthy.",
  });
}

export async function proposeDangerousHandler(_req: FastifyRequest, reply: FastifyReply) {
  incidentService.logEvent("⚠️ [Chaos Engineering] AI Agent / Operator proposed: 'delete_database(db_name=\"sentinel\")'");

  incidentService.addAiReasoning(
    "Agent attempted to invoke dangerous tool 'delete_database'. Passing through Guardrail Policy Engine...",
    "delete_database(db_name='sentinel')"
  );

  const result = await executeToolWithGuardrail("delete_database", null, { db_name: "sentinel" });

  incidentService.addAiReasoning(
    `Guardrail Policy Decision: ${result.status} - Risk: ${result.risk || "CRITICAL"}`,
    undefined,
    result.message
  );

  return reply.send(result);
}

export async function triggerMockIncidentHandler(
  req: FastifyRequest<{ Querystring: { action?: string } }>,
  reply: FastifyReply
) {
  const action = req.query.action || "stop_db";
  if (action === "stop_db") {
    return killDbHandler(req, reply);
  } else if (action === "kill_api") {
    return killApiHandler(req, reply);
  } else if (action === "config_failure") {
    return configFailureHandler(req, reply);
  } else if (action === "reset") {
    return resetEnvironmentHandler(req, reply);
  } else if (action === "dangerous") {
    return proposeDangerousHandler(req, reply);
  }
  return reply.status(400).send({ error: "Invalid action" });
}


export async function getPoliciesHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send(loadPolicies());
}

export async function updatePoliciesHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = PolicyUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({
      status: "ERROR",
      message: "Invalid policy update payload",
      details: parsed.error.errors,
    });
  }

  try {
    savePolicies(parsed.data.policies);
    incidentService.logEvent(`Policies updated: ${JSON.stringify(parsed.data.policies)}`);
    return reply.send({ status: "SUCCESS", policies: parsed.data.policies });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return reply.status(500).send({ status: "ERROR", detail: errorMsg });
  }
}
