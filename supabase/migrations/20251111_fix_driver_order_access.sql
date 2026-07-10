/*
  # Fix Driver Order Access

  1. Changes
    - Add policy for drivers to view orders assigned to them
    - Add policy for drivers to view customer profiles for their assigned orders
    - This allows drivers to access customer information for their deliveries

  2. Security
    - Drivers can only view orders through their assigned deliveries
    - Drivers can only view customer profiles for orders they're delivering
    - No direct access to all orders/profiles, only those they're delivering
*/

-- Add policy for drivers to view orders assigned to them
CREATE POLICY "Drivers can view their assigned orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

-- Add policy for drivers to update their assigned orders
CREATE POLICY "Drivers can update their assigned orders"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid());

-- Allow drivers to view customer profiles for their assigned orders
CREATE POLICY "Drivers can view customer profiles for assigned orders"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT customer_id 
      FROM orders 
      WHERE driver_id = auth.uid()
    )
  );