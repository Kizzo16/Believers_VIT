"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chaosRoutes = chaosRoutes;
const chaos_controller_1 = require("../controllers/chaos.controller");
async function chaosRoutes(fastify) {
    fastify.post("/api/chaos/kill-db", chaos_controller_1.killDbHandler);
    fastify.post("/api/chaos/propose-dangerous", chaos_controller_1.proposeDangerousHandler);
    fastify.post("/api/trigger-mock-incident", chaos_controller_1.triggerMockIncidentHandler);
    fastify.get("/api/policies", chaos_controller_1.getPoliciesHandler);
    fastify.post("/api/policies", chaos_controller_1.updatePoliciesHandler);
}
