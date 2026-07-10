import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: 'customer' | 'driver' | 'restaurant' | 'admin';
  approval_status?: 'pending' | 'approved' | 'rejected';
  approved_at?: string;
  approved_by?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Restaurant {
  id: string;
  user_id: string;
  name: string;
  description: string;
  address: string;
  phone?: string;
  image_url?: string;
  cuisine_type: string;
  rating: number;
  latitude?: number;
  longitude?: number;
  delivery_time?: string;
  is_active: boolean;
  closing_time?: string;
  is_temporarily_closed?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  user_id: string;
  vehicle_type: string;
  license_plate?: string;
  is_available: boolean;
  current_location?: { x: number; y: number };
  rating: number;
  total_deliveries: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  restaurant_id: string;
  items: OrderItem[];
  total_amount: number;
  delivery_fee: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'picked_up' | 'delivered' | 'cancelled';
  delivery_address: string;
  special_instructions: string;
  created_at: string;
  updated_at: string;
  restaurant?: Restaurant;
  customer?: UserProfile;
  driver?: UserProfile;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  special_requests?: string;
}

export interface Delivery {
  id: string;
  order_id: string;
  driver_id?: string;
  pickup_time?: string;
  delivery_time?: string;
  status: 'assigned' | 'heading_to_restaurant' | 'at_restaurant' | 'picked_up' | 'heading_to_customer' | 'delivered';
  driver_location?: { x: number; y: number };
  created_at: string;
  updated_at: string;
  order?: Order;
  driver?: Driver;
}

export interface Earnings {
  id: string;
  driver_id: string;
  delivery_id: string;
  base_fee: number;
  tip_amount: number;
  total_earned: number;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface AppSetting {
  id: number;
  wallet_enabled: boolean;
  updated_at: string;
}