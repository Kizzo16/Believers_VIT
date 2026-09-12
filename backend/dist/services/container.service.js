"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContainerService = void 0;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const logger_1 = require("../utils/logger");
const schemas_1 = require("../safety/schemas");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
class ContainerService {
    static isAllowed(name) {
        return schemas_1.ALLOWED_CONTAINERS.includes(name);
    }
    static async checkContainerRunning(name) {
        if (!this.isAllowed(name)) {
            return false;
        }
        try {
            const { stdout } = await execFileAsync("docker", ["inspect", "-f", "{{.State.Running}}", name], { timeout: 5000 });
            return stdout.trim() === "true";
        }
        catch {
            return false;
        }
    }
    static async getDockerLogs(containerName = "dummy-api") {
        if (!this.isAllowed(containerName)) {
            return `Error executing docker logs: Container '${containerName}' is not in the whitelist.`;
        }
        try {
            const { stdout, stderr } = await execFileAsync("docker", ["logs", "--tail", "50", containerName], { timeout: 15000 });
            const combined = ((stdout || "") + (stderr ? "\n" + stderr : "")).trim();
            return combined.length > 0 ? combined : "(No logs returned)";
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error({ err }, "Error executing docker logs");
            return `Error executing docker logs: ${errorMsg}`;
        }
    }
    static async restartContainer(containerName = "sentinel-db") {
        if (!this.isAllowed(containerName)) {
            return `Error executing docker restart: Container '${containerName}' is not in the whitelist.`;
        }
        try {
            await execFileAsync("docker", ["restart", containerName], { timeout: 30000 });
            return `Container '${containerName}' restarted successfully.`;
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error({ err }, `Failed to restart container '${containerName}'`);
            return `Failed to restart container '${containerName}': ${errorMsg}`;
        }
    }
    static async stopContainer(containerName = "sentinel-db") {
        if (!this.isAllowed(containerName)) {
            throw new Error(`Container '${containerName}' is not in the whitelist.`);
        }
        try {
            const { stdout, stderr } = await execFileAsync("docker", ["stop", containerName], { timeout: 20000 });
            return { stdout: stdout.trim(), stderr: stderr.trim() };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error({ err }, `Error stopping container '${containerName}'`);
            throw new Error(`Failed to stop container '${containerName}': ${errorMsg}`);
        }
    }
}
exports.ContainerService = ContainerService;
