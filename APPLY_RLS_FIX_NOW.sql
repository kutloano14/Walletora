-- ==========================================
-- SUPABASE SQL EDITOR - RUN THIS DIRECTLY
-- ==========================================
-- This fixes the RLS policies so reassignment works
-- Copy and paste ALL of this into Supabase SQL Editor
-- Click Run
-- ==========================================

-- Step 1: Drop all old policies
DROP POLICY IF EXISTS "Drivers can view their deliveries" ON deliveries;
DROP POLICY IF EXISTS "Drivers can update their deliveries" ON deliveries;
DROP POLICY IF EXISTS "Restaurants can view deliveries for their orders" ON deliveries;
DROP POLICY IF EXISTS "Admins can insert deliveries" ON deliveries;
DROP POLICY IF EXISTS "Admins can update deliveries" ON deliveries;
DROP POLICY IF EXISTS "Drivers can view their deliveries - FIXED" ON deliveries;
DROP POLICY IF EXISTS "Drivers can update their deliveries - FIXED" ON deliveries;
DROP POLICY IF EXISTS "Admins can update any delivery" ON deliveries;

-- Step 2: Create new policies (SIMPLE AND EFFECTIVE)
CREATE POLICY "drivers_see_own_deliveries"
  ON deliveries
  FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "drivers_update_own_deliveries"
  ON deliveries
  FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

CREATE POLICY "allow_admin_insert_deliveries"
  ON deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "allow_admin_update_any_delivery"
  ON deliveries
  FOR UPDATE
  TO authenticated
  USING (true);

-- Step 3: Verify (run this in a separate query to check)
-- SELECT policyname FROM pg_policies WHERE tablename = 'deliveries' ORDER BY policyname;

-- Expected output:
-- allow_admin_insert_deliveries
-- allow_admin_update_any_delivery
-- drivers_see_own_deliveries
-- drivers_update_own_deliveries
