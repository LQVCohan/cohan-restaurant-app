import crypto from "crypto";

import { Order } from "../../../models/index.js";
import { emitRestaurantEvent } from "./helper/emitOrderEvent.js";
import {
  emitCustomerTrackingUpdateIfChanged,
  toCustomerTrackingPayload,
  updatePublicStatusHistory,
} from "../../../src/services/orderTracking.service.js";
import {
  assertOrderCanRequestPayment,
  normalizeOrderPaymentStatus,
} from "../../../src/services/orderPaymentRequestGuard.service.js";

const TRACKING_INVALID_MESSAGE =
  "Không thể xử lý yêu cầu. Vui lòng kiểm tra lại mã theo dõi hoặc liên hệ nhân viên.";
const TRACKING_REVOKED_MESSAGE = "Liên kết theo dõi đơn hàng đã hết hiệu lực.";
const ACTIVE_CUSTOMER_REQUEST_STATUSES = ["PENDING", "ACKNOWLEDGED"];

function appendCustomerRequest(order, type, message = null) {
  order.customerRequests = Array.isArray(order.customerRequests)
    ? order.customerRequests
    : [];
  const request = {
    requestId: crypto.randomUUID(),
    type,
    status: "PENDING",
    message: message || null,
    createdAt: new Date(),
    source: "CUSTOMER_TRACKING",
  };
  order.customerRequests.push(request);
  return request;
}

function findActiveCustomerRequest(order, type) {
  return (order.customerRequests || []).find(
    (request) =>
      request?.type === type &&
      ACTIVE_CUSTOMER_REQUEST_STATUSES.includes(
        String(request?.status || "").toUpperCase(),
      ),
  );
}

function serializeCustomerRequestForStaff(order, request) {
  if (!request) return null;
  return {
    requestId: request.requestId,
    type: request.type,
    status: request.status,
    message: request.message || null,
    createdAt: request.createdAt || null,
    acknowledgedAt: request.acknowledgedAt || null,
    resolvedAt: request.resolvedAt || null,
    trackingCode: order.trackingCode || null,
    tableCode: order.tableCode || order.table?.code || null,
    orderCode: order.orderCode || null,
  };
}

export const CustomerTrackingPaymentMutation = {
  async requestPaymentFromTracking(_, { trackingToken }, ctx) {
    const token = String(trackingToken || "").trim();
    if (!token) {
      return { success: false, message: TRACKING_INVALID_MESSAGE, tracking: null };
    }

    const order = await Order.findOne({ trackingToken: token });
    if (!order) {
      return { success: false, message: TRACKING_INVALID_MESSAGE, tracking: null };
    }

    if (order.trackingQrRevokedAt) {
      return { success: false, message: TRACKING_REVOKED_MESSAGE, tracking: null };
    }

    const normalizedPaymentStatus = normalizeOrderPaymentStatus(order);
    if (normalizedPaymentStatus === "paid") {
      return {
        success: false,
        message: "Đơn hàng đã thanh toán.",
        tracking: toCustomerTrackingPayload(order.toObject()),
      };
    }

    if (String(order.currentStatus || "").toLowerCase() === "cancelled") {
      return {
        success: false,
        message: "Đơn hàng đã bị hủy.",
        tracking: toCustomerTrackingPayload(order.toObject()),
      };
    }

    const existingPaymentRequest = findActiveCustomerRequest(
      order,
      "PAYMENT_REQUEST",
    );
    if (existingPaymentRequest || normalizedPaymentStatus === "payment_requested") {
      return {
        success: true,
        message: "Yêu cầu thanh toán đã được gửi trước đó.",
        tracking: toCustomerTrackingPayload(order.toObject()),
      };
    }

    try {
      assertOrderCanRequestPayment(order);
    } catch (error) {
      return {
        success: false,
        message: error?.message || "Hiện chưa thể yêu cầu thanh toán cho đơn này.",
        tracking: toCustomerTrackingPayload(order.toObject()),
      };
    }

    const previousPublicStatus = order.publicStatus;
    order.payment = order.payment || {};
    order.payment.status = "payment_requested";
    order.payment.requestedAt = new Date();
    order.payment.requestSource = "customer_tracking";
    order.orderPaymentStatus = "payment_requested";
    order.lastCustomerPaymentRequestAt = new Date();
    order.customerVisibleNote = "Yêu cầu thanh toán đã được gửi cho nhân viên.";

    const request = appendCustomerRequest(
      order,
      "PAYMENT_REQUEST",
      "Khách yêu cầu thanh toán",
    );
    updatePublicStatusHistory(order, "CUSTOMER");
    await order.save();

    emitCustomerTrackingUpdateIfChanged({
      ctx,
      orderDoc: order,
      previousPublicStatus,
      force: true,
    });
    await emitRestaurantEvent(
      ctx,
      String(order.restaurantId),
      "CUSTOMER_PAYMENT_REQUESTED",
      {
        order: toCustomerTrackingPayload(order.toObject()),
        request: serializeCustomerRequestForStaff(order, request),
        trackingCode: order.trackingCode || null,
        tableCode: order.tableCode || order.table?.code || null,
        message: "Khách yêu cầu thanh toán",
      },
    );

    return {
      success: true,
      message: "Đã gửi yêu cầu thanh toán đến nhân viên.",
      tracking: toCustomerTrackingPayload(order.toObject()),
    };
  },
};

export default CustomerTrackingPaymentMutation;
