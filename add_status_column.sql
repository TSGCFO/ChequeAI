-- Create the enum type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') THEN
        CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'cancelled');
    END IF;
END
$$;

-- Add the status column if it doesn't exist
ALTER TABLE cheque_transactions
ADD COLUMN IF NOT EXISTS status transaction_status DEFAULT 'pending';