import { incidentService } from "./incident.service";
import { aiInvestigationService } from "./ai-investigation.service";
import { blastRadiusService } from "./blast-radius.service";
import { RecoveryOption, RecoveryStrategyPlan } from "../types/sentinel";
import { logger } from "../utils/logger";
import { emitSentinelEvent } from "../realtime/socket";

class RecoveryPlannerService {
  private lastPlan: RecoveryStrategyPlan | null = null;

  public generateRecoveryPlan(): RecoveryStrategyPlan {
    const activeIncident = incidentService.getCurrentIncident();
    const investigation = aiInvestigationService.getLatestResult();
    const blastRadius = blastRadiusService.getLatestAnalysis();

    const isSystemHealthy =
      !incidentService.isActiveIncident() &&
      (!investigation || investigation.root_cause.includes("None")) &&
      blastRadius.blast_radius_level === "NONE";

    if (isSystemHealthy) {
      const healthyPlan: RecoveryStrategyPlan = {
        incident_id: null,
        root_cause: "None (System Nominal)",
        blast_radius_level: "NONE",
        options: [],
        recommended_option: null,
        selection_reasoning: [
          "System health baseline is nominal.",
          "All dependency graph nodes operating without disruption. No recovery strategy required.",
        ],
        generated_at: new Date().toISOString(),
      };
      this.lastPlan = healthyPlan;
      return healthyPlan;
    }

    const rootCauseText = investigation?.root_cause || activeIncident?.error || "Database Failure";
    const incidentId = activeIncident?.id || investigation?.incident_id || "INC-001";
    const blastLevel = blastRadius.blast_radius_level || "HIGH";

    const options: RecoveryOption[] = [];

    if (rootCauseText.toLowerCase().includes("database") || rootCauseText.toLowerCase().includes("sentinel-db")) {
      options.push({
        id: "opt-1",
        rank: 1,
        action_name: "Restart PostgreSQL Database Service",
        tool_name: "restart_service",
        kwargs: { service: "sentinel-db" },
        target_service: "sentinel-db",
        confidence_pct: 92,
        risk_level: "MEDIUM",
        estimated_time_seconds: 5,
        pros: [
          "Directly restarts halted container process daemon",
          "Restores TCP socket 5432 listener instantly",
          "Minimal state disruption & preserves data volume",
        ],
        cons: [
          "Briefly terminates active client connection pool during container restart",
        ],
        tradeoff_summary: "High confidence direct fix with controlled low-impact process restart.",
      });

      options.push({
        id: "opt-2",
        rank: 2,
        action_name: "Rollback API Configuration Parameters",
        tool_name: "rollback_configuration",
        kwargs: { service: "dummy-api" },
        target_service: "dummy-api",
        confidence_pct: 85,
        risk_level: "HIGH",
        estimated_time_seconds: 15,
        pros: [
          "Re-initializes database connection parameters in application memory",
        ],
        cons: [
          "Does not directly start a stopped PostgreSQL container process",
          "Triggers secondary application downtime during configuration reload",
        ],
        tradeoff_summary: "Secondary fix if failure stems from invalid config, but ineffective for process crashes.",
      });

      options.push({
        id: "opt-3",
        rank: 3,
        action_name: "Failover to Database Replica Node",
        tool_name: "failover_to_replica",
        kwargs: { service: "sentinel-db", replica_id: "db-replica-01" },
        target_service: "sentinel-db",
        confidence_pct: 75,
        risk_level: "HIGH",
        estimated_time_seconds: 30,
        pros: [
          "Provides complete storage hardware isolation",
        ],
        cons: [
          "High operational complexity and state synchronization lag",
          "Requires DNS rerouting and replica promotion window",
        ],
        tradeoff_summary: "Heavyweight failover strategy reserved for persistent disk failures.",
      });
    } else {
      // Default / API Outage Strategy Options
      options.push({
        id: "opt-1",
        rank: 1,
        action_name: "Restart Orders REST API Process",
        tool_name: "restart_service",
        kwargs: { service: "dummy-api" },
        target_service: "dummy-api",
        confidence_pct: 90,
        risk_level: "LOW",
        estimated_time_seconds: 3,
        pros: [
          "Instantly clears unhandled memory exceptions and socket hangs",
          "Zero impact on underlying PostgreSQL persistence layer",
        ],
        cons: [
          "Brief 2-second HTTP gateway unavailability",
        ],
        tradeoff_summary: "Fast low-risk option to resolve application process hangs.",
      });

      options.push({
        id: "opt-2",
        rank: 2,
        action_name: "Rollback Application Deployment Revision",
        tool_name: "rollback_configuration",
        kwargs: { service: "dummy-api" },
        target_service: "dummy-api",
        confidence_pct: 82,
        risk_level: "MEDIUM",
        estimated_time_seconds: 12,
        pros: [
          "Restores previously known stable code revision artifact",
        ],
        cons: [
          "Reverts recently deployed features and hotfixes",
        ],
        tradeoff_summary: "Effective if disruption was caused by bad code deployment rollout.",
      });
    }

    const recommendedOption = options[0] || null;

    const selectionReasoning: string[] = [
      `Selected Option 1 (${recommendedOption?.action_name}) as the recommended strategy over alternatives.`,
      `Recovery Confidence: Option 1 yields ${recommendedOption?.confidence_pct}% recovery confidence compared to ${options[1]?.confidence_pct ?? 0}% for Option 2.`,
      `Technical Risk Assessment: Option 1 incurs ${recommendedOption?.risk_level} technical risk vs. ${options[1]?.risk_level ?? "HIGH"} risk for Option 2.`,
      `Blast Radius Fit: Option 1 directly targets the root failure node (${recommendedOption?.target_service}) to contain the ${blastLevel} blast radius propagation.`,
      `Execution Speed: Estimated recovery SLA is ${recommendedOption?.estimated_time_seconds} seconds vs ${options[1]?.estimated_time_seconds ?? 15} seconds for Option 2.`,
    ];

    const planResult: RecoveryStrategyPlan = {
      incident_id: incidentId,
      root_cause: rootCauseText,
      blast_radius_level: blastLevel,
      options,
      recommended_option: recommendedOption,
      selection_reasoning: selectionReasoning,
      generated_at: new Date().toISOString(),
    };

    this.lastPlan = planResult;
    logger.info({ planResult }, "Recovery strategy plan generated");
    emitSentinelEvent("recovery.plan_generated", planResult);

    return planResult;
  }

  public getLatestPlan(): RecoveryStrategyPlan {
    return this.generateRecoveryPlan();
  }
}

export const recoveryPlannerService = new RecoveryPlannerService();
