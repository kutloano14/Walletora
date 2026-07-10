import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Fix default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface DeliveryMapProps {
  restaurantLat: number | null;
  restaurantLng: number | null;
  customerLat: number | null;
  customerLng: number | null;
  onClose: () => void;
}

export const DeliveryMap: React.FC<DeliveryMapProps> = ({
  restaurantLat,
  restaurantLng,
  customerLat,
  customerLng,
}) => {
  if (
    restaurantLat === null ||
    restaurantLng === null ||
    customerLat === null ||
    customerLng === null
  ) {
    return (
      <div className="text-center text-gray-500 py-6">
        Map cannot be displayed because coordinates are missing.
      </div>
    );
  }

  const centerLat = (restaurantLat + customerLat) / 2;
  const centerLng = (restaurantLng + customerLng) / 2;

  return (
    <div className="w-full h-64 rounded-xl overflow-hidden shadow-md mb-4">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[restaurantLat, restaurantLng]}>
          <Popup>Restaurant</Popup>
        </Marker>

        <Marker position={[customerLat, customerLng]}>
          <Popup>Customer</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};