import { useState, useEffect } from 'react';
import { Truck, MapPin, DollarSign, Phone, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrders } from '../../contexts/OrdersContext';
import { ThemeToggle } from '../ThemeToggle';
import type { Order } from '../../contexts/OrdersContext';
import { DeliveryMap } from '../maps/DeliveryMap';
import { LiveNavigator } from '../maps/LiveNavigator';
import { supabase } from '../../lib/supabase';

export function DriverDashboard() {
  const { profile, signOut, user } = useAuth();

  const {
    orders,
    loading,
    updateOrderStatus,
    acceptOrder,
    markOrderViewed,
    submitDriverOffer,
    verifyOtp,
    verifyPickupOtp,
    activeDeliveries,
    refreshOrders,
    // cancelDelivery removed per user request
  } = useOrders();

  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'earnings'>('available');
  const [showMapFor, setShowMapFor] = useState<string | null>(null);
  const [navigatorOrderId, setNavigatorOrderId] = useState<string | null>(null);
  const [navigatorMode, setNavigatorMode] = useState<'to_restaurant' | 'to_customer'>('to_restaurant');
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  
  // Add state for earnings data
  const [completedDeliveries, setCompletedDeliveries] = useState<any[]>([]);
  const [earningsData, setEarningsData] = useState({ totalEarnings: 0, totalDeliveries: 0, withdrawableAmount: 0 });
  const [earningsLoading, setEarningsLoading] = useState(false);

  // Function to fetch completed deliveries and earnings for the driver
  const fetchDriverEarnings = async () => {
    if (!user?.id) return;
    
    setEarningsLoading(true);
    try {
      // Fetch completed deliveries for this driver
      const { data: deliveries, error: deliveriesError } = await supabase
        .from('orders')
        .select(`
          id,
          delivery_fee,
          status,
          created_at,
          restaurants!orders_restaurant_id_fkey(name,phone),
          customer:user_profiles!orders_customer_id_fkey(full_name)
        `)
        .eq('driver_id', user.id)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false });

      if (deliveriesError) {
        console.error('Error fetching completed deliveries:', deliveriesError);
        return;
      }

      setCompletedDeliveries(deliveries || []);

      // Calculate total earnings from deliveries
      const totalDeliveries = deliveries?.length || 0;
      const totalFees = deliveries?.reduce((sum, order) => sum + (order.delivery_fee || 0), 0) || 0;

      // Fetch paid withdrawals to subtract from available amount
      const { data: paidWithdrawals, error: withdrawalsError } = await supabase
        .from('withdrawals')
        .select('amount')
        .eq('driver_id', user.id)
        .eq('status', 'paid');

      if (withdrawalsError) {
        console.error('Error fetching withdrawals:', withdrawalsError);
      }

      // Calculate total withdrawn amount
      const totalWithdrawn = paidWithdrawals?.reduce((sum, withdrawal) => sum + parseFloat(withdrawal.amount), 0) || 0;
      
      // Calculate remaining available amounts
      const remainingBalance = totalFees - totalWithdrawn;
      const withdrawableAmount = (totalFees * 0.75) - totalWithdrawn; // 75% minus what's already withdrawn

      setEarningsData({
        totalEarnings: remainingBalance, // Show remaining balance, not total earned
        totalDeliveries,
        withdrawableAmount: Math.max(0, withdrawableAmount) // Don't show negative
      });
    } catch (error) {
      console.error('Error fetching driver earnings:', error);
    } finally {
      setEarningsLoading(false);
    }
  };

  // Fetch earnings when component mounts or when switching to earnings tab
  useEffect(() => {
    if (activeTab === 'earnings') {
      fetchDriverEarnings();
      fetchWithdrawals();
    }
  }, [activeTab, user?.id]);

  const fetchWithdrawals = async () => {
    if (!profile) return;
    
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('driver_id', profile.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching withdrawals:', error);
    } else {
      setWithdrawals(data || []);
    }
  };


  // Accept order
  const handleAcceptOrder = async (orderId: string) => {
    try {
      if (!profile?.id) throw new Error('Driver profile not found');
      
      setAcceptingOrderId(orderId);
      await acceptOrder(orderId, profile.id);
      
      // Ensure fresh data is loaded
      await refreshOrders();
      
      // Switch to active tab to show the accepted order
      setActiveTab('active');
      
      // Show success feedback
      alert('✅ Order accepted successfully! Switching to Active Deliveries...');
      
    } catch (error) {
      console.error('Error accepting order:', error);
      alert('❌ Failed to accept order. Please try again.');
    } finally {
      setAcceptingOrderId(null);
    }
  };

  const handleDriverCounterOffer = async (orderId: string) => {
    const amount = Number(driverOfferInputs[orderId]);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Please enter a valid offer amount.');
      return;
    }

    try {
      await submitDriverOffer(orderId, amount);
      alert(`✅ Counter-offer sent: R${amount.toFixed(2)}`);
      setDriverOfferInputs((prev) => ({ ...prev, [orderId]: '' }));
      await refreshOrders();
    } catch (error: any) {
      console.error('Error submitting counter-offer:', error);
      alert(`❌ Failed to submit counter-offer: ${error?.message || 'Unknown error'}`);
    }
  };

 // adjust path if needed
const [withdrawAmount, setWithdrawAmount] = useState(0);
const [withdrawMessage, setWithdrawMessage] = useState("");
const [withdrawals, setWithdrawals] = useState<any[]>([]);
const [driverOfferInputs, setDriverOfferInputs] = useState<Record<string, string>>({});

  // Lists
  const availableOrders = orders.filter((o) => o.status === 'ready_for_pickup' && o.delivery_included);
  const activeOrders = activeDeliveries;

  useEffect(() => {
    if (!user?.id) return;
    if (!activeOrders.length) return;
    if (!navigator.geolocation) return;

    const watcherId = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const now = new Date().toISOString();

        try {
          await supabase
            .from('user_profiles')
            .update({
              latitude: lat,
              longitude: lng,
              updated_at: now,
            })
            .eq('id', user.id);

          const activeOrderIds = activeOrders.map((o) => o.id);
          if (activeOrderIds.length > 0) {
            await supabase
              .from('deliveries')
              .update({
                driver_lat: lat,
                driver_lng: lng,
                updated_at: now,
              })
              .in('order_id', activeOrderIds)
              .eq('driver_id', user.id);
          }
        } catch (err) {
          console.error('Failed to persist driver movement location:', err);
        }
      },
      (err) => {
        console.error('Driver geolocation watch failed:', err);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 10000,
        timeout: 30000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watcherId);
    };
  }, [user?.id, activeOrders]);

const handleWithdrawRequest = async () => {
  if (!profile?.full_name || !profile?.email) return;
  
  const { withdrawableAmount } = earningsData;

  if (withdrawAmount <= 0) return alert("Enter a valid amount");
  if (withdrawAmount > withdrawableAmount) return alert("Amount exceeds withdrawable balance");

  try {
    // Insert withdrawal request into database
    const { data, error } = await supabase
      .from('withdrawals')
      .insert([{
        driver_id: profile.id,
        amount: withdrawAmount
      }])
      .select()
      .single();

    if (error) throw error;

    // Send withdrawal request to operations team
    const subject = `Driver Withdrawal Request: ${profile.full_name}`;
    const body = `
Driver: ${profile.full_name} (${profile.email})
Driver ID: ${profile.id}
Requested Amount: R${withdrawAmount.toFixed(2)}
Total Withdrawable: R${withdrawableAmount.toFixed(2)}
Request ID: ${data.id}

To process this withdrawal:
1. Log into Walletora admin panel
2. Find withdrawal ID: ${data.id}
3. Approve/reject and mark as paid

Please process within 2 business days.
    `;

    const mailtoLink = `mailto:operations@walletora.co.za?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');

    setWithdrawMessage(`Withdrawal request of R${withdrawAmount.toFixed(2)} submitted successfully! Request ID: ${data.id.substring(0, 8)}. A confirmation email has been opened. Please send it to complete the request. You will receive payment within 2 business days.`);
    setWithdrawAmount(0);
    
    // Refresh withdrawal list
    fetchWithdrawals();
  } catch (err: any) {
    console.error('Withdrawal error:', err);
    alert(`Failed to submit withdrawal request: ${err.message}`);
  }
};


  // Update status
  const handleStatusUpdate = async (orderId: string, status: string) => {
    try {
      await updateOrderStatus(orderId, status);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'bg-blue-100 text-blue-800';
      case 'heading_to_restaurant':
        return 'bg-yellow-100 text-yellow-800';
      case 'arrived_at_restaurant':
        return 'bg-orange-100 text-orange-800';
      case 'picked_up':
        return 'bg-purple-100 text-purple-800';
      case 'heading_to_customer':
        return 'bg-indigo-100 text-indigo-800';
      case 'arrived_at_customer':
        return 'bg-cyan-100 text-cyan-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status display text
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'Order Assigned';
      case 'heading_to_restaurant':
        return 'Heading to Restaurant';
      case 'arrived_at_restaurant':
        return 'Arrived at Restaurant';
      case 'picked_up':
        return 'Order Picked Up';
      case 'heading_to_customer':
        return 'Heading to Customer';
      case 'arrived_at_customer':
        return 'Arrived at Customer';
      case 'delivered':
        return 'Delivered';
      default:
        return status.replace(/_/g, ' ');
    }
  };

  const renderDriverOrderItems = (items: any[] | undefined, title: string) => {
    if (!items || items.length === 0) {
      return (
        <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-yellow-800">⚠️ Order items not loaded. This may be a data issue.</p>
        </div>
      );
    }

    return (
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="bg-white rounded-lg p-3 shadow-sm border">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">
                  {item.menu?.name || 'Item'}
                </div>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                  Qty: {item.quantity}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                  {item.menu?.category || 'Unspecified'}
                </span>
              </div>
              {item.menu?.description && (
                <div className="text-xs text-gray-500 mt-1">
                  {item.menu.description}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const isNegotiationFinalized = (order: Order) => {
    const customerOffer = Number(order.delivery_fee_offer_customer ?? NaN);
    const driverOffer = Number(order.delivery_fee_offer_driver ?? NaN);
    return (
      Number.isFinite(customerOffer) &&
      Number.isFinite(driverOffer) &&
      customerOffer === driverOffer &&
      order.delivery_fee_offer_by === 'customer'
    );
  };

  useEffect(() => {
    if (activeTab !== 'available') return;

    availableOrders.forEach((order) => {
      if (!order.driver_has_viewed) {
        markOrderViewed(order.id).catch((err) => {
          console.error('Failed to mark order as viewed:', err);
        });
      }
    });
  }, [availableOrders, activeTab, markOrderViewed]);
  
  // Remove old completedOrders calculation - now using the fetched completedDeliveries

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Live Navigator Overlay */}
      {navigatorOrderId && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm p-3 sm:p-4">
          <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-2xl">
            <LiveNavigator
              order={[...orders, ...activeDeliveries].find(o => o.id === navigatorOrderId)}
              mode={navigatorMode}
              onClose={() => setNavigatorOrderId(null)}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Truck className="w-8 h-8 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Driver Portal</h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle variant="header" />
              <span className="text-gray-700">
                Welcome, {profile?.full_name || 'Driver'}
              </span>
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

      {/* Tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('available')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'available'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Available Orders ({availableOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'active'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Active Deliveries ({activeOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('earnings')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'earnings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Earnings
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Available Orders */}
        {activeTab === 'available' && (
          <div className="space-y-6">
            {availableOrders.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No available orders
                </h3>
                <p className="text-gray-600">Check back later for new delivery opportunities!</p>
              </div>
            ) : (
              availableOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-xl shadow-md p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {order.restaurants?.name || 'Warehouse'}
                      </h3>
                      <p className="text-gray-600">Delivery #{order.id.slice(0, 8)}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                      order.status
                    )}`}>
                      {getStatusDisplay(order.status)}
                    </span>
                  </div>
                  
                  {renderDriverOrderItems(order.order_items, '📦 Items to Pickup')}
                  
                 <div className="space-y-2 mb-6">
  {/* Warehouse (Pickup) Address */}
  <div className="flex items-center space-x-2 text-gray-600">
    <MapPin className="w-4 h-4 text-orange-500" />
    <span className="text-sm">
              {order.customer?.phone && (
                <div className="flex items-center space-x-2 text-gray-600">
                  <Phone className="w-4 h-4" />
                  <a className="text-sm text-blue-600 hover:underline" href={`tel:${order.customer.phone}`}>{order.customer.phone}</a>
                </div>
              )}
  <strong>Pickup:</strong> {order.restaurants?.address || "Warehouse address unavailable"}
    </span>
  </div>

  {/* Customer (Dropoff) Address */}
  <div className="flex items-center space-x-2 text-gray-600">
    <MapPin className="w-4 h-4 text-green-500" />
    <span className="text-sm">
      <strong>Dropoff:</strong> {order.delivery_address || "Customer address unavailable"}
    </span>
  </div>

  {/* Delivery Fee */}
  <div className="flex items-center space-x-2 text-gray-600">
    <DollarSign className="w-4 h-4 text-blue-500" />
    <span className="text-sm">
      Base Fee: R{(order.delivery_fee_base ?? order.delivery_fee ?? 0).toFixed(2)}
    </span>
  </div>

  <div className="flex items-center space-x-2 text-gray-600">
    <DollarSign className="w-4 h-4 text-green-500" />
    <span className="text-sm font-semibold">
      Current Offer: R{(order.delivery_fee_offer_customer ?? order.delivery_fee ?? 0).toFixed(2)}
    </span>
  </div>

  {order.delivery_fee_offer_driver != null && (
    <div className="flex items-center space-x-2 text-gray-600">
      <DollarSign className="w-4 h-4 text-purple-500" />
      <span className="text-sm">
        Latest Driver Counter: R{order.delivery_fee_offer_driver.toFixed(2)}
      </span>
    </div>
  )}
</div>
                {!isNegotiationFinalized(order) ? (
                  <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs text-blue-800 mb-2">
                      Accept at current offer or send your own offer first.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="5"
                        step="0.5"
                        placeholder="Your offer"
                        value={driverOfferInputs[order.id] ?? ''}
                        onChange={(e) => setDriverOfferInputs((prev) => ({ ...prev, [order.id]: e.target.value }))}
                        className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => handleDriverCounterOffer(order.id)}
                        className="rounded bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
                      >
                        Offer Price
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="text-xs font-semibold text-green-800">
                      Negotiation finalized at R{(order.delivery_fee_offer_customer ?? order.delivery_fee ?? 0).toFixed(2)}.
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      You can accept this delivery now.
                    </p>
                  </div>
                )}
                <button
                  onClick={() => handleAcceptOrder(order.id)}
                  disabled={acceptingOrderId === order.id}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                    acceptingOrderId === order.id 
                      ? 'bg-gray-400 cursor-not-allowed text-white' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {acceptingOrderId === order.id 
                    ? '⏳ Accepting Order...' 
                    : `Accept Order - Earn R${(order.delivery_fee_offer_customer ?? order.delivery_fee ?? 0).toFixed(2)}`
                  }
                </button>
              </div>
              ))
            )}
          </div>
        )}

        {/* Active Deliveries */}
{/* Active Deliveries */}
{/* Active Deliveries */}
{activeTab === 'active' && (
  <div>
    <h2 className="text-2xl font-bold text-gray-900 mb-6">
      Active Deliveries
    </h2>

    {loading ? (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"></div>
        <p className="text-gray-600 mt-2">Loading deliveries...</p>
      </div>
    ) : activeOrders.length === 0 ? (
      <div className="text-center py-12">
        <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No active deliveries
        </h3>
        <p className="text-gray-600">Accept an order to start delivering!</p>
      </div>
    ) : (
      <div className="space-y-6">
        {activeOrders.map((order: Order) => (
          <div key={order.id} className="bg-white rounded-xl shadow-md p-6">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {order.restaurants?.name || 'Warehouse'}
                </h3>
                <p className="text-gray-600">Delivery #{order.id.slice(0, 8)}</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                  order.status
                )}`}
              >
                {order.status.replace(/_/g, ' ')}
              </span>
            </div>

            {renderDriverOrderItems(order.order_items, '📦 Order Items')}

            {/* Delivery info */}
          <div className="space-y-2 mb-4">
  {/* Delivery Address */}
  <div className="flex items-center space-x-2 text-gray-600">
    <MapPin className="w-4 h-4" />
    <span className="text-sm">{order.delivery_address}</span>
  </div>

  {/* Customer Phone */}
  {order.customer?.phone && (
    <div className="flex items-center space-x-2 text-gray-600">
      <Phone className="w-4 h-4" />
      <span className="text-sm">Phone: {order.customer.phone}</span>
    </div>
  )}

  {/* Delivery Fee */}
  <div className="flex items-center space-x-2 text-gray-600">
    <DollarSign className="w-4 h-4" />
    <span className="text-sm">
      Delivery Fee: R{order.delivery_fee?.toFixed(2) ?? "0.00"}
    </span>
  </div>

  {/* Progress Steps */}
  <div className="bg-gray-50 p-3 rounded-lg mt-4">
    <h4 className="text-sm font-semibold text-gray-700 mb-2">Delivery Progress:</h4>
    <div className="space-y-1">
      <div className={`text-xs flex items-center space-x-2 ${
        ['assigned', 'heading_to_restaurant', 'arrived_at_restaurant', 'picked_up', 'heading_to_customer', 'arrived_at_customer', 'delivered'].includes(order.status) 
          ? 'text-green-600' : 'text-gray-400'
      }`}>
        <span className={`w-2 h-2 rounded-full ${
          ['assigned', 'heading_to_restaurant', 'arrived_at_restaurant', 'picked_up', 'heading_to_customer', 'arrived_at_customer', 'delivered'].includes(order.status) 
            ? 'bg-green-500' : 'bg-gray-300'
        }`}></span>
        <span>1. Order Assigned ✓</span>
      </div>
      <div className={`text-xs flex items-center space-x-2 ${
        ['heading_to_restaurant', 'arrived_at_restaurant', 'picked_up', 'heading_to_customer', 'arrived_at_customer', 'delivered'].includes(order.status) 
          ? 'text-green-600' : order.status === 'assigned' ? 'text-blue-600 font-semibold' : 'text-gray-400'
      }`}>
        <span className={`w-2 h-2 rounded-full ${
          ['heading_to_restaurant', 'arrived_at_restaurant', 'picked_up', 'heading_to_customer', 'arrived_at_customer', 'delivered'].includes(order.status) 
            ? 'bg-green-500' : order.status === 'assigned' ? 'bg-blue-500' : 'bg-gray-300'
        }`}></span>
        <span>2. Head to Restaurant {['heading_to_restaurant', 'arrived_at_restaurant', 'picked_up', 'heading_to_customer', 'arrived_at_customer', 'delivered'].includes(order.status) ? '✓' : order.status === 'assigned' ? '← Current' : ''}</span>
      </div>
      <div className={`text-xs flex items-center space-x-2 ${
        ['arrived_at_restaurant', 'picked_up', 'heading_to_customer', 'arrived_at_customer', 'delivered'].includes(order.status) 
          ? 'text-green-600' : order.status === 'heading_to_restaurant' ? 'text-blue-600 font-semibold' : 'text-gray-400'
      }`}>
        <span className={`w-2 h-2 rounded-full ${
          ['arrived_at_restaurant', 'picked_up', 'heading_to_customer', 'arrived_at_customer', 'delivered'].includes(order.status) 
            ? 'bg-green-500' : order.status === 'heading_to_restaurant' ? 'bg-blue-500' : 'bg-gray-300'
        }`}></span>
        <span>3. Arrive at Restaurant {['arrived_at_restaurant', 'picked_up', 'heading_to_customer', 'arrived_at_customer', 'delivered'].includes(order.status) ? '✓' : order.status === 'heading_to_restaurant' ? '← Current' : ''}</span>
      </div>
      <div className={`text-xs flex items-center space-x-2 ${
        ['picked_up', 'heading_to_customer', 'arrived_at_customer', 'delivered'].includes(order.status) 
          ? 'text-green-600' : order.status === 'arrived_at_restaurant' ? 'text-blue-600 font-semibold' : 'text-gray-400'
      }`}>
        <span className={`w-2 h-2 rounded-full ${
          ['picked_up', 'heading_to_customer', 'arrived_at_customer', 'delivered'].includes(order.status) 
            ? 'bg-green-500' : order.status === 'arrived_at_restaurant' ? 'bg-blue-500' : 'bg-gray-300'
        }`}></span>
        <span>4. Pick Up Order {['picked_up', 'heading_to_customer', 'arrived_at_customer', 'delivered'].includes(order.status) ? '✓' : order.status === 'arrived_at_restaurant' ? '← Current' : ''}</span>
      </div>
      <div className={`text-xs flex items-center space-x-2 ${
        ['heading_to_customer', 'arrived_at_customer', 'delivered'].includes(order.status) 
          ? 'text-green-600' : order.status === 'picked_up' ? 'text-blue-600 font-semibold' : 'text-gray-400'
      }`}>
        <span className={`w-2 h-2 rounded-full ${
          ['heading_to_customer', 'arrived_at_customer', 'delivered'].includes(order.status) 
            ? 'bg-green-500' : order.status === 'picked_up' ? 'bg-blue-500' : 'bg-gray-300'
        }`}></span>
        <span>5. Head to Customer {['heading_to_customer', 'arrived_at_customer', 'delivered'].includes(order.status) ? '✓' : order.status === 'picked_up' ? '← Current' : ''}</span>
      </div>
      <div className={`text-xs flex items-center space-x-2 ${
        ['arrived_at_customer', 'delivered'].includes(order.status) 
          ? 'text-green-600' : order.status === 'heading_to_customer' ? 'text-blue-600 font-semibold' : 'text-gray-400'
      }`}>
        <span className={`w-2 h-2 rounded-full ${
          ['arrived_at_customer', 'delivered'].includes(order.status) 
            ? 'bg-green-500' : order.status === 'heading_to_customer' ? 'bg-blue-500' : 'bg-gray-300'
        }`}></span>
        <span>6. Arrive at Customer {['arrived_at_customer', 'delivered'].includes(order.status) ? '✓' : order.status === 'heading_to_customer' ? '← Current' : ''}</span>
      </div>
      <div className={`text-xs flex items-center space-x-2 ${
        order.status === 'delivered' 
          ? 'text-green-600' : order.status === 'arrived_at_customer' ? 'text-blue-600 font-semibold' : 'text-gray-400'
      }`}>
        <span className={`w-2 h-2 rounded-full ${
          order.status === 'delivered' 
            ? 'bg-green-500' : order.status === 'arrived_at_customer' ? 'bg-blue-500' : 'bg-gray-300'
        }`}></span>
        <span>7. Complete Delivery {order.status === 'delivered' ? '✓' : order.status === 'arrived_at_customer' ? '← Current' : ''}</span>
      </div>
    </div>
  </div>

  {/* Pickup OTP (if set) */}
  {order.pickup_otp && (
    <div className="p-3 bg-yellow-50 border-l-4 border-yellow-200 rounded">
      <div className="text-sm text-gray-800"><strong>📋 Your Pickup OTP for Restaurant:</strong> <span className="font-mono text-lg font-bold text-blue-600">{order.pickup_otp}</span></div>
      {order.pickup_otp_expires_at && (
        <div className="text-xs text-gray-600 mt-1">Expires: {new Date(order.pickup_otp_expires_at).toLocaleString()}</div>
      )}
      <div className="text-xs text-gray-600 mt-1">📋 Show this code to the restaurant staff to collect the order.</div>
    </div>
  )}

  {/* Delivery Instructions - NO OTP shown to driver */}
  {order.delivery_included && (
    <div className="p-3 bg-blue-50 border-l-4 border-blue-200 rounded">
      <div className="text-sm font-semibold text-blue-800">🏠 Delivery Instructions</div>
      <div className="text-xs text-gray-600 mt-1">
        � Delivery Address: {order.delivery_address}
      </div>
      {order.customer?.phone ? (
        <div className="text-xs text-gray-600 mt-1">
          📞 Customer Phone: <a href={`tel:${order.customer.phone}`} className="text-blue-600 hover:underline font-semibold">{order.customer.phone}</a>
        </div>
      ) : (
        <div className="text-xs text-amber-600 mt-1">
          📞 Customer Phone: Not available
          {order.restaurants?.phone && (
            <div className="text-xs text-blue-600 mt-1">
              🏪 Contact Restaurant: <a href={`tel:${order.restaurants.phone}`} className="text-blue-600 hover:underline font-semibold">{order.restaurants.phone}</a>
            </div>
          )}
        </div>
      )}
      <div className="text-xs text-gray-600 mt-1">
        👤 Customer Name: {order.customer?.full_name || 'Not available'}
      </div>
      <div className="text-xs text-gray-600 mt-1">
        🔐 Customer will provide you with a delivery OTP when you arrive.
      </div>
      <div className="text-xs text-red-600 mt-1 font-semibold">
        ⚠️ Do NOT deliver without getting the correct OTP from the customer.
      </div>
    </div>
  )}

  {/* Delivery Type Notice */}
  <div className={`p-3 rounded-lg ${order.delivery_included ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'} border`}>
    <div className="text-sm font-semibold">
      {order.delivery_included ? '🚚 Delivery Order' : '📦 Pickup Only Order'}
    </div>
    <div className="text-xs text-gray-600 mt-1">
      {order.delivery_included 
        ? 'You need to deliver this order to the customer address.'
        : 'Customer will pick up this order from the restaurant - no delivery required.'}
    </div>
  </div>
</div>

            {/* Map container */}
            {showMapFor === order.id && (
              <div className="w-full h-64 rounded-xl overflow-hidden shadow-md mb-4">
                <DeliveryMap
                  restaurantLat={order.restaurant_lat}
                  restaurantLng={order.restaurant_lng}
                  customerLat={order.customer_lat}
                  customerLng={order.customer_lng}
                  onClose={() => setShowMapFor(null)}
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col space-y-3">
              {order.status === 'assigned' && (
                <>
                  <button
                    onClick={() => setShowMapFor(order.id)}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                  >
                    Open Route Preview
                  </button>

                  {showMapFor === order.id && (
                    <button
                      onClick={() => {
                        handleStatusUpdate(order.id, 'heading_to_restaurant').catch(console.error);
                        setNavigatorOrderId(order.id);
                        setNavigatorMode('to_restaurant');
                        setShowMapFor(null);
                      }}
                      className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Start Turn-by-Turn Navigation
                    </button>
                  )}
                </>
              )}

              {/* Show navigation button for heading to restaurant or customer */}
              {(order.status === 'heading_to_restaurant' ||
                order.status === 'arrived_at_restaurant' ||
                (order.status === 'picked_up' && order.delivery_included) ||
                order.status === 'heading_to_customer' ||
                order.status === 'arrived_at_customer') && (
                <button
                  onClick={() => {
                    setNavigatorOrderId(order.id);
                    setNavigatorMode(
                      (order.status === 'heading_to_restaurant' || order.status === 'arrived_at_restaurant')
                        ? 'to_restaurant'
                        : 'to_customer'
                    );
                  }}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                >
                  {(order.status === 'heading_to_restaurant' || order.status === 'arrived_at_restaurant') 
                    ? 'Navigate to Restaurant' 
                    : 'Navigate to Customer'}
                </button>
              )}

              {/* Pickup from Restaurant - Show when driver arrives at restaurant */}
              {(order.status === 'arrived_at_restaurant' || order.status === 'heading_to_restaurant') && order.pickup_otp && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-yellow-800 mb-2">🏪 Ready to pickup from restaurant?</p>
                  <p className="text-xs text-gray-600 mb-3">
                    Show your pickup OTP: <span className="font-mono font-bold text-blue-600">{order.pickup_otp}</span> to the restaurant staff
                  </p>
                  <button
                    onClick={async () => {
                      const confirmation = confirm('Have you shown your pickup OTP to the restaurant and received the order?');
                      if (!confirmation) return;

                      try {
                        // Verify pickup OTP (automatically done when restaurant confirms)
                        if (!order.pickup_otp) {
                          alert('❌ No pickup OTP available. Please contact support.');
                          return;
                        }
                        
                        const success = await verifyPickupOtp?.(order.id, order.pickup_otp);
                        if (success) {
                          alert('✅ Order picked up successfully!');
                          if (order.delivery_included) {
                            // Update status and start navigation to customer
                            await handleStatusUpdate(order.id, 'heading_to_customer');
                            setNavigatorOrderId(order.id);
                            setNavigatorMode('to_customer');
                          } else {
                            alert('📦 Pickup complete! Customer will collect from restaurant.');
                          }
                          // Refresh to show updated status
                          window.location.reload();
                        } else {
                          alert('❌ Error confirming pickup. Please try again.');
                        }
                      } catch (error) {
                        console.error('Error confirming pickup:', error);
                        alert('❌ Error confirming pickup. Please try again.');
                      }
                    }}
                    className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    🏪 Confirm Pickup from Restaurant
                  </button>
                </div>
              )}

              {/* Start delivery to customer - Show after pickup is confirmed */}
              {order.status === 'picked_up' && order.delivery_included && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-green-800 mb-2">📦 Order picked up successfully!</p>
                  <p className="text-xs text-gray-600 mb-3">Ready to deliver to customer?</p>
                  <button
                    onClick={() => {
                      handleStatusUpdate(order.id, 'heading_to_customer').catch(console.error);
                      setNavigatorOrderId(order.id);
                      setNavigatorMode('to_customer');
                    }}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    🚚 Start Delivery to Customer
                  </button>
                </div>
              )}

              {/* Customer Delivery - Only show for delivery orders when picked up */}
              {order.delivery_included && (order.status === 'arrived_at_customer' || order.status === 'heading_to_customer' || order.status === 'picked_up') && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-blue-800 mb-2">🏠 Ready to deliver to customer?</p>
                  <p className="text-xs text-gray-600 mb-3">
                    Ask the customer for their delivery OTP. They should have it on their phone/app.
                  </p>
                  <button
                    onClick={async () => {
                      const otp = prompt('Enter the 6-digit delivery OTP that the customer gave you:');
                      if (!otp) return alert('OTP is required to confirm delivery.');

                      try {
                        const ok = await verifyOtp(order.id, otp.trim());
                        if (!ok) return alert('❌ Invalid delivery OTP. Ask the customer to check their OTP and try again.');

                        alert('✅ Delivery confirmed and earnings recorded!');
                        // Refresh earnings data
                        await fetchDriverEarnings();
                        // Refresh the page to show updated status
                        window.location.reload();
                      } catch (error) {
                        console.error(error);
                        alert('❌ Failed to confirm delivery. Please try again.');
                      }
                    }}
                    className="w-full bg-emerald-600 text-white py-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    🏠 Enter Customer's Delivery OTP
                  </button>
                </div>
              )}

              {/* Pickup Only Orders - Complete when picked up from restaurant */}
              {!order.delivery_included && order.status === 'picked_up' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-green-800 mb-2">📦 Pickup Complete!</p>
                  <p className="text-xs text-gray-600">
                    This was a pickup-only order. The customer will collect it from the restaurant.
                    Your task is complete!
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}

        {/* Earnings */}
{/* Earnings */}
{activeTab === 'earnings' && (
  <div className="space-y-6">
    <h2 className="text-2xl font-bold text-gray-900 mb-6">Earnings</h2>

    {earningsLoading ? (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-2">Loading earnings...</p>
      </div>
    ) : (
      <>
        {/* Earnings Summary */}
        <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Earnings Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-blue-600 font-semibold">Total Deliveries</p>
              <p className="text-2xl font-bold text-blue-800">{earningsData.totalDeliveries}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-green-600 font-semibold">Total Earnings</p>
              <p className="text-2xl font-bold text-green-800">R{earningsData.totalEarnings.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-yellow-700 font-semibold">Withdrawable Amount (75%)</p>
            <p className="text-2xl font-bold text-yellow-800">R{earningsData.withdrawableAmount.toFixed(2)}</p>
            <p className="text-sm text-gray-600 mt-1">Platform fee: R{(earningsData.totalEarnings * 0.25).toFixed(2)}</p>
          </div>
        </div>

        {/* Completed Deliveries List */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Deliveries</h3>
          {completedDeliveries.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No completed deliveries yet</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {completedDeliveries.map((delivery) => (
                <div key={delivery.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      {delivery.restaurants?.name || 'Restaurant'}
                    </p>
                    <p className="text-sm text-gray-600">
                      To: {delivery.customer?.full_name || 'Customer'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(delivery.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      R{(delivery.delivery_fee || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">Earned</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Withdrawal Section */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Request Withdrawal</h3>
          
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="number"
              min={0}
              max={earningsData.withdrawableAmount}
              placeholder="Enter amount to withdraw"
              className="flex-1 border rounded px-3 py-2"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(Number(e.target.value))}
            />
            <button
              onClick={handleWithdrawRequest}
              disabled={earningsData.withdrawableAmount <= 0}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Request Withdrawal
            </button>
          </div>

          {withdrawMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
              <p className="text-sm text-green-700">{withdrawMessage}</p>
            </div>
          )}
        </div>

        {/* Withdrawal History */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Withdrawal History</h3>
          {withdrawals.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No withdrawal requests yet</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {withdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      R{parseFloat(withdrawal.amount).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600">
                      Requested: {new Date(withdrawal.requested_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      ID: {withdrawal.id.substring(0, 8)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      withdrawal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      withdrawal.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                      withdrawal.status === 'paid' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {withdrawal.status.charAt(0).toUpperCase() + withdrawal.status.slice(1)}
                    </span>
                    {withdrawal.processed_at && (
                      <p className="text-xs text-gray-500 mt-1">
                        Processed: {new Date(withdrawal.processed_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    )}
  </div>
)}
      </main>
    </div>
  );
}