"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.killDbHandler = killDbHandler;
exports.proposeDangerousHandler = proposeDangerousHandler;
exports.triggerMockIncidentHandler = triggerMockIncidentHandler;
exports.getPoliciesHandler = getPoliciesHandler;
exports.updatePoliciesHandler = updatePoliciesHandler;
const container_service_1 = require("../services/container.service");
const incident_service_1 = require("../services/incident.service");
const policy_engine_1 = require("../safety/policy-engine");
const policies_1 = require("../config/policies");
const schemas_1 = require("../safety/schemas");
async function killDbHandler(_req, reply) {
    incident_service_1.incidentService.logEvent("💥 [Chaos Engineering] Triggered: 'Kill Database' action invoked from UI");
    const res = await container_service_1.ContainerService.stopContainer("sentinel-db");
    incident_service_1.incidentService.setDatabaseStatus("DOWN");
    incident_service_1.incidentService.setSystemHealth("DEGRADED");
    return reply.send({
        status: "SUCCESS",
        action: "kill_database",
        container: "sentinel-db",
        output: res.stdout,
        message: "Database stopped. SRE Autonomous Agent will detect 500 error and initiate recovery.",
    });
}
async function proposeDangerousHandler(_req, reply) {
    incident_service_1.incidentService.logEvent("⚠️ [Chaos Engineering] AI Agent / Operator proposed: 'delete_database(db_name=\"sentinel\")'");
    incident_service_1.incidentService.addAiReasoning("Agent attempted to invoke dangerous tool 'delete_database'. Passing through Guardrail Policy Engine...", "delete_database(db_name='sentinel')");
    const result = await (0, policy_engine_1.executeToolWithGuardrail)("delete_database", null, { db_name: "sentinel" });
    incident_service_1.incidentService.addAiReasoning(`Guardrail Policy Decision: ${result.status} - Risk: ${result.risk || "CRITICAL"}`, undefined, result.message);
    return reply.send(result);
}
async function triggerMockIncidentHandler(req, reply) {
    const action = req.query.action || "stop_db";
    if (action === "stop_db") {
        return killDbHandler(req, reply);
    }
    else if (action === "dangerous") {
        return proposeDangerousHandler(req, reply);
    }
    return reply.status(400).send({ error: "Invalid action" });
}
async function getPoliciesHandler(_req, reply) {
    return reply.send((0, policies_1.loadPolicies)());
}
async function updatePoliciesHandler(req, reply) {
    const parsed = schemas_1.PolicyUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
        return reply.status(400).send({
            status: "ERROR",
            message: "Invalid policy update payload",
            details: parsed.error.errors,
        });
    }
    try {
        (0, policies_1.savePolicies)(parsed.data.policies);
        incident_service_1.incidentService.logEvent(`Policies updated: ${JSON.stringify(parsed.data.policies)}`);
        return reply.send({ status: "SUCCESS", policies: parsed.data.policies });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({ status: "ERROR", detail: errorMsg });
    }
}
