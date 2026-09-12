"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditRepository = void 0;
const connection_1 = require("../db/connection");
function getPool() {
    const pool = (0, connection_1.getDbPool)();
    if (!pool) {
        throw new Error("Database connection pool is not initialized. Please configure DATABASE_URL.");
    }
    return pool;
}
function mapRowToAudit(row) {
    return {
        id: String(row.id),
        approval_id: row.approval_id ? String(row.approval_id) : null,
        incident_id: row.incident_id ? String(row.incident_id) : null,
        timestamp: new Date(row.timestamp).toISOString(),
        tool_name: String(row.tool_name),
        operator_decision: row.operator_decision,
        operator_id: String(row.operator_id || "operator"),
        execution_result: row.execution_result !== null && row.execution_result !== undefined
            ? String(row.execution_result)
            : null,
        success: Boolean(row.success),
        error: row.error !== null && row.error !== undefined ? String(row.error) : null,
        metadata: typeof row.metadata === "object" && row.metadata !== null
            ? row.metadata
            : {},
        created_at: new Date(row.created_at).toISOString(),
    };
}
class AuditRepository {
    /**
     * Append an immutable audit event to the ledger.
     */
    static async append(event) {
        const pool = getPool();
        const query = `
      INSERT INTO audit_events (
        approval_id, incident_id, timestamp, tool_name,
        operator_decision, operator_id, execution_result,
        success, error, metadata
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10
      )
      RETURNING *;
    `;
        const values = [
            event.approval_id ?? null,
            event.incident_id ?? null,
            event.timestamp || new Date().toISOString(),
            event.tool_name,
            event.operator_decision,
            event.operator_id || "operator",
            event.execution_result !== undefined ? String(event.execution_result) : null,
            event.success !== undefined ? Boolean(event.success) : true,
            event.error ?? null,
            JSON.stringify(event.metadata || {}),
        ];
        const result = await pool.query(query, values);
        return mapRowToAudit(result.rows[0]);
    }
    /**
     * List recent audit events ordered by timestamp descending.
     */
    static async listRecent(limit = 50) {
        const pool = getPool();
        const query = `
      SELECT * FROM audit_events
      ORDER BY timestamp DESC
      LIMIT $1;
    `;
        const result = await pool.query(query, [Math.max(1, limit)]);
        return result.rows.map(mapRowToAudit);
    }
    /**
     * Retrieve all audit events associated with a specific incident.
     */
    static async listByIncident(incidentId) {
        const pool = getPool();
        const query = `
      SELECT * FROM audit_events
      WHERE incident_id = $1
      ORDER BY timestamp DESC;
    `;
        const result = await pool.query(query, [incidentId]);
        return result.rows.map(mapRowToAudit);
    }
    /**
     * Retrieve all audit events associated with a specific approval ID.
     */
    static async listByApproval(approvalId) {
        const pool = getPool();
        const query = `
      SELECT * FROM audit_events
      WHERE approval_id = $1
      ORDER BY timestamp DESC;
    `;
        const result = await pool.query(query, [approvalId]);
        return result.rows.map(mapRowToAudit);
    }
}
exports.AuditRepository = AuditRepository;
