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
  severity?: string;
  affected_services?: string[];
  recovery_time?: string;
  resolved_at?: string;
}

export interface ServiceImpactDetail {
  id: string;
  name: string;
  is_direct: boolean;
  is_customer_facing: boolean;
  is_critical: boolean;
  status: string;
  impact_description: string;
}

export interface BlastRadiusAnalysis {
  incident_id: string | null;
  root_cause: string;
  affected_services_count: number;
  customer_impact: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  critical_path_affected: boolean;
  blast_radius_level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
  directly_affected_services: string[];
  indirectly_affected_services: string[];
  service_impacts: ServiceImpactDetail[];
  reasoning: string[];
  analyzed_at: string;
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
  blast_radius?: BlastRadiusAnalysis;
  ai_reasoning: AIReasoningItem[];
  incident_logs: IncidentLogItem[];
  pending_approvals: PendingApproval[];
  policies: GuardrailPolicies;
}
