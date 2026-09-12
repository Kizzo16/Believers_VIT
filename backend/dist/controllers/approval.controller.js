"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveActionHandler = approveActionHandler;
const schemas_1 = require("../safety/schemas");
const approval_service_1 = require("../services/approval.service");
async function approveActionHandler(req, reply) {
    const parsed = schemas_1.ApprovalRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        return reply.status(400).send({
            detail: `Invalid action request: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
        });
    }
    try {
        const result = await approval_service_1.ApprovalService.handleApproval(parsed.data.approval_id, parsed.data.action);
        return reply.status(200).send(result);
    }
    catch (err) {
        const statusCode = typeof err === "object" && err !== null && "statusCode" in err && typeof err.statusCode === "number"
            ? err.statusCode
            : 500;
        const detail = err instanceof Error ? err.message : String(err);
        return reply.status(statusCode).send({ detail });
    }
}
