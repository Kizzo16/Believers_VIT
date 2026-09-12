import { AuditEvent } from "../types/sentinel";
import { incidentService } from "./incident.service";
import { TOOLS } from "../agent/tools";
import { loadPolicies } from "../config/policies";
import { emitSentinelEvent } from "../realtime/socket";
import { verifyIncidentRecovery } from "../agent/agent";
import { ApprovalRepository } from "../repositories/approval.repository";
import { AuditRepository } from "../repositories/audit.repository";
import { safePersist } from "../utils/persistence";

export interface ApprovalResult {
  status: "EXECUTED" | "REJECTED";
  approval_id: string;
  tool_name: string;
  result: unknown;
  audit: AuditEvent;
}

export class ApprovalService {
  static async handleApproval(
    approvalId: string,
    action: "APPROVE" | "REJECT"
  ): Promise<ApprovalResult> {
    const normAction = action.toUpperCase().trim() as "APPROVE" | "REJECT";

    // Locate pending approval record server-side
    const targetRecord = incidentService.findPendingApproval(approvalId);
    if (!targetRecord) {
      incidentService.logEvent(
        `❌ [Approval Validation Failed] Approval ID '${approvalId}' not found`,
        "WARNING"
      );
      const err = new Error(`Approval request '${approvalId}' not found`);
      (err as { statusCode?: number }).statusCode = 404;
      throw err;
    }

    // Validate state: prevent approving already resolved requests (anti-replay)
    if (targetRecord.status !== "PENDING") {
      const msg = `Approval request '${approvalId}' is already resolved with status '${targetRecord.status}'`;
      incidentService.logEvent(`⛔ [Invalid State Transition] ${msg}`, "WARNING");
      const err = new Error(msg);
      (err as { statusCode?: number }).statusCode = 409;
      throw err;
    }

    const toolName = targetRecord.tool_name;
    if (!Object.prototype.hasOwnProperty.call(TOOLS, toolName)) {
      const errDetail = `Tool '${toolName}' referenced in approval is not recognized by Sentinel tool registry`;
      incidentService.logEvent(`❌ [Security Alert] ${errDetail}`, "ERROR");
      const err = new Error(errDetail);
      (err as { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const policies = loadPolicies();
    if (!Object.prototype.hasOwnProperty.call(policies, toolName)) {
      const errDetail = `Tool '${toolName}' has no registered policy in policies.json`;
      incidentService.logEvent(`❌ [Policy Alert] ${errDetail}`, "ERROR");
      const err = new Error(errDetail);
      (err as { statusCode?: number }).statusCode = 403;
      throw err;
    }

    const timestamp = new Date().toISOString();

    if (normAction === "APPROVE") {
      targetRecord.status = "APPROVED";
      targetRecord.decision = "APPROVED";
      targetRecord.decided_at = timestamp;

      // Execute using ONLY original server-side kwargs (client cannot tamper with parameters)
      const originalKwargs = targetRecord.kwargs || {};
      const toolFunc = TOOLS[toolName];
      let execResult: unknown;

      try {
        execResult = await toolFunc(originalKwargs);
        targetRecord.execution_result = execResult;
        targetRecord.success = true;
        targetRecord.error = null;
      } catch (exc: unknown) {
        const errorMsg = exc instanceof Error ? exc.message : String(exc);
        execResult = `Execution failed: ${errorMsg}`;
        targetRecord.execution_result = execResult;
        targetRecord.success = false;
        targetRecord.error = errorMsg;
      }

      // STEP 6: Persist approval decision to PostgreSQL
      await safePersist("ApprovalRepository", "updateDecision", targetRecord.id, () =>
        ApprovalRepository.updateDecision(targetRecord.id, {
          decision: "APPROVED",
          status: "APPROVED",
          decided_at: timestamp,
          decided_by: "operator",
          execution_result: targetRecord.execution_result,
          success: targetRecord.success,
          error: targetRecord.error,
        })
      );

      const auditEvent: AuditEvent = {
        approval_id: targetRecord.id,
        incident_id: targetRecord.incident_id,
        tool_name: toolName,
        operator_decision: "APPROVE",
        timestamp,
        execution_result: targetRecord.execution_result,
        success: targetRecord.success ?? false,
        error: targetRecord.error ?? null,
      };

      // STEP 7: Persist immutable audit event to PostgreSQL
      await safePersist("AuditRepository", "append", targetRecord.id, () =>
        AuditRepository.append({
          approval_id: targetRecord.id,
          incident_id: targetRecord.incident_id,
          timestamp,
          tool_name: toolName,
          operator_decision: "APPROVE",
          operator_id: "operator",
          execution_result: targetRecord.execution_result,
          success: targetRecord.success ?? false,
          error: targetRecord.error ?? null,
        })
      );

      incidentService.logEvent(
        `🛡️ [AUDIT EVENT] Operator APPROVED action '${toolName}' (Approval ID: ${targetRecord.id}). Execution Result: ${String(
          targetRecord.execution_result
        )}`,
        targetRecord.success ? "INFO" : "ERROR"
      );

      incidentService.addAiReasoning(
        `Operator OVERRIDE APPROVED for '${toolName}'. Action executed safely.`,
        `${toolName}(**args)`,
        String(targetRecord.execution_result),
        {
          incident_id: targetRecord.incident_id,
          source: "approval_service",
        }
      );

      emitSentinelEvent("approval.resolved", { targetRecord, audit: auditEvent });

      // Step 2F: Explicit closed-loop recovery verification after approved dangerous remediation
      if (targetRecord.success) {
        const currentIncident = incidentService.getCurrentIncident();
        const targetIncident =
          currentIncident && (!targetRecord.incident_id || currentIncident.id === targetRecord.incident_id)
            ? currentIncident
            : null;

        if (targetIncident) {
          const targetService =
            (originalKwargs.service as string) ||
            (originalKwargs.container_name as string) ||
            "dummy-api";
          const serviceToVerify =
            targetService === "sentinel-db" || targetService === "dummy-api"
              ? targetService
              : "dummy-api";

          void verifyIncidentRecovery(targetIncident, serviceToVerify).catch((err) => {
            incidentService.logEvent(`⚠️ [Post-Approval Verification Error] ${String(err)}`, "ERROR");
          });
        }
      }

      return {
        status: "EXECUTED",
        approval_id: targetRecord.id,
        tool_name: toolName,
        result: targetRecord.execution_result,
        audit: auditEvent,
      };
    } else {
      // REJECT
      targetRecord.status = "REJECTED";
      targetRecord.decision = "REJECTED";
      targetRecord.decided_at = timestamp;
      targetRecord.execution_result = "NOT_EXECUTED";
      targetRecord.success = true;
      targetRecord.error = null;

      // STEP 6: Persist approval decision to PostgreSQL
      await safePersist("ApprovalRepository", "updateDecision", targetRecord.id, () =>
        ApprovalRepository.updateDecision(targetRecord.id, {
          decision: "REJECTED",
          status: "REJECTED",
          decided_at: timestamp,
          decided_by: "operator",
          execution_result: "NOT_EXECUTED",
          success: true,
          error: null,
        })
      );

      const auditEvent: AuditEvent = {
        approval_id: targetRecord.id,
        incident_id: targetRecord.incident_id,
        tool_name: toolName,
        operator_decision: "REJECT",
        timestamp,
        execution_result: "NOT_EXECUTED",
        success: true,
        error: null,
      };

      // STEP 7: Persist immutable audit event to PostgreSQL
      await safePersist("AuditRepository", "append", targetRecord.id, () =>
        AuditRepository.append({
          approval_id: targetRecord.id,
          incident_id: targetRecord.incident_id,
          timestamp,
          tool_name: toolName,
          operator_decision: "REJECT",
          operator_id: "operator",
          execution_result: "NOT_EXECUTED",
          success: true,
          error: null,
        })
      );

      incidentService.logEvent(
        `🛡️ [AUDIT EVENT] Operator REJECTED action '${toolName}' (Approval ID: ${targetRecord.id}). Action NOT executed. System secured.`,
        "WARNING"
      );

      incidentService.addAiReasoning(
        `Operator REJECTED override for '${toolName}'. Dangerous action was NOT executed. System secured.`,
        "guardrail_rejection",
        "BLOCKED (SYSTEM SECURED)",
        {
          incident_id: targetRecord.incident_id,
          source: "approval_service",
        }
      );

      emitSentinelEvent("approval.resolved", { targetRecord, audit: auditEvent });

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
