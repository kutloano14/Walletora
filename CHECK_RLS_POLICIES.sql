/*
  # Check Current RLS Policies on Deliveries
  
  Run this to see what RLS policies are actually on your deliveries table.
  This will help diagnose why drivers aren't seeing visibility changes.
*/

-- Check existing RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'deliveries'
ORDER BY policyname;

-- If the above shows the OLD policies still exist, 
-- the migration hasn't been applied yet!

-- Expected output AFTER fix should show:
-- - Drivers can view their deliveries - FIXED
-- - Drivers can update their deliveries - FIXED
-- - Admins can insert deliveries
-- - Admins can update any delivery

-- Quick test: Try to manually update a delivery
-- (This helps verify RLS isn't blocking updates)
-- UNCOMMENT TO TEST:
-- UPDATE deliveries 
-- SET driver_id = 'test-uuid-here'
-- WHERE id = 'test-delivery-id-here'
-- RETURNING id, driver_id;

