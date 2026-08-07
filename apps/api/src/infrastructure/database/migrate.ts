import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadConfig } from "../../config/env.js";
import { logger } from "../logging/logger.js";
import { Database } from "./database.js";

const MIGRATION_PATTERN = /^(\d+)_(.+)\.sql$/;

interface Migration {
  version: string;
  name: string;
  filename: string;
  sql: string;
}

export async function runMigrations(database: Database): Promise<void> {
  const migrations = await loadMigrations();

  await database.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(88260411)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        name text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const appliedResult = await client.query<{ version: string }>(
      "SELECT version FROM schema_migrations"
    );
    const applied = new Set(appliedResult.rows.map((row) => row.version));

    for (const migration of migrations) {
      if (applied.has(migration.version)) {
        continue;
      }

      logger.info({ migration: migration.filename }, "Applying migration");
      await client.query(migration.sql);
      await client.query(
        `
          INSERT INTO schema_migrations (version, name)
          VALUES ($1, $2)
        `,
        [migration.version, migration.name]
      );
    }
  });
}

async function loadMigrations(): Promise<Migration[]> {
  const currentFile = fileURLToPath(import.meta.url);
  const migrationsDir = path.resolve(
    path.dirname(currentFile),
    "../../../db/migrations"
  );
  const files = await readdir(migrationsDir);
  const migrations: Migration[] = [];

  for (const filename of files) {
    const match = MIGRATION_PATTERN.exec(filename);

    if (!match) {
      continue;
    }

    const version = match[1];
    const name = match[2];

    if (!version || !name) {
      continue;
    }
    const sql = await readFile(path.join(migrationsDir, filename), "utf8");

    migrations.push({
      version,
      name: name.replaceAll("_", " "),
      filename,
      sql
    });
  }

  return migrations.sort((left, right) =>
    left.version.localeCompare(right.version)
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const config = loadConfig();
  const database = new Database(config.databaseUrl);

  runMigrations(database)
    .then(async () => {
      logger.info("Database migrations completed");
      await database.close();
    })
    .catch(async (error: unknown) => {
      logger.error({ error }, "Database migrations failed");
      await database.close();
      process.exitCode = 1;
    });
}
