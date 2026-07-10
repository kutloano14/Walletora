import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { PaystackButton } from "react-paystack";
import { calculateDistance } from "../../utils/distance";
import {
  calculateDeliveryFeeFromCart,
  type DeliveryFeeBreakdown,
} from "../../utils/deliveryPricing";
import { getCurrentPosition, reverseGeocode } from "../../utils/location";

interface CheckoutPageProps {
  cart: any[];
  selectedRestaurant?: any;
  onOrderPlaced?: () => void;
}

export default function CheckoutPage({ cart, selectedRestaurant, onOrderPlaced }: CheckoutPageProps) {
  const { user } = useAuth();
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [includeDelivery, setIncludeDelivery] = useState(true); // ✅ New state for checkbox
  const [feeBreakdown, setFeeBreakdown] = useState<DeliveryFeeBreakdown | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [locationDescription, setLocationDescription] = useState("");
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [walletEnabled, setWalletEnabled] = useState(false);
  const [externalPaymentLoading, setExternalPaymentLoading] = useState(false);
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_live_production_key_here";
  const userEmail = user?.email || "customer@walletora.com";

  const formatClosingTime = (closingTime?: string | null) => {
    if (!closingTime) return null;
    const [hours, minutes] = String(closingTime).split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    const dt = new Date();
    dt.setHours(hours, minutes, 0, 0);
    return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const getRestaurantAvailability = (restaurant?: any) => {
    if (!restaurant) {
      return {
        isClosed: false,
        isClosingSoon: false,
        message: '',
      };
    }

    if (restaurant.is_temporarily_closed) {
      return {
        isClosed: true,
        isClosingSoon: false,
        message: 'This restaurant is currently closed.',
      };
    }

    if (!restaurant.closing_time) {
      return {
        isClosed: false,
        isClosingSoon: false,
        message: 'Restaurant is open.',
      };
    }

    const [hours, minutes] = String(restaurant.closing_time).split(':').map(Number);
    const now = new Date();
    const closesAt = new Date(now);
    closesAt.setHours(hours, minutes, 0, 0);
    const minutesUntilClose = Math.round((closesAt.getTime() - now.getTime()) / 60000);
    const closingLabel = formatClosingTime(restaurant.closing_time);

    if (minutesUntilClose <= 0) {
      return {
        isClosed: true,
        isClosingSoon: false,
        message: 'This restaurant is closed for today.',
      };
    }

    if (minutesUntilClose <= 60) {
      return {
        isClosed: false,
        isClosingSoon: true,
        message: `Closing soon. Closes at ${closingLabel}.`,
      };
    }

    return {
      isClosed: false,
      isClosingSoon: false,
      message: `Closes at ${closingLabel}.`,
    };
  };

  const availability = getRestaurantAvailability(selectedRestaurant);
  const checkoutTotal = Math.max(0, itemsTotal + deliveryFee);

  // Calculate items total with quantities
  useEffect(() => {
    const total = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    setItemsTotal(total);
  }, [cart]);

  // Calculate delivery fee
  useEffect(() => {
    const fetchDeliveryFee = async () => {
      if (!selectedRestaurant || !user) return;

      if (!includeDelivery) { // ✅ Skip delivery if unchecked
        setDeliveryFee(0);
        setFeeBreakdown(null);
        return;
      }

      const { data: customerProfile, error } = await supabase
        .from("user_profiles")
        .select("latitude, longitude, address")
        .eq("id", user.id)
        .single();

      const distanceKm =
        error || !customerProfile || customerProfile.latitude == null || customerProfile.longitude == null
          ? 0
          : calculateDistance(
              selectedRestaurant.latitude,
              selectedRestaurant.longitude,
              customerProfile.latitude,
              customerProfile.longitude
            );

      const breakdown = calculateDeliveryFeeFromCart(distanceKm, cart);

      // Prefer DB-side calculation when function exists, but keep a local fallback.
      const { data: feeFromDb } = await supabase.rpc("calculate_dynamic_delivery_fee", {
        p_distance_km: breakdown.distanceKm,
        p_total_units: breakdown.totalUnits,
        p_estimated_weight_kg: breakdown.estimatedWeightKg,
      });

      if (typeof feeFromDb === "number" && Number.isFinite(feeFromDb)) {
        setDeliveryFee(Math.round(feeFromDb * 100) / 100);
      } else {
        setDeliveryFee(breakdown.fee);
      }

      setFeeBreakdown(breakdown);
    };

    fetchDeliveryFee();
  }, [selectedRestaurant, user, includeDelivery, cart]); // ✅ added includeDelivery + cart

  useEffect(() => {
    const fetchWalletSetting = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("wallet_enabled")
        .eq("id", 1)
        .single();

      if (!error && data) {
        setWalletEnabled(Boolean((data as any).wallet_enabled));
      } else {
        // Operational fallback for now: keep wallet disabled and use Paystack checkout path.
        setWalletEnabled(false);
      }
    };

    fetchWalletSetting();
  }, [user?.id]);

const handlePlaceOrder = async () => {
  if (!cart.length || !selectedRestaurant || !user) return;

  if (!walletEnabled) {
    alert("Wallet is temporarily disabled. Please use the checkout payment button below to complete your order.");
    return;
  }

  if (availability.isClosed) {
    alert('This restaurant is currently closed. Please choose another restaurant or try again later.');
    return;
  }

  if (includeDelivery && !deliveryAddress.trim()) {
    alert("Please add your delivery address or use current location.");
    return;
  }

  // Hoist vars so catch()/finally can reference them
  let totalItems = 0;
  let total = 0;
  let newOrderId: string | null = null;

  totalItems = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
  total = totalItems + deliveryFee;

  try {
    // Re-check latest restaurant status before charging wallet.
    const { data: latestRestaurant, error: latestRestaurantError } = await supabase
      .from('restaurants')
      .select('is_temporarily_closed, closing_time')
      .eq('id', selectedRestaurant.id)
      .single();

    if (!latestRestaurantError && latestRestaurant) {
      const latestAvailability = getRestaurantAvailability(latestRestaurant);
      if (latestAvailability.isClosed) {
        alert('This restaurant has just closed. Your order was not charged.');
        return;
      }
    }

    // ✅ 1. Check stock
    const outOfStockItems: { name: string; available: number }[] = [];
    for (const item of cart) {
      const { data: menuItem, error } = await supabase
        .from("menus")
        .select("quantity, name")
        .eq("id", item.id)
        .single();

      if (error || !menuItem) {
        outOfStockItems.push({ name: item.name, available: 0 });
      } else if (menuItem.quantity < (item.quantity || 1)) {
        outOfStockItems.push({ name: item.name, available: menuItem.quantity });
      }
    }

    if (outOfStockItems.length > 0) {
      const message = outOfStockItems
        .map(i => `${i.name} (Available: ${i.available})`)
        .join("\n");
      alert(`Some items are out of stock:\n${message}`);
      return;
    }

    // ✅ 2. Fetch wallet
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (walletError || !wallet) throw new Error("Wallet not found");

    let latestLat: number | null = null;
    let latestLng: number | null = null;
    let latestAddress = deliveryAddress.trim();

    if (includeDelivery) {
      try {
        const coords = await getCurrentPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
        latestLat = coords.latitude;
        latestLng = coords.longitude;
        if (!latestAddress) {
          try {
            latestAddress = await reverseGeocode({ latitude: coords.latitude, longitude: coords.longitude });
          } catch {
            latestAddress = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
          }
        }

        await supabase
          .from("user_profiles")
          .update({
            latitude: latestLat,
            longitude: latestLng,
            address: latestAddress,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      } catch (geoError) {
        console.warn("Could not refresh current location before order placement:", geoError);
      }
    }

    // If wallet has insufficient funds, charge an 'insufficient_funds' penalty (option 2)
    if (wallet.balance < total) {
      const penaltyFee = 10; // default penalty (R10) — change if you want a different amount
      let appliedType = 'insufficient_funds';

      try {
        // Try to insert penalty with the preferred type
        const { error: penErr } = await supabase.from('wallet_transactions').insert({
          wallet_id: wallet.id,
          type: appliedType,
          amount: penaltyFee,
          description: `Insufficient funds penalty for attempted order at ${selectedRestaurant?.name || 'restaurant'}`,
        });

        // If the insert failed due to a CHECK constraint (type not allowed), fall back to an allowed type
        if (penErr) {
          const code = (penErr as any)?.code || '';
          const msg = (penErr as any)?.message || '';
          if (code === '23514' || /check constraint/i.test(msg)) {
            appliedType = 'overdraft_fee'; // fallback to existing allowed type
            const { error: penErr2 } = await supabase.from('wallet_transactions').insert({
              wallet_id: wallet.id,
              type: appliedType,
              amount: penaltyFee,
              description: `Insufficient funds penalty (fallback) for attempted order at ${selectedRestaurant?.name || 'restaurant'}`,
            });
            if (penErr2) throw penErr2;
          } else {
            throw penErr;
          }
        }

        // Update wallet balance to charge the penalty (allow negative balances)
        const newBalanceAfterPenalty = Math.round((wallet.balance - penaltyFee) * 100) / 100;
        const { error: updatePenaltyError } = await supabase
          .from('wallets')
          .update({ balance: newBalanceAfterPenalty })
          .eq('id', wallet.id);
        if (updatePenaltyError) throw updatePenaltyError;

        alert(`Insufficient funds: a penalty of R${penaltyFee.toFixed(2)} has been charged to your wallet as '${appliedType}'. Please top up your wallet to place the order.`);
        return;
      } catch (penaltyErr) {
        console.error('Failed to apply insufficient funds penalty:', penaltyErr);
        alert('Insufficient funds and penalty application failed. Please top up your wallet or contact support.');
        return;
      }
    }

    // ✅ 3. Create order first
    let newOrderData: any[] | null = null;
    let newOrderError: any = null;

    const createOrderPayload: Record<string, any> = {
      customer_id: user.id,
      restaurant_id: selectedRestaurant.id,
      status: "pending",
      total_amount: totalItems,
      delivery_fee: deliveryFee,
      delivery_included: includeDelivery,
      delivery_address: includeDelivery ? latestAddress || "Address not provided" : "Pickup at restaurant",
      special_instructions: locationDescription.trim(),
      delivery_lat: includeDelivery ? latestLat : null,
      delivery_lng: includeDelivery ? latestLng : null,
      delivery_location_description: locationDescription.trim() || null,
    };

    if (includeDelivery) {
      createOrderPayload.delivery_fee_base = deliveryFee;
      createOrderPayload.delivery_fee_offer_customer = deliveryFee;
      createOrderPayload.delivery_fee_offer_by = "customer";
      createOrderPayload.delivery_fee_offer_updated_at = new Date().toISOString();
    }

    const firstInsert = await supabase.from("orders").insert(createOrderPayload).select();
    newOrderData = firstInsert.data;
    newOrderError = firstInsert.error;

    // Compatibility fallback if migration is not yet applied.
    if (newOrderError && String(newOrderError.message || '').includes('delivery_fee_offer')) {
      const fallbackInsert = await supabase
        .from("orders")
        .insert({
          customer_id: user.id,
          restaurant_id: selectedRestaurant.id,
          status: "pending",
          total_amount: totalItems,
          delivery_fee: deliveryFee,
          delivery_included: includeDelivery,
          delivery_address: includeDelivery ? latestAddress || "Address not provided" : "Pickup at restaurant",
          special_instructions: locationDescription.trim(),
          delivery_lat: includeDelivery ? latestLat : null,
          delivery_lng: includeDelivery ? latestLng : null,
          delivery_location_description: locationDescription.trim() || null,
        })
        .select();

      newOrderData = fallbackInsert.data;
      newOrderError = fallbackInsert.error;
    }

    if (newOrderError || !newOrderData?.length) throw newOrderError;

  newOrderId = newOrderData[0].id;

    // ✅ 4. Create wallet transaction(s) for this order
    // Insert payment transaction
    const txnsToInsert: any[] = [
      {
        wallet_id: wallet.id,
        order_id: newOrderId,
        restaurant_id: selectedRestaurant.id,
        type: "payment",
        amount: total,
        description: `Payment for order #${newOrderId} at ${selectedRestaurant.name}`,
      },
    ];

    // no overdraft allowed — only insert payment transaction

    const { error: txnError } = await supabase.from("wallet_transactions").insert(txnsToInsert);
    if (txnError) throw txnError;

    // ✅ 5. Update wallet balance
    const newBalanceAfter = Math.round((wallet.balance - total) * 100) / 100;
    const { error: updateError } = await supabase
      .from("wallets")
      .update({ balance: newBalanceAfter })
      .eq("id", wallet.id);

    if (updateError) throw updateError;

    // ✅ 6. Insert order items
    const orderItems = cart.map(item => ({
      order_id: newOrderId,
      menu_id: item.id,
      quantity: item.quantity || 1,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
    if (itemsError) throw itemsError;

    // ✅ 7. Decrease stock for each item
    for (const item of cart) {
      await supabase.rpc("decrease_stock", {
        menu_id: item.id,
        qty_to_subtract: item.quantity || 1,
      });
    }

    alert(`Order placed! Total: R${total.toFixed(2)} (Delivery: R${deliveryFee.toFixed(2)}). New balance: R${newBalanceAfter.toFixed(2)}.`);
    if (onOrderPlaced) onOrderPlaced();

  } catch (err) {
    console.error("❌ Order failed:", err);

    // ✅ 8. Refund if anything goes wrong — attempt to reverse payment and overdraft fee
    try {
      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();

        if (wallet && !walletError) {
          // Insert refund txn for payment
          await supabase.from("wallet_transactions").insert({
            wallet_id: wallet.id,
            type: "refund",
            amount: total,
            description: `Refund for failed order at ${selectedRestaurant?.name || "restaurant"}`,
          });

          // Update wallet balance to reverse amounts (note: wallet variable may be stale but best-effort)
          const revertAmount = Math.round(total * 100) / 100;
          await supabase
            .from("wallets")
            .update({ balance: wallet.balance + revertAmount })
            .eq("id", wallet.id);
        }
    } catch (refundErr) {
      console.error("Refund failed:", refundErr);
    }

    alert("Failed to place order. Attempted to refund wallet (check transactions). If you see any issues contact support.");
  }
};

const handleCheckoutPaymentSuccess = async (reference?: any) => {
  if (!cart.length || !selectedRestaurant || !user) return;

  if (availability.isClosed) {
    alert('This restaurant is currently closed. Please choose another restaurant or try again later.');
    return;
  }

  if (includeDelivery && !deliveryAddress.trim()) {
    alert("Please add your delivery address or use current location.");
    return;
  }

  setExternalPaymentLoading(true);

  try {
    const { data: latestRestaurant, error: latestRestaurantError } = await supabase
      .from('restaurants')
      .select('is_temporarily_closed, closing_time')
      .eq('id', selectedRestaurant.id)
      .single();

    if (!latestRestaurantError && latestRestaurant) {
      const latestAvailability = getRestaurantAvailability(latestRestaurant);
      if (latestAvailability.isClosed) {
        alert('This restaurant has just closed. Your payment was received, but the order was not submitted. Please contact support.');
        return;
      }
    }

    const outOfStockItems: { name: string; available: number }[] = [];
    for (const item of cart) {
      const { data: menuItem, error } = await supabase
        .from("menus")
        .select("quantity, name")
        .eq("id", item.id)
        .single();

      if (error || !menuItem) {
        outOfStockItems.push({ name: item.name, available: 0 });
      } else if (menuItem.quantity < (item.quantity || 1)) {
        outOfStockItems.push({ name: item.name, available: menuItem.quantity });
      }
    }

    if (outOfStockItems.length > 0) {
      const message = outOfStockItems.map(i => `${i.name} (Available: ${i.available})`).join("\n");
      alert(`Some items are out of stock:\n${message}`);
      return;
    }

    let latestLat: number | null = null;
    let latestLng: number | null = null;
    let latestAddress = deliveryAddress.trim();

    if (includeDelivery) {
      try {
        const coords = await getCurrentPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
        latestLat = coords.latitude;
        latestLng = coords.longitude;
        if (!latestAddress) {
          try {
            latestAddress = await reverseGeocode({ latitude: coords.latitude, longitude: coords.longitude });
          } catch {
            latestAddress = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
          }
        }

        await supabase
          .from("user_profiles")
          .update({
            latitude: latestLat,
            longitude: latestLng,
            address: latestAddress,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      } catch (geoError) {
        console.warn("Could not refresh current location before order placement:", geoError);
      }
    }

    const totalItems = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);

    let newOrderData: any[] | null = null;
    let newOrderError: any = null;

    const createOrderPayload: Record<string, any> = {
      customer_id: user.id,
      restaurant_id: selectedRestaurant.id,
      status: "pending",
      total_amount: totalItems,
      delivery_fee: deliveryFee,
      delivery_included: includeDelivery,
      delivery_address: includeDelivery ? latestAddress || "Address not provided" : "Pickup at restaurant",
      special_instructions: locationDescription.trim(),
      delivery_lat: includeDelivery ? latestLat : null,
      delivery_lng: includeDelivery ? latestLng : null,
      delivery_location_description: locationDescription.trim() || null,
    };

    if (includeDelivery) {
      createOrderPayload.delivery_fee_base = deliveryFee;
      createOrderPayload.delivery_fee_offer_customer = deliveryFee;
      createOrderPayload.delivery_fee_offer_by = "customer";
      createOrderPayload.delivery_fee_offer_updated_at = new Date().toISOString();
    }

    const firstInsert = await supabase.from("orders").insert(createOrderPayload).select();
    newOrderData = firstInsert.data;
    newOrderError = firstInsert.error;

    if (newOrderError && String(newOrderError.message || '').includes('delivery_fee_offer')) {
      const fallbackInsert = await supabase
        .from("orders")
        .insert({
          customer_id: user.id,
          restaurant_id: selectedRestaurant.id,
          status: "pending",
          total_amount: totalItems,
          delivery_fee: deliveryFee,
          delivery_included: includeDelivery,
          delivery_address: includeDelivery ? latestAddress || "Address not provided" : "Pickup at restaurant",
          special_instructions: locationDescription.trim(),
          delivery_lat: includeDelivery ? latestLat : null,
          delivery_lng: includeDelivery ? latestLng : null,
          delivery_location_description: locationDescription.trim() || null,
        })
        .select();

      newOrderData = fallbackInsert.data;
      newOrderError = fallbackInsert.error;
    }

    if (newOrderError || !newOrderData?.length) throw newOrderError;

    const newOrderId = newOrderData[0].id;
    const paystackRef = String(reference?.reference || '').trim();

    const orderItems = cart.map(item => ({
      order_id: newOrderId,
      menu_id: item.id,
      quantity: item.quantity || 1,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
    if (itemsError) throw itemsError;

    for (const item of cart) {
      await supabase.rpc("decrease_stock", {
        menu_id: item.id,
        qty_to_subtract: item.quantity || 1,
      });
    }

    alert(`Payment successful${paystackRef ? ` (Ref: ${paystackRef})` : ''}. Order placed! Total: R${checkoutTotal.toFixed(2)}.`);
    if (onOrderPlaced) onOrderPlaced();
  } catch (err) {
    console.error("❌ Checkout payment/order failed:", err);
    alert("Payment was received, but we could not complete the order. Please contact support with your transaction reference.");
  } finally {
    setExternalPaymentLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/40 p-4 pb-24">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Checkout</h2>
          <p className="mt-1 text-sm text-slate-600">Review your order, confirm delivery details, and finalize your purchase.</p>
        </div>

        {cart.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="text-slate-600 font-medium">Your cart is empty.</p>
          </div>
        ) : (
          <>
            {selectedRestaurant && (
              <div className={`rounded-xl border p-4 text-sm font-medium ${availability.isClosed ? 'border-red-200 bg-red-50 text-red-700' : availability.isClosingSoon ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                {availability.message || 'Restaurant is open.'}
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-slate-900">Order Summary</p>
              <ul className="space-y-2">
                {cart.map((item, i) => (
                  <li key={i} className="flex justify-between items-center rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <span className="text-sm text-slate-700">{item.name} × {item.quantity || 1}</span>
                    <span className="font-semibold text-slate-800">R{(item.price * (item.quantity || 1)).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* ✅ Include Delivery Checkbox */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="includeDelivery"
                  checked={includeDelivery}
                  onChange={() => setIncludeDelivery(!includeDelivery)}
                  className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Include Home Delivery</span>
              </label>
            </div>

            {/* Location Reminder Message */}
            {includeDelivery && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <span className="text-2xl">📍</span>
                  <div>
                    <h4 className="font-semibold text-amber-900">Verify Your Delivery Location</h4>
                    <p className="text-sm text-amber-800 mt-1">
                      Double-check your profile has the correct address and coordinates to avoid delivery delays.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {includeDelivery && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Delivery Address</label>
                  <textarea
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Enter or confirm where we should deliver"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Location Description (Optional)</label>
                  <input
                    type="text"
                    value={locationDescription}
                    onChange={(e) => setLocationDescription(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Example: gate on left, unit 14, call on arrival"
                  />
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    setCapturingLocation(true);
                    try {
                      const coords = await getCurrentPosition();
                      const resolved = await reverseGeocode(coords);
                      setDeliveryAddress(resolved);
                      await supabase
                        .from("user_profiles")
                        .update({
                          latitude: coords.latitude,
                          longitude: coords.longitude,
                          address: resolved,
                          updated_at: new Date().toISOString(),
                        })
                        .eq("id", user?.id);
                    } catch (err: any) {
                      alert(err?.message || "Could not get current location.");
                    } finally {
                      setCapturingLocation(false);
                    }
                  }}
                  disabled={capturingLocation}
                  className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
                >
                  {capturingLocation ? "Getting location..." : "📍 Use Current Location"}
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Items Total</span>
                  <span className="font-semibold text-slate-900">R{itemsTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Delivery Fee</span>
                  <span className="font-semibold text-slate-900">R{deliveryFee.toFixed(2)}</span>
                </div>
                {includeDelivery && feeBreakdown && (
                  <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs text-slate-600">
                    {feeBreakdown.distanceKm.toFixed(1)} km • {feeBreakdown.totalUnits} items • {feeBreakdown.estimatedWeightKg.toFixed(1)} kg
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-900">Total</span>
                    <span className="text-xl font-bold text-blue-600">R{(itemsTotal + deliveryFee).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {!walletEnabled && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                Wallet checkout is paused right now. Pay here to place your order, and the wallet can be restored later by admin.
              </div>
            )}

            {walletEnabled ? (
              <button onClick={handlePlaceOrder} disabled={availability.isClosed} className={`w-full rounded-lg py-3 font-semibold text-white transition ${availability.isClosed ? 'bg-slate-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>
                {availability.isClosed ? 'Restaurant Closed' : '✓ Place Order'}
              </button>
            ) : (
              <PaystackButton
                text={externalPaymentLoading ? 'Processing payment...' : `Pay R${checkoutTotal.toFixed(2)} & Place Order`}
                onSuccess={handleCheckoutPaymentSuccess}
                onClose={() => alert('Payment cancelled. Your order was not placed.')}
                amount={checkoutTotal * 100}
                email={userEmail}
                publicKey={publicKey}
                currency="ZAR"
                className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-400"
                disabled={availability.isClosed || checkoutTotal <= 0}
              />
            )}
        </>
      )}
      </div>
    </div>
  );
}