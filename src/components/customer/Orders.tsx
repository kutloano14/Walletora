import { useState } from "react";
import { useOrders } from "../../contexts/OrdersContext";
import { MapPin, Package } from "lucide-react";

export default function Orders() {
  const {
    orders,
    loading,
    requestNewOtp,
    requestPickupOtpForCustomer,
    submitCustomerOffer,
    acceptDriverOffer,
  } = useOrders();
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [regenInProgress, setRegenInProgress] = useState<Record<string, boolean>>({});
  const [regenOtp, setRegenOtp] = useState<Record<string, string>>({});
  const [customerOfferInputs, setCustomerOfferInputs] = useState<Record<string, string>>({});

  const isNegotiationFinalized = (order: any) => {
    const customerOffer = Number(order.delivery_fee_offer_customer ?? NaN);
    const driverOffer = Number(order.delivery_fee_offer_driver ?? NaN);
    return (
      Number.isFinite(customerOffer) &&
      Number.isFinite(driverOffer) &&
      customerOffer === driverOffer &&
      order.delivery_fee_offer_by === 'customer'
    );
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "confirmed":
        return "bg-blue-100 text-blue-800";
      case "preparing":
        return "bg-orange-100 text-orange-800";
      case "ready_for_pickup":
        return "bg-purple-100 text-purple-800";
      case "picked_up":
        return "bg-indigo-100 text-indigo-800";
      case "delivered":
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) return <p>Loading orders...</p>;
  if (!orders.length) return <p>No orders yet.</p>;

  const activeCount = orders.filter((o) => !["delivered", "cancelled", "completed"].includes(o.status)).length;
  const completedCount = orders.filter((o) => ["delivered", "completed"].includes(o.status)).length;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Your Orders</h2>
        <p className="mt-1 text-sm text-slate-600">Track every order, OTP, delivery update, and price negotiation in one place.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Active</p>
            <p className="mt-1 text-xl font-bold text-blue-900">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Completed</p>
            <p className="mt-1 text-xl font-bold text-emerald-900">{completedCount}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <div
            key={order.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="mb-3 flex justify-between items-center">
              <h3 className="font-semibold text-lg text-slate-900">
                {order.restaurants?.name || "Warehouse"}
              </h3>
              <span
                className={`px-2 py-1 rounded-full text-sm ${getStatusColor(
                  order.status
                )}`}
              >
                {order.status.replace("_", " ")}
              </span>
            </div>

            <div className="mb-2 flex justify-between items-center gap-3">
              <span className="flex items-center gap-1 text-sm text-slate-700">
                <MapPin className="w-4 h-4" /> {order.delivery_address}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-semibold text-slate-800">
                <Package className="h-4 w-4" /> Total R{order.total_amount.toFixed(2)}
              </span>
            </div>

            {order.delivery_included && !order.driver_id && order.status === 'ready_for_pickup' && !isNegotiationFinalized(order) && (
              <div className="mt-3 mb-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm text-blue-900 font-semibold mb-1">Delivery Price Market</p>
                <p className="text-xs text-blue-700">
                  Base: R{(order.delivery_fee_base ?? order.delivery_fee).toFixed(2)} | Current offer: R{(order.delivery_fee_offer_customer ?? order.delivery_fee).toFixed(2)}
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Drivers viewing but not accepting: {order.delivery_offer_not_accepted_count ?? 0}
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    step="0.5"
                    placeholder="Change your offer"
                    value={customerOfferInputs[order.id] ?? ''}
                    onChange={(e) => setCustomerOfferInputs((prev) => ({ ...prev, [order.id]: e.target.value }))}
                    className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    onClick={async () => {
                      const amount = Number(customerOfferInputs[order.id]);
                      if (!Number.isFinite(amount) || amount <= 0) {
                        alert('Please enter a valid amount.');
                        return;
                      }
                      try {
                        await submitCustomerOffer(order.id, amount);
                        setCustomerOfferInputs((prev) => ({ ...prev, [order.id]: '' }));
                        alert(`Updated offer to R${amount.toFixed(2)}`);
                      } catch (err: any) {
                        alert(`Failed to update offer: ${err?.message || 'Unknown error'}`);
                      }
                    }}
                  >
                    Update Offer
                  </button>
                </div>

                {order.delivery_fee_offer_driver != null && (
                  <div className="mt-2 rounded border border-purple-200 bg-purple-50 p-2">
                    <p className="text-xs text-purple-800">
                      A driver offered: <strong>R{order.delivery_fee_offer_driver.toFixed(2)}</strong>
                    </p>
                    <button
                      className="mt-2 rounded bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700"
                      onClick={async () => {
                        try {
                          await acceptDriverOffer(order.id);
                          alert('Driver offer accepted. Updated current delivery price.');
                        } catch (err: any) {
                          alert(`Failed to accept driver offer: ${err?.message || 'Unknown error'}`);
                        }
                      }}
                    >
                      Accept Driver Offer
                    </button>
                  </div>
                )}
              </div>
            )}

            {order.delivery_included && !order.driver_id && order.status === 'ready_for_pickup' && isNegotiationFinalized(order) && (
              <div className="mt-3 mb-2 rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-sm font-semibold text-green-800">
                  Negotiation finalized at R{(order.delivery_fee_offer_customer ?? order.delivery_fee).toFixed(2)}.
                </p>
                <p className="text-xs text-green-700 mt-1">
                  Waiting for a driver to accept this delivery.
                </p>
              </div>
            )}

            {/* For delivery orders: show delivery OTP to customer */}
            {order.delivery_included && !["delivered", "cancelled"].includes(order.status) && order.deliveries?.[0]?.otp && !order.deliveries[0].otp_verified && (
              <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-200 rounded">
                <div className="text-sm text-gray-800">
                  <strong>Your Delivery OTP:</strong> <span className="font-mono font-bold text-blue-600">{order.deliveries[0].otp}</span>
                </div>
                {order.deliveries[0].otp_expires_at && (
                  <div className="text-xs text-gray-600 mt-1">Expires: {new Date(order.deliveries[0].otp_expires_at).toLocaleString()}</div>
                )}
                <div className="text-xs text-gray-600 mt-1">Give this OTP to your driver when they arrive for delivery.</div>
              </div>
            )}

            {/* For pickup orders: show customer pickup OTP from orders.pickup_otp */}
            {!order.delivery_included && !["delivered", "cancelled"].includes(order.status) && order.pickup_otp && !order.pickup_otp_verified && (
              <div className="mt-2 p-3 bg-green-50 border-l-4 border-green-200 rounded">
                <div className="text-sm text-gray-800">
                  <strong>Your Pickup OTP:</strong> <span className="font-mono font-bold text-green-600">{order.pickup_otp}</span>
                </div>
                {order.pickup_otp_expires_at && (
                  <div className="text-xs text-gray-600 mt-1">Expires: {new Date(order.pickup_otp_expires_at).toLocaleString()}</div>
                )}
                <div className="text-xs text-gray-600 mt-1">Give this OTP to the restaurant when collecting your order.</div>
              </div>
            )}

            {/* Show message if no OTP available yet */}
            {!["delivered", "cancelled"].includes(order.status) && 
             ((order.delivery_included && !order.deliveries?.[0]?.otp) || (!order.delivery_included && !order.pickup_otp)) && (
              <div className="mt-2 p-3 bg-yellow-50 border-l-4 border-yellow-200 rounded">
                <div className="text-sm text-yellow-700">
                  Your {order.delivery_included ? 'delivery' : 'pickup'} OTP is not available yet. 
                  {order.delivery_included ? ' The driver will need to accept your order first.' : ' Click below to generate your pickup OTP.'}
                </div>
                <div className="mt-2">
                  <button
                    className="text-sm text-blue-600 hover:underline"
                    disabled={regenInProgress[order.id]}
                    onClick={async () => {
                      try {
                        setRegenInProgress(prev => ({ ...prev, [order.id]: true }));
                        
                        if (order.delivery_included) {
                          // For delivery orders, use requestNewOtp (creates delivery record)
                          const newOtp = await requestNewOtp(order.id);
                          if (newOtp) setRegenOtp(prev => ({ ...prev, [order.id]: newOtp }));
                          else alert('Could not generate new OTP.');
                        } else {
                          // For pickup orders, generate pickup OTP directly in orders table
                          const pickupOtp = await requestPickupOtpForCustomer?.(order.id);
                          if (pickupOtp) {
                            alert(`Your pickup OTP is: ${pickupOtp}`);
                            // Trigger refresh to show the OTP
                            window.location.reload();
                          } else {
                            alert('Could not generate pickup OTP.');
                          }
                        }
                      } catch (err) {
                        console.error(err);
                        alert('Failed to request new OTP.');
                      } finally {
                        setRegenInProgress(prev => ({ ...prev, [order.id]: false }));
                      }
                    }}
                  >
                    {regenInProgress[order.id] ? 'Generating...' : `Generate ${order.delivery_included ? 'Delivery' : 'Pickup'} OTP`}
                  </button>
                  {regenOtp[order.id] && (
                    <div className="text-sm text-gray-800 mt-1">New OTP: <span className="font-mono font-bold">{regenOtp[order.id]}</span></div>
                  )}
                </div>
              </div>
            )}

            {/* Show driver contact if available (when assigned) */}
            {order.deliveries?.[0]?.driver_phone && (
              <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-200 rounded">
                <div className="text-sm text-gray-800">
                  <strong>Driver:</strong> {order.deliveries[0].driver_name || 'Driver'}
                </div>
                <div className="text-sm text-gray-700 mt-1">
                  <a className="text-blue-600 hover:underline" href={`tel:${order.deliveries[0].driver_phone}`}>{order.deliveries[0].driver_phone}</a>
                </div>
              </div>
            )}

            <button
              className="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
              onClick={() => toggleExpand(order.id)}
            >
              {expandedOrders[order.id] ? "Hide Items" : "View Items"}
            </button>

            {expandedOrders[order.id] && order.order_items?.length ? (
              <ul className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                {order.order_items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                    <span>
                      {item.menu?.name || "Item"} x {item.quantity}
                    </span>
                    <span className="font-semibold text-slate-800">R{((item.menu?.price || 0) * item.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}