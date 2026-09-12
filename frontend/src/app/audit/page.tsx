"use client";

import React from "react";
import { useSentinel } from "@/context/SentinelContext";
import { IncidentHistory } from "@/components/sentinel/IncidentHistory";
import { History, Shield, FileText, CheckCircle2, Lock } from "lucide-react";

export default function AuditPage() {
  const { data } = useSentinel();
  const approvals = data?.pending_approvals || [];
  const logs = data?.incident_logs || [];

  const resolvedApprovalsCount = approvals.filter((a) => a.status !== "PENDING").length;
  const auditLogsCount = logs.filter((l) => l.message.includes("AUDIT EVENT") || l.message.includes("System Recovered")).length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#303038]">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#00D068] mb-1">
            <History className="w-3.5 h-3.5" />
            <span>Immutable Compliance & Audit Records</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F5]">
            Audit Trail & Event History
          </h1>
          <p className="text-xs sm:text-sm text-[#A0A0A8] mt-1">
            Tamper-evident logs of human operator interventions, policy evaluations, and autonomous remediation events.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-xs font-mono-tech text-[#A0A0A8] bg-[#181820] border border-[#303038] px-3 py-1.5 rounded-xl">
            <span>{resolvedApprovalsCount} Approvals // {auditLogsCount} Milestones</span>
          </div>
        </div>
      </div>

      {/* Primary Audit Ledger Component */}
      <IncidentHistory approvals={approvals} logs={logs} />

      {/* Compliance & Governance Summary Card */}
      <div className="bg-[#282830] rounded-2xl p-6 border border-[#303038] space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F5]">
          <Shield className="w-4 h-4 text-[#00D068]" />
          <span>Enterprise Audit & Traceability Standard</span>
        </div>
        <p className="text-xs text-[#A0A0A8] leading-relaxed">
          Every decision rendered by a human operator (APPROVE / REJECT) and every recovery milestone dispatched by Sentinel is assigned an immutable approval ID and ISO 8601 timestamp. Audit events are recorded to the in-memory bounded ring buffer and Fastify telemetry stream.
        </p>
      </div>
    </div>
  );
}
