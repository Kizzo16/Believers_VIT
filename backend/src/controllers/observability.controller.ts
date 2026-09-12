import { FastifyReply, FastifyRequest } from "fastify";
import { observabilityService } from "../services/observability.service";
import { incidentService } from "../services/incident.service";

export async function getEvidenceHandler(_req: FastifyRequest, reply: FastifyReply) {
  const evidence = observabilityService.getEvidence();
  return reply.send(evidence);
}

export async function getMetricsHandler(_req: FastifyRequest, reply: FastifyReply) {
  const metrics = observabilityService.getMetrics();
  return reply.send(metrics);
}

export async function getIncidentsHandler(_req: FastifyRequest, reply: FastifyReply) {
  const currentIncident = incidentService.getCurrentIncident();
  return reply.send({
    active_incident: currentIncident,
    logs: incidentService.incidentLogs.toArray().slice(-30),
  });
}
