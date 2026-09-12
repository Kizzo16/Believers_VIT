import React from "react";
import { AlertCircle, Terminal, FileCode2 } from "lucide-react";

interface EvidencePanelProps {
  errorSnippet?: string;
  rootCause?: string;
  affectedService?: string;
}

export function EvidencePanel({
  errorSnippet,
  rootCause,
  affectedService,
}: EvidencePanelProps) {
  return (
    <div className="space-y-4">
      {/* Root Cause Analysis Card */}
      {rootCause && (
        <div className="bg-[#FF5C5C]/10 border border-[#FF5C5C]/25 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-[#FF5C5C] font-semibold text-xs uppercase tracking-wider mb-1.5">
            <AlertCircle className="w-4 h-4" />
            <span>Root Cause Isolation</span>
          </div>
          <p className="text-sm text-[#F5F5F5] leading-relaxed font-medium">
            {rootCause}
          </p>
        </div>
      )}

      {/* Raw Diagnostic Evidence / Log Snippet */}
      <div>
        <div className="flex items-center justify-between text-xs text-[#A0A0A8] mb-2">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-[#707078]" />
            <span className="font-semibold uppercase tracking-wider">Raw Telemetry Evidence</span>
          </div>
          <span className="text-[11px] font-mono-tech text-[#A0A0A8]">
            Source: {affectedService || "dummy-api"}
          </span>
        </div>
        <div className="bg-[#181820] border border-[#303038] rounded-xl p-3.5 font-mono-tech text-xs text-[#F5F5F5] overflow-x-auto">
          <pre className="whitespace-pre-wrap leading-relaxed">
            {errorSnippet ||
              `[ERROR] 500 Internal Server Error: Failed to connect to postgresql://postgres:***@sentinel-db:5432/sentinel\n` +
              `psycopg2.OperationalError: could not connect to server: Connection refused\n` +
              `        Is the server running on host "sentinel-db" and accepting TCP/IP connections?`}
          </pre>
        </div>
      </div>
    </div>
  );
}
