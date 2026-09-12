"use client";

import React, { useState } from "react";
import { ReInvestigationReport } from "@/types/sentinel";

interface ReinvestigationPanelProps {
  report: ReInvestigationReport | null | undefined;
  onReinvestigateRequested?: () => void;
  openApprovalModal?: (id?: string) => void;
}

export const ReinvestigationPanel: React.FC<ReinvestigationPanelProps> = ({
  report,
  onReinvestigateRequested,
  openApprovalModal,
}) => {
  const [isReinvestigating, setIsReinvestigating] = useState(false);

  const handleReinvestigateClick = async () => {
    setIsReinvestigating(true);
    try {
      const res = await fetch("http://localhost:8000/api/reinvestigation/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        if (onReinvestigateRequested) {
          onReinvestigateRequested();
        }
      }
    } catch (err) {
      console.error("Reinvestigation trigger failed:", err);
    } finally {
      setIsReinvestigating(false);
    }
  };

  const getStepBadge = (nextStep: ReInvestigationReport["next_step"]) => {
    switch (nextStep) {
      case "ESCALATE_TO_HUMAN":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 border border-rose-500/35 text-rose-400 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            🚨 ESCALATED TO HUMAN OPERATOR
          </span>
        );
      case "ROLLBACK":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 border border-indigo-500/35 text-indigo-300">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            🔄 ROLLBACK CONFIGURATION
          </span>
        );
      case "ALTERNATIVE_ACTION":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-500/35 text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            ⚡ ALTERNATIVE RECOVERY ACTION
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur-md transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-xl">🔄</span>
            <h2 className="text-lg font-bold text-slate-100 tracking-wide">
              Module 11 — Re-Investigation, Rollback & Escalation
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Adapts root-cause hypothesis post-failure, selects non-duplicate recovery alternatives, and halts loops via human escalation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {report && getStepBadge(report.next_step)}
          <button
            onClick={handleReinvestigateClick}
            disabled={isReinvestigating}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-lg shadow-amber-900/30 disabled:opacity-50 flex items-center gap-2"
          >
            {isReinvestigating ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Re-Diagnosing...
              </>
            ) : (
              <>
                <span>🔬</span> Trigger Re-Diagnosis
              </>
            )}
          </button>
        </div>
      </div>

      {!report ? (
        <div className="text-center py-8 bg-slate-950/40 rounded-lg border border-slate-800/80">
          <p className="text-sm text-slate-400">
            No re-investigation has been triggered. Module 11 will automatically execute if a post-action telemetry check fails verification.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Attempt Counter & Status Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-4 rounded-lg border border-slate-800">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded bg-slate-800 text-xs font-mono font-bold text-slate-200 border border-slate-700">
                Attempt {report.attempt_number} of {report.max_attempts}
              </span>
              <span className="text-xs text-slate-400">
                Previous Action: <span className="font-mono text-amber-300">{report.previous_action}</span> (
                <span className="text-rose-400 font-semibold">{report.verification_status}</span>)
              </span>
            </div>

            <span className="text-xs text-slate-500 font-mono">
              Re-diagnosed: {new Date(report.reinvestigated_at).toLocaleTimeString()}
            </span>
          </div>

          {/* Human Escalation Alert (If Next Step is ESCALATE_TO_HUMAN) */}
          {report.next_step === "ESCALATE_TO_HUMAN" && (
            <div className="p-5 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-200 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🚨</span>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-rose-300">
                      Autonomous Remediation Halted — Human SRE Operator Escalation Required
                    </h3>
                    <p className="text-xs text-rose-200/90 mt-1">
                      {report.escalation_reason || "Autonomous recovery limits reached. System secured to prevent loop execution."}
                    </p>
                  </div>
                </div>

                {openApprovalModal && (
                  <button
                    onClick={() => openApprovalModal()}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shrink-0"
                  >
                    Open Review Queue ➔
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Adaptive Diagnosis & Next Recommendation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Updated Root-Cause Card */}
            <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Adapted Root Cause Hypothesis
                </span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  Confidence: {report.updated_confidence}%
                </span>
              </div>
              <p className="text-sm font-medium text-slate-200">{report.updated_root_cause}</p>
              <div className="mt-3 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                <span>Attempted Actions History: </span>
                <span className="font-mono text-slate-300">
                  {report.attempted_actions_history.length > 0
                    ? report.attempted_actions_history.join(", ")
                    : "None"}
                </span>
              </div>
            </div>

            {/* Recommended Alternative Option / Rollback */}
            <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Recommended Recovery Strategy
                </span>
                {report.recommended_option && (
                  <span className="text-xs font-mono font-bold text-indigo-400">
                    Risk: {report.recommended_option.risk_level}
                  </span>
                )}
              </div>

              {report.recommended_option ? (
                <div>
                  <p className="text-sm font-mono font-semibold text-indigo-300">
                    {report.recommended_option.action_name}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {report.recommended_option.tradeoff_summary}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No automated recovery action recommended. Human operator intervention active.
                </p>
              )}
            </div>
          </div>

          {/* Adaptive Reasoning Audit Log */}
          {report.adaptive_reasoning && report.adaptive_reasoning.length > 0 && (
            <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Adaptive Decision Reasoning Trail
              </h4>
              <ul className="space-y-1 text-xs font-mono text-slate-300">
                {report.adaptive_reasoning.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold">&gt;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
