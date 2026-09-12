import { Pool, PoolConfig } from "pg";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export interface DatabaseConnectionStatus {
  available: boolean;
  configured: boolean;
  error?: string;
  latencyMs?: number;
}

export interface DbPoolOptions {
  connectionString?: string;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  max?: number;
}

let pool: Pool | null = null;

/**
 * Returns the active PostgreSQL connection pool, initializing it lazily if not already created.
 * Returns null if DATABASE_URL is not configured and no custom connection string is provided.
 */
export function getDbPool(options?: DbPoolOptions): Pool | null {
  // If pool already exists and no custom connection string was requested, return it
  if (pool && !options?.connectionString) {
    return pool;
  }

  const connectionString =
    options?.connectionString || env.DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    return null;
  }

  if (!pool) {
    const config: PoolConfig = {
      connectionString,
      connectionTimeoutMillis: options?.connectionTimeoutMillis ?? 3000,
      idleTimeoutMillis: options?.idleTimeoutMillis ?? 30000,
      max: options?.max ?? 10,
    };

    pool = new Pool(config);

    pool.on("error", (err) => {
      logger.error({ err }, "[Database] Unexpected idle client error on PostgreSQL pool");
    });
  }

  return pool;
}

/**
 * Validates connectivity to the configured PostgreSQL database.
 * Executes a lightweight `SELECT 1;` query and measures round-trip latency.
 * Never throws — returns a structured DatabaseConnectionStatus result.
 */
export async function checkDatabaseConnection(
  options?: DbPoolOptions
): Promise<DatabaseConnectionStatus> {
  const connectionString = options?.connectionString || env.DATABASE_URL;

  if (!connectionString) {
    return {
      available: false,
      configured: false,
      error: "DATABASE_URL is not configured",
    };
  }

  const poolInstance = getDbPool(options);
  if (!poolInstance) {
    return {
      available: false,
      configured: false,
      error: "Database pool could not be initialized",
    };
  }

  const start = Date.now();
  let client;
  try {
    client = await poolInstance.connect();
    await client.query("SELECT 1;");
    const latencyMs = Date.now() - start;
    return {
      available: true,
      configured: true,
      latencyMs,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn({ err, latencyMs }, `[Database] Connectivity check failed: ${errorMsg}`);
    return {
      available: false,
      configured: true,
      error: errorMsg,
      latencyMs,
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Closes the active PostgreSQL connection pool cleanly during server shutdown.
 */
export async function closeDbPool(): Promise<void> {
  if (pool) {
    logger.info("[Database] Draining and closing PostgreSQL connection pool...");
    try {
      await pool.end();
      logger.info("[Database] PostgreSQL connection pool closed cleanly");
    } catch (err) {
      logger.error({ err }, "[Database] Error closing PostgreSQL connection pool");
    } finally {
      pool = null;
    }
  }
}
