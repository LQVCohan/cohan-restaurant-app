import { ORDER_KIND } from "./orderLifecycle.js";

function toIdString(value) {
  if (!value) return null;
  return String(value);
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
