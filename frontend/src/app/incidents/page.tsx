"use client";

import React from "react";
import { useSentinel } from "@/context/SentinelContext";
import { ActiveIncident } from "@/components/sentinel/ActiveIncident";
import { EvidencePanel } from "@/components/sentinel/EvidencePanel";
import { BlastRadiusPanel } from "@/components/sentinel/BlastRadiusPanel";
import { RecoveryPlannerPanel } from "@/components/sentinel/RecoveryPlannerPanel";
import { ControlledExecutorPanel } from "@/components/sentinel/ControlledExecutorPanel";
import { ShieldAlert, Activity, CheckCircle, Clock } from "lucide-react";

export default function IncidentsPage() {
  const { data } = useSentinel();
  const activeIncident = data?.active_incident || false;
  const currentIncident = data?.current_incident;
  const logs = data?.incident_logs || [];

  // Filter logs relevant to incidents or errors
  const incidentLogs = logs
    .filter((l) => l.level === "ERROR" || l.level === "WARNING" || l.message.includes("Incident"))
    .slice(-6)
    .reverse();

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#303038]">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#00D068] mb-1">
            <Activity className="w-3.5 h-3.5" />
            <span>Incident Command & Telemetry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F5]">
            Incident Workspace
          </h1>
          <p className="text-xs sm:text-sm text-[#A0A0A8] mt-1">
            Real-time disruption isolation, diagnostic evidence extraction, and autonomous remediation tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full border ${
              activeIncident
                ? "bg-[#FF5C5C]/15 text-[#FF5C5C] border-[#FF5C5C]/35 animate-pulse"
                : "bg-[#00D068]/10 text-[#00D068] border-[#00D068]/25"
            }`}
          >
            {activeIncident ? "Outage Active" : "All Systems Nominal"}
          </span>
        </div>
      </div>

      {/* Primary Incident Focus Workspace */}
      <ActiveIncident data={data} />

      {/* Module 6: Impact / Blast-Radius Analysis Panel */}
      <BlastRadiusPanel />

      {/* Module 7: Recovery Strategy Planner Panel */}
      <RecoveryPlannerPanel />

      {/* Module 9: Controlled Action Executor Panel */}
      <ControlledExecutorPanel />

      {/* Incident Evidence & Diagnostic History (When Outage Active) */}
      {activeIncident && (
        <div className="bg-[#282830] rounded-3xl p-6 border border-[#303038] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#303038]">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#FF5C5C]" />
              <h3 className="text-base font-semibold text-[#F5F5F5]">
                Active Outage Diagnostic Evidence
              </h3>
            </div>
            <span className="text-xs font-mono-tech text-[#707078]">
              Source: sentinel-db / dummy-api
            </span>
          </div>

          <EvidencePanel
            errorSnippet={currentIncident?.error}
            rootCause="The primary database container 'sentinel-db' halted unexpectedly. Dependent client connections from 'dummy-api' triggered TCP connection refused exceptions."
            affectedService="sentinel-db / dummy-api"
          />
        </div>
      )}

      {/* Recent Incident Telemetry Stream */}
      <div className="bg-[#282830] rounded-3xl p-6 border border-[#303038] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#303038]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#00D068]" />
            <h3 className="text-base font-semibold text-[#F5F5F5]">
              Recent Incident Log Events
            </h3>
          </div>
          <span className="text-xs text-[#A0A0A8]">
            {incidentLogs.length} anomalies captured
          </span>
        </div>

        {incidentLogs.length === 0 ? (
          <div className="p-8 text-center text-[#707078] text-xs italic">
            No incident anomalies logged in the current buffer.
          </div>
        ) : (
          <div className="space-y-2">
            {incidentLogs.map((log, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between p-3 rounded-xl bg-[#181820] border border-[#303038] text-xs gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                      log.level === "ERROR"
                        ? "text-[#FF5C5C] bg-[#FF5C5C]/10 border border-[#FF5C5C]/20"
                        : "text-[#B6FF4A] bg-[#B6FF4A]/10 border border-[#B6FF4A]/20"
                    }`}
                  >
                    {log.level}
                  </span>
                  <span className="text-[#F5F5F5] font-mono-tech leading-snug">
                    {log.message}
                  </span>
                </div>
                <span className="text-[#707078] font-mono-tech shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
