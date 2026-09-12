import React from "react";
import { SystemStatusResponse } from "@/types/sentinel";
import { cn } from "@/lib/utils";
import {
  Radar,
  Search,
  BrainCircuit,
  FileCheck,
  ShieldCheck,
  Zap,
  CheckCircle,
  RefreshCw,
} from "lucide-react";

interface LifecyclePipelineProps {
  data: SystemStatusResponse | null;
}

type StepState = "IDLE" | "ACTIVE" | "COMPLETE" | "BLOCKED";

interface PipelineStep {
  number: number;
  id: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  state: StepState;
}

export function LifecyclePipeline({ data }: LifecyclePipelineProps) {
  const health = data?.system_health || "HEALTHY";
  const activeIncident = data?.active_incident || false;
  const recentReasoning = data?.ai_reasoning || [];
  const latestThought = recentReasoning[recentReasoning.length - 1]?.thought?.toLowerCase() || "";
  const pendingApprovals = data?.pending_approvals || [];
  const hasPendingApproval = pendingApprovals.some((p) => p.status === "PENDING");

  // Determine dynamic step states
  const getStepStates = (): Record<string, StepState> => {
    if (!activeIncident && health === "HEALTHY") {
      return {
        detect: "COMPLETE",
        investigate: "IDLE",
        analyze: "IDLE",
        plan: "IDLE",
        govern: "IDLE",
        execute: "IDLE",
        verify: "IDLE",
        recover: "COMPLETE",
      };
    }

    if (hasPendingApproval) {
      return {
        detect: "COMPLETE",
        investigate: "COMPLETE",
        analyze: "COMPLETE",
        plan: "COMPLETE",
        govern: "BLOCKED",
        execute: "IDLE",
        verify: "IDLE",
        recover: "IDLE",
      };
    }

    if (health === "RECOVERING" || latestThought.includes("recovered") || latestThought.includes("healthy")) {
      return {
        detect: "COMPLETE",
        investigate: "COMPLETE",
        analyze: "COMPLETE",
        plan: "COMPLETE",
        govern: "COMPLETE",
        execute: "COMPLETE",
        verify: "ACTIVE",
        recover: "ACTIVE",
      };
    }

    if (latestThought.includes("restart") || latestThought.includes("dispatched") || latestThought.includes("auto-executing")) {
      return {
        detect: "COMPLETE",
        investigate: "COMPLETE",
        analyze: "COMPLETE",
        plan: "COMPLETE",
        govern: "COMPLETE",
        execute: "ACTIVE",
        verify: "IDLE",
        recover: "IDLE",
      };
    }

    if (latestThought.includes("guardrail") || latestThought.includes("policy")) {
      return {
        detect: "COMPLETE",
        investigate: "COMPLETE",
        analyze: "COMPLETE",
        plan: "COMPLETE",
        govern: "ACTIVE",
        execute: "IDLE",
        verify: "IDLE",
        recover: "IDLE",
      };
    }

    if (latestThought.includes("root cause") || latestThought.includes("diagnosis") || latestThought.includes("connection refused")) {
      return {
        detect: "COMPLETE",
        investigate: "COMPLETE",
        analyze: "ACTIVE",
        plan: "ACTIVE",
        govern: "IDLE",
        execute: "IDLE",
        verify: "IDLE",
        recover: "IDLE",
      };
    }

    if (latestThought.includes("inspecting") || latestThought.includes("logs") || latestThought.includes("detected")) {
      return {
        detect: "COMPLETE",
        investigate: "ACTIVE",
        analyze: "IDLE",
        plan: "IDLE",
        govern: "IDLE",
        execute: "IDLE",
        verify: "IDLE",
        recover: "IDLE",
      };
    }

    // Default during active incident
    return {
      detect: "ACTIVE",
      investigate: "ACTIVE",
      analyze: "IDLE",
      plan: "IDLE",
      govern: "IDLE",
      execute: "IDLE",
      verify: "IDLE",
      recover: "IDLE",
    };
  };

  const states = getStepStates();

  const steps: PipelineStep[] = [
    {
      number: 1,
      id: "detect",
      label: "Detect",
      desc: "Continuous health polling",
      icon: <Radar className="w-4 h-4" />,
      state: states.detect,
    },
    {
      number: 2,
      id: "investigate",
      label: "Investigate",
      desc: "Container log extraction",
      icon: <Search className="w-4 h-4" />,
      state: states.investigate,
    },
    {
      number: 3,
      id: "analyze",
      label: "Analyze",
      desc: "Diagnostic root cause",
      icon: <BrainCircuit className="w-4 h-4" />,
      state: states.analyze,
    },
    {
      number: 4,
      id: "plan",
      label: "Plan",
      desc: "Targeted remediation",
      icon: <FileCheck className="w-4 h-4" />,
      state: states.plan,
    },
    {
      number: 5,
      id: "govern",
      label: "Govern",
      desc: "Zod & policy validation",
      icon: <ShieldCheck className="w-4 h-4" />,
      state: states.govern,
    },
    {
      number: 6,
      id: "execute",
      label: "Execute",
      desc: "Safe container restart",
      icon: <Zap className="w-4 h-4" />,
      state: states.execute,
    },
    {
      number: 7,
      id: "verify",
      label: "Verify",
      desc: "Telemetry restoration",
      icon: <CheckCircle className="w-4 h-4" />,
      state: states.verify,
    },
    {
      number: 8,
      id: "recover",
      label: "Recover",
      desc: "Baseline restored",
      icon: <RefreshCw className="w-4 h-4" />,
      state: states.recover,
    },
  ];

  return (
    <section id="pipeline" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-[#F5F5F5]">
            Autonomous Incident Lifecycle Pipeline
          </h3>
          <p className="text-xs text-[#A0A0A8]">
            End-to-end execution path followed by Sentinel during infrastructure disruptions.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-xs text-[#A0A0A8]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00D068]" />
            Complete
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#58DC9C] animate-pulse" />
            Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#FF5C5C]" />
            Blocked
          </span>
        </div>
      </div>

      {/* Horizontal Pipeline Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {steps.map((step) => {
          const stateConfigs = {
            IDLE: {
              border: "border-[#303038]",
              bg: "bg-[#181820] text-[#707078]",
              pill: "bg-[#282830] text-[#707078]",
              statusText: "Ready",
            },
            ACTIVE: {
              border: "border-[#00D068]/50 shadow-[0_0_15px_rgba(0,208,104,0.25)]",
              bg: "bg-[#00D068]/10 text-[#00D068]",
              pill: "bg-[#00D068]/25 text-[#00D068] font-semibold animate-pulse",
              statusText: "In Progress",
            },
            COMPLETE: {
              border: "border-[#00D068]/30",
              bg: "bg-[#00D068]/5 text-[#00D068]",
              pill: "bg-[#00D068]/15 text-[#00D068] font-medium",
              statusText: "Passed",
            },
            BLOCKED: {
              border: "border-[#FF5C5C]/50 shadow-[0_0_15px_rgba(255,92,92,0.25)]",
              bg: "bg-[#FF5C5C]/10 text-[#FF5C5C]",
              pill: "bg-[#FF5C5C]/20 text-[#FF5C5C] font-semibold animate-pulse",
              statusText: "Awaiting Human",
            },
          }[step.state];

          return (
            <div
              key={step.id}
              className={cn(
                "rounded-2xl p-3.5 flex flex-col justify-between border transition-all duration-300",
                stateConfigs.border,
                stateConfigs.bg
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-[10px] font-mono-tech font-bold opacity-60">
                    0{step.number}
                  </span>
                  <div className="p-1 rounded-md bg-[#282830] text-current">
                    {step.icon}
                  </div>
                </div>
                <h4 className="text-xs font-semibold tracking-tight text-[#F5F5F5] mb-0.5">
                  {step.label}
                </h4>
                <p className="text-[11px] text-[#A0A0A8] line-clamp-2 leading-snug">
                  {step.desc}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-[#303038]/60">
                <span
                  className={cn(
                    "block text-[10px] uppercase tracking-wider text-center py-0.5 rounded-md",
                    stateConfigs.pill
                  )}
                >
                  {stateConfigs.statusText}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
