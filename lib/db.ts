import { Pool, type QueryResultRow } from "pg";

const globalForPg = globalThis as typeof globalThis & { artistPilotPool?: Pool };

export const db = globalForPg.artistPilotPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

if (process.env.NODE_ENV !== "production") globalForPg.artistPilotPool = db;

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  return db.query<T>(text, values);
}
