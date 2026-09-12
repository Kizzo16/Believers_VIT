import { FastifyInstance } from "fastify";
import {
  executeActionHandler,
  getExecutionHistoryHandler,
} from "../controllers/executor.controller";

export async function executorRoutes(fastify: FastifyInstance) {
  fastify.post("/api/executor/execute", executeActionHandler);
  fastify.get("/api/executor/history", getExecutionHistoryHandler);
}
