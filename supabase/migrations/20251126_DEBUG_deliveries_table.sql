/*
  # Debug: Check Deliveries Table Structure
  
  Run this to understand what's currently in your deliveries table.
  
  Key questions:
  1. What is the current FK constraint on driver_id?
  2. What values are in driver_id column? (drivers.id or user_profiles.id?)
  3. Are there RLS policies blocking updates?
*/

-- Check the actual FK constraint definition
SELECT 
  constraint_name,
  table_name,
  column_name,
  foreign_table_name,
  foreign_column_name
FROM information_schema.referential_constraints
WHERE table_name = 'deliveries' AND column_name LIKE '%driver%';

-- Check what values are in deliveries.driver_id
SELECT 
  d.id,
  d.order_id,
  d.driver_id,
  d.status,
  d.created_at,
  d.updated_at
FROM deliveries d
LIMIT 10;

-- Check if driver_id values match drivers.id
SELECT 
  COUNT(*) as total_deliveries,
  COUNT(dr.id) as match_drivers_id,
  COUNT(up.id) as match_user_profiles_id
FROM deliveries d
LEFT JOIN drivers dr ON d.driver_id = dr.id
LEFT JOIN user_profiles up ON d.driver_id = up.id;

-- Check RLS policies on deliveries
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

-- Check if we can even update (as service role)
-- Test update on first delivery (you may need to adjust this)
-- UNCOMMENT AND RUN CAREFULLY:
-- UPDATE deliveries SET driver_id = NULL WHERE id = (SELECT id FROM deliveries LIMIT 1);
-- Then check:
-- SELECT * FROM deliveries LIMIT 1;
