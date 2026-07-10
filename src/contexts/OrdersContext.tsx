import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

export interface Order {
  id: string;
  customer_id: string;
  restaurant_id: string;
  delivery_address: string;
  driver_id?: string ;
  total_amount: number;
  delivery_fee: number;
  delivery_fee_base?: number;
  delivery_fee_offer_customer?: number | null;
  delivery_fee_offer_driver?: number | null;
  delivery_fee_offer_by?: 'customer' | 'driver' | null;
  delivery_offer_view_count?: number;
  delivery_offer_not_accepted_count?: number;
  driver_has_viewed?: boolean;
  delivery_included: boolean;
  status: string;
  created_at: string;
  updated_at?: string;
  restaurants: { name: string; address?: string; phone?: string; latitude?: number; longitude?: number } | null;
  customer: { full_name: string; phone?: string; latitude?: number; longitude?: number } | null;
  deliveries: { id: string; driver_id: string | null; otp?: string; otp_verified?: boolean; otp_expires_at?: string; driver_name?: string; driver_phone?: string }[];
  order_items?:{
    id: string;
    quantity: number;
    menu_id: string;
    menu: {name: string; price: number; category?: string; description?: string} | null;
  }[];
  // Pickup OTP fields (optional)
  pickup_otp?: string | null;
  pickup_otp_verified?: boolean | null;
  pickup_otp_expires_at?: string | null;
  restaurant_lat: number;
  restaurant_lng: number;
  customer_lat: number;
  customer_lng: number;
}

interface OrdersContextType {
  orders: Order[];
  activeDeliveries: Order[];
  loading: boolean;
  refreshOrders: () => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
  verifyOtp: (orderId: string, otp: string) => Promise<boolean>;
  requestNewOtp: (orderId: string) => Promise<string | null>;
  requestPickupOtp?: (orderId: string) => Promise<string | null>;
  requestPickupOtpForCustomer?: (orderId: string) => Promise<string | null>;
  verifyPickupOtp?: (orderId: string, otp: string) => Promise<boolean>;
  acceptOrder: (orderId: string, driverId: string, agreedFee?: number) => Promise<void>;
  markOrderViewed: (orderId: string) => Promise<void>;
  submitDriverOffer: (orderId: string, amount: number) => Promise<void>;
  submitCustomerOffer: (orderId: string, amount: number) => Promise<void>;
  acceptDriverOffer: (orderId: string) => Promise<void>;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export const OrdersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const normalizeOrder = (o: any): Order => {
    const restaurants = Array.isArray(o.restaurants) ? o.restaurants[0] ?? null : o.restaurants ?? null;
    const customer = Array.isArray(o.customer) ? o.customer[0] ?? null : o.customer ?? null;
    
    const deliveries = Array.isArray(o.deliveries)
      ? o.deliveries.map((d: any) => {
          // when joined, driver appears under d.driver as an array (user_profiles) or object
          const drv = Array.isArray(d.driver) ? d.driver[0] ?? d.driver : d.driver ?? null;
          const driver_name = drv?.full_name ?? undefined;
          const driver_phone = drv?.phone ?? undefined;
          return { id: d.id, driver_id: d.driver_id ?? null, otp: d.otp ?? undefined, otp_verified: d.otp_verified ?? undefined, otp_expires_at: d.otp_expires_at ?? undefined, driver_name, driver_phone };
        })
      : [];

    const order_items = Array.isArray(o.order_items)
      ? o.order_items.map((item: any) => ({
       id: item.id,
       quantity: item.quantity,
       menu_id: item.menu_id,
      menu: item.menus ? {name: item.menus.name, price: item.menus.price, category: item.menus.category, description: item.menus.description} : null,
       }))
      : [];

    const interests = Array.isArray(o.order_driver_interest) ? o.order_driver_interest : [];
    const delivery_offer_view_count = interests.length;
    const delivery_offer_not_accepted_count = interests.filter((i: any) => i.status !== 'accepted').length;
    const driver_has_viewed = !!user?.id && interests.some((i: any) => i.driver_id === user.id);

    return {
      id: o.id,
      customer_id: o.customer_id,
      restaurant_id: o.restaurant_id,
      delivery_address: o.delivery_address,
      total_amount: o.total_amount,
      delivery_fee: o.delivery_fee,
      delivery_fee_base: o.delivery_fee_base ?? o.delivery_fee,
      delivery_fee_offer_customer: o.delivery_fee_offer_customer ?? null,
      delivery_fee_offer_driver: o.delivery_fee_offer_driver ?? null,
      delivery_fee_offer_by: o.delivery_fee_offer_by ?? null,
      delivery_offer_view_count,
      delivery_offer_not_accepted_count,
      driver_has_viewed,
      delivery_included: o.delivery_included,
      status: o.status,
      created_at: o.created_at,
      updated_at: o.updated_at ?? undefined,
      restaurants,
      customer,
      deliveries,
      // pickup OTP fields (if present)
      pickup_otp: o.pickup_otp ?? undefined,
      pickup_otp_verified: o.pickup_otp_verified ?? undefined,
      pickup_otp_expires_at: o.pickup_otp_expires_at ?? undefined,
      order_items,

      // Ensure numeric lat/lng, fallback to 0 if missing
      restaurant_lat: Number(o.restaurant_lat ?? restaurants?.latitude ?? 0),
      restaurant_lng: Number(o.restaurant_lng ?? restaurants?.longitude ?? 0),
      customer_lat: Number(o.customer_lat ?? customer?.latitude ?? 0),
      customer_lng: Number(o.customer_lng ?? customer?.longitude ?? 0),
    };
  };

  // (cancellation removed per user request)

  const requestNewOtp = async (orderId: string): Promise<string | null> => {
    try {
      // find latest delivery for order (for delivery orders only)
      const { data: delivery, error: dErr } = await supabase
        .from('deliveries')
        .select('id, order_id, otp_verified')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dErr) throw dErr;
      if (!delivery) return null; // No delivery record exists
      if (delivery.otp_verified) return null; // can't regen after verified

      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error: updateErr } = await supabase
        .from('deliveries')
        .update({ otp: newOtp, otp_expires_at: newExpiry, updated_at: new Date().toISOString() })
        .eq('id', delivery.id);

      if (updateErr) throw updateErr;

      await fetchOrders();
      return newOtp;
    } catch (err) {
      console.error('[Orders] Error requesting new OTP:', err);
      return null;
    }
  };

  const requestPickupOtpForCustomer = async (orderId: string): Promise<string | null> => {
    try {
      // Generate pickup OTP directly in orders table for pickup-only orders
      const pickupOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const pickupExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          pickup_otp: pickupOtp, 
          pickup_otp_expires_at: pickupExpiresAt, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', orderId)
        .eq('customer_id', user?.id); // Security: only customer can update their own order

      if (updateError) throw updateError;

      await fetchOrders();
      return pickupOtp;
    } catch (err) {
      console.error('[Orders] Error requesting pickup OTP for customer:', err);
      return null;
    }
  };

  const requestPickupOtp = async (orderId: string): Promise<string | null> => {
    try {
      // fetch order and ensure it's a pickup order and not already verified
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('id, delivery_included, pickup_otp_verified')
        .eq('id', orderId)
        .single();

      if (orderErr || !order) throw orderErr || new Error('Order not found');
      // allow generation of pickup OTP for both pickup-only orders and
      // for driver pickup (delivery_included true) so drivers have a code
      // to present to restaurants when collecting items.
      if (order.pickup_otp_verified) return null; // already verified

      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error: updateErr } = await supabase
        .from('orders')
        .update({ pickup_otp: newOtp, pickup_otp_expires_at: newExpiry, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (updateErr) throw updateErr;
      await fetchOrders();
      return newOtp;
    } catch (err) {
      console.error('[Orders] Error requesting pickup OTP:', err);
      return null;
    }
  };

  const verifyPickupOtp = async (orderId: string, otpAttempt: string): Promise<boolean> => {
    try {
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('id, delivery_included, pickup_otp, pickup_otp_verified, pickup_otp_expires_at, status')
        .eq('id', orderId)
        .single();

      if (orderErr) throw orderErr;
      if (!order) return false;
      if (order.pickup_otp_verified) return false;
      if (!order.pickup_otp || order.pickup_otp !== otpAttempt) return false;
      if (order.pickup_otp_expires_at && new Date(order.pickup_otp_expires_at) < new Date()) return false;

      // mark pickup otp verified and move order to picked_up
      // Determine resulting status: for pickup orders (delivery_included = false)
      // verifying the OTP means the customer collected the order -> mark delivered.
      // For delivery flows (driver picking up), mark as 'picked_up'.
      const resultingStatus = (order.delivery_included === false) ? 'delivered' : 'picked_up';

      const { error: verifyErr } = await supabase
        .from('orders')
        .update({ pickup_otp_verified: true, status: resultingStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (verifyErr) throw verifyErr;

      await fetchOrders();
      return true;
    } catch (err) {
      console.error('[Orders] Error verifying pickup OTP:', err);
      return false;
    }
  };

  // Memoized fetch function to prevent excessive API calls
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase
        .from("orders")
        .select(`
          id,
          customer_id,
          restaurant_id,
          delivery_address,
          total_amount,
          delivery_fee,
          delivery_fee_base,
          delivery_fee_offer_customer,
          delivery_fee_offer_driver,
          delivery_fee_offer_by,
          delivery_fee_offer_updated_at,
          delivery_included,
          status,
          driver_id,
          created_at,
          updated_at,
          restaurants!orders_restaurant_id_fkey(name,address,phone,latitude,longitude),
          customer:user_profiles!orders_customer_id_fkey(id,full_name,phone,email,latitude,longitude),
          deliveries!deliveries_order_id_fkey(id, driver_id, otp, otp_verified, otp_expires_at, driver:user_profiles!deliveries_driver_id_fkey(full_name,phone)),
          order_driver_interest(id, driver_id, status, counter_offer, updated_at),
          pickup_otp,
          pickup_otp_verified,
          pickup_otp_expires_at,
          order_items (
            id,
            quantity,
            menu_id,
            menus (id, name, price, category, description)
          ),
          restaurant_lat,
          restaurant_lng,
          customer_lat,
          customer_lng
        `)
        .order("created_at", { ascending: false });

      // Filter based on role
      if (profile?.role === "driver") {
        // Drivers see: available orders + their assigned/active orders
        query = query.or(
          `and(status.eq.ready_for_pickup,delivery_included.eq.true),and(driver_id.eq.${user?.id},status.in.(assigned,heading_to_restaurant,arrived_at_restaurant,picked_up,heading_to_customer,arrived_at_customer))`
        );
      } else if (profile?.role === "customer") {
        if (user?.id) query = query.eq("customer_id", user.id);
      } else if (profile?.role === "restaurant") {
        if (profile?.id) {
          const { data: ownedRestaurants, error: restError } = await supabase
            .from("restaurants")
            .select("id")
            .eq("owner_id", profile.id);

          if (restError) {
            console.error("[Orders] Error fetching owned restaurants:", restError);
            return;
          }

          const restaurantIds = (ownedRestaurants ?? []).map((r) => r.id);

          if (restaurantIds.length > 0) {
            query = query.in("restaurant_id", restaurantIds);
          } else {
            setOrders([]);
            setLoading(false);
            return;
          }
        }
      }

      let { data, error } = await query;
      if (error) {
        // Retry without optional newer fields if migrations are not yet applied.
        const missingOptionalFields =
          (error.code === '42703' || error.code === '42P01') &&
          error.message &&
          (
            error.message.includes('pickup_otp') ||
            error.message.includes('delivery_fee_offer') ||
            error.message.includes('delivery_fee_base') ||
            error.message.includes('order_driver_interest')
          );

        if (missingOptionalFields) {
          let fallbackQuery = supabase
            .from('orders')
            .select(`
              id,
              customer_id,
              restaurant_id,
              delivery_address,
              total_amount,
              delivery_fee,
              delivery_included,
              status,
              driver_id,
              created_at,
              updated_at,
              restaurants!orders_restaurant_id_fkey(name,address,phone,latitude,longitude),
              customer:user_profiles!orders_customer_id_fkey(id,full_name,phone,email,latitude,longitude),
              deliveries!deliveries_order_id_fkey(id, driver_id, otp, otp_verified, otp_expires_at, driver:user_profiles!deliveries_driver_id_fkey(full_name,phone)),
              order_items (
                id,
                quantity,
                menu_id,
                menus (id, name, price, category, description)
              ),
              restaurant_lat,
              restaurant_lng,
              customer_lat,
              customer_lng
            `)
            .order('created_at', { ascending: false });

          // Re-apply role filters (same logic as above)
          if (profile?.role === 'driver') {
            fallbackQuery = fallbackQuery.eq('status', 'ready_for_pickup').eq('delivery_included', true);
          } else if (profile?.role === 'customer') {
            if (user?.id) fallbackQuery = fallbackQuery.eq('customer_id', user.id);
          } else if (profile?.role === 'restaurant') {
            if (profile?.id) {
              const { data: ownedRestaurants, error: restError } = await supabase
                .from('restaurants')
                .select('id')
                .eq('owner_id', profile.id);

              if (restError) {
                console.error('[Orders] Error fetching owned restaurants (fallback):', restError);
                setOrders([]);
                setLoading(false);
                return;
              }

              const restaurantIds = (ownedRestaurants ?? []).map((r) => r.id);
              if (restaurantIds.length > 0) fallbackQuery = fallbackQuery.in('restaurant_id', restaurantIds);
              else {
                setOrders([]);
                setLoading(false);
                return;
              }
            }
          }

          const fallbackRes = await fallbackQuery;
          data = fallbackRes.data as any[] | null;
          error = fallbackRes.error;
        }

        if (error) {
          console.error('[Orders] Error fetching orders:', error);
          setOrders([]);
          return;
        }
      }

      const normalized = (data ?? []).map(normalizeOrder);
      setOrders(normalized);
    } catch (err) {
      console.error("[Orders] Unexpected error:", err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, profile?.role, profile?.id]); // Add dependencies for memoization

  const fetchActiveDeliveries = useCallback(async () => {
    if (!user?.id) return [];

    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          customer_id,
          restaurant_id,
          delivery_address,
          total_amount,
          delivery_fee,
          delivery_fee_base,
          delivery_fee_offer_customer,
          delivery_fee_offer_driver,
          delivery_fee_offer_by,
          delivery_fee_offer_updated_at,
          status,
          driver_id,
          created_at,
          updated_at,
          delivery_included,
          pickup_otp,
          pickup_otp_verified,
          pickup_otp_expires_at,
          restaurants!orders_restaurant_id_fkey(name,address,phone,latitude,longitude),
          customer:user_profiles!orders_customer_id_fkey(id,full_name,phone,email,latitude,longitude),
          deliveries!deliveries_order_id_fkey(id, driver_id, otp, otp_verified, otp_expires_at, driver:user_profiles!deliveries_driver_id_fkey(full_name,phone)),
          order_driver_interest(id, driver_id, status, counter_offer, updated_at),
          order_items (
            id,
            quantity,
            menu_id,
            menus (id, name, price, category, description)
          ),
          restaurant_lat,
          restaurant_lng,
          customer_lat,
          customer_lng
        `)
        .eq("driver_id", user.id)
        .not("status", "eq", "ready_for_pickup")
        .order("created_at", { ascending: false });

      if (error) {
        const missingOptionalFields =
          (error.code === '42703' || error.code === '42P01') &&
          error.message &&
          (
            error.message.includes('delivery_fee_offer') ||
            error.message.includes('delivery_fee_base') ||
            error.message.includes('order_driver_interest')
          );

        if (missingOptionalFields) {
          const fallback = await supabase
            .from('orders')
            .select(`
              id,
              customer_id,
              restaurant_id,
              delivery_address,
              total_amount,
              delivery_fee,
              status,
              driver_id,
              created_at,
              updated_at,
              delivery_included,
              pickup_otp,
              pickup_otp_verified,
              pickup_otp_expires_at,
              restaurants!orders_restaurant_id_fkey(name,address,phone,latitude,longitude),
              customer:user_profiles!orders_customer_id_fkey(id,full_name,phone,email,latitude,longitude),
              deliveries!deliveries_order_id_fkey(id, driver_id, otp, otp_verified, otp_expires_at, driver:user_profiles!deliveries_driver_id_fkey(full_name,phone)),
              order_items (
                id,
                quantity,
                menu_id,
                menus (id, name, price, category, description)
              ),
              restaurant_lat,
              restaurant_lng,
              customer_lat,
              customer_lng
            `)
            .eq('driver_id', user.id)
            .not('status', 'eq', 'ready_for_pickup')
            .order('created_at', { ascending: false });

          if (fallback.error) {
            console.error('[Orders] Error fetching active deliveries (fallback):', fallback.error);
            return [];
          }

          return (fallback.data ?? []).map(normalizeOrder);
        }

        console.error("[Orders] Error fetching active deliveries:", error);
        return (data ?? []).map(normalizeOrder);
      }

      return (data ?? []).map(normalizeOrder);
    } catch (err) {
      console.error("[Orders] Unexpected error fetching active deliveries:", err);
      return [];
    }
  }, [user?.id]); // Add dependencies for memoization

  const updateOrderStatus = async (orderId: string, status: string): Promise<void> => {
    try {
      // Special handling for pickup-only orders transitioning to ready_for_pickup
      if (status === 'ready_for_pickup') {
        // Check if this is a pickup-only order and generate customer pickup OTP
        const { data: order, error: fetchError } = await supabase
          .from("orders")
          .select("id, delivery_included, pickup_otp")
          .eq("id", orderId)
          .single();

        if (!fetchError && order && !order.delivery_included) {
          // This is a pickup-only order - generate customer pickup OTP if not already set
          if (!order.pickup_otp) {
            const customerOtp = Math.floor(100000 + Math.random() * 900000).toString();
            const otpExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            // Update the order with customer pickup OTP
            const { error: updateOtpError } = await supabase
              .from("orders")
              .update({
                pickup_otp: customerOtp,
                pickup_otp_expires_at: otpExpiresAt
              })
              .eq("id", orderId);

            if (updateOtpError) {
              console.error("[Orders] Error generating customer pickup OTP:", updateOtpError);
            }
          }
        }
      }

      const { error: orderError } = await supabase
        .from("orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", orderId);

      const data = await fetchActiveDeliveries();
      setActiveDeliveries(data);

      if (orderError) {
        console.error("[Orders] Error updating order status:", orderError);
        throw orderError;
      }

      await fetchOrders();
    } catch (err) {
      console.error("[Orders] Unexpected error in updateOrderStatus:", err);
      throw err;
    }
  };

  const sanitizeOfferAmount = (amount: number): number => {
    const safe = Number.isFinite(amount) ? amount : 0;
    const rounded = Math.round(safe * 100) / 100;
    return Math.max(5, Math.min(rounded, 500));
  };

  const markOrderViewed = async (orderId: string): Promise<void> => {
    try {
      if (!user?.id || profile?.role !== 'driver') return;

      await supabase
        .from('order_driver_interest')
        .upsert(
          {
            order_id: orderId,
            driver_id: user.id,
            status: 'viewed',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'order_id,driver_id' }
        );
    } catch (err) {
      console.error('[Orders] Error marking order viewed:', err);
    }
  };

  const submitDriverOffer = async (orderId: string, amount: number): Promise<void> => {
    try {
      if (!user?.id || profile?.role !== 'driver') throw new Error('Only drivers can submit offers');
      const offer = sanitizeOfferAmount(amount);

      const { error: orderErr } = await supabase
        .from('orders')
        .update({
          delivery_fee_offer_driver: offer,
          delivery_fee_offer_by: 'driver',
          delivery_fee_offer_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('delivery_included', true)
        .eq('status', 'ready_for_pickup')
        .is('driver_id', null);

      if (orderErr) throw orderErr;

      await supabase
        .from('order_driver_interest')
        .upsert(
          {
            order_id: orderId,
            driver_id: user.id,
            status: 'countered',
            counter_offer: offer,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'order_id,driver_id' }
        );

      await fetchOrders();
    } catch (err) {
      console.error('[Orders] Error submitting driver offer:', err);
      throw err;
    }
  };

  const submitCustomerOffer = async (orderId: string, amount: number): Promise<void> => {
    try {
      if (!user?.id || profile?.role !== 'customer') throw new Error('Only customers can submit offers');
      const offer = sanitizeOfferAmount(amount);

      const { error } = await supabase
        .from('orders')
        .update({
          delivery_fee_offer_customer: offer,
          delivery_fee_offer_by: 'customer',
          delivery_fee_offer_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('customer_id', user.id)
        .eq('delivery_included', true)
        .is('driver_id', null)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready_for_pickup']);

      if (error) throw error;
      await fetchOrders();
    } catch (err) {
      console.error('[Orders] Error submitting customer offer:', err);
      throw err;
    }
  };

  const acceptDriverOffer = async (orderId: string): Promise<void> => {
    try {
      if (!user?.id || profile?.role !== 'customer') throw new Error('Only customers can accept driver offers');

      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('id, customer_id, driver_id, delivery_included, delivery_fee_offer_driver')
        .eq('id', orderId)
        .single();

      if (fetchError || !order) throw fetchError || new Error('Order not found');
      if (order.customer_id !== user.id) throw new Error('Unauthorized');
      if (order.driver_id) throw new Error('Order already accepted by a driver');
      if (!order.delivery_included) throw new Error('Only delivery orders can negotiate fee');
      if (order.delivery_fee_offer_driver == null) throw new Error('No driver offer to accept');

      const acceptedFee = sanitizeOfferAmount(Number(order.delivery_fee_offer_driver));

      const { error } = await supabase
        .from('orders')
        .update({
          delivery_fee: acceptedFee,
          delivery_fee_offer_customer: acceptedFee,
          delivery_fee_offer_by: 'customer',
          delivery_fee_offer_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('customer_id', user.id)
        .is('driver_id', null);

      if (error) throw error;
      await fetchOrders();
    } catch (err) {
      console.error('[Orders] Error accepting driver offer:', err);
      throw err;
    }
  };

  const acceptOrder = async (orderId: string, driverId: string, agreedFee?: number): Promise<void> => {
    if (!orderId) throw new Error("acceptOrder: missing orderId");
    if (!driverId) throw new Error("acceptOrder: missing driverId");

    try {
      const { data: current, error: fetchErr } = await supabase
        .from("orders")
        .select("id, status, delivery_fee, delivery_fee_offer_customer")
        .eq("id", orderId)
        .single();

      if (fetchErr) throw fetchErr;
      if (!current) throw new Error("Order not found");
      if (current.status !== "ready_for_pickup") {
        throw new Error("Order is no longer available for pickup");
      }

      const resolvedFee = sanitizeOfferAmount(
        agreedFee ?? current.delivery_fee_offer_customer ?? current.delivery_fee
      );

      // generate a 6-digit OTP for delivery confirmation (customer gives to driver)
      const deliveryOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const deliveryExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

      // generate a 6-digit pickup OTP for restaurant confirmation (driver shows to restaurant)
      const pickupOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const pickupExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

      const { data: deliveryRow, error: deliveryError } = await supabase
        .from("deliveries")
        .insert([{ order_id: orderId, driver_id: driverId, status: "assigned", otp: deliveryOtp, otp_expires_at: deliveryExpiresAt }])
        .select("id, otp, otp_expires_at")
        .single();

      if (deliveryError) throw deliveryError;

      const { data: updatedOrder, error: orderError } = await supabase
        .from("orders")
        .update({
          status: "assigned",
          driver_id: driverId,
          delivery_fee: resolvedFee,
          pickup_otp: pickupOtp,
          pickup_otp_expires_at: pickupExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("status", "ready_for_pickup")
        .select("id")
        .single();

      if (orderError) {
        if (deliveryRow?.id) await supabase.from("deliveries").delete().eq("id", deliveryRow.id);
        throw orderError;
      }

      if (!updatedOrder && deliveryRow?.id) {
        await supabase.from("deliveries").delete().eq("id", deliveryRow.id);
        throw new Error("Order was already claimed by another driver.");
      }

      // Generate a pickup OTP for the driver to present to the restaurant when collecting
      try {
        const newPickupOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const newPickupExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        // Only set if not already verified
        await supabase.from('orders').update({ pickup_otp: newPickupOtp, pickup_otp_expires_at: newPickupExpiry, updated_at: new Date().toISOString() }).eq('id', orderId).neq('pickup_otp_verified', true);
      } catch (err) {
        console.error('[Orders] Failed to set pickup OTP during acceptOrder:', err);
      }

      await supabase
        .from('order_driver_interest')
        .upsert(
          {
            order_id: orderId,
            driver_id: driverId,
            status: 'accepted',
            counter_offer: resolvedFee,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'order_id,driver_id' }
        );

      await fetchOrders();
    } catch (err) {
      console.error("[Orders] Error accepting order:", err);
      throw err;
    }
  };

  const verifyOtp = async (orderId: string, otpAttempt: string): Promise<boolean> => {
    try {
      // find the latest delivery for the order
      const { data: delivery, error: fetchDeliveryError } = await supabase
        .from('deliveries')
        .select('id, order_id, otp, otp_verified, otp_expires_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchDeliveryError) throw fetchDeliveryError;
      if (!delivery) return false;
      if (delivery.otp_verified) return false; // already used
      if (!delivery.otp || delivery.otp !== otpAttempt) return false;
      if (delivery.otp_expires_at && new Date(delivery.otp_expires_at) < new Date()) return false;

      // mark otp verified and mark order delivered
      const { error: verifyError } = await supabase
        .from('deliveries')
        .update({ otp_verified: true, updated_at: new Date().toISOString(), status: 'delivered', delivery_time: new Date().toISOString() })
        .eq('id', delivery.id);

      if (verifyError) throw verifyError;

      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'delivered', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (orderError) throw orderError;

      //  ✅ Record earnings using delivery.id
      try {
        // fetch the delivery record including driver_id and any order info
        const { data: deliveryFull, error: dErr } = await supabase
          .from('deliveries')
          .select('id, driver_id, order_id')
          .eq('id', delivery.id)
          .single();

        if (!dErr && deliveryFull) {
          const userDriverId = deliveryFull.driver_id ?? null; // This is user_profiles.id

          // Get the actual drivers.id for the earnings table
          let actualDriverId = null;
          if (userDriverId) {
            const { data: driverRecord, error: driverErr } = await supabase
              .from('drivers')
              .select('id')
              .eq('user_id', userDriverId)
              .single();
              
            if (!driverErr && driverRecord) {
              actualDriverId = driverRecord.id;
            }
          }

          // fetch order to get delivery_fee
          const { data: orderRow } = await supabase
            .from('orders')
            .select('id, delivery_fee')
            .eq('id', orderId)
            .single();

          const baseFee = orderRow?.delivery_fee ?? 0;

          // Only create earnings if we have a valid driver record
          if (actualDriverId) {
            const { error: earningsError } = await supabase.from('earnings').insert([
              {
                driver_id: actualDriverId, // Use drivers.id not user_profiles.id
                delivery_id: deliveryFull.id,
                amount: baseFee, // Use 'amount' column not 'base_fee'
                created_at: new Date().toISOString(),
              },
            ]);

            if (earningsError) {
              console.error('[Orders] Error inserting earnings:', earningsError);
              console.error('[Orders] Driver ID:', actualDriverId, 'Amount:', baseFee);
            } else {
              console.log('[Orders] ✅ Earnings recorded successfully for driver:', actualDriverId, 'Amount:', baseFee);
            }
          } else {
            console.warn('[Orders] ⚠️ No driver record found for user_id:', userDriverId);
          }

          // update driver total_deliveries count using user_id
          if (userDriverId) {
            const { data: driverData, error: driverFetchErr } = await supabase
              .from('drivers')
              .select('total_deliveries')
              .eq('user_id', userDriverId) // Use user_id to find the driver
              .single();

            if (!driverFetchErr && driverData) {
              const currentTotal = driverData.total_deliveries || 0;
              await supabase.from('drivers').update({ total_deliveries: currentTotal + 1 }).eq('user_id', userDriverId);
              console.log('[Orders] ✅ Updated driver total_deliveries to:', currentTotal + 1);
            }
          }
        }

      } catch (err) {
        console.error('[Orders] Error recording earnings after OTP verification:', err);
      }

      // refresh local state
      await fetchOrders();
      const active = await fetchActiveDeliveries();
      setActiveDeliveries(active);

      return true;
    } catch (err) {
      console.error('[Orders] Error verifying OTP:', err);
      return false;
    }
  };

  useEffect(() => {
    if (user) fetchOrders();
    else {
      setOrders([]);
      setLoading(false);
    }
  }, [user?.id, profile?.role]);

  useEffect(() => {
    if (profile?.role === "driver" && user?.id) {
      const loadActiveDeliveries = async () => {
        const data = await fetchActiveDeliveries();
        setActiveDeliveries(data);
      };
      loadActiveDeliveries();
    }
  }, [user?.id, profile?.role]);

  useEffect(() => {
  if (!user || !profile?.role) return;

  // Add debouncing to prevent excessive API calls
  let timeoutId: NodeJS.Timeout | null = null;
  
  const debouncedFetchOrders = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      try {
        await fetchOrders();
      } catch (err) {
        console.error("[Orders] Error fetching orders on realtime update:", err);
      }
    }, 500); // 500ms debounce
  };

  const subscription = supabase
    .channel("orders-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      debouncedFetchOrders
    )
    .subscribe();

  const interestSubscription = supabase
    .channel('order-driver-interest-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'order_driver_interest' },
      debouncedFetchOrders
    )
    .subscribe();

  // cleanup
  return () => {
    if (timeoutId) clearTimeout(timeoutId);
    supabase.removeChannel(subscription);
    supabase.removeChannel(interestSubscription);
  };
}, [user?.id, profile?.role, fetchOrders]); // Add fetchOrders dependency

  return (
    <OrdersContext.Provider
      value={{ orders, loading, refreshOrders: fetchOrders, updateOrderStatus, acceptOrder, markOrderViewed, submitDriverOffer, submitCustomerOffer, acceptDriverOffer, verifyOtp, requestNewOtp, requestPickupOtp, requestPickupOtpForCustomer, verifyPickupOtp, activeDeliveries }}
    >
      {children}
    </OrdersContext.Provider>
  );
};

export const useOrders = () => {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within an OrdersProvider");
  return ctx;
};