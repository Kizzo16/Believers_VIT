import assert from "node:assert/strict";
import { getDbPool, closeDbPool } from "./src/db/connection";
import {
  IncidentRepository,
  ApprovalRepository,
  AuditRepository,
  IncidentLogRepository,
  ReasoningRepository,
} from "./src/repositories";

// Ensure DATABASE_URL targets the dedicated control-plane database
const DB_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5433/sentinel_control";
process.env.DATABASE_URL = DB_URL;

async function runRepositoryTests() {
  console.log("=================================================");
  console.log("   SENTINEL REPOSITORY LAYER VERIFICATION TEST   ");
  console.log("=================================================\n");
  console.log(`Target database: ${DB_URL.replace(/:[^:@]+@/, ":****@")}\n`);

  // Ensure connection pool uses sentinel-control-db
  const pool = getDbPool({ connectionString: DB_URL });
  assert.ok(pool, "Connection pool should initialize successfully");

  const testSuffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const testIncidentId = `TEST-INC-${testSuffix}`;
  const testApprovalId = `TEST-APPR-${testSuffix}`;

  const results: Record<string, string> = {};

  try {
    // ------------------------------------------------------------------------
    // 1. INCIDENT REPOSITORY TESTS
    // ------------------------------------------------------------------------
    console.log("--- 1. Testing IncidentRepository ---");

    // 1.1 Create Incident
    const createdIncident = await IncidentRepository.create({
      id: testIncidentId,
      status: "INVESTIGATING",
      error: "PostgreSQL connection refused on sentinel-db:5432",
      service: "dummy-api",
      detected_at: new Date().toISOString(),
      metadata: { test_run: true, testSuffix },
    });
    assert.equal(createdIncident.id, testIncidentId);
    assert.equal(createdIncident.status, "INVESTIGATING");
    assert.equal(createdIncident.service, "dummy-api");
    results["IncidentRepository.create"] = `PASS (id=${createdIncident.id})`;

    // 1.2 Get Incident by ID
    const fetchedIncident = await IncidentRepository.getById(testIncidentId);
    assert.ok(fetchedIncident, "Incident should be found by ID");
    assert.equal(fetchedIncident.id, testIncidentId);
    assert.equal(fetchedIncident.error, "PostgreSQL connection refused on sentinel-db:5432");
    results["IncidentRepository.getById"] = "PASS (Retrieved exact record)";

    // 1.3 Update Incident
    const updatedIncident = await IncidentRepository.update(testIncidentId, {
      status: "MITIGATING",
      root_cause: "Container sentinel-db was stopped",
      confidence: 0.95,
      verification_status: "PASSED",
      verification_attempts: 1,
      recovery_time: "7s",
      resolved_at: new Date().toISOString(),
    });
    assert.ok(updatedIncident);
    assert.equal(updatedIncident.status, "MITIGATING");
    assert.equal(updatedIncident.root_cause, "Container sentinel-db was stopped");
    assert.equal(updatedIncident.confidence, 0.95);
    assert.equal(updatedIncident.recovery_time, "7s");
    assert.equal(updatedIncident.verification_status, "PASSED");
    results["IncidentRepository.update"] = "PASS (Updated status, RCA, and verification)";

    // 1.4 Get Active Incidents
    const activeList = await IncidentRepository.getActive();
    assert.ok(Array.isArray(activeList));
    const foundActive = activeList.some((inc) => inc.id === testIncidentId);
    assert.ok(foundActive, "Updated incident (status=MITIGATING) must appear in getActive()");
    results["IncidentRepository.getActive"] = `PASS (${activeList.length} active incidents)`;

    // 1.5 List Recent Incidents
    const recentIncidents = await IncidentRepository.listRecent(10);
    assert.ok(Array.isArray(recentIncidents));
    assert.ok(recentIncidents.some((inc) => inc.id === testIncidentId));
    results["IncidentRepository.listRecent"] = `PASS (${recentIncidents.length} recent incidents)`;

    // ------------------------------------------------------------------------
    // 2. APPROVAL REPOSITORY TESTS
    // ------------------------------------------------------------------------
    console.log("\n--- 2. Testing ApprovalRepository ---");

    // 2.1 Create Pending Approval
    const createdApproval = await ApprovalRepository.create({
      id: testApprovalId,
      incident_id: testIncidentId,
      tool_name: "rollback_service",
      kwargs: { service: "dummy-api", target_tag: "v1.0.0" },
      risk: "HIGH",
      status: "PENDING",
      metadata: { test_run: true },
    });
    assert.equal(createdApproval.id, testApprovalId);
    assert.equal(createdApproval.incident_id, testIncidentId);
    assert.equal(createdApproval.tool_name, "rollback_service");
    assert.equal(createdApproval.status, "PENDING");
    assert.equal(createdApproval.risk, "HIGH");
    assert.deepEqual(createdApproval.kwargs, { service: "dummy-api", target_tag: "v1.0.0" });
    results["ApprovalRepository.create"] = `PASS (id=${createdApproval.id}, risk=HIGH)`;

    // 2.2 Get Approval by ID
    const fetchedApproval = await ApprovalRepository.getById(testApprovalId);
    assert.ok(fetchedApproval);
    assert.equal(fetchedApproval.id, testApprovalId);
    assert.equal(fetchedApproval.status, "PENDING");
    results["ApprovalRepository.getById"] = "PASS (Found approval record)";

    // 2.3 List Pending Approvals
    const pendingList = await ApprovalRepository.listPending();
    assert.ok(Array.isArray(pendingList));
    assert.ok(pendingList.some((appr) => appr.id === testApprovalId));
    results["ApprovalRepository.listPending"] = `PASS (${pendingList.length} pending found)`;

    // 2.4 List Approvals by Incident
    const incidentApprovals = await ApprovalRepository.listByIncident(testIncidentId);
    assert.ok(Array.isArray(incidentApprovals));
    assert.equal(incidentApprovals.length, 1);
    assert.equal(incidentApprovals[0].id, testApprovalId);
    results["ApprovalRepository.listByIncident"] = "PASS (Linked to parent incident)";

    // 2.5 Update Approval Decision (APPROVE)
    const resolvedApproval = await ApprovalRepository.updateDecision(testApprovalId, {
      decision: "APPROVE",
      status: "APPROVED",
      decided_by: "lead-sre@sentinel.local",
      execution_result: "Container image rollback verified",
      success: true,
    });
    assert.ok(resolvedApproval);
    assert.equal(resolvedApproval.decision, "APPROVE");
    assert.equal(resolvedApproval.status, "APPROVED");
    assert.equal(resolvedApproval.decided_by, "lead-sre@sentinel.local");
    assert.equal(resolvedApproval.success, true);
    results["ApprovalRepository.updateDecision"] = "PASS (Updated to APPROVED with execution result)";

    // ------------------------------------------------------------------------
    // 3. AUDIT REPOSITORY TESTS
    // ------------------------------------------------------------------------
    console.log("\n--- 3. Testing AuditRepository ---");

    // 3.1 Append Audit Event
    const appendedAudit = await AuditRepository.append({
      approval_id: testApprovalId,
      incident_id: testIncidentId,
      tool_name: "rollback_service",
      operator_decision: "APPROVE",
      operator_id: "lead-sre@sentinel.local",
      execution_result: "Container image rollback verified",
      success: true,
      metadata: { audit_standard: "SOC2" },
    });
    assert.ok(appendedAudit.id);
    assert.equal(appendedAudit.approval_id, testApprovalId);
    assert.equal(appendedAudit.incident_id, testIncidentId);
    assert.equal(appendedAudit.operator_decision, "APPROVE");
    assert.equal(appendedAudit.success, true);
    results["AuditRepository.append"] = `PASS (id=${appendedAudit.id}, decision=APPROVE)`;

    // 3.2 List Recent Audit Events
    const recentAudits = await AuditRepository.listRecent(10);
    assert.ok(Array.isArray(recentAudits));
    assert.ok(recentAudits.some((a) => a.id === appendedAudit.id));
    results["AuditRepository.listRecent"] = `PASS (${recentAudits.length} audit records)`;

    // 3.3 List Audit Events by Incident
    const incidentAudits = await AuditRepository.listByIncident(testIncidentId);
    assert.ok(Array.isArray(incidentAudits));
    assert.ok(incidentAudits.some((a) => a.id === appendedAudit.id));
    results["AuditRepository.listByIncident"] = "PASS (Retrieved audit events for incident)";

    // 3.4 List Audit Events by Approval
    const approvalAudits = await AuditRepository.listByApproval(testApprovalId);
    assert.ok(Array.isArray(approvalAudits));
    assert.equal(approvalAudits.length, 1);
    assert.equal(approvalAudits[0].approval_id, testApprovalId);
    results["AuditRepository.listByApproval"] = "PASS (Retrieved audit events for approval)";

    // ------------------------------------------------------------------------
    // 4. INCIDENT LOG REPOSITORY TESTS
    // ------------------------------------------------------------------------
    console.log("\n--- 4. Testing IncidentLogRepository ---");

    // 4.1 Append Log Events
    const log1 = await IncidentLogRepository.append({
      incident_id: testIncidentId,
      level: "ERROR",
      message: "HTTP 500 received from dummy-api probe",
    });
    const log2 = await IncidentLogRepository.append({
      incident_id: testIncidentId,
      level: "INFO",
      message: "Autonomous SRE agent began diagnostic investigation",
    });
    assert.ok(log1.id);
    assert.ok(log2.id);
    assert.equal(log1.level, "ERROR");
    assert.equal(log2.level, "INFO");
    results["IncidentLogRepository.append"] = "PASS (Appended 2 log events)";

    // 4.2 List Logs by Incident
    const incidentLogs = await IncidentLogRepository.listByIncident(testIncidentId);
    assert.ok(Array.isArray(incidentLogs));
    assert.equal(incidentLogs.length, 2);
    assert.equal(incidentLogs[0].id, log1.id, "Logs must be ordered chronologically (log1 first)");
    assert.equal(incidentLogs[1].id, log2.id);
    results["IncidentLogRepository.listByIncident"] = "PASS (Chronological retrieval confirmed)";

    // 4.3 List Recent Logs
    const recentLogs = await IncidentLogRepository.listRecent(10);
    assert.ok(Array.isArray(recentLogs));
    assert.ok(recentLogs.some((l) => l.id === log1.id));
    results["IncidentLogRepository.listRecent"] = `PASS (${recentLogs.length} recent logs)`;

    // ------------------------------------------------------------------------
    // 5. AGENT REASONING REPOSITORY TESTS
    // ------------------------------------------------------------------------
    console.log("\n--- 5. Testing ReasoningRepository ---");

    // 5.1 Append Reasoning Steps
    const r1 = await ReasoningRepository.append({
      incident_id: testIncidentId,
      thought: "Inspecting container logs for dummy-api to identify root cause.",
      action: "get_service_logs(service='dummy-api')",
      turn: 1,
      source: "openai",
    });
    const r2 = await ReasoningRepository.append({
      incident_id: testIncidentId,
      thought: "Database connection failed. Proposing container restart.",
      action: "restart_service(service='sentinel-db')",
      result: "Container restarted successfully",
      confidence: 0.98,
      turn: 2,
      source: "openai",
    });
    assert.ok(r1.id);
    assert.ok(r2.id);
    assert.equal(r1.turn, 1);
    assert.equal(r2.turn, 2);
    assert.equal(r2.confidence, 0.98);
    results["ReasoningRepository.append"] = "PASS (Appended 2 reasoning steps with turn & confidence)";

    // 5.2 List Reasoning by Incident
    const reasoningList = await ReasoningRepository.listByIncident(testIncidentId);
    assert.ok(Array.isArray(reasoningList));
    assert.equal(reasoningList.length, 2);
    assert.equal(reasoningList[0].id, r1.id);
    assert.equal(reasoningList[1].id, r2.id);
    results["ReasoningRepository.listByIncident"] = "PASS (Chronological trace steps retrieved)";

    // ------------------------------------------------------------------------
    // 6. TARGET DB SAFETY CHECK & TEST ISOLATION CLEANUP
    // ------------------------------------------------------------------------
    console.log("\n--- 6. Target DB Safety & Cleanup ---");

    // Clean up specifically the test records created in this test run
    await pool.query("DELETE FROM audit_events WHERE incident_id = $1;", [testIncidentId]);
    await pool.query("DELETE FROM incident_logs WHERE incident_id = $1;", [testIncidentId]);
    await pool.query("DELETE FROM agent_reasoning WHERE incident_id = $1;", [testIncidentId]);
    await pool.query("DELETE FROM approvals WHERE id = $1;", [testApprovalId]);
    await pool.query("DELETE FROM incidents WHERE id = $1;", [testIncidentId]);
    results["Test Data Cleanup"] = "PASS (Test records cleaned up safely)";

    // Verify incident was cleaned up
    const cleanCheck = await IncidentRepository.getById(testIncidentId);
    assert.equal(cleanCheck, null, "Test incident should be cleaned up");
  } finally {
    await closeDbPool();
  }

  console.log("\n================ REPOSITORY TEST SUMMARY ================");
  let passedCount = 0;
  for (const [name, res] of Object.entries(results)) {
    console.log(`- ${name.padEnd(42)}: ${res}`);
    if (res.startsWith("PASS")) passedCount++;
  }
  console.log("=========================================================");
  console.log(`\nTotal repository tests passed: ${passedCount} / ${Object.keys(results).length}`);

  if (passedCount !== Object.keys(results).length) {
    throw new Error("Some repository tests failed!");
  }
}

runRepositoryTests().catch((err) => {
  console.error("\n[Repository Test Failure]:", err);
  process.exit(1);
});
