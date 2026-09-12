/**
 * Sentinel Persistence Repository Layer - Domain Types
 * Clean, typed representations of database rows mapped into application domain models.
 */

export interface IncidentRecord {
  id: string;
  status: string;
  detected_at: string;
  resolved_at: string | null;
  service: string;
  error: string;
  root_cause: string | null;
  confidence: number | null;
  structured_rca: Record<string, unknown> | null;
  verification_status: "PENDING" | "PASSED" | "FAILED" | null;
  verification_attempts: number;
  reinvestigation_attempts: number;
  recovery_verified_at: string | null;
  recovery_time: string | null;
  escalated: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IncidentLogRecord {
  id: string;
  incident_id: string | null;
  timestamp: string;
  level: "INFO" | "WARNING" | "ERROR" | "DEBUG";
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ReasoningRecord {
  id: string;
  incident_id: string | null;
  timestamp: string;
  thought: string;
  action: string | null;
  result: string | null;
  confidence: number | null;
  structured_rca: Record<string, unknown> | null;
  turn: number | null;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ApprovalRecord {
  id: string;
  incident_id: string | null;
  tool_name: string;
  kwargs: Record<string, unknown>;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";
  status: "PENDING" | "APPROVED" | "REJECTED";
  requested_at: string;
  decision: "APPROVE" | "REJECT" | "APPROVED" | "REJECTED" | null;
  decided_at: string | null;
  decided_by: string | null;
  execution_result: string | null;
  success: boolean | null;
  error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AuditRecord {
  id: string;
  approval_id: string | null;
  incident_id: string | null;
  timestamp: string;
  tool_name: string;
  operator_decision: "APPROVE" | "REJECT" | "APPROVED" | "REJECTED" | "AUTO_EXECUTE";
  operator_id: string;
  execution_result: string | null;
  success: boolean;
  error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
