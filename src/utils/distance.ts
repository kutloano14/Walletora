/**
 * Calculate the distance between two geographic points using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

/**
 * Straight-line distance is usually shorter than actual road travel distance.
 * This applies a practical multiplier so customer-facing distances and ETAs
 * feel closer to real delivery travel.
 */
export function estimateRoadDistance(distanceKm: number): number {
  const safeDistance = Math.max(0, distanceKm);

  let multiplier = 1.18;
  if (safeDistance > 5) multiplier = 1.24;
  if (safeDistance > 12) multiplier = 1.3;

  return Math.round(safeDistance * multiplier * 10) / 10;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Format distance for display
 * @param distance Distance in kilometers
 * @returns Formatted string (e.g., "1.2 km", "950 m")
 */
export function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }
  return `${distance} km`;
}

/**
 * Estimate delivery time based on distance
 * @param distance Distance in kilometers
 * @returns Estimated time in minutes
 */
export function estimateDeliveryTime(distance: number): number {
  const roadDistance = estimateRoadDistance(distance);

  // Includes dispatch/packing/pickup overhead plus travel time that scales
  // more realistically than the previous flat straight-line formula.
  let etaMinutes = 12;

  if (roadDistance <= 2) {
    etaMinutes += roadDistance * 6;
  } else if (roadDistance <= 6) {
    etaMinutes += 12 + (roadDistance - 2) * 5;
  } else {
    etaMinutes += 32 + (roadDistance - 6) * 4.5;
  }

  return Math.round(etaMinutes);
}

/**
 * Format delivery time for display
 * @param minutes Time in minutes
 * @returns Formatted string (e.g., "25-35 min")
 */
export function formatDeliveryTime(minutes: number): string {
  const min = minutes - 5;
  const max = minutes + 5;
  return `${min}-${max} min`;
}