"use client";

import React, { useState, useEffect } from "react";
import { Activity, Cpu, HardDrive, Clock, ShieldAlert, Terminal, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ObservabilityEvidence {
  timestamp: string;
  service_state: string;
  services: {
    "sentinel-db": { status: string; connection?: string };
    "dummy-api": { status: string; latency_ms?: number; error_rate?: string };
    "sentinel-backend": { status: string; latency_ms?: number };
  };
  metrics: {
    total_requests: number;
    error_count: number;
    error_rate_pct: number;
    avg_response_time_ms: number;
    cpu_usage_pct: number;
    memory_usage_mb: number;
  };
  recent_logs: Array<{ timestamp: string; level: string; message: string }>;
}

export function ObservabilityPanel() {
  const [evidence, setEvidence] = useState<ObservabilityEvidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<"ALL" | "ERROR" | "INFO">("ALL");

  const fetchEvidence = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/observability/evidence");
      if (res.ok) {
        const data = await res.json();
        setEvidence(data);
      }
    } catch {
      // Ignore network polling errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidence();
    const interval = setInterval(fetchEvidence, 2500);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = (evidence?.recent_logs || []).filter((log) => {
    if (logFilter === "ERROR") return log.level === "ERROR" || log.level === "WARNING";
    if (logFilter === "INFO") return log.level === "INFO";
    return true;
  });

  return (
    <div className="bg-[#282830] rounded-3xl p-6 border border-[#303038] space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#303038]">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#B6FF4A]" />
            <h3 className="text-lg font-bold text-[#F5F5F5]">
              Module 2: Observability & Monitoring Engine
            </h3>
          </div>
          <p className="text-xs text-[#A0A0A8] mt-1">
            Real-time evidence collector: Health checks, application/container logs, latency, error rates, CPU & memory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#B6FF4A]/10 text-[#B6FF4A] border border-[#B6FF4A]/20">
            Evidence Stream Active
          </span>
          <Button variant="outline" size="sm" onClick={fetchEvidence} isLoading={loading} className="text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Metric 1: Error Rate % */}
        <div className="p-4 rounded-2xl bg-[#181820] border border-[#303038] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#A0A0A8]">
            <span>API Error Rate</span>
            <AlertTriangle className="w-3.5 h-3.5 text-[#FF5C5C]" />
          </div>
          <div className={`text-xl font-bold font-mono-tech ${
            (evidence?.metrics?.error_rate_pct || 0) > 30 ? "text-[#FF5C5C]" : "text-[#58DC9C]"
          }`}>
            {evidence?.metrics?.error_rate_pct ?? 0}%
          </div>
          <p className="text-[10px] text-[#A0A0A8]">
            {evidence?.metrics?.error_count ?? 0} errors / {evidence?.metrics?.total_requests ?? 0} requests
          </p>
        </div>

        {/* Metric 2: Avg Response Time */}
        <div className="p-4 rounded-2xl bg-[#181820] border border-[#303038] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#A0A0A8]">
            <span>Response Time</span>
            <Clock className="w-3.5 h-3.5 text-[#B6FF4A]" />
          </div>
          <div className="text-xl font-bold font-mono-tech text-[#F5F5F5]">
            {evidence?.metrics?.avg_response_time_ms ?? 0} ms
          </div>
          <p className="text-[10px] text-[#A0A0A8]">Rolling latency average</p>
        </div>

        {/* Metric 3: CPU Load % */}
        <div className="p-4 rounded-2xl bg-[#181820] border border-[#303038] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#A0A0A8]">
            <span>Process CPU</span>
            <Cpu className="w-3.5 h-3.5 text-[#00D068]" />
          </div>
          <div className="text-xl font-bold font-mono-tech text-[#F5F5F5]">
            {evidence?.metrics?.cpu_usage_pct ?? 0}%
          </div>
          <p className="text-[10px] text-[#A0A0A8]">Node.js CPU load</p>
        </div>

        {/* Metric 4: Memory MB */}
        <div className="p-4 rounded-2xl bg-[#181820] border border-[#303038] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#A0A0A8]">
            <span>RAM Memory</span>
            <HardDrive className="w-3.5 h-3.5 text-[#FFB800]" />
          </div>
          <div className="text-xl font-bold font-mono-tech text-[#F5F5F5]">
            {evidence?.metrics?.memory_usage_mb ?? 0} MB
          </div>
          <p className="text-[10px] text-[#A0A0A8]">RSS Memory footprint</p>
        </div>

        {/* Metric 5: Total Requests */}
        <div className="p-4 rounded-2xl bg-[#181820] border border-[#303038] space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-[#A0A0A8]">
            <span>Request Count</span>
            <Activity className="w-3.5 h-3.5 text-[#B6FF4A]" />
          </div>
          <div className="text-xl font-bold font-mono-tech text-[#F5F5F5]">
            {evidence?.metrics?.total_requests ?? 0}
          </div>
          <p className="text-[10px] text-[#A0A0A8]">Total pings recorded</p>
        </div>
      </div>

      {/* Log Telemetry Viewer */}
      <div className="p-4 rounded-2xl bg-[#181820] border border-[#303038] space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#303038]">
          <span className="text-xs font-semibold text-[#F5F5F5] flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-[#B6FF4A]" />
            Application & Container Log Telemetry Stream
          </span>
          <div className="flex items-center gap-1">
            {(["ALL", "ERROR", "INFO"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setLogFilter(mode)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                  logFilter === mode
                    ? "bg-[#B6FF4A] text-black"
                    : "bg-[#282830] text-[#A0A0A8] hover:text-[#F5F5F5]"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="font-mono-tech text-xs bg-[#101015] rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5 border border-[#282830]">
          {filteredLogs.length === 0 ? (
            <div className="text-[#A0A0A8] text-center py-4">No logs recorded in stream</div>
          ) : (
            filteredLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 leading-relaxed">
                <span className="text-[#A0A0A8] shrink-0 text-[11px]">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                    log.level === "ERROR"
                      ? "bg-[#FF5C5C]/20 text-[#FF5C5C]"
                      : log.level === "WARNING"
                      ? "bg-[#FFB800]/20 text-[#FFB800]"
                      : "bg-[#58DC9C]/20 text-[#58DC9C]"
                  }`}
                >
                  {log.level}
                </span>
                <span className="text-[#F5F5F5]">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
