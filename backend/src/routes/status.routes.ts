import { FastifyInstance } from "fastify";
import { getStatusHandler, indexHandler } from "../controllers/status.controller";

export async function statusRoutes(fastify: FastifyInstance) {
  fastify.get("/", indexHandler);
  fastify.get("/api/status", getStatusHandler);
}
