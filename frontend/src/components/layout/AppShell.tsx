"use client";

import React from "react";
import { useSentinel } from "@/context/SentinelContext";
import { Header } from "@/components/sentinel/Header";
import { ApprovalModal } from "@/components/sentinel/ApprovalModal";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    data,
    backendOnline,
    clock,
    actionNotice,
    pendingApproval,
    activeApprovalId,
    isSubmittingApproval,
    handleApproveAction,
    handleRejectAction,
  } = useSentinel();

  const activeIncident = data?.active_incident || false;
  const pendingApprovalsCount =
    data?.pending_approvals?.filter((p) => p.status === "PENDING").length || 0;

  return (
    <div className="min-h-screen bg-[#101010] editorial-bg text-[#F5F5F5] flex flex-col font-sans selection:bg-[#00D068]/30">
      {/* Persistent Global Header */}
      <Header
        systemHealth={data?.system_health || "HEALTHY"}
        backendOnline={backendOnline}
        clock={clock}
        hasActiveIncident={activeIncident}
        pendingApprovalsCount={pendingApprovalsCount}
      />

      {/* Floating Action Notice / Toast */}
      {actionNotice && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in slide-in-from-bottom-4 duration-300">
          <div
            className={`p-4 rounded-xl shadow-2xl border backdrop-blur-xl flex items-start gap-3 bg-[#282830]/95 ${
              actionNotice.type === "danger"
                ? "border-[#FF5C5C]/40 text-[#FF5C5C]"
                : actionNotice.type === "warning"
                ? "border-[#B6FF4A]/40 text-[#B6FF4A]"
                : actionNotice.type === "success"
                ? "border-[#00D068]/40 text-[#00D068]"
                : "border-[#58DC9C]/40 text-[#F5F5F5]"
            }`}
          >
            {actionNotice.type === "danger" && (
              <AlertCircle className="w-5 h-5 text-[#FF5C5C] shrink-0 mt-0.5" />
            )}
            {actionNotice.type === "warning" && (
              <AlertCircle className="w-5 h-5 text-[#B6FF4A] shrink-0 mt-0.5" />
            )}
            {actionNotice.type === "success" && (
              <CheckCircle2 className="w-5 h-5 text-[#00D068] shrink-0 mt-0.5" />
            )}
            {actionNotice.type === "info" && (
              <Info className="w-5 h-5 text-[#58DC9C] shrink-0 mt-0.5" />
            )}
            <p className="text-xs font-medium leading-relaxed">{actionNotice.text}</p>
          </div>
        </div>
      )}

      {/* Main Multi-Page Routed Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Persistent Global Footer */}
      <footer className="border-t border-[#303038] py-6 text-center text-xs text-[#707078]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Sentinel SRE Control Plane — Autonomous Operations Platform</span>
          <span className="font-mono-tech">v2.6.0 // Dark Command Foundation</span>
        </div>
      </footer>

      {/* Global Human-in-the-Loop Security Approval Authorization Modal */}
      <ApprovalModal
        isOpen={pendingApproval}
        approvalId={activeApprovalId}
        toolName="delete_database"
        kwargs={{ db_name: "sentinel" }}
        risk="CRITICAL"
        isSubmitting={isSubmittingApproval}
        onApprove={() => handleApproveAction()}
        onReject={() => handleRejectAction()}
      />
    </div>
  );
}
