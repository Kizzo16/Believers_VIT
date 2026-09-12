"use client";

import React from "react";
import { useSentinel } from "@/context/SentinelContext";
import { SimulationControls } from "@/components/sentinel/SimulationControls";
import { Zap, AlertTriangle, ShieldCheck, Flame, Info } from "lucide-react";

export default function SimulationsPage() {
  const {
    handleKillDatabase,
    handleProposeDangerousAction,
    handleTriggerMockIncident,
    actionLoading,
  } = useSentinel();

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#303038]">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#B6FF4A] mb-1">
            <Zap className="w-3.5 h-3.5" />
            <span>Chaos Testing & Reliability Proofs</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F5]">
            Simulations & Chaos Workspace
          </h1>
          <p className="text-xs sm:text-sm text-[#A0A0A8] mt-1">
            Controlled fault injection to demonstrate autonomous failure detection, deterministic guardrails, and self-healing.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-[#B6FF4A]/15 text-[#B6FF4A] border border-[#B6FF4A]/30">
            Simulation / Demonstration Workspace
          </span>
        </div>
      </div>

      {/* Safety Banner */}
      <div className="bg-[#282830] rounded-2xl p-5 border border-[#303038] flex items-start gap-3.5">
        <Info className="w-5 h-5 text-[#00D068] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#F5F5F5]">
            Safe Demonstration Mode Notice
          </h4>
          <p className="text-xs text-[#A0A0A8] leading-relaxed">
            All actions executed from this workspace are non-destructive testing triggers running against local sandbox containers. Dangerous tool executions (e.g. database deletion) simulate human authorization intercepts without purging production databases.
          </p>
        </div>
      </div>

      {/* Primary Simulation Controls */}
      <SimulationControls
        onKillDatabase={handleKillDatabase}
        onProposeDangerous={handleProposeDangerousAction}
        onTriggerMock={handleTriggerMockIncident}
        loadingAction={actionLoading}
      />

      {/* Demonstration Scenario Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        <div className="bg-[#282830] rounded-2xl p-5 border border-[#303038] space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#FF5C5C]">
            <Flame className="w-4 h-4" />
            <span>Scenario 1 Walkthrough</span>
          </div>
          <h4 className="text-sm font-semibold text-[#F5F5F5]">Container Outage & Self-Healing</h4>
          <p className="text-xs text-[#A0A0A8] leading-relaxed">
            Clicking &quot;Simulate DB Failure&quot; sends a SIGTERM to <code className="font-mono-tech text-[#F5F5F5]">sentinel-db</code>. The polling loop catches HTTP 500 errors, extracts application logs, isolates the connection refused fault, and executes a container restart.
          </p>
        </div>

        <div className="bg-[#282830] rounded-2xl p-5 border border-[#303038] space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#B6FF4A]">
            <AlertTriangle className="w-4 h-4" />
            <span>Scenario 2 Walkthrough</span>
          </div>
          <h4 className="text-sm font-semibold text-[#F5F5F5]">Dangerous Action Intercept</h4>
          <p className="text-xs text-[#A0A0A8] leading-relaxed">
            Clicking &quot;Simulate Critical Action&quot; proposes <code className="font-mono-tech text-[#F5F5F5]">delete_database</code>. The policy engine rates it as CRITICAL and halts execution, triggering the Security Authorization Gate.
          </p>
        </div>

        <div className="bg-[#282830] rounded-2xl p-5 border border-[#303038] space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#58DC9C]">
            <ShieldCheck className="w-4 h-4" />
            <span>Scenario 3 Walkthrough</span>
          </div>
          <h4 className="text-sm font-semibold text-[#F5F5F5]">Telemetry & Anomaly Dispatch</h4>
          <p className="text-xs text-[#A0A0A8] leading-relaxed">
            Clicking &quot;Trigger Mock Incident&quot; synthesizes an anomaly record on the Fastify backend, testing event broadcast, pipeline state transition, and audit log generation.
          </p>
        </div>
      </div>
    </div>
  );
}
