-- ============================================================================
-- Sentinel Control Plane Initial Schema
-- Migration: 001_initial_sentinel_schema.sql
-- Purpose: Schema foundation for Sentinel control-plane persistence
-- ============================================================================

-- 1. INCIDENTS TABLE
-- Represents the operational incident lifecycle
CREATE TABLE IF NOT EXISTS incidents (
    id VARCHAR(64) PRIMARY KEY,
    status VARCHAR(32) NOT NULL DEFAULT 'INVESTIGATING'
        CHECK (status IN ('INVESTIGATING', 'DIAGNOSING', 'PLANNING', 'MITIGATING', 'RESOLVED', 'ESCALATED', 'FAILED')),
    detected_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    service VARCHAR(64) DEFAULT 'dummy-api',
    error TEXT NOT NULL,
    root_cause TEXT,
    confidence NUMERIC(3, 2) CHECK (confidence IS NULL OR (confidence >= 0.0 AND confidence <= 1.0)),
    structured_rca JSONB,
    verification_status VARCHAR(32) CHECK (verification_status IS NULL OR verification_status IN ('PENDING', 'PASSED', 'FAILED')),
    verification_attempts INT NOT NULL DEFAULT 0,
    reinvestigation_attempts INT NOT NULL DEFAULT 0,
    recovery_verified_at TIMESTAMPTZ,
    recovery_time VARCHAR(32),
    escalated BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);
CREATE INDEX IF NOT EXISTS idx_incidents_detected_at ON incidents (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_service ON incidents (service);

-- 2. INCIDENT LOGS TABLE
-- Persists structured incident and system log events
CREATE TABLE IF NOT EXISTS incident_logs (
    id BIGSERIAL PRIMARY KEY,
    incident_id VARCHAR(64) REFERENCES incidents(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level VARCHAR(16) NOT NULL DEFAULT 'INFO'
        CHECK (level IN ('INFO', 'WARNING', 'ERROR', 'DEBUG')),
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_logs_incident_ts ON incident_logs (incident_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_incident_logs_level ON incident_logs (level);
CREATE INDEX IF NOT EXISTS idx_incident_logs_timestamp ON incident_logs (timestamp DESC);

-- 3. AGENT REASONING TABLE
-- Persists AI cognitive investigation steps and observations
CREATE TABLE IF NOT EXISTS agent_reasoning (
    id BIGSERIAL PRIMARY KEY,
    incident_id VARCHAR(64) REFERENCES incidents(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    thought TEXT NOT NULL,
    action VARCHAR(128),
    result TEXT,
    confidence NUMERIC(3, 2) CHECK (confidence IS NULL OR (confidence >= 0.0 AND confidence <= 1.0)),
    structured_rca JSONB,
    turn INT,
    source VARCHAR(32) DEFAULT 'openai',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_reasoning_incident_ts ON agent_reasoning (incident_id, timestamp DESC);

-- 4. APPROVALS TABLE
-- Persists human-in-the-loop (HITL) authorization requests and decisions
CREATE TABLE IF NOT EXISTS approvals (
    id VARCHAR(64) PRIMARY KEY,
    incident_id VARCHAR(64) REFERENCES incidents(id) ON DELETE SET NULL,
    tool_name VARCHAR(64) NOT NULL,
    kwargs JSONB NOT NULL DEFAULT '{}'::jsonb,
    risk VARCHAR(16) NOT NULL DEFAULT 'HIGH'
        CHECK (risk IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN')),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decision VARCHAR(16)
        CHECK (decision IS NULL OR decision IN ('APPROVE', 'REJECT', 'APPROVED', 'REJECTED')),
    decided_at TIMESTAMPTZ,
    decided_by VARCHAR(128),
    execution_result TEXT,
    success BOOLEAN,
    error TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_incident_id ON approvals (incident_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals (status);
CREATE INDEX IF NOT EXISTS idx_approvals_requested_at ON approvals (requested_at DESC);

-- 5. AUDIT EVENTS TABLE
-- Immutable append-only audit trail of security and operational decisions
CREATE TABLE IF NOT EXISTS audit_events (
    id BIGSERIAL PRIMARY KEY,
    approval_id VARCHAR(64) REFERENCES approvals(id) ON DELETE SET NULL,
    incident_id VARCHAR(64) REFERENCES incidents(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tool_name VARCHAR(64) NOT NULL,
    operator_decision VARCHAR(32) NOT NULL
        CHECK (operator_decision IN ('APPROVE', 'REJECT', 'APPROVED', 'REJECTED', 'AUTO_EXECUTE')),
    operator_id VARCHAR(128) NOT NULL DEFAULT 'operator',
    execution_result TEXT,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_incident_ts ON audit_events (incident_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_approval_id ON audit_events (approval_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_tool_name ON audit_events (tool_name);
