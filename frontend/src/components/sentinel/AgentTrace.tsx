import React, { useRef, useEffect } from "react";
import { AIReasoningItem, IncidentLogItem } from "@/types/sentinel";
import { Terminal, Cpu, Sparkles, Filter } from "lucide-react";

interface AgentTraceProps {
  reasoning: AIReasoningItem[];
  logs: IncidentLogItem[];
  activeTab: "reasoning" | "logs";
  onTabChange: (tab: "reasoning" | "logs") => void;
}

export function AgentTrace({
  reasoning,
  logs,
  activeTab,
  onTabChange,
}: AgentTraceProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only scroll the internal terminal container, never the browser window
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [reasoning.length, logs.length, activeTab]);

  return (
    <section id="trace" className="bg-[#282830] rounded-3xl p-6 border border-[#303038] space-y-4">
      {/* Top Header & Tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#303038]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#181820] border border-[#303038] text-[#00D068]">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-tight text-[#F5F5F5]">
              Autonomous Agent Trace & Telemetry Stream
            </h3>
            <p className="text-xs text-[#A0A0A8]">
              Live reasoning timeline and raw operational log records.
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1 bg-[#181820] p-1 rounded-xl border border-[#303038] shrink-0">
          <button
            onClick={() => onTabChange("reasoning")}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "reasoning"
                ? "bg-[#00D068] text-[#101010] font-semibold shadow-sm"
                : "text-[#A0A0A8] hover:text-[#F5F5F5]"
            }`}
          >
            Agent Reasoning ({reasoning.length})
          </button>
          <button
            onClick={() => onTabChange("logs")}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "logs"
                ? "bg-[#00D068] text-[#101010] font-semibold shadow-sm"
                : "text-[#A0A0A8] hover:text-[#F5F5F5]"
            }`}
          >
            Raw Logs ({logs.length})
          </button>
        </div>
      </div>

      {/* Terminal Window */}
      <div
        ref={terminalRef}
        className="h-80 overflow-y-auto rounded-2xl bg-[#181820] border border-[#303038] p-4 font-mono-tech text-xs space-y-2.5 custom-scrollbar"
      >
        {activeTab === "reasoning" ? (
          reasoning.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[#707078] italic">
              No reasoning steps recorded yet. Agent is standing by.
            </div>
          ) : (
            reasoning.map((item, idx) => {
              const time = item.timestamp
                ? new Date(item.timestamp).toLocaleTimeString()
                : "00:00:00";
              const isAction = !!item.action;

              return (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-[#282830] border border-[#303038] hover:border-[#00D068]/30 transition-colors"
                >
                  <div className="flex items-center gap-2 text-[11px] text-[#A0A0A8] mb-1">
                    <span className="text-[#707078] font-semibold">{time}</span>
                    <span className="text-[#00D068] font-bold">SENTINEL-AI</span>
                    {isAction && (
                      <span className="text-[10px] text-[#58DC9C] uppercase bg-[#58DC9C]/10 px-1.5 py-0.2 rounded border border-[#58DC9C]/20">
                        ACTION: {item.action}
                      </span>
                    )}
                  </div>
                  <p className="text-[#F5F5F5] text-xs font-sans leading-relaxed">
                    {item.thought}
                  </p>
                  {item.result && (
                    <div className="mt-1 text-[11px] text-[#A0A0A8] font-mono-tech bg-[#101010] px-2 py-1 rounded border border-[#303038]">
                      Result: {item.result}
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#707078] italic">
            No incident logs captured.
          </div>
        ) : (
          logs.map((log, idx) => {
            const time = log.timestamp
              ? new Date(log.timestamp).toLocaleTimeString()
              : "00:00:00";
            const isWarning = log.level === "WARNING";
            const isError = log.level === "ERROR";

            return (
              <div key={idx} className="flex items-start gap-2.5 leading-snug">
                <span className="text-[#707078] shrink-0 font-semibold">{time}</span>
                <span
                  className={`text-[10px] font-bold uppercase px-1 py-0.2 rounded shrink-0 ${
                    isError
                      ? "text-[#FF5C5C] bg-[#FF5C5C]/10 border border-[#FF5C5C]/20"
                      : isWarning
                      ? "text-[#B6FF4A] bg-[#B6FF4A]/10 border border-[#B6FF4A]/20"
                      : "text-[#58DC9C] bg-[#58DC9C]/10 border border-[#58DC9C]/20"
                  }`}
                >
                  {log.level}
                </span>
                <span
                  className={`break-all ${
                    isError
                      ? "text-[#FF5C5C]"
                      : isWarning
                      ? "text-[#B6FF4A]"
                      : "text-[#F5F5F5]"
                  }`}
                >
                  {log.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
