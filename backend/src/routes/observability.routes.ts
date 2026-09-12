import { FastifyInstance } from "fastify";
import {
  getEvidenceHandler,
  getIncidentsHandler,
  getMetricsHandler,
} from "../controllers/observability.controller";

export async function observabilityRoutes(fastify: FastifyInstance) {
  fastify.get("/api/observability/evidence", getEvidenceHandler);
  fastify.get("/api/observability/metrics", getMetricsHandler);
  fastify.get("/api/incidents/history", getIncidentsHandler);
}
