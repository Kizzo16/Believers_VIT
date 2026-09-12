import fs from "node:fs";
import path from "node:path";
import { GuardrailPolicies } from "../types/sentinel";
import { logger } from "../utils/logger";
import { env } from "./env";

export const DEFAULT_POLICIES: GuardrailPolicies = {
  // Official tools
  get_system_status: { risk: "LOW", auto_execute: true },
  get_service_logs: { risk: "LOW", auto_execute: true },
  get_metrics: { risk: "LOW", auto_execute: true },
  check_database: { risk: "LOW", auto_execute: true },
  check_service: { risk: "LOW", auto_execute: true },
  restart_service: { risk: "LOW", auto_execute: true },
  rollback_service: { risk: "HIGH", auto_execute: false },
  verify_recovery: { risk: "LOW", auto_execute: true },
  // Backward compatibility aliases
  get_docker_logs: { risk: "LOW", auto_execute: true },
  restart_container: { risk: "LOW", auto_execute: true },
  delete_database: { risk: "CRITICAL", auto_execute: false },
};

export function getPoliciesFilePath(): string {
  if (path.isAbsolute(env.POLICIES_FILE)) {
    return env.POLICIES_FILE;
  }
  return path.resolve(process.cwd(), env.POLICIES_FILE);
}

export function loadPolicies(): GuardrailPolicies {
  const filePath = getPoliciesFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as GuardrailPolicies;
    } catch (err) {
      logger.error({ err }, "Error reading policies.json, using default policies");
    }
  }
  return { ...DEFAULT_POLICIES };
}

export function savePolicies(newPolicies: GuardrailPolicies): void {
  const filePath = getPoliciesFilePath();
  fs.writeFileSync(filePath, JSON.stringify(newPolicies, null, 2), "utf-8");
  logger.info({ policies: newPolicies }, "Updated policies.json successfully");
}
