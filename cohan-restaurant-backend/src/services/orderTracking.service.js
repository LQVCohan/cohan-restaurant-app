import crypto from "crypto";
import QRCode from "qrcode";
import { Order } from "../../models/index.js";

const PUBLIC_STATUS_LABELS = {
  ORDER_RECEIVED: "Nhà hàng đã nhận đơn của bạn",
  CONFIRMED: "Đơn hàng đã được xác nhận",
  PREPARING: "Bếp đang chuẩn bị món",
  PARTIALLY_READY: "Một phần món đã sẵn sàng",
  READY_TO_SERVE: "Món đã sẵn sàng, nhân viên sẽ phục vụ trong ít phút",
  SERVED: "Món đã được phục vụ",
  WAITING_FOR_PAYMENT: "Yêu cầu thanh toán đang được xử lý",
  PAID: "Đơn hàng đã thanh toán",
  CANCELLED: "Đơn hàng đã bị hủy",
  ISSUE_REPORTED: "Đơn hàng đang có vấn đề cần xử lý",
};

const ITEM_PUBLIC_STATUS = {
  pending: { status: "PENDING", label: "Đang chờ bếp nhận" },
  preparing: { status: "PREPARING", label: "Đang chuẩn bị" },
  ready: { status: "READY", label: "Sẵn sàng" },
  served: { status: "SERVED", label: "Đã phục vụ" },
  cancelled: { status: "CANCELLED", label: "Đã hủy" },
  returned: { status: "RETURNED", label: "Đã xử lý trả/hủy" },
};

function randomHex(size = 32) { return crypto.randomBytes(size).toString("hex"); }
function randomCodeSuffix(size = 6) { return crypto.randomBytes(size).toString("base64url").replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase(); }

export function buildTrackingUrl(token) {
  const base = process.env.CUSTOMER_APP_URL || process.env.PUBLIC_APP_URL || "";
  const path = `/track-order/${token}`;
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}

function mapItemStatus(itemStatus) {
  return ITEM_PUBLIC_STATUS[String(itemStatus || "").toLowerCase()] || { status: "PENDING", label: "Đang chờ bếp nhận" };
}

export function computePublicOrderStatus(order = {}) {
  const orderStatus = String(order?.currentStatus || "").toLowerCase();
  const paymentStatus = String(order?.orderPaymentStatus || order?.payment?.status || "").toLowerCase();
  if (orderStatus === "cancelled") return "CANCELLED";
  if (paymentStatus === "paid") return "PAID";
  if (["payment_requested", "partial"].includes(paymentStatus)) return "WAITING_FOR_PAYMENT";
  const statuses = (order?.items || []).map((it) => String(it?.status || "").toLowerCase());
  if (!statuses.length) return orderStatus === "confirmed" ? "CONFIRMED" : "ORDER_RECEIVED";
  if (statuses.length && statuses.every((s) => s === "cancelled")) return "CANCELLED";
  if (statuses.length && statuses.every((s) => s === "returned")) return "ISSUE_REPORTED";
  if (statuses.length && statuses.every((s) => s === "cancelled" || s === "returned")) return "ISSUE_REPORTED";
  if (statuses.every((s) => s === "served")) return "SERVED";
  if (statuses.every((s) => s === "served" || s === "cancelled" || s === "returned")) return "PARTIALLY_READY";
  const readyCount = statuses.filter((s) => s === "ready" || s === "served").length;
  if (readyCount === statuses.length) return "READY_TO_SERVE";
  if (readyCount > 0) return "PARTIALLY_READY";
  if (statuses.some((s) => s === "preparing")) return "PREPARING";
  if (["confirmed", "customer_attached"].includes(orderStatus)) return "CONFIRMED";
  return "ORDER_RECEIVED";
}

export async function ensureOrderTracking(orderDoc) {
  if (!orderDoc) return orderDoc;
  if (orderDoc.trackingToken && orderDoc.trackingCode) return orderDoc;
  for (let i = 0; i < 5; i += 1) {
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
    const trackingToken = randomHex(32);
    const trackingCode = `ORD-${ymd}-${randomCodeSuffix(6)}`;
    const exists = await Order.exists({ $or: [{ trackingToken }, { trackingCode }] });
    if (exists) continue;
    orderDoc.trackingToken = trackingToken;
    orderDoc.trackingCode = trackingCode;
    orderDoc.trackingUrl = buildTrackingUrl(trackingToken);
    orderDoc.trackingQrPayload = orderDoc.trackingUrl;
    orderDoc.trackingQrGeneratedAt = now;
    orderDoc.publicStatus = orderDoc.publicStatus || "ORDER_RECEIVED";
    if (!Array.isArray(orderDoc.statusHistory) || !orderDoc.statusHistory.length) {
      orderDoc.statusHistory = [{ status: "ORDER_RECEIVED", displayMessage: PUBLIC_STATUS_LABELS.ORDER_RECEIVED, changedAt: now, changedByRole: "SYSTEM" }];
    }
    return orderDoc;
  }
  throw new Error("Unable to generate unique tracking token/code");
}

export function updatePublicStatusHistory(orderDoc, changedByRole = "SYSTEM") {
  const next = computePublicOrderStatus(orderDoc);
  const prev = orderDoc.publicStatus;
  orderDoc.publicStatus = next;
  const history = Array.isArray(orderDoc.statusHistory) ? orderDoc.statusHistory : [];
  if (!history.length || history[history.length - 1]?.status !== next || prev !== next) {
    history.push({ status: next, displayMessage: PUBLIC_STATUS_LABELS[next] || next, changedAt: new Date(), changedByRole });
  }
  orderDoc.statusHistory = history;
}

export function toCustomerTrackingPayload(order = {}) {
  const normalizedPaymentStatus = String(
    order?.orderPaymentStatus || order?.payment?.status || "unpaid",
  ).toLowerCase();
  return {
    trackingCode: order.trackingCode,
    publicStatus: order.publicStatus,
    publicStatusLabel: PUBLIC_STATUS_LABELS[order.publicStatus] || order.publicStatus,
    customerVisibleNote: order.customerVisibleNote || null,
    estimatedReadyAt: order.estimatedReadyAt || null,
    timeline: (order.statusHistory || []).map((x) => ({ status: x.status, displayMessage: x.displayMessage, changedAt: x.changedAt })),
    items: (order.items || []).map((item) => {
      const mapped = mapItemStatus(item.status);
      return { name: item.name, quantity: item.quantity, publicStatus: mapped.status, publicStatusLabel: mapped.label };
    }),
    payment: {
      status: normalizedPaymentStatus.toUpperCase(),
      canRequestPayment: ["partial", "unpaid"].includes(normalizedPaymentStatus),
      totalAmount: Number(order?.totals?.grandTotal || 0),
    },
  };
}

export function emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc, previousPublicStatus = null, force = false }) {
  if (!ctx?.io || !orderDoc?.trackingToken) return;
  const currentPublicStatus = orderDoc?.publicStatus;
  if (!force && (!currentPublicStatus || currentPublicStatus === previousPublicStatus)) return;
  const payload = toCustomerTrackingPayload(orderDoc.toObject ? orderDoc.toObject() : orderDoc);
  ctx.io.to(`order-tracking:${orderDoc.trackingToken}`).emit("customer-order-tracking-updated", payload);
}

export async function buildOrderTrackingQrSvg(orderDoc) {
  const payload = orderDoc?.trackingQrPayload || orderDoc?.trackingUrl;
  if (!payload) throw new Error("Order tracking payload not found");
  return QRCode.toString(payload, { type: "svg", margin: 1, width: 220 });
}

export { PUBLIC_STATUS_LABELS };
