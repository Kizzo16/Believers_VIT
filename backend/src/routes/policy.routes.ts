import { FastifyInstance } from "fastify";
import {
  evaluateActionPolicyHandler,
  getLatestPolicyDecisionHandler,
} from "../controllers/policy.controller";

export async function policyRoutes(fastify: FastifyInstance) {
  fastify.get("/api/policy/decision/latest", getLatestPolicyDecisionHandler);
  fastify.post("/api/policy/evaluate", evaluateActionPolicyHandler);
}
