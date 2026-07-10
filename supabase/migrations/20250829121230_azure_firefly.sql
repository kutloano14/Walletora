/*
  # Earnings and Wallet Management

  1. New Tables
    - `earnings` - Driver earnings tracking
      - `id` (uuid, primary key)
      - `driver_id` (uuid, references drivers)
      - `delivery_id` (uuid, references deliveries)
      - `base_fee` (decimal)
      - `tip_amount` (decimal)
      - `total_earned` (decimal)
      - `created_at` (timestamp)

    - `wallets` - User wallet balances
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `balance` (decimal)
      - `currency` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Drivers can only see their own earnings
    - Users can only see their own wallet
*/

-- Create earnings table
CREATE TABLE IF NOT EXISTS earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  base_fee decimal(10,2) NOT NULL DEFAULT 5.00,
  tip_amount decimal(10,2) DEFAULT 0.00,
  total_earned decimal(10,2) GENERATED ALWAYS AS (base_fee + tip_amount) STORED,
  created_at timestamptz DEFAULT now()
);

-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  balance decimal(10,2) DEFAULT 0.00,
  currency text DEFAULT 'USD',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Earnings policies
CREATE POLICY "Drivers can view their own earnings"
  ON earnings
  FOR SELECT
  TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can create earnings"
  ON earnings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

-- Wallet policies
CREATE POLICY "Users can view their own wallet"
  ON wallets
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own wallet"
  ON wallets
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Function to create wallet on user creation
CREATE OR REPLACE FUNCTION create_user_wallet()
RETURNS trigger AS $$
BEGIN
  INSERT INTO wallets (user_id, balance)
  VALUES (NEW.id, 0.00);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for wallet creation
DROP TRIGGER IF EXISTS on_user_profile_created ON user_profiles;
CREATE TRIGGER on_user_profile_created
  AFTER INSERT ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION create_user_wallet();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_earnings_driver_id ON earnings(driver_id);
CREATE INDEX IF NOT EXISTS idx_earnings_delivery_id ON earnings(delivery_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);