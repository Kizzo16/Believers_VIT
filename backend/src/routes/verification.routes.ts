import { FastifyInstance } from "fastify";
import {
  handleGetLatestVerificationReport,
  handleGetVerificationHistory,
  handleVerifyRecovery,
} from "../controllers/verification.controller";

export async function verificationRoutes(fastify: FastifyInstance) {
  fastify.post("/api/verification/verify", handleVerifyRecovery);
  fastify.get("/api/verification/latest", handleGetLatestVerificationReport);
  fastify.get("/api/verification/history", handleGetVerificationHistory);
}
