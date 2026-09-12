import { FastifyInstance } from "fastify";
import {
  getLatestInvestigationHandler,
  runInvestigationHandler,
} from "../controllers/investigation.controller";

export async function investigationRoutes(fastify: FastifyInstance) {
  fastify.post("/api/investigate", runInvestigationHandler);
  fastify.get("/api/investigate/latest", getLatestInvestigationHandler);
}
