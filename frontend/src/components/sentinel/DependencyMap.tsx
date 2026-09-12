"use client";

import React, { useState, useEffect } from "react";
import { Network, ArrowDown, ShieldAlert, CheckCircle2, AlertTriangle, Info, Server, Database, Cpu, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ServiceTopologyNode {
  id: string;
  name: string;
  type: "frontend" | "api" | "database" | "cache" | "external";
  is_customer_facing: boolean;
  is_critical: boolean;
  technology: string;
  port?: number;
  depends_on: string[];
  status: string;
  classification: "HEALTHY" | "ROOT_FAILURE" | "DOWNSTREAM_SYMPTOM" | "DEGRADED";
}

interface TopologyData {
  graph: Record<string, ServiceTopologyNode>;
  analysis: {
    root_cause: string | null;
    downstream_symptoms: string[];
  };
}

export function DependencyMap() {
  const [topology, setTopology] = useState<TopologyData | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("dummy-api");

  const fetchTopology = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/topology");
      if (res.ok) {
        const data = await res.json();
        setTopology(data);
      }
    } catch {
      // Ignore network polling errors
    }
  };

  useEffect(() => {
    fetchTopology();
    const interval = setInterval(fetchTopology, 3000);
    return () => clearInterval(interval);
  }, []);

  const selectedNode = topology?.graph[selectedNodeId] || topology?.graph["dummy-api"];

  const getNodeIcon = (type: string) => {
    switch (type) {
      case "frontend":
        return <Layers className="w-4 h-4 text-[#B6FF4A]" />;
      case "api":
        return <Server className="w-4 h-4 text-[#00D068]" />;
      case "database":
        return <Database className="w-4 h-4 text-[#58DC9C]" />;
      case "cache":
        return <Cpu className="w-4 h-4 text-[#FFB800]" />;
      default:
        return <Network className="w-4 h-4 text-[#A0A0A8]" />;
    }
  };

  const getClassificationBadge = (classification: string) => {
    switch (classification) {
      case "ROOT_FAILURE":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#FF5C5C] text-white animate-pulse">
            💥 Root Cause Failure
          </span>
        );
      case "DOWNSTREAM_SYMPTOM":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#FFB800]/20 text-[#FFB800] border border-[#FFB800]/40">
            ⚠️ Downstream Symptom
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[#58DC9C]/15 text-[#58DC9C] border border-[#58DC9C]/30">
            Healthy
          </span>
        );
    }
  };

  return (
    <div className="bg-[#282830] rounded-3xl p-6 border border-[#303038] space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#303038]">
        <div>
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-[#B6FF4A]" />
            <h3 className="text-lg font-bold text-[#F5F5F5]">
              Module 4: Service Dependency & Application Map
            </h3>
          </div>
          <p className="text-xs text-[#A0A0A8] mt-1">
            Directional dependency graph distinguishes root component failures from downstream symptoms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#B6FF4A]/10 text-[#B6FF4A] border border-[#B6FF4A]/20">
            Dependency Map Active
          </span>
        </div>
      </div>

      {/* Main Graph & Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Hierarchical Visual Graph */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#181820] border border-[#303038] space-y-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A8] flex items-center justify-between border-b border-[#303038] pb-3">
            <span>Service Topology Graph</span>
            <span className="text-[11px] text-[#58DC9C] font-mono">
              {topology?.analysis?.root_cause
                ? `Root Outage: ${topology.analysis.root_cause}`
                : "All Systems Operational"}
            </span>
          </div>

          {/* Level 1: Frontend */}
          <div className="flex justify-center">
            {topology?.graph["sentinel-frontend"] && (
              <div
                onClick={() => setSelectedNodeId("sentinel-frontend")}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer w-72 bg-[#282830] space-y-2 hover:border-[#B6FF4A] ${
                  selectedNodeId === "sentinel-frontend" ? "border-[#B6FF4A] ring-1 ring-[#B6FF4A]/30" : "border-[#303038]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#F5F5F5]">
                    {getNodeIcon("frontend")}
                    <span>Sentinel Frontend</span>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#B6FF4A]/20 text-[#B6FF4A]">
                    Customer Facing
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#A0A0A8] font-mono">Next.js :3000</span>
                  {getClassificationBadge(topology.graph["sentinel-frontend"].classification)}
                </div>
              </div>
            )}
          </div>

          {/* Arrow Down 1 */}
          <div className="flex justify-center -my-3">
            <div className="p-1 rounded-full bg-[#282830] border border-[#303038] text-[#B6FF4A]">
              <ArrowDown className="w-4 h-4" />
            </div>
          </div>

          {/* Level 2: Backend API */}
          <div className="flex justify-center">
            {topology?.graph["dummy-api"] && (
              <div
                onClick={() => setSelectedNodeId("dummy-api")}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer w-80 bg-[#282830] space-y-2 hover:border-[#B6FF4A] ${
                  selectedNodeId === "dummy-api" ? "border-[#B6FF4A] ring-1 ring-[#B6FF4A]/30" : "border-[#303038]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#F5F5F5]">
                    {getNodeIcon("api")}
                    <span>Orders REST API (dummy-api)</span>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#FF5C5C]/20 text-[#FF5C5C]">
                    Critical Service
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#A0A0A8] font-mono">FastAPI :8001</span>
                  {getClassificationBadge(topology.graph["dummy-api"].classification)}
                </div>
              </div>
            )}
          </div>

          {/* Arrow Down 2 (Multi Branch) */}
          <div className="flex justify-center -my-3">
            <div className="p-1 rounded-full bg-[#282830] border border-[#303038] text-[#58DC9C]">
              <ArrowDown className="w-4 h-4" />
            </div>
          </div>

          {/* Level 3: Persistence & Dependencies */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {["sentinel-db", "redis-cache", "payment-gateway"].map((id) => {
              const node = topology?.graph[id];
              if (!node) return null;
              return (
                <div
                  key={id}
                  onClick={() => setSelectedNodeId(id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer bg-[#282830] space-y-2 hover:border-[#B6FF4A] ${
                    selectedNodeId === id ? "border-[#B6FF4A] ring-1 ring-[#B6FF4A]/30" : "border-[#303038]"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-[#F5F5F5] truncate">
                    {getNodeIcon(node.type)}
                    <span className="truncate">{node.name}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-[#A0A0A8] font-mono">{node.technology}</span>
                    <div>{getClassificationBadge(node.classification)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Selected Node Inspector */}
        <div className="p-5 rounded-2xl bg-[#181820] border border-[#303038] space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-[#303038] pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A8]">
                Selected Service Inspector
              </span>
              <h4 className="text-base font-bold text-[#F5F5F5] mt-1 flex items-center gap-2">
                {getNodeIcon(selectedNode?.type || "api")}
                {selectedNode?.name || "dummy-api"}
              </h4>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#282830]">
                <span className="text-[#A0A0A8]">Service ID:</span>
                <span className="font-mono text-[#F5F5F5]">{selectedNode?.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#282830]">
                <span className="text-[#A0A0A8]">Technology:</span>
                <span className="text-[#F5F5F5]">{selectedNode?.technology}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#282830]">
                <span className="text-[#A0A0A8]">Customer Facing:</span>
                <span className={selectedNode?.is_customer_facing ? "text-[#B6FF4A]" : "text-[#A0A0A8]"}>
                  {selectedNode?.is_customer_facing ? "YES" : "NO"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#282830]">
                <span className="text-[#A0A0A8]">Criticality:</span>
                <span className={selectedNode?.is_critical ? "text-[#FF5C5C]" : "text-[#58DC9C]"}>
                  {selectedNode?.is_critical ? "CRITICAL" : "NON-CRITICAL"}
                </span>
              </div>
            </div>

            {/* Upstream Dependencies */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-[#A0A0A8] uppercase tracking-wider">
                Upstream Dependencies (Requires):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedNode?.depends_on.length === 0 ? (
                  <span className="text-xs text-[#707078] italic">None (Root persistence layer)</span>
                ) : (
                  selectedNode?.depends_on.map((dep) => (
                    <span key={dep} className="text-xs font-mono bg-[#282830] text-[#F5F5F5] px-2 py-0.5 rounded border border-[#303038]">
                      {dep}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#303038] text-[11px] text-[#A0A0A8] leading-relaxed">
            💡 Sentinel uses this graph to verify if an outage at <code className="text-[#B6FF4A]">{selectedNode?.id}</code> is the root cause or a downstream symptom.
          </div>
        </div>
      </div>
    </div>
  );
}
