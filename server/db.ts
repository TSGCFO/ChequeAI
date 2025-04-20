import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Priority: Use Supabase URL if available, otherwise fall back to Replit's DATABASE_URL
const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "No database connection string available. Please set SUPABASE_DATABASE_URL or DATABASE_URL.",
  );
}

console.log("Connecting to database...");
export const pool = new Pool({ 
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false // This is only for development, not recommended for production
  }
});
export const db = drizzle(pool, { schema });