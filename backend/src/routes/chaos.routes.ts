import { FastifyInstance } from "fastify";
import {
  configFailureHandler,
  getPoliciesHandler,
  killApiHandler,
  killDbHandler,
  proposeDangerousHandler,
  resetEnvironmentHandler,
  triggerMockIncidentHandler,
  updatePoliciesHandler,
} from "../controllers/chaos.controller";

export async function chaosRoutes(fastify: FastifyInstance) {
  fastify.post("/api/chaos/kill-db", killDbHandler);
  fastify.post("/api/chaos/kill-api", killApiHandler);
  fastify.post("/api/chaos/config-failure", configFailureHandler);
  fastify.post("/api/chaos/reset", resetEnvironmentHandler);
  fastify.post("/api/chaos/propose-dangerous", proposeDangerousHandler);
  fastify.post("/api/trigger-mock-incident", triggerMockIncidentHandler);
  fastify.get("/api/policies", getPoliciesHandler);
  fastify.post("/api/policies", updatePoliciesHandler);
}

