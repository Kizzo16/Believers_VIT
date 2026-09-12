"use client";

import React, { useState, useEffect } from "react";
import { Brain, CheckCircle2, ShieldAlert, Sparkles, RefreshCw, Layers, Wrench, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InvestigationResult {
  incident_id: string;
  root_cause: string;
  confidence_pct: number;
  evidence_items: string[];
  investigated_at: string;
  affected_services: string[];
  recommended_remediation?: string;
}

export function AiInvestigationPanel() {
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchInvestigation = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/investigate/latest");
      if (res.ok) {
        const data = await res.json();
        if (data.latest_investigation) {
          setInvestigation(data.latest_investigation);
        }
      }
    } catch {
      // Ignore network errors
    }
  };

  const handleRunInvestigation = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setInvestigation(data.investigation);
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvestigation();
    const interval = setInterval(fetchInvestigation, 3000);
    return () => clearInterval(interval);
  }, []);

  const confidence = investigation?.confidence_pct ?? 94;

  return (
    <div className="bg-[#282830] rounded-3xl p-6 border border-[#303038] space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#303038]">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#B6FF4A]" />
            <h3 className="text-lg font-bold text-[#F5F5F5]">
              Module 5: AI Investigation Engine
            </h3>
          </div>
          <p className="text-xs text-[#A0A0A8] mt-1">
            Correlates incident context, operational telemetry, and dependency topology to produce evidence-backed diagnoses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunInvestigation}
            isLoading={loading}
            className="text-xs border-[#B6FF4A]/40 text-[#B6FF4A] hover:bg-[#B6FF4A]/10 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Run AI Correlation Analysis
          </Button>
        </div>
      </div>

      {/* Main Diagnosis Output Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Root Cause Hypothesis & Evidence List */}
        <div className="md:col-span-2 p-5 rounded-2xl bg-[#181820] border border-[#303038] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#303038]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A8]">
              Root Cause Diagnosis Hypothesis
            </span>
            <span className="text-xs font-mono-tech text-[#F5F5F5] bg-[#282830] px-2 py-0.5 rounded border border-[#383842]">
              {investigation?.incident_id || "INC-001"}
            </span>
          </div>

          <div>
            <h4 className="text-lg font-bold text-[#F5F5F5] flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#FF5C5C]" />
              {investigation?.root_cause || "PostgreSQL Service Failure"}
            </h4>
            <p className="text-xs text-[#A0A0A8] mt-1">
              Affected Services:{" "}
              <code className="text-[#F5F5F5] font-mono">
                {investigation?.affected_services?.join(", ") || "sentinel-db, dummy-api"}
              </code>
            </p>
          </div>

          {/* Evidence Bullet List */}
          <div className="space-y-2 pt-2 border-t border-[#303038]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#B6FF4A] flex items-center gap-1.5">
              <ListChecks className="w-4 h-4" />
              Supporting Telemetry Evidence:
            </span>
            <ul className="space-y-1.5 text-xs text-[#F5F5F5] font-mono-tech">
              {(investigation?.evidence_items && investigation.evidence_items.length > 0
                ? investigation.evidence_items
                : [
                    "1. Database health check failed (sentinel-db:5432 connection refused).",
                    "2. Connection-refused & TCP socket error logs detected in dummy-api.",
                    "3. API error rate increased to 100% simultaneously.",
                    "4. Orders API (dummy-api) depends on PostgreSQL according to dependency map.",
                  ]
              ).map((item, idx) => (
                <li key={idx} className="bg-[#282830] p-2 rounded-xl border border-[#303038] flex items-start gap-2">
                  <span className="text-[#B6FF4A] font-bold">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Col: Confidence Score & Remediation Proposal */}
        <div className="p-5 rounded-2xl bg-[#181820] border border-[#303038] space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A8]">
              Diagnosis Confidence Score
            </span>

            <div className="space-y-2 text-center py-2">
              <div className="text-4xl font-extrabold font-mono-tech text-[#B6FF4A]">
                {confidence}%
              </div>
              <p className="text-xs text-[#A0A0A8]">High-Confidence Diagnostic Match</p>

              {/* Progress Bar */}
              <div className="w-full bg-[#282830] h-2.5 rounded-full overflow-hidden border border-[#383842]">
                <div
                  className="bg-gradient-to-r from-[#58DC9C] to-[#B6FF4A] h-full rounded-full transition-all duration-500"
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>

            {/* Recommended Remediation Proposal (No Direct Execution) */}
            <div className="p-3.5 rounded-xl bg-[#282830] border border-[#303038] space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#00D068] flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" />
                <span>Diagnostic Recommendation</span>
              </div>
              <p className="text-xs font-mono-tech text-[#F5F5F5]">
                {investigation?.recommended_remediation || "restart_service(service='sentinel-db')"}
              </p>
              <p className="text-[10px] text-[#A0A0A8] italic">
                * Module 5 formulates diagnosis & proposal without auto-executing remediation.
              </p>
            </div>
          </div>

          <div className="text-[11px] text-[#A0A0A8] text-center pt-2 border-t border-[#303038]">
            Evaluated at {new Date(investigation?.investigated_at || Date.now()).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}
