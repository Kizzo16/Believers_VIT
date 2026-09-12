"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  Zap,
  UserCheck,
  HelpCircle,
  Layers,
  FileCheck2,
  Activity,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PolicyDecision, GuardrailPolicies } from "@/types/sentinel";

export function SafetyPolicyPanel() {
  const [decision, setDecision] = useState<PolicyDecision | null>(null);
  const [policies, setPolicies] = useState<GuardrailPolicies>({});
  const [loading, setLoading] = useState(false);
  const [evalTool, setEvalTool] = useState("restart_service");

  const fetchDecision = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/policy/decision/latest");
      if (res.ok) {
        const json = await res.json();
        if (json.policy_decision) {
          setDecision(json.policy_decision);
        }
      }
    } catch {
      // Ignore network error
    }
  };

  const fetchPolicies = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/policies");
      if (res.ok) {
        const json = await res.json();
        setPolicies(json);
      }
    } catch {
      // Ignore error
    }
  };

  const handleEvaluateTest = async (toolName: string) => {
    setLoading(true);
    setEvalTool(toolName);
    try {
      const res = await fetch("http://localhost:8000/api/policy/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool_name: toolName, kwargs: { service: "sentinel-db" } }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.policy_decision) {
          setDecision(json.policy_decision);
        }
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDecision();
    fetchPolicies();
    const interval = setInterval(fetchDecision, 3000);
    return () => clearInterval(interval);
  }, []);

  const decType = decision?.decision ?? "AUTO_EXECUTE";

  const getDecisionBadge = (type: string) => {
    switch (type) {
      case "BLOCKED":
        return {
          bg: "bg-rose-500/20 text-rose-400 border-rose-500/40",
          icon: <AlertOctagon className="w-4 h-4 text-rose-400" />,
          label: "CRITICAL → BLOCKED",
        };
      case "HUMAN_APPROVAL_REQUIRED":
        return {
          bg: "bg-amber-500/20 text-amber-400 border-amber-500/40",
          icon: <UserCheck className="w-4 h-4 text-amber-400" />,
          label: "MEDIUM/HIGH RISK → HUMAN APPROVAL",
        };
      default:
        return {
          bg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
          icon: <Zap className="w-4 h-4 text-emerald-400" />,
          label: "LOW RISK → AUTO EXECUTE",
        };
    }
  };

  const currentBadge = getDecisionBadge(decType);

  return (
    <div className="bg-[#282830] rounded-3xl p-6 border border-[#303038] space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#303038]">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#00D068]" />
            <h3 className="text-lg font-bold text-[#F5F5F5]">
              Module 8: Safety & Policy Engine
            </h3>
          </div>
          <p className="text-xs text-[#A0A0A8] mt-1">
            Enforces strict separation of AI decision-making from execution authority. Evaluates technical risk, blast radius, and business criticality before authorizing tool dispatch.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEvaluateTest(evalTool)}
            disabled={loading}
            className="bg-[#1E1E24] border-[#3A3A42] text-[#F5F5F5] hover:bg-[#2F2F38] text-xs h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Re-evaluate Policy
          </Button>
        </div>
      </div>

      {/* Primary Decision Banner */}
      <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#303038] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#303038]">
          <div className="flex items-center gap-2.5">
            {currentBadge.icon}
            <div>
              <span className="text-[10px] font-bold text-[#A0A0A8] uppercase tracking-widest block">
                Latest Evaluated Action Authority Verdict
              </span>
              <h4 className="text-sm font-bold text-[#F5F5F5]">
                Tool Target: <code className="text-[#3B82F6] font-mono">{decision?.tool_name || "restart_service"}</code>
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase border flex items-center gap-1.5 ${currentBadge.bg}`}>
              {currentBadge.label}
            </span>
          </div>
        </div>

        {/* 4 Multiplier Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#282830] p-3 rounded-xl border border-[#303038] space-y-1">
            <span className="text-[11px] text-[#A0A0A8] block">Base Tool Risk</span>
            <span className="text-xs font-mono font-bold text-[#F5F5F5]">{decision?.base_risk || "LOW"}</span>
          </div>

          <div className="bg-[#282830] p-3 rounded-xl border border-[#303038] space-y-1">
            <span className="text-[11px] text-[#A0A0A8] block">Effective Risk</span>
            <span className={`text-xs font-mono font-bold ${decision?.contextual_factors?.risk_escalated ? "text-rose-400" : "text-[#B6FF4A]"}`}>
              {decision?.effective_risk || "LOW"} {decision?.contextual_factors?.risk_escalated ? "(ESCALATED)" : ""}
            </span>
          </div>

          <div className="bg-[#282830] p-3 rounded-xl border border-[#303038] space-y-1">
            <span className="text-[11px] text-[#A0A0A8] block">Contextual Blast Radius</span>
            <span className="text-xs font-mono font-bold text-[#3B82F6]">{decision?.contextual_factors?.blast_radius_level || "NONE"}</span>
          </div>

          <div className="bg-[#282830] p-3 rounded-xl border border-[#303038] space-y-1">
            <span className="text-[11px] text-[#A0A0A8] block">Critical Business Path</span>
            <span className="text-xs font-mono font-bold text-purple-400">
              {decision?.contextual_factors?.is_critical_path ? "YES" : "NO"}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Policy Simulation Bar */}
      <div className="bg-[#1E1E24] p-4 rounded-2xl border border-[#303038] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#B6FF4A]" />
          <span className="text-xs font-bold text-[#F5F5F5]">Simulate Policy Evaluation:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => handleEvaluateTest("get_service_logs")}
            className="bg-[#282830] hover:bg-[#303038] text-xs text-[#00D068] border border-[#00D068]/30 h-7"
          >
            Safe: get_service_logs
          </Button>

          <Button
            size="sm"
            onClick={() => handleEvaluateTest("restart_service")}
            className="bg-[#282830] hover:bg-[#303038] text-xs text-amber-400 border border-amber-500/30 h-7"
          >
            Gated: restart_service
          </Button>

          <Button
            size="sm"
            onClick={() => handleEvaluateTest("delete_database")}
            className="bg-[#282830] hover:bg-[#303038] text-xs text-rose-400 border border-rose-500/30 h-7"
          >
            Destructive: delete_database
          </Button>
        </div>
      </div>

      {/* Policy Rules Matrix Table */}
      <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#303038] space-y-3">
        <h4 className="text-xs font-bold text-[#A0A0A8] uppercase tracking-wider flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-[#3B82F6]" />
          Registered Safety Policy Rules Matrix (`policies.json`)
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#303038] text-[#A0A0A8]">
                <th className="py-2.5 px-3 font-semibold">Declared Tool Name</th>
                <th className="py-2.5 px-3 font-semibold">Base Policy Risk</th>
                <th className="py-2.5 px-3 font-semibold">Auto-Execute Permission</th>
                <th className="py-2.5 px-3 font-semibold">Execution Authority Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#303038]/50 text-[#F5F5F5]">
              {Object.keys(policies).length > 0 ? (
                Object.entries(policies).map(([tool, rule]) => {
                  const isBlocked = rule.risk === "CRITICAL" || tool === "delete_database";
                  const isAuto = rule.auto_execute && !isBlocked;

                  return (
                    <tr key={tool} className="hover:bg-[#282830]/50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-semibold text-xs text-[#3B82F6]">
                        {tool}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            rule.risk === "CRITICAL"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : rule.risk === "HIGH" || rule.risk === "MEDIUM"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          {rule.risk}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            rule.auto_execute
                              ? "text-emerald-400 bg-emerald-500/10"
                              : "text-amber-400 bg-amber-500/10"
                          }`}
                        >
                          {rule.auto_execute ? "TRUE" : "FALSE"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-xs">
                        {isBlocked ? (
                          <span className="text-rose-400 flex items-center gap-1">
                            <Lock className="w-3 h-3" /> BLOCKED
                          </span>
                        ) : isAuto ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Zap className="w-3 h-3" /> AUTO EXECUTE
                          </span>
                        ) : (
                          <span className="text-amber-400 flex items-center gap-1">
                            <UserCheck className="w-3 h-3" /> HUMAN APPROVAL REQUIRED
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-[#A0A0A8] italic">
                    Loading policy rules matrix...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Policy Audit Reasoning Chain */}
      <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#303038] space-y-3">
        <h4 className="text-xs font-bold text-[#A0A0A8] uppercase tracking-wider flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[#B6FF4A]" />
          Policy Engine Evaluation Audit Trail
        </h4>

        {decision?.policy_reasoning && decision.policy_reasoning.length > 0 ? (
          <div className="space-y-2">
            {decision.policy_reasoning.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 bg-[#282830] p-3 rounded-xl border border-[#303038]"
              >
                <div className="w-5 h-5 rounded-full bg-[#1E1E24] border border-[#3A3A42] flex items-center justify-center text-[10px] font-bold text-[#B6FF4A] shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <p className="text-xs text-[#F5F5F5] leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#A0A0A8] italic">No active policy reasoning evaluation logged.</p>
        )}
      </div>
    </div>
  );
}
