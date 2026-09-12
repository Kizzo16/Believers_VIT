"use client";

import React, { useState } from "react";

import { useSentinel } from "@/context/SentinelContext";
import { LifecyclePipeline } from "@/components/sentinel/LifecyclePipeline";
import { AgentTrace } from "@/components/sentinel/AgentTrace";
import { AiInvestigationPanel } from "@/components/sentinel/AiInvestigationPanel";
import { Cpu, Terminal, Sparkles, BrainCircuit, Activity } from "lucide-react";

export default function AgentPage() {
  const { data } = useSentinel();
  const [traceTab, setTraceTab] = useState<"reasoning" | "logs">("reasoning");

  const reasoningCount = data?.ai_reasoning?.length || 0;
  const logsCount = data?.incident_logs?.length || 0;
  const activeIncident = data?.active_incident || false;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#303038]">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#00D068] mb-1">
            <Cpu className="w-3.5 h-3.5" />
            <span>Autonomous Cognitive SRE Loop</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F5]">
            AI Agent & Telemetry Stream
          </h1>
          <p className="text-xs sm:text-sm text-[#A0A0A8] mt-1">
            Deterministic reasoning progression, real-time log ingestion, and policy-governed tool invocation trace.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-[#A0A0A8] bg-[#181820] border border-[#303038] px-3 py-1.5 rounded-xl font-mono-tech">
            <BrainCircuit className="w-3.5 h-3.5 text-[#00D068]" />
            <span>Loop: {activeIncident ? "Active Incident Execution" : "Standing By"}</span>
          </div>
        </div>
      </div>

      {/* Module 5: AI Investigation & Root Cause Hypothesis */}
      <AiInvestigationPanel />

      {/* Autonomous Incident Lifecycle Pipeline */}
      <div className="space-y-2">

        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#A0A0A8]">
          <Activity className="w-3.5 h-3.5 text-[#00D068]" />
          <span>Execution Pipeline Progression</span>
        </div>
        <LifecyclePipeline data={data} />
      </div>

      {/* Live Agent Trace & Telemetry Stream */}
      {/* AgentTrace manages its own internal scrollTop with terminalRef, without document scrolling */}
      <AgentTrace
        reasoning={data?.ai_reasoning || []}
        logs={data?.incident_logs || []}
        activeTab={traceTab}
        onTabChange={setTraceTab}
      />

      {/* Execution Architecture Note */}
      <div className="bg-[#282830] rounded-2xl p-5 border border-[#303038] text-xs text-[#A0A0A8] leading-relaxed space-y-1">
        <span className="font-semibold text-[#F5F5F5]">Cognitive Trace Architecture:</span> Sentinel operates an event-driven loop. When an HTTP 500 error or container stoppage is observed, the reasoning engine autonomously progresses through diagnosis, policy verification, and safe subprocess execution. Log entries and thoughts are pushed live via the control plane.
      </div>
    </div>
  );
}
