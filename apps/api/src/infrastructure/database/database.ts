import pg from "pg";

const { Pool } = pg;

export type QueryResultRow = pg.QueryResultRow;
export type Queryable = Pick<pg.Pool | pg.PoolClient, "query">;

export class Database {
  private readonly pool: pg.Pool;

  public constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000
    });
  }

  public query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = []
  ): Promise<pg.QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  public async transaction<T>(
    callback: (client: pg.PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
