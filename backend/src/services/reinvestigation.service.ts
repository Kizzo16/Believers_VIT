import { observabilityService } from "./observability.service";
import { incidentService } from "./incident.service";
import { recoveryPlannerService } from "./recovery-planner.service";
import {
  ReInvestigationReport,
  RecoveryOption,
  VerificationReport,
} from "../types/sentinel";
import { RingBuffer } from "../utils/ring-buffer";
import { logger } from "../utils/logger";
import { emitSentinelEvent } from "../realtime/socket";

class ReInvestigationService {
  private latestReport: ReInvestigationReport | null = null;
  readonly history = new RingBuffer<ReInvestigationReport>(50);
  private attemptCounts: Map<string, number> = new Map();
  private actionHistories: Map<string, string[]> = new Map();
  private readonly MAX_ATTEMPTS = 2;

  public async reinvestigate(
    verificationReport: VerificationReport
  ): Promise<ReInvestigationReport> {
    const reinvestigationId = `REINV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const timestamp = new Date().toISOString();

    const currentIncident = incidentService.getCurrentIncident();
    const incidentId = verificationReport.incident_id || currentIncident?.id || "INC-001";

    // Track attempts and action history per incident
    const currentAttempt = (this.attemptCounts.get(incidentId) || 0) + 1;
    this.attemptCounts.set(incidentId, currentAttempt);

    const historyList = this.actionHistories.get(incidentId) || [];
    if (verificationReport.action_executed && !historyList.includes(verificationReport.action_executed)) {
      historyList.push(verificationReport.action_executed);
    }
    this.actionHistories.set(incidentId, historyList);

    logger.info(
      { incidentId, currentAttempt, previousAction: verificationReport.action_executed },
      "[Module 11 Re-Investigation Engine] Triggered post-verification failure."
    );

    const evidence = observabilityService.getEvidence();
    logger.debug({ serviceState: evidence.service_state }, "[Module 11 Re-Investigation] Telemetry state fetched");

    const dbStatus = incidentService.getDatabaseStatus();
    const apiStatus = incidentService.getDummyApiStatus();

    // 1. Updated Root-Cause Diagnosis
    let updatedRootCause = "";
    let updatedConfidence = 88;

    if (dbStatus === "UP" && apiStatus === "DOWN") {
      updatedRootCause =
        "Database recovery verified; secondary REST API parameter failure or corrupted configuration state detected.";
      updatedConfidence = 91;
    } else if (dbStatus === "DOWN") {
      updatedRootCause =
        "PostgreSQL container failed to stabilize after primary restart attempt. Persistent infrastructure disruption suspected.";
      updatedConfidence = 94;
    } else {
      updatedRootCause =
        "Application service response latency or HTTP error rate remains elevated above baseline limits post-action.";
      updatedConfidence = 85;
    }

    // 2. Evaluate Next Step (Alternative Action vs Rollback vs Escalation)
    let nextStep: ReInvestigationReport["next_step"] = "ALTERNATIVE_ACTION";
    let recommendedOption: RecoveryOption | null = null;
    let escalationReason: string | null = null;

    if (currentAttempt >= this.MAX_ATTEMPTS) {
      nextStep = "ESCALATE_TO_HUMAN";
      escalationReason = `Maximum autonomous recovery attempts (${currentAttempt}/${this.MAX_ATTEMPTS}) reached. Preventing repeated remediation loops.`;
    } else {
      // Fetch fresh candidate options from Module 7 Recovery Strategy Planner
      const recoveryPlan = recoveryPlannerService.generateRecoveryPlan();
      const availableOptions = recoveryPlan.options || [];

      // Filter out already attempted actions
      const unattemptedOptions = availableOptions.filter(
        (opt: RecoveryOption) =>
          !historyList.includes(opt.action_name) &&
          !historyList.includes(opt.tool_name)
      );

      if (unattemptedOptions.length > 0) {
        recommendedOption = unattemptedOptions[0];
        nextStep = (recommendedOption && recommendedOption.tool_name.includes("rollback"))
          ? "ROLLBACK"
          : "ALTERNATIVE_ACTION";
      } else {
        // Fallback default rollback option if no unattempted option found
        if (!historyList.includes("rollback_configuration")) {
          recommendedOption = {
            id: `OPT-ROLLBACK-${Date.now()}`,
            rank: 1,
            action_name: "rollback_configuration(service='dummy-api')",
            tool_name: "rollback_configuration",
            kwargs: { service: "dummy-api" },
            target_service: "dummy-api",
            confidence_pct: 85,
            risk_level: "MEDIUM",
            estimated_time_seconds: 10,
            pros: ["Restores known stable baseline configuration", "Clears corrupted connection state"],
            cons: ["May lose recent uncommitted config changes"],
            tradeoff_summary: "Configuration rollback resolves connection parameters with medium risk.",
          };
          nextStep = "ROLLBACK";
        } else {
          nextStep = "ESCALATE_TO_HUMAN";
          escalationReason = "All permitted autonomous recovery options have been exhausted without successful verification.";
        }
      }
    }


    const adaptiveReasoning: string[] = [];
    adaptiveReasoning.push(
      `[Attempt #${currentAttempt}/${this.MAX_ATTEMPTS}] Previous action '${verificationReport.action_executed}' yielded status ${verificationReport.recovery_status}.`
    );
    adaptiveReasoning.push(`[Adaptive Diagnosis] ${updatedRootCause}`);

    if (nextStep === "ESCALATE_TO_HUMAN") {
      adaptiveReasoning.push(`[Guardrail Policy] Autonomous recovery halted. Reason: ${escalationReason}`);
      adaptiveReasoning.push(`[Action Required] Escalated to Human SRE Operator for manual intervention.`);

      // Update incident state to ESCALATED_HUMAN_REQUIRED
      if (currentIncident) {
        incidentService.setCurrentIncident({
          ...currentIncident,
          status: "ESCALATED_HUMAN_REQUIRED",
        });
      }
      incidentService.setSystemHealth("INCIDENT_ACTIVE");

      // Register High-Priority Human Escalation Approval Ticket
      incidentService.addPendingApproval({
        id: `ESCAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        incident_id: incidentId,
        tool_name: "human_escalation",
        kwargs: {
          incident_id: incidentId,
          attempts: currentAttempt,
          reason: escalationReason,
        },
        risk: "HIGH",
        status: "PENDING",
        requested_at: timestamp,
      });

      incidentService.logEvent(
        `🚨 [Module 11 Escalation] Autonomous recovery attempt limit reached (${currentAttempt}/${this.MAX_ATTEMPTS}). ESCALATED to Human SRE Operator.`,
        "ERROR"
      );
      incidentService.addAiReasoning(
        `Autonomous recovery attempts exhausted (${currentAttempt}/${this.MAX_ATTEMPTS}). Escalating incident #${incidentId} to Human Operator.`,
        "escalate_to_human",
        escalationReason
      );
    } else {
      adaptiveReasoning.push(
        `[Adaptive Plan] Excluded previously attempted actions: [${historyList.join(", ")}].`
      );
      adaptiveReasoning.push(
        `[Next Action Proposed] ${nextStep}: '${recommendedOption?.action_name}' (Confidence: ${recommendedOption?.confidence_pct}%).`
      );

      if (currentIncident) {
        incidentService.setCurrentIncident({
          ...currentIncident,
          status: "RE-INVESTIGATING",
        });
      }

      incidentService.logEvent(
        `🔄 [Module 11 Re-Investigation] Attempt #${currentAttempt} verification ${verificationReport.recovery_status}. Adapted diagnosis. Proposed next action: '${recommendedOption?.action_name}'`
      );
      incidentService.addAiReasoning(
        `Re-investigation completed. Adapted root cause: "${updatedRootCause}". Proposed recovery option: '${recommendedOption?.action_name || "None"}'.`,
        recommendedOption?.tool_name || null,
        recommendedOption ? JSON.stringify(recommendedOption.kwargs) : null
      );

    }

    const report: ReInvestigationReport = {
      reinvestigation_id: reinvestigationId,
      incident_id: incidentId,
      attempt_number: currentAttempt,
      max_attempts: this.MAX_ATTEMPTS,
      previous_action: verificationReport.action_executed,
      verification_status: verificationReport.recovery_status,
      updated_root_cause: updatedRootCause,
      updated_confidence: updatedConfidence,
      attempted_actions_history: historyList,
      next_step: nextStep,
      recommended_option: recommendedOption,
      escalation_reason: escalationReason,
      reinvestigated_at: timestamp,
      adaptive_reasoning: adaptiveReasoning,
    };

    this.latestReport = report;
    this.history.push(report);

    emitSentinelEvent("reinvestigation.report", report);

    return report;
  }

  public getLatestReport(): ReInvestigationReport | null {
    return this.latestReport;
  }

  public getHistory(): ReInvestigationReport[] {
    return this.history.toArray();
  }

  public resetIncident(incidentId: string): void {
    this.attemptCounts.delete(incidentId);
    this.actionHistories.delete(incidentId);
  }

  public clearAll(): void {
    this.attemptCounts.clear();
    this.actionHistories.clear();
    this.latestReport = null;
  }
}


export const reinvestigationService = new ReInvestigationService();
