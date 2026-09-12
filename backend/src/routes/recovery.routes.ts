import { FastifyInstance } from "fastify";
import {
  evaluateRecoveryHandler,
  getRecoveryStrategiesHandler,
} from "../controllers/recovery.controller";

export async function recoveryRoutes(fastify: FastifyInstance) {
  fastify.get("/api/recovery/strategies", getRecoveryStrategiesHandler);
  fastify.post("/api/recovery/evaluate", evaluateRecoveryHandler);
}
