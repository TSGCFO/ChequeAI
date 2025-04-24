import * as schema from "@shared/schema";
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';

// Configure Neon for WebSocket connection (needed for serverless environments)
neonConfig.webSocketConstructor = ws;

// Use Replit PostgreSQL database
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log("Connecting to database using node-postgres...");

// Create the connection pool
export const pool = new Pool({ 
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false // Required for most hosted PostgreSQL providers
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

// Create the Drizzle ORM instance
export const db = drizzle(pool, { schema });