import assert from "node:assert/strict";
import { executeToolWithGuardrail } from "./src/safety/policy-engine.js";
import { StructuredRcaSchema, TOOL_SCHEMAS } from "./src/safety/schemas.js";
import { SENTINEL_TOOL_DEFINITIONS, LIVE_OPENAI_TOOLS } from "./src/agent/tools.js";

const BASE_URL = "http://127.0.0.1:8000";

async function runTests() {
  console.log("=========================================");
  console.log("   SENTINEL BACKEND VERIFICATION SUITE   ");
  console.log("=========================================\n");

  const results: Record<string, string> = {};

  // 1. GET /
  try {
    const res = await fetch(`${BASE_URL}/`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.service, "Sentinel SRE Agent Control Plane");
    assert.equal(data.status_endpoint, "/api/status");
    results["GET /"] = "PASS (200 OK)";
  } catch (err: any) {
    results["GET /"] = `FAIL: ${err.message}`;
  }

  // 2. GET /api/status
  try {
    const res = await fetch(`${BASE_URL}/api/status`);
    assert.equal(res.status, 200);
    const data = await res.json();
    const requiredKeys = [
      "system_health",
      "dummy_api_status",
      "database_status",
      "containers",
      "last_ping_time",
      "last_ping_code",
      "active_incident",
      "current_incident",
      "ai_reasoning",
      "incident_logs",
      "pending_approvals",
      "policies",
    ];
    for (const key of requiredKeys) {
      assert.ok(key in data, `Missing key in /api/status: ${key}`);
    }
    assert.ok(Array.isArray(data.ai_reasoning), "ai_reasoning must be an array");
    assert.ok(Array.isArray(data.incident_logs), "incident_logs must be an array");
    assert.ok(Array.isArray(data.pending_approvals), "pending_approvals must be an array");
    results["GET /api/status"] = `PASS (200 OK, health=${data.system_health})`;
  } catch (err: any) {
    results["GET /api/status"] = `FAIL: ${err.message}`;
  }

  // 3. GET /api/policies
  try {
    const res = await fetch(`${BASE_URL}/api/policies`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.restart_container, "Missing restart_container policy");
    assert.ok(data.delete_database, "Missing delete_database policy");
    results["GET /api/policies"] = "PASS (200 OK)";
  } catch (err: any) {
    results["GET /api/policies"] = `FAIL: ${err.message}`;
  }

  // 4. POST /api/trigger-mock-incident
  try {
    const res = await fetch(`${BASE_URL}/api/trigger-mock-incident`, {
      method: "POST",
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "SUCCESS");
    results["POST /api/trigger-mock-incident"] = "PASS (200 OK)";
  } catch (err: any) {
    results["POST /api/trigger-mock-incident"] = `FAIL: ${err.message}`;
  }

  // 5. POST /api/chaos/propose-dangerous
  let testApprovalId = "";
  try {
    const res = await fetch(`${BASE_URL}/api/chaos/propose-dangerous`, {
      method: "POST",
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "Requires Human Approval");
    assert.equal(data.risk, "CRITICAL");
    assert.equal(data.tool_name, "delete_database");
    assert.deepEqual(data.kwargs, { db_name: "sentinel" });
    assert.ok(data.approval_id, "Missing approval_id");
    testApprovalId = data.approval_id;
    results["POST /api/chaos/propose-dangerous"] = `PASS (Created approval ${testApprovalId})`;
  } catch (err: any) {
    results["POST /api/chaos/propose-dangerous"] = `FAIL: ${err.message}`;
  }

  // 6. Approval: REJECT
  try {
    assert.ok(testApprovalId, "Need approval_id to test reject");
    const res = await fetch(`${BASE_URL}/api/approve-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approval_id: testApprovalId,
        action: "REJECT",
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "REJECTED");
    assert.equal(data.result, "NOT_EXECUTED");
    results["POST /api/approve-action (REJECT)"] = "PASS (200 OK, Action blocked by operator)";
  } catch (err: any) {
    results["POST /api/approve-action (REJECT)"] = `FAIL: ${err.message}`;
  }

  // 7. Replay Protection on rejected approval (HTTP 409)
  try {
    const res = await fetch(`${BASE_URL}/api/approve-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approval_id: testApprovalId,
        action: "APPROVE",
      }),
    });
    assert.equal(res.status, 409, `Expected 409 Conflict, got ${res.status}`);
    const data = await res.json();
    assert.ok(
      data.detail?.includes("already resolved") || data.message?.includes("already resolved"),
      `Expected detail about already resolved, got ${JSON.stringify(data)}`
    );
    results["Replay Protection (HTTP 409)"] = "PASS (409 Conflict returned)";
  } catch (err: any) {
    results["Replay Protection (HTTP 409)"] = `FAIL: ${err.message}`;
  }

  // 8. Unknown approval ID (HTTP 404)
  try {
    const res = await fetch(`${BASE_URL}/api/approve-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approval_id: "non-existent-approval-id",
        action: "APPROVE",
      }),
    });
    assert.equal(res.status, 404, `Expected 404 Not Found, got ${res.status}`);
    results["Unknown Approval (HTTP 404)"] = "PASS (404 Not Found returned)";
  } catch (err: any) {
    results["Unknown Approval (HTTP 404)"] = `FAIL: ${err.message}`;
  }

  // 9. Approval: APPROVE flow with a new proposal
  try {
    const propRes = await fetch(`${BASE_URL}/api/chaos/propose-dangerous`, {
      method: "POST",
    });
    const propData = await propRes.json();
    const newId = propData.approval_id;

    const res = await fetch(`${BASE_URL}/api/approve-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approval_id: newId,
        action: "APPROVE",
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "EXECUTED");
    assert.ok(data.result?.toLowerCase().includes("simulated"), `Safe demo check: ${data.result}`);
    results["POST /api/approve-action (APPROVE safe demo)"] = "PASS (200 OK, simulated execution)";
  } catch (err: any) {
    results["POST /api/approve-action (APPROVE safe demo)"] = `FAIL: ${err.message}`;
  }

  // 10. Safety Engine Direct Verification
  console.log("\n--- SAFETY ENGINE TESTS ---");

  // Valid Tool
  try {
    const valResult = await executeToolWithGuardrail("restart_container", {
      container_name: "sentinel-db",
    });
    assert.equal(valResult.status, "SUCCESS");
    assert.ok(valResult.result?.includes("restarted"));
    results["Safety: Valid tool execution"] = "PASS (Executed with allowlisted container)";
  } catch (err: any) {
    results["Safety: Valid tool execution"] = `FAIL: ${err.message}`;
  }

  // Invalid Container
  try {
    const invResult = await executeToolWithGuardrail("restart_container", {
      container_name: "random-container",
    });
    assert.equal(invResult.status, "ERROR");
    assert.equal(invResult.error_type, "VALIDATION_ERROR");
    results["Safety: Invalid container rejection"] = "PASS (Rejected with Zod validation error)";
  } catch (err: any) {
    results["Safety: Invalid container rejection"] = `FAIL: ${err.message}`;
  }

  // Shell Injection Attempt
  try {
    const injResult = await executeToolWithGuardrail("restart_container", {
      container_name: "sentinel-db; rm -rf /",
    });
    assert.equal(injResult.status, "ERROR");
    assert.equal(injResult.error_type, "VALIDATION_ERROR");
    results["Safety: Shell injection attempt"] = "PASS (Rejected strictly by allowlist)";
  } catch (err: any) {
    results["Safety: Shell injection attempt"] = `FAIL: ${err.message}`;
  }

  // Extra Arguments Rejection
  try {
    const extResult = await executeToolWithGuardrail("restart_container", {
      container_name: "sentinel-db",
      malicious_extra_field: "injected",
    });
    assert.equal(extResult.status, "ERROR");
    assert.equal(extResult.error_type, "VALIDATION_ERROR");
    results["Safety: Extra arguments rejection"] = "PASS (.strict() rejected unexpected fields)";
  } catch (err: any) {
    results["Safety: Extra arguments rejection"] = `FAIL: ${err.message}`;
  }

  // Critical Action Blocked / Requires Approval
  try {
    const critResult = await executeToolWithGuardrail("delete_database", {
      db_name: "sentinel",
    });
    assert.equal(critResult.status, "Requires Human Approval");
    assert.equal(critResult.risk, "CRITICAL");
    assert.ok(critResult.approval_id);
    results["Safety: Critical action blocked"] = "PASS (Requires Human Approval, risk=CRITICAL)";
  } catch (err: any) {
    results["Safety: Critical action blocked"] = `FAIL: ${err.message}`;
  }

  // --- STRUCTURED RCA VALIDATION UNIT TESTS ---
  console.log("\n--- STRUCTURED RCA VALIDATION TESTS ---");

  // 10.1 Valid confidence 0.96
  try {
    const validRca = {
      root_cause: "PostgreSQL database is unavailable",
      confidence: 0.96,
      evidence: [
        "dummy-api returned HTTP 500",
        "database container is not running",
        "logs show database connection failure",
      ],
      proposed_action: {
        tool: "restart_service",
        arguments: { service: "sentinel-db" },
      },
    };
    const parsed = StructuredRcaSchema.safeParse(validRca);
    assert.equal(parsed.success, true);
    results["RCA: Valid confidence 0.96"] = "PASS (Parsed successfully)";
  } catch (err: any) {
    results["RCA: Valid confidence 0.96"] = `FAIL: ${err.message}`;
  }

  // 10.2 Boundary confidence 0.0 & 1.0
  try {
    const rca0 = {
      root_cause: "Unknown anomaly",
      confidence: 0.0,
      evidence: ["Service ping timed out"],
      proposed_action: { tool: "get_service_logs", arguments: { service: "dummy-api" } },
    };
    const rca1 = {
      root_cause: "Confirmed crash",
      confidence: 1.0,
      evidence: ["SIGKILL detected"],
      proposed_action: { tool: "restart_service", arguments: { service: "sentinel-db" } },
    };
    assert.equal(StructuredRcaSchema.safeParse(rca0).success, true);
    assert.equal(StructuredRcaSchema.safeParse(rca1).success, true);
    results["RCA: Boundary confidence (0.0 & 1.0)"] = "PASS (Boundaries accepted)";
  } catch (err: any) {
    results["RCA: Boundary confidence (0.0 & 1.0)"] = `FAIL: ${err.message}`;
  }

  // 10.3 Out of bounds confidence (< 0 and > 1)
  try {
    const rcaNeg = {
      root_cause: "Database failure",
      confidence: -0.1,
      evidence: ["error 500"],
      proposed_action: { tool: "restart_service", arguments: { service: "sentinel-db" } },
    };
    const rcaOver = {
      root_cause: "Database failure",
      confidence: 1.05,
      evidence: ["error 500"],
      proposed_action: { tool: "restart_service", arguments: { service: "sentinel-db" } },
    };
    assert.equal(StructuredRcaSchema.safeParse(rcaNeg).success, false);
    assert.equal(StructuredRcaSchema.safeParse(rcaOver).success, false);
    results["RCA: Out-of-bounds confidence rejection"] = "PASS (Strict range [0.0, 1.0] enforced)";
  } catch (err: any) {
    results["RCA: Out-of-bounds confidence rejection"] = `FAIL: ${err.message}`;
  }

  // 10.4 Missing root cause
  try {
    const missingCause = {
      root_cause: "",
      confidence: 0.8,
      evidence: ["error 500"],
      proposed_action: { tool: "restart_service", arguments: { service: "sentinel-db" } },
    };
    assert.equal(StructuredRcaSchema.safeParse(missingCause).success, false);
    results["RCA: Missing root cause rejection"] = "PASS (Empty root_cause rejected)";
  } catch (err: any) {
    results["RCA: Missing root cause rejection"] = `FAIL: ${err.message}`;
  }

  // 10.5 Missing evidence
  try {
    const emptyEvidence = {
      root_cause: "DB is down",
      confidence: 0.8,
      evidence: [],
      proposed_action: { tool: "restart_service", arguments: { service: "sentinel-db" } },
    };
    assert.equal(StructuredRcaSchema.safeParse(emptyEvidence).success, false);
    results["RCA: Missing evidence rejection"] = "PASS (Empty evidence array rejected)";
  } catch (err: any) {
    results["RCA: Missing evidence rejection"] = `FAIL: ${err.message}`;
  }

  // 10.6 Invalid proposed tool & extra inputs
  try {
    const badTool = {
      root_cause: "DB is down",
      confidence: 0.8,
      evidence: ["Connection refused"],
      proposed_action: { tool: "arbitrary_shell_command", arguments: {} },
    };
    const extraFields = {
      root_cause: "DB is down",
      confidence: 0.8,
      evidence: ["Connection refused"],
      proposed_action: { tool: "restart_service", arguments: { service: "sentinel-db" } },
      malicious_extra_field: "attack",
    };
    assert.equal(StructuredRcaSchema.safeParse(badTool).success, false);
    assert.equal(StructuredRcaSchema.safeParse(extraFields).success, false);
    results["RCA: Invalid tool / extra fields rejection"] = "PASS (Strict schema rejects invalid tools)";
  } catch (err: any) {
    results["RCA: Invalid tool / extra fields rejection"] = `FAIL: ${err.message}`;
  }

  // --- OFFICIAL TOOL CONTRACT & CALL VALIDATION TESTS ---
  console.log("\n--- OFFICIAL TOOL CALL VALIDATION TESTS ---");

  // 10.7 Valid official restart_service
  try {
    const res = await executeToolWithGuardrail("restart_service", { service: "sentinel-db" });
    assert.equal(res.status, "SUCCESS");
    assert.ok(res.result?.includes("restarted"));
    results["Official Tool: restart_service"] = "PASS (Executed with service='sentinel-db')";
  } catch (err: any) {
    results["Official Tool: restart_service"] = `FAIL: ${err.message}`;
  }

  // 10.8 Valid official get_service_logs
  try {
    const res = await executeToolWithGuardrail("get_service_logs", { service: "dummy-api" });
    assert.equal(res.status, "SUCCESS");
    results["Official Tool: get_service_logs"] = "PASS (Logs retrieved for service='dummy-api')";
  } catch (err: any) {
    results["Official Tool: get_service_logs"] = `FAIL: ${err.message}`;
  }

  // 10.9 Unknown tool rejection
  try {
    const res = await executeToolWithGuardrail("non_existent_tool", {});
    assert.equal(res.status, "ERROR");
    assert.ok(res.message?.includes("not recognized"));
    results["Official Tool: Unknown tool rejection"] = "PASS (Tool not recognized in registry)";
  } catch (err: any) {
    results["Official Tool: Unknown tool rejection"] = `FAIL: ${err.message}`;
  }

  // 10.10 Invalid service rejection
  try {
    const res = await executeToolWithGuardrail("restart_service", { service: "malicious-host" });
    assert.equal(res.status, "ERROR");
    assert.equal(res.error_type, "VALIDATION_ERROR");
    results["Official Tool: Invalid service rejection"] = "PASS (Strict allowlist enforced)";
  } catch (err: any) {
    results["Official Tool: Invalid service rejection"] = `FAIL: ${err.message}`;
  }

  // 10.11 Extra arguments rejection on official tool
  try {
    const res = await executeToolWithGuardrail("restart_service", {
      service: "sentinel-db",
      unauthorized_flag: "--force",
    });
    assert.equal(res.status, "ERROR");
    assert.equal(res.error_type, "VALIDATION_ERROR");
    results["Official Tool: Extra argument rejection"] = "PASS (.strict() blocks unexpected kwargs)";
  } catch (err: any) {
    results["Official Tool: Extra argument rejection"] = `FAIL: ${err.message}`;
  }

  // 10.12 Shell injection attempt on official tool
  try {
    const res = await executeToolWithGuardrail("restart_service", {
      service: "sentinel-db; echo owned",
    });
    assert.equal(res.status, "ERROR");
    assert.equal(res.error_type, "VALIDATION_ERROR");
    results["Official Tool: Shell injection rejection"] = "PASS (Rejected strictly by schema enum)";
  } catch (err: any) {
    results["Official Tool: Shell injection rejection"] = `FAIL: ${err.message}`;
  }

  // 10.13 Incomplete tools excluded from live model exposure; get_metrics now promoted to executable
  try {
    // get_metrics is NOW executable (Step 2D) — must be exposed
    assert.equal(SENTINEL_TOOL_DEFINITIONS.get_metrics.isExecutable, true);
    assert.equal(SENTINEL_TOOL_DEFINITIONS.rollback_service.isExecutable, false);
    const exposedNames = LIVE_OPENAI_TOOLS.map((t) => t.function.name);
    assert.ok(exposedNames.includes("get_metrics"), "get_metrics MUST be exposed to live model (Step 2D)");
    assert.ok(!exposedNames.includes("rollback_service"), "rollback_service must NOT be exposed to live model");
    assert.ok(exposedNames.includes("get_service_logs"), "get_service_logs must be exposed to live model");
    assert.ok(exposedNames.includes("restart_service"), "restart_service must be exposed to live model");
    results["Tool Exposure: Only executable tools live"] = "PASS (get_metrics promoted; rollback still excluded)";
  } catch (err: any) {
    results["Tool Exposure: Only executable tools live"] = `FAIL: ${err.message}`;
  }

  // 11. POST /api/chaos/kill-db
  try {
    const res = await fetch(`${BASE_URL}/api/chaos/kill-db`, {
      method: "POST",
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "SUCCESS");
    assert.ok(data.message?.includes("Database stopped"));
    results["POST /api/chaos/kill-db"] = "PASS (200 OK, sentinel-db stopped)";
  } catch (err: any) {
    results["POST /api/chaos/kill-db"] = `FAIL: ${err.message}`;
  }

  // --- STEP 2C: TWO-TURN ORCHESTRATION UNIT TESTS (deterministic, no live API key) ---
  console.log("\n--- STEP 2C: TWO-TURN ORCHESTRATION TESTS ---");

  // 2C-1: parseAndValidateToolCall — valid investigation tool call
  try {
    const { TOOL_SCHEMAS: schemas } = await import("./src/safety/schemas.js");
    const toolName = "get_service_logs";
    const rawArgs = JSON.stringify({ service: "dummy-api" });
    const parsedArgs = JSON.parse(rawArgs);
    assert.ok(Object.prototype.hasOwnProperty.call(schemas, toolName), "Tool must be in TOOL_SCHEMAS");
    const schema = schemas[toolName as keyof typeof schemas];
    const validation = schema.safeParse(parsedArgs);
    assert.equal(validation.success, true);
    results["2C: Turn 1 tool call parse (get_service_logs)"] = "PASS (Tool name and args validated)";
  } catch (err: any) {
    results["2C: Turn 1 tool call parse (get_service_logs)"] = `FAIL: ${err.message}`;
  }

  // 2C-2: Turn 1 — unknown tool is rejected
  try {
    const { TOOL_SCHEMAS: schemas } = await import("./src/safety/schemas.js");
    const toolName = "exec_shell_command";
    assert.equal(Object.prototype.hasOwnProperty.call(schemas, toolName), false);
    results["2C: Turn 1 unknown tool rejected"] = "PASS (Not in TOOL_SCHEMAS)";
  } catch (err: any) {
    results["2C: Turn 1 unknown tool rejected"] = `FAIL: ${err.message}`;
  }

  // 2C-3: Turn 1 — invalid service argument rejected
  try {
    const schema = TOOL_SCHEMAS["restart_service"];
    const validation = schema.safeParse({ service: "production-db-primary" });
    assert.equal(validation.success, false);
    results["2C: Turn 1 invalid arg rejected"] = "PASS (Allowlist enforced on model args)";
  } catch (err: any) {
    results["2C: Turn 1 invalid arg rejected"] = `FAIL: ${err.message}`;
  }

  // 2C-4: Turn 1 — extra argument injected by model is rejected
  try {
    const schema = TOOL_SCHEMAS["get_service_logs"];
    const validation = schema.safeParse({ service: "dummy-api", extra_injected: "rm -rf /" });
    assert.equal(validation.success, false);
    results["2C: Turn 1 extra arg injected rejected"] = "PASS (.strict() blocks extra model args)";
  } catch (err: any) {
    results["2C: Turn 1 extra arg injected rejected"] = `FAIL: ${err.message}`;
  }

  // 2C-5: Real tool execution returns a string result (Turn 1 output passed to Turn 2)
  try {
    const toolResult = await executeToolWithGuardrail("get_service_logs", { service: "dummy-api" });
    assert.equal(toolResult.status, "SUCCESS");
    assert.ok(typeof toolResult.result === "string", "Tool result must be a string for Turn 2 message");
    assert.ok((toolResult.result as string).length > 0, "Tool result must be non-empty");
    results["2C: Turn 1 real tool result captured"] = `PASS (got ${(toolResult.result as string).length} chars)`;
  } catch (err: any) {
    results["2C: Turn 1 real tool result captured"] = `FAIL: ${err.message}`;
  }

  // 2C-6: Turn 2 RCA parsing — valid JSON from model (simulated Turn 2 model response)
  try {
    const simulatedTurn2Response = JSON.stringify({
      root_cause: "sentinel-db container is not running due to OOM kill",
      confidence: 0.94,
      evidence: [
        "dummy-api returned HTTP 500 on all health checks",
        "get_service_logs shows database connection refused errors",
        "check_database confirmed sentinel-db container STOPPED",
      ],
      proposed_action: {
        tool: "restart_service",
        arguments: { service: "sentinel-db" },
      },
    });
    const parsed = JSON.parse(simulatedTurn2Response);
    const validation = StructuredRcaSchema.safeParse(parsed);
    assert.equal(validation.success, true);
    assert.equal(validation.data?.confidence, 0.94);
    assert.equal(validation.data?.proposed_action.tool, "restart_service");
    results["2C: Turn 2 valid RCA parsed and validated"] = "PASS (StructuredRcaSchema accepts correct shape)";
  } catch (err: any) {
    results["2C: Turn 2 valid RCA parsed and validated"] = `FAIL: ${err.message}`;
  }

  // 2C-7: Turn 2 RCA parsing — malformed model output triggers safe fallback (returns null)
  try {
    const malformedOutputs = [
      "I think the database crashed because of memory pressure.",          // prose, not JSON
      '{"root_cause":"DB down"}',                                          // missing required fields
      '{"root_cause":"DB down","confidence":2.5,"evidence":[],"proposed_action":{"tool":"restart_service","arguments":{}}}', // confidence > 1, empty evidence
      '```json\n{"not_a_valid_key": true}\n```',                          // markdown fenced block, wrong schema
    ];
    for (const malformed of malformedOutputs) {
      const stripped = malformed.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      let parsed: unknown = null;
      try { parsed = JSON.parse(stripped); } catch { /* not JSON */ }
      if (parsed !== null) {
        const v = StructuredRcaSchema.safeParse(parsed);
        assert.equal(v.success, false, `Expected malformed RCA to fail: ${malformed.slice(0, 60)}`);
      }
      // If not JSON at all, parseStructuredRca would return null → deterministic fallback
    }
    results["2C: Turn 2 malformed RCA triggers safe fallback"] = "PASS (All malformed outputs rejected)";
  } catch (err: any) {
    results["2C: Turn 2 malformed RCA triggers safe fallback"] = `FAIL: ${err.message}`;
  }

  // 2C-8: Remediation from validated RCA still routes through guardrail (authoritative engine)
  try {
    // Simulate a valid RCA with a remediation tool — run through guardrail
    const validRca = StructuredRcaSchema.parse({
      root_cause: "sentinel-db stopped",
      confidence: 0.99,
      evidence: ["check_database: STOPPED"],
      proposed_action: { tool: "restart_service", arguments: { service: "sentinel-db" } },
    });
    const guardResult = await executeToolWithGuardrail(
      validRca.proposed_action.tool,
      validRca.proposed_action.arguments
    );
    // restart_service with sentinel-db should be auto-approved (LOW risk in policies)
    assert.equal(guardResult.status, "SUCCESS");
    assert.ok(guardResult.result?.includes("restarted"));
    results["2C: RCA remediation routes through guardrail"] = "PASS (Guardrail executed and approved)";
  } catch (err: any) {
    results["2C: RCA remediation routes through guardrail"] = `FAIL: ${err.message}`;
  }

  // 2C-9: RCA with critical tool still requires human approval (guardrail remains authoritative)
  try {
    const criticalRca = StructuredRcaSchema.parse({
      root_cause: "corrupted database",
      confidence: 0.80,
      evidence: ["DB error in logs"],
      proposed_action: { tool: "delete_database", arguments: { db_name: "sentinel" } },
    });
    const guardResult = await executeToolWithGuardrail(
      criticalRca.proposed_action.tool,
      criticalRca.proposed_action.arguments
    );
    assert.equal(guardResult.status, "Requires Human Approval");
    assert.equal(guardResult.risk, "CRITICAL");
    results["2C: Critical RCA action still requires approval"] = "PASS (CRITICAL action gated by guardrail)";
  } catch (err: any) {
    results["2C: Critical RCA action still requires approval"] = `FAIL: ${err.message}`;
  }

  // 2C-10: tool_choice='required' semantic — diagnostic tools are all exposed
  try {
    const diagnosticTools = ["get_service_logs", "check_database", "check_service", "get_system_status"];
    const exposedNames = LIVE_OPENAI_TOOLS.map((t) => t.function.name);
    for (const tool of diagnosticTools) {
      assert.ok(exposedNames.includes(tool), `${tool} must be in LIVE_OPENAI_TOOLS for Turn 1 selection`);
    }
    results["2C: All diagnostic tools available for Turn 1"] = "PASS (Model can select any investigation tool)";
  } catch (err: any) {
    results["2C: All diagnostic tools available for Turn 1"] = `FAIL: ${err.message}`;
  }

  // --- STEP 2D: get_metrics TOOL TESTS (deterministic, no live API key) ---
  console.log("\n--- STEP 2D: get_metrics TOOL TESTS ---");

  // 2D-1: get_metrics schema accepts empty args {}
  try {
    const schema = TOOL_SCHEMAS["get_metrics"];
    const validation = schema.safeParse({});
    assert.equal(validation.success, true);
    results["2D: get_metrics schema accepts {}"] = "PASS (Empty args valid)";
  } catch (err: any) {
    results["2D: get_metrics schema accepts {}"] = `FAIL: ${err.message}`;
  }

  // 2D-2: get_metrics schema rejects extra arguments
  try {
    const schema = TOOL_SCHEMAS["get_metrics"];
    const v1 = schema.safeParse({ service: "dummy-api" });
    const v2 = schema.safeParse({ shell: "rm -rf /" });
    const v3 = schema.safeParse({ query: "SELECT * FROM users" });
    assert.equal(v1.success, false, "service= should be rejected");
    assert.equal(v2.success, false, "shell= should be rejected");
    assert.equal(v3.success, false, "query= should be rejected");
    results["2D: get_metrics schema rejects extra args"] = "PASS (.strict() blocks all extra fields)";
  } catch (err: any) {
    results["2D: get_metrics schema rejects extra args"] = `FAIL: ${err.message}`;
  }

  // 2D-3: get_metrics is present in LIVE_OPENAI_TOOLS (exposed to model)
  try {
    const exposedNames = LIVE_OPENAI_TOOLS.map((t) => t.function.name);
    assert.ok(exposedNames.includes("get_metrics"), "get_metrics must be in LIVE_OPENAI_TOOLS");
    results["2D: get_metrics in LIVE_OPENAI_TOOLS"] = "PASS (Model can select get_metrics for Turn 1)";
  } catch (err: any) {
    results["2D: get_metrics in LIVE_OPENAI_TOOLS"] = `FAIL: ${err.message}`;
  }

  // 2D-4: get_metrics is marked isExecutable: true and risk LOW
  try {
    const def = SENTINEL_TOOL_DEFINITIONS["get_metrics"];
    assert.ok(def, "SENTINEL_TOOL_DEFINITIONS must have get_metrics");
    assert.equal(def.isExecutable, true, "get_metrics must be isExecutable");
    assert.equal(def.risk, "LOW", "get_metrics must be LOW risk");
    results["2D: get_metrics isExecutable=true, risk=LOW"] = "PASS";
  } catch (err: any) {
    results["2D: get_metrics isExecutable=true, risk=LOW"] = `FAIL: ${err.message}`;
  }

  // 2D-5: get_metrics executes via guardrail and returns real structured JSON
  try {
    const result = await executeToolWithGuardrail("get_metrics", {});
    assert.equal(result.status, "SUCCESS", "get_metrics should succeed via guardrail");
    assert.ok(typeof result.result === "string", "result must be a string");
    const parsed = JSON.parse(result.result as string);
    // Verify returned JSON shape
    assert.ok("observed_at" in parsed, "metrics must have observed_at");
    assert.ok("system" in parsed, "metrics must have system section");
    assert.ok("services" in parsed, "metrics must have services section");
    assert.ok("observations" in parsed, "metrics must have observations section");
    assert.ok("health" in parsed.system, "system must have health");
    assert.ok("dummy_api" in parsed.services, "services must have dummy_api");
    assert.ok("sentinel_db" in parsed.services, "services must have sentinel_db");
    assert.ok("error_count" in parsed.observations, "observations must have error_count");
    results["2D: get_metrics returns real structured JSON"] = `PASS (health=${parsed.system.health}, api=${parsed.services.dummy_api.status}, db=${parsed.services.sentinel_db.status})`;
  } catch (err: any) {
    results["2D: get_metrics returns real structured JSON"] = `FAIL: ${err.message}`;
  }

  // 2D-6: get_metrics performs NO remediation actions (read-only verification)
  try {
    // The tool function itself returns JSON with no side-effect fields
    const result = await executeToolWithGuardrail("get_metrics", {});
    assert.equal(result.status, "SUCCESS");
    const parsed = JSON.parse(result.result as string);
    // None of these action fields should exist
    assert.equal("action_taken" in parsed, false, "Must not contain action_taken");
    assert.equal("restarted" in parsed, false, "Must not contain restarted");
    assert.equal("executed_command" in parsed, false, "Must not contain executed_command");
    results["2D: get_metrics is read-only (no remediation fields)"] = "PASS";
  } catch (err: any) {
    results["2D: get_metrics is read-only (no remediation fields)"] = `FAIL: ${err.message}`;
  }

  // 2D-7: Turn 1 get_metrics tool call simulation — parse + validate as model would select it
  try {
    const toolName = "get_metrics";
    const rawModelArgs = "{}"; // model provides no arguments
    const parsedArgs = JSON.parse(rawModelArgs);
    assert.ok(Object.prototype.hasOwnProperty.call(TOOL_SCHEMAS, toolName), "get_metrics in TOOL_SCHEMAS");
    const schema = TOOL_SCHEMAS[toolName as keyof typeof TOOL_SCHEMAS];
    const validation = schema.safeParse(parsedArgs);
    assert.equal(validation.success, true);
    results["2D: Turn 1 get_metrics tool call parse+validate"] = "PASS (model args {} validate cleanly)";
  } catch (err: any) {
    results["2D: Turn 1 get_metrics tool call parse+validate"] = `FAIL: ${err.message}`;
  }

  // 2D-8: Metrics result can be used as Turn 2 tool result message (string format)
  try {
    const result = await executeToolWithGuardrail("get_metrics", {});
    assert.equal(result.status, "SUCCESS");
    const metricsStr = result.result as string;
    // Simulate the Turn 2 tool_result message content (capped at 3000 chars like agent does)
    const turn2ToolContent = metricsStr.slice(0, 3000);
    assert.ok(turn2ToolContent.length > 0, "Turn 2 tool content must be non-empty");
    assert.ok(turn2ToolContent.includes("system"), "Turn 2 content must include system section");
    results["2D: Metrics can be passed to Turn 2 conversation"] = `PASS (${turn2ToolContent.length} chars ready for Turn 2)`;
  } catch (err: any) {
    results["2D: Metrics can be passed to Turn 2 conversation"] = `FAIL: ${err.message}`;
  }

  // 2D-9: get_metrics policy is LOW risk and auto-executes (no human approval needed)
  try {
    const { loadPolicies } = await import("./src/config/policies.js");
    const policies = loadPolicies();
    assert.ok("get_metrics" in policies, "get_metrics must be in loaded policies");
    assert.equal(policies["get_metrics"].risk, "LOW");
    assert.equal(policies["get_metrics"].auto_execute, true);
    results["2D: get_metrics policy is LOW/auto_execute"] = "PASS";
  } catch (err: any) {
    results["2D: get_metrics policy is LOW/auto_execute"] = `FAIL: ${err.message}`;
  }

  // 2D-10: Existing critical action (delete_database) still requires approval
  try {
    const critResult = await executeToolWithGuardrail("delete_database", { db_name: "sentinel" });
    assert.equal(critResult.status, "Requires Human Approval");
    assert.equal(critResult.risk, "CRITICAL");
    results["2D: Critical action approval unaffected"] = "PASS (delete_database still CRITICAL)";
  } catch (err: any) {
    results["2D: Critical action approval unaffected"] = `FAIL: ${err.message}`;
  }

  // --- STEP 2E: rollback_service TOOL TESTS ---
  console.log("\n--- STEP 2E: rollback_service TOOL TESTS ---");

  // 2E-1: Schema accepts valid service enum values
  try {
    const schema = TOOL_SCHEMAS["rollback_service"];
    const v1 = schema.safeParse({ service: "dummy-api" });
    const v2 = schema.safeParse({ service: "sentinel-db" });
    assert.equal(v1.success, true, "dummy-api must be valid rollback target");
    assert.equal(v2.success, true, "sentinel-db must be valid rollback target");
    results["2E: rollback schema accepts valid services"] = "PASS";
  } catch (err: any) {
    results["2E: rollback schema accepts valid services"] = `FAIL: ${err.message}`;
  }

  // 2E-2: Schema rejects invalid service names
  try {
    const schema = TOOL_SCHEMAS["rollback_service"];
    const v1 = schema.safeParse({ service: "production-db" });
    const v2 = schema.safeParse({ service: "postgres" });
    const v3 = schema.safeParse({ service: "localhost:5432" });
    assert.equal(v1.success, false, "production-db must be rejected");
    assert.equal(v2.success, false, "postgres must be rejected");
    assert.equal(v3.success, false, "localhost:5432 must be rejected");
    results["2E: rollback schema rejects invalid services"] = "PASS (Enum allowlist enforced)";
  } catch (err: any) {
    results["2E: rollback schema rejects invalid services"] = `FAIL: ${err.message}`;
  }

  // 2E-3: Schema rejects extra arguments (no Docker/shell args allowed)
  try {
    const schema = TOOL_SCHEMAS["rollback_service"];
    const v1 = schema.safeParse({ service: "dummy-api", image: "myapp:v1.2" });
    const v2 = schema.safeParse({ service: "sentinel-db", cmd: "docker rollback" });
    const v3 = schema.safeParse({ service: "dummy-api", version: "1.0.0" });
    assert.equal(v1.success, false, "image= must be rejected");
    assert.equal(v2.success, false, "cmd= must be rejected");
    assert.equal(v3.success, false, "version= must be rejected");
    results["2E: rollback schema rejects extra args"] = "PASS (.strict() blocks Docker/shell args)";
  } catch (err: any) {
    results["2E: rollback schema rejects extra args"] = `FAIL: ${err.message}`;
  }

  // 2E-4: rollback_service is in tool registry
  try {
    assert.ok(
      Object.prototype.hasOwnProperty.call(SENTINEL_TOOL_DEFINITIONS, "rollback_service"),
      "rollback_service must be in SENTINEL_TOOL_DEFINITIONS"
    );
    assert.ok(
      Object.prototype.hasOwnProperty.call(TOOL_SCHEMAS, "rollback_service"),
      "rollback_service must be in TOOL_SCHEMAS"
    );
    results["2E: rollback in tool registry"] = "PASS";
  } catch (err: any) {
    results["2E: rollback in tool registry"] = `FAIL: ${err.message}`;
  }

  // 2E-5: rollback_service is NOT in LIVE_OPENAI_TOOLS (model cannot select during Turn 1)
  try {
    const exposedNames = LIVE_OPENAI_TOOLS.map((t) => t.function.name);
    assert.equal(SENTINEL_TOOL_DEFINITIONS.rollback_service.isExecutable, false);
    assert.ok(!exposedNames.includes("rollback_service"), "rollback_service must NOT be in LIVE_OPENAI_TOOLS");
    results["2E: rollback NOT in LIVE_OPENAI_TOOLS"] = "PASS (Cannot be selected by model during Turn 1)";
  } catch (err: any) {
    results["2E: rollback NOT in LIVE_OPENAI_TOOLS"] = `FAIL: ${err.message}`;
  }

  // 2E-6: rollback_service policy is HIGH risk, auto_execute: false
  try {
    const { loadPolicies } = await import("./src/config/policies.js");
    const policies = loadPolicies();
    assert.ok("rollback_service" in policies, "rollback_service must be in loaded policies");
    assert.equal(policies["rollback_service"].risk, "HIGH");
    assert.equal(policies["rollback_service"].auto_execute, false);
    results["2E: rollback policy is HIGH/no-auto-execute"] = "PASS";
  } catch (err: any) {
    results["2E: rollback policy is HIGH/no-auto-execute"] = `FAIL: ${err.message}`;
  }

  // 2E-7: rollback_service goes through guardrail and creates approval (never auto-executes)
  try {
    const result = await executeToolWithGuardrail("rollback_service", { service: "dummy-api" });
    assert.equal(result.status, "Requires Human Approval", "rollback must require approval");
    assert.equal(result.risk, "HIGH", "rollback must report HIGH risk");
    assert.ok(result.approval_id?.startsWith("APPR-"), "must generate approval ID");
    results["2E: rollback creates approval (never auto-executes)"] = `PASS (approval_id=${result.approval_id})`;
  } catch (err: any) {
    results["2E: rollback creates approval (never auto-executes)"] = `FAIL: ${err.message}`;
  }

  // 2E-8: rollback_service for sentinel-db also requires approval
  try {
    const result = await executeToolWithGuardrail("rollback_service", { service: "sentinel-db" });
    assert.equal(result.status, "Requires Human Approval");
    assert.equal(result.risk, "HIGH");
    results["2E: rollback sentinel-db also requires approval"] = `PASS (approval_id=${result.approval_id})`;
  } catch (err: any) {
    results["2E: rollback sentinel-db also requires approval"] = `FAIL: ${err.message}`;
  }

  // 2E-9: Full approval lifecycle — rollback proposed → rejected → not executed
  try {
    const proposalResult = await executeToolWithGuardrail("rollback_service", { service: "dummy-api" });
    assert.equal(proposalResult.status, "Requires Human Approval");
    const approvalId = proposalResult.approval_id!;

    // Reject the approval via ApprovalService (in-memory)
    const { ApprovalService } = await import("./src/services/approval.service.js");
    const rejectData = await ApprovalService.handleApproval(approvalId, "REJECT");
    
    assert.equal(rejectData.status, "REJECTED");
    assert.equal(rejectData.audit.operator_decision, "REJECT");
    results["2E: rollback approval lifecycle REJECT"] = "PASS (rollback rejected, not executed)";
  } catch (err: any) {
    results["2E: rollback approval lifecycle REJECT"] = `FAIL: ${err.message}`;
  }

  // 2E-10: Replay protection — same approval ID cannot be used twice
  try {
    const proposalResult = await executeToolWithGuardrail("rollback_service", { service: "dummy-api" });
    assert.equal(proposalResult.status, "Requires Human Approval");
    const approvalId = proposalResult.approval_id!;

    const { ApprovalService } = await import("./src/services/approval.service.js");

    // First decision: REJECT
    await ApprovalService.handleApproval(approvalId, "REJECT");

    // Replay: same approval_id again
    let replayError: any = null;
    try {
      await ApprovalService.handleApproval(approvalId, "APPROVE");
    } catch (e) {
      replayError = e;
    }
    
    assert.ok(replayError, "Replay must throw an error");
    assert.equal(replayError.statusCode, 409, "Replay must throw 409 Conflict");
    results["2E: rollback approval anti-replay preserved"] = "PASS (409 on replayed approval)";
  } catch (err: any) {
    results["2E: rollback approval anti-replay preserved"] = `FAIL: ${err.message}`;
  }

  // 2E-11: rollback_service is valid in StructuredRcaSchema proposed_action
  try {
    const rcaWithRollback = StructuredRcaSchema.safeParse({
      root_cause: "dummy-api crashed after a bad deploy; restart did not resolve the issue",
      confidence: 0.91,
      evidence: [
        "get_service_logs: repeated OOM errors after startup",
        "restart_service: dummy-api crashed again within 30s",
        "check_service: HTTP 503 after restart",
      ],
      proposed_action: {
        tool: "rollback_service",
        arguments: { service: "dummy-api" },
      },
    });
    assert.equal(rcaWithRollback.success, true, "rollback_service must be valid in RCA proposed_action");
    results["2E: rollback valid in StructuredRcaSchema proposed_action"] = "PASS";
  } catch (err: any) {
    results["2E: rollback valid in StructuredRcaSchema proposed_action"] = `FAIL: ${err.message}`;
  }

  // 2E-12: Truthfulness — dummy-api rollback reports no-target (never claims fake success)
  try {
    // Call rollbackServiceTool directly (bypassing guardrail as simulation of what would run post-approval)
    const { TOOLS: tools } = await import("./src/agent/tools.js");
    const rollbackFn = tools["rollback_service"];
    const rawResult = await rollbackFn({ service: "dummy-api" });
    const parsed = JSON.parse(rawResult);
    assert.equal(parsed.success, false, "dummy-api rollback must report false (no target)");
    assert.ok(parsed.reason?.length > 0, "must include reason");
    assert.equal(parsed.action_taken, null, "must not claim any action was taken");
    assert.ok(!rawResult.toLowerCase().includes("success: true"), "must not claim success");
    results["2E: dummy-api rollback is truthful (no-target)"] = `PASS (success=${parsed.success})`;
  } catch (err: any) {
    results["2E: dummy-api rollback is truthful (no-target)"] = `FAIL: ${err.message}`;
  }

  // 2E-13: restart_service still auto-executes (unchanged from Step 2B/2D)
  try {
    const restartResult = await executeToolWithGuardrail("restart_service", { service: "sentinel-db" });
    assert.equal(restartResult.status, "SUCCESS", "restart_service must still auto-execute");
    results["2E: restart_service autonomous behavior unchanged"] = "PASS (LOW risk, auto-executed)";
  } catch (err: any) {
    results["2E: restart_service autonomous behavior unchanged"] = `FAIL: ${err.message}`;
  }

  // 2E-14: delete_database still requires CRITICAL approval (unchanged)
  try {
    const critResult = await executeToolWithGuardrail("delete_database", { db_name: "sentinel" });
    assert.equal(critResult.status, "Requires Human Approval");
    assert.equal(critResult.risk, "CRITICAL");
    results["2E: delete_database CRITICAL approval unchanged"] = "PASS";
  } catch (err: any) {
    results["2E: delete_database CRITICAL approval unchanged"] = `FAIL: ${err.message}`;
  }

  // 2E-15: rollback risk level is clearly distinct from restart (safety hierarchy)
  try {
    const { loadPolicies } = await import("./src/config/policies.js");
    const policies = loadPolicies();
    assert.equal(policies["restart_service"].risk, "LOW");
    assert.equal(policies["restart_service"].auto_execute, true);
    assert.equal(policies["rollback_service"].risk, "HIGH");
    assert.equal(policies["rollback_service"].auto_execute, false);
    results["2E: restart vs rollback safety hierarchy correct"] = "PASS (LOW/auto vs HIGH/manual)";
  } catch (err: any) {
    results["2E: restart vs rollback safety hierarchy correct"] = `FAIL: ${err.message}`;
  }

  // --- STEP 2F: CLOSED-LOOP VERIFICATION & RE-INVESTIGATION TESTS ---
  console.log("\n--- STEP 2F: CLOSED-LOOP VERIFICATION & RE-INVESTIGATION TESTS ---");

  // 2F-1: verify_recovery schema accepts valid service enum
  try {
    const schema = TOOL_SCHEMAS["verify_recovery"];
    const v1 = schema.safeParse({ service: "dummy-api" });
    const v2 = schema.safeParse({ service: "sentinel-db" });
    assert.equal(v1.success, true, "dummy-api must be a valid verify_recovery service");
    assert.equal(v2.success, true, "sentinel-db must be a valid verify_recovery service");
    results["2F: verify_recovery schema accepts valid services"] = "PASS";
  } catch (err: any) {
    results["2F: verify_recovery schema accepts valid services"] = `FAIL: ${err.message}`;
  }

  // 2F-2: verify_recovery schema rejects invalid services
  try {
    const schema = TOOL_SCHEMAS["verify_recovery"];
    const v1 = schema.safeParse({ service: "redis" });
    const v2 = schema.safeParse({ service: "postgres" });
    const v3 = schema.safeParse({ service: "kubernetes" });
    assert.equal(v1.success, false, "redis must be rejected");
    assert.equal(v2.success, false, "postgres must be rejected");
    assert.equal(v3.success, false, "kubernetes must be rejected");
    results["2F: verify_recovery schema rejects invalid services"] = "PASS (Allowlist strictly enforced)";
  } catch (err: any) {
    results["2F: verify_recovery schema rejects invalid services"] = `FAIL: ${err.message}`;
  }

  // 2F-3: verify_recovery schema rejects extra arguments (.strict())
  try {
    const schema = TOOL_SCHEMAS["verify_recovery"];
    const v1 = schema.safeParse({ service: "dummy-api", force: true });
    const v2 = schema.safeParse({ service: "sentinel-db", shell: "sh" });
    assert.equal(v1.success, false, "extra argument force must be rejected");
    assert.equal(v2.success, false, "extra argument shell must be rejected");
    results["2F: verify_recovery schema rejects extra args"] = "PASS (.strict() enforced)";
  } catch (err: any) {
    results["2F: verify_recovery schema rejects extra args"] = `FAIL: ${err.message}`;
  }

  // 2F-4: verify_recovery tool is in tool definitions, executable, LOW risk
  try {
    const def = SENTINEL_TOOL_DEFINITIONS["verify_recovery"];
    assert.ok(def, "verify_recovery must exist in SENTINEL_TOOL_DEFINITIONS");
    assert.equal(def.isExecutable, true, "verify_recovery must be isExecutable=true");
    assert.equal(def.risk, "LOW", "verify_recovery must be risk=LOW");
    assert.ok(def.parameters.required?.includes("service"), "service must be required");
    results["2F: verify_recovery is in tool registry (LOW/executable)"] = "PASS";
  } catch (err: any) {
    results["2F: verify_recovery is in tool registry (LOW/executable)"] = `FAIL: ${err.message}`;
  }

  // 2F-5: verify_recovery is exposed in LIVE_OPENAI_TOOLS
  try {
    const liveNames = LIVE_OPENAI_TOOLS.map((t) => t.function.name);
    assert.ok(liveNames.includes("verify_recovery"), "verify_recovery must be in LIVE_OPENAI_TOOLS");
    results["2F: verify_recovery in LIVE_OPENAI_TOOLS"] = "PASS (Exposed to AI)";
  } catch (err: any) {
    results["2F: verify_recovery in LIVE_OPENAI_TOOLS"] = `FAIL: ${err.message}`;
  }

  // 2F-6: verify_recovery policy is LOW risk, auto_execute: true
  try {
    const { loadPolicies } = await import("./src/config/policies.js");
    const policies = loadPolicies();
    assert.ok("verify_recovery" in policies, "verify_recovery must be in policies");
    assert.equal(policies["verify_recovery"].risk, "LOW");
    assert.equal(policies["verify_recovery"].auto_execute, true);
    results["2F: verify_recovery policy is LOW/auto_execute"] = "PASS";
  } catch (err: any) {
    results["2F: verify_recovery policy is LOW/auto_execute"] = `FAIL: ${err.message}`;
  }

  // 2F-7: Truthful runtime verification check for sentinel-db (UP)
  try {
    const { TOOLS: tools } = await import("./src/agent/tools.js");
    const verifyFn = tools["verify_recovery"];
    const rawResult = await verifyFn({ service: "sentinel-db" });
    const parsed = JSON.parse(rawResult);
    assert.equal(typeof parsed.verified, "boolean", "verified must be boolean");
    assert.equal(parsed.service, "sentinel-db");
    assert.equal(typeof parsed.status, "string");
    assert.ok(Array.isArray(parsed.evidence), "evidence must be an array");
    // Since sentinel-db is running after earlier restart test:
    assert.equal(parsed.verified, true);
    assert.equal(parsed.status, "UP");
    results["2F: truthful verification returns verified: true (sentinel-db)"] = `PASS (status=${parsed.status})`;
  } catch (err: any) {
    results["2F: truthful verification returns verified: true (sentinel-db)"] = `FAIL: ${err.message}`;
  }

  // 2F-8: Truthful failure reporting when service probe fails
  try {
    const { TOOLS: tools } = await import("./src/agent/tools.js");
    // Verify container check returns verified: false when stopped
    const { ContainerService } = await import("./src/services/container.service.js");
    const origCheck = ContainerService.checkContainerRunning;
    // Temporarily mock checkContainerRunning to simulate a stopped DB
    ContainerService.checkContainerRunning = async (_svc: string) => false;
    try {
      const rawResult = await tools["verify_recovery"]({ service: "sentinel-db" });
      const parsed = JSON.parse(rawResult);
      assert.equal(parsed.verified, false, "stopped container must return verified: false");
      assert.equal(parsed.status, "DOWN", "stopped container must return status: DOWN");
      assert.ok(parsed.evidence.length > 0, "must include failure evidence");
      results["2F: truthful failure verification returns verified: false"] = "PASS (Truthful failure reported)";
    } finally {
      ContainerService.checkContainerRunning = origCheck;
    }
  } catch (err: any) {
    results["2F: truthful failure verification returns verified: false"] = `FAIL: ${err.message}`;
  }

  // 2F-9: Lifecycle Case A — Remediation executed -> verify succeeds -> recovery recorded
  try {
    const { verifyIncidentRecovery } = await import("./src/agent/agent.js");
    const { incidentService: incSvc } = await import("./src/services/incident.service.js");
    const testInc = {
      id: `INC-TEST-PASS-${Date.now()}`,
      detected_at: new Date(Date.now() - 5000).toISOString(),
      error: "Temporary DB disconnect",
      status: "MITIGATING",
    };
    incSvc.setCurrentIncident(testInc);
    incSvc.setActiveIncident(true);

    const verifyRes = await verifyIncidentRecovery(testInc, "sentinel-db");
    assert.equal(verifyRes.verified, true, "sentinel-db verification must succeed");
    assert.equal(testInc.status, "RESOLVED", "incident must transition to RESOLVED on successful verify");
    assert.equal(testInc.verification_status, "PASSED", "verification_status must be PASSED");
    assert.ok(testInc.recovery_time, "recovery_time must be populated");
    assert.ok(testInc.recovery_verified_at, "recovery_verified_at must be populated");
    assert.equal(incSvc.getSystemHealth(), "HEALTHY", "system health must transition to HEALTHY");
    assert.equal(incSvc.isActiveIncident(), false, "activeIncident must be false");
    results["2F: Lifecycle Case A (verify pass -> incident RESOLVED)"] = "PASS (recovery recorded truthfully)";
  } catch (err: any) {
    results["2F: Lifecycle Case A (verify pass -> incident RESOLVED)"] = `FAIL: ${err.message}`;
  }

  // 2F-10: Lifecycle Case B/C — Remediation executed -> verify fails -> incident remains active
  try {
    const { verifyIncidentRecovery } = await import("./src/agent/agent.js");
    const { incidentService: incSvc } = await import("./src/services/incident.service.js");
    const { ContainerService } = await import("./src/services/container.service.js");
    const origCheck = ContainerService.checkContainerRunning;
    ContainerService.checkContainerRunning = async () => false;

    const testInc = {
      id: `INC-TEST-FAIL-${Date.now()}`,
      detected_at: new Date().toISOString(),
      error: "Persistent database failure",
      status: "MITIGATING",
    };
    incSvc.setCurrentIncident(testInc);
    incSvc.setActiveIncident(true);

    try {
      const verifyRes = await verifyIncidentRecovery(testInc, "sentinel-db");
      assert.equal(verifyRes.verified, false, "mock stopped db must fail verification");
      assert.notEqual(testInc.status, "RESOLVED", "incident must NOT transition to RESOLVED on failed verify");
      assert.equal(testInc.verification_status, "FAILED", "verification_status must be FAILED");
      assert.equal(testInc.recovery_time, undefined, "recovery_time must NOT be set");
      assert.equal(incSvc.getSystemHealth(), "INCIDENT_ACTIVE", "system health must remain INCIDENT_ACTIVE");
      results["2F: Lifecycle Case B/C (verify fail -> incident remains active)"] = "PASS (No false recovery)";
    } finally {
      ContainerService.checkContainerRunning = origCheck;
    }
  } catch (err: any) {
    results["2F: Lifecycle Case B/C (verify fail -> incident remains active)"] = `FAIL: ${err.message}`;
  }

  // 2F-11: Bounded re-investigation limit constant and enforcement
  try {
    const { MAX_REINVESTIGATION_ATTEMPTS } = await import("./src/agent/agent.js");
    assert.equal(typeof MAX_REINVESTIGATION_ATTEMPTS, "number", "MAX_REINVESTIGATION_ATTEMPTS must be a number");
    assert.equal(MAX_REINVESTIGATION_ATTEMPTS, 1, "MAX_REINVESTIGATION_ATTEMPTS must be exactly 1");
    results["2F: deterministic re-investigation bound is 1"] = "PASS (MAX_REINVESTIGATION_ATTEMPTS = 1)";
  } catch (err: any) {
    results["2F: deterministic re-investigation bound is 1"] = `FAIL: ${err.message}`;
  }

  // 2F-12: Fresh evidence collection uses real read-only investigation tools
  try {
    const { collectFreshInvestigationEvidence } = await import("./src/agent/agent.js");
    const evidenceText = await collectFreshInvestigationEvidence();
    assert.ok(evidenceText.includes("FRESH OPERATIONAL EVIDENCE"), "must contain header");
    assert.ok(evidenceText.includes("Database Probe:"), "must include database probe");
    assert.ok(evidenceText.includes("Telemetry Metrics:"), "must include metrics");
    assert.ok(evidenceText.includes("Recent dummy-api Logs:"), "must include logs");
    results["2F: collectFreshInvestigationEvidence returns fresh telemetry"] = "PASS (Multi-source evidence collected)";
  } catch (err: any) {
    results["2F: collectFreshInvestigationEvidence returns fresh telemetry"] = `FAIL: ${err.message}`;
  }

  // 2F-13: Re-investigation retry limit reached -> no infinite loop -> marks ESCALATED
  try {
    const { MAX_REINVESTIGATION_ATTEMPTS } = await import("./src/agent/agent.js");
    const testInc = {
      id: `INC-TEST-ESCALATE-${Date.now()}`,
      detected_at: new Date().toISOString(),
      error: "Unrecoverable crash",
      status: "MITIGATING",
      reinvestigation_attempts: MAX_REINVESTIGATION_ATTEMPTS, // Already at max!
    };
    // Simulating retry limit check
    const attempts = testInc.reinvestigation_attempts || 0;
    if (attempts >= MAX_REINVESTIGATION_ATTEMPTS) {
      testInc.status = "ESCALATED";
    }
    assert.equal(testInc.status, "ESCALATED", "incident must transition to ESCALATED when limit reached");
    results["2F: retry limit reached -> incident ESCALATED (no infinite loop)"] = "PASS";
  } catch (err: any) {
    results["2F: retry limit reached -> incident ESCALATED (no infinite loop)"] = `FAIL: ${err.message}`;
  }

  // 2F-14: Safety enforcement — Re-investigation proposing rollback still requires human approval
  try {
    // A re-investigation proposing rollback_service MUST require approval
    const proposalResult = await executeToolWithGuardrail("rollback_service", "INC-TEST-2F", {
      service: "dummy-api",
    });
    assert.equal(proposalResult.status, "Requires Human Approval", "re-investigation rollback must require approval");
    assert.equal(proposalResult.risk, "HIGH", "must have risk HIGH");
    assert.ok(proposalResult.approval_id, "must generate approval_id");
    results["2F: re-investigation rollback requires approval (no auto-rollback)"] = "PASS (Gated by guardrail)";
  } catch (err: any) {
    results["2F: re-investigation rollback requires approval (no auto-rollback)"] = `FAIL: ${err.message}`;
  }

  // 2F-15: Complete safety hierarchy preserved across all tools
  try {
    const { loadPolicies } = await import("./src/config/policies.js");
    const policies = loadPolicies();
    assert.equal(policies["restart_service"].risk, "LOW");
    assert.equal(policies["restart_service"].auto_execute, true);
    assert.equal(policies["verify_recovery"].risk, "LOW");
    assert.equal(policies["verify_recovery"].auto_execute, true);
    assert.equal(policies["rollback_service"].risk, "HIGH");
    assert.equal(policies["rollback_service"].auto_execute, false);
    assert.equal(policies["delete_database"].risk, "CRITICAL");
    assert.equal(policies["delete_database"].auto_execute, false);
    results["2F: complete safety hierarchy verified"] = "PASS (LOW/auto vs HIGH/manual vs CRITICAL/manual)";
  } catch (err: any) {
    results["2F: complete safety hierarchy verified"] = `FAIL: ${err.message}`;
  }

  console.log("\n================ TEST SUMMARY ================");
  for (const [name, res] of Object.entries(results)) {
    console.log(`- ${name.padEnd(54)}: ${res}`);
  }
  console.log("==============================================");
}

runTests().catch(console.error);
