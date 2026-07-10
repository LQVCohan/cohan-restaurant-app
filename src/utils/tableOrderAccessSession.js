const TABLE_ROUTE_PATTERN = /^\/table\/([a-f\d]{24})\/([a-f\d]{24})\/?$/i;
const DEVICE_PREFIX = "cohan:table-order:device";

function storageKey(restaurantId, tableId) {
  return `${DEVICE_PREFIX}:${restaurantId}:${tableId}`;
}

function readSessionStorage(key) {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeSessionStorage(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // The verification remains usable in memory when storage is unavailable.
  }
}

function createDeviceId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `table-device-${globalThis.crypto.randomUUID()}`;
  }
  return `table-device-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

export function parsePublicTableRoute(pathname) {
  const match = String(pathname || "").match(TABLE_ROUTE_PATTERN);
  if (!match) return null;
  return { restaurantId: match[1], tableId: match[2] };
}

export function getOrCreateTableOrderDeviceId(restaurantId, tableId) {
  if (!restaurantId || !tableId) return "";
  const key = storageKey(restaurantId, tableId);
  const existing = readSessionStorage(key);
  if (existing) return existing;
  const deviceId = createDeviceId();
  writeSessionStorage(key, deviceId);
  return deviceId;
}
