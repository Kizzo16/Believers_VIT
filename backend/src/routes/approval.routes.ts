import { FastifyInstance } from "fastify";
import { approveActionHandler } from "../controllers/approval.controller";

export async function approvalRoutes(fastify: FastifyInstance) {
  fastify.post("/api/approve-action", approveActionHandler);
}
