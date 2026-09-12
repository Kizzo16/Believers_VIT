import React from "react";
import { GuardrailPolicies } from "@/types/sentinel";
import { Shield, Check, Lock } from "lucide-react";

interface GuardrailPolicyProps {
  policies?: GuardrailPolicies;
}

export function GuardrailPolicy({ policies }: GuardrailPolicyProps) {
  const policyList = policies
    ? Object.entries(policies).map(([tool, rule]) => ({
        tool,
        risk: rule.risk,
        autoExecute: rule.auto_execute,
      }))
    : [
        { tool: "get_docker_logs", risk: "LOW", autoExecute: true },
        { tool: "restart_container", risk: "LOW", autoExecute: true },
        { tool: "delete_database", risk: "CRITICAL", autoExecute: false },
      ];

  return (
    <div className="bg-[#282830] border border-[#303038] rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-[#303038]">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F5]">
          <Shield className="w-4 h-4 text-[#00D068]" />
          <span>Active Guardrail Policy Matrix</span>
        </div>
        <span className="text-[11px] font-mono-tech text-[#A0A0A8]">
          Source: policies.json
        </span>
      </div>

      <div className="space-y-2">
        {policyList.map((item) => {
          const isCritical = item.risk === "CRITICAL";
          return (
            <div
              key={item.tool}
              className="flex items-center justify-between p-3 rounded-xl bg-[#181820] border border-[#303038] hover:bg-[#303038] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono-tech text-[#F5F5F5] font-semibold">
                  {item.tool}()
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    isCritical
                      ? "bg-[#FF5C5C]/10 text-[#FF5C5C] border-[#FF5C5C]/25"
                      : "bg-[#00D068]/10 text-[#00D068] border-[#00D068]/20"
                  }`}
                >
                  {item.risk}
                </span>

                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1 border ${
                    item.autoExecute
                      ? "bg-[#282830] text-[#A0A0A8] border-[#303038]"
                      : "bg-[#B6FF4A]/10 text-[#B6FF4A] border-[#B6FF4A]/25"
                  }`}
                >
                  {item.autoExecute ? (
                    <>
                      <Check className="w-3 h-3 text-[#00D068]" />
                      Auto-Exec
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 text-[#B6FF4A]" />
                      Human Required
                    </>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
