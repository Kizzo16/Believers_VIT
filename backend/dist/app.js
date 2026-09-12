"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const logger_1 = require("./utils/logger");
const status_routes_1 = require("./routes/status.routes");
const chaos_routes_1 = require("./routes/chaos.routes");
const approval_routes_1 = require("./routes/approval.routes");
function buildApp() {
    const app = (0, fastify_1.default)({
        loggerInstance: logger_1.logger,
        disableRequestLogging: process.env.NODE_ENV === "test",
    });
    // CORS middleware (matches Python allow_origins=["*"])
    void app.register(cors_1.default, {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["*"],
        credentials: true,
    });
    // Register API route plugins
    void app.register(status_routes_1.statusRoutes);
    void app.register(chaos_routes_1.chaosRoutes);
    void app.register(approval_routes_1.approvalRoutes);
    // Centralized Error Handling
    app.setErrorHandler((error, _request, reply) => {
        logger_1.logger.error({ err: error }, "Fastify request error");
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
