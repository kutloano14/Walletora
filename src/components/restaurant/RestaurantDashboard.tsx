import { useEffect, useMemo, useState } from 'react';
import { Store, Clock, CheckCircle, XCircle, Download, Calendar, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrders } from '../../contexts/OrdersContext';
import { ThemeToggle } from '../ThemeToggle';
import { supabase } from "../../lib/supabase";
import { Link } from 'react-router-dom';



export function RestaurantDashboard() {
  const { profile, signOut } = useAuth();
  const { orders, loading, updateOrderStatus, verifyPickupOtp } = useOrders();
  const [pickupInputs, setPickupInputs] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'completed'>('pending');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDateFilter, setShowDateFilter] = useState<boolean>(false);
  const [restaurantMeta, setRestaurantMeta] = useState<{ id: string; name?: string } | null>(null);
  const [closingTime, setClosingTime] = useState<string>('22:00');
  const [closedNow, setClosedNow] = useState<boolean>(false);
  const [savingClosingSettings, setSavingClosingSettings] = useState<boolean>(false);
  const [closingColumnsReady, setClosingColumnsReady] = useState<boolean>(true);

  const loadRestaurantMeta = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, closing_time, is_temporarily_closed')
      .eq('owner_id', profile.id)
      .single();

    if (!error && data) {
      setRestaurantMeta({ id: data.id, name: data.name });
      setClosedNow(Boolean(data.is_temporarily_closed));
      if (data.closing_time) {
        setClosingTime(String(data.closing_time).slice(0, 5));
      }
      setClosingColumnsReady(true);
      return;
    }

    const { data: fallbackData, error: fallbackError } = await supabase
      .from('restaurants')
      .select('id, name')
      .eq('owner_id', profile.id)
      .single();

    if (fallbackError || !fallbackData) {
      console.error('Restaurant not found:', fallbackError || error);
      return;
    }

    setRestaurantMeta({ id: fallbackData.id, name: fallbackData.name });
    setClosingColumnsReady(false);
  };

  useEffect(() => {
    loadRestaurantMeta();
  }, [profile?.id]);

  const handleSaveClosingTime = async () => {
    if (!restaurantMeta?.id || !closingColumnsReady) {
      alert('Please run the latest SQL migration to enable closing-time settings.');
      return;
    }

    setSavingClosingSettings(true);
    const { error } = await supabase
      .from('restaurants')
      .update({ closing_time: `${closingTime}:00` })
      .eq('id', restaurantMeta.id);

    setSavingClosingSettings(false);

    if (error) {
      console.error('Failed to save closing time:', error);
      alert('Failed to save closing time.');
      return;
    }

    alert('Closing time updated successfully.');
  };

  const handleToggleCloseNow = async (nextValue: boolean) => {
    if (!restaurantMeta?.id || !closingColumnsReady) {
      alert('Please run the latest SQL migration to enable open/close controls.');
      return;
    }

    setSavingClosingSettings(true);
    const { error } = await supabase
      .from('restaurants')
      .update({ is_temporarily_closed: nextValue })
      .eq('id', restaurantMeta.id);

    setSavingClosingSettings(false);

    if (error) {
      console.error('Failed to update close-now status:', error);
      alert('Failed to update open/close status.');
      return;
    }

    setClosedNow(nextValue);
  };

  const closingTimeDisplay = useMemo(() => {
    const [hours, minutes] = closingTime.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return closingTime;
    const dt = new Date();
    dt.setHours(hours, minutes, 0, 0);
    return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }, [closingTime]);

const handleStatusUpdate = async (orderId: string, status: string) => {
  try {
    // 1️⃣ Fetch order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, customer_id, total_amount, delivery_fee, restaurant_id")
      .eq("id", orderId)
      .single();
    if (orderError || !order) throw new Error("Order not found");

    const total = order.total_amount + order.delivery_fee;

    // 2️⃣ Fetch order items
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("id, menu_id, quantity")
      .eq("order_id", orderId);
    if (itemsError) throw itemsError;

    // 3️⃣ Handle confirmed status (only decrease stock, no extra payment)
   if (status === "confirmed") {
  // Reduce stock
  for (const item of orderItems || []) {
    await supabase.rpc("decrease_stock", {
      menu_id: item.menu_id,
      qty_to_subtract: item.quantity,
    });
  }

  // Insert service fee transaction (e.g., 5% of order total)
  const serviceFee = Math.round(total * 0.05 * 100) / 100;

  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", order.customer_id)
    .single();
  if (walletError || !wallet) throw new Error("Wallet not found");

  // Deduct service fee from wallet
  const newBalance = wallet.balance - serviceFee;

  const { error: feeError } = await supabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    order_id: orderId,
    restaurant_id: order.restaurant_id,
    type: "service fee", // or "payment" if you prefer
    amount:serviceFee,
    description: `Service fee for order #${orderId} at restaurant ${order.restaurant_id}`,
  });
  if (feeError) throw feeError;

  const { error: updateError } = await supabase
    .from("wallets")
    .update({ balance: newBalance })
    .eq("id", wallet.id);
  if (updateError) throw updateError;
}

    // 4️⃣ Handle declined status (refund to customer)
    if (status === "declined") {
      const refundAmount = total;

      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", order.customer_id)
        .single();
      if (walletError || !wallet) throw new Error("Wallet not found");

      const newBalance = wallet.balance + refundAmount;

      const { error: refundTxnError } = await supabase.from("wallet_transactions").insert([
        {
          wallet_id: wallet.id,
          type: "refund",
          amount: refundAmount,
          description: `Refund for declined order #${orderId} at restaurant ${order.restaurant_id}`,
        },
      ]);
      if (refundTxnError) throw refundTxnError;

      const { error: updateWalletError } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("id", wallet.id);
      if (updateWalletError) throw updateWalletError;
    }

    // 5️⃣ Finally, update order status
    await updateOrderStatus(orderId, status);

  } catch (error) {
    console.error("Error updating order status:", error);
    alert("Failed to update order status. Check console for details.");
  }
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'preparing': return 'bg-orange-100 text-orange-800';
      case 'ready_for_pickup': return 'bg-purple-100 text-purple-800';
      case 'assigned': return 'bg-cyan-100 text-cyan-800';
      case 'heading_to_restaurant': return 'bg-blue-100 text-blue-800';
      case 'arrived_at_restaurant': return 'bg-green-100 text-green-800';
      case 'picked_up': return 'bg-indigo-100 text-indigo-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const activeOrders = orders.filter(o => ['confirmed', 'preparing', 'ready_for_pickup', 'assigned', 'heading_to_restaurant', 'arrived_at_restaurant', 'picked_up'].includes(o.status));
  const completedOrders = orders.filter(o => ['delivered', 'declined'].includes(o.status));

  const downloadCSV = (data: any[], filename: string, fromDate?: string, toDate?: string) => {
    let filteredData = data;
    
    // Apply date filtering if dates are provided
    if (fromDate || toDate) {
      filteredData = data.filter(order => {
        const orderDate = new Date(order.created_at);
        const start = fromDate ? new Date(fromDate) : new Date('1900-01-01');
        const end = toDate ? new Date(toDate + 'T23:59:59') : new Date();
        return orderDate >= start && orderDate <= end;
      });
    }

    const headers = ["Order ID", "Customer Name", "Total Amount", "Status", "Created At"];
    const rows = filteredData.map(order => [
      order.id,
      order.customer?.full_name || "Customer",
      `R${order.total_amount}`,
      order.status,
      new Date(order.created_at).toLocaleString()
    ]);

    const totalDelivered = filteredData
    .filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + o.total_amount, 0);

    const totalDeclined = filteredData
    .filter(o => o.status === 'declined')
    .reduce((sum, o) => sum + o.total_amount, 0);
    
    rows.push([]);
    rows.push(['Total Delivered', '', `R${totalDelivered}`, '', '']);
    rows.push(['Total Declined', '', `R${totalDeclined}`, '', '']);
    
    // Add date range info to filename if filtering is applied
    let finalFilename = filename;
    if (fromDate || toDate) {
      const dateRange = `${fromDate || 'start'}_to_${toDate || 'end'}`;
      finalFilename = filename.replace('.csv', `_${dateRange}.csv`);
    }

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", finalFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const renderOrderCard = (order: any, showActions = false) => (
    <div key={order.id} className="bg-white rounded-xl shadow-md p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
            <h3 className="text-lg font-semibold text-gray-900">
            Order #{(order.id || '').slice(0, 8)}
          </h3>
          <p className="text-gray-600">{order.customer?.full_name || 'Customer'}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
          {order.status.replace('_', ' ')}
        </span>
      </div>
      
      <div className="space-y-2 mb-4">
  <p className="text-sm text-gray-600">
    <strong>Items:</strong>
  </p>
    <ul className="space-y-2 text-sm text-gray-600">
    {order.order_items?.map((item: { id:string; quantity: number; menu: {name: string; price: number; category?: string; description?: string} | null }) => (
      <li key={item.id} className="bg-white rounded-lg p-3 shadow-sm border">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-gray-900">
            {item.menu?.name || "Unknown item"}
          </div>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
            Qty: {item.quantity}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
            {item.menu?.category || "Unspecified"}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
            {`R${((item.menu?.price ?? 0)).toFixed(2)}`}
          </span>
        </div>
        {item.menu?.description && (
          <div className="text-xs text-gray-500 mt-1">
            {item.menu.description}
          </div>
        )}
      </li>
    )) || <li>No items</li>}
  </ul>

  <p className="text-sm text-gray-600">
    <strong>Total:</strong> {`R${((order.total_amount ?? 0)).toFixed(2)}`}
  </p>
  <p className="text-sm text-gray-600">
    <strong>Address:</strong> {order.delivery_address}
  </p>
  {order.special_instructions && (
    <p className="text-sm text-gray-600">
      <strong>Instructions:</strong> {order.special_instructions}
    </p>
  )}
  <p className="text-sm text-gray-500">
    Ordered {new Date(order.created_at).toLocaleString()}
  </p>
</div>

      {showActions && (
        <div className="flex space-x-3">
          {order.status === 'pending' && (
            <>
              <button
                onClick={() => handleStatusUpdate(order.id, 'confirmed')}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Accept</span>
              </button>
              <button
                onClick={() => handleStatusUpdate(order.id, 'declined')}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-2"
              >
                <XCircle className="w-4 h-4" />
                <span>Decline</span>
              </button>
            </>
          )}
          {order.status === 'confirmed' && (
            <button
              onClick={() => handleStatusUpdate(order.id, 'preparing')}
              className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors"
            >
              Start Preparing
            </button>
          )}
          {order.status === 'preparing' && (
            <button
              onClick={() => handleStatusUpdate(order.id, 'ready_for_pickup')}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Ready for Pickup
            </button>
          )}
          {(order.status === 'ready_for_pickup' || order.status === 'assigned' || order.status === 'heading_to_restaurant' || order.status === 'arrived_at_restaurant') && (
            <div className="w-full">
              {/* Driver Status Info */}
              {(order.status === 'assigned' || order.status === 'heading_to_restaurant' || order.status === 'arrived_at_restaurant') && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-semibold text-blue-800">
                    {order.status === 'assigned' && '🚗 Driver assigned - preparing to pickup'}
                    {order.status === 'heading_to_restaurant' && '🛣️ Driver is on the way'}
                    {order.status === 'arrived_at_restaurant' && '📍 Driver has arrived - ready for pickup!'}
                  </div>
                  {order.deliveries && order.deliveries.length > 0 && order.deliveries[0].driver && (
                    <div className="text-xs text-gray-600 mt-1">
                      Driver: {order.deliveries[0].driver.full_name}
                      {order.deliveries[0].driver.phone && ` • ${order.deliveries[0].driver.phone}`}
                    </div>
                  )}
                </div>
              )}
              
              {/* OTP Input - Different handling for pickup vs delivery orders */}
              <div className="flex items-center space-x-2">
                {order.delivery_included ? (
                  // Delivery order: Verify driver's pickup OTP
                  <>
                    <input
                      type="text"
                      placeholder="Enter driver's pickup OTP"
                      value={pickupInputs[order.id] ?? ''}
                      onChange={(e) => setPickupInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                      className="flex-1 border rounded px-3 py-2"
                    />
                    <button
                      onClick={async () => {
                        const otp = (pickupInputs[order.id] || '').trim();
                        if (!otp) return alert('Enter the driver\'s pickup OTP to verify pickup');
                        try {
                          const ok = await verifyPickupOtp?.(order.id, otp);
                          if (ok) {
                            alert('✅ Pickup verified — order handed over to driver');
                            setPickupInputs(prev => ({ ...prev, [order.id]: '' }));
                          } else {
                            alert('❌ OTP invalid or expired. Check with the driver.');
                          }
                        } catch (err) {
                          console.error(err);
                          alert('Failed to verify OTP');
                        }
                      }}
                      className="bg-emerald-600 text-white py-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      Verify Driver OTP
                    </button>
                  </>
                ) : (
                  // Pickup order: Verify customer's pickup OTP
                  <>
                    <input
                      type="text"
                      placeholder="Enter customer's pickup OTP"
                      value={pickupInputs[order.id] ?? ''}
                      onChange={(e) => setPickupInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                      className="flex-1 border rounded px-3 py-2"
                    />
                    <button
                      onClick={async () => {
                        const otp = (pickupInputs[order.id] || '').trim();
                        if (!otp) return alert('Enter the customer\'s pickup OTP to verify pickup');
                        try {
                          // For pickup orders, verify the customer's pickup OTP from orders.pickup_otp
                          const ok = await verifyPickupOtp?.(order.id, otp);
                          if (ok) {
                            alert('✅ Pickup verified — order handed over to customer');
                            setPickupInputs(prev => ({ ...prev, [order.id]: '' }));
                          } else {
                            alert('❌ OTP invalid or expired. Check with the customer.');
                          }
                        } catch (err) {
                          console.error(err);
                          alert('Failed to verify OTP');
                        }
                      }}
                      className="bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Verify Customer OTP
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Store className="w-8 h-8 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Walletora</h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle variant="header" />
              <span className="text-gray-700">Welcome, {profile?.full_name}</span>

              <Link 
                to="/restaurant/menu"
                className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Manage Inventory
              </Link>

              <Link 
                to="/restaurant/ads"
                className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
              >
                Manage Promotions
              </Link>
              <button
                onClick={signOut}
                className="inline-flex items-center space-x-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'pending'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Pending Orders ({pendingOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'active'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Active Orders ({activeOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'completed'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Completed ({completedOrders.length})
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Store Availability</h2>
              <p className="mt-1 text-sm text-gray-600">
                Customers will see open, closing soon, and close time on your store card.
              </p>
              <p className="mt-1 text-xs text-gray-500">Default closing time is 10:00 PM unless you change it.</p>
            </div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${closedNow ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {closedNow ? 'Closed now' : `Open • Closes at ${closingTimeDisplay}`}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[200px_auto_auto] md:items-end">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Closing time</label>
              <input
                type="time"
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                disabled={!closingColumnsReady || savingClosingSettings}
              />
            </div>

            <button
              onClick={handleSaveClosingTime}
              disabled={!closingColumnsReady || savingClosingSettings}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              Save Closing Time
            </button>

            <button
              onClick={() => handleToggleCloseNow(!closedNow)}
              disabled={!closingColumnsReady || savingClosingSettings}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-gray-400 ${closedNow ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {closedNow ? 'Open Now' : 'Close Now'}
            </button>
          </div>

          {!closingColumnsReady && (
            <p className="mt-3 text-xs text-amber-700">
              Closing controls are disabled until the latest migration is applied.
            </p>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading orders...</p>
          </div>
        ) : (
          <div>
            {activeTab === 'pending' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Pending Orders</h2>
                {pendingOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No pending orders</h3>
                    <p className="text-gray-600">New orders will appear here when customers place them.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {pendingOrders.map((order) => renderOrderCard(order, true))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'active' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Active Orders</h2>
                {activeOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No active orders</h3>
                    <p className="text-gray-600">Orders being prepared will appear here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {activeOrders.map((order) => renderOrderCard(order, true))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'completed' && (
              <div>
                <div className="flex flex-col space-y-4 mb-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-900">Completed Orders</h2>
                    <div className="flex items-center space-x-4">
                      <div className="text-green-700 font-semibold">
                        Total Delivered: R{completedOrders.filter(o => o.status ==='delivered').reduce((sum,o)=>sum+o.total_amount,0)}
                      </div>
                      <div className="text-green-700 font-semibold">
                        Total Declined: R{completedOrders.filter(o=>o.status ==='declined').reduce((sum,o)=>sum+o.total_amount,0)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Date Filter Section */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                        <Calendar className="w-5 h-5 mr-2" />
                        Download CSV Report
                      </h3>
                      <button
                        onClick={() => setShowDateFilter(!showDateFilter)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        {showDateFilter ? 'Hide Filters' : 'Show Date Filters'}
                      </button>
                    </div>
                    
                    {showDateFilter && (
                      <div className="flex flex-wrap items-center space-x-4 mb-4">
                        <div className="flex flex-col">
                          <label className="text-sm font-medium text-gray-700 mb-1">From Date</label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm font-medium text-gray-700 mb-1">To Date</label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex flex-col justify-end">
                          <button
                            onClick={() => {
                              setStartDate('');
                              setEndDate('');
                            }}
                            className="bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm hover:bg-gray-300 transition-colors"
                          >
                            Clear Dates
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={() => downloadCSV(completedOrders, 'completed_orders.csv', startDate, endDate)}
                        className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Filtered CSV</span>
                      </button>
                      
                      <button
                        onClick={() => downloadCSV(completedOrders, 'all_completed_orders.csv')}
                        className="bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download All</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mb-4 p-4 bg-white rounded shadow flex justify-between items-center">
                {completedOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No completed orders</h3>
                    <p className="text-gray-600">Completed orders will appear here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {completedOrders.map((order) => renderOrderCard(order, false))}
                  </div>
                )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}