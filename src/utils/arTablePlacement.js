const DEFAULT_RESTAURANT_GEOFENCE_RADIUS_METERS = 120;
const EARTH_RADIUS_METERS = 6371000;

const toNumberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const hasValidLatLng = (point) => {
  const lat = toNumberOrNull(point?.lat);
  const lng = toNumberOrNull(point?.lng);
  return lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

export const getDistanceMeters = (a, b) => {
  if (!hasValidLatLng(a) || !hasValidLatLng(b)) return null;

  const lat1 = Number(a.lat) * Math.PI / 180;
  const lat2 = Number(b.lat) * Math.PI / 180;
  const dLat = (Number(b.lat) - Number(a.lat)) * Math.PI / 180;
  const dLng = (Number(b.lng) - Number(a.lng)) * Math.PI / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const getRestaurantGeofenceState = ({ currentLocation, restaurantLocation, radiusMeters = DEFAULT_RESTAURANT_GEOFENCE_RADIUS_METERS } = {}) => {
  const distanceMeters = getDistanceMeters(currentLocation, restaurantLocation);
  const normalizedRadius = Math.max(20, Number(radiusMeters) || DEFAULT_RESTAURANT_GEOFENCE_RADIUS_METERS);

  if (distanceMeters == null) {
    return {
      canSaveArPosition: false,
      isInsideRestaurant: false,
      distanceMeters: null,
      radiusMeters: normalizedRadius,
      reason: "LOCATION_UNAVAILABLE",
      warning: "Không thể xác định vị trí hiện tại. Có thể xem AR, nhưng chưa thể lưu vị trí bàn.",
    };
  }

  const isInsideRestaurant = distanceMeters <= normalizedRadius;
  return {
    canSaveArPosition: isInsideRestaurant,
    isInsideRestaurant,
    distanceMeters,
    radiusMeters: normalizedRadius,
    reason: isInsideRestaurant ? null : "OUTSIDE_RESTAURANT",
    warning: isInsideRestaurant
      ? ""
      : "Bạn đang ở ngoài khu vực nhà hàng. Có thể xem AR, nhưng không thể lưu vị trí bàn vào sơ đồ.",
  };
};

const normalizePlanPoint = (point) => {
  const x = toNumberOrNull(point?.x);
  const y = toNumberOrNull(point?.y);
  return x == null || y == null ? null : { x, y };
};

const normalizeArPoint = (point) => {
  const x = toNumberOrNull(point?.x ?? point?.position?.x);
  const z = toNumberOrNull(point?.z ?? point?.position?.z ?? point?.y);
  return x == null || z == null ? null : { x, z };
};

const vectorLength = (v) => Math.sqrt(v.x ** 2 + v.y ** 2);

export const buildArToFloorTransform = ({ arAnchorA, arAnchorB, floorAnchorA, floorAnchorB } = {}) => {
  const arA = normalizeArPoint(arAnchorA);
  const arB = normalizeArPoint(arAnchorB);
  const floorA = normalizePlanPoint(floorAnchorA);
  const floorB = normalizePlanPoint(floorAnchorB);

  if (!arA || !arB || !floorA || !floorB) return null;

  const arVector = { x: arB.x - arA.x, y: arB.z - arA.z };
  const floorVector = { x: floorB.x - floorA.x, y: floorB.y - floorA.y };
  const arDistance = vectorLength(arVector);
  const floorDistance = vectorLength(floorVector);

  if (arDistance < 0.1 || floorDistance < 1) return null;

  const scale = floorDistance / arDistance;
  const arAngle = Math.atan2(arVector.y, arVector.x);
  const floorAngle = Math.atan2(floorVector.y, floorVector.x);
  const rotation = floorAngle - arAngle;

  return {
    scale,
    rotation,
    arOrigin: arA,
    floorOrigin: floorA,
    calibratedAt: new Date().toISOString(),
  };
};

export const mapArPointToFloorPosition = (arPoint, transform) => {
  const point = normalizeArPoint(arPoint);
  if (!point || !transform) return null;

  const dx = point.x - transform.arOrigin.x;
  const dz = point.z - transform.arOrigin.z;
  const cos = Math.cos(transform.rotation);
  const sin = Math.sin(transform.rotation);

  const x = transform.floorOrigin.x + (dx * cos - dz * sin) * transform.scale;
  const y = transform.floorOrigin.y + (dx * sin + dz * cos) * transform.scale;

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return {
    x: Math.round(x),
    y: Math.round(y),
  };
};

export const buildArPlacementMetadata = ({ arPoint, floorPosition, transform, geofenceState, modelKey } = {}) => ({
  arPlacement: {
    modelKey: modelKey || null,
    arPoint: normalizeArPoint(arPoint),
    floorPosition: normalizePlanPoint(floorPosition),
    transform: transform || null,
    geofence: geofenceState || null,
    savedAt: new Date().toISOString(),
  },
});

export const canPersistArTablePosition = ({ geofenceState, transform, floorPosition } = {}) =>
  Boolean(geofenceState?.canSaveArPosition && transform && normalizePlanPoint(floorPosition));
