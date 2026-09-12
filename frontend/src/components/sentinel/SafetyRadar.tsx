import React from "react";
import { GuardrailPolicies } from "@/types/sentinel";
import { GuardrailPolicy } from "./GuardrailPolicy";
import {
  ShieldCheck,
  Cpu,
  CheckCircle2,
  FileCheck2,
  SlidersHorizontal,
  Terminal,
  Lock,
} from "lucide-react";

interface SafetyRadarProps {
  policies?: GuardrailPolicies;
}

export function SafetyRadar({ policies }: SafetyRadarProps) {
  const pipelineSteps = [
    {
      id: "ai_proposal",
      title: "AI Proposal",
      desc: "LLM requests tool name & kwargs",
      icon: <Cpu className="w-4 h-4 text-[#00D068]" />,
      color: "border-[#303038] bg-[#282830]",
      iconBg: "bg-[#00D068]/10 text-[#00D068]",
    },
    {
      id: "zod_validation",
      title: "Zod Whitelist",
      desc: "Strict type & container regex check",
      icon: <FileCheck2 className="w-4 h-4 text-[#58DC9C]" />,
      color: "border-[#303038] bg-[#282830]",
      iconBg: "bg-[#58DC9C]/10 text-[#58DC9C]",
    },
    {
      id: "policy_engine",
      title: "Policy Engine",
      desc: "Evaluates risk rating & auto-exec",
      icon: <SlidersHorizontal className="w-4 h-4 text-[#B6FF4A]" />,
      color: "border-[#303038] bg-[#282830]",
      iconBg: "bg-[#B6FF4A]/10 text-[#B6FF4A]",
    },
    {
      id: "risk_gate",
      title: "Governance Gate",
      desc: "LOW = Auto / CRITICAL = Intercept",
      icon: <Lock className="w-4 h-4 text-[#FF5C5C]" />,
      color: "border-[#303038] bg-[#282830]",
      iconBg: "bg-[#FF5C5C]/10 text-[#FF5C5C]",
    },
    {
      id: "controlled_exec",
      title: "Safe Execution",
      desc: "Non-blocking execFile & audit log",
      icon: <Terminal className="w-4 h-4 text-[#00D068]" />,
      color: "border-[#303038] bg-[#282830]",
      iconBg: "bg-[#00D068]/10 text-[#00D068]",
    },
  ];

  return (
    <section id="safety" className="bg-[#282830] border border-[#303038] rounded-3xl p-6 sm:p-8 space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#303038]">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#00D068]" />
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5F5F5]">
              Deterministic Safety & Guardrail Architecture
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-[#A0A0A8] mt-1">
            Zero direct LLM execution. Every action passes through multi-layered deterministic validation, policy evaluation, and human-in-the-loop gates.
          </p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-[#00D068] bg-[#181820] border border-[#303038] px-3 py-1 rounded-full w-fit">
          Deterministic Governance
        </span>
      </div>

      {/* Main Grid: Pipeline visualizer on left, Policy table on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Visual Pipeline Flow */}
        <div className="lg:col-span-7 bg-[#181820] border border-[#303038] rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#303038]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A8]">
              Safety Verification Pipeline
            </span>
            <span className="text-[11px] font-semibold text-[#00D068] bg-[#00D068]/10 border border-[#00D068]/20 px-2.5 py-0.5 rounded-full">
              Deterministic Guard Active
            </span>
          </div>

          <div className="space-y-3">
            {pipelineSteps.map((step, idx) => (
              <div key={step.id} className="space-y-2">
                <div
                  className={`flex items-center justify-between p-3.5 rounded-xl border ${step.color} transition-all`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border border-transparent ${step.iconBg}`}>
                      {step.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono-tech text-[#707078] font-bold">
                          Step 0{idx + 1}
                        </span>
                        <h4 className="text-sm font-semibold tracking-tight text-[#F5F5F5]">
                          {step.title}
                        </h4>
                      </div>
                      <p className="text-xs text-[#A0A0A8] mt-0.5">
                        {step.desc}
                      </p>
                    </div>
                  </div>

                  <CheckCircle2 className="w-4 h-4 text-[#00D068] shrink-0" />
                </div>

                {idx < pipelineSteps.length - 1 && (
                  <div className="flex justify-center -my-1">
                    <div className="w-0.5 h-3 bg-[#303038]" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Security Callout Box */}
          <div className="p-3.5 rounded-xl bg-[#282830] border border-[#303038] text-xs text-[#A0A0A8] leading-relaxed">
            <span className="font-semibold text-[#F5F5F5]">Core Security Guarantee:</span> LLMs produce text recommendations only. Docker subprocesses are invoked strictly via <code className="font-mono-tech text-[#00D068] font-bold bg-[#181820] px-1.5 py-0.5 rounded border border-[#303038]">execFile()</code> using allowlisted parameters after policy validation. Shell command concatenation is architecturally prevented.
          </div>
        </div>

        {/* Policy Rules Matrix & Risk Branches */}
        <div className="lg:col-span-5 space-y-4">
          <GuardrailPolicy policies={policies} />

          {/* Two-Tier Risk Flow Graphic */}
          <div className="bg-[#282830] border border-[#303038] rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A8]">
              Risk Decision Branches
            </h4>

            {/* Low Risk */}
            <div className="p-3 rounded-xl bg-[#00D068]/10 border border-[#00D068]/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#00D068] uppercase">
                  Low Risk Actions
                </span>
                <span className="text-[10px] font-mono-tech text-[#A0A0A8]">
                  e.g., restart_container
                </span>
              </div>
              <p className="text-[11px] text-[#F5F5F5] leading-snug">
                Verified against container whitelist → Executed autonomously without downtime.
              </p>
            </div>

            {/* Critical Risk */}
            <div className="p-3 rounded-xl bg-[#FF5C5C]/10 border border-[#FF5C5C]/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#FF5C5C] uppercase">
                  Critical Risk Actions
                </span>
                <span className="text-[10px] font-mono-tech text-[#A0A0A8]">
                  e.g., delete_database
                </span>
              </div>
              <p className="text-[11px] text-[#F5F5F5] leading-snug">
                Execution automatically halted → Human operator authorization modal required.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
