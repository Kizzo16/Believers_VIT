import { FastifyReply, FastifyRequest } from "fastify";
import { policyEvaluatorService } from "../services/policy-evaluator.service";

export async function getLatestPolicyDecisionHandler(_req: FastifyRequest, reply: FastifyReply) {
  const decision = policyEvaluatorService.getLatestDecision();
  return reply.send({
    status: "SUCCESS",
    policy_decision: decision,
  });
}

export async function evaluateActionPolicyHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = (req.body || {}) as { tool_name?: string; kwargs?: Record<string, unknown> };
  const toolName = body.tool_name || "restart_service";
  const kwargs = body.kwargs || {};

  const decision = policyEvaluatorService.evaluateAction(toolName, kwargs);
  return reply.send({
    status: "SUCCESS",
    policy_decision: decision,
  });
}
