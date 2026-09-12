import React from "react";
import { PendingApproval, IncidentLogItem } from "@/types/sentinel";
import { History, CheckCircle2, XCircle, Clock, Shield } from "lucide-react";

interface IncidentHistoryProps {
  approvals: PendingApproval[];
  logs: IncidentLogItem[];
}

export function IncidentHistory({ approvals, logs }: IncidentHistoryProps) {
  // Filter audit records or resolved approvals
  const resolvedApprovals = approvals.filter((a) => a.status !== "PENDING");

  // Extract recent notable recovery or guardrail events from logs
  const notableLogEvents = logs
    .filter(
      (l) =>
        l.message.includes("AUDIT EVENT") ||
        l.message.includes("System Recovered") ||
        l.message.includes("Guardrail")
    )
    .slice(-5)
    .reverse();

  return (
    <section className="bg-[#282830] border border-[#303038] rounded-3xl p-6 sm:p-7 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#303038]">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#00D068]" />
          <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#F5F5F5]">
            Audit Trail & Event History
          </h3>
        </div>
        <span className="text-xs font-medium text-[#A0A0A8]">
          Operator actions & recovery milestones
        </span>
      </div>

      {resolvedApprovals.length === 0 && notableLogEvents.length === 0 ? (
        <div className="p-8 text-center text-[#707078] text-xs italic bg-[#181820] rounded-2xl border border-[#303038]">
          No historical intervention events recorded during this session.
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Resolved Approvals */}
          {resolvedApprovals.map((appr) => {
            const isApproved = appr.status === "APPROVED";
            const time = appr.decided_at
              ? new Date(appr.decided_at).toLocaleTimeString()
              : appr.requested_at
              ? new Date(appr.requested_at).toLocaleTimeString()
              : "00:00:00";

            return (
              <div
                key={appr.id}
                className="bg-[#181820] border border-[#303038] rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-xl border ${
                      isApproved
                        ? "bg-[#00D068]/10 border-[#00D068]/20 text-[#00D068]"
                        : "bg-[#FF5C5C]/10 border-[#FF5C5C]/20 text-[#FF5C5C]"
                    }`}
                  >
                    {isApproved ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono-tech text-[#707078] font-bold">
                        {appr.id}
                      </span>
                      <span className="text-xs font-semibold text-[#F5F5F5]">
                        {appr.tool_name}()
                      </span>
                    </div>
                    <p className="text-xs text-[#A0A0A8] mt-0.5">
                      Decision:{" "}
                      <span
                        className={`font-semibold ${
                          isApproved ? "text-[#00D068]" : "text-[#FF5C5C]"
                        }`}
                      >
                        {appr.status}
                      </span>{" "}
                      by Human Operator
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center text-xs font-mono-tech text-[#707078]">
                  <Clock className="w-3.5 h-3.5 text-[#707078]" />
                  <span>{time}</span>
                </div>
              </div>
            );
          })}

          {/* Notable Recovery Events */}
          {notableLogEvents.map((event, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-xl bg-[#181820] border border-[#303038] text-xs"
            >
              <div className="flex items-center gap-2.5">
                <Shield className="w-3.5 h-3.5 text-[#00D068] shrink-0" />
                <span className="text-[#F5F5F5] font-medium line-clamp-1">{event.message}</span>
              </div>
              <span className="font-mono-tech text-[#707078] shrink-0 pl-2">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
