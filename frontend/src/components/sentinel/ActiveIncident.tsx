import React from "react";
import { SystemStatusResponse } from "@/types/sentinel";
import { EvidencePanel } from "./EvidencePanel";
import {
  ShieldAlert,
  CheckCircle,
  Clock,
  Activity,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

interface ActiveIncidentProps {
  data: SystemStatusResponse | null;
}

export function ActiveIncident({ data }: ActiveIncidentProps) {
  const activeIncident = data?.active_incident || false;
  const currentIncident = data?.current_incident;
  const health = data?.system_health || "HEALTHY";
  const reasoning = data?.ai_reasoning || [];
  const latestThought = reasoning[reasoning.length - 1];

  // Calm Empty State
  if (!activeIncident && health === "HEALTHY") {
    return (
      <section className="bg-[#282830] border border-[#303038] rounded-3xl p-8 sm:p-10 text-center shadow-lg">
        <div className="max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#00D068]/15 border border-[#00D068]/30 text-[#00D068] flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle className="w-6 h-6 text-[#00D068]" />
          </div>
          <h3 className="text-xl font-bold tracking-tight text-[#F5F5F5]">
            No Active Incidents
          </h3>
          <p className="text-sm text-[#A0A0A8] leading-relaxed font-medium">
            Sentinel is continuously monitoring all service endpoints and infrastructure. System telemetry is stable and no remediation is required.
          </p>
          <div className="pt-2 flex items-center justify-center gap-2 text-xs font-mono-tech text-[#707078]">
            <span className="w-2 h-2 rounded-full bg-[#00D068]" />
            <span>Autonomous Baseline Nominal</span>
          </div>
        </div>
      </section>
    );
  }

  // Active Incident Workspace (Visual Focal Point)
  const incidentId = currentIncident?.id || "INC-AUTO-DISRUPT";
  const detectedAt = currentIncident?.detected_at
    ? new Date(currentIncident.detected_at).toLocaleTimeString()
    : "Just now";
  const errorMsg =
    currentIncident?.error ||
    "HTTP 500: Database Connection Refused (TCP 5432 unreachable)";
  const affectedService = "sentinel-db / dummy-api";

  return (
    <section className="bg-[#282830] rounded-3xl p-6 sm:p-8 border border-[#FF5C5C]/50 shadow-[0_20px_50px_-15px_rgba(255,92,92,0.25)] space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#303038]">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#FF5C5C]/15 border border-[#FF5C5C]/30 text-[#FF5C5C] flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#FF5C5C]">
                Active Outage
              </span>
              <span className="text-xs font-mono-tech text-[#F5F5F5] bg-[#181820] px-2 py-0.5 rounded border border-[#303038]">
                {incidentId}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5F5F5] mt-0.5">
              Service Disruption Detected
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[#A0A0A8] bg-[#181820] border border-[#303038] px-3 py-1.5 rounded-xl font-mono-tech">
            <Clock className="w-3.5 h-3.5 text-[#707078]" />
            <span>Detected: {detectedAt}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#FF5C5C] bg-[#FF5C5C]/10 border border-[#FF5C5C]/30 px-3 py-1.5 rounded-xl">
            <Activity className="w-3.5 h-3.5" />
            <span>Remediating</span>
          </div>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Summary & Progress */}
        <div className="space-y-4">
          <div className="bg-[#181820] border border-[#303038] rounded-2xl p-4 space-y-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A0A0A8]">
                Disruption Scope
              </span>
              <p className="text-sm font-medium text-[#F5F5F5] mt-0.5">
                {affectedService}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A0A0A8]">
                Error Telemetry
              </span>
              <p className="text-sm font-medium text-[#FF5C5C] font-mono-tech mt-0.5">
                {errorMsg}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A0A0A8]">
                Autonomous SRE Recommendation
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono-tech bg-[#282830] text-[#F5F5F5] px-2.5 py-1 rounded-lg border border-[#303038]">
                  restart_container(&quot;sentinel-db&quot;)
                </span>
                <span className="text-xs text-[#00D068] font-semibold uppercase tracking-wider bg-[#00D068]/10 border border-[#00D068]/20 px-2 py-0.5 rounded">
                  Auto-Approved (LOW RISK)
                </span>
              </div>
            </div>
          </div>

          {latestThought && (
            <div className="bg-[#00D068]/10 border border-[#00D068]/25 rounded-2xl p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#00D068] mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Live Autonomous Diagnosis</span>
              </div>
              <p className="text-xs text-[#F5F5F5] leading-relaxed">
                {latestThought.thought}
              </p>
            </div>
          )}
        </div>

        {/* Right: Raw Diagnostic Evidence */}
        <EvidencePanel
          errorSnippet={errorMsg}
          rootCause="The primary database container 'sentinel-db' unexpectedly halted, causing dependent client connections from 'dummy-api' to trigger TCP connection refused exceptions."
          affectedService={affectedService}
        />
      </div>
    </section>
  );
}
