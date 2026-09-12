import { incidentService } from "./incident.service";
import { observabilityService } from "./observability.service";
import { callLlmSreAgent } from "../agent/agent";
import { IncidentData, IncidentSeverity } from "../types/sentinel";
import { logger } from "../utils/logger";

class IncidentDetectorService {
  private incidentCounter: number = 1;

  processEvidenceAndDetect(): IncidentData | null {
    const evidence = observabilityService.getEvidence();
    const activeIncident = incidentService.isActiveIncident();

    // Condition 1: Database Failure
    const dbDown = evidence.services["sentinel-db"].status === "UNHEALTHY";

    // Condition 2: API Failure / Health Ping Failure
    const apiDown = evidence.services["dummy-api"].status === "UNHEALTHY";

    // Condition 3: High Error Rate (> 30%)
    const highErrorRate = evidence.metrics.error_rate_pct > 30;

    const hasAnomaly = dbDown || apiDown || highErrorRate;

    if (!hasAnomaly) {
      return null;
    }

    // If an incident is already active, return the existing incident
    if (activeIncident && incidentService.getCurrentIncident()) {
      return incidentService.getCurrentIncident();
    }

    // Determine Incident Details & Severity
    let severity: IncidentSeverity = "HIGH";
    let errorSummary = "Abnormal system behavior detected";
    const affectedServices: string[] = [];

    if (dbDown) {
      severity = "CRITICAL";
      errorSummary = "Database connection failure (sentinel-db:5432 unreachable)";
      affectedServices.push("sentinel-db", "dummy-api");
    } else if (apiDown) {
      severity = "HIGH";
      errorSummary = "API health check failed (dummy-api returning HTTP 500 errors)";
      affectedServices.push("dummy-api");
    } else if (highErrorRate) {
      severity = "HIGH";
      errorSummary = `Abnormal API error rate detected (${evidence.metrics.error_rate_pct}%)`;
      affectedServices.push("dummy-api");
    }

    const incidentId = `INC-${String(this.incidentCounter++).padStart(3, "0")}`;
    const detectedAt = new Date().toISOString();

    const incidentRecord: IncidentData = {
      id: incidentId,
      detected_at: detectedAt,
      error: errorSummary,
      status: "INVESTIGATING",
      severity,
      affected_services: affectedServices,
      error_rate: `${evidence.metrics.error_rate_pct}%`,
      latency_ms: evidence.metrics.avg_response_time_ms,
    };

    incidentService.setActiveIncident(true);
    incidentService.setSystemHealth(severity === "CRITICAL" ? "INCIDENT_ACTIVE" : "DEGRADED");
    incidentService.setCurrentIncident(incidentRecord);

    incidentService.logEvent(
      `🚨 [Module 3 Incident Engine] Formally Created ${incidentRecord.id} | Severity: ${severity} | Affected: ${affectedServices.join(
        ", "
      )} | Error: ${errorSummary}`,
      "ERROR"
    );

    incidentService.addAiReasoning(
      `Incident Engine triggered: Created formal incident ${incidentRecord.id} (${severity}). Starting autonomous triage.`,
      "detect_incident",
      incidentRecord.id
    );

    // Automatically trigger autonomous AI SRE agent investigation loop
    void callLlmSreAgent(incidentRecord);

    return incidentRecord;
  }
}

export const incidentDetectorService = new IncidentDetectorService();
