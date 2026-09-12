"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDbPool = getDbPool;
exports.checkDatabaseConnection = checkDatabaseConnection;
exports.closeDbPool = closeDbPool;
const pg_1 = require("pg");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
let pool = null;
/**
 * Returns the active PostgreSQL connection pool, initializing it lazily if not already created.
 * Returns null if DATABASE_URL is not configured and no custom connection string is provided.
 */
function getDbPool(options) {
    // If pool already exists and no custom connection string was requested, return it
    if (pool && !options?.connectionString) {
        return pool;
    }
    const connectionString = options?.connectionString || env_1.env.DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) {
        return null;
    }
    if (!pool) {
        const config = {
            connectionString,
            connectionTimeoutMillis: options?.connectionTimeoutMillis ?? 3000,
            idleTimeoutMillis: options?.idleTimeoutMillis ?? 30000,
            max: options?.max ?? 10,
        };
        pool = new pg_1.Pool(config);
        pool.on("error", (err) => {
            logger_1.logger.error({ err }, "[Database] Unexpected idle client error on PostgreSQL pool");
        });
    }
    return pool;
}
/**
 * Validates connectivity to the configured PostgreSQL database.
 * Executes a lightweight `SELECT 1;` query and measures round-trip latency.
 * Never throws — returns a structured DatabaseConnectionStatus result.
 */
async function checkDatabaseConnection(options) {
    const connectionString = options?.connectionString || env_1.env.DATABASE_URL;
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
    }
    catch (err) {
        const latencyMs = Date.now() - start;
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger_1.logger.warn({ err, latencyMs }, `[Database] Connectivity check failed: ${errorMsg}`);
        return {
            available: false,
            configured: true,
            error: errorMsg,
            latencyMs,
        };
    }
    finally {
        if (client) {
            client.release();
        }
    }
}
/**
 * Closes the active PostgreSQL connection pool cleanly during server shutdown.
 */
async function closeDbPool() {
    if (pool) {
        logger_1.logger.info("[Database] Draining and closing PostgreSQL connection pool...");
        try {
            await pool.end();
            logger_1.logger.info("[Database] PostgreSQL connection pool closed cleanly");
        }
        catch (err) {
            logger_1.logger.error({ err }, "[Database] Error closing PostgreSQL connection pool");
        }
        finally {
            pool = null;
        }
    }
}
