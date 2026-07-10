import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import Profile from "./Profile";
import Wallet from "./Wallet";
import Orders from "./Orders";
import Checkout from "./Checkout";
import { Star, Clock ,Home,Search,ClipboardList,Wallet as WalletIcon,ShoppingCart,User, LogOut} from "lucide-react";
import { calculateDistance } from "../../utils/distance";
import { calculateDeliveryFeeFromCart } from "../../utils/deliveryPricing";

export default function CustomerDashboard() {
  const [activeTab, setActiveTab] = useState("home");
  const { profile } = useAuth();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<any | null>(null);
  const [menu, setMenu] = useState<any[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState<any[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);

  const formatClosingTime = (closingTime?: string | null) => {
    if (!closingTime) return null;
    const [hours, minutes] = String(closingTime).split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    const dt = new Date();
    dt.setHours(hours, minutes, 0, 0);
    return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const getRestaurantAvailability = (restaurant: any) => {
    const isTemporarilyClosed = Boolean(restaurant?.is_temporarily_closed);
    const closeLabel = formatClosingTime(restaurant?.closing_time);

    if (isTemporarilyClosed) {
      return {
        isClosed: true,
        message: 'Closed now',
        badgeClass: 'bg-red-100 text-red-700',
      };
    }

    if (!restaurant?.closing_time) {
      return {
        isClosed: false,
        message: 'Open now',
        badgeClass: 'bg-emerald-100 text-emerald-700',
      };
    }

    const [hours, minutes] = String(restaurant.closing_time).split(':').map(Number);
    const now = new Date();
    const closesAt = new Date(now);
    closesAt.setHours(hours, minutes, 0, 0);
    const minutesUntilClose = Math.round((closesAt.getTime() - now.getTime()) / 60000);

    if (minutesUntilClose <= 0) {
      return {
        isClosed: true,
        message: 'Closed now',
        badgeClass: 'bg-red-100 text-red-700',
      };
    }

    if (minutesUntilClose <= 60) {
      return {
        isClosed: false,
        message: `Closing soon • Closes at ${closeLabel}`,
        badgeClass: 'bg-amber-100 text-amber-700',
      };
    }

    return {
      isClosed: false,
      message: `Closes at ${closeLabel}`,
      badgeClass: 'bg-emerald-100 text-emerald-700',
    };
  };

  const userLat = (profile as any)?.latitude;
  const userLng = (profile as any)?.longitude;

  const cartTotal = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
  const deliveryFeePreview =
    selectedRestaurant && cart.length > 0 && profile
      ? calculateDeliveryFeeFromCart(
          calculateDistance(
            selectedRestaurant.latitude,
            selectedRestaurant.longitude,
            userLat,
            userLng
          ),
          cart
        ).fee
      : 0;

  // Fetch restaurants
  useEffect(() => {
    const fetchRestaurants = async () => {
      const { data, error } = await supabase.from("restaurants").select("*");
      if (!error && data) setRestaurants(data);
    };
    fetchRestaurants();
  }, []);

  // Fetch all menu items for search functionality
  useEffect(() => {
    const fetchAllMenuItems = async () => {
      const { data, error } = await supabase
        .from("menus")
        .select("*, restaurants(name, id)");
      if (!error && data) setAllMenuItems(data);
    };
    fetchAllMenuItems();
  }, []);

  // Fetch advertisements
  useEffect(() => {
    const fetchAds = async () => {
      setAdsLoading(true);
      const { data, error } = await supabase
        .from("advertisements")
        .select("*")
        .gte("valid_until", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (!error && data) setAds(data);
      setAdsLoading(false);
    };
    fetchAds();
  }, []);

  // Fetch menu for a restaurant
  const fetchMenu = async (restaurantId: string) => {
    if (selectedRestaurant?.id === restaurantId) {
      setSelectedRestaurant(null);
      setMenu([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("menus")
      .select("*")
      .eq("restaurant_id", restaurantId);
    if (!error && data) {
      setMenu(data);
      setSelectedRestaurant(restaurants.find(r => r.id === restaurantId) || null);
    }
    setLoading(false);
  };

  const addToCart = async (item: any) => {
  if (item.quantity <= 0){
    alert(`${item.name} is out of stock.`);
    return;
  }

  // Add to cart locally
  setCart(prev => {
    const existing = prev.find(i => i.id === item.id);
    if (existing) {
      return prev.map(i =>
        i.id === item.id ? { ...i, quantity: (i.quantity || 1) + 1 } : i
      );
    }
    return [...prev, { ...item, quantity: 1, menu_url: item.image_url }];
  });

  // Decrease quantity in Supabase
  const { error } = await supabase
    .from("menus")
    .update({ quantity: item.quantity - 1 })
    .eq("id", item.id);

  if (error) console.error("Error updating stock:", error);

  // Refetch menu to update UI

};

  const removeFromCart = (itemId: string) => {
    setCart(prev =>
      prev
        .map(i => i.id === itemId ? { ...i, quantity: (i.quantity || 1) - 1 } : i)
        .filter(i => i.quantity > 0)
    );
  };

  // Filter restaurants by name
  const filteredRestaurants = restaurants.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter menu items across all restaurants
  const filteredAllMenuItems = allMenuItems.filter(item =>
    [item.name, item.category, item.description, item.restaurants?.name].join(" ")
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  // Filter menu items for selected restaurant
  const filteredMenu = menu.filter(item =>
    [item.name, item.category, item.description].join(" ")
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  // Determine what to show based on search query
  const showSearchResults = searchQuery.trim().length > 0;
  const restaurantsToShow = showSearchResults ? filteredRestaurants : restaurants;

 return (
   <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/40 pb-24"> {/* extra padding for floating bottom nav */}
      {/* Profile button top-left */}
{/* FIXED TOP NAV BAR */}
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur flex justify-between items-center px-4 py-2">
        {/* Profile button */}
        <button
          onClick={() => setActiveTab("profile")}
          className={`p-2 rounded-full ${
            activeTab === "profile"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          <User className="w-6 h-6" />
        </button>

        {/* Sign Out button */}
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/";
          }}
          className="inline-flex items-center space-x-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* add top padding so content doesn't hide under navbar */}
      <div className="pt-16 p-4"></div>

      {/* MAIN CONTENT */}
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        {/* HOME / ADS */}
        {activeTab === "home" && (
          <div>
            <h1 className="text-2xl font-bold mb-4">Promotions & Combos</h1>
            {adsLoading ? (
              <p>Loading promotions...</p>
            ) : ads.length === 0 ? (
              <p>No current promotions.</p>
            ) : (
              <ul className="space-y-4">
                {ads.map((ad) => (
                  <li
                    key={ad.id}
                    className="border rounded-lg p-4 bg-gray-50 flex space-x-4"
                  >
                    {ad.image_url && (
                      <img
                        src={ad.image_url}
                        alt={ad.title}
                        className="w-24 h-24 object-cover rounded"
                      />
                    )}
                    <div>
                      <h2 className="font-semibold text-lg">{ad.title}</h2>
                      <p className="text-gray-600">{ad.description}</p>
                      <p className="text-sm text-gray-400">
                        {new Date(ad.created_at).toLocaleDateString()} -{" "}
                        {ad.valid_until
                          ? new Date(ad.valid_until).toLocaleDateString()
                          : "No expiry"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* BROWSE */}
        {activeTab === "browse" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold">Browse Warehouses</h1>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search wholesalers or menu items..."
                className="ml-4 border px-3 py-2 rounded w-1/2"
              />
            </div>

            {/* Search Results for Menu Items */}
            {showSearchResults && filteredAllMenuItems.length > 0 && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-3">🔍 Menu Items matching "{searchQuery}"</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredAllMenuItems.slice(0, 6).map((item) => (
                    <div key={item.id} className="bg-white rounded-lg p-3 shadow-sm border">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{item.name}</h4>
                          <p className="text-sm text-gray-600">{item.category}</p>
                          <p className="text-xs text-blue-600">{item.restaurants?.name}</p>
                          <p className="text-sm text-green-600 font-semibold mt-1">R{item.price.toFixed(2)}</p>
                        </div>
                        <img
                          src={item.image_url || "/images/placeholder-item.svg"}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded ml-2"
                        />
                      </div>
                      <button
                        className="mt-2 w-full bg-blue-600 text-white text-sm py-1 px-2 rounded hover:bg-blue-700"
                        onClick={() => {
                          const restaurant = restaurants.find(r => r.id === item.restaurant_id);
                          if (restaurant) {
                            fetchMenu(restaurant.id);
                            setSearchQuery(""); // Clear search to show full menu
                          }
                        }}
                      >
                        View at {item.restaurants?.name}
                      </button>
                    </div>
                  ))}
                </div>
                {filteredAllMenuItems.length > 6 && (
                  <p className="text-sm text-gray-600 mt-2">...and {filteredAllMenuItems.length - 6} more items</p>
                )}
              </div>
            )}

            <ul className="space-y-4">
              {restaurantsToShow.map((r) => {
                const availability = getRestaurantAvailability(r);

                return (
                  <li
                    key={r.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <img
                      src={r.image_url || "/images/placeholder-warehouse.svg"}
                      alt={r.name}
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold">{r.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${availability.badgeClass}`}>
                          {availability.message}
                        </span>
                      </div>
                      <p className="text-gray-600">{r.cuisine || "Various"}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span>
                          {r.rating || "4.0"}{" "}
                          <Star className="w-4 h-4 text-yellow-400 inline" />
                        </span>
                        <span>
                          {r.delivery_time || "30-40 min"}{" "}
                          <Clock className="w-4 h-4 inline" />
                        </span>
                      </div>
                      <button
                        className={`mt-3 rounded-lg px-3 py-1.5 text-sm font-medium text-white ${availability.isClosed ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                        onClick={() => fetchMenu(r.id)}
                        disabled={availability.isClosed}
                      >
                        {availability.isClosed ? 'Currently Closed' : (selectedRestaurant?.id === r.id ? "Hide Menu" : "View Menu")}
                      </button>
                    </div>

                    {selectedRestaurant?.id === r.id && (
                      <div className="m-4 rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-inner">
                        {availability.isClosed ? (
                          <p className="text-sm font-medium text-red-600">This restaurant is currently closed.</p>
                        ) : loading ? (
                          <p>Loading menu...</p>
                        ) : menu.length === 0 ? (
                          <p>No menu items found.</p>
                        ) : (
                          <ul className="space-y-2">
                            {filteredMenu.map((item) => (
                              <li
                                key={item.id}
                                className="flex justify-between items-center border-b py-2"
                              >
                                <div className="flex items-center space-x-3">
                                  <img
                                    src={item.image_url || "/images/placeholder-item.svg"}
                                    alt={item.name}
                                    className="w-12 h-12 object-cover rounded"
                                  />
                                  <div>
                                    <p className="font-semibold">{item.name}</p>
                                    <p className="text-sm text-gray-600">
                                      {item.category} — {item.description}
                                    </p>
                                    {item.quantity <= 0 ? (
                                      <p className="text-xs text-red-500">
                                        In stock: {item.quantity}
                                      </p>
                                    ) : (
                                      <p className="text-xs text-green-600">
                                        In stock: {item.quantity}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold">
                                    R{item.price.toFixed(2)}
                                  </span>
                                  <button
                                    className="bg-green-500 text-white px-2 py-1 rounded"
                                    onClick={() => addToCart(item)}
                                    disabled={item.quantity <= 0 || availability.isClosed}
                                  >
                                    Add
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
              
              {/* No results message */}
              {showSearchResults && restaurantsToShow.length === 0 && filteredAllMenuItems.length === 0 && (
                <div className="text-center py-8 bg-gray-100 rounded-lg">
                  <p className="text-gray-600">No wholesalers or menu items found for "{searchQuery}"</p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-2 text-blue-600 hover:underline"
                  >
                    Clear search
                  </button>
                </div>
              )}
            </ul>

            {/* Cart */}
            {cart.length > 0 && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-xl font-bold mb-3">Your Cart</h2>
                <ul className="space-y-2">
                  {cart.map((item, index) => (
                    <li
                      key={index}
                      className="flex justify-between items-center border-b py-2"
                    >
                      <div className="flex items-center space-x-3">
                        <img
                          src={item.menu_url || "/images/placeholder-item.svg"}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      </div>
                      <span>
                        {item.name} x {item.quantity || 1}
                      </span>
                      <span>
                        R{(item.price * (item.quantity || 1)).toFixed(2)}
                      </span>
                      <button
                        className="rounded bg-red-500 px-2 py-1 text-white hover:bg-red-600"
                        onClick={() => removeFromCart(item.id)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-semibold">
                  Total: R{(cartTotal + deliveryFeePreview).toFixed(2)}
                </p>
                <p className="mt-2 font-semibold">
                  Estimated Delivery Fee: R{deliveryFeePreview.toFixed(2)}
                </p>
                <p className="mt-1 font-bold">
                  Estimated Total: R{(cartTotal + deliveryFeePreview).toFixed(2)}
                </p>
                <button
                  onClick={() => setActiveTab("checkout")}
                  className="mt-4 w-full rounded-lg bg-blue-600 py-2 font-semibold text-white hover:bg-blue-700"
                >
                  Checkout
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "orders" && <Orders />}
        {activeTab === "wallet" && <Wallet />}
        {activeTab === "profile" && <Profile />}
        {activeTab === "checkout" && (
          <Checkout
            cart={cart}
            selectedRestaurant={selectedRestaurant}
            onOrderPlaced={() => {
              setCart([]);
              setActiveTab("orders");
            }}
          />
        )}
      </div>

      {/* STYLISH FLOATING BOTTOM NAV */}
      <div className="fixed bottom-4 left-1/2 z-40 flex w-[92%] max-w-md -translate-x-1/2 items-center justify-between rounded-2xl border border-slate-200 bg-white/95 px-6 py-3 shadow-lg backdrop-blur">
        <button
          onClick={() => setActiveTab("home")}
          className={`flex flex-col items-center transition ${
            activeTab === "home" ? "text-blue-600" : "text-gray-500"
          }`}
        >
          <Home className="w-6 h-6" />
          <span className="text-xs mt-1">Home</span>
        </button>
        <button
          onClick={() => setActiveTab("browse")}
          className={`flex flex-col items-center transition ${
            activeTab === "browse" ? "text-blue-600" : "text-gray-500"
          }`}
        >
          <Search className="w-6 h-6" />
          <span className="text-xs mt-1">Browse</span>
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex flex-col items-center transition ${
            activeTab === "orders" ? "text-blue-600" : "text-gray-500"
          }`}
        >
          <ClipboardList className="w-6 h-6" />
          <span className="text-xs mt-1">Orders</span>
        </button>
        <button
          onClick={() => setActiveTab("wallet")}
          className={`flex flex-col items-center transition ${
            activeTab === "wallet" ? "text-blue-600" : "text-gray-500"
          }`}
        >
          <WalletIcon className="w-6 h-6" />
          <span className="text-xs mt-1">Wallet</span>
        </button>
        <button
          onClick={() => setActiveTab("checkout")}
          className={`flex flex-col items-center transition ${
            activeTab === "checkout" ? "text-blue-600" : "text-gray-500"
          }`}
        >
          <ShoppingCart className="w-6 h-6" />
          <span className="text-xs mt-1">Cart</span>
        </button>
      </div>
    </div>
  );
}