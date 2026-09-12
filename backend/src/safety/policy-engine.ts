import { ZodError } from "zod";
import { TOOLS } from "../agent/tools";
import { ToolExecutionResult } from "../agent/types";
import { loadPolicies } from "../config/policies";
import { incidentService } from "../services/incident.service";
import { TOOL_SCHEMAS, ToolName } from "./schemas";
import { emitSentinelEvent } from "../realtime/socket";

export async function executeToolWithGuardrail(
  toolName: string,
  incidentIdOrKwargs?: string | null | Record<string, unknown>,
  maybeKwargs?: Record<string, unknown>
): Promise<ToolExecutionResult> {
  let incidentId: string | null = null;
  let kwargs: Record<string, unknown> = {};

  if (typeof incidentIdOrKwargs === "object" && incidentIdOrKwargs !== null) {
    kwargs = incidentIdOrKwargs;
  } else {
    incidentId = incidentIdOrKwargs || null;
    kwargs = maybeKwargs || {};
  }

  // 1. Verify tool exists in tool registry
  if (!Object.prototype.hasOwnProperty.call(TOOLS, toolName)) {
    const errMsg = `Tool '${toolName}' not recognized in tool registry`;
    incidentService.logEvent(`❌ [Tool Error] ${errMsg}`, "ERROR");
    return { status: "ERROR", message: errMsg };
  }

  // 2. Strict Zod Argument Validation & Whitelisting
  let validatedKwargs: Record<string, unknown> = kwargs;
  if (Object.prototype.hasOwnProperty.call(TOOL_SCHEMAS, toolName)) {
    const schema = TOOL_SCHEMAS[toolName as ToolName];
    try {
      validatedKwargs = schema.parse(kwargs) as Record<string, unknown>;
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        const errorDetails = err.errors;
        const errMsg = `Argument validation failed for tool '${toolName}': Invalid arguments provided.`;
        incidentService.logEvent(
          `❌ [Validation Error] ${errMsg} Details: ${JSON.stringify(errorDetails)}`,
          "WARNING"
        );
        return {
          status: "ERROR",
          error_type: "VALIDATION_ERROR",
          message: errMsg,
          details: errorDetails,
        };
      }
      const errMsg = `Unexpected validation error for tool '${toolName}': ${String(err)}`;
      incidentService.logEvent(`❌ [Validation Error] ${errMsg}`, "WARNING");
      return {
        status: "ERROR",
        error_type: "VALIDATION_ERROR",
        message: errMsg,
      };
    }
  }

  // 3. Guardrail Policy Check
  const policies = loadPolicies();
  const policy = policies[toolName] || { risk: "UNKNOWN", auto_execute: false };
  const risk = policy.risk || "HIGH";
  const autoExecute = policy.auto_execute || false;

  incidentService.logEvent(
    `🛡️ [Guardrail Check] Evaluating '${toolName}' - Risk: ${risk}, Auto-Execute: ${autoExecute}`
  );

  if (!autoExecute) {
    const msg = `Requires Human Approval (Action '${toolName}' has risk level ${risk})`;
    incidentService.logEvent(`⛔ [Guardrail Blocked] ${msg}`, "WARNING");

    const approvalId = `APPR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const approvalReq = {
      id: approvalId,
      incident_id: incidentId,
      tool_name: toolName,
      kwargs: validatedKwargs,
      risk,
      status: "PENDING" as const,
      requested_at: new Date().toISOString(),
      decision: null,
      decided_at: null,
      execution_result: null,
      success: null,
      error: null,
    };

    incidentService.addPendingApproval(approvalReq);

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
  incidentService.logEvent(
    `✅ [Guardrail Approved] Auto-executing '${toolName}' with args ${JSON.stringify(validatedKwargs)}`
  );

  const toolFunc = TOOLS[toolName];
  try {
    emitSentinelEvent("tool.called", { tool_name: toolName, kwargs: validatedKwargs });
    const output = await toolFunc(validatedKwargs);
    incidentService.logEvent(`⚡ [Tool Result] ${toolName} output: ${output}`);
    emitSentinelEvent("tool.result", { tool_name: toolName, result: output });
    return { status: "SUCCESS", result: output };
  } catch (exc: unknown) {
    const errMsg = `Tool execution error: ${exc instanceof Error ? exc.message : String(exc)}`;
    incidentService.logEvent(`❌ [Tool Error] ${errMsg}`, "ERROR");
    return { status: "ERROR", message: errMsg };
  }
}
