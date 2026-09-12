import { FastifyInstance } from "fastify";
import {
  handleGetLatestReinvestigation,
  handleGetReinvestigationHistory,
  handleTriggerReinvestigation,
} from "../controllers/reinvestigation.controller";

export async function reinvestigationRoutes(fastify: FastifyInstance) {
  fastify.post("/api/reinvestigation/trigger", handleTriggerReinvestigation);
  fastify.get("/api/reinvestigation/latest", handleGetLatestReinvestigation);
  fastify.get("/api/reinvestigation/history", handleGetReinvestigationHistory);
}
