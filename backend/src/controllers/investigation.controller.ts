import { FastifyReply, FastifyRequest } from "fastify";
import { aiInvestigationService } from "../services/ai-investigation.service";

export async function runInvestigationHandler(_req: FastifyRequest, reply: FastifyReply) {
  const result = aiInvestigationService.investigateIncident();
  return reply.send({
    status: "SUCCESS",
    investigation: result,
  });
}

export async function getLatestInvestigationHandler(_req: FastifyRequest, reply: FastifyReply) {
  const result = aiInvestigationService.getLatestResult();
  return reply.send({
    latest_investigation: result,
  });
}
