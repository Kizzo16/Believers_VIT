import React from "react";
import { SystemStatusResponse } from "@/types/sentinel";
import { ServiceNode } from "./ServiceNode";
import { Network, ArrowRight, ShieldCheck } from "lucide-react";

interface FleetTopologyProps {
  data: SystemStatusResponse | null;
}

export function FleetTopology({ data }: FleetTopologyProps) {
  const apiStatus = data?.dummy_api_status || "UP";
  const dbStatus = data?.database_status || "UP";
  const containers = data?.containers;

  return (
    <section id="topology" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-[#00D068]" />
            <h3 className="text-lg font-semibold tracking-tight text-[#F5F5F5]">
              Fleet & Service Topology
            </h3>
          </div>
          <p className="text-xs text-[#A0A0A8]">
            Real-time relationship mapping and container health status across the application stack.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#A0A0A8]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00D068]" />
          <span>Subprocess Container Guard: Active</span>
        </div>
      </div>

      {/* Grid with Visual Link */}
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* Service 1: Dummy API */}
        <ServiceNode
          id="dummy-api"
          name="dummy-api"
          role="Public HTTP Application Gateway"
          tech="Python FastAPI"
          port={8001}
          status={apiStatus}
          containerState={containers?.dummy_api || (apiStatus === "UP" ? "RUNNING" : "STOPPED")}
          lastCheck={data?.last_ping_time}
        />

        {/* Central Dependency Flow Indicator (Desktop) */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 items-center justify-center">
          <div className="bg-[#181820] border border-[#303038] p-2 rounded-full text-[#00D068] shadow-xl">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* Service 2: Sentinel DB */}
        <ServiceNode
          id="sentinel-db"
          name="sentinel-db"
          role="Primary Relational Persistence"
          tech="PostgreSQL 16"
          port={5432}
          status={dbStatus}
          containerState={containers?.sentinel_db || (dbStatus === "UP" ? "RUNNING" : "STOPPED")}
          lastCheck={data?.last_ping_time}
        />
      </div>
    </section>
  );
}
