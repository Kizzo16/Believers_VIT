import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "../utils/logger";
import { ALLOWED_CONTAINERS, AllowedContainer } from "../safety/schemas";

const execFileAsync = promisify(execFile);

export class ContainerService {
  private static isAllowed(name: string): boolean {
    return ALLOWED_CONTAINERS.includes(name as AllowedContainer);
  }

  static async checkContainerRunning(name: string): Promise<boolean> {
    if (!this.isAllowed(name)) {
      return false;
    }
    try {
      const { stdout } = await execFileAsync(
        "docker",
        ["inspect", "-f", "{{.State.Running}}", name],
        { timeout: 5000 }
      );
      return stdout.trim() === "true";
    } catch {
      return false;
    }
  }

  static async getDockerLogs(containerName: string = "dummy-api"): Promise<string> {
    if (!this.isAllowed(containerName)) {
      return `Error executing docker logs: Container '${containerName}' is not in the whitelist.`;
    }
    try {
      const { stdout, stderr } = await execFileAsync(
        "docker",
        ["logs", "--tail", "50", containerName],
        { timeout: 15000 }
      );
      const combined = ((stdout || "") + (stderr ? "\n" + stderr : "")).trim();
      return combined.length > 0 ? combined : "(No logs returned)";
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err }, "Error executing docker logs");
      return `Error executing docker logs: ${errorMsg}`;
    }
  }

  static async restartContainer(containerName: string = "sentinel-db"): Promise<string> {
    if (!this.isAllowed(containerName)) {
      return `Error executing docker restart: Container '${containerName}' is not in the whitelist.`;
    }
    try {
      await execFileAsync("docker", ["restart", containerName], { timeout: 30000 });
      return `Container '${containerName}' restarted successfully.`;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err }, `Failed to restart container '${containerName}'`);
      return `Failed to restart container '${containerName}': ${errorMsg}`;
    }
  }

  static async startContainer(containerName: string = "sentinel-db"): Promise<string> {
    if (!this.isAllowed(containerName)) {
      return `Error executing docker start: Container '${containerName}' is not in the whitelist.`;
    }
    try {
      await execFileAsync("docker", ["start", containerName], { timeout: 30000 });
      return `Container '${containerName}' started successfully.`;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err }, `Failed to start container '${containerName}'`);
      return `Failed to start container '${containerName}': ${errorMsg}`;
    }
  }

  static async stopContainer(containerName: string = "sentinel-db"): Promise<{ stdout: string; stderr: string }> {
    if (!this.isAllowed(containerName)) {
      throw new Error(`Container '${containerName}' is not in the whitelist.`);
    }
    try {
      const { stdout, stderr } = await execFileAsync("docker", ["stop", containerName], { timeout: 20000 });
      return { stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err }, `Error stopping container '${containerName}'`);
      throw new Error(`Failed to stop container '${containerName}': ${errorMsg}`);
    }
  }
}

