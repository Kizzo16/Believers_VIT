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

  // 10.13 Incomplete tools excluded from live model exposure
  try {
    assert.equal(SENTINEL_TOOL_DEFINITIONS.get_metrics.isExecutable, false);
    assert.equal(SENTINEL_TOOL_DEFINITIONS.rollback_service.isExecutable, false);
    const exposedNames = LIVE_OPENAI_TOOLS.map((t) => t.function.name);
    assert.ok(!exposedNames.includes("get_metrics"), "get_metrics must NOT be exposed to live model");
    assert.ok(!exposedNames.includes("rollback_service"), "rollback_service must NOT be exposed to live model");
    assert.ok(exposedNames.includes("get_service_logs"), "get_service_logs must be exposed to live model");
    assert.ok(exposedNames.includes("restart_service"), "restart_service must be exposed to live model");
    results["Tool Exposure: Only executable tools live"] = "PASS (get_metrics/rollback excluded from model)";
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

  console.log("\n================ TEST SUMMARY ================");
  for (const [name, res] of Object.entries(results)) {
    console.log(`- ${name.padEnd(42)}: ${res}`);
  }
  console.log("==============================================");
}

runTests().catch(console.error);
