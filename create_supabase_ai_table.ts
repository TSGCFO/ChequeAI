import pg from 'pg';
const { Pool } = pg;

async function createAIMessagesTable() {
  const pool = new Pool({ 
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Test connection first
    const testResult = await pool.query('SELECT NOW()');
    console.log('Connected to Supabase database. Current time:', testResult.rows[0].now);

    // Create the AI messages table
    const createTableResult = await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_messages (
        message_id SERIAL PRIMARY KEY,
        user_id INTEGER,
        content TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        conversation_id TEXT NOT NULL
      );
    `);
    console.log('AI messages table created or already exists.');

    // Create index for faster lookups
    const createIndexResult = await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);
    `);
    console.log('Index created or already exists.');

    // Verify table exists
    const verifyTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'ai_messages'
      );
    `);
    console.log('Table exists:', verifyTable.rows[0].exists);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

createAIMessagesTable();