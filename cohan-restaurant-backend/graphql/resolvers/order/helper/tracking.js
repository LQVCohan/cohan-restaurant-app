// src/graphql/resolvers/order/helper/tracking.js
import { OrderTracking } from "../../../../models/index.js";
import { toId } from "./index.js";

// Map status gốc -> status code chuẩn
// Bộ code: SUCCESS | PENDING | FAILED | REFUNDED | PARTIALLY_REFUNDED | CANCELED
function mapPaymentStatusToCode(raw) {
  if (!raw) return null;

  const s = String(raw).toLowerCase();

  switch (s) {
    case "paid":
      return "SUCCESS";
    case "pending":
      return "PENDING";
    case "failed":
      return "FAILED";
    case "refunded":
      return "REFUNDED";
    case "partially_refunded":
      return "PARTIALLY_REFUNDED";
    case "cancelled":
    case "canceled":
      return "CANCELED";
    default:
      return null;
  }
}

/**
 * CHỈ tạo tracking cho đơn giao hàng (orderType = "delivery").
 * Các đơn dine_in / takeaway sẽ được bỏ qua.
 */
export async function createOrderTrackingEvent({
  order,
  restaurantId,
  eventType,
  ctx,
  payload = {},
  session = null,
}) {
  if (!order) return null;

  // Chỉ log cho đơn giao hàng
  if (order.orderType !== "delivery") {
    return null;
  }

  const rid = toId(restaurantId || order.restaurantId);

  const actorType = ctx?.user ? "user" : "system";

  const rawPaymentStatus = order.payment?.status || null;
  const paymentStatusCode = mapPaymentStatusToCode(rawPaymentStatus);

  // Nếu payload có override payment raw (ví dụ update payment),
  // thì ưu tiên dùng payload.* để tính code from/to
  const paymentStatusRawFrom = payload.paymentStatusRawFrom ?? null;
  const paymentStatusRawTo = payload.paymentStatusRawTo ?? null;

  const paymentStatusCodeFrom = paymentStatusRawFrom
    ? mapPaymentStatusToCode(paymentStatusRawFrom)
    : null;

  const paymentStatusCodeTo = paymentStatusRawTo
    ? mapPaymentStatusToCode(paymentStatusRawTo)
    : null;

  const doc = {
    restaurantId: rid,
    orderId: order._id,
    orderCode: order.orderCode,
    eventType,

    // spread payload chung: statusFrom, statusTo, itemId,..., shippingStatusFrom,...
    ...payload,

    paymentStatusRawFrom,
    paymentStatusRawTo,
    paymentStatusCodeFrom,
    paymentStatusCodeTo,

    actor: {
      type: actorType,
      userId: ctx?.user?.id ? toId(ctx.user.id) : null,
      customerId: null,
      name:
        ctx?.user?.name || ctx?.user?.fullName || ctx?.user?.username || null,
    },

    channel: ctx?.clientMeta?.channel || "pos",
    clientMeta: ctx?.clientMeta || null,

    snapshot: {
      currentStatus: order.currentStatus,
      orderType: order.orderType,
      tableCode: order.tableCode,
      guestCount: order.guestCount,
      totals: {
        subtotal: order.totals?.subtotal,
        discount: order.totals?.discount,
        tax: order.totals?.tax,
        service: order.totals?.service,
        shippingFee: order.totals?.shippingFee,
        grandTotal: order.totals?.grandTotal,
      },
      payment: {
        method: order.payment?.method,
        rawStatus: rawPaymentStatus,
        statusCode: paymentStatusCode,
        paidAmount: order.payment?.paidAmount,
        changeAmount: order.payment?.changeAmount,
        currency: order.payment?.currency,
      },
      shipping: order.shipping
        ? {
            fullName: order.shipping.fullName,
            phone: order.shipping.phone,
            address: order.shipping.address,
            distance: order.shipping.distance,
            deliveryMethod: order.shipping.deliveryMethod,
            deliveryTime: order.shipping.deliveryTime,
            scheduleDate: order.shipping.scheduleDate,
            scheduleTime: order.shipping.scheduleTime,
          }
        : null,
    },
  };

  const [created] = await OrderTracking.create([doc], { session });
  return created;
}
