function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function normalizeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toErrorStatus(error) {
  if (!error) return "error";
  const message = String(error?.message || "error").trim();
  return `error:${message.slice(0, 120)}`;
}

function normalizeProvider() {
  return String(process.env.ROAD_DISTANCE_PROVIDER || "mock").trim().toLowerCase();
}

function normalizeOsrmBaseUrl() {
  return String(process.env.OSRM_BASE_URL || "https://router.project-osrm.org").trim().replace(/\/$/, "");
}

function mapDestinationResult(id, roadDistanceKm, estimatedTravelMinutes, status = "ok") {
  return {
    id,
    roadDistanceKm: normalizeNumber(roadDistanceKm),
    estimatedTravelMinutes: normalizeNumber(estimatedTravelMinutes),
    status,
  };
}

function sanitizeProviderResult({ origin, destination, roadDistanceKm, estimatedTravelMinutes, status = "ok" }) {
  const normalizedRoadDistanceKm = normalizeNumber(roadDistanceKm);
  const straightLineKm = haversineDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);

  if (
    normalizedRoadDistanceKm === 0 &&
    Number.isFinite(straightLineKm) &&
    straightLineKm > 0.05
  ) {
    return mapDestinationResult(destination.id, null, null, "error:zero_distance_invalid");
  }

  return mapDestinationResult(destination.id, normalizedRoadDistanceKm, estimatedTravelMinutes, status);
}

function resolveMockDistances({ origin, destinations }) {
  return destinations.map((destination) => {
    const straightLineKm = haversineDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);
    const multiplier = straightLineKm < 3 ? 1.35 : 1.25;
    const roadDistanceKm = straightLineKm * multiplier;
    const estimatedTravelMinutes = (roadDistanceKm / 32) * 60;
    return mapDestinationResult(destination.id, roadDistanceKm, estimatedTravelMinutes, "mock");
  });
}

async function resolveOsrmForDestination({ baseUrl, origin, destination, mode }) {
  const profile = mode === "driving" ? "driving" : "driving";
  const url = `${baseUrl}/route/v1/${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return mapDestinationResult(destination.id, null, null, `error:http_${response.status}`);
    }

    const payload = await response.json();
    const route = Array.isArray(payload?.routes) ? payload.routes[0] : null;
    if (!route) {
      return mapDestinationResult(destination.id, null, null, "error:no_route");
    }

    const roadDistanceKm = normalizeNumber(route.distance) != null ? Number(route.distance) / 1000 : null;
    const estimatedTravelMinutes = normalizeNumber(route.duration) != null ? Number(route.duration) / 60 : null;
    return sanitizeProviderResult({
      origin,
      destination,
      roadDistanceKm,
      estimatedTravelMinutes,
      status: "ok",
    });
  } catch (error) {
    return mapDestinationResult(destination.id, null, null, toErrorStatus(error));
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveOsrmDistances({ origin, destinations, mode }) {
  const baseUrl = normalizeOsrmBaseUrl();
  const jobs = destinations.map((destination) =>
    resolveOsrmForDestination({ baseUrl, origin, destination, mode })
  );
  return Promise.all(jobs);
}

function resolveMissingKeySkeleton(provider, destinations, envKeyName) {
  const hasKey = Boolean(String(process.env[envKeyName] || "").trim());
  const status = hasKey ? `${provider}_not_implemented` : `error:missing_${envKeyName.toLowerCase()}`;
  return destinations.map((destination) => mapDestinationResult(destination.id, null, null, status));
}

export async function resolveRoadDistances({ origin, destinations, mode = "driving" }) {
  const originLat = normalizeNumber(origin?.lat);
  const originLng = normalizeNumber(origin?.lng);
  const safeDestinations = Array.isArray(destinations)
    ? destinations.filter((destination) => {
      const lat = normalizeNumber(destination?.lat);
      const lng = normalizeNumber(destination?.lng);
      const id = destination?.id;
      return lat != null && lng != null && id != null;
    }).map((destination) => ({
      id: String(destination.id),
      lat: Number(destination.lat),
      lng: Number(destination.lng),
    }))
    : [];

  if (originLat == null || originLng == null || safeDestinations.length === 0) {
    return safeDestinations.map((destination) => mapDestinationResult(destination.id, null, null, "error:invalid_input"));
  }

  const provider = normalizeProvider();
  const normalizedOrigin = { lat: originLat, lng: originLng };

  if (provider === "osrm") {
    return resolveOsrmDistances({ origin: normalizedOrigin, destinations: safeDestinations, mode });
  }

  if (provider === "google") {
    return resolveMissingKeySkeleton("google", safeDestinations, "GOOGLE_MAPS_API_KEY");
  }

  if (provider === "mapbox") {
    return resolveMissingKeySkeleton("mapbox", safeDestinations, "MAPBOX_ACCESS_TOKEN");
  }

  return resolveMockDistances({ origin: normalizedOrigin, destinations: safeDestinations });
}
