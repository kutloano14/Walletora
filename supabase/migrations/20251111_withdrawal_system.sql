/*
  # Driver Withdrawal System

  1. New Tables
    - `withdrawals` - Track all withdrawal requests and their status
    - `driver_balances` - Track driver available and pending balances

  2. Business Logic
    - Drivers can withdraw 75% of their total earnings
    - 25% is locked as Walletora commission/security
    - Track withdrawal status: pending, approved, rejected, paid
    - Update balances when withdrawals are processed

  3. Security
    - Drivers can only access their own withdrawal records
    - Only Walletora admin can update withdrawal status
*/

-- Create withdrawal status enum
CREATE TYPE withdrawal_status AS ENUM (
  'pending',
  'approved', 
  'rejected',
  'paid'
);

-- Create withdrawals table to track all withdrawal requests
CREATE TABLE IF NOT EXISTS withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  amount decimal(10,2) NOT NULL,
  status withdrawal_status DEFAULT 'pending',
  requested_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid REFERENCES user_profiles(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create driver_balances table to track available vs withdrawn amounts
CREATE TABLE IF NOT EXISTS driver_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid UNIQUE NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  total_earned decimal(10,2) DEFAULT 0.00,
  total_withdrawn decimal(10,2) DEFAULT 0.00,
  available_balance decimal(10,2) GENERATED ALWAYS AS (total_earned - total_withdrawn) STORED,
  withdrawable_amount decimal(10,2) GENERATED ALWAYS AS ((total_earned * 0.75) - total_withdrawn) STORED,
  last_updated timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_balances ENABLE ROW LEVEL SECURITY;

-- Withdrawal policies - drivers can only see their own withdrawals
CREATE POLICY "Drivers can view own withdrawals"
  ON withdrawals
  FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "Drivers can create withdrawal requests"
  ON withdrawals
  FOR INSERT
  TO authenticated
  WITH CHECK (driver_id = auth.uid() AND status = 'pending');

-- Driver balance policies - drivers can only see their own balance
CREATE POLICY "Drivers can view own balance"
  ON driver_balances
  FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

-- Function to update driver balance when earnings change
CREATE OR REPLACE FUNCTION update_driver_balance()
RETURNS trigger AS $$
BEGIN
  -- Insert or update driver balance
  INSERT INTO driver_balances (driver_id, total_earned)
  VALUES (
    (SELECT user_id FROM drivers WHERE id = NEW.driver_id),
    NEW.base_fee + COALESCE(NEW.tip_amount, 0)
  )
  ON CONFLICT (driver_id) 
  DO UPDATE SET 
    total_earned = driver_balances.total_earned + (NEW.base_fee + COALESCE(NEW.tip_amount, 0)),
    last_updated = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update balance when new earnings are added
DROP TRIGGER IF EXISTS on_earning_created ON earnings;
CREATE TRIGGER on_earning_created
  AFTER INSERT ON earnings
  FOR EACH ROW EXECUTE FUNCTION update_driver_balance();

-- Function to process withdrawal (admin use)
CREATE OR REPLACE FUNCTION process_withdrawal(
  withdrawal_id uuid,
  new_status withdrawal_status,
  admin_notes text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  withdrawal_record RECORD;
BEGIN
  -- Get withdrawal details
  SELECT * INTO withdrawal_record 
  FROM withdrawals 
  WHERE id = withdrawal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;

  -- Update withdrawal status
  UPDATE withdrawals
  SET 
    status = new_status,
    processed_at = now(),
    notes = admin_notes,
    updated_at = now()
  WHERE id = withdrawal_id;

  -- If approved/paid, update driver balance
  IF new_status IN ('approved', 'paid') THEN
    UPDATE driver_balances
    SET 
      total_withdrawn = total_withdrawn + withdrawal_record.amount,
      last_updated = now()
    WHERE driver_id = withdrawal_record.driver_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_withdrawals_driver_id ON withdrawals(driver_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_driver_balances_driver_id ON driver_balances(driver_id);