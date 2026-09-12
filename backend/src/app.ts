import Fastify, { FastifyError } from "fastify";
import cors from "@fastify/cors";
import { logger } from "./utils/logger";
import { statusRoutes } from "./routes/status.routes";
import { chaosRoutes } from "./routes/chaos.routes";
import { approvalRoutes } from "./routes/approval.routes";
import { observabilityRoutes } from "./routes/observability.routes";
import { topologyRoutes } from "./routes/topology.routes";
import { investigationRoutes } from "./routes/investigation.routes";
import { blastRadiusRoutes } from "./routes/blast-radius.routes";

export function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    disableRequestLogging: process.env.NODE_ENV === "test",
  });

  // CORS middleware (matches Python allow_origins=["*"])
  void app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["*"],
    credentials: true,
  });

  // Register API route plugins
  void app.register(statusRoutes);
  void app.register(chaosRoutes);
  void app.register(approvalRoutes);
  void app.register(observabilityRoutes);
  void app.register(topologyRoutes);
  void app.register(investigationRoutes);
  void app.register(blastRadiusRoutes);




  // Centralized Error Handling
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    logger.error({ err: error }, "Fastify request error");

    const statusCode = error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    return reply.status(statusCode).send({
      detail: message,
      status: "ERROR",
      statusCode,
    });
  });

  return app;
}

export type AppInstance = ReturnType<typeof buildApp>;
