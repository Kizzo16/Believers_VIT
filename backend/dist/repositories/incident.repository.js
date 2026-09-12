"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncidentRepository = void 0;
const connection_1 = require("../db/connection");
function getPool() {
    const pool = (0, connection_1.getDbPool)();
    if (!pool) {
        throw new Error("Database connection pool is not initialized. Please configure DATABASE_URL.");
    }
    return pool;
}
function mapRowToIncident(row) {
    return {
        id: String(row.id),
        status: String(row.status),
        detected_at: new Date(row.detected_at).toISOString(),
        resolved_at: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
        service: String(row.service || "dummy-api"),
        error: String(row.error),
        root_cause: row.root_cause !== null && row.root_cause !== undefined ? String(row.root_cause) : null,
        confidence: row.confidence !== null && row.confidence !== undefined ? Number(row.confidence) : null,
        structured_rca: typeof row.structured_rca === "object" && row.structured_rca !== null
            ? row.structured_rca
            : null,
        verification_status: row.verification_status ?? null,
        verification_attempts: Number(row.verification_attempts || 0),
        reinvestigation_attempts: Number(row.reinvestigation_attempts || 0),
        recovery_verified_at: row.recovery_verified_at
            ? new Date(row.recovery_verified_at).toISOString()
            : null,
        recovery_time: row.recovery_time !== null && row.recovery_time !== undefined
            ? String(row.recovery_time)
            : null,
        escalated: Boolean(row.escalated),
        metadata: typeof row.metadata === "object" && row.metadata !== null
            ? row.metadata
            : {},
        created_at: new Date(row.created_at).toISOString(),
        updated_at: new Date(row.updated_at).toISOString(),
    };
}
class IncidentRepository {
    /**
     * Create a new incident record in the database.
     */
    static async create(incident) {
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
    static async getById(id) {
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
    static async update(id, updates) {
        const pool = getPool();
        const setClauses = [];
        const values = [id];
        let paramIndex = 2;
        const allowedKeys = [
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
    static async listRecent(limit = 50) {
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
    static async getActive() {
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
exports.IncidentRepository = IncidentRepository;
