import { getDbPool } from "../db/connection";
import { IncidentRecord } from "./types";

function getPool() {
  const pool = getDbPool();
  if (!pool) {
    throw new Error(
      "Database connection pool is not initialized. Please configure DATABASE_URL."
    );
  }
  return pool;
}

function mapRowToIncident(row: Record<string, unknown>): IncidentRecord {
  return {
    id: String(row.id),
    status: String(row.status),
    detected_at: new Date(row.detected_at as string | Date).toISOString(),
    resolved_at: row.resolved_at ? new Date(row.resolved_at as string | Date).toISOString() : null,
    service: String(row.service || "dummy-api"),
    error: String(row.error),
    root_cause: row.root_cause !== null && row.root_cause !== undefined ? String(row.root_cause) : null,
    confidence:
      row.confidence !== null && row.confidence !== undefined ? Number(row.confidence) : null,
    structured_rca:
      typeof row.structured_rca === "object" && row.structured_rca !== null
        ? (row.structured_rca as Record<string, unknown>)
        : null,
    verification_status:
      (row.verification_status as "PENDING" | "PASSED" | "FAILED" | null) ?? null,
    verification_attempts: Number(row.verification_attempts || 0),
    reinvestigation_attempts: Number(row.reinvestigation_attempts || 0),
    recovery_verified_at: row.recovery_verified_at
      ? new Date(row.recovery_verified_at as string | Date).toISOString()
      : null,
    recovery_time:
      row.recovery_time !== null && row.recovery_time !== undefined
        ? String(row.recovery_time)
        : null,
    escalated: Boolean(row.escalated),
    metadata:
      typeof row.metadata === "object" && row.metadata !== null
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: new Date(row.created_at as string | Date).toISOString(),
    updated_at: new Date(row.updated_at as string | Date).toISOString(),
  };
}

export class IncidentRepository {
  /**
   * Create a new incident record in the database.
   */
  static async create(incident: {
    id: string;
    error: string;
    status?: string;
    detected_at?: string;
    service?: string;
    root_cause?: string | null;
    confidence?: number | null;
    structured_rca?: Record<string, unknown> | null;
    verification_status?: "PENDING" | "PASSED" | "FAILED" | null;
    verification_attempts?: number;
    reinvestigation_attempts?: number;
    recovery_verified_at?: string | null;
    recovery_time?: string | null;
    escalated?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<IncidentRecord> {
    const pool = getPool();
    const query = `
      INSERT INTO incidents (
        id, status, detected_at, service, error, root_cause,
        confidence, structured_rca, verification_status, verification_attempts,
        reinvestigation_attempts, recovery_verified_at, recovery_time,
        escalated, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15
      )
      RETURNING *;
    `;

    const values = [
      incident.id,
      incident.status || "INVESTIGATING",
      incident.detected_at || new Date().toISOString(),
      incident.service || "dummy-api",
      incident.error,
      incident.root_cause ?? null,
      incident.confidence ?? null,
      JSON.stringify(incident.structured_rca || null),
      incident.verification_status ?? null,
      incident.verification_attempts ?? 0,
      incident.reinvestigation_attempts ?? 0,
      incident.recovery_verified_at ?? null,
      incident.recovery_time ?? null,
      incident.escalated ?? false,
      JSON.stringify(incident.metadata || {}),
    ];

    const result = await pool.query(query, values);
    return mapRowToIncident(result.rows[0]);
  }

  /**
   * Retrieve an incident by its public identifier (e.g. 'INC-1726189123').
   */
  static async getById(id: string): Promise<IncidentRecord | null> {
    const pool = getPool();
    const query = `SELECT * FROM incidents WHERE id = $1;`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToIncident(result.rows[0]);
  }

  /**
   * Update mutable fields of an existing incident.
   */
  static async update(
    id: string,
    updates: Partial<{
      status: string;
      resolved_at: string | null;
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
    }>
  ): Promise<IncidentRecord | null> {
    const pool = getPool();
    const setClauses: string[] = [];
    const values: unknown[] = [id];
    let paramIndex = 2;

    const allowedKeys: Array<keyof typeof updates> = [
      "status",
      "resolved_at",
      "root_cause",
      "confidence",
      "structured_rca",
      "verification_status",
      "verification_attempts",
      "reinvestigation_attempts",
      "recovery_verified_at",
      "recovery_time",
      "escalated",
      "metadata",
    ];

    for (const key of allowedKeys) {
      if (key in updates && updates[key] !== undefined) {
        let val = updates[key];
        if (key === "structured_rca" || key === "metadata") {
          val = JSON.stringify(val);
        }
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(val);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return this.getById(id);
    }

    setClauses.push(`updated_at = NOW()`);

    const query = `
      UPDATE incidents
      SET ${setClauses.join(", ")}
      WHERE id = $1
      RETURNING *;
    `;

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToIncident(result.rows[0]);
  }

  /**
   * List recent incidents ordered by detection time descending.
   */
  static async listRecent(limit: number = 50): Promise<IncidentRecord[]> {
    const pool = getPool();
    const query = `
      SELECT * FROM incidents
      ORDER BY detected_at DESC
      LIMIT $1;
    `;
    const result = await pool.query(query, [Math.max(1, limit)]);
    return result.rows.map(mapRowToIncident);
  }

  /**
   * Retrieve active incidents (status not in RESOLVED, FAILED, ESCALATED).
   */
  static async getActive(): Promise<IncidentRecord[]> {
    const pool = getPool();
    const query = `
      SELECT * FROM incidents
      WHERE status IN ('INVESTIGATING', 'DIAGNOSING', 'PLANNING', 'MITIGATING')
      ORDER BY detected_at DESC;
    `;
    const result = await pool.query(query);
    return result.rows.map(mapRowToIncident);
  }
}
