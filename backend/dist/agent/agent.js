"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_AGENT_TURNS = exports.MAX_REINVESTIGATION_ATTEMPTS = exports.SENTINEL_SYSTEM_PROMPT = void 0;
exports.collectFreshInvestigationEvidence = collectFreshInvestigationEvidence;
exports.verifyIncidentRecovery = verifyIncidentRecovery;
exports.callLlmSreAgent = callLlmSreAgent;
const openai_1 = __importDefault(require("openai"));
const incident_service_1 = require("../services/incident.service");
const policy_engine_1 = require("../safety/policy-engine");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const socket_1 = require("../realtime/socket");
const tools_1 = require("./tools");
const schemas_1 = require("../safety/schemas");
const incident_repository_1 = require("../repositories/incident.repository");
const persistence_1 = require("../utils/persistence");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// OpenAI tool declarations formatted for the API
const OPENAI_TOOL_DECLARATIONS = tools_1.LIVE_OPENAI_TOOLS.map((t) => ({
    type: "function",
    function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
    },
}));
exports.SENTINEL_SYSTEM_PROMPT = `You are Sentinel, an autonomous SRE investigation agent for mission-critical production infrastructure.
Your operational mandates:
1. You must use ONLY declared Sentinel tools.
2. Base all conclusions and root cause analyses strictly on provided telemetry, logs, and tool output evidence.
3. Do NOT invent infrastructure state, logs, or metrics.
4. NEVER attempt or request shell access, terminal commands, or arbitrary Docker commands.
5. Prefer investigation/diagnostic tools (e.g. get_service_logs, check_database, check_service) before proposing remediation actions.
6. A proposed remediation action is strictly a proposal until deterministic Zod validation and Guardrail Policy Engine evaluation succeed.
7. If evidence is insufficient to diagnose the root cause with certainty, state that evidence is insufficient.
8. Calibrate and provide a confidence score as a number between 0.0 and 1.0.
9. Do not claim recovery has completed until verification evidence confirms healthy status.

In Turn 2 (after tool results are returned), you MUST reply with a valid JSON object in EXACTLY this shape — no markdown, no prose, no extra keys:
{
  "root_cause": "<one-sentence root cause>",
  "confidence": <float 0.0-1.0>,
  "evidence": ["<evidence string 1>", "<evidence string 2>"],
  "proposed_action": {
    "tool": "<tool_name>",
    "arguments": { "<key>": "<value>" }
  }
}`;
// ============================================================================
// HELPER: parse and Zod-validate a model tool call
// Returns { toolName, validatedArgs } on success or throws with a clear message
// ============================================================================
function parseAndValidateToolCall(toolCall) {
    if (toolCall.type !== "function") {
        throw new Error(`Unsupported tool call type: ${toolCall.type}`);
    }
    const toolName = toolCall.function.name;
    const toolCallId = toolCall.id;
    // Parse raw JSON arguments from model
    let parsedArgs = {};
    try {
        parsedArgs = JSON.parse(toolCall.function.arguments || "{}");
    }
    catch {
        throw new Error(`Malformed JSON in model tool arguments for '${toolName}': ${toolCall.function.arguments}`);
    }
    // Verify tool exists in our Zod schema registry
    if (!Object.prototype.hasOwnProperty.call(schemas_1.TOOL_SCHEMAS, toolName)) {
        throw new Error(`Model requested unknown/unsupported tool '${toolName}'`);
    }
    // Strict Zod validation of arguments
    const schema = schemas_1.TOOL_SCHEMAS[toolName];
    const validation = schema.safeParse(parsedArgs);
    if (!validation.success) {
        throw new Error(`Tool argument validation failed for '${toolName}': ${JSON.stringify(validation.error.errors)}`);
    }
    return {
        toolName,
        validatedArgs: validation.data,
        toolCallId,
    };
}
// ============================================================================
// HELPER: parse structured RCA from Turn 2 model response
// Returns parsed StructuredRca or null if malformed/absent
// ============================================================================
function parseStructuredRca(content) {
    if (!content)
        return null;
    // Strip markdown code fences if present
    const stripped = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
        const parsed = JSON.parse(stripped);
        const validation = schemas_1.StructuredRcaSchema.safeParse(parsed);
        if (validation.success) {
            return validation.data;
        }
        logger_1.logger.warn({ errors: validation.error.errors }, "[Agent] Turn 2 RCA Zod validation failed");
        return null;
    }
    catch {
        logger_1.logger.warn({ content: stripped }, "[Agent] Turn 2 RCA JSON parse failed");
        return null;
    }
}
// ============================================================================
// DETERMINISTIC BOUNDS & VERIFICATION HELPERS (STEP 2F)
// ============================================================================
exports.MAX_REINVESTIGATION_ATTEMPTS = 1;
exports.MAX_AGENT_TURNS = 4;
/**
 * Collect fresh operational evidence from the running environment for re-investigation.
 */
async function collectFreshInvestigationEvidence() {
    const { TOOLS } = await Promise.resolve().then(() => __importStar(require("./tools")));
    const freshMetrics = await TOOLS.get_metrics({});
    const freshLogs = await TOOLS.get_service_logs({ service: "dummy-api" });
    const freshDb = await TOOLS.check_database({ service: "sentinel-db" });
    const freshService = await TOOLS.check_service({ service: "dummy-api" });
    return [
        `--- FRESH OPERATIONAL EVIDENCE ---`,
        `Database Probe: ${freshDb}`,
        `Service Probe: ${freshService}`,
        `Telemetry Metrics:\n${freshMetrics}`,
        `Recent dummy-api Logs:\n${freshLogs.slice(-1000)}`,
    ].join("\n\n");
}
/**
 * Explicit closed-loop recovery verification tool execution.
 * ACTION EXECUTED is NOT equivalent to RECOVERY VERIFIED.
 * Transitions incident to RESOLVED only when runtime evidence confirms healthy state.
 */
async function verifyIncidentRecovery(incident, serviceToVerify) {
    const targetService = serviceToVerify === "sentinel-db" || serviceToVerify === "dummy-api"
        ? serviceToVerify
        : "dummy-api";
    incident_service_1.incidentService.logEvent(`🔍 [Verification Started] Executing explicit closed-loop recovery check for '${targetService}'`);
    incident_service_1.incidentService.addAiReasoning(`Executing explicit closed-loop recovery check for '${targetService}' via verify_recovery...`, `verify_recovery(service='${targetService}')`);
    (0, socket_1.emitSentinelEvent)("agent.phase_changed", { phase: "VERIFYING", incident_id: incident.id });
    (0, socket_1.emitSentinelEvent)("verification.started", { incident_id: incident.id, service: targetService });
    const verifyExecResult = await (0, policy_engine_1.executeToolWithGuardrail)("verify_recovery", incident.id, {
        service: targetService,
    });
    let verified = false;
    let evidence = [];
    const rawResult = typeof verifyExecResult.result === "string"
        ? verifyExecResult.result
        : JSON.stringify(verifyExecResult.result);
    try {
        const parsed = JSON.parse(rawResult);
        verified = Boolean(parsed.verified);
        evidence = Array.isArray(parsed.evidence)
            ? parsed.evidence
            : [String(parsed.evidence ?? rawResult)];
    }
    catch {
        verified = false;
        evidence = [rawResult];
    }
    incident.verification_attempts = (incident.verification_attempts || 0) + 1;
    if (verified) {
        incident.verification_status = "PASSED";
        incident.recovery_verified_at = new Date().toISOString();
        incident.status = "RESOLVED";
        const detectedDt = new Date(incident.detected_at).getTime();
        const elapsedSec = Math.max(1, Math.floor((Date.now() - detectedDt) / 1000));
        incident.recovery_time = `${elapsedSec}s`;
        incident.resolved_at = new Date().toISOString();
        incident_service_1.incidentService.setActiveIncident(false);
        incident_service_1.incidentService.setSystemHealth("HEALTHY");
        if (targetService === "dummy-api") {
            incident_service_1.incidentService.setDummyApiStatus("UP");
        }
        else if (targetService === "sentinel-db") {
            incident_service_1.incidentService.setDatabaseStatus("UP");
        }
        // STEP 2: Persist verified recovery state to PostgreSQL
        void (0, persistence_1.safePersist)("IncidentRepository", "update", incident.id, () => incident_repository_1.IncidentRepository.update(incident.id, {
            status: "RESOLVED",
            resolved_at: incident.resolved_at,
            verification_status: "PASSED",
            verification_attempts: incident.verification_attempts,
            recovery_verified_at: incident.recovery_verified_at,
            recovery_time: incident.recovery_time,
            escalated: false,
        }));
        incident_service_1.incidentService.logEvent(`🎉 [Verification Passed] Service '${targetService}' confirmed healthy. Recovery verified in ${elapsedSec}s.`);
        incident_service_1.incidentService.addAiReasoning(`Recovery VERIFIED for '${targetService}': ${evidence.join("; ")}`, "verify_recovery", "PASSED", {
            incident_id: incident.id,
            source: "verification",
        });
        (0, socket_1.emitSentinelEvent)("verification.passed", {
            incident_id: incident.id,
            service: targetService,
            evidence,
            recovery_time: incident.recovery_time,
        });
        (0, socket_1.emitSentinelEvent)("service.recovered", {
            recovery_time: incident.recovery_time,
            incident_id: incident.id,
        });
        (0, socket_1.emitSentinelEvent)("incident.updated", incident);
    }
    else {
        incident.verification_status = "FAILED";
        // Incident remains active! Do NOT falsely close.
        incident_service_1.incidentService.setSystemHealth("INCIDENT_ACTIVE");
        incident.status = "MITIGATING";
        // STEP 2: Persist failed verification state to PostgreSQL
        void (0, persistence_1.safePersist)("IncidentRepository", "update", incident.id, () => incident_repository_1.IncidentRepository.update(incident.id, {
            status: "MITIGATING",
            verification_status: "FAILED",
            verification_attempts: incident.verification_attempts,
        }));
        incident_service_1.incidentService.logEvent(`❌ [Verification Failed] Recovery check failed for '${targetService}': ${evidence.join("; ")}`, "WARNING");
        incident_service_1.incidentService.addAiReasoning(`Recovery verification FAILED for '${targetService}'. Service is NOT healthy. Incident remains active.`, "verify_recovery", "FAILED", {
            incident_id: incident.id,
            source: "verification",
        });
        (0, socket_1.emitSentinelEvent)("verification.failed", {
            incident_id: incident.id,
            service: targetService,
            evidence,
        });
        (0, socket_1.emitSentinelEvent)("incident.updated", incident);
    }
    return { verified, service: targetService, evidence, rawResult };
}
// ============================================================================
// MAIN AGENT ENTRY POINT
// ============================================================================
async function callLlmSreAgent(incident) {
    const incidentId = incident.id;
    incident_service_1.incidentService.setSystemHealth("INCIDENT_ACTIVE");
    incident_service_1.incidentService.setDatabaseStatus("DOWN");
    incident_service_1.incidentService.logEvent(`🚨 Incident ${incidentId} escalated to Autonomous SRE Agent`);
    (0, socket_1.emitSentinelEvent)("agent.phase_changed", { phase: "INVESTIGATING", incident_id: incidentId });
    incident_service_1.incidentService.addAiReasoning("Incident Detected! Starting autonomous two-turn SRE investigation.", undefined, undefined, { incident_id: incidentId, source: "agent" });
    await sleep(400);
    const openaiKey = env_1.env.OPENAI_API_KEY;
    const geminiKey = env_1.env.GEMINI_API_KEY || env_1.env.GOOGLE_API_KEY;
    let aiInvestigationSucceeded = false;
    // =========================================================================
    // CANONICAL AI PATH: OPENAI TWO-TURN FUNCTION-CALLING LOOP
    // =========================================================================
    if (openaiKey) {
        const timeoutMs = 8000;
        // We share one OpenAI client instance for all turns
        const openai = new openai_1.default({
            apiKey: openaiKey,
            timeout: timeoutMs,
        });
        // Turn 1 incident context — no pre-fetched logs, let the model decide
        const incidentUserPrompt = `INCIDENT ALERT:
Service: dummy-api
Error: ${incident.error || "HTTP 500 Internal Server Error"}
Incident ID: ${incident.id}
Detected At: ${incident.detected_at}

Investigate this incident. Select the most appropriate Sentinel diagnostic tool to gather evidence before forming a root cause analysis.`;
        // Build the initial message history for Turn 1
        const conversationHistory = [
            { role: "system", content: exports.SENTINEL_SYSTEM_PROMPT },
            { role: "user", content: incidentUserPrompt },
        ];
        // -----------------------------------------------------------------------
        // TURN 1: Send incident context → model selects investigation tool
        // -----------------------------------------------------------------------
        incident_service_1.incidentService.logEvent(`🤖 [Turn 1] Invoking OpenAI model '${env_1.env.OPENAI_MODEL}' for investigation tool selection (timeout: ${timeoutMs}ms)`);
        incident_service_1.incidentService.addAiReasoning("Turn 1: Asking AI to select investigation tool...", undefined, undefined, { incident_id: incidentId, turn: 1, source: "openai" });
        const turn1Controller = new AbortController();
        const turn1TimeoutId = setTimeout(() => turn1Controller.abort(), timeoutMs);
        let turn1ToolName = null;
        let turn1ToolCallId = "";
        let turn1RawToolCallMessage = null;
        let turn1RealToolResult = "";
        try {
            const turn1Response = await openai.chat.completions.create({
                model: env_1.env.OPENAI_MODEL || "gpt-5.6",
                messages: conversationHistory,
                tools: OPENAI_TOOL_DECLARATIONS,
                tool_choice: "required", // Force model to select an investigation tool
            }, { signal: turn1Controller.signal });
            clearTimeout(turn1TimeoutId);
            const turn1Choice = turn1Response.choices?.[0];
            turn1RawToolCallMessage = turn1Choice?.message ?? null;
            if (!turn1RawToolCallMessage?.tool_calls?.length) {
                throw new Error("Turn 1: Model did not return a tool call despite tool_choice='required'");
            }
            // Parse and validate the model's tool selection
            const { toolName, validatedArgs, toolCallId } = parseAndValidateToolCall(turn1RawToolCallMessage.tool_calls[0]);
            turn1ToolName = toolName;
            turn1ToolCallId = toolCallId;
            incident_service_1.incidentService.logEvent(`🔍 [Turn 1] Model selected investigation tool '${toolName}' with args: ${JSON.stringify(validatedArgs)}`);
            incident_service_1.incidentService.addAiReasoning(`Turn 1: AI selected investigation tool '${toolName}'`, `${toolName}(${JSON.stringify(validatedArgs)})`, undefined, { incident_id: incidentId, turn: 1, source: "openai" });
            // Execute the investigation tool through the Guardrail Policy Engine
            incident_service_1.incidentService.logEvent(`⚙️ [Turn 1] Executing '${toolName}' via Safety/Policy Engine`);
            (0, socket_1.emitSentinelEvent)("tool.called", { tool_name: toolName, kwargs: validatedArgs, turn: 1 });
            const toolExecutionResult = await (0, policy_engine_1.executeToolWithGuardrail)(toolName, incidentId, validatedArgs);
            if (toolExecutionResult.status !== "SUCCESS") {
                const errDetail = toolExecutionResult.status === "Requires Human Approval"
                    ? "Requires Human Approval"
                    : toolExecutionResult.message || "Unknown error";
                incident_service_1.incidentService.logEvent(`⚠️ [Turn 1] Tool '${toolName}' did not complete successfully: ${errDetail}`, "WARNING");
                incident_service_1.incidentService.addAiReasoning(`Turn 1: Investigation tool '${toolName}' blocked/failed (${errDetail}). Activating deterministic fallback.`, undefined, undefined, { incident_id: incidentId, turn: 1, source: "agent" });
                throw new Error(`Turn 1 tool '${toolName}' did not succeed: ${errDetail}`);
            }
            turn1RealToolResult = typeof toolExecutionResult.result === "string"
                ? toolExecutionResult.result
                : JSON.stringify(toolExecutionResult.result);
            incident_service_1.incidentService.logEvent(`✅ [Turn 1] Tool '${toolName}' completed. Result length: ${turn1RealToolResult.length} chars`);
            incident_service_1.incidentService.addAiReasoning(`Turn 1: Tool '${toolName}' executed successfully. Evidence captured.`, undefined, turn1RealToolResult.slice(0, 300), { incident_id: incidentId, turn: 1, source: "openai" });
            (0, socket_1.emitSentinelEvent)("tool.result", { tool_name: toolName, result: turn1RealToolResult, turn: 1 });
        }
        catch (err) {
            clearTimeout(turn1TimeoutId);
            const isAbort = err instanceof Error &&
                (err.name === "AbortError" ||
                    err.message?.toLowerCase().includes("aborted") ||
                    err.message?.toLowerCase().includes("timeout"));
            if (isAbort) {
                incident_service_1.incidentService.logEvent(`⏱️ [Turn 1 Timeout] OpenAI request timed out after ${timeoutMs}ms. Activating deterministic fallback.`, "WARNING");
                incident_service_1.incidentService.addAiReasoning("Turn 1: AI investigation timed out (8000ms). Activating deterministic safety fallback.", undefined, undefined, { incident_id: incidentId, turn: 1, source: "agent" });
            }
            else {
                const errorMsg = err instanceof Error ? err.message : String(err);
                incident_service_1.incidentService.logEvent(`⚠️ [Turn 1 Error] ${errorMsg}. Activating deterministic safety fallback.`, "WARNING");
                incident_service_1.incidentService.addAiReasoning(`Turn 1: AI call failed (${errorMsg.slice(0, 120)}). Activating deterministic safety fallback.`, undefined, undefined, { incident_id: incidentId, turn: 1, source: "agent" });
            }
        }
        // -----------------------------------------------------------------------
        // TURN 2: Send full conversation + tool result → model produces RCA
        // Only executes if Turn 1 succeeded and captured a real tool result
        // -----------------------------------------------------------------------
        if (turn1ToolName && turn1RawToolCallMessage && turn1RealToolResult) {
            conversationHistory.push({
                role: "assistant",
                content: turn1RawToolCallMessage.content ?? null,
                tool_calls: turn1RawToolCallMessage.tool_calls,
            });
            conversationHistory.push({
                role: "tool",
                tool_call_id: turn1ToolCallId,
                content: turn1RealToolResult.slice(0, 3000),
            });
            conversationHistory.push({
                role: "user",
                content: `Based on the investigation evidence above, provide your structured Root Cause Analysis as a JSON object with keys: root_cause, confidence, evidence (array), and proposed_action (with tool and arguments). Reply ONLY with valid JSON — no prose, no markdown fences.`,
            });
            incident_service_1.incidentService.logEvent(`🤖 [Turn 2] Sending conversation with tool evidence back to '${env_1.env.OPENAI_MODEL}' for RCA (timeout: ${timeoutMs}ms)`);
            incident_service_1.incidentService.addAiReasoning("Turn 2: Sending tool evidence to AI for structured root cause analysis...", undefined, undefined, { incident_id: incidentId, turn: 2, source: "openai" });
            const turn2Controller = new AbortController();
            const turn2TimeoutId = setTimeout(() => turn2Controller.abort(), timeoutMs);
            try {
                const turn2Response = await openai.chat.completions.create({
                    model: env_1.env.OPENAI_MODEL || "gpt-5.6",
                    messages: conversationHistory,
                    tool_choice: "none",
                }, { signal: turn2Controller.signal });
                clearTimeout(turn2TimeoutId);
                const turn2Content = turn2Response.choices?.[0]?.message?.content;
                incident_service_1.incidentService.logEvent(`📋 [Turn 2] Received response. Parsing structured RCA...`);
                const rca = parseStructuredRca(turn2Content);
                if (!rca) {
                    const preview = (turn2Content ?? "").slice(0, 200);
                    incident_service_1.incidentService.logEvent(`⚠️ [Turn 2] Structured RCA parsing/validation failed. Content preview: "${preview}". Activating deterministic fallback.`, "WARNING");
                    incident_service_1.incidentService.addAiReasoning(`Turn 2: AI returned malformed RCA. Activating deterministic safety fallback.`);
                }
                else {
                    // RCA validated — store on incident
                    incident.structured_rca = rca;
                    incident.confidence = rca.confidence;
                    // STEP 2: Persist structured RCA and confidence
                    void (0, persistence_1.safePersist)("IncidentRepository", "update", incidentId, () => incident_repository_1.IncidentRepository.update(incidentId, {
                        root_cause: rca.root_cause,
                        confidence: rca.confidence,
                        structured_rca: rca,
                    }));
                    incident_service_1.incidentService.logEvent(`✅ [Turn 2] Structured RCA validated. Root cause: "${rca.root_cause}" (confidence: ${rca.confidence})`);
                    incident_service_1.incidentService.addAiReasoning(`Turn 2 RCA: ${rca.root_cause} (Confidence: ${Math.round(rca.confidence * 100)}%)`, `Proposed: ${rca.proposed_action.tool}(${JSON.stringify(rca.proposed_action.arguments)})`, undefined, {
                        incident_id: incidentId,
                        turn: 2,
                        confidence: rca.confidence,
                        structured_rca: rca,
                        source: "openai",
                    });
                    (0, socket_1.emitSentinelEvent)("agent.rca_ready", {
                        incident_id: incidentId,
                        rca,
                    });
                    // Execute proposed remediation through the Guardrail Policy Engine
                    incident_service_1.incidentService.setSystemHealth("RECOVERING");
                    incident_service_1.incidentService.logEvent(`🛡️ [Guardrail] Routing proposed action '${rca.proposed_action.tool}' through Safety/Policy Engine`);
                    const remediationResult = await (0, policy_engine_1.executeToolWithGuardrail)(rca.proposed_action.tool, incidentId, rca.proposed_action.arguments);
                    if (remediationResult.status === "Requires Human Approval") {
                        incident_service_1.incidentService.addAiReasoning(`Proposed action '${rca.proposed_action.tool}' blocked by Guardrail Policy Engine. Pending human operator sign-off.`, undefined, "Blocked (Requires Human Approval)", {
                            incident_id: incidentId,
                            turn: 2,
                            source: "guardrail",
                        });
                        incident_service_1.incidentService.setSystemHealth("INCIDENT_ACTIVE");
                        incident.status = "REQUIRES_APPROVAL";
                        // STEP 2: Persist status update
                        void (0, persistence_1.safePersist)("IncidentRepository", "update", incidentId, () => incident_repository_1.IncidentRepository.update(incidentId, { status: "REQUIRES_APPROVAL" }));
                        (0, socket_1.emitSentinelEvent)("incident.updated", incident);
                    }
                    else if (remediationResult.status === "SUCCESS") {
                        incident_service_1.incidentService.addAiReasoning(`Remediation '${rca.proposed_action.tool}' executed successfully via safety policy engine. Starting recovery verification...`, undefined, typeof remediationResult.result === "string"
                            ? remediationResult.result
                            : JSON.stringify(remediationResult.result), {
                            incident_id: incidentId,
                            turn: 2,
                            source: "guardrail",
                        });
                        incident.status = "MITIGATING";
                        // STEP 2: Persist status update
                        void (0, persistence_1.safePersist)("IncidentRepository", "update", incidentId, () => incident_repository_1.IncidentRepository.update(incidentId, { status: "MITIGATING" }));
                        (0, socket_1.emitSentinelEvent)("incident.updated", incident);
                        // ===============================================================
                        // STEP 2F: CLOSED-LOOP EXPLICIT VERIFICATION
                        // ACTION EXECUTED is NOT equivalent to RECOVERY VERIFIED
                        // ===============================================================
                        const targetService = rca.proposed_action.arguments?.service ||
                            rca.proposed_action.arguments?.container_name ||
                            "dummy-api";
                        const serviceToVerify = targetService === "sentinel-db" || targetService === "dummy-api"
                            ? targetService
                            : "dummy-api";
                        const verifyResult = await verifyIncidentRecovery(incident, serviceToVerify);
                        // ===============================================================
                        // STEP 2F: BOUNDED RE-INVESTIGATION ON VERIFICATION FAILURE
                        // ===============================================================
                        if (!verifyResult.verified) {
                            if ((incident.reinvestigation_attempts || 0) < exports.MAX_REINVESTIGATION_ATTEMPTS) {
                                incident.reinvestigation_attempts = (incident.reinvestigation_attempts || 0) + 1;
                                incident_service_1.incidentService.logEvent(`🔄 [Re-Investigation Started] Recovery verification failed. Initiating bounded re-investigation (attempt ${incident.reinvestigation_attempts}/${exports.MAX_REINVESTIGATION_ATTEMPTS}) with fresh evidence.`);
                                incident_service_1.incidentService.addAiReasoning(`Recovery verification failed. Initiating bounded re-investigation (attempt ${incident.reinvestigation_attempts}/${exports.MAX_REINVESTIGATION_ATTEMPTS}) with fresh evidence.`);
                                (0, socket_1.emitSentinelEvent)("agent.phase_changed", { phase: "RE_INVESTIGATING", incident_id: incidentId });
                                // Collect fresh evidence from running environment
                                const freshEvidence = await collectFreshInvestigationEvidence();
                                incident_service_1.incidentService.logEvent(`📊 [Fresh Evidence] Collected updated system telemetry, service logs, and database status`);
                                conversationHistory.push({
                                    role: "user",
                                    content: `RE-INVESTIGATION ALERT:
The previous remediation action (${rca.proposed_action.tool}) was executed, but recovery verification FAILED.
The service remains unhealthy.

Here is FRESH operational evidence collected from the system:
${freshEvidence}

Re-evaluate root cause based on this fresh evidence. Provide a NEW Root Cause Analysis as JSON with root_cause, confidence, evidence (array), and proposed_action (tool and arguments).
If an alternate remediation is warranted (e.g. rollback_service), propose it. Reply ONLY with valid JSON.`,
                                });
                                incident_service_1.incidentService.logEvent(`🤖 [Turn 3] Sending fresh evidence to '${env_1.env.OPENAI_MODEL}' for re-investigation RCA (timeout: ${timeoutMs}ms)`);
                                incident_service_1.incidentService.addAiReasoning("Turn 3: Requesting new RCA from AI using fresh telemetry evidence...");
                                const turn3Controller = new AbortController();
                                const turn3TimeoutId = setTimeout(() => turn3Controller.abort(), timeoutMs);
                                try {
                                    const turn3Response = await openai.chat.completions.create({
                                        model: env_1.env.OPENAI_MODEL || "gpt-5.6",
                                        messages: conversationHistory,
                                        tool_choice: "none",
                                    }, { signal: turn3Controller.signal });
                                    clearTimeout(turn3TimeoutId);
                                    const turn3Content = turn3Response.choices?.[0]?.message?.content;
                                    const reRca = parseStructuredRca(turn3Content);
                                    if (reRca) {
                                        incident.structured_rca = reRca;
                                        incident.confidence = reRca.confidence;
                                        // STEP 2: Persist re-investigation RCA
                                        void (0, persistence_1.safePersist)("IncidentRepository", "update", incidentId, () => incident_repository_1.IncidentRepository.update(incidentId, {
                                            root_cause: reRca.root_cause,
                                            confidence: reRca.confidence,
                                            structured_rca: reRca,
                                            reinvestigation_attempts: incident.reinvestigation_attempts,
                                        }));
                                        incident_service_1.incidentService.logEvent(`✅ [Turn 3] Re-investigation RCA validated: "${reRca.root_cause}" (confidence: ${reRca.confidence}). Proposing: ${reRca.proposed_action.tool}`);
                                        incident_service_1.incidentService.addAiReasoning(`Turn 3 RCA: ${reRca.root_cause} (Confidence: ${Math.round(reRca.confidence * 100)}%)`, `Proposed: ${reRca.proposed_action.tool}(${JSON.stringify(reRca.proposed_action.arguments)})`, undefined, {
                                            incident_id: incidentId,
                                            turn: 3,
                                            confidence: reRca.confidence,
                                            structured_rca: reRca,
                                            source: "openai",
                                        });
                                        (0, socket_1.emitSentinelEvent)("agent.rca_ready", {
                                            incident_id: incidentId,
                                            rca: reRca,
                                        });
                                        // Route re-investigation action through Guardrail Policy Engine
                                        incident_service_1.incidentService.logEvent(`🛡️ [Guardrail] Routing re-investigation action '${reRca.proposed_action.tool}' through Safety/Policy Engine`);
                                        const reRemediationResult = await (0, policy_engine_1.executeToolWithGuardrail)(reRca.proposed_action.tool, incidentId, reRca.proposed_action.arguments);
                                        if (reRemediationResult.status === "Requires Human Approval") {
                                            incident_service_1.incidentService.addAiReasoning(`Re-investigation proposed action '${reRca.proposed_action.tool}' blocked by Guardrail Policy Engine. Pending human operator sign-off.`, undefined, "Blocked (Requires Human Approval)", {
                                                incident_id: incidentId,
                                                turn: 3,
                                                source: "guardrail",
                                            });
                                            incident_service_1.incidentService.setSystemHealth("INCIDENT_ACTIVE");
                                            incident.status = "REQUIRES_APPROVAL";
                                            // STEP 2: Persist status update
                                            void (0, persistence_1.safePersist)("IncidentRepository", "update", incidentId, () => incident_repository_1.IncidentRepository.update(incidentId, { status: "REQUIRES_APPROVAL" }));
                                            (0, socket_1.emitSentinelEvent)("incident.updated", incident);
                                        }
                                        else if (reRemediationResult.status === "SUCCESS") {
                                            incident_service_1.incidentService.addAiReasoning(`Re-investigation action '${reRca.proposed_action.tool}' executed successfully. Verifying recovery...`, undefined, typeof reRemediationResult.result === "string"
                                                ? reRemediationResult.result
                                                : JSON.stringify(reRemediationResult.result), {
                                                incident_id: incidentId,
                                                turn: 3,
                                                source: "guardrail",
                                            });
                                            const reVerifyTarget = reRca.proposed_action.arguments?.service ||
                                                reRca.proposed_action.arguments?.container_name ||
                                                "dummy-api";
                                            const reServiceToVerify = reVerifyTarget === "sentinel-db" || reVerifyTarget === "dummy-api"
                                                ? reVerifyTarget
                                                : "dummy-api";
                                            const secondVerify = await verifyIncidentRecovery(incident, reServiceToVerify);
                                            if (!secondVerify.verified) {
                                                incident_service_1.incidentService.logEvent(`⛔ [Re-Investigation Limit Reached] Second verification failed. Max attempts reached. Incident remains ESCALATED.`, "ERROR");
                                                incident_service_1.incidentService.addAiReasoning(`Re-investigation remediation failed verification. Retry limit (${exports.MAX_REINVESTIGATION_ATTEMPTS}) reached. Escalating incident.`, undefined, undefined, { incident_id: incidentId, turn: 3, source: "agent" });
                                                incident.status = "ESCALATED";
                                                // STEP 2: Persist escalation
                                                void (0, persistence_1.safePersist)("IncidentRepository", "update", incidentId, () => incident_repository_1.IncidentRepository.update(incidentId, {
                                                    status: "ESCALATED",
                                                    escalated: true,
                                                    reinvestigation_attempts: incident.reinvestigation_attempts,
                                                }));
                                                (0, socket_1.emitSentinelEvent)("incident.updated", incident);
                                            }
                                        }
                                        else {
                                            incident_service_1.incidentService.addAiReasoning(`Re-investigation remediation '${reRca.proposed_action.tool}' failed: ${reRemediationResult.message ?? "Unknown error"}`, undefined, undefined, { incident_id: incidentId, turn: 3, source: "agent" });
                                            incident.status = "ESCALATED";
                                            // STEP 2: Persist escalation
                                            void (0, persistence_1.safePersist)("IncidentRepository", "update", incidentId, () => incident_repository_1.IncidentRepository.update(incidentId, {
                                                status: "ESCALATED",
                                                escalated: true,
                                                reinvestigation_attempts: incident.reinvestigation_attempts,
                                            }));
                                            (0, socket_1.emitSentinelEvent)("incident.updated", incident);
                                        }
                                    }
                                    else {
                                        incident_service_1.incidentService.logEvent(`⚠️ [Turn 3] Re-investigation RCA parsing failed. Escalating incident.`, "WARNING");
                                        incident.status = "ESCALATED";
                                        // STEP 2: Persist escalation
                                        void (0, persistence_1.safePersist)("IncidentRepository", "update", incidentId, () => incident_repository_1.IncidentRepository.update(incidentId, {
                                            status: "ESCALATED",
                                            escalated: true,
                                            reinvestigation_attempts: incident.reinvestigation_attempts,
                                        }));
                                        (0, socket_1.emitSentinelEvent)("incident.updated", incident);
                                    }
                                }
                                catch (turn3Err) {
                                    clearTimeout(turn3TimeoutId);
                                    incident_service_1.incidentService.logEvent(`⚠️ [Turn 3 Error] ${String(turn3Err)}. Escalating incident.`, "WARNING");
                                    incident.status = "ESCALATED";
                                    // STEP 2: Persist escalation
                                    void (0, persistence_1.safePersist)("IncidentRepository", "update", incidentId, () => incident_repository_1.IncidentRepository.update(incidentId, {
                                        status: "ESCALATED",
                                        escalated: true,
                                        reinvestigation_attempts: incident.reinvestigation_attempts,
                                    }));
                                    (0, socket_1.emitSentinelEvent)("incident.updated", incident);
                                }
                            }
                            else {
                                incident_service_1.incidentService.logEvent(`⛔ [Re-Investigation Limit Reached] Attempts (${incident.reinvestigation_attempts}) reached max (${exports.MAX_REINVESTIGATION_ATTEMPTS}). Escalating incident.`, "ERROR");
                                incident.status = "ESCALATED";
                                // STEP 2: Persist escalation
                                void (0, persistence_1.safePersist)("IncidentRepository", "update", incidentId, () => incident_repository_1.IncidentRepository.update(incidentId, {
                                    status: "ESCALATED",
                                    escalated: true,
                                    reinvestigation_attempts: incident.reinvestigation_attempts,
                                }));
                                (0, socket_1.emitSentinelEvent)("incident.updated", incident);
                            }
                        }
                    }
                    else {
                        incident_service_1.incidentService.addAiReasoning(`Remediation '${rca.proposed_action.tool}' failed: ${remediationResult.message ?? "Unknown error"}`, undefined, undefined, { incident_id: incidentId, source: "agent" });
                        incident.status = "ESCALATED";
                        // STEP 2: Persist escalation
                        void (0, persistence_1.safePersist)("IncidentRepository", "update", incidentId, () => incident_repository_1.IncidentRepository.update(incidentId, {
                            status: "ESCALATED",
                            escalated: true,
                        }));
                        (0, socket_1.emitSentinelEvent)("incident.updated", incident);
                    }
                    aiInvestigationSucceeded = true;
                }
            }
            catch (err) {
                clearTimeout(turn2TimeoutId);
                const isAbort = err instanceof Error &&
                    (err.name === "AbortError" ||
                        err.message?.toLowerCase().includes("aborted") ||
                        err.message?.toLowerCase().includes("timeout"));
                if (isAbort) {
                    incident_service_1.incidentService.logEvent(`⏱️ [Turn 2 Timeout] OpenAI Turn 2 timed out after ${timeoutMs}ms. Activating deterministic fallback.`, "WARNING");
                    incident_service_1.incidentService.addAiReasoning("Turn 2: AI RCA generation timed out (8000ms). Activating deterministic safety fallback.");
                }
                else {
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    incident_service_1.incidentService.logEvent(`⚠️ [Turn 2 Error] ${errorMsg}. Activating deterministic fallback.`, "WARNING");
                    incident_service_1.incidentService.addAiReasoning(`Turn 2: AI RCA failed (${errorMsg.slice(0, 120)}). Activating deterministic safety fallback.`);
                }
            }
        }
    }
    else if (geminiKey) {
        // Secondary advisory path — Gemini present without function calling
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
            const prompt = `You are Sentinel, an autonomous Site Reliability Engineer.\nAlert: Production dummy-api is returning HTTP 500: ${incident.error}.\nDiagnose and remediate.`;
            const resp = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            });
            if (resp.ok) {
                const json = (await resp.json());
                const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    incident_service_1.incidentService.addAiReasoning(`Advisory Gemini Diagnosis: ${text.trim().slice(0, 180)}...`);
                }
            }
        }
        catch (err) {
            logger_1.logger.warn({ err }, "Gemini diagnosis call error");
        }
    }
    // =========================================================================
    // DETERMINISTIC SAFETY FALLBACK (PRESERVED + STEP 2F VERIFICATION)
    // Activates when: no API key, any timeout, any malformed AI output
    // =========================================================================
    if (!aiInvestigationSucceeded) {
        incident_service_1.incidentService.logEvent("🛡️ [Deterministic Engine] Executing verified SRE recovery workflow");
        incident_service_1.incidentService.addAiReasoning("Root cause: PostgreSQL database connection refused (Deterministic SRE rule)", undefined, undefined, { incident_id: incidentId, source: "deterministic" });
        await sleep(400);
        incident_service_1.incidentService.addAiReasoning("Action proposed: Restart database service (Risk: LOW)", "restart_service(service='sentinel-db')", undefined, { incident_id: incidentId, source: "deterministic" });
        await sleep(400);
        incident_service_1.incidentService.addAiReasoning("Executing remediation via safety guardrail...");
        incident_service_1.incidentService.setSystemHealth("RECOVERING");
        const remediation = await (0, policy_engine_1.executeToolWithGuardrail)("restart_service", incidentId, {
            service: "sentinel-db",
        });
        if (remediation.status === "Requires Human Approval") {
            incident_service_1.incidentService.addAiReasoning("Action blocked by Guardrail Policy Engine. Pending human operator sign-off.", undefined, "Blocked (Requires Human Approval)", { incident_id: incidentId, source: "guardrail" });
            incident_service_1.incidentService.setSystemHealth("INCIDENT_ACTIVE");
            incident.status = "REQUIRES_APPROVAL";
            // STEP 2: Persist status update
            void (0, persistence_1.safePersist)("IncidentRepository", "update", incidentId, () => incident_repository_1.IncidentRepository.update(incidentId, {
                status: "REQUIRES_APPROVAL",
                root_cause: "PostgreSQL database connection refused (Deterministic SRE rule)",
            }));
            (0, socket_1.emitSentinelEvent)("incident.updated", incident);
        }
        else if (remediation.status === "SUCCESS") {
            incident_service_1.incidentService.addAiReasoning("Database service restart command dispatched successfully via guardrail. Verifying recovery...", undefined, typeof remediation.result === "string" ? remediation.result : JSON.stringify(remediation.result), { incident_id: incidentId, source: "guardrail" });
            incident.status = "MITIGATING";
            // STEP 2: Persist status update
            void (0, persistence_1.safePersist)("IncidentRepository", "update", incidentId, () => incident_repository_1.IncidentRepository.update(incidentId, {
                status: "MITIGATING",
                root_cause: "PostgreSQL database connection refused (Deterministic SRE rule)",
            }));
            (0, socket_1.emitSentinelEvent)("incident.updated", incident);
            // Explicit verification for deterministic path
            const verifyRes = await verifyIncidentRecovery(incident, "sentinel-db");
            if (!verifyRes.verified) {
                if ((incident.reinvestigation_attempts || 0) < exports.MAX_REINVESTIGATION_ATTEMPTS) {
                    incident.reinvestigation_attempts = (incident.reinvestigation_attempts || 0) + 1;
                    incident_service_1.incidentService.logEvent(`🔄 [Deterministic Re-Investigation] Verification failed for sentinel-db. Proposing rollback_service via guardrail.`);
                    incident_service_1.incidentService.addAiReasoning(`Deterministic re-investigation: restart_service failed recovery verification. Proposing rollback_service for operator authorization.`, "rollback_service(service='sentinel-db')", undefined, { incident_id: incidentId, source: "deterministic" });
                    // Route through guardrail -> requires human approval
                    const rollbackResult = await (0, policy_engine_1.executeToolWithGuardrail)("rollback_service", incidentId, {
                        service: "sentinel-db",
                    });
                    if (rollbackResult.status === "Requires Human Approval") {
                        incident_service_1.incidentService.setSystemHealth("INCIDENT_ACTIVE");
                        incident.status = "REQUIRES_APPROVAL";
                        // STEP 2: Persist status update
                        void (0, persistence_1.safePersist)("IncidentRepository", "update", incidentId, () => incident_repository_1.IncidentRepository.update(incidentId, {
                            status: "REQUIRES_APPROVAL",
                            reinvestigation_attempts: incident.reinvestigation_attempts,
                        }));
                        (0, socket_1.emitSentinelEvent)("incident.updated", incident);
                    }
                }
                else {
                    incident_service_1.incidentService.logEvent(`⛔ [Deterministic Engine] Max re-investigation attempts reached. Incident remains ESCALATED.`, "ERROR");
                    incident.status = "ESCALATED";
                    // STEP 2: Persist escalation
                    void (0, persistence_1.safePersist)("IncidentRepository", "update", incidentId, () => incident_repository_1.IncidentRepository.update(incidentId, {
                        status: "ESCALATED",
                        escalated: true,
                        reinvestigation_attempts: incident.reinvestigation_attempts,
                    }));
                    (0, socket_1.emitSentinelEvent)("incident.updated", incident);
                }
            }
        }
    }
}
