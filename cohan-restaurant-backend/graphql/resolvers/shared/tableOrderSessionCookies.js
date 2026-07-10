import process from "node:process";

const TOKEN_COOKIE_PREFIX = "cohan_table_order_session_";
const DEVICE_COOKIE_PREFIX = "cohan_table_order_device_";

function normalizeTableId(tableId) {
  const value = String(tableId || "").trim().toLowerCase();
  return /^[a-f\d]{24}$/.test(value) ? value : "";
}

function tokenCookieName(tableId) {
  const normalized = normalizeTableId(tableId);
  return normalized ? `${TOKEN_COOKIE_PREFIX}${normalized}` : "";
}

function deviceCookieName(tableId) {
  const normalized = normalizeTableId(tableId);
  return normalized ? `${DEVICE_COOKIE_PREFIX}${normalized}` : "";
}

function getRequest(ctx) {
  return ctx?.request || ctx?.req || null;
}

export function withTableOrderSessionCookieCredentials(ctx, tableId) {
  const request = getRequest(ctx);
  const tokenName = tokenCookieName(tableId);
  const deviceName = deviceCookieName(tableId);
  if (!request || !tokenName || !deviceName) return ctx;

  const token = request.cookies?.[tokenName];
  const deviceId = request.cookies?.[deviceName];
  if (!token && !deviceId) return ctx;

  const nextRequest = {
    ...request,
    headers: {
      ...(request.headers || {}),
      ...(token ? { "x-table-order-session": token } : {}),
      ...(deviceId ? { "x-table-order-device": deviceId } : {}),
    },
  };

  return {
    ...ctx,
    request: nextRequest,
    ...(ctx?.req ? { req: nextRequest } : {}),
  };
}

export function setTableOrderSessionCookies(
  ctx,
  { tableId, orderSessionToken, deviceId, expiresAt },
) {
  const reply = ctx?.reply;
  const tokenName = tokenCookieName(tableId);
  const deviceName = deviceCookieName(tableId);
  if (!reply?.setCookie || !tokenName || !deviceName) return false;

  const isProduction =
    String(process.env.NODE_ENV || "development").toLowerCase() === "production";
  const expiresTime = expiresAt ? new Date(expiresAt).getTime() : 0;
  const maxAge = Math.max(
    60,
    Math.floor(((Number.isFinite(expiresTime) ? expiresTime : 0) - Date.now()) / 1000),
  );
  const options = {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: String(
      process.env.TABLE_ORDER_COOKIE_SAMESITE || "lax",
    ).toLowerCase(),
    maxAge,
  };

  reply.setCookie(tokenName, orderSessionToken, options);
  reply.setCookie(deviceName, deviceId, options);
  return true;
}

export const __testables = {
  tokenCookieName,
  deviceCookieName,
  normalizeTableId,
};
