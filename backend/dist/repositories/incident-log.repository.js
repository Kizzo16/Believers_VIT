"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncidentLogRepository = void 0;
const connection_1 = require("../db/connection");
function getPool() {
    const pool = (0, connection_1.getDbPool)();
    if (!pool) {
        throw new Error("Database connection pool is not initialized. Please configure DATABASE_URL.");
    }
    return pool;
}
function mapRowToLog(row) {
    return {
        id: String(row.id),
        incident_id: row.incident_id ? String(row.incident_id) : null,
        timestamp: new Date(row.timestamp).toISOString(),
        level: row.level || "INFO",
        message: String(row.message),
        metadata: typeof row.metadata === "object" && row.metadata !== null
            ? row.metadata
            : {},
        created_at: new Date(row.created_at).toISOString(),
    };
}
class IncidentLogRepository {
    /**
     * Append a structured log entry.
     */
    static async append(log) {
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
    static async listByIncident(incidentId, limit = 100) {
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
    static async listRecent(limit = 100) {
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
exports.IncidentLogRepository = IncidentLogRepository;
