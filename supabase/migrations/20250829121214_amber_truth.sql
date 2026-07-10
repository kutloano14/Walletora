/*
  # Orders and Deliveries System

  1. New Tables
    - `orders` - Customer orders from restaurants
      - `id` (uuid, primary key)
      - `customer_id` (uuid, references user_profiles)
      - `restaurant_id` (uuid, references restaurants)
      - `items` (jsonb, order items)
      - `total_amount` (decimal)
      - `delivery_fee` (decimal)
      - `status` (enum)
      - `delivery_address` (text)
      - `special_instructions` (text)
      - `created_at` (timestamp)

    - `deliveries` - Delivery assignments and tracking
      - `id` (uuid, primary key)
      - `order_id` (uuid, references orders)
      - `driver_id` (uuid, references drivers)
      - `pickup_time` (timestamp)
      - `delivery_time` (timestamp)
      - `status` (enum)
      - `driver_location` (point)
      - `created_at` (timestamp)

  2. Security
    - Customers see only their orders
    - Restaurants see only orders for their restaurant
    - Drivers see only their assigned deliveries
*/

-- Create order status enum
CREATE TYPE order_status AS ENUM (
  'pending',
  'confirmed', 
  'preparing',
  'ready_for_pickup',
  'picked_up',
  'delivered',
  'cancelled'
);

-- Create delivery status enum
CREATE TYPE delivery_status AS ENUM (
  'assigned',
  'heading_to_restaurant',
  'at_restaurant',
  'picked_up',
  'heading_to_customer',
  'delivered'
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]',
  total_amount decimal(10,2) NOT NULL,
  delivery_fee decimal(10,2) DEFAULT 2.99,
  status order_status DEFAULT 'pending',
  delivery_address text NOT NULL,
  special_instructions text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create deliveries table
CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  pickup_time timestamptz,
  delivery_time timestamptz,
  status delivery_status DEFAULT 'assigned',
  driver_location point,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- Order policies
CREATE POLICY "Customers can view their own orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Customers can create orders"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Restaurants can view their orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Restaurants can update their orders"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
    )
  );

-- Delivery policies
CREATE POLICY "Drivers can view their deliveries"
  ON deliveries
  FOR SELECT
  TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can update their deliveries"
  ON deliveries
  FOR UPDATE
  TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Restaurants can view deliveries for their orders"
  ON deliveries
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN restaurants r ON o.restaurant_id = r.id
      WHERE r.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_id ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);