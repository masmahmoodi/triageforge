import {
  describe,
  expect,
  it
} from "vitest";

import { Database } from "../src/infrastructure/database/database.js";
import { runMigrations } from "../src/infrastructure/database/migrate.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("database migrations", () => {
  it("applies migrations to a PostgreSQL database", async () => {
    const database = new Database(databaseUrl!);

    try {
      await runMigrations(database);
      const result = await database.query<{ count: string }>(
        "SELECT count(*) FROM schema_migrations"
      );

      expect(Number(result.rows[0]?.count ?? 0)).toBeGreaterThan(0);
    } finally {
      await database.close();
    }
  });
});
