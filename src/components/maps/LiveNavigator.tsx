import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  GoogleMap,
  DirectionsRenderer,
  useJsApiLoader,
} from "@react-google-maps/api";
import type { Order } from "../../contexts/OrdersContext";
import { useDeliveryTracking } from "../../hooks/useDeliveryTracking";

// Keep libraries array as a constant outside the component to prevent reloading
const GOOGLE_MAPS_LIBRARIES: ("marker")[] = ["marker"];

interface LiveNavigatorProps {
  order: Order | undefined;
  mode: "to_restaurant" | "to_customer";
  onClose: () => void;
}

export const LiveNavigator = React.memo<LiveNavigatorProps>(({
  order,
  mode,
  onClose,
}) => {
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [directions, setDirections] =
    useState<google.maps.DirectionsResult | null>(null);
  const [distanceToDestination, setDistanceToDestination] = useState<number | null>(null);
  const [hasArrivedAtRestaurant, setHasArrivedAtRestaurant] = useState(false);
  const [hasArrivedAtCustomer, setHasArrivedAtCustomer] = useState(false);

  const { updateDeliveryStatus } = useDeliveryTracking();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES, // Use the constant array
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const restaurantMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const customerMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Create and update markers using AdvancedMarkerElement
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !driverPos) return;

    // Clean up existing markers
    if (driverMarkerRef.current) {
      driverMarkerRef.current.map = null;
    }
    if (restaurantMarkerRef.current) {
      restaurantMarkerRef.current.map = null;
    }
    if (customerMarkerRef.current) {
      customerMarkerRef.current.map = null;
    }

    // Create driver marker (blue dot that moves)
    const driverElement = document.createElement('div');
    driverElement.style.width = '20px';
    driverElement.style.height = '20px';
    driverElement.style.backgroundColor = '#4285F4';
    driverElement.style.border = '3px solid white';
    driverElement.style.borderRadius = '50%';
    driverElement.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';

    driverMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
      map: mapRef.current,
      position: driverPos,
      content: driverElement,
      title: "Your Location",
    });

    // Create restaurant marker
    if (order) {
      const restaurantElement = document.createElement('div');
      restaurantElement.innerHTML = '🏪';
      restaurantElement.style.fontSize = '24px';
      
      restaurantMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: order.restaurant_lat, lng: order.restaurant_lng },
        content: restaurantElement,
        title: "Restaurant",
      });

      // Create customer marker
      const customerElement = document.createElement('div');
      customerElement.innerHTML = '🏠';
      customerElement.style.fontSize = '24px';
      
      customerMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: order.customer_lat, lng: order.customer_lng },
        content: customerElement,
        title: "Customer",
      });
    }

    // Center map on driver position
    mapRef.current.setCenter(driverPos);
  }, [driverPos, order, isLoaded]);

  // Calculate distance and check arrival
  useEffect(() => {
    if (!driverPos || !order) return;

    const destination = mode === "to_restaurant"
      ? { lat: order.restaurant_lat, lng: order.restaurant_lng }
      : { lat: order.customer_lat, lng: order.customer_lng };

    // Calculate distance using Haversine formula
    const distance = calculateDistance(driverPos, destination);
    setDistanceToDestination(distance);

    // Check if arrived (within 100 meters - increased for better detection)
    const ARRIVAL_THRESHOLD = 0.1; // 100 meters in km (more forgiving)
    
    if (distance < ARRIVAL_THRESHOLD) {
      if (mode === "to_restaurant" && !hasArrivedAtRestaurant) {
        setHasArrivedAtRestaurant(true);
        // Automatically update status to "arrived_at_restaurant"
        updateDeliveryStatus({
          orderId: order.id,
          status: 'arrived_at_restaurant',
          driverLocation: driverPos,
        });
      } else if (mode === "to_customer" && !hasArrivedAtCustomer) {
        setHasArrivedAtCustomer(true);
        // Automatically update status to "arrived_at_customer"
        updateDeliveryStatus({
          orderId: order.id,
          status: 'arrived_at_customer',
          driverLocation: driverPos,
        });
      }
    }
  }, [driverPos, order, mode, hasArrivedAtRestaurant, hasArrivedAtCustomer, updateDeliveryStatus]);

  // Helper function to calculate distance between two points
  const calculateDistance = (pos1: { lat: number; lng: number }, pos2: { lat: number; lng: number }) => {
    const R = 6371; // Earth's radius in km
    const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Track driver location with high accuracy
  useEffect(() => {
    if (!navigator.geolocation) {
      console.error("Geolocation not supported");
      return;
    }

    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDriverPos(newPos);
        
        // Update driver marker position smoothly
        if (driverMarkerRef.current) {
          driverMarkerRef.current.position = newPos;
        }
        
        // Center map on driver (optional, can be made toggleable)
        if (mapRef.current) {
          mapRef.current.panTo(newPos);
        }
      },
      (err) => console.error("Geolocation error:", err),
      { 
        enableHighAccuracy: true, 
        maximumAge: 0, // 0 means no caching, always get fresh location
        timeout: 30000 // 30 seconds timeout
      }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  // Fetch and update directions in real-time
  useEffect(() => {
    if (!driverPos || !order || !isLoaded) return;

    const directionsService = new google.maps.DirectionsService();

    const destination =
      mode === "to_restaurant"
        ? { lat: order.restaurant_lat, lng: order.restaurant_lng }
        : { lat: order.customer_lat, lng: order.customer_lng };

    directionsService.route(
      {
        origin: driverPos,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: false,
        avoidTolls: false,
      },
      (result, status) => {
        if (status === "OK" && result) {
          setDirections(result);
        } else {
          console.error("Directions request failed:", status);
        }
      }
    );
  }, [driverPos, order, mode, isLoaded]);

  // Cleanup markers on unmount
  useEffect(() => {
    return () => {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.map = null;
      }
      if (restaurantMarkerRef.current) {
        restaurantMarkerRef.current.map = null;
      }
      if (customerMarkerRef.current) {
        customerMarkerRef.current.map = null;
      }
    };
  }, []);

  if (!isLoaded) return <div>Loading map...</div>;
  if (!driverPos) return <div>Fetching your location...</div>;

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Header with Close Button and Status */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 flex-shrink-0">
        <div className="flex flex-col">
          <h2 className="font-semibold text-gray-800 text-sm">
            {mode === "to_restaurant" ? "Heading to Restaurant" : "Heading to Customer"}
          </h2>
          {distanceToDestination && (
            <span className="text-xs text-gray-600">
              {distanceToDestination < 1 
                ? `${Math.round(distanceToDestination * 1000)}m away`
                : `${distanceToDestination.toFixed(1)}km away`
              }
            </span>
          )}
          {((mode === "to_restaurant" && hasArrivedAtRestaurant) || 
            (mode === "to_customer" && hasArrivedAtCustomer)) && (
            <span className="text-xs text-green-600 font-semibold">
              ✅ Arrived at destination
            </span>
          )}
        </div>
        <div className="flex space-x-2">
          {/* Manual arrival button if GPS detection fails */}
          {distanceToDestination && distanceToDestination < 0.5 && 
           ((mode === "to_restaurant" && !hasArrivedAtRestaurant) || 
            (mode === "to_customer" && !hasArrivedAtCustomer)) && (
            <button
              onClick={() => {
                if (!order) return;
                
                if (mode === "to_restaurant") {
                  setHasArrivedAtRestaurant(true);
                  updateDeliveryStatus({
                    orderId: order.id,
                    status: 'arrived_at_restaurant',
                    driverLocation: driverPos,
                  });
                } else {
                  setHasArrivedAtCustomer(true);
                  updateDeliveryStatus({
                    orderId: order.id,
                    status: 'arrived_at_customer',
                    driverLocation: driverPos,
                  });
                }
              }}
              className="bg-green-500 text-white px-3 py-1 text-xs rounded-md hover:bg-green-600"
            >
              📍 Mark as Arrived
            </button>
          )}
          <button
            onClick={onClose}
            className="bg-red-500 text-white px-2 py-1 text-xs rounded-md hover:bg-red-600"
          >
            Close
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 w-full">
        <GoogleMap
          center={driverPos}
          zoom={16}
          mapContainerStyle={{ width: "100%", height: "100%" }}
          onLoad={onMapLoad}
          options={{
            mapId: "delivery-map", // Required for Advanced Markers
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            scaleControl: true,
            streetViewControl: false,
            rotateControl: false,
            fullscreenControl: false,
          }}
        >
          {directions && (
            <DirectionsRenderer 
              directions={directions}
              options={{
                suppressMarkers: true, // We're using our custom markers
                polylineOptions: {
                  strokeColor: "#4285F4",
                  strokeWeight: 5,
                  strokeOpacity: 0.8,
                }
              }}
            />
          )}
        </GoogleMap>
      </div>
    </div>
  );
});