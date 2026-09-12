"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeToolWithGuardrail = executeToolWithGuardrail;
const zod_1 = require("zod");
const tools_1 = require("../agent/tools");
const policies_1 = require("../config/policies");
const incident_service_1 = require("../services/incident.service");
const schemas_1 = require("./schemas");
const socket_1 = require("../realtime/socket");
async function executeToolWithGuardrail(toolName, incidentIdOrKwargs, maybeKwargs) {
    let incidentId = null;
    let kwargs = {};
    if (typeof incidentIdOrKwargs === "object" && incidentIdOrKwargs !== null) {
        kwargs = incidentIdOrKwargs;
    }
    else {
        incidentId = incidentIdOrKwargs || null;
        kwargs = maybeKwargs || {};
    }
    // 1. Verify tool exists in tool registry
    if (!Object.prototype.hasOwnProperty.call(tools_1.TOOLS, toolName)) {
        const errMsg = `Tool '${toolName}' not recognized in tool registry`;
        incident_service_1.incidentService.logEvent(`❌ [Tool Error] ${errMsg}`, "ERROR");
        return { status: "ERROR", message: errMsg };
    }
    // 2. Strict Zod Argument Validation & Whitelisting
    let validatedKwargs = kwargs;
    if (Object.prototype.hasOwnProperty.call(schemas_1.TOOL_SCHEMAS, toolName)) {
        const schema = schemas_1.TOOL_SCHEMAS[toolName];
        try {
            validatedKwargs = schema.parse(kwargs);
        }
        catch (err) {
            if (err instanceof zod_1.ZodError) {
                const errorDetails = err.errors;
                const errMsg = `Argument validation failed for tool '${toolName}': Invalid arguments provided.`;
                incident_service_1.incidentService.logEvent(`❌ [Validation Error] ${errMsg} Details: ${JSON.stringify(errorDetails)}`, "WARNING");
                return {
                    status: "ERROR",
                    error_type: "VALIDATION_ERROR",
                    message: errMsg,
                    details: errorDetails,
                };
            }
            const errMsg = `Unexpected validation error for tool '${toolName}': ${String(err)}`;
            incident_service_1.incidentService.logEvent(`❌ [Validation Error] ${errMsg}`, "WARNING");
            return {
                status: "ERROR",
                error_type: "VALIDATION_ERROR",
                message: errMsg,
            };
        }
    }
    // 3. Guardrail Policy Check
    const policies = (0, policies_1.loadPolicies)();
    const policy = policies[toolName] || { risk: "UNKNOWN", auto_execute: false };
    const risk = policy.risk || "HIGH";
    const autoExecute = policy.auto_execute || false;
    incident_service_1.incidentService.logEvent(`🛡️ [Guardrail Check] Evaluating '${toolName}' - Risk: ${risk}, Auto-Execute: ${autoExecute}`);
    if (!autoExecute) {
        const msg = `Requires Human Approval (Action '${toolName}' has risk level ${risk})`;
        incident_service_1.incidentService.logEvent(`⛔ [Guardrail Blocked] ${msg}`, "WARNING");
        const approvalId = `APPR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const approvalReq = {
            id: approvalId,
            incident_id: incidentId,
            tool_name: toolName,
            kwargs: validatedKwargs,
            risk,
            status: "PENDING",
            requested_at: new Date().toISOString(),
            decision: null,
            decided_at: null,
            execution_result: null,
            success: null,
            error: null,
        };
        incident_service_1.incidentService.addPendingApproval(approvalReq);
        return {
            status: "Requires Human Approval",
            approval_id: approvalId,
            risk,
            message: msg,
            tool_name: toolName,
            kwargs: validatedKwargs,
        };
    }
    // 4. Auto-Execution with Validated Arguments
    incident_service_1.incidentService.logEvent(`✅ [Guardrail Approved] Auto-executing '${toolName}' with args ${JSON.stringify(validatedKwargs)}`);
    const toolFunc = tools_1.TOOLS[toolName];
    try {
        (0, socket_1.emitSentinelEvent)("tool.called", { tool_name: toolName, kwargs: validatedKwargs });
        const output = await toolFunc(validatedKwargs);
        incident_service_1.incidentService.logEvent(`⚡ [Tool Result] ${toolName} output: ${output}`);
        (0, socket_1.emitSentinelEvent)("tool.result", { tool_name: toolName, result: output });
        return { status: "SUCCESS", result: output };
    }
    catch (exc) {
        const errMsg = `Tool execution error: ${exc instanceof Error ? exc.message : String(exc)}`;
        incident_service_1.incidentService.logEvent(`❌ [Tool Error] ${errMsg}`, "ERROR");
        return { status: "ERROR", message: errMsg };
    }
}
