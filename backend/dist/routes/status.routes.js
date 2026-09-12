"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusRoutes = statusRoutes;
const status_controller_1 = require("../controllers/status.controller");
async function statusRoutes(fastify) {
    fastify.get("/", status_controller_1.indexHandler);
    fastify.get("/api/status", status_controller_1.getStatusHandler);
}
