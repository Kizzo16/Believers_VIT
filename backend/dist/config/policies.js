"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_POLICIES = void 0;
exports.getPoliciesFilePath = getPoliciesFilePath;
exports.loadPolicies = loadPolicies;
exports.savePolicies = savePolicies;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const logger_1 = require("../utils/logger");
const env_1 = require("./env");
exports.DEFAULT_POLICIES = {
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
function getPoliciesFilePath() {
    if (node_path_1.default.isAbsolute(env_1.env.POLICIES_FILE)) {
        return env_1.env.POLICIES_FILE;
    }
    return node_path_1.default.resolve(process.cwd(), env_1.env.POLICIES_FILE);
}
function loadPolicies() {
    const filePath = getPoliciesFilePath();
    if (node_fs_1.default.existsSync(filePath)) {
        try {
            const raw = node_fs_1.default.readFileSync(filePath, "utf-8");
            return JSON.parse(raw);
        }
        catch (err) {
            logger_1.logger.error({ err }, "Error reading policies.json, using default policies");
        }
    }
    return { ...exports.DEFAULT_POLICIES };
}
function savePolicies(newPolicies) {
    const filePath = getPoliciesFilePath();
    node_fs_1.default.writeFileSync(filePath, JSON.stringify(newPolicies, null, 2), "utf-8");
    logger_1.logger.info({ policies: newPolicies }, "Updated policies.json successfully");
}
