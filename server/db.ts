import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

// Priority: Use Supabase URL if available, otherwise fall back to Replit's DATABASE_URL
const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "No database connection string available. Please set SUPABASE_DATABASE_URL or DATABASE_URL.",
  );
}

console.log("Connecting to database using node-postgres...");
export const pool = new Pool({ 
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false // This is only for development, not recommended for production
  }
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Database connection successful! Current time:', res.rows[0].now);
  }
});

export const db = drizzle(pool, { schema });