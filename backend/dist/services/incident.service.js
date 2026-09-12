"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.incidentService = void 0;
const ring_buffer_1 = require("../utils/ring-buffer");
const logger_1 = require("../utils/logger");
const socket_1 = require("../realtime/socket");
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
    }
    addAiReasoning(thought, action, result) {
        const timestamp = new Date().toISOString();
        const entry = {
            timestamp,
            thought,
            action: action ?? null,
            result: result ?? null,
        };
        this.aiReasoning.push(entry);
        this.logEvent(`🧠 [AI SRE Reasoning] ${thought}`);
        (0, socket_1.emitSentinelEvent)("agent.reasoning", entry);
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
}
exports.incidentService = new IncidentService();
