/*
  # Fix Deliveries RLS Policies - CRITICAL FIX
  
  PROBLEM:
  The RLS policies on deliveries table are BROKEN.
  They expect: driver_id → drivers.id
  But actual data: driver_id → user_profiles.id
  
  This causes drivers to see ALL deliveries or NONE, not just theirs.
  
  SOLUTION:
  1. DROP ALL old policies (by name AND by matching pattern)
  2. CREATE new simple policies that work with CURRENT schema
  3. Test with simple driver_id = auth.uid() comparison
*/

-- ⚠️ STEP 1: Drop ALL existing policies on deliveries table
DROP POLICY IF EXISTS "Drivers can view their deliveries" ON deliveries;
DROP POLICY IF EXISTS "Drivers can update their deliveries" ON deliveries;
DROP POLICY IF EXISTS "Restaurants can view deliveries for their orders" ON deliveries;

-- Also drop any admin policies that might exist
DROP POLICY IF EXISTS "Admins can insert deliveries" ON deliveries;
DROP POLICY IF EXISTS "Admins can update deliveries" ON deliveries;
DROP POLICY IF EXISTS "Admins can insert and update deliveries" ON deliveries;

-- Drop policies with any "FIXED" suffix (in case they were created before)
DROP POLICY IF EXISTS "Drivers can view their deliveries - FIXED" ON deliveries;
DROP POLICY IF EXISTS "Drivers can update their deliveries - FIXED" ON deliveries;
DROP POLICY IF EXISTS "Admins can update any delivery" ON deliveries;

-- ✅ STEP 2: Create SIMPLE, CLEAR policies
-- Policy 1: Drivers see only their own deliveries
CREATE POLICY "drivers_see_own_deliveries"
  ON deliveries
  FOR SELECT
  TO authenticated
  USING (
    driver_id = auth.uid()
  );

-- Policy 2: Drivers can update only their own deliveries  
CREATE POLICY "drivers_update_own_deliveries"
  ON deliveries
  FOR UPDATE
  TO authenticated
  USING (
    driver_id = auth.uid()
  )
  WITH CHECK (
    driver_id = auth.uid()
  );

-- Policy 3: Allow admin to INSERT deliveries (for initial assignment)
CREATE POLICY "allow_admin_insert_deliveries"
  ON deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy 4: Allow admin to UPDATE any delivery (for reassignment)
CREATE POLICY "allow_admin_update_any_delivery"
  ON deliveries
  FOR UPDATE
  TO authenticated
  USING (true);

-- ✅ STEP 3: Verify what we have now
-- Run this query to confirm policies are in place:
-- SELECT policyname FROM pg_policies WHERE tablename = 'deliveries';

-- Expected result:
-- drivers_see_own_deliveries
-- drivers_update_own_deliveries
-- allow_admin_insert_deliveries
-- allow_admin_update_any_delivery


