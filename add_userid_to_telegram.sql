-- Add user_id column to telegram_users table
ALTER TABLE telegram_users 
ADD COLUMN user_id INTEGER REFERENCES users(user_id);

-- Update existing records with default values if needed
-- For simplicity, I'll temporarily make it nullable while we update existing records
ALTER TABLE telegram_users 
ALTER COLUMN user_id DROP NOT NULL;

-- After the update is complete, we can make it NOT NULL again if needed
-- ALTER TABLE telegram_users 
-- ALTER COLUMN user_id SET NOT NULL;