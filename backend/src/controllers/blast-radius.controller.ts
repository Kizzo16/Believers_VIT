import { FastifyReply, FastifyRequest } from "fastify";
import { blastRadiusService } from "../services/blast-radius.service";

export async function getBlastRadiusHandler(_req: FastifyRequest, reply: FastifyReply) {
  const result = blastRadiusService.getLatestAnalysis();
  return reply.send({
    status: "SUCCESS",
    blast_radius: result,
  });
}
