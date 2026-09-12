import React from "react";
import { Button } from "@/components/ui/button";
import { Zap, AlertTriangle, Play, HelpCircle, Shield } from "lucide-react";

interface SimulationControlsProps {
  onKillDatabase: () => void;
  onProposeDangerous: () => void;
  onTriggerMock: () => void;
  loadingAction: string | null;
}

export function SimulationControls({
  onKillDatabase,
  onProposeDangerous,
  onTriggerMock,
  loadingAction,
}: SimulationControlsProps) {
  return (
    <section id="controls" className="bg-[#282830] rounded-3xl p-6 border border-[#303038] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#303038]">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#B6FF4A]" />
            <h3 className="text-base font-semibold tracking-tight text-[#F5F5F5]">
              Simulation & Chaos Engineering Controls
            </h3>
          </div>
          <p className="text-xs text-[#A0A0A8]">
            Intentionally trigger faults to demonstrate autonomous diagnosis, guardrail intercepts, and self-healing.
          </p>
        </div>

        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B6FF4A] bg-[#B6FF4A]/10 border border-[#B6FF4A]/20 px-2.5 py-1 rounded-full w-fit">
          Safe Demo Mode Active
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Simulation 1: Database Failure */}
        <div className="p-4 rounded-2xl bg-[#181820] border border-[#303038] flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F5F5F5] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#FF5C5C]" />
              <span>Fault 1: Infrastructure Outage</span>
            </div>
            <p className="text-xs text-[#A0A0A8] leading-relaxed">
              Stops <code className="font-mono-tech text-[#F5F5F5]">sentinel-db</code> container. Watch Sentinel detect the 500 error, diagnose log traces, and restart the database.
            </p>
          </div>

          <Button
            variant="danger"
            size="sm"
            onClick={onKillDatabase}
            isLoading={loadingAction === "kill_db"}
            className="w-full justify-center text-xs"
          >
            Simulate DB Failure
          </Button>
        </div>

        {/* Simulation 2: Critical Guardrail Intercept */}
        <div className="p-4 rounded-2xl bg-[#181820] border border-[#303038] flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F5F5F5] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#B6FF4A]" />
              <span>Fault 2: Safety Guardrail</span>
            </div>
            <p className="text-xs text-[#A0A0A8] leading-relaxed">
              Simulates an AI attempting to execute <code className="font-mono-tech text-[#F5F5F5]">delete_database</code>. Watch policy engine intercept and open the Human Authorization Gate.
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onProposeDangerous}
            isLoading={loadingAction === "propose_dangerous"}
            className="w-full justify-center text-xs"
          >
            Simulate Critical Action
          </Button>
        </div>

        {/* Simulation 3: Synthetic Anomaly */}
        <div className="p-4 rounded-2xl bg-[#181820] border border-[#303038] flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F5F5F5] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#58DC9C]" />
              <span>Fault 3: Synthetic Anomaly</span>
            </div>
            <p className="text-xs text-[#A0A0A8] leading-relaxed">
              Triggers a mock incident event to test control plane routing, telemetry state transition, and notification broadcast.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onTriggerMock}
            isLoading={loadingAction === "mock_incident"}
            className="w-full justify-center text-xs"
          >
            Trigger Mock Incident
          </Button>
        </div>
      </div>
    </section>
  );
}
