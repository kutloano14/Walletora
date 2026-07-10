export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodeResult {
  address: string;
  latitude: number;
  longitude: number;
}

interface FreshLocationOptions extends PositionOptions {
  maxAcceptedAgeMs?: number;
  desiredAccuracyMeters?: number;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

export function getCurrentPosition(options?: FreshLocationOptions): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }

    const maxAcceptedAgeMs = options?.maxAcceptedAgeMs ?? 15000;
    const desiredAccuracyMeters = options?.desiredAccuracyMeters ?? 150;
    const timeoutMs = options?.timeout ?? 20000;
    const startedAt = Date.now();
    let watchId: number | null = null;
    let settled = false;
    let bestPosition: GeolocationPosition | null = null;

    const cleanup = () => {
      window.clearTimeout(fallbackTimer);
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };

    const finishSuccess = (position: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    };

    const finishError = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    const isFreshEnough = (position: GeolocationPosition) => {
      const age = Date.now() - position.timestamp;
      const accuracy = position.coords.accuracy ?? Number.POSITIVE_INFINITY;
      return age <= maxAcceptedAgeMs && accuracy <= desiredAccuracyMeters;
    };

    const considerPosition = (position: GeolocationPosition) => {
      if (!bestPosition || (position.coords.accuracy ?? Number.POSITIVE_INFINITY) < (bestPosition.coords.accuracy ?? Number.POSITIVE_INFINITY)) {
        bestPosition = position;
      }

      if (isFreshEnough(position)) {
        finishSuccess(position);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        if (bestPosition) {
          finishSuccess(bestPosition);
        } else {
          finishError("Could not get a fresh current location. Please turn on GPS/location services and try again.");
        }
      }
    };

    const fallbackTimer = window.setTimeout(() => {
      if (bestPosition) {
        finishSuccess(bestPosition);
      } else {
        finishError("Location request timed out. Please turn on GPS/location services and try again.");
      }
    }, timeoutMs + 1000);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        considerPosition(position);
      },
      (error) => {
        if (bestPosition) {
          finishSuccess(bestPosition);
        } else {
          finishError(error.message || "Could not get your location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
        ...options,
      }
    );
  });
}

export async function reverseGeocode(coords: Coordinates): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
    String(coords.latitude)
  )}&lon=${encodeURIComponent(String(coords.longitude))}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Reverse geocoding failed.");
  }

  const data = await response.json();
  return data?.display_name || `${coords.latitude}, ${coords.longitude}`;
}

export async function searchAddress(query: string): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(trimmed)}&limit=5`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Address search failed.");
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return data
    .map((item: any) => ({
      address: String(item.display_name || "").trim(),
      latitude: Number(item.lat),
      longitude: Number(item.lon),
    }))
    .filter((item: GeocodeResult) => item.address && Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
}
