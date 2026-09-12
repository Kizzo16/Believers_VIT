import { buildApp } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { initSocketServer } from "./realtime/socket";
import { healthMonitorService } from "./services/health.service";

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

    // Start background health monitor loop
    healthMonitorService.start(3000);

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, initiating graceful shutdown...`);
      healthMonitorService.stop();
      try {
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
