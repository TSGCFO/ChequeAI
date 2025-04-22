// Import Drizzle modules and schema
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "./shared/schema.js";
import { hashPassword } from "./server/auth.js";

// Connect to the database
console.log("Connecting to Supabase database...");
const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase connection
  },
});

// Create Drizzle client
const db = drizzle(pool, { schema });

async function main() {
  try {
    // Push schema changes to the database
    console.log("Pushing schema changes...");

    // This applies any pending schema changes
    await db.execute(`
      -- Create the user_role enum type if it doesn't exist
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
          CREATE TYPE user_role AS ENUM ('superuser', 'admin', 'user');
        END IF;
      END $$;

      -- Create the users table if it doesn't exist
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(200) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        role user_role NOT NULL DEFAULT 'user',
        first_name VARCHAR(50),
        last_name VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Create the user_conversations table if it doesn't exist
      CREATE TABLE IF NOT EXISTS user_conversations (
        conversation_id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        title VARCHAR(100),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Alter ai_messages table to add user_id column if it exists but doesn't have the column
      DO $$
      BEGIN
        IF EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'ai_messages'
        ) AND NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'ai_messages' 
          AND column_name = 'user_id'
        ) THEN
          ALTER TABLE ai_messages ADD COLUMN user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    console.log("Schema changes applied successfully.");

    // Check if superuser exists
    const superuserResult = await db.execute(
      `SELECT user_id FROM users WHERE username = 'waldo196637' LIMIT 1`,
    );

    // Create the default superuser if it doesn't exist
    if (superuserResult.rows.length === 0) {
      console.log("Creating default superuser...");

      // Hash the password
      const hashedPassword = await hashPassword("Hassan8488$@");

      // Insert the superuser
      await db.execute(
        `INSERT INTO users (username, password, email, role, first_name, last_name, is_active)
         VALUES ('waldo196637', $1, 'hassansadiq73@gmail.com', 'superuser', 'Hassan', 'Sadiq', TRUE)`,
        [hashedPassword],
      );

      console.log("Default superuser created successfully.");
    } else {
      console.log("Default superuser already exists.");
    }

    console.log("Database setup completed successfully.");
  } catch (error) {
    console.error("Error setting up database:", error);
  } finally {
    // Close the connection
    await pool.end();
  }
}

// Run the main function
main();
