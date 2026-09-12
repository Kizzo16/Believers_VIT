export type SystemHealth = "HEALTHY" | "DEGRADED" | "INCIDENT_ACTIVE" | "RECOVERING";
export type ServiceStatus = "UP" | "DOWN" | string;
export type ContainerState = "RUNNING" | "STOPPED";
export type ApprovalDecision = "APPROVE" | "REJECT" | "APPROVED" | "REJECTED";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AIReasoningItem {
  timestamp: string;
  thought: string;
  action?: string | null;
  result?: string | null;
}

export interface IncidentLogItem {
  timestamp: string;
  level: string;
  message: string;
}

export interface PendingApproval {
  id: string;
  incident_id?: string | null;
  tool_name: string;
  kwargs: Record<string, unknown>;
  risk: string;
  status: ApprovalStatus;
  requested_at: string;
  decision?: ApprovalDecision | null;
  decided_at?: string | null;
  execution_result?: unknown;
  success?: boolean | null;
  error?: string | null;
}

export interface PolicyRule {
  risk: string;
  auto_execute: boolean;
}

export type GuardrailPolicies = Record<string, PolicyRule>;

export interface IncidentData {
  id: string;
  detected_at: string;
  error: string;
  status: string;
  recovery_time?: string;
  resolved_at?: string;
}

export interface SystemStatusResponse {
  system_health: SystemHealth;
  dummy_api_status: ServiceStatus;
  database_status: ServiceStatus;
  containers: {
    sentinel_db: ContainerState;
    dummy_api: ContainerState;
  };
  last_ping_time: string | null;
  last_ping_code: number | null;
  active_incident: boolean;
  current_incident: IncidentData | null;
  ai_reasoning: AIReasoningItem[];
  incident_logs: IncidentLogItem[];
  pending_approvals: PendingApproval[];
  policies: GuardrailPolicies;
}
