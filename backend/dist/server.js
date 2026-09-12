"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const logger_1 = require("./utils/logger");
const socket_1 = require("./realtime/socket");
const health_service_1 = require("./services/health.service");
async function main() {
    const app = (0, app_1.buildApp)();
    try {
        await app.ready();
        // Attach Socket.IO to the Fastify underlying Node HTTP server
        (0, socket_1.initSocketServer)(app.server);
        // Bind and listen
        const address = await app.listen({
            port: env_1.env.PORT,
            host: env_1.env.HOST,
        });
        logger_1.logger.info(`Sentinel Fastify Control Plane listening at ${address}`);
        // Start background health monitor loop
        health_service_1.healthMonitorService.start(3000);
        // Graceful Shutdown
        const shutdown = async (signal) => {
            logger_1.logger.info(`Received ${signal}, initiating graceful shutdown...`);
            health_service_1.healthMonitorService.stop();
            try {
                await app.close();
                logger_1.logger.info("Fastify server closed cleanly");
                process.exit(0);
            }
            catch (err) {
                logger_1.logger.error({ err }, "Error during shutdown");
                process.exit(1);
            }
        };
        process.on("SIGINT", () => void shutdown("SIGINT"));
        process.on("SIGTERM", () => void shutdown("SIGTERM"));
    }
    catch (err) {
        logger_1.logger.error({ err }, "Failed to start Sentinel server");
        process.exit(1);
    }
}
void main();
