/*
  # Add Restaurant Coordinates

  1. Changes
    - Add `latitude` column to restaurants table
    - Add `longitude` column to restaurants table  
    - Add `delivery_time` column for default delivery estimates
    - Add sample coordinates for existing restaurants

  2. Sample Data
    - Add coordinates for major Johannesburg areas
    - Set default delivery times
*/

-- Add coordinate columns to restaurants table
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS latitude decimal(10,8),
ADD COLUMN IF NOT EXISTS longitude decimal(11,8),
ADD COLUMN IF NOT EXISTS delivery_time text DEFAULT '30-40 min';

-- Add sample coordinates for existing restaurants (Johannesburg area)
-- If there are existing restaurants, we'll give them coordinates
UPDATE restaurants SET 
  latitude = -26.2041 + (RANDOM() * 0.1 - 0.05), -- Random coords around Johannesburg
  longitude = 28.0473 + (RANDOM() * 0.1 - 0.05),
  delivery_time = '25-35 min'
WHERE latitude IS NULL;

-- Insert some sample restaurants with coordinates if table is empty
INSERT INTO restaurants (id, user_id, name, description, address, phone, cuisine_type, rating, latitude, longitude, delivery_time)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM user_profiles WHERE role = 'restaurant' LIMIT 1),
  'QuickBite Central',
  'Fast food and quick meals in the heart of Johannesburg',
  '123 Main Street, Johannesburg Central, 2001',
  '+27 11 123 4567',
  'Fast Food',
  4.2,
  -26.2041,
  28.0473,
  '20-30 min'
WHERE NOT EXISTS (SELECT 1 FROM restaurants WHERE name = 'QuickBite Central');

INSERT INTO restaurants (id, user_id, name, description, address, phone, cuisine_type, rating, latitude, longitude, delivery_time)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM user_profiles WHERE role = 'restaurant' LIMIT 1),
  'Sandton Grill House',
  'Premium steaks and grilled specialties in upscale Sandton',
  '456 Rivonia Road, Sandton, 2196',
  '+27 11 234 5678',
  'Steakhouse',
  4.5,
  -26.1076,
  28.0567,
  '35-45 min'
WHERE NOT EXISTS (SELECT 1 FROM restaurants WHERE name = 'Sandton Grill House');

INSERT INTO restaurants (id, user_id, name, description, address, phone, cuisine_type, rating, latitude, longitude, delivery_time)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM user_profiles WHERE role = 'restaurant' LIMIT 1),
  'Rosebank Pizza Palace',
  'Authentic wood-fired pizzas and Italian cuisine',
  '789 Oxford Road, Rosebank, 2196',
  '+27 11 345 6789',
  'Italian',
  4.3,
  -26.1426,
  28.0420,
  '25-35 min'
WHERE NOT EXISTS (SELECT 1 FROM restaurants WHERE name = 'Rosebank Pizza Palace');

INSERT INTO restaurants (id, user_id, name, description, address, phone, cuisine_type, rating, latitude, longitude, delivery_time)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM user_profiles WHERE role = 'restaurant' LIMIT 1),
  'Melville Cafe',
  'Trendy cafe with artisanal coffee and light meals',
  '321 7th Street, Melville, 2109',
  '+27 11 456 7890',
  'Cafe',
  4.1,
  -26.1851,
  28.0142,
  '30-40 min'
WHERE NOT EXISTS (SELECT 1 FROM restaurants WHERE name = 'Melville Cafe');

INSERT INTO restaurants (id, user_id, name, description, address, phone, cuisine_type, rating, latitude, longitude, delivery_time)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM user_profiles WHERE role = 'restaurant' LIMIT 1),
  'Fourways Fresh Market',
  'Fresh produce and organic meals in northern suburbs',
  '654 William Nicol Drive, Fourways, 2055',
  '+27 11 567 8901',
  'Health Food',
  4.4,
  -25.9956,
  28.0087,
  '40-50 min'
WHERE NOT EXISTS (SELECT 1 FROM restaurants WHERE name = 'Fourways Fresh Market');

-- Create index for coordinate queries
CREATE INDEX IF NOT EXISTS idx_restaurants_coordinates ON restaurants(latitude, longitude);

-- Add comment
COMMENT ON COLUMN restaurants.latitude IS 'Restaurant latitude coordinate (decimal degrees)';
COMMENT ON COLUMN restaurants.longitude IS 'Restaurant longitude coordinate (decimal degrees)';
COMMENT ON COLUMN restaurants.delivery_time IS 'Default delivery time estimate when location unavailable';