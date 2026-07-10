import { useState, useEffect } from "react";
import { Star, Clock, MapPin, Navigation } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { calculateDistance, estimateRoadDistance, formatDistance, estimateDeliveryTime, formatDeliveryTime } from "../../utils/distance";
import { getCurrentPosition } from "../../utils/location";
import { useJsApiLoader } from "@react-google-maps/api";

export default function BrowseRestaurants() {
  const { profile } = useAuth();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerLocation, setCustomerLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeMetrics, setRouteMetrics] = useState<Record<string, { distanceKm: number; durationMin: number }>>({});

  const formatClosingTime = (closingTime?: string | null) => {
    if (!closingTime) return null;
    const [hours, minutes] = String(closingTime).split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    const dt = new Date();
    dt.setHours(hours, minutes, 0, 0);
    return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const getRestaurantAvailability = (restaurant: any) => {
    if (restaurant?.is_temporarily_closed) {
      return { isClosed: true, message: 'Closed now', badgeClass: 'bg-red-100 text-red-700' };
    }

    if (!restaurant?.closing_time) {
      return { isClosed: false, message: 'Open now', badgeClass: 'bg-emerald-100 text-emerald-700' };
    }

    const [hours, minutes] = String(restaurant.closing_time).split(':').map(Number);
    const now = new Date();
    const closesAt = new Date(now);
    closesAt.setHours(hours, minutes, 0, 0);
    const minutesUntilClose = Math.round((closesAt.getTime() - now.getTime()) / 60000);
    const formatted = formatClosingTime(restaurant.closing_time);

    if (minutesUntilClose <= 0) {
      return { isClosed: true, message: 'Closed now', badgeClass: 'bg-red-100 text-red-700' };
    }

    if (minutesUntilClose <= 60) {
      return {
        isClosed: false,
        message: `Closing soon • Closes at ${formatted}`,
        badgeClass: 'bg-amber-100 text-amber-700',
      };
    }

    return {
      isClosed: false,
      message: `Closes at ${formatted}`,
      badgeClass: 'bg-emerald-100 text-emerald-700',
    };
  };

  const { isLoaded: mapsLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  });

  // Fetch restaurants
  useEffect(() => {
    const fetchRestaurants = async () => {
      const { data, error } = await supabase.from("restaurants").select("*");
      if (error) console.error("Error fetching restaurants:", error);
      else {
        // If no restaurants, add some sample data for testing
        if (!data || data.length === 0) {
          setRestaurants([
            {
              id: '1',
              name: 'QuickBite Central',
              description: 'Fast food and quick meals',
              address: '123 Main Street, Johannesburg Central, 2001',
              phone: '+27 11 123 4567',
              cuisine_type: 'Fast Food',
              rating: 4.2,
              latitude: -26.2041,
              longitude: 28.0473,
              delivery_time: '20-30 min',
              is_active: true
            },
            {
              id: '2',
              name: 'Sandton Grill House',
              description: 'Premium steaks and grilled specialties',
              address: '456 Rivonia Road, Sandton, 2196',
              phone: '+27 11 234 5678',
              cuisine_type: 'Steakhouse',
              rating: 4.5,
              latitude: -26.1076,
              longitude: 28.0567,
              delivery_time: '35-45 min',
              is_active: true
            },
            {
              id: '3',
              name: 'Rosebank Pizza Palace',
              description: 'Authentic wood-fired pizzas',
              address: '789 Oxford Road, Rosebank, 2196',
              phone: '+27 11 345 6789',
              cuisine_type: 'Italian',
              rating: 4.3,
              latitude: -26.1426,
              longitude: 28.0420,
              delivery_time: '25-35 min',
              is_active: true
            }
          ]);
        } else {
          setRestaurants(data || []);
        }
      }
    };
    fetchRestaurants();
  }, []);

  // Get customer location
  useEffect(() => {
    const getLocation = async () => {
      if (profile?.latitude && profile?.longitude) {
        setCustomerLocation({ lat: profile.latitude, lng: profile.longitude });
      }

      setLocationLoading(true);
      try {
        const coords = await getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 18000,
          maximumAge: 0,
          maxAcceptedAgeMs: 15000,
          desiredAccuracyMeters: 150,
        });

        setCustomerLocation({ lat: coords.latitude, lng: coords.longitude });
      } catch (error) {
        console.error('Error getting fresh location:', error);

        if (!(profile?.latitude && profile?.longitude)) {
          const fallbackLocation = { lat: -26.2041, lng: 28.0473 };
          setCustomerLocation(fallbackLocation);
        }
      } finally {
        setLocationLoading(false);
      }
    };
    getLocation();
  }, [profile]);

  // Fetch menus
  useEffect(() => {
    const fetchMenus = async () => {
      const { data, error } = await supabase
        .from("menus")
        .select("*, restaurants(name, id)");
      if (error) console.error(error);
      else setMenus(data || []);
      setLoading(false);
    };
    fetchMenus();
  }, []);

  // Filter menus by search query
  const filteredMenus = menus.filter((item) =>
    [item.name, item.category, item.description]
      .join(" ")
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  // Calculate distance for a restaurant
  const getRestaurantDistance = (restaurant: any) => {
    if (!customerLocation || !restaurant.latitude || !restaurant.longitude) {
      return null;
    }
    
    return estimateRoadDistance(
      calculateDistance(
      customerLocation.lat,
      customerLocation.lng,
      restaurant.latitude,
      restaurant.longitude
      )
    );
  };

  // Get delivery estimate for a restaurant
  const getDeliveryEstimate = (restaurant: any) => {
    const distance = getRestaurantDistance(restaurant);
    if (distance === null) return null;
    return estimateDeliveryTime(distance);
  };

  // helper to create a slug from a restaurant name
  const slug = (name?: string) =>
    (name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  // Robust image error handler: tries a sequence of candidate paths (id.jpg -> slug.jpg -> png -> svg -> placeholder)
 const handleImageError = (e: any, r: any) => {
  const img = e.currentTarget as HTMLImageElement;
  const attempts = parseInt(img.dataset.attempt || "0", 10);
  const candidates = [
    `/images/restaurants/${slug(r.name)}.jpg`,
    `/images/restaurants/${slug(r.name)}.png`,
    `/images/restaurants/${slug(r.name)}.svg`,
    '/images/placeholder-wholesaler.svg', // your local placeholder
  ];

  const next = candidates[attempts];
  if (next) {
    img.dataset.attempt = String(attempts + 1);
    img.onerror = (ev) => handleImageError(ev, r);
    img.src = next;
  } else {
    img.onerror = null;
    img.src = '/images/placeholder-wholesaler.svg';
  }
};

  useEffect(() => {
    const fetchRouteMetrics = async () => {
      if (!mapsLoaded || !customerLocation || restaurants.length === 0 || !window.google?.maps) {
        return;
      }

      const candidates = restaurants.filter(
        (r) => typeof r.latitude === "number" && typeof r.longitude === "number"
      );

      if (!candidates.length) {
        setRouteMetrics({});
        return;
      }

      setRouteLoading(true);

      try {
        const service = new window.google.maps.DistanceMatrixService();
        const origin = new window.google.maps.LatLng(customerLocation.lat, customerLocation.lng);
        const nextMetrics: Record<string, { distanceKm: number; durationMin: number }> = {};

        const chunkSize = 20;
        for (let i = 0; i < candidates.length; i += chunkSize) {
          const chunk = candidates.slice(i, i + chunkSize);

          // eslint-disable-next-line no-await-in-loop
          const response = await new Promise<google.maps.DistanceMatrixResponse>((resolve, reject) => {
            service.getDistanceMatrix(
              {
                origins: [origin],
                destinations: chunk.map((r) => new window.google.maps.LatLng(r.latitude, r.longitude)),
                travelMode: google.maps.TravelMode.DRIVING,
                unitSystem: google.maps.UnitSystem.METRIC,
              },
              (result, status) => {
                if (status === "OK" && result) resolve(result);
                else reject(new Error(`Distance Matrix error: ${status}`));
              }
            );
          });

          const row = response.rows?.[0];
          if (!row) continue;

          row.elements.forEach((el, idx) => {
            if (el.status !== "OK") return;

            const distanceMeters = el.distance?.value;
            const durationSeconds = el.duration?.value;
            if (typeof distanceMeters !== "number" || typeof durationSeconds !== "number") return;

            const restaurant = chunk[idx];
            nextMetrics[restaurant.id] = {
              distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
              durationMin: Math.max(1, Math.round(durationSeconds / 60)),
            };
          });
        }

        setRouteMetrics(nextMetrics);
      } catch (err) {
        console.error("Failed to load route metrics, using fallback estimates:", err);
        setRouteMetrics({});
      } finally {
        setRouteLoading(false);
      }
    };

    fetchRouteMetrics();
  }, [mapsLoaded, customerLocation, restaurants]);

  const getDisplayDistance = (restaurant: any) => {
    const route = routeMetrics[restaurant.id];
    if (route) return route.distanceKm;
    return getRestaurantDistance(restaurant);
  };

  const getDisplayEta = (restaurant: any) => {
    const route = routeMetrics[restaurant.id];
    if (route) return route.durationMin;
    return getDeliveryEstimate(restaurant);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header + Search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Browse Warehouses</h1>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search wholesalers or items by name, category, or description..."
          className="w-full md:w-96 border border-gray-400 bg-white rounded-lg px-4 py-3 shadow focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      
      </div>

      {/* Show search results */}
      {searchQuery ? (
        <div className="mt-6 bg-white p-6 rounded-xl shadow-md">
          <h2 className="font-bold mb-4 text-lg">Search Results for "{searchQuery}"</h2>
          {filteredMenus.length === 0 ? (
            <p className="text-gray-500">No matching items found</p>
          ) : (
            <ul className="space-y-3">
              {filteredMenus.map((item) => (
                <li
                  key={item.id}
                  className="flex justify-between border-b pb-2"
                >
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-gray-600">{item.category} — {item.description}</p>
                    <p className="text-xs text-gray-500">{item.restaurants?.name} (Wholesaler)</p>
                  </div>
                  <span className="font-bold">R{item.price.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        // Default restaurants view
        <>
          <h2 className="text-2xl font-bold mb-4">Available Wholesalers</h2>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {restaurants.map((r) => (
                (() => {
                  const availability = getRestaurantAvailability(r);
                  return (
                <div
                  key={r.id}
                  className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg"
                >
                  <img
  src={
    r.image_url
      ? r.image_url
      : `/images/restaurants/${slug(r.name)}.jpg`
  }
  alt={r.name || "Wholesaler"}
  className="w-full h-48 object-cover"
  data-attempt="0"
  onError={(e) => handleImageError(e, r)}
/>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">{r.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${availability.badgeClass}`}>
                        {availability.message}
                      </span>
                    </div>
                    <p className="text-gray-600">{r.cuisine || "Various"}</p>
                    
                    {/* Location and Distance Info */}
                    {customerLocation && (
                      <div className="flex items-center text-sm text-gray-500 mt-1">
                        <MapPin className="w-3 h-3 mr-1" />
                        <span>{r.address || 'Location not specified'}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center mt-3 text-sm">
                      <span className="flex items-center">
                        <Star className="w-4 h-4 text-yellow-400 mr-1" />
                        {r.rating || "4.0"}
                      </span>
                      
                      {customerLocation && r.latitude && r.longitude ? (
                        <div className="flex items-center space-x-3">
                          <span className="flex items-center text-blue-600">
                            <Navigation className="w-4 h-4 mr-1" />
                            {getDisplayDistance(r) != null ? formatDistance(getDisplayDistance(r) as number) : "-"}
                          </span>
                          <span className="flex items-center text-green-600">
                            <Clock className="w-4 h-4 mr-1" />
                            {getDisplayEta(r) != null ? formatDeliveryTime(getDisplayEta(r) as number) : "-"}
                          </span>
                        </div>
                      ) : (
                        <span className="flex items-center text-gray-500">
                          <Clock className="w-4 h-4 mr-1" />
                          {r.delivery_time || "30-40 min"}
                        </span>
                      )}
                    </div>

                    {locationLoading && (
                      <div className="mt-2 text-xs text-gray-400 flex items-center">
                        <div className="animate-spin w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full mr-2"></div>
                        Getting your location...
                      </div>
                    )}

                    {routeLoading && !locationLoading && (
                      <div className="mt-2 text-xs text-gray-400 flex items-center">
                        <div className="animate-spin w-3 h-3 border border-gray-300 border-t-green-500 rounded-full mr-2"></div>
                        Getting live route distance and ETA...
                      </div>
                    )}
                  </div>
                </div>
                  );
                })()
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}