/*
  # Fix Deliveries Foreign Key Constraint

  ISSUE IDENTIFIED:
  - The deliveries table has a corrupted foreign key constraint
  - Error: "Key (driver_id)=(drivers.id) is not present in table user_profiles"
  - This means deliveries.driver_id is incorrectly constrained to reference user_profiles(id)
  - But it should reference drivers(id) as per the original schema

  FIX:
  1. Drop the incorrect foreign key constraint
  2. Re-add the correct foreign key constraint referencing drivers(id)
  3. Ensure driver validation happens at application level
*/

-- First, drop the incorrect foreign key constraint
ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_driver_id_fkey;

-- Re-add the correct foreign key constraint
-- driver_id should reference drivers.id, not user_profiles.id
ALTER TABLE deliveries 
ADD CONSTRAINT deliveries_driver_id_fkey 
FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL;

-- Add an index for performance
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_id_correct ON deliveries(driver_id);

-- Add a check that ensures if driver_id exists, it must be valid
-- This is optional but adds extra validation
CREATE OR REPLACE FUNCTION validate_driver_exists()
RETURNS trigger AS $$
BEGIN
  IF NEW.driver_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM drivers WHERE id = NEW.driver_id) THEN
      RAISE EXCEPTION 'Driver with ID % does not exist', NEW.driver_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS check_delivery_driver_exists ON deliveries;

-- Create trigger for validation (optional, but helpful)
CREATE TRIGGER check_delivery_driver_exists
BEFORE INSERT OR UPDATE ON deliveries
FOR EACH ROW
EXECUTE FUNCTION validate_driver_exists();

COMMENT ON TABLE deliveries IS 'Delivery assignments. driver_id references drivers.id (NOT user_profiles.id)';
COMMENT ON COLUMN deliveries.driver_id IS 'Foreign key to drivers(id). Can be NULL if order is unassigned.';
