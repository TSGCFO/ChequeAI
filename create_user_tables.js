import pg from 'pg';

const { Pool } = pg;

// Connect to the database
console.log('Connecting to Supabase database...');
const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Supabase connection
  }
});

async function main() {
  try {
    console.log('Connected to database successfully.');
    console.log('Creating user tables...');
    
    // Create the user_role enum and tables
    await pool.query(`
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

      -- Modify ai_messages table to add user_id column if it exists
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
    
    console.log('User tables created successfully!');
    
    // Create the default superuser
    console.log('Creating default superuser...');
    
    // Check if the superuser already exists
    const userCheckResult = await pool.query("SELECT user_id FROM users WHERE username = 'waldo196637'");
    
    if (userCheckResult.rows.length === 0) {
      // Insert the superuser with pre-hashed password for "Hassan8488$@"
      await pool.query(`
        INSERT INTO users (username, password, email, role, first_name, last_name, is_active)
        VALUES (
          'waldo196637', 
          '$2b$10$X2fgrTLGvvY5MkSh6RPdG.ks1zcnYaQZPOf5V9.4L3cWZ4Z8yJUjq',
          'hassansadiq73@gmail.com', 
          'superuser', 
          'Hassan', 
          'Sadiq', 
          TRUE
        )
      `);
      console.log('Default superuser created successfully!');
    } else {
      console.log('Default superuser already exists.');
    }
    
    console.log('Database setup completed successfully!');
  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    // Close the connection
    await pool.end();
  }
}

// Run the main function
main();