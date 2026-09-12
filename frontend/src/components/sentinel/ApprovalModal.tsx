import React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ShieldAlert, AlertOctagon, Check, X, Lock } from "lucide-react";

interface ApprovalModalProps {
  isOpen: boolean;
  approvalId: string | null;
  toolName?: string;
  kwargs?: Record<string, unknown>;
  risk?: string;
  isSubmitting: boolean;
  onApprove: () => void;
  onReject: () => void;
}

export function ApprovalModal({
  isOpen,
  approvalId,
  toolName = "delete_database",
  kwargs = { db_name: "sentinel" },
  risk = "CRITICAL",
  isSubmitting,
  onApprove,
  onReject,
}: ApprovalModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onReject} className="max-w-lg border-[#FF5C5C]/40">
      <div className="space-y-6">
        {/* Modal Header */}
        <div className="flex items-start gap-4 pb-4 border-b border-[#303038]">
          <div className="w-12 h-12 rounded-2xl bg-[#FF5C5C]/15 border border-[#FF5C5C]/30 text-[#FF5C5C] flex items-center justify-center shrink-0">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF5C5C] bg-[#FF5C5C]/10 border border-[#FF5C5C]/20 px-2 py-0.5 rounded-full">
                Security Authorization Gate
              </span>
              {approvalId && (
                <span className="text-[11px] font-mono-tech text-[#707078]">
                  {approvalId}
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold tracking-tight text-[#F5F5F5]">
              High-Consequence Action Intercepted
            </h3>
            <p className="text-xs text-[#A0A0A8] mt-0.5">
              An autonomous agent or chaos script requested an action requiring explicit human operator permission.
            </p>
          </div>
        </div>

        {/* Action Specification Table */}
        <div className="space-y-3 bg-[#181820] rounded-2xl p-4 border border-[#303038]">
          <div className="flex items-center justify-between text-xs py-1 border-b border-[#303038]/60">
            <span className="text-[#A0A0A8] font-medium">Proposed Tool</span>
            <span className="font-mono-tech font-semibold text-[#F5F5F5]">
              {toolName}()
            </span>
          </div>

          <div className="flex items-center justify-between text-xs py-1 border-b border-[#303038]/60">
            <span className="text-[#A0A0A8] font-medium">Risk Level</span>
            <span className="font-bold uppercase tracking-wider text-[#FF5C5C] bg-[#FF5C5C]/15 border border-[#FF5C5C]/25 px-2 py-0.5 rounded">
              {risk}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs py-1 border-b border-[#303038]/60">
            <span className="text-[#A0A0A8] font-medium">Target Arguments</span>
            <span className="font-mono-tech text-[#F5F5F5]">
              {JSON.stringify(kwargs)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs py-1">
            <span className="text-[#A0A0A8] font-medium">Enforced Policy</span>
            <span className="flex items-center gap-1 text-[#B6FF4A] font-medium">
              <Lock className="w-3 h-3 text-[#B6FF4A]" />
              Human-in-the-Loop Override Required
            </span>
          </div>
        </div>

        {/* Security Impact Warning */}
        <div className="p-3.5 rounded-xl bg-[#FF5C5C]/10 border border-[#FF5C5C]/25 text-xs text-[#FF5C5C] leading-relaxed">
          <span className="font-semibold text-[#FF5C5C]">Impact Warning:</span> Approving this action triggers execution against the targeted resource. For testing demonstrations, a safe non-destructive simulation is executed. Rejecting prevents execution and logs an operator audit event.
        </div>

        {/* Action CTAs */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={onReject}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            <X className="w-4 h-4 text-[#A0A0A8]" />
            <span>Reject Action</span>
          </Button>

          <Button
            variant="danger"
            onClick={onApprove}
            isLoading={isSubmitting}
            className="flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Authorize & Execute</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
