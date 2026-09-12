import { FastifyReply, FastifyRequest } from "fastify";
import { recoveryVerificationService } from "../services/recovery-verification.service";

interface VerifyRequestBody {
  incident_id?: string;
}

export async function handleVerifyRecovery(
  request: FastifyRequest<{ Body: VerifyRequestBody }>,
  reply: FastifyReply
) {
  try {
    const { incident_id } = request.body || {};
    const report = await recoveryVerificationService.verifyRecovery(incident_id);
    return reply.status(200).send(report);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return reply.status(500).send({ error: message });
  }
}

export async function handleGetLatestVerificationReport(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  const report = recoveryVerificationService.getLatestReport();
  return reply.status(200).send(report);
}

export async function handleGetVerificationHistory(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  const history = recoveryVerificationService.getVerificationHistory();
  return reply.status(200).send(history);
}
