/*
  # Add User Profile Coordinates

  1. Changes
    - Add `latitude` column to user_profiles table for customer locations
    - Add `longitude` column to user_profiles table
    - Add `address` column for full address storage

  2. Purpose
    - Allow customers to save their delivery location
    - Enable distance calculation from customer to restaurants
    - Support location-based features
*/

-- Add coordinate columns to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS latitude decimal(10,8),
ADD COLUMN IF NOT EXISTS longitude decimal(11,8),
ADD COLUMN IF NOT EXISTS address text;

-- Create index for coordinate queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_coordinates ON user_profiles(latitude, longitude);

-- Add comments
COMMENT ON COLUMN user_profiles.latitude IS 'User latitude coordinate for delivery location (decimal degrees)';
COMMENT ON COLUMN user_profiles.longitude IS 'User longitude coordinate for delivery location (decimal degrees)';
COMMENT ON COLUMN user_profiles.address IS 'Full delivery address for the user';