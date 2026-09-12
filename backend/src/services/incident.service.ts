import {
  AIReasoningItem,
  ApprovalDecision,
  ApprovalStatus,
  IncidentData,
  IncidentLogItem,
  PendingApproval,
  ServiceStatus,
  SystemHealth,
} from "../types/sentinel";
import { RingBuffer } from "../utils/ring-buffer";
import { logger } from "../utils/logger";
import { emitSentinelEvent } from "../realtime/socket";
import { IncidentRepository } from "../repositories/incident.repository";
import { ApprovalRepository } from "../repositories/approval.repository";
import { IncidentLogRepository } from "../repositories/incident-log.repository";
import { ReasoningRepository } from "../repositories/reasoning.repository";
import { logPersistenceWarning } from "../utils/persistence";
import { getDbPool } from "../db/connection";
import type { StructuredRca } from "../safety/schemas";

export interface AIReasoningOptions {
  incident_id?: string | null;
  turn?: number | null;
  confidence?: number | null;
  structured_rca?: Record<string, unknown> | null;
  source?: string;
}

class IncidentService {
  private systemHealth: SystemHealth = "HEALTHY";
  private dummyApiStatus: ServiceStatus = "UP";
  private databaseStatus: ServiceStatus = "UP";
  private lastPingTime: string | null = null;
  private lastPingCode: number | null = 200;
  private activeIncident: boolean = false;
  private currentIncident: IncidentData | null = null;

  readonly incidentLogs = new RingBuffer<IncidentLogItem>(100);
  readonly aiReasoning = new RingBuffer<AIReasoningItem>(100);
  readonly pendingApprovals = new RingBuffer<PendingApproval>(100);

  logEvent(message: string, level: string = "INFO"): void {
    const timestamp = new Date().toISOString();
    const entry: IncidentLogItem = { timestamp, level, message };
    this.incidentLogs.push(entry);

    if (level === "ERROR") {
      logger.error(`[${level}] ${message}`);
    } else if (level === "WARNING") {
      logger.warn(`[${level}] ${message}`);
    } else {
      logger.info(`[${level}] ${message}`);
    }

    emitSentinelEvent("incident.log", entry);

    // Asynchronous non-blocking write-through to PostgreSQL
    const currentIncId = this.currentIncident?.id ?? null;
    void IncidentLogRepository.append({
      incident_id: currentIncId,
      timestamp,
      level,
      message,
    }).catch((err) => {
      logPersistenceWarning("IncidentLogRepository", "append", currentIncId, err);
    });
  }

  addAiReasoning(
    thought: string,
    action?: string | null,
    result?: string | null,
    options?: AIReasoningOptions
  ): void {
    const timestamp = new Date().toISOString();
    const entry: AIReasoningItem = {
      timestamp,
      thought,
      action: action ?? null,
      result: result ?? null,
      confidence: options?.confidence ?? undefined,
      structured_rca: options?.structured_rca as any,
    };
    this.aiReasoning.push(entry);
    this.logEvent(`🧠 [AI SRE Reasoning] ${thought}`);
    emitSentinelEvent("agent.reasoning", entry);

    // Asynchronous non-blocking write-through to PostgreSQL
    const incId = options?.incident_id ?? this.currentIncident?.id ?? null;
    void ReasoningRepository.append({
      incident_id: incId,
      timestamp,
      thought,
      action: action ?? null,
      result: result ?? null,
      confidence: options?.confidence ?? null,
      structured_rca: options?.structured_rca ?? null,
      turn: options?.turn ?? null,
      source: options?.source ?? "openai",
    }).catch((err) => {
      logPersistenceWarning("ReasoningRepository", "append", incId, err);
    });
  }

  getSystemHealth(): SystemHealth {
    return this.systemHealth;
  }

  setSystemHealth(health: SystemHealth): void {
    this.systemHealth = health;
    emitSentinelEvent("incident.health_changed", { health });
  }

  getDummyApiStatus(): ServiceStatus {
    return this.dummyApiStatus;
  }

  setDummyApiStatus(status: ServiceStatus): void {
    this.dummyApiStatus = status;
  }

  setApiServiceStatus(status: ServiceStatus): void {
    this.dummyApiStatus = status;
  }

  clearIncidents(): void {
    this.activeIncident = false;
    this.currentIncident = null;
    this.systemHealth = "HEALTHY";
    this.databaseStatus = "UP";
    this.dummyApiStatus = "UP";
  }


  getDatabaseStatus(): ServiceStatus {
    return this.databaseStatus;
  }

  setDatabaseStatus(status: ServiceStatus): void {
    this.databaseStatus = status;
  }

  getLastPingTime(): string | null {
    return this.lastPingTime;
  }

  setLastPingTime(time: string | null): void {
    this.lastPingTime = time;
  }

  getLastPingCode(): number | null {
    return this.lastPingCode;
  }

  setLastPingCode(code: number | null): void {
    this.lastPingCode = code;
  }

  isActiveIncident(): boolean {
    return this.activeIncident;
  }

  setActiveIncident(active: boolean): void {
    this.activeIncident = active;
  }

  getCurrentIncident(): IncidentData | null {
    return this.currentIncident;
  }

  setCurrentIncident(incident: IncidentData | null): void {
    this.currentIncident = incident;
    if (incident) {
      emitSentinelEvent("incident.detected", incident);
    }
  }

  addPendingApproval(approval: PendingApproval): void {
    this.pendingApprovals.push(approval);
    emitSentinelEvent("approval.requested", approval);
  }

  findPendingApproval(id: string): PendingApproval | undefined {
    return this.pendingApprovals.find((a) => a.id === id);
  }

  /**
   * Safe restart-recovery rehydration from PostgreSQL control database.
   * Restores active incident, pending approvals, recent logs, and reasoning traces
   * into memory-only ring buffers and properties.
   *
   * Invariants:
   * - Bounded timeout (default 4000ms)
   * - Zero unhandled exceptions or crashes
   * - Zero Socket.IO live event emissions
   * - Zero automated agent invocations or remediation tool executions
   * - Operates in degraded in-memory mode if control DB is unreachable
   */
  async rehydrateFromDatabase(timeoutMs: number = 4000): Promise<void> {
    const pool = getDbPool();
    if (!pool) {
      logger.info(
        "[Startup Recovery] Control database pool not configured. Operating in memory-only mode."
      );
      return;
    }

    const rehydrateTask = async (): Promise<void> => {
      // 1. Active Incident Rehydration
      const activeIncidents = await IncidentRepository.getActive();
      let restoredIncident: IncidentData | null = null;

      if (activeIncidents.length === 1) {
        const inc = activeIncidents[0];
        restoredIncident = {
          id: inc.id,
          detected_at: inc.detected_at,
          error: inc.error,
          status: inc.status,
          recovery_time: inc.recovery_time ?? undefined,
          resolved_at: inc.resolved_at ?? undefined,
          confidence: inc.confidence ?? undefined,
          structured_rca: (inc.structured_rca as StructuredRca) ?? undefined,
          verification_status: inc.verification_status,
          verification_attempts: inc.verification_attempts,
          reinvestigation_attempts: inc.reinvestigation_attempts,
          recovery_verified_at: inc.recovery_verified_at,
        };
        this.currentIncident = restoredIncident;
        this.activeIncident = true;
        this.systemHealth = "INCIDENT_ACTIVE";
        logger.info(
          { incidentId: inc.id, status: inc.status },
          `[Startup Recovery] Rehydrated active incident ${inc.id} (${inc.status})`
        );
      } else if (activeIncidents.length > 1) {
        const inc = activeIncidents[0];
        logger.warn(
          { count: activeIncidents.length, ids: activeIncidents.map((i) => i.id) },
          `[Startup Recovery Warning] Multiple active incidents found in database (${activeIncidents.length}). Selecting most recent (${inc.id}) for continuity. Manual reconciliation recommended.`
        );
        restoredIncident = {
          id: inc.id,
          detected_at: inc.detected_at,
          error: inc.error,
          status: inc.status,
          recovery_time: inc.recovery_time ?? undefined,
          resolved_at: inc.resolved_at ?? undefined,
          confidence: inc.confidence ?? undefined,
          structured_rca: (inc.structured_rca as StructuredRca) ?? undefined,
          verification_status: inc.verification_status,
          verification_attempts: inc.verification_attempts,
          reinvestigation_attempts: inc.reinvestigation_attempts,
          recovery_verified_at: inc.recovery_verified_at,
        };
        this.currentIncident = restoredIncident;
        this.activeIncident = true;
        this.systemHealth = "INCIDENT_ACTIVE";
      } else {
        this.currentIncident = null;
        this.activeIncident = false;
        logger.info("[Startup Recovery] No active incidents found in database.");
      }

      // 2. Pending Approval Rehydration (into memory without event emission or execution)
      const pendingList = await ApprovalRepository.listPending();
      for (const app of pendingList) {
        const pendingItem: PendingApproval = {
          id: app.id,
          incident_id: app.incident_id,
          tool_name: app.tool_name,
          kwargs: app.kwargs,
          risk: app.risk,
          status: app.status as ApprovalStatus,
          requested_at: app.requested_at,
          decision: (app.decision as ApprovalDecision) ?? null,
          decided_at: app.decided_at,
          execution_result: app.execution_result ?? undefined,
          success: app.success,
          error: app.error,
        };
        this.pendingApprovals.push(pendingItem);
      }
      if (pendingList.length > 0) {
        logger.info(
          { count: pendingList.length },
          `[Startup Recovery] Restored ${pendingList.length} pending approval(s) into in-memory queue`
        );
      }

      // 3. Incident Log Rehydration (up to 100 items, direct push without Socket.IO emission)
      let logsToHydrate: IncidentLogItem[] = [];
      if (restoredIncident) {
        const dbLogs = await IncidentLogRepository.listByIncident(restoredIncident.id, 100);
        logsToHydrate = dbLogs.map((l) => ({
          timestamp: l.timestamp,
          level: l.level,
          message: l.message,
        }));
      } else {
        const dbLogs = await IncidentLogRepository.listRecent(100);
        // listRecent is sorted DESC; reverse to ASC for chronological insertion
        logsToHydrate = dbLogs
          .slice()
          .reverse()
          .map((l) => ({
            timestamp: l.timestamp,
            level: l.level,
            message: l.message,
          }));
      }

      for (const logItem of logsToHydrate) {
        this.incidentLogs.push(logItem);
      }
      if (logsToHydrate.length > 0) {
        logger.info(
          { count: logsToHydrate.length },
          `[Startup Recovery] Restored ${logsToHydrate.length} log entry(ies) into in-memory buffer`
        );
      }

      // 4. AI Reasoning Rehydration (up to 100 items, direct push without Socket.IO emission)
      if (restoredIncident) {
        const dbReasoning = await ReasoningRepository.listByIncident(restoredIncident.id, 100);
        for (const r of dbReasoning) {
          const reasoningItem: AIReasoningItem = {
            timestamp: r.timestamp,
            thought: r.thought,
            action: r.action,
            result: r.result,
            confidence: r.confidence ?? undefined,
            structured_rca: (r.structured_rca as StructuredRca) ?? undefined,
          };
          this.aiReasoning.push(reasoningItem);
        }
        if (dbReasoning.length > 0) {
          logger.info(
            { count: dbReasoning.length },
            `[Startup Recovery] Restored ${dbReasoning.length} reasoning record(s) into in-memory buffer`
          );
        }
      }
    };

    let timedOut = false;
    let timeoutHandle: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        reject(new Error(`Startup rehydration timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const safeTaskPromise = rehydrateTask().catch((err: unknown) => {
      if (timedOut) {
        // Late error after timeout fired; log safely and contain rejection
        logger.warn(
          { error: err instanceof Error ? err.message : String(err) },
          "[Startup Recovery Warning] Rehydration task failed after timeout."
        );
        return;
      }
      throw err;
    });

    try {
      await Promise.race([safeTaskPromise, timeoutPromise]);
      logger.info("[Startup Recovery] Safe rehydration completed successfully.");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn(
        { error: errMsg },
        "[Startup Recovery Warning] Failed to rehydrate state from control database. Continuing in degraded in-memory mode."
      );
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}

export const incidentService = new IncidentService();
