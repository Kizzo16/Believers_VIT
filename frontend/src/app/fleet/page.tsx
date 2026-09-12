"use client";

import React from "react";
import { useSentinel } from "@/context/SentinelContext";
import { FleetTopology } from "@/components/sentinel/FleetTopology";
import { Network, Server, ShieldCheck, Database, Cpu, CheckCircle2 } from "lucide-react";

export default function FleetPage() {
  const { data } = useSentinel();
  const apiStatus = data?.dummy_api_status || "UP";
  const dbStatus = data?.database_status || "UP";
  const containers = data?.containers;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#303038]">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#00D068] mb-1">
            <Network className="w-3.5 h-3.5" />
            <span>Infrastructure Map & Node Control</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F5]">
            Fleet & Service Topology
          </h1>
          <p className="text-xs sm:text-sm text-[#A0A0A8] mt-1">
            Live process interconnects, container isolation states, and communication bridge telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5 text-xs text-[#A0A0A8] bg-[#181820] border border-[#303038] px-3 py-1.5 rounded-xl shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#00D068]" />
          <span>Subprocess Container Guard: Active</span>
        </div>
      </div>

      {/* Main Interactive Fleet Topology Map */}
      <FleetTopology data={data} />

      {/* Detailed Node Telemetry & Environment Specs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Node 1 Specs */}
        <div className="bg-[#282830] rounded-2xl p-6 border border-[#303038] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#303038]">
            <div className="flex items-center gap-2.5">
              <Server className="w-4 h-4 text-[#00D068]" />
              <h3 className="text-sm font-semibold text-[#F5F5F5]">dummy-api Architecture</h3>
            </div>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                apiStatus === "UP"
                  ? "bg-[#00D068]/10 text-[#00D068] border-[#00D068]/25"
                  : "bg-[#FF5C5C]/15 text-[#FF5C5C] border-[#FF5C5C]/30 animate-pulse"
              }`}
            >
              {apiStatus}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-[#303038]/60">
              <span className="text-[#A0A0A8]">Container Role</span>
              <span className="text-[#F5F5F5] font-medium">Public HTTP Gateway</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#303038]/60">
              <span className="text-[#A0A0A8]">Engine / Runtime</span>
              <span className="text-[#F5F5F5] font-mono-tech">FastAPI (Python 3.11-slim)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#303038]/60">
              <span className="text-[#A0A0A8]">Exposed Port</span>
              <span className="text-[#F5F5F5] font-mono-tech">8001:8000</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#303038]/60">
              <span className="text-[#A0A0A8]">Docker Process Status</span>
              <span className="font-mono-tech font-semibold text-[#00D068]">
                {containers?.dummy_api || "RUNNING"}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#A0A0A8]">Database Driver</span>
              <span className="text-[#F5F5F5] font-mono-tech">asyncpg / psycopg2-binary</span>
            </div>
          </div>
        </div>

        {/* Node 2 Specs */}
        <div className="bg-[#282830] rounded-2xl p-6 border border-[#303038] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#303038]">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-[#00D068]" />
              <h3 className="text-sm font-semibold text-[#F5F5F5]">sentinel-db Architecture</h3>
            </div>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                dbStatus === "UP"
                  ? "bg-[#00D068]/10 text-[#00D068] border-[#00D068]/25"
                  : "bg-[#FF5C5C]/15 text-[#FF5C5C] border-[#FF5C5C]/30 animate-pulse"
              }`}
            >
              {dbStatus}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-[#303038]/60">
              <span className="text-[#A0A0A8]">Container Role</span>
              <span className="text-[#F5F5F5] font-medium">Relational Persistence Layer</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#303038]/60">
              <span className="text-[#A0A0A8]">Engine / Runtime</span>
              <span className="text-[#F5F5F5] font-mono-tech">PostgreSQL 16-alpine</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#303038]/60">
              <span className="text-[#A0A0A8]">Exposed Port</span>
              <span className="text-[#F5F5F5] font-mono-tech">5432:5432</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#303038]/60">
              <span className="text-[#A0A0A8]">Docker Process Status</span>
              <span
                className={`font-mono-tech font-semibold ${
                  containers?.sentinel_db === "RUNNING" || dbStatus === "UP"
                    ? "text-[#00D068]"
                    : "text-[#FF5C5C]"
                }`}
              >
                {containers?.sentinel_db || (dbStatus === "UP" ? "RUNNING" : "STOPPED")}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#A0A0A8]">Remediation Handler</span>
              <span className="text-[#F5F5F5] font-mono-tech">restart_container(&quot;sentinel-db&quot;)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
