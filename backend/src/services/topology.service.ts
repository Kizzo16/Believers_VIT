import { incidentService } from "./incident.service";
import { ServiceStatus } from "../types/sentinel";

export interface ServiceNodeMeta {
  id: string;
  name: string;
  type: "frontend" | "api" | "database" | "cache" | "external";
  is_customer_facing: boolean;
  is_critical: boolean;
  technology: string;
  port?: number;
  depends_on: string[]; // Service IDs that this service requires
}

export interface ServiceTopologyNode extends ServiceNodeMeta {
  status: ServiceStatus;
  classification: "HEALTHY" | "ROOT_FAILURE" | "DOWNSTREAM_SYMPTOM" | "DEGRADED";
}

export const CONTROLLED_SERVICE_GRAPH: Record<string, ServiceNodeMeta> = {
  "sentinel-frontend": {
    id: "sentinel-frontend",
    name: "Sentinel Dashboard Frontend",
    type: "frontend",
    is_customer_facing: true,
    is_critical: true,
    technology: "Next.js 15 / React",
    port: 3000,
    depends_on: ["dummy-api"],
  },
  "dummy-api": {
    id: "dummy-api",
    name: "Orders & Demo REST API",
    type: "api",
    is_customer_facing: true,
    is_critical: true,
    technology: "FastAPI / Python",
    port: 8001,
    depends_on: ["sentinel-db", "redis-cache", "payment-gateway"],
  },
  "sentinel-db": {
    id: "sentinel-db",
    name: "PostgreSQL Production DB",
    type: "database",
    is_customer_facing: false,
    is_critical: true,
    technology: "PostgreSQL 16 Alpine",
    port: 5432,
    depends_on: [],
  },
  "redis-cache": {
    id: "redis-cache",
    name: "Redis Session Cache",
    type: "cache",
    is_customer_facing: false,
    is_critical: false,
    technology: "Redis 7 Alpine",
    port: 6379,
    depends_on: [],
  },
  "payment-gateway": {
    id: "payment-gateway",
    name: "Payment API Gateway",
    type: "external",
    is_customer_facing: false,
    is_critical: false,
    technology: "External REST",
    port: 443,
    depends_on: [],
  },
};

class TopologyService {
  getService(id: string): ServiceNodeMeta | undefined {
    return CONTROLLED_SERVICE_GRAPH[id];
  }

  getAllServices(): ServiceNodeMeta[] {
    return Object.values(CONTROLLED_SERVICE_GRAPH);
  }

  // Query Upstream Dependencies (What does serviceId depend on?)
  getUpstreamDependencies(serviceId: string): ServiceNodeMeta[] {
    const target = CONTROLLED_SERVICE_GRAPH[serviceId];
    if (!target) return [];
    return target.depends_on
      .map((depId) => CONTROLLED_SERVICE_GRAPH[depId])
      .filter((s): s is ServiceNodeMeta => s !== undefined);
  }

  // Query Downstream Impact (What depends on serviceId?)
  getDownstreamImpact(serviceId: string): ServiceNodeMeta[] {
    const impacted: ServiceNodeMeta[] = [];
    const queue = [serviceId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      for (const service of Object.values(CONTROLLED_SERVICE_GRAPH)) {
        if (service.depends_on.includes(currentId) && !visited.has(service.id)) {
          impacted.push(service);
          queue.push(service.id);
        }
      }
    }

    return impacted;
  }

  // Root Cause vs Downstream Symptom Isolation Algorithm
  distinguishRootVsSymptoms(failedServiceIds: string[]): {
    root_cause_service: string | null;
    downstream_symptoms: string[];
  } {
    if (failedServiceIds.length === 0) {
      return { root_cause_service: null, downstream_symptoms: [] };
    }

    if (failedServiceIds.length === 1) {
      return { root_cause_service: failedServiceIds[0], downstream_symptoms: [] };
    }

    // A service is a root cause if none of the other failed services are its upstream dependencies
    let rootCause: string | null = null;
    const symptoms: string[] = [];

    for (const id of failedServiceIds) {
      const upstream = this.getUpstreamDependencies(id).map((s) => s.id);
      const hasFailedUpstream = upstream.some((uId) => failedServiceIds.includes(uId));

      if (hasFailedUpstream) {
        symptoms.push(id);
      } else if (!rootCause) {
        rootCause = id;
      } else {
        symptoms.push(id);
      }
    }

    return { root_cause_service: rootCause || failedServiceIds[0], downstream_symptoms: symptoms };
  }

  // Merges Dependency Map with Live Telemetry Health
  getTopologyWithHealth(): {
    graph: Record<string, ServiceTopologyNode>;
    analysis: { root_cause: string | null; downstream_symptoms: string[] };
  } {
    const dbStatus = incidentService.getDatabaseStatus();
    const apiStatus = incidentService.getDummyApiStatus();

    const failedIds: string[] = [];
    if (dbStatus === "DOWN" || dbStatus === "UNHEALTHY") failedIds.push("sentinel-db");
    if (apiStatus === "DOWN" || apiStatus === "UNHEALTHY") failedIds.push("dummy-api");

    const analysis = this.distinguishRootVsSymptoms(failedIds);

    const graph: Record<string, ServiceTopologyNode> = {};

    for (const [id, meta] of Object.entries(CONTROLLED_SERVICE_GRAPH)) {
      let liveStatus: ServiceStatus = "UP";
      if (id === "sentinel-db") liveStatus = dbStatus;
      if (id === "dummy-api") liveStatus = apiStatus;
      if (id === "sentinel-frontend") liveStatus = apiStatus === "UP" ? "UP" : "DEGRADED";

      let classification: ServiceTopologyNode["classification"] = "HEALTHY";
      if (id === analysis.root_cause_service) {
        classification = "ROOT_FAILURE";
      } else if (analysis.downstream_symptoms.includes(id)) {
        classification = "DOWNSTREAM_SYMPTOM";
      } else if (liveStatus !== "UP" && liveStatus !== "HEALTHY") {
        classification = "DEGRADED";
      }

      graph[id] = {
        ...meta,
        status: liveStatus,
        classification,
      };
    }

    return { graph, analysis };
  }
}

export const topologyService = new TopologyService();
