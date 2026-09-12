import { buildApp } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { initSocketServer } from "./realtime/socket";
import { healthMonitorService } from "./services/health.service";
import { incidentService } from "./services/incident.service";
import { checkDatabaseConnection, closeDbPool } from "./db/connection";

async function main() {
  const app = buildApp();

  try {
    await app.ready();

    // Attach Socket.IO to the Fastify underlying Node HTTP server
    initSocketServer(app.server);

    // Bind and listen
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    logger.info(`Sentinel Fastify Control Plane listening at ${address}`);

    // Bounded startup recovery from persistent control database
    try {
      await incidentService.rehydrateFromDatabase();
    } catch (err: unknown) {
      logger.warn(
        { error: err instanceof Error ? err.message : String(err) },
        "[Startup Recovery] Unexpected error during rehydration. Continuing in in-memory mode."
      );
    }

    // Start background health monitor loop
    healthMonitorService.start(3000);

    // Non-blocking diagnostic database connectivity check (Phase 1 foundation)
    void checkDatabaseConnection().then((status) => {
      if (status.configured) {
        if (status.available) {
          logger.info(`[Database] Connected to PostgreSQL (${status.latencyMs}ms latency)`);
        } else {
          logger.warn(`[Database] PostgreSQL configured but unreachable: ${status.error}`);
        }
      } else {
        logger.info("[Database] DATABASE_URL not configured. Running in memory-only mode (Phase 1 transition).");
      }
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, initiating graceful shutdown...`);
      healthMonitorService.stop();
      try {
        await closeDbPool();
        await app.close();
        logger.info("Fastify server closed cleanly");
        process.exit(0);
      } catch (err) {
        logger.error({ err }, "Error during shutdown");
        process.exit(1);
      }
    };

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (err) {
    logger.error({ err }, "Failed to start Sentinel server");
    process.exit(1);
  }
}

void main();
