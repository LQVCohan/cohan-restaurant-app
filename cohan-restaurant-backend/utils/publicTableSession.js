import jwt from "jsonwebtoken";
import process from "process";

import { ORDER_KIND } from "./orderLifecycle.js";
import { parseDurationMs } from "../src/utils/duration.js";

export const TABLE_ACCESS_TOKEN_ERROR = "Invalid table access token";
export const TABLE_ACCESS_TOKEN_PURPOSE = "customer_table";

const ACTIVE_CUSTOMER_REQUEST_STATUSES = new Set(["PENDING", "ACKNOWLEDGED"]);

function toIdString(value) {
  if (!value) return null;
  return String(value);
}

export function normalizePublicTableCode(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
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

function mapPublicItems(items = []) {
  return items.map((item) => ({
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
  }));
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
  session,
  orders = [],
}) {
  const publicOrders = orders
    .filter((order) => order?.orderKind !== ORDER_KIND.TABLE_SESSION)
    .map(mapPublicTableOrder);

  return {
    tableId: toIdString(tableId),
    tableCode: tableCode || null,
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
