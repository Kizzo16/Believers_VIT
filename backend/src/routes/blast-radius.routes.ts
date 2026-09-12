import { FastifyInstance } from "fastify";
import { getBlastRadiusHandler } from "../controllers/blast-radius.controller";

export async function blastRadiusRoutes(fastify: FastifyInstance) {
  fastify.get("/api/impact/blast-radius", getBlastRadiusHandler);
}
