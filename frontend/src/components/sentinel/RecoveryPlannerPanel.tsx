"use client";

import React, { useState, useEffect } from "react";
import {
  Compass,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  ThumbsUp,
  XCircle,
  HelpCircle,
  Wrench,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecoveryOption, RecoveryStrategyPlan } from "@/types/sentinel";

export function RecoveryPlannerPanel() {
  const [plan, setPlan] = useState<RecoveryStrategyPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPlan = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/recovery/strategies");
      if (res.ok) {
        const json = await res.json();
        if (json.recovery_plan) {
          setPlan(json.recovery_plan);
        }
      }
    } catch {
      // Ignore network error
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/recovery/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.recovery_plan) {
          setPlan(json.recovery_plan);
        }
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
    const interval = setInterval(fetchPlan, 3000);
    return () => clearInterval(interval);
  }, []);

  const recommended = plan?.recommended_option;
  const options = plan?.options ?? [];

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case "CRITICAL":
      case "HIGH":
        return "bg-rose-500/20 text-rose-400 border-rose-500/40";
      case "MEDIUM":
        return "bg-amber-500/20 text-amber-400 border-amber-500/40";
      default:
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
    }
  };

  return (
    <div className="bg-[#282830] rounded-3xl p-6 border border-[#303038] space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#303038]">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#B6FF4A]" />
            <h3 className="text-lg font-bold text-[#F5F5F5]">
              Module 7: Recovery Strategy Planner
            </h3>
          </div>
          <p className="text-xs text-[#A0A0A8] mt-1">
            Generates, compares, and ranks candidate remediation strategies based on recovery confidence, technical risk, and SLA.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="bg-[#1E1E24] border-[#3A3A42] text-[#F5F5F5] hover:bg-[#2F2F38] text-xs h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Evaluate Options
          </Button>
        </div>
      </div>

      {/* Primary Recommended Action Callout */}
      {recommended ? (
        <div className="bg-gradient-to-br from-[#1E1E24] to-[#252530] p-6 rounded-2xl border border-[#B6FF4A]/40 shadow-[0_8px_30px_rgb(0,0,0,0.2)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#303038]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#B6FF4A]/15 border border-[#B6FF4A]/40 flex items-center justify-center text-[#B6FF4A] shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#B6FF4A] uppercase tracking-widest block">
                  Top Recommended Remediation Strategy
                </span>
                <h4 className="text-base font-extrabold text-[#F5F5F5]">
                  {recommended.action_name}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono font-bold bg-[#B6FF4A]/20 text-[#B6FF4A] px-3 py-1 rounded-full border border-[#B6FF4A]/40">
                Confidence: {recommended.confidence_pct}%
              </span>
              <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${getRiskBadgeColor(recommended.risk_level)}`}>
                Risk: {recommended.risk_level}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-[#1E1E24] p-3.5 rounded-xl border border-[#303038]">
              <span className="text-[#A0A0A8] text-[11px] block">Target Tool Call</span>
              <code className="text-[#B6FF4A] font-mono font-semibold text-xs block mt-1">
                {recommended.tool_name}({JSON.stringify(recommended.kwargs)})
              </code>
            </div>

            <div className="bg-[#1E1E24] p-3.5 rounded-xl border border-[#303038]">
              <span className="text-[#A0A0A8] text-[11px] block">Estimated Recovery SLA</span>
              <div className="flex items-center gap-1.5 mt-1 font-semibold text-[#F5F5F5]">
                <Clock className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span>{recommended.estimated_time_seconds} seconds</span>
              </div>
            </div>

            <div className="bg-[#1E1E24] p-3.5 rounded-xl border border-[#303038]">
              <span className="text-[#A0A0A8] text-[11px] block">Tradeoff Summary</span>
              <p className="text-[#F5F5F5] text-xs mt-1 leading-snug">
                {recommended.tradeoff_summary}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#1E1E24] p-6 rounded-2xl border border-[#303038] text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-[#B6FF4A] mx-auto" />
          <h4 className="text-sm font-bold text-[#F5F5F5]">System Nominal — No Active Recovery Plan Required</h4>
          <p className="text-xs text-[#A0A0A8]">All backend containers and services operating within normal baseline limits.</p>
        </div>
      )}

      {/* Candidate Strategy Comparison Cards */}
      {options.length > 0 && (
        <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#303038] space-y-4">
          <h4 className="text-xs font-bold text-[#A0A0A8] uppercase tracking-wider flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[#3B82F6]" />
            Permitted Candidate Recovery Options & Evaluation Matrix
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {options.map((opt) => {
              const isTop = opt.id === recommended?.id;
              return (
                <div
                  key={opt.id}
                  className={`bg-[#282830] p-4 rounded-xl border transition-all flex flex-col justify-between space-y-4 ${
                    isTop
                      ? "border-[#B6FF4A]/60 shadow-[0_0_20px_rgba(182,255,74,0.1)]"
                      : "border-[#303038]"
                  }`}
                >
                  {/* Card Header */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isTop
                            ? "bg-[#B6FF4A]/20 text-[#B6FF4A] border-[#B6FF4A]/40"
                            : "bg-[#1E1E24] text-[#A0A0A8] border-[#303038]"
                        }`}
                      >
                        Option {opt.rank} {isTop ? "★ RECOMMENDED" : ""}
                      </span>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRiskBadgeColor(
                          opt.risk_level
                        )}`}
                      >
                        {opt.risk_level} RISK
                      </span>
                    </div>

                    <h5 className="text-sm font-bold text-[#F5F5F5] leading-snug">
                      {opt.action_name}
                    </h5>

                    <code className="text-[11px] font-mono text-[#3B82F6] block bg-[#1E1E24] px-2 py-1 rounded border border-[#303038]">
                      {opt.tool_name}({JSON.stringify(opt.kwargs)})
                    </code>
                  </div>

                  {/* Meter Bars */}
                  <div className="space-y-2 pt-2 border-t border-[#303038]">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#A0A0A8]">Recovery Confidence</span>
                        <span className="text-[#F5F5F5] font-bold">{opt.confidence_pct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1E1E24] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#B6FF4A] rounded-full transition-all"
                          style={{ width: `${opt.confidence_pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-[11px] pt-1">
                      <span className="text-[#A0A0A8]">Estimated Time</span>
                      <span className="text-[#F5F5F5] font-mono font-semibold">{opt.estimated_time_seconds}s SLA</span>
                    </div>
                  </div>

                  {/* Pros / Cons Lists */}
                  <div className="space-y-2 text-xs pt-2 border-t border-[#303038]">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Pros</span>
                      {opt.pros.map((pro, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-[11px] text-[#F5F5F5]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{pro}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Cons / Risks</span>
                      {opt.cons.map((con, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-[11px] text-[#A0A0A8]">
                          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <span>{con}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sentinel Selection Rationale */}
      {plan?.selection_reasoning && plan.selection_reasoning.length > 0 && (
        <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#303038] space-y-3">
          <h4 className="text-xs font-bold text-[#A0A0A8] uppercase tracking-wider flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-[#B6FF4A]" />
            Sentinel Comparative Strategy Selection Rationale
          </h4>

          <div className="space-y-2">
            {plan.selection_reasoning.map((reason, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 bg-[#282830] p-3 rounded-xl border border-[#303038]"
              >
                <div className="w-5 h-5 rounded-full bg-[#1E1E24] border border-[#3A3A42] flex items-center justify-center text-[10px] font-bold text-[#B6FF4A] shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <p className="text-xs text-[#F5F5F5] leading-relaxed">{reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
