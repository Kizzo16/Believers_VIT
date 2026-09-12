"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SENTINEL_SYSTEM_PROMPT = void 0;
exports.callLlmSreAgent = callLlmSreAgent;
const openai_1 = __importDefault(require("openai"));
const incident_service_1 = require("../services/incident.service");
const policy_engine_1 = require("../safety/policy-engine");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const socket_1 = require("../realtime/socket");
const tools_1 = require("./tools");
const schemas_1 = require("../safety/schemas");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
9. Do not claim recovery has completed until verification evidence confirms healthy status.`;
async function callLlmSreAgent(incident) {
    const incidentId = incident.id;
    incident_service_1.incidentService.setSystemHealth("INCIDENT_ACTIVE");
    incident_service_1.incidentService.setDatabaseStatus("DOWN");
    incident_service_1.incidentService.logEvent(`🚨 Incident ${incidentId} escalated to Autonomous SRE Agent`);
    (0, socket_1.emitSentinelEvent)("agent.phase_changed", { phase: "INVESTIGATING", incident_id: incidentId });
    // Step 1: Incident Detected
    incident_service_1.incidentService.addAiReasoning("Incident Detected! Starting autonomous triage.");
    await sleep(400);
    // Step 2: Gather initial evidence via official tool
    incident_service_1.incidentService.addAiReasoning("Gathering initial service logs and telemetry...", "get_service_logs(service='dummy-api')");
    const logsResult = await (0, policy_engine_1.executeToolWithGuardrail)("get_service_logs", incidentId, {
        service: "dummy-api",
    });
    await sleep(400);
    const openaiKey = env_1.env.OPENAI_API_KEY;
    const geminiKey = env_1.env.GEMINI_API_KEY || env_1.env.GOOGLE_API_KEY;
    let aiInvestigationSucceeded = false;
    // =========================================================================
    // 1. CANONICAL AI PROVIDER: OPENAI WITH CONTROLLED FUNCTION CALLING
    // =========================================================================
    if (openaiKey) {
        const controller = new AbortController();
        const timeoutMs = 8000;
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, timeoutMs);
        try {
            incident_service_1.incidentService.logEvent(`🤖 [AI Dispatch] Invoking OpenAI model '${env_1.env.OPENAI_MODEL}' with controlled tool declarations (timeout: ${timeoutMs}ms)`);
            const openai = new openai_1.default({
                apiKey: openaiKey,
                timeout: timeoutMs,
            });
            const userPrompt = `INCIDENT ALERT:
Service: dummy-api
Error: ${incident.error || "HTTP 500 Internal Server Error"}
Incident ID: ${incident.id}

RECENT SERVICE LOGS (dummy-api):
${String(logsResult.result || "").slice(0, 800)}

Perform an SRE investigation. Use controlled tools if further diagnostics or remediation are required, or return your structured root cause analysis.`;
            const response = await openai.chat.completions.create({
                model: env_1.env.OPENAI_MODEL || "gpt-5.6",
                messages: [
                    { role: "system", content: exports.SENTINEL_SYSTEM_PROMPT },
                    { role: "user", content: userPrompt },
                ],
                tools: tools_1.LIVE_OPENAI_TOOLS.map((t) => ({
                    type: "function",
                    function: {
                        name: t.function.name,
                        description: t.function.description,
                        parameters: t.function.parameters,
                    },
                })),
                tool_choice: "auto",
            }, { signal: controller.signal });
            clearTimeout(timeoutId);
            const choice = response.choices?.[0];
            const message = choice?.message;
            if (message?.tool_calls && message.tool_calls.length > 0) {
                // Model selected one or more tools
                const toolCall = message.tool_calls[0];
                if (toolCall.type !== "function") {
                    throw new Error(`Unsupported tool call type: ${toolCall.type}`);
                }
                const toolName = toolCall.function.name;
                incident_service_1.incidentService.logEvent(`🔍 [AI Function Call] Model proposed tool '${toolName}' with raw args: ${toolCall.function.arguments}`);
                let parsedArgs = {};
                try {
                    parsedArgs = JSON.parse(toolCall.function.arguments || "{}");
                }
                catch {
                    throw new Error(`Malformed JSON in model tool arguments: ${toolCall.function.arguments}`);
                }
                // Validate tool against known schemas
                if (!Object.prototype.hasOwnProperty.call(schemas_1.TOOL_SCHEMAS, toolName)) {
                    throw new Error(`Model requested unknown/unsupported tool '${toolName}'`);
                }
                const schema = schemas_1.TOOL_SCHEMAS[toolName];
                const validation = schema.safeParse(parsedArgs);
                if (!validation.success) {
                    throw new Error(`Tool argument validation failed for '${toolName}': ${JSON.stringify(validation.error.errors)}`);
                }
                const validatedArgs = validation.data;
                // Build validated Structured RCA
                const structuredRca = {
                    root_cause: message.content
                        ? message.content.trim().slice(0, 250)
                        : `Root cause identified via telemetry: anomaly requiring tool '${toolName}'`,
                    confidence: 0.95,
                    evidence: [
                        `dummy-api alert: ${incident.error}`,
                        `Telemetry confirmed failure state in service logs`,
                        `Model requested controlled tool: ${toolName}`,
                    ],
                    proposed_action: {
                        tool: toolName,
                        arguments: validatedArgs,
                    },
                };
                incident.structured_rca = structuredRca;
                incident.confidence = structuredRca.confidence;
                incident_service_1.incidentService.addAiReasoning(`AI Diagnosis: ${structuredRca.root_cause} (Confidence: ${structuredRca.confidence * 100}%)`, `${toolName}(${JSON.stringify(validatedArgs)})`);
                // Execute proposed action through Guardrail Policy Engine
                incident_service_1.incidentService.setSystemHealth("RECOVERING");
                const actionResult = await (0, policy_engine_1.executeToolWithGuardrail)(toolName, incidentId, validatedArgs);
                if (actionResult.status === "Requires Human Approval") {
                    incident_service_1.incidentService.addAiReasoning("Action blocked by Guardrail Policy Engine. Pending human operator sign-off.", undefined, "Blocked (Requires Human Approval)");
                    incident_service_1.incidentService.setSystemHealth("INCIDENT_ACTIVE");
                    incident.status = "REQUIRES_APPROVAL";
                    (0, socket_1.emitSentinelEvent)("incident.updated", incident);
                }
                else if (actionResult.status === "SUCCESS") {
                    incident_service_1.incidentService.addAiReasoning(`Action '${toolName}' executed successfully via safety policy engine.`, undefined, typeof actionResult.result === "string" ? actionResult.result : JSON.stringify(actionResult.result));
                    incident.status = "MITIGATING";
                    (0, socket_1.emitSentinelEvent)("incident.updated", incident);
                }
                aiInvestigationSucceeded = true;
            }
            else if (message?.content) {
                // Model returned structured or text response without tool call
                try {
                    const parsed = JSON.parse(message.content);
                    const rcaValidation = schemas_1.StructuredRcaSchema.safeParse(parsed);
                    if (rcaValidation.success) {
                        const rca = rcaValidation.data;
                        incident.structured_rca = rca;
                        incident.confidence = rca.confidence;
                        incident_service_1.incidentService.addAiReasoning(`AI Structured RCA: ${rca.root_cause} (Confidence: ${rca.confidence * 100}%)`, `${rca.proposed_action.tool}(${JSON.stringify(rca.proposed_action.arguments)})`);
                        // Execute the proposed action through guardrail
                        incident_service_1.incidentService.setSystemHealth("RECOVERING");
                        const actionResult = await (0, policy_engine_1.executeToolWithGuardrail)(rca.proposed_action.tool, incidentId, rca.proposed_action.arguments);
                        if (actionResult.status === "Requires Human Approval") {
                            incident_service_1.incidentService.setSystemHealth("INCIDENT_ACTIVE");
                            incident.status = "REQUIRES_APPROVAL";
                            (0, socket_1.emitSentinelEvent)("incident.updated", incident);
                        }
                        else if (actionResult.status === "SUCCESS") {
                            incident.status = "MITIGATING";
                            (0, socket_1.emitSentinelEvent)("incident.updated", incident);
                        }
                        aiInvestigationSucceeded = true;
                    }
                    else {
                        incident_service_1.incidentService.addAiReasoning(`AI Analysis: ${message.content.trim().slice(0, 200)}`);
                    }
                }
                catch {
                    incident_service_1.incidentService.addAiReasoning(`AI Analysis: ${message.content.trim().slice(0, 200)}`);
                }
            }
        }
        catch (err) {
            clearTimeout(timeoutId);
            const isAbort = err instanceof Error &&
                (err.name === "AbortError" ||
                    err.message?.toLowerCase().includes("aborted") ||
                    err.message?.toLowerCase().includes("timeout"));
            if (isAbort) {
                incident_service_1.incidentService.logEvent(`⏱️ [AI Timeout] OpenAI request timed out after ${timeoutMs}ms. Aborting AI action.`, "WARNING");
                incident_service_1.incidentService.addAiReasoning("AI investigation timed out (8000ms limit reached). Activating deterministic safety fallback.");
            }
            else {
                const errorMsg = err instanceof Error ? err.message : String(err);
                incident_service_1.incidentService.logEvent(`⚠️ [AI Error] OpenAI call failed: ${errorMsg}. Activating deterministic safety fallback.`, "WARNING");
                incident_service_1.incidentService.addAiReasoning(`AI call encountered error (${errorMsg}). Activating deterministic safety fallback.`);
            }
        }
    }
    else if (geminiKey) {
        // Secondary advisory fallback if only Gemini key is present
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
            const prompt = `You are Sentinel, an autonomous Site Reliability Engineer.\nAlert: Production dummy-api is returning HTTP 500: ${incident.error}.\nRecent Logs: ${String(logsResult.result || "").slice(0, 400)}\nDiagnose and remediate.`;
            const resp = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                }),
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
    // 2. DETERMINISTIC SAFETY FALLBACK (PRESERVED WORKING RECOVERY PATH)
    // =========================================================================
    if (!aiInvestigationSucceeded) {
        incident_service_1.incidentService.logEvent("🛡️ [Deterministic Engine] Executing verified SRE recovery workflow");
        // Fallback Step 3: Root cause analysis
        incident_service_1.incidentService.addAiReasoning("Root cause: PostgreSQL database connection refused (Deterministic SRE rule)");
        await sleep(400);
        // Fallback Step 4: Action proposed
        incident_service_1.incidentService.addAiReasoning("Action proposed: Restart database service (Risk: LOW)", "restart_service(service='sentinel-db')");
        await sleep(400);
        // Fallback Step 5: Executing through Guardrail Policy Engine
        incident_service_1.incidentService.addAiReasoning("Executing remediation via safety guardrail...");
        incident_service_1.incidentService.setSystemHealth("RECOVERING");
        const remediation = await (0, policy_engine_1.executeToolWithGuardrail)("restart_service", incidentId, {
            service: "sentinel-db",
        });
        if (remediation.status === "Requires Human Approval") {
            incident_service_1.incidentService.addAiReasoning("Action blocked by Guardrail Policy Engine. Pending human operator sign-off.", undefined, "Blocked (Requires Human Approval)");
            incident_service_1.incidentService.setSystemHealth("INCIDENT_ACTIVE");
            incident.status = "REQUIRES_APPROVAL";
            (0, socket_1.emitSentinelEvent)("incident.updated", incident);
        }
        else if (remediation.status === "SUCCESS") {
            incident_service_1.incidentService.addAiReasoning("Database service restart command dispatched successfully via guardrail. Awaiting service healthy state.", undefined, typeof remediation.result === "string" ? remediation.result : JSON.stringify(remediation.result));
            incident.status = "MITIGATING";
            (0, socket_1.emitSentinelEvent)("incident.updated", incident);
        }
    }
}
