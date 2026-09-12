import React from "react";
import { Button } from "@/components/ui/button";
import { Zap, RefreshCw, AlertTriangle, Shield, Wrench, Database, Server } from "lucide-react";

interface SimulationControlsProps {
  onKillDatabase: () => void;
  onKillApi?: () => void;
  onConfigFailure?: () => void;
  onResetEnv?: () => void;
  onProposeDangerous: () => void;
  onTriggerMock: () => void;
  loadingAction: string | null;
}

export function SimulationControls({
  onKillDatabase,
  onKillApi,
  onConfigFailure,
  onResetEnv,
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
              Module 1: Failure Simulation & Environment Controls
            </h3>
          </div>
          <p className="text-xs text-[#A0A0A8]">
            Controlled failure injection and reliable recovery reset of the demo software environment.
          </p>
        </div>

        {onResetEnv && (
          <Button
            variant="outline"
            size="sm"
            onClick={onResetEnv}
            isLoading={loadingAction === "reset_env"}
            className="border-[#58DC9C]/40 text-[#58DC9C] hover:bg-[#58DC9C]/10 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Environment to NORMAL
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Failure Mode 1: Database Failure */}
        <div className="p-4 rounded-2xl bg-[#181820] border border-[#303038] flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F5F5F5] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#FF5C5C]" />
              <Database className="w-3.5 h-3.5 text-[#FF5C5C]" />
              <span>1. Database Failure</span>
            </div>
            <p className="text-xs text-[#A0A0A8] leading-relaxed">
              Stops <code className="font-mono-tech text-[#F5F5F5]">sentinel-db</code> container or drops DB connections.
            </p>
          </div>

          <Button
            variant="danger"
            size="sm"
            onClick={onKillDatabase}
            isLoading={loadingAction === "kill_db"}
            className="w-full justify-center text-xs"
          >
            Simulate DB Outage
          </Button>
        </div>

        {/* Failure Mode 2: API Failure */}
        <div className="p-4 rounded-2xl bg-[#181820] border border-[#303038] flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F5F5F5] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#FFB800]" />
              <Server className="w-3.5 h-3.5 text-[#FFB800]" />
              <span>2. API Failure</span>
            </div>
            <p className="text-xs text-[#A0A0A8] leading-relaxed">
              Forces REST API into HTTP 500 error fault state.
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onKillApi}
            isLoading={loadingAction === "kill_api"}
            className="w-full justify-center text-xs bg-[#FFB800]/20 text-[#FFB800] hover:bg-[#FFB800]/30"
          >
            Simulate API Failure
          </Button>
        </div>

        {/* Failure Mode 3: Config Failure */}
        <div className="p-4 rounded-2xl bg-[#181820] border border-[#303038] flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F5F5F5] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#FF9F43]" />
              <Wrench className="w-3.5 h-3.5 text-[#FF9F43]" />
              <span>3. Config Failure</span>
            </div>
            <p className="text-xs text-[#A0A0A8] leading-relaxed">
              Corrupts DB connection host/port settings in API configuration.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onConfigFailure}
            isLoading={loadingAction === "config_failure"}
            className="w-full justify-center text-xs border-[#FF9F43]/40 text-[#FF9F43] hover:bg-[#FF9F43]/10"
          >
            Corrupt Config Params
          </Button>
        </div>

        {/* Failure Mode 4: Safety Guardrail Action */}
        <div className="p-4 rounded-2xl bg-[#181820] border border-[#303038] flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F5F5F5] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#B6FF4A]" />
              <Shield className="w-3.5 h-3.5 text-[#B6FF4A]" />
              <span>4. Guardrail Intercept</span>
            </div>
            <p className="text-xs text-[#A0A0A8] leading-relaxed">
              Simulates AI executing <code className="font-mono-tech text-[#F5F5F5]">delete_database</code>. Intercepted by policy gate.
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onProposeDangerous}
            isLoading={loadingAction === "propose_dangerous"}
            className="w-full justify-center text-xs"
          >
            Simulate Dangerous Action
          </Button>
        </div>
      </div>
    </section>
  );
}

