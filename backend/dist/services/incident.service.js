"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.incidentService = void 0;
const ring_buffer_1 = require("../utils/ring-buffer");
const logger_1 = require("../utils/logger");
const socket_1 = require("../realtime/socket");
const incident_repository_1 = require("../repositories/incident.repository");
const approval_repository_1 = require("../repositories/approval.repository");
const incident_log_repository_1 = require("../repositories/incident-log.repository");
const reasoning_repository_1 = require("../repositories/reasoning.repository");
const persistence_1 = require("../utils/persistence");
const connection_1 = require("../db/connection");
class IncidentService {
    systemHealth = "HEALTHY";
    dummyApiStatus = "UP";
    databaseStatus = "UP";
    lastPingTime = null;
    lastPingCode = 200;
    activeIncident = false;
    currentIncident = null;
    incidentLogs = new ring_buffer_1.RingBuffer(100);
    aiReasoning = new ring_buffer_1.RingBuffer(100);
    pendingApprovals = new ring_buffer_1.RingBuffer(100);
    logEvent(message, level = "INFO") {
        const timestamp = new Date().toISOString();
        const entry = { timestamp, level, message };
        this.incidentLogs.push(entry);
        if (level === "ERROR") {
            logger_1.logger.error(`[${level}] ${message}`);
        }
        else if (level === "WARNING") {
            logger_1.logger.warn(`[${level}] ${message}`);
        }
        else {
            logger_1.logger.info(`[${level}] ${message}`);
        }
        (0, socket_1.emitSentinelEvent)("incident.log", entry);
        // Asynchronous non-blocking write-through to PostgreSQL
        const currentIncId = this.currentIncident?.id ?? null;
        void incident_log_repository_1.IncidentLogRepository.append({
            incident_id: currentIncId,
            timestamp,
            level,
            message,
        }).catch((err) => {
            (0, persistence_1.logPersistenceWarning)("IncidentLogRepository", "append", currentIncId, err);
        });
    }
    addAiReasoning(thought, action, result, options) {
        const timestamp = new Date().toISOString();
        const entry = {
            timestamp,
            thought,
            action: action ?? null,
            result: result ?? null,
            confidence: options?.confidence ?? undefined,
            structured_rca: options?.structured_rca,
        };
        this.aiReasoning.push(entry);
        this.logEvent(`🧠 [AI SRE Reasoning] ${thought}`);
        (0, socket_1.emitSentinelEvent)("agent.reasoning", entry);
        // Asynchronous non-blocking write-through to PostgreSQL
        const incId = options?.incident_id ?? this.currentIncident?.id ?? null;
        void reasoning_repository_1.ReasoningRepository.append({
            incident_id: incId,
            timestamp,
            thought,
            action: action ?? null,
            result: result ?? null,
            confidence: options?.confidence ?? null,
            structured_rca: options?.structured_rca ?? null,
            turn: options?.turn ?? null,
            source: options?.source ?? "openai",
        }).catch((err) => {
            (0, persistence_1.logPersistenceWarning)("ReasoningRepository", "append", incId, err);
        });
    }
    getSystemHealth() {
        return this.systemHealth;
    }
    setSystemHealth(health) {
        this.systemHealth = health;
        (0, socket_1.emitSentinelEvent)("incident.health_changed", { health });
    }
    getDummyApiStatus() {
        return this.dummyApiStatus;
    }
    setDummyApiStatus(status) {
        this.dummyApiStatus = status;
    }
    getDatabaseStatus() {
        return this.databaseStatus;
    }
    setDatabaseStatus(status) {
        this.databaseStatus = status;
    }
    getLastPingTime() {
        return this.lastPingTime;
    }
    setLastPingTime(time) {
        this.lastPingTime = time;
    }
    getLastPingCode() {
        return this.lastPingCode;
    }
    setLastPingCode(code) {
        this.lastPingCode = code;
    }
    isActiveIncident() {
        return this.activeIncident;
    }
    setActiveIncident(active) {
        this.activeIncident = active;
    }
    getCurrentIncident() {
        return this.currentIncident;
    }
    setCurrentIncident(incident) {
        this.currentIncident = incident;
        if (incident) {
            (0, socket_1.emitSentinelEvent)("incident.detected", incident);
        }
    }
    addPendingApproval(approval) {
        this.pendingApprovals.push(approval);
        (0, socket_1.emitSentinelEvent)("approval.requested", approval);
    }
    findPendingApproval(id) {
        return this.pendingApprovals.find((a) => a.id === id);
    }
    /**
     * Safe restart-recovery rehydration from PostgreSQL control database.
     * Restores active incident, pending approvals, recent logs, and reasoning traces
     * into memory-only ring buffers and properties.
     *
     * Invariants:
     * - Bounded timeout (default 4000ms)
     * - Zero unhandled exceptions or crashes
     * - Zero Socket.IO live event emissions
     * - Zero automated agent invocations or remediation tool executions
     * - Operates in degraded in-memory mode if control DB is unreachable
     */
    async rehydrateFromDatabase(timeoutMs = 4000) {
        const pool = (0, connection_1.getDbPool)();
        if (!pool) {
            logger_1.logger.info("[Startup Recovery] Control database pool not configured. Operating in memory-only mode.");
            return;
        }
        const rehydrateTask = async () => {
            // 1. Active Incident Rehydration
            const activeIncidents = await incident_repository_1.IncidentRepository.getActive();
            let restoredIncident = null;
            if (activeIncidents.length === 1) {
                const inc = activeIncidents[0];
                restoredIncident = {
                    id: inc.id,
                    detected_at: inc.detected_at,
                    error: inc.error,
                    status: inc.status,
                    recovery_time: inc.recovery_time ?? undefined,
                    resolved_at: inc.resolved_at ?? undefined,
                    confidence: inc.confidence ?? undefined,
                    structured_rca: inc.structured_rca ?? undefined,
                    verification_status: inc.verification_status,
                    verification_attempts: inc.verification_attempts,
                    reinvestigation_attempts: inc.reinvestigation_attempts,
                    recovery_verified_at: inc.recovery_verified_at,
                };
                this.currentIncident = restoredIncident;
                this.activeIncident = true;
                this.systemHealth = "INCIDENT_ACTIVE";
                logger_1.logger.info({ incidentId: inc.id, status: inc.status }, `[Startup Recovery] Rehydrated active incident ${inc.id} (${inc.status})`);
            }
            else if (activeIncidents.length > 1) {
                const inc = activeIncidents[0];
                logger_1.logger.warn({ count: activeIncidents.length, ids: activeIncidents.map((i) => i.id) }, `[Startup Recovery Warning] Multiple active incidents found in database (${activeIncidents.length}). Selecting most recent (${inc.id}) for continuity. Manual reconciliation recommended.`);
                restoredIncident = {
                    id: inc.id,
                    detected_at: inc.detected_at,
                    error: inc.error,
                    status: inc.status,
                    recovery_time: inc.recovery_time ?? undefined,
                    resolved_at: inc.resolved_at ?? undefined,
                    confidence: inc.confidence ?? undefined,
                    structured_rca: inc.structured_rca ?? undefined,
                    verification_status: inc.verification_status,
                    verification_attempts: inc.verification_attempts,
                    reinvestigation_attempts: inc.reinvestigation_attempts,
                    recovery_verified_at: inc.recovery_verified_at,
                };
                this.currentIncident = restoredIncident;
                this.activeIncident = true;
                this.systemHealth = "INCIDENT_ACTIVE";
            }
            else {
                this.currentIncident = null;
                this.activeIncident = false;
                logger_1.logger.info("[Startup Recovery] No active incidents found in database.");
            }
            // 2. Pending Approval Rehydration (into memory without event emission or execution)
            const pendingList = await approval_repository_1.ApprovalRepository.listPending();
            for (const app of pendingList) {
                const pendingItem = {
                    id: app.id,
                    incident_id: app.incident_id,
                    tool_name: app.tool_name,
                    kwargs: app.kwargs,
                    risk: app.risk,
                    status: app.status,
                    requested_at: app.requested_at,
                    decision: app.decision ?? null,
                    decided_at: app.decided_at,
                    execution_result: app.execution_result ?? undefined,
                    success: app.success,
                    error: app.error,
                };
                this.pendingApprovals.push(pendingItem);
            }
            if (pendingList.length > 0) {
                logger_1.logger.info({ count: pendingList.length }, `[Startup Recovery] Restored ${pendingList.length} pending approval(s) into in-memory queue`);
            }
            // 3. Incident Log Rehydration (up to 100 items, direct push without Socket.IO emission)
            let logsToHydrate = [];
            if (restoredIncident) {
                const dbLogs = await incident_log_repository_1.IncidentLogRepository.listByIncident(restoredIncident.id, 100);
                logsToHydrate = dbLogs.map((l) => ({
                    timestamp: l.timestamp,
                    level: l.level,
                    message: l.message,
                }));
            }
            else {
                const dbLogs = await incident_log_repository_1.IncidentLogRepository.listRecent(100);
                // listRecent is sorted DESC; reverse to ASC for chronological insertion
                logsToHydrate = dbLogs
                    .slice()
                    .reverse()
                    .map((l) => ({
                    timestamp: l.timestamp,
                    level: l.level,
                    message: l.message,
                }));
            }
            for (const logItem of logsToHydrate) {
                this.incidentLogs.push(logItem);
            }
            if (logsToHydrate.length > 0) {
                logger_1.logger.info({ count: logsToHydrate.length }, `[Startup Recovery] Restored ${logsToHydrate.length} log entry(ies) into in-memory buffer`);
            }
            // 4. AI Reasoning Rehydration (up to 100 items, direct push without Socket.IO emission)
            if (restoredIncident) {
                const dbReasoning = await reasoning_repository_1.ReasoningRepository.listByIncident(restoredIncident.id, 100);
                for (const r of dbReasoning) {
                    const reasoningItem = {
                        timestamp: r.timestamp,
                        thought: r.thought,
                        action: r.action,
                        result: r.result,
                        confidence: r.confidence ?? undefined,
                        structured_rca: r.structured_rca ?? undefined,
                    };
                    this.aiReasoning.push(reasoningItem);
                }
                if (dbReasoning.length > 0) {
                    logger_1.logger.info({ count: dbReasoning.length }, `[Startup Recovery] Restored ${dbReasoning.length} reasoning record(s) into in-memory buffer`);
                }
            }
        };
        let timedOut = false;
        let timeoutHandle = null;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => {
                timedOut = true;
                reject(new Error(`Startup rehydration timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });
        const safeTaskPromise = rehydrateTask().catch((err) => {
            if (timedOut) {
                // Late error after timeout fired; log safely and contain rejection
                logger_1.logger.warn({ error: err instanceof Error ? err.message : String(err) }, "[Startup Recovery Warning] Rehydration task failed after timeout.");
                return;
            }
            throw err;
        });
        try {
            await Promise.race([safeTaskPromise, timeoutPromise]);
            logger_1.logger.info("[Startup Recovery] Safe rehydration completed successfully.");
        }
        catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.warn({ error: errMsg }, "[Startup Recovery Warning] Failed to rehydrate state from control database. Continuing in degraded in-memory mode.");
        }
        finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
    }
}
exports.incidentService = new IncidentService();
