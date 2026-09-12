"use client";

import React, { useState } from "react";
import { VerificationCheck, VerificationReport } from "@/types/sentinel";

interface RecoveryVerificationPanelProps {
  report: VerificationReport | null | undefined;
  onVerifyRequested?: () => void;
}

export const RecoveryVerificationPanel: React.FC<RecoveryVerificationPanelProps> = ({
  report,
  onVerifyRequested,
}) => {
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerifyClick = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch("http://localhost:8000/api/verification/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        if (onVerifyRequested) {
          onVerifyRequested();
        }
      }
    } catch (err) {
      console.error("Verification trigger failed:", err);
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusBadge = (status: VerificationReport["recovery_status"]) => {
    switch (status) {
      case "VERIFIED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            RECOVERY VERIFIED ✓
          </span>
        );
      case "PARTIAL":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            PARTIAL RECOVERY
          </span>
        );
      case "FAILED":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            VERIFICATION FAILED ✗
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur-md transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 text-xl">🛡️</span>
            <h2 className="text-lg font-bold text-slate-100 tracking-wide">
              Module 10 — Recovery Verification Engine
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Empirical post-action telemetry check verifying system restoration before incident closure.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {report && getStatusBadge(report.recovery_status)}
          <button
            onClick={handleVerifyClick}
            disabled={isVerifying}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50 flex items-center gap-2"
          >
            {isVerifying ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Verifying Telemetry...
              </>
            ) : (
              <>
                <span>🔍</span> Run Live Telemetry Check
              </>
            )}
          </button>
        </div>
      </div>

      {!report ? (
        <div className="text-center py-8 bg-slate-950/40 rounded-lg border border-slate-800/80">
          <p className="text-sm text-slate-400">
            No recovery verification has been conducted yet. Execute a recovery action or run a manual telemetry check above.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Executive Summary Container */}
          <div
            className={`p-4 rounded-lg border ${
              report.recovery_status === "VERIFIED"
                ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-200"
                : "bg-rose-950/20 border-rose-500/20 text-rose-200"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold opacity-75">
                  Verification Summary
                </span>
                <p className="text-sm font-medium mt-1">{report.summary}</p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {new Date(report.verified_at).toLocaleTimeString()}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs opacity-90 border-t border-slate-800/60 pt-2">
              <div>
                <span className="text-slate-400">Target Action:</span>{" "}
                <span className="font-mono text-indigo-300">{report.action_executed}</span>
              </div>
              {report.incident_id && (
                <div>
                  <span className="text-slate-400">Incident ID:</span>{" "}
                  <span className="font-mono text-indigo-300">#{report.incident_id}</span>
                </div>
              )}
            </div>
          </div>

          {/* Checklist Items Grid */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Post-Action Verification Checklist
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {report.checks.map((check: VerificationCheck) => (
                <div
                  key={check.id}
                  className={`p-3.5 rounded-lg border transition-all ${
                    check.passed
                      ? "bg-slate-950/60 border-emerald-500/20"
                      : "bg-rose-950/20 border-rose-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                          check.passed
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                        }`}
                      >
                        {check.passed ? "✓" : "✗"}
                      </span>
                      {check.name}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        check.passed
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {check.status_text}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 pl-6">{check.details}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Telemetry Evidence Notes */}
          {report.reasoning && report.reasoning.length > 0 && (
            <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Empirical Telemetry Evidence
              </h4>
              <ul className="space-y-1 text-xs font-mono text-slate-300">
                {report.reasoning.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="text-slate-500">&gt;</span>
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
