import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __trivionPool: Pool | undefined;
}

const pool =
  global.__trivionPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  global.__trivionPool = pool;
}

export const db = drizzle(pool, { schema });
