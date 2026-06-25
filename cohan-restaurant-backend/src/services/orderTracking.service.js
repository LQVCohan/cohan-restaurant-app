import crypto from "crypto";
import QRCode from "qrcode";
import { Order } from "../../models/index.js";
import { canOrderRequestPayment } from "./orderPaymentRequestGuard.service.js";

const DELIVERY_PUBLIC_STATUS = {
  driver_assigned: "DRIVER_ASSIGNED",
  driver_arriving: "DRIVER_ARRIVING",
  picked_up: "PICKED_UP",
  delivering: "DELIVERING",
  arrived: "ARRIVED",
  delivered: "DELIVERED",
  cancelled: "DELIVERY_CANCELLED",
  failed: "DELIVERY_FAILED",
};

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
  DELIVERY_PENDING: "Đang chờ xử lý giao hàng",
  DRIVER_ASSIGNED: "Đã phân công người giao",
  DRIVER_ARRIVING: "Người giao đang đến nhà hàng",
  PICKED_UP: "Đã lấy món",
  DELIVERING: "Đang giao đến bạn",
  ARRIVED: "Người giao đã đến nơi",
  DELIVERED: "Giao hàng thành công",
  DELIVERY_CANCELLED: "Đã hủy giao hàng",
  DELIVERY_FAILED: "Giao hàng thất bại",
};

const DELIVERY_STATUS_LABELS = {
  pending: "Đang chờ xử lý giao hàng",
  driver_assigned: "Đã phân công người giao",
  driver_arriving: "Người giao đang đến nhà hàng",
  picked_up: "Đã lấy món",
  delivering: "Đang giao đến bạn",
  arrived: "Người giao đã đến nơi",
  delivered: "Giao hàng thành công",
  cancelled: "Đã hủy giao hàng",
  failed: "Giao hàng thất bại",
};

const DELIVERY_TIMELINE_STEPS = {
  pending: ["pending"],
  driver_assigned: ["pending", "driver_assigned"],
  driver_arriving: ["pending", "driver_assigned", "driver_arriving"],
  picked_up: ["pending", "driver_assigned", "picked_up"],
  delivering: ["pending", "driver_assigned", "picked_up", "delivering"],
  arrived: ["pending", "driver_assigned", "picked_up", "delivering", "arrived"],
  delivered: ["pending", "driver_assigned", "picked_up", "delivering", "arrived", "delivered"],
  cancelled: ["pending", "cancelled"],
  failed: ["pending", "failed"],
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

function getItemProofImages(item = {}) {
  return Array.isArray(item?.proofImages)
    ? item.proofImages.map((src) => String(src || "").trim()).filter(Boolean)
    : [];
}

function requiresItemProofImage(item = {}) {
  const mode = String(item?.servingVariant?.mode || "").toUpperCase();
  const unit = String(item?.unit || item?.servingVariant?.sellUnit || "").toLowerCase();
  return mode === "BY_WEIGHT" || unit === "kg" || Number(item?.weightGrams || 0) > 0;
}

function normalizeDeliveryStatus(order = {}) {
  return String(order?.shipping?.deliveryStatus || "pending").toLowerCase();
}

export function computePublicOrderStatus(order = {}) {
  const orderStatus = String(order?.currentStatus || "").toLowerCase();
  const paymentStatus = String(order?.orderPaymentStatus || order?.payment?.status || "").toLowerCase();
  const isDelivery = String(order?.orderType || "").toLowerCase() === "delivery";
  const deliveryStatus = normalizeDeliveryStatus(order);

  if (orderStatus === "cancelled") return "CANCELLED";
  if (isDelivery && DELIVERY_PUBLIC_STATUS[deliveryStatus]) return DELIVERY_PUBLIC_STATUS[deliveryStatus];
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

function isValidLatestRequest(request) {
  return Boolean(request?.requestId && request?.type && request?.status && request?.createdAt);
}

export function buildDeliveryTimeline(order = {}) {
  const status = normalizeDeliveryStatus(order);
  const steps = DELIVERY_TIMELINE_STEPS[status] || DELIVERY_TIMELINE_STEPS.pending;
  const deliveryPublicStatuses = new Set(Object.values(DELIVERY_PUBLIC_STATUS));
  const statusHistory = Array.isArray(order?.statusHistory) ? order.statusHistory : [];
  const historyByDeliveryStatus = new Map();

  for (const entry of statusHistory) {
    const entryStatus = String(entry?.status || "").toUpperCase();
    if (!deliveryPublicStatuses.has(entryStatus)) continue;
    const deliveryKey = Object.entries(DELIVERY_PUBLIC_STATUS).find(([, publicStatus]) => publicStatus === entryStatus)?.[0];
    if (deliveryKey && !historyByDeliveryStatus.has(deliveryKey)) {
      historyByDeliveryStatus.set(deliveryKey, entry?.changedAt || null);
    }
  }

  return steps.map((step) => ({
    status: step,
    label: DELIVERY_STATUS_LABELS[step] || step,
    at: historyByDeliveryStatus.get(step) || (step === status ? order?.updatedAt || null : null),
    note: null,
  }));
}

function buildCustomerDeliveryTracking(order = {}) {
  if (String(order?.orderType || "").toLowerCase() !== "delivery") return null;
  const shipping = order?.shipping || {};
  const status = normalizeDeliveryStatus(order);
  return {
    orderType: order.orderType,
    deliveryStatus: status,
    deliveryStatusLabel: DELIVERY_STATUS_LABELS[status] || DELIVERY_STATUS_LABELS.pending,
    shippingAddress: shipping.address || shipping.location?.address || shipping.customerLocation?.address || null,
    eta: shipping.eta || null,
    distance: shipping.distance ?? null,
    duration: shipping.duration ?? null,
    driverName: shipping.driverName || null,
    driverPhone: shipping.driverPhone || null,
    driverVehiclePlate: shipping.driverVehiclePlate || null,
    externalTrackingCode: shipping.externalTrackingCode || null,
    timeline: buildDeliveryTimeline(order),
  };
}

export function toCustomerTrackingPayload(order = {}) {
  const computedStatus = computePublicOrderStatus(order);
  const normalizedPaymentStatus = String(order?.orderPaymentStatus || order?.payment?.status || "unpaid").toLowerCase();
  const latestRequest = Array.isArray(order?.customerRequests)
    ? [...order.customerRequests]
        .filter(isValidLatestRequest)
        .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())[0]
    : null;

  return {
    trackingCode: order.trackingCode,
    publicStatus: computedStatus,
    publicStatusLabel: PUBLIC_STATUS_LABELS[computedStatus] || computedStatus,
    customerVisibleNote: order.customerVisibleNote || null,
    estimatedReadyAt: order.estimatedReadyAt || null,
    timeline: (order.statusHistory || []).map((x) => ({ status: x.status, displayMessage: x.displayMessage, changedAt: x.changedAt })),
    delivery: buildCustomerDeliveryTracking(order),
    items: (order.items || []).map((item) => {
      const mapped = mapItemStatus(item.status);
      const proofImages = getItemProofImages(item);
      const requiresProofImage = requiresItemProofImage(item);
      return {
        name: item.name,
        quantity: item.quantity,
        publicStatus: mapped.status,
        publicStatusLabel: mapped.label,
        proofImages,
        requiresProofImage,
        proofUploaded: requiresProofImage ? proofImages.length > 0 : false,
      };
    }),
    payment: {
      status: normalizedPaymentStatus.toUpperCase(),
      method: order?.payment?.method || null,
      provider: order?.payment?.provider || null,
      canRequestPayment: canOrderRequestPayment(order),
      totalAmount: Number(order?.totals?.grandTotal || 0),
    },
    latestRequest: latestRequest
      ? {
          requestId: latestRequest.requestId,
          type: latestRequest.type,
          status: latestRequest.status,
          message: latestRequest.message || null,
          createdAt: latestRequest.createdAt,
          acknowledgedAt: latestRequest.acknowledgedAt || null,
          resolvedAt: latestRequest.resolvedAt || null,
        }
      : null,
  };
}

export async function validateOrderTrackingToken(trackingToken) {
  if (!trackingToken || typeof trackingToken !== "string") return { ok: false, code: "INVALID" };
  const token = String(trackingToken);
  const order = await Order.findOne({ trackingToken: token }).select("_id trackingQrRevokedAt").lean();
  if (!order) return { ok: false, code: "FORBIDDEN" };
  if (order.trackingQrRevokedAt) return { ok: false, code: "EXPIRED" };
  return { ok: true, token };
}

export function emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc, previousPublicStatus = null, force = false }) {
  if (!ctx?.io || !orderDoc?.trackingToken) return;
  const currentPublicStatus = orderDoc?.publicStatus || computePublicOrderStatus(orderDoc);
  if (!force && (!currentPublicStatus || currentPublicStatus === previousPublicStatus)) return;
  const payload = toCustomerTrackingPayload(orderDoc.toObject ? orderDoc.toObject() : orderDoc);
  ctx.io.to(`order-tracking:${orderDoc.trackingToken}`).emit("customer-order-tracking-updated", payload);
}

export async function buildOrderTrackingQrDataUrl(orderDoc) {
  const payload = orderDoc?.trackingQrPayload || orderDoc?.trackingUrl;
  if (!payload) throw new Error("Order tracking payload not found");
  return QRCode.toDataURL(payload, { type: "image/svg+xml", margin: 1, width: 220 });
}

export { DELIVERY_STATUS_LABELS, PUBLIC_STATUS_LABELS };
