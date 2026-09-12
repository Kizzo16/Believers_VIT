"use client";

import React from "react";
import { useSentinel } from "@/context/SentinelContext";
import { SafetyRadar } from "@/components/sentinel/SafetyRadar";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Clock,
  Shield,
  Check,
  X,
} from "lucide-react";

export default function GovernancePage() {
  const {
    data,
    handleApproveAction,
    handleRejectAction,
    isSubmittingApproval,
  } = useSentinel();

  const policies = data?.policies;
  const pendingApprovals = data?.pending_approvals?.filter((p) => p.status === "PENDING") || [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#303038]">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#00D068] mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Deterministic Guardrails & Policy Matrix</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F5]">
            Safety & Governance Gate
          </h1>
          <p className="text-xs sm:text-sm text-[#A0A0A8] mt-1">
            Multi-stage validation pipeline preventing unconstrained AI execution via strict Zod schemas and deterministic policy gates.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span
            className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full border ${
              pendingApprovals.length > 0
                ? "bg-[#B6FF4A]/15 text-[#B6FF4A] border-[#B6FF4A]/35 animate-pulse"
                : "bg-[#00D068]/10 text-[#00D068] border-[#00D068]/25"
            }`}
          >
            {pendingApprovals.length > 0
              ? `${pendingApprovals.length} Action Pending Review`
              : "Zero Pending Authorizations"}
          </span>
        </div>
      </div>

      {/* Pending Human Approval Queue (If Actions Intercepted) */}
      {pendingApprovals.length > 0 && (
        <div className="bg-[#282830] rounded-3xl p-6 sm:p-7 border border-[#B6FF4A]/40 shadow-[0_16px_40px_-15px_rgba(182,255,74,0.15)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#303038]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#B6FF4A]/15 border border-[#B6FF4A]/30 text-[#B6FF4A] flex items-center justify-center">
                <AlertOctagon className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#F5F5F5]">
                  Human Authorization Review Queue
                </h3>
                <p className="text-xs text-[#A0A0A8]">
                  Critical-consequence actions intercepted by the policy engine requiring operator override.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#B6FF4A]/20 text-[#B6FF4A] border border-[#B6FF4A]/30 px-2.5 py-1 rounded-full">
              Operator Required
            </span>
          </div>

          <div className="space-y-3">
            {pendingApprovals.map((appr) => (
              <div
                key={appr.id}
                className="bg-[#181820] rounded-2xl p-4 sm:p-5 border border-[#303038] flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono-tech font-bold text-[#707078]">
                      {appr.id}
                    </span>
                    <span className="text-xs font-mono-tech font-semibold text-[#F5F5F5] bg-[#282830] px-2 py-0.5 rounded border border-[#303038]">
                      {appr.tool_name}()
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FF5C5C]/15 text-[#FF5C5C] border border-[#FF5C5C]/30 px-2 py-0.5 rounded">
                      CRITICAL RISK
                    </span>
                  </div>
                  <p className="text-xs text-[#A0A0A8]">
                    Target Arguments: <code className="font-mono-tech text-[#F5F5F5]">{JSON.stringify(appr.kwargs)}</code>
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRejectAction(appr.id)}
                    disabled={isSubmittingApproval}
                    className="flex items-center gap-1.5 text-xs text-[#A0A0A8] hover:text-[#F5F5F5]"
                  >
                    <X className="w-3.5 h-3.5 text-[#A0A0A8]" />
                    <span>Reject Action</span>
                  </Button>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleApproveAction(appr.id)}
                    isLoading={isSubmittingApproval}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Authorize (Demo)</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Safety Radar & Guardrail Policy Matrix */}
      <SafetyRadar policies={policies} />
    </div>
  );
}
