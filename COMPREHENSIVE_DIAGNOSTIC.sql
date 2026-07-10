/*
  COMPREHENSIVE DIAGNOSTIC - Run these queries one at a time
  to understand the exact state of your deliveries table
*/

-- QUERY 1: Check column definitions
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'deliveries'
ORDER BY ordinal_position;

-- QUERY 2: Check all constraints (including foreign keys)
SELECT 
  constraint_name,
  constraint_type,
  table_name,
  column_name
FROM information_schema.constraint_column_usage
WHERE table_name = 'deliveries'
ORDER BY constraint_name;

-- QUERY 3: Check ALL RLS policies (even if they have weird names)
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

-- QUERY 4: Check if RLS is even enabled on the table
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'deliveries';

-- QUERY 5: Look at actual delivery data
SELECT 
  id,
  order_id,
  driver_id,
  status,
  created_at
FROM deliveries
LIMIT 5;

-- QUERY 6: Check if there are any triggers on the table
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'deliveries'
ORDER BY trigger_name;

-- QUERY 7: Check auth context
-- This shows what auth.uid() would return for current session
SELECT current_user_id();

-- QUERY 8: Test a specific delivery
-- Replace the UUID with an actual delivery ID from your data
-- SELECT driver_id FROM deliveries WHERE id = 'PUT_ACTUAL_DELIVERY_ID_HERE';
