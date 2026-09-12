import React from "react";
import { ServiceStatus } from "@/types/sentinel";
import { cn } from "@/lib/utils";
import { Server, Database, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

interface ServiceNodeProps {
  id: "dummy-api" | "sentinel-db";
  name: string;
  role: string;
  tech: string;
  port: number;
  status: ServiceStatus;
  containerState?: "RUNNING" | "STOPPED";
  lastCheck?: string | null;
  className?: string;
}

export function ServiceNode({
  id,
  name,
  role,
  tech,
  port,
  status,
  containerState = "RUNNING",
  lastCheck,
  className,
}: ServiceNodeProps) {
  const isUp = status === "UP" && containerState === "RUNNING";

  return (
    <div
      className={cn(
        "rounded-2xl p-5 border transition-all duration-300 relative group",
        isUp
          ? "bg-[#282830] border-[#303038] hover:border-[#00D068]/30 hover:bg-[#303038]"
          : "bg-[#282830] border-[#FF5C5C]/50 shadow-[0_0_30px_rgba(255,92,92,0.2)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center border",
              isUp
                ? "bg-[#181820] border-[#303038] text-[#00D068]"
                : "bg-[#FF5C5C]/15 border-[#FF5C5C]/30 text-[#FF5C5C]"
            )}
          >
            {id === "sentinel-db" ? (
              <Database className="w-5 h-5" />
            ) : (
              <Server className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-semibold tracking-tight text-[#F5F5F5]">
                {name}
              </h4>
              <span className="text-[11px] font-mono-tech text-[#A0A0A8] bg-[#181820] border border-[#303038] px-1.5 py-0.5 rounded">
                :{port}
              </span>
            </div>
            <p className="text-xs text-[#A0A0A8] font-medium">{role}</p>
          </div>
        </div>

        {/* Status indicator badge */}
        <div
          className={cn(
            "flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider border",
            isUp
              ? "bg-[#00D068]/10 text-[#00D068] border-[#00D068]/20"
              : "bg-[#FF5C5C]/15 text-[#FF5C5C] border-[#FF5C5C]/30 animate-pulse"
          )}
        >
          {isUp ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Healthy</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Down</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#303038] text-xs">
        <div>
          <span className="block text-[10px] uppercase font-medium tracking-wider text-[#A0A0A8]">
            Stack Engine
          </span>
          <span className="font-medium text-[#F5F5F5]">{tech}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-medium tracking-wider text-[#A0A0A8]">
            Container State
          </span>
          <span
            className={cn(
              "font-mono-tech font-semibold",
              containerState === "RUNNING" ? "text-[#00D068]" : "text-[#FF5C5C]"
            )}
          >
            {containerState}
          </span>
        </div>
      </div>

      {lastCheck && (
        <div className="mt-3 text-[11px] text-[#707078] flex items-center justify-between">
          <span>Telemetry sync</span>
          <span className="font-mono-tech text-[#707078]">
            {new Date(lastCheck).toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
}
