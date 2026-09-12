"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalService = void 0;
const incident_service_1 = require("./incident.service");
const tools_1 = require("../agent/tools");
const policies_1 = require("../config/policies");
const socket_1 = require("../realtime/socket");
class ApprovalService {
    static async handleApproval(approvalId, action) {
        const normAction = action.toUpperCase().trim();
        // Locate pending approval record server-side
        const targetRecord = incident_service_1.incidentService.findPendingApproval(approvalId);
        if (!targetRecord) {
            incident_service_1.incidentService.logEvent(`❌ [Approval Validation Failed] Approval ID '${approvalId}' not found`, "WARNING");
            const err = new Error(`Approval request '${approvalId}' not found`);
            err.statusCode = 404;
            throw err;
        }
        // Validate state: prevent approving already resolved requests (anti-replay)
        if (targetRecord.status !== "PENDING") {
            const msg = `Approval request '${approvalId}' is already resolved with status '${targetRecord.status}'`;
            incident_service_1.incidentService.logEvent(`⛔ [Invalid State Transition] {msg}`, "WARNING");
            const err = new Error(msg);
            err.statusCode = 409;
            throw err;
        }
        const toolName = targetRecord.tool_name;
        if (!Object.prototype.hasOwnProperty.call(tools_1.TOOLS, toolName)) {
            const errDetail = `Tool '${toolName}' referenced in approval is not recognized by Sentinel tool registry`;
            incident_service_1.incidentService.logEvent(`❌ [Security Alert] ${errDetail}`, "ERROR");
            const err = new Error(errDetail);
            err.statusCode = 400;
            throw err;
        }
        const policies = (0, policies_1.loadPolicies)();
        if (!Object.prototype.hasOwnProperty.call(policies, toolName)) {
            const errDetail = `Tool '${toolName}' has no registered policy in policies.json`;
            incident_service_1.incidentService.logEvent(`❌ [Policy Alert] ${errDetail}`, "ERROR");
            const err = new Error(errDetail);
            err.statusCode = 403;
            throw err;
        }
        const timestamp = new Date().toISOString();
        if (normAction === "APPROVE") {
            targetRecord.status = "APPROVED";
            targetRecord.decision = "APPROVED";
            targetRecord.decided_at = timestamp;
            // Execute using ONLY original server-side kwargs (client cannot tamper with parameters)
            const originalKwargs = targetRecord.kwargs || {};
            const toolFunc = tools_1.TOOLS[toolName];
            let execResult;
            try {
                execResult = await toolFunc(originalKwargs);
                targetRecord.execution_result = execResult;
                targetRecord.success = true;
                targetRecord.error = null;
            }
            catch (exc) {
                const errorMsg = exc instanceof Error ? exc.message : String(exc);
                execResult = `Execution failed: ${errorMsg}`;
                targetRecord.execution_result = execResult;
                targetRecord.success = false;
                targetRecord.error = errorMsg;
            }
            const auditEvent = {
                approval_id: targetRecord.id,
                incident_id: targetRecord.incident_id,
                tool_name: toolName,
                operator_decision: "APPROVE",
                timestamp,
                execution_result: targetRecord.execution_result,
                success: targetRecord.success ?? false,
                error: targetRecord.error ?? null,
            };
            incident_service_1.incidentService.logEvent(`🛡️ [AUDIT EVENT] Operator APPROVED action '${toolName}' (Approval ID: ${targetRecord.id}). Execution Result: ${String(targetRecord.execution_result)}`, targetRecord.success ? "INFO" : "ERROR");
            incident_service_1.incidentService.addAiReasoning(`Operator OVERRIDE APPROVED for '${toolName}'. Action executed safely.`, `${toolName}(**args)`, String(targetRecord.execution_result));
            (0, socket_1.emitSentinelEvent)("approval.resolved", { targetRecord, audit: auditEvent });
            return {
                status: "EXECUTED",
                approval_id: targetRecord.id,
                tool_name: toolName,
                result: targetRecord.execution_result,
                audit: auditEvent,
            };
        }
        else {
            // REJECT
            targetRecord.status = "REJECTED";
            targetRecord.decision = "REJECTED";
            targetRecord.decided_at = timestamp;
            targetRecord.execution_result = "NOT_EXECUTED";
            targetRecord.success = true;
            targetRecord.error = null;
            const auditEvent = {
                approval_id: targetRecord.id,
                incident_id: targetRecord.incident_id,
                tool_name: toolName,
                operator_decision: "REJECT",
                timestamp,
                execution_result: "NOT_EXECUTED",
                success: true,
                error: null,
            };
            incident_service_1.incidentService.logEvent(`🛡️ [AUDIT EVENT] Operator REJECTED action '${toolName}' (Approval ID: ${targetRecord.id}). Action NOT executed. System secured.`, "WARNING");
            incident_service_1.incidentService.addAiReasoning(`Operator REJECTED override for '${toolName}'. Dangerous action was NOT executed. System secured.`, "guardrail_rejection", "BLOCKED (SYSTEM SECURED)");
            (0, socket_1.emitSentinelEvent)("approval.resolved", { targetRecord, audit: auditEvent });
            return {
                status: "REJECTED",
                approval_id: targetRecord.id,
                tool_name: toolName,
                result: "NOT_EXECUTED",
                audit: auditEvent,
            };
        }
    }
}
exports.ApprovalService = ApprovalService;
