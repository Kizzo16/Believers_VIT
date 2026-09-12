"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalRoutes = approvalRoutes;
const approval_controller_1 = require("../controllers/approval.controller");
async function approvalRoutes(fastify) {
    fastify.post("/api/approve-action", approval_controller_1.approveActionHandler);
}
