import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Neon's pooled endpoint plus a small client pool. prepare:false is required
// for transaction-mode poolers.
const client = postgres(process.env.DATABASE_URL!, { max: 5, prepare: false });

export const db = drizzle(client, { schema });
export { client as sql };
export * from "./schema";
