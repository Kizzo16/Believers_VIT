"use client";

import React, { useState, useEffect } from "react";
import {
  Zap,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Terminal,
  ShieldCheck,
  Activity,
  Check,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExecutionReceipt } from "@/types/sentinel";

export function ControlledExecutorPanel() {
  const [receipt, setReceipt] = useState<ExecutionReceipt | null>(null);
  const [history, setHistory] = useState<ExecutionReceipt[]>([]);
  const [loading, setLoading] = useState(false);

  // Selected action tool & kwargs state
  const [selectedAction, setSelectedAction] = useState("restart_service_db");

  const actionMap: Record<string, { tool_name: string; kwargs: Record<string, unknown>; label: string }> = {
    restart_service_db: {
      tool_name: "restart_service",
      kwargs: { service: "sentinel-db" },
      label: "restart_service(service='sentinel-db')",
    },
    restart_service_api: {
      tool_name: "restart_service",
      kwargs: { service: "dummy-api" },
      label: "restart_service(service='dummy-api')",
    },
    rollback_config: {
      tool_name: "rollback_configuration",
      kwargs: { service: "dummy-api" },
      label: "rollback_configuration(service='dummy-api')",
    },
    verify_rec: {
      tool_name: "verify_recovery",
      kwargs: { service: "dummy-api" },
      label: "verify_recovery(service='dummy-api')",
    },
    delete_db_test: {
      tool_name: "delete_database",
      kwargs: { db_name: "sentinel" },
      label: "delete_database(db='sentinel') [Destructive Test]",
    },
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/executor/history");
      if (res.ok) {
        const json = await res.json();
        if (json.history) {
          setHistory(json.history.slice().reverse());
          if (json.history.length > 0 && !receipt) {
            setReceipt(json.history[json.history.length - 1]);
          }
        }
      }
    } catch {
      // Ignore network error
    }
  };

  const handleExecuteAction = async () => {
    setLoading(true);
    const target = actionMap[selectedAction];
    try {
      const res = await fetch("http://localhost:8000/api/executor/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_name: target.tool_name,
          kwargs: target.kwargs,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.receipt) {
          setReceipt(json.receipt);
          await fetchHistory();
        }
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 3000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
      case "BLOCKED":
        return "bg-rose-500/20 text-rose-400 border-rose-500/40";
      case "PENDING_APPROVAL":
        return "bg-amber-500/20 text-amber-400 border-amber-500/40";
      default:
        return "bg-blue-500/20 text-blue-400 border-blue-500/40";
    }
  };

  return (
    <div className="bg-[#282830] rounded-3xl p-6 border border-[#303038] space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#303038]">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#B6FF4A]" />
            <h3 className="text-lg font-bold text-[#F5F5F5]">
              Module 9: Controlled Action Executor
            </h3>
          </div>
          <p className="text-xs text-[#A0A0A8] mt-1">
            Performs policy-approved recovery operations in the controlled demo environment, mutating real container state.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHistory}
            disabled={loading}
            className="bg-[#1E1E24] border-[#3A3A42] text-[#F5F5F5] hover:bg-[#2F2F38] text-xs h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh History
          </Button>
        </div>
      </div>

      {/* Action Trigger Selector Bar */}
      <div className="bg-[#1E1E24] p-4 rounded-2xl border border-[#303038] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Terminal className="w-4 h-4 text-[#3B82F6] shrink-0" />
          <div className="space-y-0.5 flex-1">
            <label className="text-[11px] font-bold text-[#A0A0A8] uppercase tracking-wider block">
              Select Permitted Controlled Recovery Tool
            </label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="bg-[#282830] border border-[#303038] text-[#F5F5F5] text-xs font-mono rounded-lg px-3 py-1.5 w-full focus:outline-none focus:border-[#B6FF4A]"
            >
              <option value="restart_service_db">restart_service(service='sentinel-db') [PostgreSQL Recovery]</option>
              <option value="restart_service_api">restart_service(service='dummy-api') [Orders API Recovery]</option>
              <option value="rollback_config">rollback_configuration(service='dummy-api') [Restore Config Baseline]</option>
              <option value="verify_rec">verify_recovery(service='dummy-api') [Health Probe Verification]</option>
              <option value="delete_db_test">delete_database(db='sentinel') [Destructive Test - Expect BLOCKED]</option>
            </select>
          </div>
        </div>

        <Button
          onClick={handleExecuteAction}
          disabled={loading}
          className="bg-[#B6FF4A] hover:bg-[#a2ec34] text-[#181820] font-bold text-xs px-5 py-2 rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1.5"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${loading ? "animate-spin" : ""}`} />
          <span>Dispatch Approved Action</span>
        </Button>
      </div>

      {/* Latest Execution Receipt Callout */}
      {receipt ? (
        <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#303038] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#303038]">
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-[#B6FF4A]" />
              <div>
                <span className="text-[10px] font-mono font-bold text-[#A0A0A8] uppercase tracking-widest block">
                  Execution Receipt #{receipt.execution_id}
                </span>
                <h4 className="text-sm font-bold text-[#F5F5F5] font-mono">
                  {receipt.action_name}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${getStatusBadge(receipt.execution_status)}`}>
                {receipt.execution_status}
              </span>
              {receipt.state_changed && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#B6FF4A]/20 text-[#B6FF4A] border border-[#B6FF4A]/40 flex items-center gap-1">
                  <Check className="w-3 h-3" /> State Changed
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-[#282830] p-3 rounded-xl border border-[#303038]">
              <span className="text-[#A0A0A8] text-[11px] block">Policy Decision</span>
              <span className="font-mono font-bold text-[#F5F5F5] text-xs mt-0.5 block">
                {receipt.policy_decision}
              </span>
            </div>

            <div className="bg-[#282830] p-3 rounded-xl border border-[#303038]">
              <span className="text-[#A0A0A8] text-[11px] block">Effective Risk Level</span>
              <span className="font-mono font-bold text-amber-400 text-xs mt-0.5 block">
                {receipt.effective_risk}
              </span>
            </div>

            <div className="bg-[#282830] p-3 rounded-xl border border-[#303038]">
              <span className="text-[#A0A0A8] text-[11px] block">Execution Timestamp</span>
              <span className="font-mono text-[#F5F5F5] text-xs mt-0.5 block">
                {new Date(receipt.executed_at).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Raw Output Log Console */}
          <div className="bg-[#181820] p-4 rounded-xl border border-[#303038] space-y-1.5 font-mono">
            <span className="text-[10px] font-bold text-[#A0A0A8] uppercase tracking-wider block">
              Real Environment Execution Output Log
            </span>
            <pre className="text-xs text-[#B6FF4A] whitespace-pre-wrap leading-relaxed overflow-x-auto">
              {receipt.execution_result}
            </pre>
          </div>
        </div>
      ) : (
        <div className="bg-[#1E1E24] p-6 rounded-2xl border border-[#303038] text-center space-y-2">
          <Terminal className="w-8 h-8 text-[#A0A0A8] mx-auto" />
          <h4 className="text-sm font-bold text-[#F5F5F5]">No Action Executed in Current Buffer</h4>
          <p className="text-xs text-[#A0A0A8]">Select a permitted recovery action above and click Dispatch to execute.</p>
        </div>
      )}

      {/* Execution Receipts Audit History Table */}
      {history.length > 0 && (
        <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#303038] space-y-3">
          <h4 className="text-xs font-bold text-[#A0A0A8] uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#3B82F6]" />
            Action Execution Receipts History
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#303038] text-[#A0A0A8]">
                  <th className="py-2.5 px-3 font-semibold">Receipt ID</th>
                  <th className="py-2.5 px-3 font-semibold">Action & Tool</th>
                  <th className="py-2.5 px-3 font-semibold">Policy Decision</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">State Changed</th>
                  <th className="py-2.5 px-3 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#303038]/50 text-[#F5F5F5]">
                {history.map((h) => (
                  <tr key={h.execution_id} className="hover:bg-[#282830]/50 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#A0A0A8]">{h.execution_id}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-xs text-[#F5F5F5]">{h.action_name}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#282830] border border-[#303038] font-mono">
                        {h.policy_decision}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getStatusBadge(h.execution_status)}`}>
                        {h.execution_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${h.state_changed ? "bg-[#B6FF4A]/20 text-[#B6FF4A]" : "text-[#A0A0A8]"}`}>
                        {h.state_changed ? "YES" : "NO"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#A0A0A8] font-mono text-[11px]">
                      {new Date(h.executed_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
