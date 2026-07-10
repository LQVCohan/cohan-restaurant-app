const TABLE_ROUTE_PATTERN = /^\/table\/([a-f\d]{24})\/([a-f\d]{24})\/?$/i;
const DEVICE_PREFIX = "cohan:table-order:device";
const TOKEN_PREFIX = "cohan:table-order:session-token";

export const TABLE_ORDER_ACCESS_CHANGED_EVENT =
  "cohan:table-order-access-changed";

function storageKey(prefix, restaurantId, tableId) {
  return `${prefix}:${restaurantId}:${tableId}`;
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
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {
    // The page still works in memory; storage is only for refresh continuity.
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
  const key = storageKey(DEVICE_PREFIX, restaurantId, tableId);
  const existing = readSessionStorage(key);
  if (existing) return existing;
  const deviceId = createDeviceId();
  writeSessionStorage(key, deviceId);
  return deviceId;
}

export function readTableOrderSessionToken(restaurantId, tableId) {
  if (!restaurantId || !tableId) return "";
  return readSessionStorage(storageKey(TOKEN_PREFIX, restaurantId, tableId));
}

export function storeTableOrderSessionToken(
  restaurantId,
  tableId,
  token,
) {
  if (!restaurantId || !tableId) return;
  writeSessionStorage(storageKey(TOKEN_PREFIX, restaurantId, tableId), token);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(TABLE_ORDER_ACCESS_CHANGED_EVENT, {
        detail: { restaurantId, tableId, confirmed: Boolean(token) },
      }),
    );
  }
}

export function clearTableOrderSessionToken(restaurantId, tableId) {
  storeTableOrderSessionToken(restaurantId, tableId, "");
}

export function getTableOrderAccessHeaders(pathname) {
  const route = parsePublicTableRoute(
    pathname ||
      (typeof window !== "undefined" ? window.location.pathname : ""),
  );
  if (!route) return {};

  const deviceId = getOrCreateTableOrderDeviceId(
    route.restaurantId,
    route.tableId,
  );
  const token = readTableOrderSessionToken(
    route.restaurantId,
    route.tableId,
  );

  return {
    ...(deviceId ? { "x-table-order-device": deviceId } : {}),
    ...(token ? { "x-table-order-session": token } : {}),
  };
}
