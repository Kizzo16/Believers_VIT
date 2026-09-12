import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export interface MigrationResult {
  applied: string[];
  alreadyApplied: string[];
  totalAvailable: number;
}

export async function runMigrations(customDatabaseUrl?: string): Promise<MigrationResult> {
  const databaseUrl = customDatabaseUrl || env.DATABASE_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    const errMsg =
      "DATABASE_URL is not configured. Please set DATABASE_URL (e.g. postgresql://postgres:postgres@localhost:5433/sentinel_control) to run migrations.";
    logger.error(errMsg);
    throw new Error(errMsg);
  }

  logger.info("[Migration] Connecting to control-plane database...");
  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });

  await client.connect();

  try {
    // 1. Ensure schema_migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Query already applied migrations
    const appliedRes = await client.query<{ name: string }>(
      "SELECT name FROM schema_migrations ORDER BY id ASC;"
    );
    const appliedSet = new Set(appliedRes.rows.map((r) => r.name));
    const alreadyApplied = appliedRes.rows.map((r) => r.name);

    // 3. Discover SQL migration files in deterministic order
    const possibleDirs = [
      path.resolve(__dirname, "../../migrations"),
      path.resolve(process.cwd(), "migrations"),
      path.resolve(process.cwd(), "backend/migrations"),
    ];
    const migrationsDir = possibleDirs.find((d) => fs.existsSync(d));

    if (!migrationsDir) {
      throw new Error(
        `Migrations directory not found in any expected location: ${possibleDirs.join(", ")}`
      );
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));

    const applied: string[] = [];

    // 4. Apply unapplied migrations inside atomic transactions
    for (const file of files) {
      if (appliedSet.has(file)) {
        continue;
      }

      logger.info(`[Migration] Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      await client.query("BEGIN;");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1);", [file]);
        await client.query("COMMIT;");
        applied.push(file);
        logger.info(`[Migration] Successfully applied: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK;");
        logger.error({ err, file }, `[Migration] Transaction failed for ${file}. Rolled back.`);
        throw err;
      }
    }

    if (applied.length === 0) {
      logger.info(
        `[Migration] Database is already up-to-date (${alreadyApplied.length} migration(s) previously applied).`
      );
    } else {
      logger.info(`[Migration] Migration complete. Applied ${applied.length} new migration(s).`);
    }

    return {
      applied,
      alreadyApplied,
      totalAvailable: files.length,
    };
  } finally {
    await client.end();
  }
}

// CLI entry point
if (require.main === module) {
  runMigrations()
    .then((result) => {
      console.log("\n================ MIGRATION REPORT ================");
      console.log(`Total available migrations : ${result.totalAvailable}`);
      console.log(`Previously applied         : ${result.alreadyApplied.length}`);
      console.log(`Newly applied in this run  : ${result.applied.length}`);
      if (result.applied.length > 0) {
        result.applied.forEach((m) => console.log(`  + ${m}`));
      }
      console.log("==================================================\n");
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n[Migration Fatal Error]:", err.message || err);
      process.exit(1);
    });
}
