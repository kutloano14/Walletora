import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

// 👇 Delivery row from Supabase
export interface Delivery {
  id: string;
  order_id: string;
  driver_id: string | null;
  status: string;
  created_at: string;
}

// 👇 Extended with order details (for driver dashboard)
export interface DeliveryWithOrder extends Delivery {
  orders?: {
    id: string;
    delivery_address: string;
    total_amount: number;
    delivery_fee: number;
    delivery_included: boolean;
    status: string;
    created_at: string;
    restaurants: { name: string ; address?: string;} | null;
    customer: { full_name: string } | null;
  };
}

interface DeliveryContextType {
  deliveries: DeliveryWithOrder[];
  loading: boolean;
  refreshDeliveries: () => Promise<void>;
  completeDelivery: (deliveryId: string) => Promise<void>;
}

const DeliveryContext = createContext<DeliveryContextType | undefined>(
  undefined
);

export const DeliveryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, profile } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryWithOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // 🛠 Normalize function
  const normalizeDelivery = (d: any): DeliveryWithOrder => {
    const order = Array.isArray(d.orders) ? d.orders[0] ?? null : d.orders ?? null;
    const restaurants = order?.restaurants
      ? Array.isArray(order.restaurants)
        ? order.restaurants[0] ?? null
        : order.restaurants
      : null;
    const restaurantWithAddress = restaurants
      ? {
          name: restaurants.name,
          address: restaurants.address || "Address not provided",
        }
      : null;
    const customer = order?.customer
      ? Array.isArray(order.customer)
        ? order.customer[0] ?? null
        : order.customer
      : null;

    return {
      id: d.id,
      order_id: d.order_id,
      driver_id: d.driver_id,
      status: d.status,
      created_at: d.created_at,
      orders: order
        ? {
            id: order.id,
            delivery_address: order.delivery_address,
            total_amount: order.total_amount,
            delivery_fee: order.delivery_fee,
            delivery_included: order.delivery_included,
            status: order.status,
            created_at: order.created_at,
            restaurants: restaurantWithAddress,
            customer,
          }
        : undefined,
    };
  };

  // 🔄 Fetch deliveries
  const refreshDeliveries = async () => {
    try {
      setLoading(true);

      // Add explicit driver_id filter for safety
      // This ensures we only get THIS driver's deliveries
      // even if RLS policies aren't working correctly
      let query = supabase
        .from("deliveries")
        .select(
          `
          id,
          order_id,
          driver_id,
          status,
          created_at,
          orders:orders!deliveries_order_id_fkey (
            id,
            delivery_address,
            total_amount,
            delivery_fee,
            status,
            created_at,
            restaurants!orders_restaurant_id_fkey(name ,address),
            customer:user_profiles!orders_customer_id_fkey(full_name)
          )
        `
        );

      // CRITICAL: Add explicit filter for current driver's deliveries
      if (user?.id) {
        query = query.eq("driver_id", user.id);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[DeliveryContext] Error fetching deliveries:", error);
        setDeliveries([]);
        return;
      }

      const normalized: DeliveryWithOrder[] = (data ?? [])
        .map(normalizeDelivery)
        .filter((d) => d.orders?.delivery_included);
      
      setDeliveries(normalized);
    } catch (err) {
      console.error("[DeliveryContext] Unexpected error:", err);
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Complete delivery (driver action)
  const completeDelivery = async (deliveryId: string): Promise<void> => {
    try {
      if (!user?.id) throw new Error("User not logged in");

      // Fetch delivery info
      const { data: deliveryData, error: deliveryErr } = await supabase
        .from("deliveries")
        .select(
          `
          id,
          order_id,
          driver_id,
          status,
          orders:orders!deliveries_order_id_fkey (
            id,
            delivery_fee,
            total_amount,
            status
          )
        `
        )
        .eq("id", deliveryId)
        .single();

      if (deliveryErr || !deliveryData) throw deliveryErr || new Error("Delivery not found");

      const order = Array.isArray(deliveryData.orders)
        ? deliveryData.orders[0]
        : deliveryData.orders;

      if (!order) throw new Error("Order data missing in delivery record");

      const driverId = deliveryData.driver_id;

      // 1️⃣ Update delivery to "completed"
      const { error: updateDeliveryErr } = await supabase
        .from("deliveries")
        .update({
          status: "completed",
          delivery_time: new Date().toISOString(),
        })
        .eq("id", deliveryId);

      if (updateDeliveryErr) throw updateDeliveryErr;

      // 2️⃣ Update order to "delivered"
      const { error: updateOrderErr } = await supabase
        .from("orders")
        .update({
          status: "delivered",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (updateOrderErr) throw updateOrderErr;

      // 3️⃣ Insert into earnings
      const baseFee = order.delivery_fee || 0;
      const tipAmount = 0; // change if tipping system added
      const totalEarned = baseFee + tipAmount;
      
      // Get the actual drivers.id for the earnings table
      let actualDriverId = null;
      if (driverId) {
        const { data: driverRecord, error: driverErr } = await supabase
          .from('drivers')
          .select('id')
          .eq('user_id', driverId)
          .single();
          
        if (!driverErr && driverRecord) {
          actualDriverId = driverRecord.id;
        }
      }

      if (actualDriverId) {
        const { error: earningsErr } = await supabase.from("earnings").insert([
          {
            driver_id: actualDriverId, // Use drivers.id not user_profiles.id
            delivery_id: deliveryId,
            amount: totalEarned, // Use 'amount' column
            created_at: new Date().toISOString(),
          },
        ]);

        if (earningsErr) {
          console.error('[DeliveryContext] Error inserting earnings:', earningsErr);
          console.error('[DeliveryContext] Driver ID:', actualDriverId, 'Total Earned:', totalEarned);
          throw earningsErr;
        }
      } else {
        console.warn('[DeliveryContext] ⚠️ No driver record found for user_id:', driverId);
      }

      // 4️⃣ Increment driver total deliveries safely
      const { data: driverData, error: driverFetchErr } = await supabase
        .from("drivers")
        .select("total_deliveries")
        .eq("user_id", driverId) // Use user_id instead of id
        .single();

      if (!driverFetchErr && driverData) {
        const currentTotal = driverData.total_deliveries || 0;
        await supabase
          .from("drivers")
          .update({ total_deliveries: currentTotal + 1 })
          .eq("user_id", driverId); // Use user_id instead of id
      }

      await refreshDeliveries();
    } catch (err) {
      console.error("[DeliveryContext] Error completing delivery:", err);
    }
  };

  // load deliveries on driver login
  useEffect(() => {
    if (user && profile?.role === "driver") {
      refreshDeliveries();
    }
  }, [user?.id, profile?.role]);

  // 🔄 Real-time subscription
  useEffect(() => {
    if (!user || profile?.role !== "driver") return;

    const channel = supabase
      .channel("deliveries-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries" },
        () => {
          refreshDeliveries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, profile?.role]);

  return (
    <DeliveryContext.Provider
      value={{ deliveries, loading, refreshDeliveries, completeDelivery }}
    >
      {children}
    </DeliveryContext.Provider>
  );
};

export const useDeliveries = () => {
  const ctx = useContext(DeliveryContext);
  if (!ctx) throw new Error("useDeliveries must be used within a DeliveryProvider");
  return ctx;
};