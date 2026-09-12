import { executeToolWithGuardrail } from "../safety/policy-engine";
import { incidentService } from "./incident.service";
import { recoveryVerificationService } from "./recovery-verification.service";
import { ExecutionReceipt } from "../types/sentinel";
import { RingBuffer } from "../utils/ring-buffer";
import { logger } from "../utils/logger";
import { emitSentinelEvent } from "../realtime/socket";

class ActionExecutorService {
  private latestReceipt: ExecutionReceipt | null = null;
  readonly executionHistory = new RingBuffer<ExecutionReceipt>(50);

  public async executeAction(
    toolName: string,
    kwargs: Record<string, unknown> = {}
  ): Promise<ExecutionReceipt> {
    const executionId = `EXEC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const timestamp = new Date().toISOString();

    logger.info({ toolName, kwargs }, `[Module 9 Action Executor] Dispatched tool '${toolName}'`);

    // Pass action through Module 8 Guardrail Policy Check
    const result = await executeToolWithGuardrail(toolName, null, kwargs);

    let policyDecision: ExecutionReceipt["policy_decision"] = "ALLOW";
    let executionStatus: ExecutionReceipt["execution_status"] = "SUCCESS";
    let executionResultStr = "";
    let stateChanged = false;

    if (result.status === "ERROR") {
      policyDecision = "BLOCKED";
      executionStatus = "BLOCKED";
      executionResultStr = result.message || "Action BLOCKED by Sentinel Policy Engine";
      stateChanged = false;

      incidentService.logEvent(
        `⛔ [Module 9 Executor] Action '${toolName}' execution BLOCKED: ${executionResultStr}`,
        "ERROR"
      );
    } else if (result.status === "Requires Human Approval") {
      policyDecision = "HUMAN_APPROVAL_REQUIRED";
      executionStatus = "PENDING_APPROVAL";
      executionResultStr = `Action '${toolName}' intercepted by Policy Engine. Queued for human operator approval (Approval ID: ${result.approval_id || "N/A"}).`;
      stateChanged = false;

      incidentService.logEvent(
        `🛡️ [Module 9 Executor] Action '${toolName}' intercepted. Gated pending human operator sign-off.`,
        "WARNING"
      );
    } else if (result.status === "SUCCESS") {
      policyDecision = "ALLOW";
      executionStatus = "SUCCESS";
      executionResultStr = typeof result.result === "string" ? result.result : JSON.stringify(result.result);
      stateChanged = true;

      // Update incident status to RECOVERING (not RESOLVED yet, pending Module 10 verification)
      const currentIncident = incidentService.getCurrentIncident();
      if (currentIncident && currentIncident.status !== "RESOLVED") {
        incidentService.setCurrentIncident({
          ...currentIncident,
          status: "RECOVERING",
        });
      }

      incidentService.logEvent(
        `⚡ [Module 9 Executor SUCCESS] Action '${toolName}' executed successfully. Transitioned incident to RECOVERING state pending Module 10 Verification.`
      );
    } else {
      executionStatus = "FAILED";
      executionResultStr = `Unexpected tool response status: ${result.status}`;
      stateChanged = false;
    }

    const receipt: ExecutionReceipt = {
      execution_id: executionId,
      action_name: `${toolName}(${JSON.stringify(kwargs)})`,
      tool_name: toolName,
      kwargs,
      policy_decision: policyDecision,
      effective_risk: result.risk || "LOW",
      execution_status: executionStatus,
      execution_result: executionResultStr,
      state_changed: stateChanged,
      executed_at: timestamp,
    };

    this.latestReceipt = receipt;
    this.executionHistory.push(receipt);

    emitSentinelEvent("executor.receipt", receipt);

    // If action succeeded, trigger Module 10 Recovery Verification Engine
    if (executionStatus === "SUCCESS") {
      try {
        await recoveryVerificationService.verifyRecovery(null, receipt);
      } catch (err) {
        logger.error({ err }, "[Module 10 Recovery Verification Error]");
      }
    }

    return receipt;
  }


  public getLatestReceipt(): ExecutionReceipt | null {
    return this.latestReceipt;
  }

  public getExecutionHistory(): ExecutionReceipt[] {
    return this.executionHistory.toArray();
  }
}

export const actionExecutorService = new ActionExecutorService();
