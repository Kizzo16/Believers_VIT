"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { SystemStatusResponse } from "@/types/sentinel";

interface ToastNotice {
  type: "info" | "warning" | "success" | "danger";
  text: string;
}

interface SentinelContextValue {
  data: SystemStatusResponse | null;
  backendOnline: boolean;
  clock: string;
  actionLoading: string | null;
  actionNotice: ToastNotice | null;
  pendingApproval: boolean;
  activeApprovalId: string | null;
  isSubmittingApproval: boolean;
  handleKillDatabase: () => Promise<void>;
  handleKillApi: () => Promise<void>;
  handleConfigFailure: () => Promise<void>;
  handleResetEnv: () => Promise<void>;
  handleProposeDangerousAction: () => Promise<void>;
  handleTriggerMockIncident: () => Promise<void>;
  handleApproveAction: (approvalId?: string) => Promise<void>;
  handleRejectAction: (approvalId?: string) => Promise<void>;
  openApprovalModal: (id?: string) => void;
  closeApprovalModal: () => void;
  setToast: (notice: ToastNotice | null) => void;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const SentinelContext = createContext<SentinelContextValue | undefined>(undefined);

export function SentinelProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SystemStatusResponse | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [clock, setClock] = useState<string>("");

  // Chaos & action execution states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<ToastNotice | null>(null);

  // Approval modal states
  const [pendingApproval, setPendingApproval] = useState(false);
  const [activeApprovalId, setActiveApprovalId] = useState<string | null>(null);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // Live UTC Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClock(now.toTimeString().split(" ")[0] + " UTC");
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll backend status every 2 seconds (Single Centralized Loop for all routes)
  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/status`, { cache: "no-store" });
        if (res.ok) {
          const json: SystemStatusResponse = await res.json();
          if (isMounted) {
            setData(json);
            setBackendOnline(true);
          }
        } else {
          if (isMounted) setBackendOnline(false);
        }
      } catch {
        if (isMounted) setBackendOnline(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Auto-clear toast notice after 6 seconds
  useEffect(() => {
    if (actionNotice) {
      const timer = setTimeout(() => setActionNotice(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [actionNotice]);

  // Chaos Action 1: Kill Database
  const handleKillDatabase = async () => {
    setActionLoading("kill_db");
    setActionNotice({
      type: "danger",
      text: "💥 SIGTERM sent to sentinel-db. Observe autonomous telemetry detection and remediation.",
    });
    try {
      const res = await fetch(`${BACKEND_URL}/api/chaos/kill-db`, {
        method: "POST",
      });
      await res.json();
    } catch (e: unknown) {
      const err = e as Error;
      setActionNotice({ type: "danger", text: `Failed to stop database: ${err.message}` });
    } finally {
      setTimeout(() => setActionLoading(null), 700);
    }
  };

  // Chaos Action 2: Kill API
  const handleKillApi = async () => {
    setActionLoading("kill_api");
    setActionNotice({
      type: "warning",
      text: "💥 API Failure Mode triggered. Demo REST API now returning HTTP 500 error status.",
    });
    try {
      const res = await fetch(`${BACKEND_URL}/api/chaos/kill-api`, {
        method: "POST",
      });
      await res.json();
    } catch (e: unknown) {
      const err = e as Error;
      setActionNotice({ type: "danger", text: `Failed to trigger API failure: ${err.message}` });
    } finally {
      setTimeout(() => setActionLoading(null), 700);
    }
  };

  // Chaos Action 3: Config Failure
  const handleConfigFailure = async () => {
    setActionLoading("config_failure");
    setActionNotice({
      type: "warning",
      text: "⚠️ Configuration Failure triggered. Connection parameters corrupted.",
    });
    try {
      const res = await fetch(`${BACKEND_URL}/api/chaos/config-failure`, {
        method: "POST",
      });
      await res.json();
    } catch (e: unknown) {
      const err = e as Error;
      setActionNotice({ type: "danger", text: `Failed to trigger config failure: ${err.message}` });
    } finally {
      setTimeout(() => setActionLoading(null), 700);
    }
  };

  // Environment Reset
  const handleResetEnv = async () => {
    setActionLoading("reset_env");
    setActionNotice({
      type: "info",
      text: "🔄 Resetting environment state, starting containers, and restoring normal config...",
    });
    try {
      const res = await fetch(`${BACKEND_URL}/api/chaos/reset`, {
        method: "POST",
      });
      await res.json();
      setActionNotice({
        type: "success",
        text: "✅ Environment reset to NORMAL. All services and databases operating normally.",
      });
    } catch (e: unknown) {
      const err = e as Error;
      setActionNotice({ type: "danger", text: `Reset environment error: ${err.message}` });
    } finally {
      setTimeout(() => setActionLoading(null), 700);
    }
  };

  // Chaos Action: Propose Dangerous Action (Guardrail Test)
  const handleProposeDangerousAction = async () => {
    setActionLoading("propose_dangerous");
    setActionNotice({
      type: "warning",
      text: "⚠️ Proposing 'delete_database' action to Sentinel Guardrail Engine...",
    });
    try {
      const res = await fetch(`${BACKEND_URL}/api/chaos/propose-dangerous`, {
        method: "POST",
      });
      const result = await res.json();
      if (result.status === "Requires Human Approval") {
        setActiveApprovalId(result.approval_id);
        setPendingApproval(true);
        setActionNotice({
          type: "warning",
          text: `🛡️ Guardrail Intercept: Action 'delete_database' has CRITICAL risk. Human Authorization required (ID: ${result.approval_id}).`,
        });
      } else {
        setActionNotice({
          type: "info",
          text: `Action response: ${JSON.stringify(result)}`,
        });
      }
    } catch (e: unknown) {
      const err = e as Error;
      setActionNotice({ type: "danger", text: `Error: ${err.message}` });
    } finally {
      setTimeout(() => setActionLoading(null), 700);
    }
  };

  // Chaos Action: Trigger Mock Incident
  const handleTriggerMockIncident = async () => {
    setActionLoading("mock_incident");
    setActionNotice({
      type: "info",
      text: "Synthesizing test outage anomaly...",
    });
    try {
      const res = await fetch(`${BACKEND_URL}/api/trigger-mock-incident`, {
        method: "POST",
      });
      await res.json();
      setActionNotice({
        type: "success",
        text: "Mock incident dispatched successfully.",
      });
    } catch (e: unknown) {
      const err = e as Error;
      setActionNotice({ type: "danger", text: `Mock incident error: ${err.message}` });
    } finally {
      setTimeout(() => setActionLoading(null), 700);
    }
  };

  // Approval: Reject Dangerous Action
  const handleRejectAction = async (targetId?: string) => {
    const approvalIdToUse =
      targetId ||
      activeApprovalId ||
      (data?.pending_approvals && data.pending_approvals.length > 0
        ? data.pending_approvals[data.pending_approvals.length - 1].id
        : null);

    if (!approvalIdToUse) {
      setActionNotice({ type: "danger", text: "Error: No active approval ID found to reject." });
      return;
    }

    setIsSubmittingApproval(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/approve-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id: approvalIdToUse,
          action: "REJECT",
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || "Rejection failed");

      if (result.status === "REJECTED") {
        setPendingApproval(false);
        setActiveApprovalId(null);
        setActionNotice({
          type: "success",
          text: `🛑 Operator REJECTED dangerous action (${approvalIdToUse}). Action prevented & audit event logged.`,
        });
      }
    } catch (e: unknown) {
      const err = e as Error;
      setActionNotice({ type: "danger", text: `Rejection failed: ${err.message}` });
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // Approval: Authorize Dangerous Action (Safe Demo Mode)
  const handleApproveAction = async (targetId?: string) => {
    const approvalIdToUse =
      targetId ||
      activeApprovalId ||
      (data?.pending_approvals && data.pending_approvals.length > 0
        ? data.pending_approvals[data.pending_approvals.length - 1].id
        : null);

    if (!approvalIdToUse) {
      setActionNotice({ type: "danger", text: "Error: No active approval ID found to approve." });
      return;
    }

    setIsSubmittingApproval(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/approve-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id: approvalIdToUse,
          action: "APPROVE",
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || "Approval execution failed");

      if (result.status === "EXECUTED") {
        setPendingApproval(false);
        setActiveApprovalId(null);
        setActionNotice({
          type: "success",
          text: `✅ Operator OVERRIDE APPROVED (${approvalIdToUse}). Safe demo simulation executed & logged.`,
        });
      }
    } catch (e: unknown) {
      const err = e as Error;
      setActionNotice({ type: "danger", text: `Approval failed: ${err.message}` });
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const openApprovalModal = (id?: string) => {
    if (id) setActiveApprovalId(id);
    setPendingApproval(true);
  };

  const closeApprovalModal = () => {
    setPendingApproval(false);
  };

  return (
    <SentinelContext.Provider
      value={{
        data,
        backendOnline,
        clock,
        actionLoading,
        actionNotice,
        pendingApproval,
        activeApprovalId,
        isSubmittingApproval,
        handleKillDatabase,
        handleKillApi,
        handleConfigFailure,
        handleResetEnv,
        handleProposeDangerousAction,
        handleTriggerMockIncident,
        handleApproveAction,
        handleRejectAction,
        openApprovalModal,
        closeApprovalModal,
        setToast: setActionNotice,
      }}
    >
      {children}
    </SentinelContext.Provider>
  );
}


export function useSentinel() {
  const context = useContext(SentinelContext);
  if (!context) {
    throw new Error("useSentinel must be used within a SentinelProvider");
  }
  return context;
}
