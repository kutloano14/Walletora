-- Migration to add credit approval fields and fix status constraint
-- File: 20251112_credit_approval_system.sql

-- Add approval fields to credits table
ALTER TABLE credits 
ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Drop the existing status check constraint if it exists
ALTER TABLE credits DROP CONSTRAINT IF EXISTS credits_status_check;

-- Create new check constraint with all allowed status values
ALTER TABLE credits 
ADD CONSTRAINT credits_status_check 
CHECK (status IN ('pending', 'approved', 'active', 'paid', 'defaulted', 'rejected'));

-- Create index for faster queries on credit status
CREATE INDEX IF NOT EXISTS idx_credits_status ON credits(status);
CREATE INDEX IF NOT EXISTS idx_credits_wallet_status ON credits(wallet_id, status);

-- Add RLS policy for admin access to all credits
CREATE POLICY IF NOT EXISTS "Admin can view all credits" ON credits
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Admin can update credit status" ON credits
  FOR UPDATE USING (true);

-- Update existing credits to have pending status if needed (optional)
-- UPDATE credits SET status = 'pending' WHERE status = 'active' AND approved_by IS NULL;