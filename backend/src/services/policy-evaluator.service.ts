import { loadPolicies } from "../config/policies";
import { blastRadiusService } from "./blast-radius.service";
import { recoveryPlannerService } from "./recovery-planner.service";
import { PolicyDecision } from "../types/sentinel";
import { logger } from "../utils/logger";
import { emitSentinelEvent } from "../realtime/socket";

class PolicyEvaluatorService {
  private lastDecision: PolicyDecision | null = null;

  public evaluateAction(
    toolName: string,
    kwargs: Record<string, unknown> = {}
  ): PolicyDecision {
    const policies = loadPolicies();
    const policyRule = policies[toolName] || { risk: "HIGH", auto_execute: false };

    const baseRisk = (policyRule.risk?.toUpperCase() as PolicyDecision["base_risk"]) || "HIGH";
    const autoExecute = Boolean(policyRule.auto_execute);

    const blastRadius = blastRadiusService.getLatestAnalysis();
    const recoveryPlan = recoveryPlannerService.getLatestPlan();

    const blastLevel = blastRadius.blast_radius_level || "NONE";
    const isCriticalPath = blastRadius.critical_path_affected;
    const recoveryConfidence = recoveryPlan.recommended_option?.confidence_pct ?? 90;

    let effectiveRisk: PolicyDecision["effective_risk"] = baseRisk;
    let decision: PolicyDecision["decision"] = "HUMAN_APPROVAL_REQUIRED";
    let riskEscalated = false;
    const reasoning: string[] = [];

    // Rule 1: Block Destructive / Critical Actions
    if (baseRisk === "CRITICAL" || toolName === "delete_database" || toolName === "drop_tables") {
      effectiveRisk = "CRITICAL";
      decision = "BLOCKED";
      reasoning.push(
        `[CRITICAL POLICY BLOCK] Action '${toolName}' is classified as CRITICAL / DESTRUCTIVE.`,
        "Safety Mandate: Destructive actions cannot be auto-executed or approved via agent loop.",
        "System Authority Verdict: Action permanently BLOCKED. System secured."
      );
    } else {
      // Rule 2: Contextual Risk Escalation
      if (
        (baseRisk === "LOW" || baseRisk === "MEDIUM") &&
        (blastLevel === "CRITICAL" || (isCriticalPath && blastLevel === "HIGH" && recoveryConfidence < 80))
      ) {
        effectiveRisk = "HIGH";
        riskEscalated = true;
        decision = "HUMAN_APPROVAL_REQUIRED";
        reasoning.push(
          `[RISK ESCALATION] Base tool risk for '${toolName}' is ${baseRisk}, but contextual blast radius is ${blastLevel}.`,
          `Mission-critical path affected (${isCriticalPath ? "YES" : "NO"}) with recovery confidence ${recoveryConfidence}%.`,
          `Policy Escalation: Effective risk elevated to HIGH. Requires human operator sign-off.`
        );
      } else if (baseRisk === "LOW" && autoExecute) {
        effectiveRisk = "LOW";
        decision = "AUTO_EXECUTE";
        reasoning.push(
          `[POLICY ALLOW] Action '${toolName}' evaluated as LOW RISK with auto_execute = true.`,
          `Contextual Check: Blast Radius = ${blastLevel}, Recovery Confidence = ${recoveryConfidence}%.`,
          `Policy Decision: LOW RISK → AUTO EXECUTE. Action authorized for immediate execution.`
        );
      } else {
        effectiveRisk = baseRisk;
        decision = "HUMAN_APPROVAL_REQUIRED";
        reasoning.push(
          `[APPROVAL GATE] Action '${toolName}' evaluated with effective risk ${effectiveRisk} (auto_execute = ${autoExecute}).`,
          `Contextual Check: Blast Radius = ${blastLevel}, Critical Business Path = ${isCriticalPath ? "YES" : "NO"}.`,
          `Policy Decision: ${effectiveRisk} RISK → HUMAN APPROVAL. Action queued for human operator verification.`
        );
      }
    }

    const result: PolicyDecision = {
      tool_name: toolName,
      kwargs,
      base_risk: baseRisk,
      effective_risk: effectiveRisk,
      decision,
      auto_execute: autoExecute,
      contextual_factors: {
        blast_radius_level: blastLevel,
        is_critical_path: isCriticalPath,
        recovery_confidence: recoveryConfidence,
        risk_escalated: riskEscalated,
      },
      policy_reasoning: reasoning,
      evaluated_at: new Date().toISOString(),
    };

    this.lastDecision = result;
    logger.info({ result }, "Policy decision evaluated");
    emitSentinelEvent("policy.evaluated", result);

    return result;
  }

  public getLatestDecision(): PolicyDecision {
    if (!this.lastDecision) {
      return this.evaluateAction("restart_service", { service: "sentinel-db" });
    }
    return this.lastDecision;
  }
}

export const policyEvaluatorService = new PolicyEvaluatorService();
