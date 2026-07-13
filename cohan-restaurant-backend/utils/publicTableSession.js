import jwt from "jsonwebtoken";
import process from "process";

import { ORDER_KIND } from "./orderLifecycle.js";
import { parseDurationMs } from "../src/utils/duration.js";

export const TABLE_ACCESS_TOKEN_ERROR = "Invalid table access token";
export const TABLE_ACCESS_TOKEN_PURPOSE = "customer_table";
export const TABLE_IDENTITY_TOKEN_ERROR = "Invalid table identity token";
export const TABLE_IDENTITY_CHALLENGE_PURPOSE = "customer_table_identity_challenge";
export const TABLE_IDENTITY_CANDIDATE_PURPOSE = "customer_table_identity_candidate";
export const TABLE_IDENTITY_PURPOSE = "customer_table_identity";

const ACTIVE_CUSTOMER_REQUEST_STATUSES = new Set(["PENDING", "ACKNOWLEDGED"]);
const ORDERABLE_TABLE_STATUSES = new Set([
  "available",
  "reserved",
  "occupied",
  "payment_pending",
]);

function toIdString(value) {
  if (!value) return null;
  return String(value);
}

export function normalizePublicTableCode(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

export function normalizePublicPhone(value) {
  let phone = String(value || "").trim().replace(/[\s.-]+/g, "");
  if (phone.startsWith("+84")) phone = `0${phone.slice(3)}`;
  else if (phone.startsWith("84")) phone = `0${phone.slice(2)}`;
  if (!/^0\d{9,10}$/.test(phone)) {
    throw new Error("Số điện thoại không hợp lệ.");
  }
  return phone;
}

export function maskPublicPhone(value) {
  const phone = String(value || "");
  if (phone.length <= 4) return "****";
  return `${"*".repeat(phone.length - 4)}${phone.slice(-4)}`;
}

export function maskPublicCustomerName(value) {
  const parts = String(value || "Khách hàng").trim().split(/\s+/).filter(Boolean);
  return parts
    .map((part, index) => (index === 0 ? part : `${part.slice(0, 1)}***`))
    .join(" ");
}

function getTableAccessTokenSecret() {
  const secret = String(
    process.env.TABLE_ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "",
  ).trim();

  if (!secret) {
    throw new Error(TABLE_ACCESS_TOKEN_ERROR);
  }

  return secret;
}

function getTableAccessTokenIssuer() {
  return process.env.JWT_ISSUER || "cohan-system";
}

function normalizeTokenExpiresIn(value, fallback = "8h") {
  const expiresIn = String(value || fallback).trim() || fallback;
  parseDurationMs(expiresIn, fallback);
  return expiresIn;
}

function getTableAccessTokenExpiresIn(expiresIn) {
  return normalizeTokenExpiresIn(
    expiresIn || process.env.TABLE_ACCESS_TOKEN_EXPIRES_IN,
    "8h",
  );
}

function signScopedTableToken(payload, expiresIn) {
  return jwt.sign(payload, getTableAccessTokenSecret(), {
    expiresIn,
    issuer: getTableAccessTokenIssuer(),
  });
}

function verifyScopedTableToken(token, expectedPurpose) {
  const rawToken = String(token || "").trim();
  if (!rawToken) throw new Error(TABLE_IDENTITY_TOKEN_ERROR);

  try {
    const payload = jwt.verify(rawToken, getTableAccessTokenSecret(), {
      issuer: getTableAccessTokenIssuer(),
    });
    const purpose = String(payload?.p || "").trim();
    const restaurantId = String(payload?.rid || "").trim();
    const tableId = String(payload?.tid || "").trim();
    if (purpose !== expectedPurpose || !restaurantId || !tableId) {
      throw new Error(TABLE_IDENTITY_TOKEN_ERROR);
    }
    return {
      purpose,
      restaurantId,
      tableId,
      phone: payload?.ph ? String(payload.ph) : null,
      customerId: payload?.cid ? String(payload.cid) : null,
      isGuest: Boolean(payload?.g),
      expiresAt: payload?.exp
        ? new Date(Number(payload.exp) * 1000).toISOString()
        : null,
    };
  } catch (_error) {
    throw new Error(TABLE_IDENTITY_TOKEN_ERROR);
  }
}

export function getPublicTableDemoOtp() {
  if (String(process.env.NODE_ENV || "development").toLowerCase() === "production") {
    throw new Error("OTP demo không khả dụng trong môi trường production.");
  }
  const otp = String(process.env.TABLE_QR_DEMO_OTP || "123456").trim();
  if (!/^\d{6}$/.test(otp)) {
    throw new Error("TABLE_QR_DEMO_OTP phải gồm 6 chữ số.");
  }
  return otp;
}

export function signTableIdentityChallenge({ restaurantId, tableId, phone } = {}) {
  const rid = toIdString(restaurantId);
  const tid = toIdString(tableId);
  const normalizedPhone = normalizePublicPhone(phone);
  if (!rid || !tid) throw new Error(TABLE_IDENTITY_TOKEN_ERROR);
  return signScopedTableToken(
    { p: TABLE_IDENTITY_CHALLENGE_PURPOSE, rid, tid, ph: normalizedPhone },
    normalizeTokenExpiresIn(process.env.TABLE_QR_OTP_TTL || "5m", "5m"),
  );
}

export function verifyTableIdentityChallenge(token) {
  const payload = verifyScopedTableToken(token, TABLE_IDENTITY_CHALLENGE_PURPOSE);
  if (!payload.phone) throw new Error(TABLE_IDENTITY_TOKEN_ERROR);
  return payload;
}

export function signTableIdentityCandidate({ restaurantId, tableId, phone, customerId } = {}) {
  const rid = toIdString(restaurantId);
  const tid = toIdString(tableId);
  const cid = toIdString(customerId);
  if (!rid || !tid || !cid) throw new Error(TABLE_IDENTITY_TOKEN_ERROR);
  return signScopedTableToken(
    {
      p: TABLE_IDENTITY_CANDIDATE_PURPOSE,
      rid,
      tid,
      ph: normalizePublicPhone(phone),
      cid,
    },
    normalizeTokenExpiresIn(process.env.TABLE_QR_IDENTITY_CONFIRM_TTL || "5m", "5m"),
  );
}

export function verifyTableIdentityCandidate(token) {
  const payload = verifyScopedTableToken(token, TABLE_IDENTITY_CANDIDATE_PURPOSE);
  if (!payload.phone || !payload.customerId) throw new Error(TABLE_IDENTITY_TOKEN_ERROR);
  return payload;
}

export function signTableIdentityToken({ restaurantId, tableId, customerId, isGuest } = {}) {
  const rid = toIdString(restaurantId);
  const tid = toIdString(tableId);
  const cid = toIdString(customerId);
  if (!rid || !tid || !cid) throw new Error(TABLE_IDENTITY_TOKEN_ERROR);
  return signScopedTableToken(
    { p: TABLE_IDENTITY_PURPOSE, rid, tid, cid, g: Boolean(isGuest) },
    normalizeTokenExpiresIn(process.env.TABLE_QR_IDENTITY_TTL || "8h", "8h"),
  );
}

export function verifyTableIdentityToken(token) {
  const payload = verifyScopedTableToken(token, TABLE_IDENTITY_PURPOSE);
  if (!payload.customerId) throw new Error(TABLE_IDENTITY_TOKEN_ERROR);
  return payload;
}

export function signTableAccessToken({ restaurantId, tableId, tableCode, expiresIn } = {}) {
  const normalizedRestaurantId = toIdString(restaurantId);
  const normalizedTableId = toIdString(tableId);

  if (!normalizedRestaurantId || !normalizedTableId) {
    throw new Error(TABLE_ACCESS_TOKEN_ERROR);
  }

  const payload = {
    p: TABLE_ACCESS_TOKEN_PURPOSE,
    rid: normalizedRestaurantId,
    tid: normalizedTableId,
  };

  const normalizedTableCode = normalizePublicTableCode(tableCode);
  if (normalizedTableCode) {
    payload.tc = normalizedTableCode;
  }

  return jwt.sign(payload, getTableAccessTokenSecret(), {
    expiresIn: getTableAccessTokenExpiresIn(expiresIn),
    issuer: getTableAccessTokenIssuer(),
  });
}

export function verifyTableAccessToken(token) {
  const rawToken = String(token || "").trim();
  if (!rawToken) {
    throw new Error(TABLE_ACCESS_TOKEN_ERROR);
  }

  try {
    const payload = jwt.verify(rawToken, getTableAccessTokenSecret(), {
      issuer: getTableAccessTokenIssuer(),
    });

    const purpose = String(payload?.p || payload?.purpose || "").trim();
    const restaurantId = String(payload?.rid || payload?.restaurantId || "").trim();
    const tableId = String(payload?.tid || payload?.tableId || "").trim();

    if (
      purpose !== TABLE_ACCESS_TOKEN_PURPOSE ||
      !restaurantId ||
      !tableId
    ) {
      throw new Error(TABLE_ACCESS_TOKEN_ERROR);
    }

    return {
      purpose,
      restaurantId,
      tableId,
      tableCode: normalizePublicTableCode(payload?.tc || payload?.tableCode),
      expiresAt: payload?.exp
        ? new Date(Number(payload.exp) * 1000).toISOString()
        : null,
    };
  } catch (_error) {
    throw new Error(TABLE_ACCESS_TOKEN_ERROR);
  }
}

export function getPublicTableOrderCapability({ tableStatus, session } = {}) {
  const normalizedTableStatus = String(tableStatus || "").toLowerCase();
  const sessionStatus = String(session?.sessionStatus || "").toLowerCase();
  const paymentStatus = String(
    session?.orderPaymentStatus || session?.payment?.status || "",
  ).toLowerCase();

  if (!ORDERABLE_TABLE_STATUSES.has(normalizedTableStatus)) {
    return {
      canOrder: false,
      reason: "Bàn hiện chưa sẵn sàng nhận thêm món.",
    };
  }

  if (["ready_to_pay", "closed", "cancelled"].includes(sessionStatus)) {
    return { canOrder: false, reason: "Bàn đang hoàn tất thanh toán nên chưa thể gọi thêm món." };
  }

  if (["payment_requested", "paid"].includes(paymentStatus)) {
    return { canOrder: false, reason: "Bàn đã yêu cầu thanh toán nên chưa thể gọi thêm món." };
  }

  return { canOrder: true, reason: null };
}

function mapPublicPayment(payment) {
  if (!payment) {
    return null;
  }

  return {
    status: payment.status || null,
    requestedAt: payment.requestedAt || null,
  };
}

function mapPublicTotals(totals) {
  return {
    grandTotal: Number(totals?.grandTotal || 0),
  };
}

function requiresPublicProof(item = {}) {
  const mode = String(item?.servingVariant?.mode || "").toUpperCase();
  const unit = String(item?.unit || item?.servingVariant?.sellUnit || "").toLowerCase();
  return mode === "BY_WEIGHT" || unit === "kg" || Number(item?.weightGrams || 0) > 0;
}

function mapPublicItems(items = []) {
  return items.map((item) => {
    const proofImages = Array.isArray(item?.proofImages)
      ? item.proofImages.map((src) => String(src || "").trim()).filter(Boolean)
      : [];
    const requiresProofImage = requiresPublicProof(item);
    return {
      id: toIdString(item?._id || item?.id),
      name: item?.name || "",
      quantity: Number(item?.quantity || 0),
      unit: item?.unit || null,
      servingKey: item?.servingKey || null,
      unitPrice: item?.unitPrice ?? null,
      modifiersPrice: item?.modifiersPrice ?? null,
      lineSubtotal: item?.lineSubtotal ?? null,
      note: item?.note || null,
      status: item?.status || null,
      proofImages,
      requiresProofImage,
      proofUploaded: requiresProofImage && proofImages.length > 0,
    };
  });
}

function mapPublicCustomerRequest(request) {
  return {
    requestId: request?.requestId || null,
    type: request?.type || null,
    status: request?.status || null,
    message: request?.message || null,
    createdAt: request?.createdAt || null,
    acknowledgedAt: request?.acknowledgedAt || null,
    resolvedAt: request?.resolvedAt || null,
  };
}

function mapActivePublicCustomerRequests(requests = []) {
  return [...requests]
    .filter((request) =>
      ACTIVE_CUSTOMER_REQUEST_STATUSES.has(String(request?.status || "").toUpperCase()),
    )
    .sort((left, right) => {
      const leftTime = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right?.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .map(mapPublicCustomerRequest);
}

export function mapPublicTableSession(session) {
  if (!session) {
    return null;
  }

  return {
    id: toIdString(session._id || session.id),
    orderCode: session.orderCode || null,
    orderKind: session.orderKind || null,
    currentStatus: session.currentStatus || null,
    sessionStatus: session.sessionStatus || null,
    orderPaymentStatus: session.orderPaymentStatus || null,
    payment: mapPublicPayment(session.payment),
  };
}

export function mapPublicTableOrder(order) {
  return {
    id: toIdString(order?._id || order?.id),
    orderCode: order?.orderCode || null,
    orderKind: order?.orderKind || null,
    currentStatus: order?.currentStatus || null,
    createdAt: order?.createdAt || null,
    note: order?.note || null,
    totals: mapPublicTotals(order?.totals),
    payment: mapPublicPayment(order?.payment),
    items: mapPublicItems(order?.items || []),
  };
}

export function buildPublicActiveTableSessionOrdersResult({
  tableId,
  tableCode,
  tableStatus,
  session,
  orders = [],
}) {
  const publicOrders = orders
    .filter((order) => order?.orderKind !== ORDER_KIND.TABLE_SESSION)
    .map(mapPublicTableOrder);
  const capability = getPublicTableOrderCapability({ tableStatus, session });

  return {
    tableId: toIdString(tableId),
    tableCode: tableCode || null,
    tableStatus: tableStatus || null,
    canOrder: capability.canOrder,
    orderBlockedReason: capability.reason,
    session: mapPublicTableSession(session),
    orders: publicOrders,
    customerRequests: mapActivePublicCustomerRequests(session?.customerRequests || []),
  };
}

export function buildPublicRequestTablePaymentResult({
  ok,
  warning,
  readyForPayment,
  message,
  pendingOrderCodes = [],
  requestedAt,
  session,
  orders = [],
}) {
  return {
    ok: Boolean(ok),
    warning: Boolean(warning),
    readyForPayment: Boolean(readyForPayment),
    message: message || null,
    pendingOrderCodes,
    requestedAt: requestedAt ? new Date(requestedAt).toISOString() : null,
    session: mapPublicTableSession(session),
    orders: orders.map(mapPublicTableOrder),
  };
}
