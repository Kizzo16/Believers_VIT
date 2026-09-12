import { getDbPool } from "../db/connection";
import { IncidentLogRecord } from "./types";

function getPool() {
  const pool = getDbPool();
  if (!pool) {
    throw new Error(
      "Database connection pool is not initialized. Please configure DATABASE_URL."
    );
  }
  return pool;
}

function mapRowToLog(row: Record<string, unknown>): IncidentLogRecord {
  return {
    id: String(row.id),
    incident_id: row.incident_id ? String(row.incident_id) : null,
    timestamp: new Date(row.timestamp as string | Date).toISOString(),
    level: (row.level as IncidentLogRecord["level"]) || "INFO",
    message: String(row.message),
    metadata:
      typeof row.metadata === "object" && row.metadata !== null
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: new Date(row.created_at as string | Date).toISOString(),
  };
}

export class IncidentLogRepository {
  /**
   * Append a structured log entry.
   */
  static async append(log: {
    incident_id?: string | null;
    timestamp?: string;
    level?: "INFO" | "WARNING" | "ERROR" | "DEBUG" | string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<IncidentLogRecord> {
    const pool = getPool();
    const query = `
      INSERT INTO incident_logs (
        incident_id, timestamp, level, message, metadata
      ) VALUES (
        $1, $2, $3, $4, $5
      )
      RETURNING *;
    `;

    const values = [
      log.incident_id ?? null,
      log.timestamp || new Date().toISOString(),
      log.level || "INFO",
      log.message,
      JSON.stringify(log.metadata || {}),
    ];

    const result = await pool.query(query, values);
    return mapRowToLog(result.rows[0]);
  }

  /**
   * Retrieve logs for a specific incident ordered chronologically (oldest first).
   */
  static async listByIncident(
    incidentId: string,
    limit: number = 100
  ): Promise<IncidentLogRecord[]> {
    const pool = getPool();
    const query = `
      SELECT * FROM incident_logs
      WHERE incident_id = $1
      ORDER BY timestamp ASC
      LIMIT $2;
    `;
    const result = await pool.query(query, [incidentId, Math.max(1, limit)]);
    return result.rows.map(mapRowToLog);
  }

  /**
   * Retrieve recent logs across the system ordered by timestamp descending.
   */
  static async listRecent(limit: number = 100): Promise<IncidentLogRecord[]> {
    const pool = getPool();
    const query = `
      SELECT * FROM incident_logs
      ORDER BY timestamp DESC
      LIMIT $1;
    `;
    const result = await pool.query(query, [Math.max(1, limit)]);
    return result.rows.map(mapRowToLog);
  }
}
