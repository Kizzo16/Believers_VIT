import type { StructuredRca } from "../safety/schemas";

export type SystemHealth = "HEALTHY" | "DEGRADED" | "INCIDENT_ACTIVE" | "RECOVERING";
export type ServiceStatus = "UP" | "DOWN" | "HEALTHY" | "UNHEALTHY" | "DEGRADED" | string;
export type ContainerState = "RUNNING" | "STOPPED";
export type ApprovalDecision = "APPROVE" | "REJECT" | "APPROVED" | "REJECTED";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type IncidentSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface AIReasoningItem {
  timestamp: string;
  thought: string;
  action?: string | null;
  result?: string | null;
  confidence?: number;
  structured_rca?: StructuredRca;
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
  severity?: IncidentSeverity;
  affected_services?: string[];
  error_rate?: string;
  latency_ms?: number;
  recovery_time?: string;
  resolved_at?: string;
  confidence?: number;
  structured_rca?: StructuredRca;
}

export interface ObservabilityMetrics {
  total_requests: number;
  error_count: number;
  error_rate_pct: number;
  avg_response_time_ms: number;
  cpu_usage_pct: number;
  memory_usage_mb: number;
}

export interface ServiceTelemetry {
  status: ServiceStatus;
  latency_ms?: number;
  error_rate?: string;
  connection?: string;
}

export interface ObservabilityEvidence {
  timestamp: string;
  service_state: string;
  services: {
    "sentinel-db": ServiceTelemetry;
    "dummy-api": ServiceTelemetry;
    "sentinel-backend": ServiceTelemetry;
  };
  metrics: ObservabilityMetrics;
  recent_logs: IncidentLogItem[];
  active_incident: IncidentData | null;
}

export interface InvestigationResult {
  incident_id: string;
  root_cause: string;
  confidence_pct: number;
  evidence_items: string[];
  investigated_at: string;
  affected_services: string[];
  recommended_remediation?: string;
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
  latest_investigation?: InvestigationResult | null;
  observability?: ObservabilityEvidence;
  ai_reasoning: AIReasoningItem[];
  incident_logs: IncidentLogItem[];
  pending_approvals: PendingApproval[];
  policies: GuardrailPolicies;
}



export interface AuditEvent {
  approval_id: string;
  incident_id?: string | null;
  tool_name: string;
  operator_decision: ApprovalDecision;
  timestamp: string;
  execution_result: unknown;
  success: boolean;
  error?: string | null;
}
