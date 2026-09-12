import { getDbPool } from "../db/connection";
import { ReasoningRecord } from "./types";

function getPool() {
  const pool = getDbPool();
  if (!pool) {
    throw new Error(
      "Database connection pool is not initialized. Please configure DATABASE_URL."
    );
  }
  return pool;
}

function mapRowToReasoning(row: Record<string, unknown>): ReasoningRecord {
  return {
    id: String(row.id),
    incident_id: row.incident_id ? String(row.incident_id) : null,
    timestamp: new Date(row.timestamp as string | Date).toISOString(),
    thought: String(row.thought),
    action: row.action !== null && row.action !== undefined ? String(row.action) : null,
    result: row.result !== null && row.result !== undefined ? String(row.result) : null,
    confidence:
      row.confidence !== null && row.confidence !== undefined ? Number(row.confidence) : null,
    structured_rca:
      typeof row.structured_rca === "object" && row.structured_rca !== null
        ? (row.structured_rca as Record<string, unknown>)
        : null,
    turn: row.turn !== null && row.turn !== undefined ? Number(row.turn) : null,
    source: String(row.source || "openai"),
    metadata:
      typeof row.metadata === "object" && row.metadata !== null
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: new Date(row.created_at as string | Date).toISOString(),
  };
}

export class ReasoningRepository {
  /**
   * Append an AI reasoning trace entry.
   */
  static async append(item: {
    incident_id?: string | null;
    timestamp?: string;
    thought: string;
    action?: string | null;
    result?: string | null;
    confidence?: number | null;
    structured_rca?: Record<string, unknown> | null;
    turn?: number | null;
    source?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ReasoningRecord> {
    const pool = getPool();
    const query = `
      INSERT INTO agent_reasoning (
        incident_id, timestamp, thought, action, result,
        confidence, structured_rca, turn, source, metadata
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10
      )
      RETURNING *;
    `;

    const values = [
      item.incident_id ?? null,
      item.timestamp || new Date().toISOString(),
      item.thought,
      item.action ?? null,
      item.result ?? null,
      item.confidence ?? null,
      JSON.stringify(item.structured_rca || null),
      item.turn ?? null,
      item.source || "openai",
      JSON.stringify(item.metadata || {}),
    ];

    const result = await pool.query(query, values);
    return mapRowToReasoning(result.rows[0]);
  }

  /**
   * Retrieve all reasoning trace entries for a specific incident ordered chronologically.
   */
  static async listByIncident(
    incidentId: string,
    limit: number = 100
  ): Promise<ReasoningRecord[]> {
    const pool = getPool();
    const query = `
      SELECT * FROM agent_reasoning
      WHERE incident_id = $1
      ORDER BY timestamp ASC
      LIMIT $2;
    `;
    const result = await pool.query(query, [incidentId, Math.max(1, limit)]);
    return result.rows.map(mapRowToReasoning);
  }
}
