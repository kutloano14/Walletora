/*
  # Fix Driver Balance Trigger

  The original trigger function was incorrectly trying to lookup user_id from drivers table
  using drivers.id, but earnings.driver_id actually contains the user_profiles.id directly.

  1. Fix the trigger function to directly use NEW.driver_id as the driver_id
  2. Add better error handling and logging
  3. Ensure backward compatibility
*/

-- Drop the existing trigger
DROP TRIGGER IF EXISTS on_earning_created ON earnings;

-- Create corrected function to update driver balance when earnings change
CREATE OR REPLACE FUNCTION update_driver_balance()
RETURNS trigger AS $$
BEGIN
  -- NEW.driver_id already contains the user_profiles.id (user_id)
  -- No need to lookup from drivers table
  INSERT INTO driver_balances (driver_id, total_earned)
  VALUES (
    NEW.driver_id, -- This is already the user_profiles.id
    NEW.base_fee + COALESCE(NEW.tip_amount, 0)
  )
  ON CONFLICT (driver_id) 
  DO UPDATE SET 
    total_earned = driver_balances.total_earned + (NEW.base_fee + COALESCE(NEW.tip_amount, 0)),
    last_updated = now();

  -- Log for debugging (remove in production if needed)
  RAISE NOTICE 'Driver balance updated for driver_id: %, amount: %', 
    NEW.driver_id, 
    NEW.base_fee + COALESCE(NEW.tip_amount, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_earning_created
  AFTER INSERT ON earnings
  FOR EACH ROW EXECUTE FUNCTION update_driver_balance();

-- Migration to fix existing data: populate driver_balances for existing earnings
INSERT INTO driver_balances (driver_id, total_earned, last_updated)
SELECT 
  e.driver_id,
  SUM(e.base_fee + COALESCE(e.tip_amount, 0)) as total_earned,
  now() as last_updated
FROM earnings e
WHERE e.driver_id IS NOT NULL
GROUP BY e.driver_id
ON CONFLICT (driver_id) 
DO UPDATE SET 
  total_earned = EXCLUDED.total_earned,
  last_updated = now();