import { FastifyInstance } from "fastify";
import { getImpactHandler, getTopologyHandler } from "../controllers/topology.controller";

export async function topologyRoutes(fastify: FastifyInstance) {
  fastify.get("/api/topology", getTopologyHandler);
  fastify.get("/api/topology/impact/:serviceId", getImpactHandler);
}
