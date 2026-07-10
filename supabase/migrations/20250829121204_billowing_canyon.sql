/*
  # Restaurant and Driver Management

  1. New Tables
    - `restaurants` - Restaurant business information
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `name` (text)
      - `description` (text)
      - `address` (text)
      - `phone` (text)
      - `image_url` (text)
      - `cuisine_type` (text)
      - `rating` (decimal)
      - `is_active` (boolean)
      - `created_at` (timestamp)

    - `drivers` - Driver information and status
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `vehicle_type` (text)
      - `license_plate` (text)
      - `is_available` (boolean)
      - `current_location` (point, optional)
      - `rating` (decimal)
      - `total_deliveries` (integer)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Restaurant owners can manage their restaurant
    - Drivers can manage their profile
    - Public can view active restaurants
*/

-- Create restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  address text NOT NULL,
  phone text,
  image_url text,
  cuisine_type text DEFAULT 'General',
  rating decimal(3,2) DEFAULT 0.0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL,
  license_plate text,
  is_available boolean DEFAULT false,
  current_location point,
  rating decimal(3,2) DEFAULT 0.0,
  total_deliveries integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Restaurant policies
CREATE POLICY "Restaurant owners can manage their restaurant"
  ON restaurants
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Public can view active restaurants"
  ON restaurants
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Driver policies
CREATE POLICY "Drivers can manage their profile"
  ON drivers
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Public can view available drivers"
  ON drivers
  FOR SELECT
  TO authenticated
  USING (is_available = true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurants_user_id ON restaurants(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_active ON restaurants(is_active);
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_available ON drivers(is_available);