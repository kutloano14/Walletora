/*
  # Fix Earnings Table Schema and Driver Statistics

  The earnings table currently has a schema mismatch:
  - earnings.driver_id references drivers(id) 
  - But deliveries.driver_id references user_profiles(id)
  - Code passes user_profiles.id to earnings, causing foreign key failures

  Fix by:
  1. Change earnings.driver_id to reference user_profiles(id) instead of drivers(id)
  2. Update the trigger function accordingly
  3. Add indexes for performance
  4. Add amount column to earnings table to match code expectations
*/

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS on_earning_created ON earnings;

-- Drop the foreign key constraint on earnings.driver_id
ALTER TABLE earnings DROP CONSTRAINT IF EXISTS earnings_driver_id_fkey;

-- Change earnings.driver_id to reference user_profiles instead of drivers
ALTER TABLE earnings 
ADD CONSTRAINT earnings_driver_id_fkey 
FOREIGN KEY (driver_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Add amount column if it doesn't exist (for compatibility with code)
ALTER TABLE earnings ADD COLUMN IF NOT EXISTS amount decimal(10,2);

-- Update the generated column to include amount if present
ALTER TABLE earnings DROP COLUMN IF EXISTS total_earned;
ALTER TABLE earnings ADD COLUMN total_earned decimal(10,2) GENERATED ALWAYS AS (
  base_fee + COALESCE(tip_amount, 0) + COALESCE(amount, 0)
) STORED;

-- Create corrected function to update driver balance when earnings change  
CREATE OR REPLACE FUNCTION update_driver_balance()
RETURNS trigger AS $$
BEGIN
  -- NEW.driver_id now correctly contains user_profiles.id
  INSERT INTO driver_balances (driver_id, total_earned)
  VALUES (
    NEW.driver_id, -- This is user_profiles.id
    COALESCE(NEW.base_fee, 0) + COALESCE(NEW.tip_amount, 0) + COALESCE(NEW.amount, 0)
  )
  ON CONFLICT (driver_id) 
  DO UPDATE SET 
    total_earned = driver_balances.total_earned + (COALESCE(NEW.base_fee, 0) + COALESCE(NEW.tip_amount, 0) + COALESCE(NEW.amount, 0)),
    last_updated = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_earning_created
  AFTER INSERT ON earnings
  FOR EACH ROW EXECUTE FUNCTION update_driver_balance();

-- Add proper indexes
CREATE INDEX IF NOT EXISTS idx_earnings_driver_id ON earnings(driver_id);
CREATE INDEX IF NOT EXISTS idx_earnings_delivery_id ON earnings(delivery_id);
CREATE INDEX IF NOT EXISTS idx_earnings_created_at ON earnings(created_at);

-- Update RLS policies for the new reference
DROP POLICY IF EXISTS "Drivers can view their own earnings" ON earnings;

CREATE POLICY "Drivers can view their own earnings"
  ON earnings
  FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "System can insert earnings"
  ON earnings
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Allow system to insert earnings for any driver

-- Add helpful comment
COMMENT ON TABLE earnings IS 'Driver earnings from completed deliveries. driver_id references user_profiles.id';
COMMENT ON COLUMN earnings.driver_id IS 'References user_profiles.id (NOT drivers.id)';

-- Migration: Fix existing driver_balances if any exist with wrong driver_id references
-- This is safe to run multiple times
DO $$
BEGIN
  -- Only run if there are existing earnings records
  IF EXISTS (SELECT 1 FROM earnings LIMIT 1) THEN
    RAISE NOTICE 'Rebuilding driver_balances from existing earnings...';
    
    -- Clear existing balances  
    DELETE FROM driver_balances;
    
    -- Rebuild from earnings
    INSERT INTO driver_balances (driver_id, total_earned, last_updated)
    SELECT 
      e.driver_id,
      SUM(COALESCE(e.base_fee, 0) + COALESCE(e.tip_amount, 0) + COALESCE(e.amount, 0)) as total_earned,
      now() as last_updated
    FROM earnings e
    WHERE e.driver_id IS NOT NULL
    GROUP BY e.driver_id
    ON CONFLICT (driver_id) 
    DO UPDATE SET 
      total_earned = EXCLUDED.total_earned,
      last_updated = now();
      
    RAISE NOTICE 'Driver balances rebuilt successfully';
  ELSE
    RAISE NOTICE 'No existing earnings found, nothing to migrate';
  END IF;
END $$;