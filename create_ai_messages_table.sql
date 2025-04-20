-- Create AI Messages table
CREATE TABLE IF NOT EXISTS ai_messages (
  message_id SERIAL PRIMARY KEY,
  user_id INTEGER,
  content TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  conversation_id TEXT NOT NULL
);

-- Create index on conversation_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);