import {
  AIReasoningItem,
  IncidentData,
  IncidentLogItem,
  PendingApproval,
  ServiceStatus,
  SystemHealth,
} from "../types/sentinel";
import { RingBuffer } from "../utils/ring-buffer";
import { logger } from "../utils/logger";
import { emitSentinelEvent } from "../realtime/socket";

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
  }

  addAiReasoning(thought: string, action?: string | null, result?: string | null): void {
    const timestamp = new Date().toISOString();
    const entry: AIReasoningItem = {
      timestamp,
      thought,
      action: action ?? null,
      result: result ?? null,
    };
    this.aiReasoning.push(entry);
    this.logEvent(`🧠 [AI SRE Reasoning] ${thought}`);
    emitSentinelEvent("agent.reasoning", entry);
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
}

export const incidentService = new IncidentService();
