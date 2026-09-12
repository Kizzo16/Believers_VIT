import process from "node:process";
import { incidentService } from "./incident.service";
import { ObservabilityEvidence, ObservabilityMetrics } from "../types/sentinel";

class ObservabilityService {
  private totalRequests: number = 0;
  private errorCount: number = 0;
  private responseTimes: number[] = [];
  private lastCpuUsage = process.cpuUsage();
  private lastCpuCheck = Date.now();

  recordRequest(statusCode: number, latencyMs: number): void {
    this.totalRequests++;
    if (statusCode === 0 || statusCode >= 500) {
      this.errorCount++;
    }
    this.responseTimes.push(latencyMs);
    if (this.responseTimes.length > 50) {
      this.responseTimes.shift();
    }
  }

  getMetrics(): ObservabilityMetrics {
    const errorRate = this.totalRequests > 0 ? (this.errorCount / this.totalRequests) * 100 : 0;
    const avgLatency =
      this.responseTimes.length > 0
        ? Math.round(this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length)
        : 15;

    // RAM Memory Usage
    const memUsage = process.memoryUsage();
    const memoryMb = Math.round((memUsage.rss / (1024 * 1024)) * 10) / 10;

    // CPU Usage percentage estimate
    const now = Date.now();
    const timeDelta = Math.max(1, now - this.lastCpuCheck);
    const cpuUsageDelta = process.cpuUsage(this.lastCpuUsage);
    this.lastCpuCheck = now;
    this.lastCpuUsage = process.cpuUsage();

    const userSystemTotal = (cpuUsageDelta.user + cpuUsageDelta.system) / 1000; // in ms
    const cpuPct = Math.min(99.9, Math.round(((userSystemTotal / timeDelta) * 100) * 10) / 10);

    return {
      total_requests: this.totalRequests,
      error_count: this.errorCount,
      error_rate_pct: Math.round(errorRate * 10) / 10,
      avg_response_time_ms: avgLatency,
      cpu_usage_pct: Math.max(2.4, cpuPct),
      memory_usage_mb: memoryMb,
    };
  }

  getEvidence(): ObservabilityEvidence {
    const metrics = this.getMetrics();
    const dbStatus = incidentService.getDatabaseStatus();
    const apiStatus = incidentService.getDummyApiStatus();
    const currentIncident = incidentService.getCurrentIncident();

    let serviceState = "NORMAL";
    if (dbStatus === "DOWN" || dbStatus === "UNHEALTHY") {
      serviceState = "DATABASE_FAILURE";
    } else if (apiStatus === "DOWN" || apiStatus === "UNHEALTHY") {
      serviceState = "API_FAILURE";
    } else if (metrics.error_rate_pct > 30) {
      serviceState = "HIGH_ERROR_RATE";
    }

    const recentLogs = incidentService.incidentLogs.toArray().slice(-20);

    return {
      timestamp: new Date().toISOString(),
      service_state: serviceState,
      services: {
        "sentinel-db": {
          status: dbStatus === "UP" ? "HEALTHY" : "UNHEALTHY",
          connection: dbStatus === "UP" ? "connected" : "refused",
        },
        "dummy-api": {
          status: apiStatus === "UP" ? "HEALTHY" : "UNHEALTHY",
          latency_ms: metrics.avg_response_time_ms,
          error_rate: `${metrics.error_rate_pct}%`,
        },
        "sentinel-backend": {
          status: "HEALTHY",
          latency_ms: 5,
        },
      },
      metrics,
      recent_logs: recentLogs,
      active_incident: currentIncident,
    };
  }

  resetMetrics(): void {
    this.totalRequests = 0;
    this.errorCount = 0;
    this.responseTimes = [];
  }
}

export const observabilityService = new ObservabilityService();
