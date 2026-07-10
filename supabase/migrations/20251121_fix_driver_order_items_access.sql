-- Fix driver access to order_items table for viewing order details
-- File: 20251121_fix_driver_order_items_access.sql

-- First ensure the order_items table exists and has RLS enabled
-- (This is safe to run even if table already exists)
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_id uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on order_items table
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for order_items

-- Policy 1: Customers can view order items for their own orders
CREATE POLICY IF NOT EXISTS "Customers can view their order items"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders WHERE customer_id = auth.uid()
    )
  );

-- Policy 2: Customers can insert order items when creating orders
CREATE POLICY IF NOT EXISTS "Customers can create order items"
  ON order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    order_id IN (
      SELECT id FROM orders WHERE customer_id = auth.uid()
    )
  );

-- Policy 3: Restaurants can view order items for orders from their restaurant
CREATE POLICY IF NOT EXISTS "Restaurants can view their order items"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN restaurants r ON o.restaurant_id = r.id
      WHERE r.user_id = auth.uid()
    )
  );

-- Policy 4: Drivers can view order items for orders assigned to them
CREATE POLICY IF NOT EXISTS "Drivers can view assigned order items"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders 
      WHERE driver_id = auth.uid() 
      OR (status = 'ready_for_pickup' AND delivery_included = true)
    )
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_id ON order_items(menu_id);