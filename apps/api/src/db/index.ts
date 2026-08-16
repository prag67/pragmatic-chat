import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgres://pragmatic:pragmatic@localhost:5433/pragmatic';
const pool = new pg.Pool({ connectionString, max: 10 });
export const db = drizzle(pool, { schema });
export { pool };
export * from './schema.js';
