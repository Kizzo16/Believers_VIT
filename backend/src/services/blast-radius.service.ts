import { topologyService, CONTROLLED_SERVICE_GRAPH } from "./topology.service";
import { incidentService } from "./incident.service";
import { aiInvestigationService } from "./ai-investigation.service";
import { BlastRadiusAnalysis, ServiceImpactDetail } from "../types/sentinel";
import { logger } from "../utils/logger";
import { emitSentinelEvent } from "../realtime/socket";

class BlastRadiusService {
  public analyzeBlastRadius(): BlastRadiusAnalysis {
    const activeIncident = incidentService.getCurrentIncident();
    const latestInvestigation = aiInvestigationService.getLatestResult();
    const topology = topologyService.getTopologyWithHealth();

    let rootCauseServiceId = topology.analysis.root_cause_service;

    // Fallback or infer from active incident / investigation
    if (!rootCauseServiceId && activeIncident) {
      if (activeIncident.affected_services?.includes("sentinel-db")) {
        rootCauseServiceId = "sentinel-db";
      } else if (activeIncident.affected_services?.includes("dummy-api")) {
        rootCauseServiceId = "dummy-api";
      }
    }

    if (!rootCauseServiceId && latestInvestigation) {
      if (latestInvestigation.root_cause.includes("sentinel-db") || latestInvestigation.root_cause.includes("PostgreSQL")) {
        rootCauseServiceId = "sentinel-db";
      } else if (latestInvestigation.root_cause.includes("dummy-api")) {
        rootCauseServiceId = "dummy-api";
      }
    }

    const isIncidentActive = incidentService.isActiveIncident() || Boolean(rootCauseServiceId);

    if (!isIncidentActive || !rootCauseServiceId) {
      const healthyAnalysis: BlastRadiusAnalysis = {
        incident_id: activeIncident?.id || null,
        root_cause: "None (System Operational)",
        affected_services_count: 0,
        customer_impact: "NONE",
        critical_path_affected: false,
        blast_radius_level: "NONE",
        directly_affected_services: [],
        indirectly_affected_services: [],
        service_impacts: Object.values(CONTROLLED_SERVICE_GRAPH).map((s) => ({
          id: s.id,
          name: s.name,
          is_direct: false,
          is_customer_facing: s.is_customer_facing,
          is_critical: s.is_critical,
          status: "OPERATIONAL",
          impact_description: "Operating normally. No dependency disruption.",
        })),
        reasoning: ["System health normal. All dependency graph nodes operating without propagated failure."],
        analyzed_at: new Date().toISOString(),
      };
      return healthyAnalysis;
    }

    const directService = CONTROLLED_SERVICE_GRAPH[rootCauseServiceId];
    const directlyAffected = [rootCauseServiceId];

    // Traverse downstream graph for indirectly affected services
    const downstreamNodes = topologyService.getDownstreamImpact(rootCauseServiceId);
    const indirectlyAffected = downstreamNodes
      .map((node) => node.id)
      .filter((id) => !directlyAffected.includes(id));

    const allAffectedIds = Array.from(new Set([...directlyAffected, ...indirectlyAffected]));
    const affectedCount = allAffectedIds.length;

    // Determine customer impact
    const customerFacingAffected = allAffectedIds
      .map((id) => CONTROLLED_SERVICE_GRAPH[id])
      .filter((node) => node && node.is_customer_facing);

    let customerImpact: BlastRadiusAnalysis["customer_impact"] = "NONE";
    if (customerFacingAffected.length >= 2) {
      customerImpact = "HIGH";
    } else if (customerFacingAffected.length === 1) {
      customerImpact = "MEDIUM";
    } else if (affectedCount > 0) {
      customerImpact = "LOW";
    }

    // Determine critical path impact
    const criticalNodesAffected = allAffectedIds
      .map((id) => CONTROLLED_SERVICE_GRAPH[id])
      .filter((node) => node && node.is_critical);

    const criticalPathAffected = criticalNodesAffected.length > 0;

    // Assign overall blast-radius level
    let blastRadiusLevel: BlastRadiusAnalysis["blast_radius_level"] = "LOW";
    if (affectedCount >= 3 && criticalPathAffected && customerImpact === "HIGH") {
      blastRadiusLevel = "HIGH";
    } else if (affectedCount >= 3) {
      blastRadiusLevel = "HIGH";
    } else if (affectedCount === 2) {
      blastRadiusLevel = "MEDIUM";
    } else if (affectedCount === 1) {
      blastRadiusLevel = "LOW";
    }

    // Compile individual service impact details
    const serviceImpacts: ServiceImpactDetail[] = Object.values(CONTROLLED_SERVICE_GRAPH).map((service) => {
      const isDirect = directlyAffected.includes(service.id);
      const isIndirect = indirectlyAffected.includes(service.id);
      const isAffected = isDirect || isIndirect;

      let status = "OPERATIONAL";
      if (isDirect) status = "ROOT_FAILURE";
      else if (isIndirect) status = "PROPAGATED_OUTAGE";

      let description = "Operating normally. No dependency disruption.";
      if (isDirect) {
        description = `Direct failure node: Root cause originating from ${service.name}.`;
      } else if (isIndirect) {
        description = `Indirect failure: Cascading downstream dependency failure from ${directService?.name || rootCauseServiceId}.`;
      }

      return {
        id: service.id,
        name: service.name,
        is_direct: isDirect,
        is_customer_facing: service.is_customer_facing,
        is_critical: service.is_critical,
        status: isAffected ? status : "OPERATIONAL",
        impact_description: description,
      };
    });

    // Expose structured reasoning chain
    const reasoning: string[] = [
      `Directly affected service identified: ${directService?.name || rootCauseServiceId} (${rootCauseServiceId}).`,
      `Traversed dependency graph downstreams and identified ${indirectlyAffected.length} indirectly affected service(s): ${indirectlyAffected.map((id) => CONTROLLED_SERVICE_GRAPH[id]?.name || id).join(", ") || "None"}.`,
      `Total affected components counted: ${affectedCount} service(s).`,
      `Customer-facing impact evaluated as ${customerImpact} (${customerFacingAffected.length} customer-accessible service(s) impacted: ${customerFacingAffected.map((s) => s.name).join(", ")}).`,
      `Critical business path affected: ${criticalPathAffected ? "YES" : "NO"} (${criticalNodesAffected.length} mission-critical component(s) impacted).`,
      `Assigned overall Blast Radius Level: ${blastRadiusLevel}.`,
    ];

    const analysisResult: BlastRadiusAnalysis = {
      incident_id: activeIncident?.id || latestInvestigation?.incident_id || null,
      root_cause: latestInvestigation?.root_cause || `${directService?.name || rootCauseServiceId} Failure`,
      affected_services_count: affectedCount,
      customer_impact: customerImpact,
      critical_path_affected: criticalPathAffected,
      blast_radius_level: blastRadiusLevel,
      directly_affected_services: directlyAffected,
      indirectly_affected_services: indirectlyAffected,
      service_impacts: serviceImpacts,
      reasoning: reasoning,
      analyzed_at: new Date().toISOString(),
    };

    logger.info({ analysisResult }, "Blast radius analysis computed");
    emitSentinelEvent("impact.blast_radius_calculated", analysisResult);

    return analysisResult;
  }

  public getLatestAnalysis(): BlastRadiusAnalysis {
    return this.analyzeBlastRadius();
  }
}

export const blastRadiusService = new BlastRadiusService();
