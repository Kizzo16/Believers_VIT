import { getDbPool } from "../db/connection";
import { ApprovalRecord } from "./types";

function getPool() {
  const pool = getDbPool();
  if (!pool) {
    throw new Error(
      "Database connection pool is not initialized. Please configure DATABASE_URL."
    );
  }
  return pool;
}

function mapRowToApproval(row: Record<string, unknown>): ApprovalRecord {
  return {
    id: String(row.id),
    incident_id: row.incident_id ? String(row.incident_id) : null,
    tool_name: String(row.tool_name),
    kwargs:
      typeof row.kwargs === "object" && row.kwargs !== null
        ? (row.kwargs as Record<string, unknown>)
        : {},
    risk: (row.risk as ApprovalRecord["risk"]) || "HIGH",
    status: (row.status as ApprovalRecord["status"]) || "PENDING",
    requested_at: new Date(row.requested_at as string | Date).toISOString(),
    decision: (row.decision as ApprovalRecord["decision"]) ?? null,
    decided_at: row.decided_at ? new Date(row.decided_at as string | Date).toISOString() : null,
    decided_by: row.decided_by ? String(row.decided_by) : null,
    execution_result:
      row.execution_result !== null && row.execution_result !== undefined
        ? String(row.execution_result)
        : null,
    success: row.success !== null && row.success !== undefined ? Boolean(row.success) : null,
    error: row.error !== null && row.error !== undefined ? String(row.error) : null,
    metadata:
      typeof row.metadata === "object" && row.metadata !== null
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: new Date(row.created_at as string | Date).toISOString(),
    updated_at: new Date(row.updated_at as string | Date).toISOString(),
  };
}

export class ApprovalRepository {
  /**
   * Persist a new pending approval record.
   */
  static async create(approval: {
    id: string;
    incident_id?: string | null;
    tool_name: string;
    kwargs: Record<string, unknown>;
    risk?: string;
    status?: string;
    requested_at?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ApprovalRecord> {
    const pool = getPool();
    const query = `
      INSERT INTO approvals (
        id, incident_id, tool_name, kwargs, risk,
        status, requested_at, metadata
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8
      )
      RETURNING *;
    `;

    const values = [
      approval.id,
      approval.incident_id ?? null,
      approval.tool_name,
      JSON.stringify(approval.kwargs || {}),
      approval.risk || "HIGH",
      approval.status || "PENDING",
      approval.requested_at || new Date().toISOString(),
      JSON.stringify(approval.metadata || {}),
    ];

    const result = await pool.query(query, values);
    return mapRowToApproval(result.rows[0]);
  }

  /**
   * Retrieve an approval record by its ID (e.g. 'APPR-1726189123-456').
   */
  static async getById(id: string): Promise<ApprovalRecord | null> {
    const pool = getPool();
    const query = `SELECT * FROM approvals WHERE id = $1;`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToApproval(result.rows[0]);
  }

  /**
   * Update the decision and execution outcome of an approval.
   */
  static async updateDecision(
    id: string,
    decision: {
      decision: "APPROVE" | "REJECT" | "APPROVED" | "REJECTED";
      status: "PENDING" | "APPROVED" | "REJECTED";
      decided_at?: string;
      decided_by?: string | null;
      execution_result?: unknown;
      success?: boolean | null;
      error?: string | null;
    }
  ): Promise<ApprovalRecord | null> {
    const pool = getPool();
    const query = `
      UPDATE approvals
      SET
        decision = $2,
        status = $3,
        decided_at = $4,
        decided_by = $5,
        execution_result = $6,
        success = $7,
        error = $8,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;

    const values = [
      id,
      decision.decision,
      decision.status,
      decision.decided_at || new Date().toISOString(),
      decision.decided_by ?? null,
      decision.execution_result !== undefined ? String(decision.execution_result) : null,
      decision.success ?? null,
      decision.error ?? null,
    ];

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToApproval(result.rows[0]);
  }

  /**
   * Retrieve all currently pending approvals ordered by request time descending.
   */
  static async listPending(): Promise<ApprovalRecord[]> {
    const pool = getPool();
    const query = `
      SELECT * FROM approvals
      WHERE status = 'PENDING'
      ORDER BY requested_at DESC;
    `;
    const result = await pool.query(query);
    return result.rows.map(mapRowToApproval);
  }

  /**
   * Retrieve all approvals associated with a specific incident.
   */
  static async listByIncident(incidentId: string): Promise<ApprovalRecord[]> {
    const pool = getPool();
    const query = `
      SELECT * FROM approvals
      WHERE incident_id = $1
      ORDER BY requested_at DESC;
    `;
    const result = await pool.query(query, [incidentId]);
    return result.rows.map(mapRowToApproval);
  }
}
