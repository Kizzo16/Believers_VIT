import React from "react";
import { SystemStatusResponse } from "@/types/sentinel";
import { MetricCard } from "./MetricCard";
import { StatusBadge } from "./StatusBadge";
import { ShieldAlert, Server, CheckCircle2, Lock, Cpu } from "lucide-react";

interface HeroStatusProps {
  data: SystemStatusResponse | null;
}

export function HeroStatus({ data }: HeroStatusProps) {
  const health = data?.system_health || "HEALTHY";
  const activeIncident = data?.active_incident || false;
  const pendingApprovalsCount = data?.pending_approvals?.filter((p) => p.status === "PENDING").length || 0;

  const totalServices = 2; // dummy-api, sentinel-db
  const healthyServices = [
    data?.dummy_api_status === "UP",
    data?.database_status === "UP",
  ].filter(Boolean).length;

  const statusHeadline = {
    HEALTHY: "System Operational & Resilient",
    DEGRADED: "Service Degradation Detected",
    INCIDENT_ACTIVE: "Active Outage — Autonomous SRE Engaged",
    RECOVERING: "Autonomous Remediation in Progress",
  }[health];

  const statusDescription = {
    HEALTHY: "All telemetry, services, and guardrails operating within nominal baseline parameters.",
    DEGRADED: "Anomalous error responses or container shutdown observed. Safety engine evaluating corrective actions.",
    INCIDENT_ACTIVE: "Critical infrastructure failure detected. Autonomous SRE agent is isolating root cause.",
    RECOVERING: "Targeted container restart executed under policy guardrails. Verifying service restoration.",
  }[health];

  return (
    <section id="overview" className="space-y-6">
      {/* Top Editorial Headline */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-4 pb-2 border-b border-[#303038]">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#00D068] mb-2">
            <Cpu className="w-3.5 h-3.5" />
            <span>Autonomous Site Reliability Engineering</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F5F5F5]">
            Sentinel Command Center
          </h1>
          <p className="text-sm sm:text-base text-[#A0A0A8] mt-1 max-w-2xl">
            Continuous health telemetry, deterministic guardrails, and autonomous infrastructure remediation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge health={health} size="lg" />
        </div>
      </div>

      {/* Main Visual Focal Anchor */}
      <div
        className={`relative overflow-hidden rounded-xl p-6 sm:p-8 border transition-all duration-300 ${
          health === "INCIDENT_ACTIVE"
            ? "bg-[#FF5C5C]/10 border-[#FF5C5C]/35 shadow-[0_16px_40px_-15px_rgba(255,92,92,0.25)]"
            : health === "DEGRADED"
            ? "bg-[#B6FF4A]/10 border-[#B6FF4A]/30 shadow-[0_16px_40px_-15px_rgba(182,255,74,0.15)]"
            : health === "RECOVERING"
            ? "bg-[#58DC9C]/10 border-[#58DC9C]/30 shadow-[0_16px_40px_-15px_rgba(88,220,156,0.15)]"
            : "surface-card hero-glow-bg border-[#303038]"
        }`}
      >
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#A0A0A8]">
                Primary Control Plane State
              </span>
              {activeIncident && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FF5C5C]/20 text-[#FF5C5C] border border-[#FF5C5C]/30 px-2 py-0.5 rounded-full animate-pulse">
                  Action Required
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F5]">
              {statusHeadline}
            </h2>
            <p className="text-sm text-[#A0A0A8] max-w-2xl leading-relaxed">
              {statusDescription}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-[#181820] border border-[#303038] px-4 py-3 rounded-xl">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-[#707078]">
                Health Check Interval
              </span>
              <span className="text-sm font-semibold text-[#F5F5F5] font-mono-tech">
                ~3.0s Polling Cycle
              </span>
            </div>
            <div className="bg-[#181820] border border-[#303038] px-4 py-3 rounded-xl">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-[#707078]">
                Last Telemetry Ping
              </span>
              <span className="text-sm font-semibold text-[#F5F5F5] font-mono-tech">
                {data?.last_ping_time
                  ? new Date(data.last_ping_time).toLocaleTimeString()
                  : "Syncing..."}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Supporting Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Services Monitored"
          value={`${healthyServices} / ${totalServices}`}
          subtext={healthyServices === totalServices ? "All nodes reachable" : "Degraded connectivity"}
          trend={healthyServices === totalServices ? "positive" : "danger"}
          icon={<Server className="w-5 h-5 text-[#707078]" />}
        />
        <MetricCard
          label="Active Incidents"
          value={activeIncident ? "1 Active" : "0 Clean"}
          subtext={activeIncident ? "Remediation loop engaged" : "Zero open disruptions"}
          trend={activeIncident ? "danger" : "positive"}
          icon={<ShieldAlert className="w-5 h-5 text-[#707078]" />}
        />
        <MetricCard
          label="Guardrail Policies"
          value="Enforced"
          subtext="Deterministic Zod validation"
          trend="positive"
          icon={<Lock className="w-5 h-5 text-[#707078]" />}
        />
        <MetricCard
          label="Pending Approvals"
          value={pendingApprovalsCount}
          subtext={pendingApprovalsCount > 0 ? "Operator review required" : "Autonomous queue clear"}
          trend={pendingApprovalsCount > 0 ? "warning" : "neutral"}
          icon={<CheckCircle2 className="w-5 h-5 text-[#707078]" />}
        />
      </div>
    </section>
  );
}
