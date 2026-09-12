"use client";

import React, { useState, useEffect } from "react";
import {
  Flame,
  RefreshCw,
  AlertTriangle,
  Users,
  ShieldAlert,
  Layers,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Activity,
  Server
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlastRadiusAnalysis } from "@/types/sentinel";

export function BlastRadiusPanel() {
  const [data, setData] = useState<BlastRadiusAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBlastRadius = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/impact/blast-radius");
      if (res.ok) {
        const json = await res.json();
        if (json.blast_radius) {
          setData(json.blast_radius);
        }
      }
    } catch {
      // Ignore network errors
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await fetchBlastRadius();
    setLoading(false);
  };

  useEffect(() => {
    fetchBlastRadius();
    const interval = setInterval(fetchBlastRadius, 3000);
    return () => clearInterval(interval);
  }, []);

  const blastLevel = data?.blast_radius_level ?? "NONE";
  const customerImpact = data?.customer_impact ?? "NONE";
  const isCriticalPath = data?.critical_path_affected ?? false;
  const affectedCount = data?.affected_services_count ?? 0;

  const getBlastBadgeColor = (level: string) => {
    switch (level) {
      case "CRITICAL":
      case "HIGH":
        return "bg-rose-500/20 text-rose-400 border-rose-500/40";
      case "MEDIUM":
        return "bg-amber-500/20 text-amber-400 border-amber-500/40";
      case "LOW":
        return "bg-blue-500/20 text-blue-400 border-blue-500/40";
      default:
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
    }
  };

  const getCustomerBadgeColor = (impact: string) => {
    switch (impact) {
      case "HIGH":
        return "bg-rose-500/20 text-rose-400 border-rose-500/40";
      case "MEDIUM":
        return "bg-amber-500/20 text-amber-400 border-amber-500/40";
      case "LOW":
        return "bg-blue-500/20 text-blue-400 border-blue-500/40";
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
            <Flame className="w-5 h-5 text-[#FF5E5E]" />
            <h3 className="text-lg font-bold text-[#F5F5F5]">
              Module 6: Impact / Blast-Radius Analysis
            </h3>
          </div>
          <p className="text-xs text-[#A0A0A8] mt-1">
            Determines failure propagation depth, direct vs. downstream service disruption, and critical business path risk.
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
            Re-evaluate Impact
          </Button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Affected Services Count */}
        <div className="bg-[#1E1E24] p-4 rounded-2xl border border-[#303038] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A0A0A8]">Affected Services</span>
            <Layers className="w-4 h-4 text-[#3B82F6]" />
          </div>
          <div className="text-2xl font-black text-[#F5F5F5]">
            {affectedCount}
          </div>
          <p className="text-[11px] text-[#A0A0A8]">
            {data?.directly_affected_services?.length ?? 0} direct, {data?.indirectly_affected_services?.length ?? 0} indirect
          </p>
        </div>

        {/* Customer Impact */}
        <div className="bg-[#1E1E24] p-4 rounded-2xl border border-[#303038] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A0A0A8]">Customer Impact</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getCustomerBadgeColor(
                customerImpact
              )}`}
            >
              {customerImpact}
            </span>
          </div>
          <p className="text-[11px] text-[#A0A0A8]">
            {customerImpact === "HIGH"
              ? "End-user apps severely impacted"
              : customerImpact === "MEDIUM"
              ? "Partial user functionality degraded"
              : "No customer disruption"}
          </p>
        </div>

        {/* Critical Path Affected */}
        <div className="bg-[#1E1E24] p-4 rounded-2xl border border-[#303038] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A0A0A8]">Critical Path</span>
            <ShieldAlert className="w-4 h-4 text-[#FFAE42]" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                isCriticalPath
                  ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                  : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
              }`}
            >
              {isCriticalPath ? "YES" : "NO"}
            </span>
          </div>
          <p className="text-[11px] text-[#A0A0A8]">
            {isCriticalPath
              ? "Core database/API path compromised"
              : "Non-critical auxiliary path standard"}
          </p>
        </div>

        {/* Overall Blast Radius */}
        <div className="bg-[#1E1E24] p-4 rounded-2xl border border-[#303038] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A0A0A8]">Blast Radius</span>
            <Flame className="w-4 h-4 text-[#FF5E5E]" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${getBlastBadgeColor(
                blastLevel
              )}`}
            >
              {blastLevel}
            </span>
          </div>
          <p className="text-[11px] text-[#A0A0A8]">
            Overall incident risk classification
          </p>
        </div>
      </div>

      {/* Direct vs Indirect Traversal Box */}
      <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#303038] space-y-4">
        <h4 className="text-xs font-bold text-[#A0A0A8] uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#B6FF4A]" />
          Dependency Traversal & Disruption Propagation Map
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Directly Affected Services */}
          <div className="bg-[#282830] p-4 rounded-xl border border-rose-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Directly Affected Services (Root Cause)
              </span>
              <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full font-bold">
                {data?.directly_affected_services?.length ?? 0}
              </span>
            </div>
            {data?.directly_affected_services && data.directly_affected_services.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                {data.directly_affected_services.map((id) => (
                  <div key={id} className="flex items-center justify-between bg-[#1E1E24] px-3 py-2 rounded-lg border border-[#3A3A42]">
                    <span className="text-xs font-mono text-[#F5F5F5] font-semibold">{id}</span>
                    <span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded font-mono">
                      ROOT_FAILURE
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#A0A0A8] italic pt-1">No directly failed services detected.</p>
            )}
          </div>

          {/* Indirectly Affected Services */}
          <div className="bg-[#282830] p-4 rounded-xl border border-amber-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Indirectly Affected Services (Downstream Symptoms)
              </span>
              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                {data?.indirectly_affected_services?.length ?? 0}
              </span>
            </div>
            {data?.indirectly_affected_services && data.indirectly_affected_services.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                {data.indirectly_affected_services.map((id) => (
                  <div key={id} className="flex items-center justify-between bg-[#1E1E24] px-3 py-2 rounded-lg border border-[#3A3A42]">
                    <span className="text-xs font-mono text-[#F5F5F5] font-semibold">{id}</span>
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-mono">
                      PROPAGATED
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#A0A0A8] italic pt-1">No downstream propagated disruptions detected.</p>
            )}
          </div>
        </div>
      </div>

      {/* Service Impact Matrix Table */}
      <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#303038] space-y-3">
        <h4 className="text-xs font-bold text-[#A0A0A8] uppercase tracking-wider flex items-center gap-2">
          <Server className="w-4 h-4 text-[#3B82F6]" />
          Predefined Service Criticality & Impact Detail
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#303038] text-[#A0A0A8]">
                <th className="py-2.5 px-3 font-semibold">Service Name</th>
                <th className="py-2.5 px-3 font-semibold">Customer Facing</th>
                <th className="py-2.5 px-3 font-semibold">Critical Path</th>
                <th className="py-2.5 px-3 font-semibold">Impact Status</th>
                <th className="py-2.5 px-3 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#303038]/50 text-[#F5F5F5]">
              {data?.service_impacts && data.service_impacts.length > 0 ? (
                data.service_impacts.map((service) => (
                  <tr key={service.id} className="hover:bg-[#282830]/50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-xs">{service.name}</div>
                      <div className="text-[10px] text-[#A0A0A8] font-mono">{service.id}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          service.is_customer_facing
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                            : "bg-gray-500/10 text-[#A0A0A8]"
                        }`}
                      >
                        {service.is_customer_facing ? "YES" : "NO"}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          service.is_critical
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-gray-500/10 text-[#A0A0A8]"
                        }`}
                      >
                        {service.is_critical ? "YES" : "NO"}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          service.status === "ROOT_FAILURE"
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                            : service.status === "PROPAGATED_OUTAGE"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        }`}
                      >
                        {service.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#A0A0A8] text-xs max-w-xs truncate">
                      {service.impact_description}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-[#A0A0A8] italic">
                    Loading impact matrix...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Impact Reasoning Trail */}
      <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#303038] space-y-3">
        <h4 className="text-xs font-bold text-[#A0A0A8] uppercase tracking-wider flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[#B6FF4A]" />
          Sentinel Impact Reasoning Chain
        </h4>

        {data?.reasoning && data.reasoning.length > 0 ? (
          <div className="space-y-2">
            {data.reasoning.map((step, idx) => (
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
          <p className="text-xs text-[#A0A0A8] italic">No active impact reasoning recorded.</p>
        )}
      </div>
    </div>
  );
}
