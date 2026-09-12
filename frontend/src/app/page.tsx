"use client";

import React from "react";
import Link from "next/link";
import { useSentinel } from "@/context/SentinelContext";
import { HeroStatus } from "@/components/sentinel/HeroStatus";
import { LifecyclePipeline } from "@/components/sentinel/LifecyclePipeline";
import {
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  Server,
  Terminal,
  FileCheck2,
} from "lucide-react";

export default function OverviewPage() {
  const { data } = useSentinel();
  const activeIncident = data?.active_incident || false;
  const currentIncident = data?.current_incident;
  const health = data?.system_health || "HEALTHY";

  return (
    <div className="space-y-10">
      {/* 1. Executive Hero & High-Level System Status */}
      <HeroStatus data={data} />

      {/* 2. Active Outage Alert Banner (If Disruption Active) */}
      {activeIncident && (
        <div className="bg-[#282830] rounded-3xl p-6 border border-[#FF5C5C]/50 shadow-[0_16px_40px_-15px_rgba(255,92,92,0.25)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#FF5C5C]/15 border border-[#FF5C5C]/30 text-[#FF5C5C] flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#FF5C5C]">
                  Active Incident Detected
                </span>
                <span className="text-xs font-mono-tech text-[#F5F5F5] bg-[#181820] px-2 py-0.5 rounded border border-[#303038]">
                  {currentIncident?.id || "INC-AUTO-DISRUPT"}
                </span>
              </div>
              <p className="text-sm font-medium text-[#F5F5F5] mt-0.5">
                {currentIncident?.error || "Database connection failure detected. SRE loop engaged."}
              </p>
            </div>
          </div>

          <Link
            href="/incidents"
            className="inline-flex items-center gap-2 bg-[#FF5C5C] hover:bg-[#e0282c] text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0 w-fit"
          >
            <span>Open Incident Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* 3. Autonomous Incident Lifecycle Pipeline */}
      <LifecyclePipeline data={data} />

      {/* 4. Quick Platform Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        <Link
          href="/incidents"
          className="bg-[#282830] hover:bg-[#303038] hover:border-[#00D068]/30 rounded-2xl p-5 border border-[#303038] flex flex-col justify-between group transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A8] group-hover:text-[#F5F5F5] transition-colors">
              Incident Response
            </span>
            <ShieldAlert className="w-4 h-4 text-[#A0A0A8] group-hover:text-[#00D068] transition-colors" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#F5F5F5]">
              {activeIncident ? "Active Outage In Progress" : "Zero Open Outages"}
            </div>
            <p className="text-xs text-[#A0A0A8] mt-1">
              Evidence analysis & telemetry logs
            </p>
          </div>
        </Link>

        <Link
          href="/fleet"
          className="bg-[#282830] hover:bg-[#303038] hover:border-[#00D068]/30 rounded-2xl p-5 border border-[#303038] flex flex-col justify-between group transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A8] group-hover:text-[#F5F5F5] transition-colors">
              Fleet Topology
            </span>
            <Server className="w-4 h-4 text-[#A0A0A8] group-hover:text-[#00D068] transition-colors" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#F5F5F5]">
              2 Core Nodes Active
            </div>
            <p className="text-xs text-[#A0A0A8] mt-1">
              dummy-api (:8001) & sentinel-db (:5432)
            </p>
          </div>
        </Link>

        <Link
          href="/agent"
          className="bg-[#282830] hover:bg-[#303038] hover:border-[#00D068]/30 rounded-2xl p-5 border border-[#303038] flex flex-col justify-between group transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A8] group-hover:text-[#F5F5F5] transition-colors">
              AI Agent Telemetry
            </span>
            <Terminal className="w-4 h-4 text-[#A0A0A8] group-hover:text-[#00D068] transition-colors" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#F5F5F5]">
              Autonomous Loop Active
            </div>
            <p className="text-xs text-[#A0A0A8] mt-1">
              Live reasoning stream & execution trace
            </p>
          </div>
        </Link>

        <Link
          href="/governance"
          className="bg-[#282830] hover:bg-[#303038] hover:border-[#00D068]/30 rounded-2xl p-5 border border-[#303038] flex flex-col justify-between group transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A8] group-hover:text-[#F5F5F5] transition-colors">
              Safety & Governance
            </span>
            <FileCheck2 className="w-4 h-4 text-[#A0A0A8] group-hover:text-[#00D068] transition-colors" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#F5F5F5]">
              Deterministic Zod Guard
            </div>
            <p className="text-xs text-[#A0A0A8] mt-1">
              Policy matrix & human approval gate
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
