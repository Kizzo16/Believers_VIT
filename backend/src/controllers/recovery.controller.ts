import { FastifyReply, FastifyRequest } from "fastify";
import { recoveryPlannerService } from "../services/recovery-planner.service";

export async function getRecoveryStrategiesHandler(_req: FastifyRequest, reply: FastifyReply) {
  const plan = recoveryPlannerService.getLatestPlan();
  return reply.send({
    status: "SUCCESS",
    recovery_plan: plan,
  });
}

export async function evaluateRecoveryHandler(_req: FastifyRequest, reply: FastifyReply) {
  const plan = recoveryPlannerService.generateRecoveryPlan();
  return reply.send({
    status: "SUCCESS",
    recovery_plan: plan,
  });
}
