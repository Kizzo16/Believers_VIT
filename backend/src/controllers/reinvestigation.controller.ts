import { FastifyReply, FastifyRequest } from "fastify";
import { reinvestigationService } from "../services/reinvestigation.service";
import { recoveryVerificationService } from "../services/recovery-verification.service";

export async function handleTriggerReinvestigation(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const latestVerif = recoveryVerificationService.getLatestReport();
    if (!latestVerif) {
      return reply.status(400).send({
        error: "No prior verification report available to perform re-investigation.",
      });
    }

    const report = await reinvestigationService.reinvestigate(latestVerif);
    return reply.status(200).send(report);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return reply.status(500).send({ error: message });
  }
}

export async function handleGetLatestReinvestigation(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  const report = reinvestigationService.getLatestReport();
  return reply.status(200).send(report);
}

export async function handleGetReinvestigationHistory(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  const history = reinvestigationService.getHistory();
  return reply.status(200).send(history);
}
