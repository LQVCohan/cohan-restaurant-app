import mongoose, { startSession } from "mongoose";
import dayjs from "dayjs";
import process from "node:process";
import { generateInvoiceNumber } from "../../../utils/generateInvoiceNumber.ts";
import {
  Order,
  Invoice,
  PaymentTransaction,
  Cashflow,
  EventLog,
  Table,
  Restaurant,
  PaymentSession,
  BankTransaction,
  PaymentReconciliation,
  PaymentRefund,
  SupplierPayable,
  Coupon,
  CouponRedemption,
  Promotion,
  UserCoupon,
} from "../../../models/index.js";
import { cancelPaymentSession, createOrderPayment, createReservationPayment, sanitizePaymentSessionForClient } from "../../../src/services/payment/paymentSession.service.js";
import { expireStaleTransferPayments } from "../../../src/services/payment/transferExpiry.service.js";
import { calculateDiscountBreakdown } from "../../../src/services/discountCalculation.service.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import {
  requireFinanceWrite,
  requireReconciliationWrite,
  requireRefundWrite,
} from "../../../src/services/finance/financePermission.service.js";
import { writeFinanceAudit } from "../../../src/services/finance/financeAudit.service.js";
import { chooseAutoMatch, findReconciliationCandidates, serializeCandidates } from "../../../src/services/finance/reconciliationMatching.service.js";
import { emitOrderEvent, emitRestaurantEvent } from "../order/helper/emitOrderEvent.js";
import {
  INACTIVE_ORDER_STATUSES,
  activeTableSessionLookupFilter,
  childOrdersForSessionFilter,
  clearTablePaymentRequestState,
  orderBatchOrLegacyFilter,
  ORDER_KIND,
  SESSION_STATUS,
  ORDER_PAYMENT_STATUS,
} from "../../../utils/orderLifecycle.js";
import { emitCustomerTrackingUpdateIfChanged } from "../../../src/services/orderTracking.service.js";


export function resolveActivePaymentRequest(orderDoc, actorId = null) {
  const req = (orderDoc?.customerRequests || []).find((r) => r?.type === "PAYMENT_REQUEST" && ["PENDING", "ACKNOWLEDGED"].includes(String(r?.status || "").toUpperCase()));
  if (!req) return null;
  req.status = "RESOLVED";
  req.resolvedAt = new Date();
  req.resolvedBy = actorId || null;
  orderDoc.customerVisibleNote = "Đơn hàng đã thanh toán. Cảm ơn quý khách.";
  return req;
}
const EXCLUDED_ITEM_STATUSES = new Set(["cancelled", "returned"]);

function hasPendingItemWork(order) {
  return (order?.items || []).some((item) =>
    ["pending", "confirmed", "preparing", "ready"].includes(
      String(item?.status || "").toLowerCase(),
    ),
  );
}

function hasPendingAdjustmentRequests(order) {
  return (order?.items || []).some(
    (item) =>
      (item?.voidRequests || []).some((req) => req?.status === "pending") ||
      (item?.returnRequests || []).some((req) => req?.status === "pending"),
  );
}

function isReadyForPayment(order) {
  const status = String(order?.currentStatus || "").toLowerCase();

  return (
    ["served", "completed"].includes(status) &&
    !hasPendingItemWork(order) &&
    !hasPendingAdjustmentRequests(order)
  );
}

function toId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function resolveCouponRedemptionUserIdFromOrders(orders = []) {
  const userIdsByString = new Map();

  for (const order of orders || []) {
    const candidate = order?.userId?._id || order?.userId?.id || order?.userId;
    const userId = toId(candidate);
    if (!userId) continue;

    userIdsByString.set(String(userId), userId);
  }

  return userIdsByString.size === 1
    ? Array.from(userIdsByString.values())[0]
    : null;
}

function applyRequestPaymentState(order, fields) {
  return {
    ...order,
    orderPaymentStatus: ORDER_PAYMENT_STATUS.PAYMENT_REQUESTED,
    payment: {
      ...(order?.payment || {}),
      status: "payment_requested",
      requestedAt: fields.requestedAt,
      requestSource: fields.requestSource,
      requestedBy: fields.requestedBy,
      requestNote: fields.requestNote,
    },
  };
}

function buildLineKey(item, unitPrice, modifiersPrice) {
  return JSON.stringify({
    dishId: item.dishId || "",
    name: item.name || "",
    unit: item.unit || "",
    price: unitPrice,
    modifiersPrice,
    servingKey: item.servingKey || "",
    method: item.method || "",
    proofImages: (item.proofImages || []).join("|"),
    modifiers: (item.modifiers || []).map((m) => ({
      optionId: m.optionId || "",
      optionName: m.optionName || "",
      groupId: m.groupId || "",
      price: m.price || 0,
    })),
  });
}

function normalizeLine(item) {
  const qty = Number(item.quantity || 0);
  if (!(qty > 0)) return null;

  const unitPrice = Number(
    item.unitPrice ?? item.price ?? item.baseUnitPrice ?? 0,
  );
  const modifiersPrice = Number(
    item.modifiersPricePerUnit ?? item.modifiersPrice ?? 0,
  );

  const key = buildLineKey(item, unitPrice, modifiersPrice);
  const lineTotal = (unitPrice + modifiersPrice) * qty;

  return {
    key,
    line: {
      dishId: String(item.dishId ?? ""),
      menuId: String(item.menuId ?? ""),
      categoryId: String(item.categoryId ?? ""),
      name: item.name,
      unit: item.unit,
      price: unitPrice,
      modifiersPrice,
      quantity: qty,
      totals: lineTotal,
      modifiers: (item.modifiers ?? []).map((m) => ({
        optionId: m.optionId,
        optionName: m.optionName,
        groupId: m.groupId,
        price: m.price,
      })),
    },
    subtotal: lineTotal,
  };
}

function mergeLines(lines) {
  const map = new Map();
  lines.forEach((l) => {
    if (!l) return;
    const existing = map.get(l.key);
    if (!existing) {
      map.set(l.key, { ...l.line });
    } else {
      existing.quantity += l.line.quantity;
      existing.totals += l.line.totals;
    }
  });
  return Array.from(map.values());
}

function accumulateTotals(order, subtotalIncluded, linesSubtotal) {
  const t = order.totals || {};
  const baseSubtotal =
    order.items?.reduce(
      (sum, it) =>
        EXCLUDED_ITEM_STATUSES.has(it.status)
          ? sum
          : sum + (it.lineSubtotal || 0),
      0,
    ) || 0;

  const ratio = baseSubtotal > 0 ? linesSubtotal / baseSubtotal : 1;

  const discount = (t.discount || 0) * ratio;
  const tax = (t.tax || 0) * ratio;
  const service = (t.service || 0) * ratio;
  const shippingFee = (t.shippingFee || 0) * ratio;

  return {
    subtotal: subtotalIncluded,
    discount,
    tax,
    service,
    shippingFee,
    grandTotal: subtotalIncluded - discount + tax + service + shippingFee,
  };
}
function normalizeVoucherCode(value) {
  const code = String(value || "")
    .trim()
    .toUpperCase();
  return code || undefined;
}

function normalizePromotionIds(promotionIds = []) {
  return Array.isArray(promotionIds)
    ? promotionIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
}

function hasPaymentDiscountSelection({ pricing, promotionIds }) {
  return (
    Boolean(normalizeVoucherCode(pricing?.voucherCode)) ||
    normalizePromotionIds(promotionIds).length > 0
  );
}

function buildPaymentDiscountPricing({ pricing = {}, aggregatedTotals = {} }) {
  const subtotal = Math.max(0, Number(aggregatedTotals?.subtotal || 0));
  const service = Math.max(0, Number(aggregatedTotals?.service || 0));
  const tax = Math.max(0, Number(aggregatedTotals?.tax || 0));

  const serviceRate = Number.isFinite(Number(pricing?.serviceRate))
    ? Math.max(0, Number(pricing.serviceRate))
    : subtotal > 0
      ? service / subtotal
      : 0;

  const beforeTaxBase = Math.max(0, subtotal + service);
  const taxRate = Number.isFinite(Number(pricing?.taxRate))
    ? Math.max(0, Number(pricing.taxRate))
    : beforeTaxBase > 0
      ? tax / beforeTaxBase
      : 0;

  return {
    serviceRate,
    taxRate,
    shippingFee: Math.max(
      0,
      Number(pricing?.shippingFee ?? aggregatedTotals?.shippingFee ?? 0),
    ),
    voucherCode: normalizeVoucherCode(pricing?.voucherCode),
  };
}

function resolveSharedOrderType(orders = []) {
  const orderTypes = new Set(
    (orders || [])
      .map((order) => String(order?.orderType || "").trim())
      .filter(Boolean),
  );

  return orderTypes.size === 1 ? Array.from(orderTypes)[0] : null;
}

function buildDiscountItemsFromOrders(orders = []) {
  return orders.flatMap((order) =>
    (order.items || [])
      .filter(
        (item) =>
          !EXCLUDED_ITEM_STATUSES.has(String(item?.status || "").toLowerCase()),
      )
      .map((item) => ({
        ...item,
        lineSubtotal: Number(item?.lineSubtotal || 0),
        status: item?.status || "served",
      }))
      .filter((item) => Number(item.lineSubtotal || 0) > 0),
  );
}

function resolvePaymentAmount({ paidAmount, expectedTotal, appliedDiscount }) {
  const expected = Math.round(Number(expectedTotal || 0));

  if (!(expected > 0)) {
    throw new Error("Invalid payment total");
  }

  if (paidAmount == null || paidAmount === "") {
    return expected;
  }

  const amount = Math.round(Number(paidAmount));

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid paidAmount");
  }

  if (appliedDiscount && Math.abs(amount - expected) > 1) {
    throw new Error("Payment amount does not match backend discounted total");
  }

  return amount;
}


export function normalizePromotionBreakdownLine(line = {}) {
  const promotionId = String(line?.promotionId || "").trim();
  if (!promotionId) return null;

  const numberOrZero = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const numberOrNull = (value) => {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  return {
    promotionId,
    promotionName: String(line?.promotionName || ""),
    promotionType: String(line?.promotionType || ""),
    promotionScope: String(line?.promotionScope || ""),
    discountType: String(line?.discountType || ""),
    discountValue: numberOrZero(line?.discountValue),
    discountAmount: numberOrZero(line?.discountAmount ?? line?.discount),
    source: ["line", "order", "shipping"].includes(line?.source) ? line.source : "line",
    lineId: line?.lineId ? String(line.lineId) : null,
    itemName: line?.itemName ? String(line.itemName) : null,
    quantity: numberOrNull(line?.quantity),
    comboCount: numberOrNull(line?.comboCount),
    comboBase: numberOrNull(line?.comboBase),
    freeQuantity: numberOrNull(line?.freeQuantity),
  };
}

export function buildAppliedPromotionBreakdown(discountTotals = {}) {
  const promotionLines = Array.isArray(discountTotals?.promotionLines)
    ? discountTotals.promotionLines
    : [];

  const breakdown = promotionLines
    .map((line) => {
      const promotionType = String(line?.promotionType || "").toUpperCase();
      const source = promotionType === "COMBO" ? "order" : "line";
      return normalizePromotionBreakdownLine({
        ...line,
        source,
        discountAmount: Number(line?.discount || 0),
      });
    })
    .filter(Boolean);

  const shippingDiscount = Math.max(0, Number(discountTotals?.shippingDiscount || 0));
  if (shippingDiscount > 0) {
    const appliedPromotionDetails = Array.isArray(discountTotals?.appliedPromotionDetails)
      ? discountTotals.appliedPromotionDetails
      : [];
    const shippingPromotion = appliedPromotionDetails.find(
      (promotion) => String(promotion?.promotionType || "").toUpperCase() === "FREESHIP",
    );

    if (shippingPromotion) {
      breakdown.push(
        normalizePromotionBreakdownLine({
          promotionId: shippingPromotion?.promotionId || shippingPromotion?._id || shippingPromotion?.id,
          promotionName: shippingPromotion?.promotionName || shippingPromotion?.name || "",
          promotionType: shippingPromotion?.promotionType || "FREESHIP",
          promotionScope: shippingPromotion?.promotionScope || "",
          discountType: shippingPromotion?.discountType || "",
          discountValue: shippingPromotion?.discountValue || 0,
          discountAmount: shippingDiscount,
          source: "shipping",
          lineId: null,
          itemName: null,
          quantity: null,
          comboCount: null,
          comboBase: null,
          freeQuantity: null,
        }),
      );
    }
  }

  return breakdown.filter(Boolean);
}

function buildInvoiceMeta({ appliedDiscount, discountTotals, promotionIds }) {
  if (!appliedDiscount) return undefined;

  return {
    discountApplied: true,
    voucherCode: discountTotals?.voucherCode || null,
    couponId: discountTotals?.couponId ? String(discountTotals.couponId) : null,
    appliedCoupons: Array.isArray(discountTotals?.appliedCoupons)
      ? discountTotals.appliedCoupons.map(String)
      : [],
    appliedPromotions: Array.isArray(discountTotals?.appliedPromotions)
      ? discountTotals.appliedPromotions.map((promotion) =>
          typeof promotion === "string" ? promotion : String(promotion?.promotionId || promotion?._id || promotion?.id || ""),
        ).filter(Boolean)
      : [],
    requestedPromotionIds: normalizePromotionIds(promotionIds),
    discountReason: discountTotals?.discountReason || null,
    promotionDiscount: Number(discountTotals?.promotionDiscount || 0),
    shippingDiscount: Number(discountTotals?.shippingDiscount || 0),
    voucherDiscount: Number(
      discountTotals?.voucherDiscount ?? discountTotals?.couponDiscount ?? 0,
    ),
    totalDiscount: Number(
      discountTotals?.totalDiscount ?? discountTotals?.discount ?? 0,
    ),
    subtotal: Number(discountTotals?.subtotal || 0),
    grandTotal: Number(discountTotals?.grandTotal || 0),
    promotionLines: Array.isArray(discountTotals?.promotionLines)
      ? discountTotals.promotionLines.map((line) => normalizePromotionBreakdownLine({ ...line, source: "line", discountAmount: Number(line?.discount || 0) })).filter(Boolean)
      : [],
    appliedPromotionBreakdown: buildAppliedPromotionBreakdown(discountTotals),
  };
}

async function incrementCouponUsageOnce({
  totals,
  session,
  invoice,
  orderIds = [],
  restaurantId,
  userId,
  redeemedAt = new Date(),
  source = "pos",
}) {
  if (!totals?.couponId) return;

  const couponId = toId(totals.couponId);
  if (!couponId) return;

  const invoiceId = toId(invoice?._id || invoice?.id);
  const existingRedemption = invoiceId
    ? await CouponRedemption.findOne({ invoiceId, couponId }).session(session)
    : null;

  if (existingRedemption) {
    return;
  }

  const redemptionUserId = toId(userId);
  const coupon = await Coupon.findById(couponId).session(session);
  const perUserLimit = Number(coupon?.constraints?.perUserLimit || 0);
  if (redemptionUserId && perUserLimit > 0) {
    const userRedemptionCount = await CouponRedemption.countDocuments({
      couponId,
      userId: redemptionUserId,
    }).session(session);
    if (userRedemptionCount >= perUserLimit) {
      throw new Error("Invalid coupon: per-user usage limit reached");
    }
  }

  const updateResult = await Coupon.updateOne(
    {
      _id: couponId,
      $expr: {
        $or: [{ $lte: ["$maxUsage", 0] }, { $lt: ["$used", "$maxUsage"] }],
      },
    },
    { $inc: { used: 1 } },
    { session },
  );

  if (!updateResult.modifiedCount) {
    throw new Error("Invalid coupon: usage limit reached");
  }

  const redemptionOrderIds = (orderIds || [])
    .map((id) => toId(id))
    .filter(Boolean);
  const couponCode = String(totals.voucherCode || coupon?.code || "")
    .trim()
    .toUpperCase();

  await CouponRedemption.create(
    [
      {
        couponId,
        userId: redemptionUserId,
        restaurantId,
        orderIds: redemptionOrderIds,
        invoiceId,
        couponCode,
        discountAmount: Number(
          totals.voucherDiscount ?? totals.couponDiscount ?? 0,
        ),
        subtotal: Number(totals.subtotal || 0),
        grandTotal: Number(totals.grandTotal || 0),
        source,
        redeemedAt,
        metadata: {
          discountReason: totals.discountReason || null,
          appliedCoupons: Array.isArray(totals.appliedCoupons)
            ? totals.appliedCoupons.map(String)
            : [],
        },
      },
    ],
    { session },
  );

  if (redemptionUserId) {
    await UserCoupon.updateOne(
      { userId: redemptionUserId, couponId, status: "saved" },
      {
        $set: {
          status: "used",
          usedAt: redeemedAt,
          orderId: redemptionOrderIds[0] || null,
          invoiceId,
          discountAmount: Number(
            totals.voucherDiscount ?? totals.couponDiscount ?? 0,
          ),
        },
      },
      { session },
    );
  }
}
async function incrementPromotionUsageOnce({ totals, session }) {
  const promotionIds = Array.isArray(totals?.appliedPromotions)
    ? totals.appliedPromotions.map((id) => toId(id)).filter(Boolean)
    : [];

  if (!promotionIds.length) return;

  for (const promotionId of promotionIds) {
    const updateResult = await Promotion.updateOne(
      {
        _id: promotionId,
        $expr: {
          $or: [
            { $lte: ["$usageLimit", 0] },
            { $lt: ["$usageCount", "$usageLimit"] },
          ],
        },
      },
      { $inc: { usageCount: 1 } },
      { session },
    );

    if (!updateResult.modifiedCount) {
      throw new Error("Invalid promotion: usage limit reached");
    }
  }
}
async function calculatePaymentTotalsWithOptionalDiscount({
  restaurantId,
  orders,
  aggregatedTotals,
  pricing,
  promotionIds,
  userId,
  paymentMethod,
}) {
  const hasDiscount = hasPaymentDiscountSelection({ pricing, promotionIds });

  if (!hasDiscount) {
    return {
      totals: aggregatedTotals,
      discountTotals: null,
      appliedDiscount: false,
    };
  }

  const discountItems = buildDiscountItemsFromOrders(orders);

  if (!discountItems.length) {
    throw new Error("No payable items for discount calculation");
  }

  const discountTotals = await calculateDiscountBreakdown({
    restaurantId,
    items: discountItems,
    pricing: buildPaymentDiscountPricing({ pricing, aggregatedTotals }),
    promotionIds: normalizePromotionIds(promotionIds),
    userId,
    paymentMethod,
    orderType: resolveSharedOrderType(orders),
  });

  return {
    totals: {
      subtotal: discountTotals.subtotal,
      discount: discountTotals.discount,
      discountReason: discountTotals.discountReason || null,
      voucherCode: discountTotals.voucherCode || null,
      promotionId: discountTotals.appliedPromotions?.[0] || null,
      tax: discountTotals.tax,
      service: discountTotals.service,
      shippingFee: discountTotals.shippingFee || 0,
      grandTotal: discountTotals.grandTotal,
    },
    discountTotals,
    appliedDiscount: true,
  };
}
export const requestTablePayment = async (_parent, { input }, ctx) => {
  const { restaurantId, tableId, tableCode, source, requestedBy, note } =
    input || {};

  const rid = toId(restaurantId);
  const tid = toId(tableId);
  const normalizedTableCode = String(tableCode || "").trim() || null;
  const actorId = toId(ctx?.user?.id || ctx?.user?._id);
  const requestSource = String(source || "").trim() || "unknown";
  const requestedByValue = toId(requestedBy) || actorId || null;
  const requestNote = String(note || "").trim() || null;

  if (!rid) throw new Error("Invalid restaurantId");
  if (!tid) throw new Error("Invalid tableId");

  await requireRestaurantPermission(ctx, rid, PERMISSIONS.PAYMENT_WRITE);

  const activeSession = await Order.findOne(
    activeTableSessionLookupFilter({
      restaurantId: rid,
      tableId: tid,
      tableCode: normalizedTableCode,
    }),
  )
    .sort({ openedAt: -1, createdAt: -1, _id: -1 })
    .lean();

  if (!activeSession) {
    return {
      ok: false,
      warning: true,
      readyForPayment: false,
      message: "Không tìm thấy phiên bàn đang hoạt động.",
      pendingOrderCodes: [],
      session: null,
      orders: [],
      requestedAt: null,
    };
  }

  const childOrders = await Order.find({
    $and: [
      childOrdersForSessionFilter({
        restaurantId: rid,
        parentOrderId: activeSession._id,
      }),
      {
        currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
        "payment.status": { $ne: "paid" },
      },
    ],
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (!childOrders.length) {
    return {
      ok: false,
      warning: true,
      readyForPayment: false,
      message: "Bàn chưa có món nào để yêu cầu thanh toán.",
      pendingOrderCodes: [],
      session: activeSession,
      orders: [],
      requestedAt: null,
    };
  }

  const pendingOrderCodes = childOrders
    .filter((order) => !isReadyForPayment(order))
    .map((order) => order.orderCode || String(order._id));

  const readyForPayment = pendingOrderCodes.length === 0;
  const warning = !readyForPayment;
  const requestedAt = new Date();

  const session = await startSession();
  session.startTransaction();

  try {
    const childOrderIds = childOrders.map((order) => order._id);

    await Order.updateMany(
      {
        _id: { $in: childOrderIds },
      },
      {
        $set: {
          orderPaymentStatus: ORDER_PAYMENT_STATUS.PAYMENT_REQUESTED,
          "payment.status": "payment_requested",
          "payment.requestedAt": requestedAt,
          "payment.requestSource": requestSource,
          "payment.requestedBy": requestedByValue,
          "payment.requestNote": requestNote,
        },
      },
      { session },
    );

    await Order.updateMany(
      {
        _id: activeSession._id,
        restaurantId: rid,
        orderKind: ORDER_KIND.TABLE_SESSION,
      },
      {
        $set: {
          sessionStatus: SESSION_STATUS.READY_TO_PAY,
          orderPaymentStatus: ORDER_PAYMENT_STATUS.PAYMENT_REQUESTED,
          "payment.status": "payment_requested",
          "payment.requestedAt": requestedAt,
          "payment.requestSource": requestSource,
          "payment.requestedBy": requestedByValue,
          "payment.requestNote": requestNote,
        },
      },
      { session },
    );

    await EventLog.log(
      {
        restaurantId: rid,
        verb: "order.request_payment",
        actorUserId: ctx?.user?.id,
        object: { kind: "TableSession", id: activeSession._id },
        source: "pos",
        status: "success",
        meta: {
          requestOrderIds: childOrderIds.map(String),
          parentSessionIds: [String(activeSession._id)],
          tableId: String(tid),
          tableCode: normalizedTableCode,
          requestSource,
          requestedBy: requestedByValue ? String(requestedByValue) : null,
          requestNote,
          pendingOrderCodes,
          readyForPayment,
        },
      },
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    const responseFields = {
      requestedAt,
      requestSource,
      requestedBy: requestedByValue,
      requestNote,
    };

    return {
      ok: true,
      warning,
      readyForPayment,
      message: warning
        ? "Bàn còn món chưa sẵn sàng thanh toán."
        : "Đã ghi nhận yêu cầu thanh toán.",
      pendingOrderCodes,
      session: {
        ...applyRequestPaymentState(activeSession, responseFields),
        sessionStatus: SESSION_STATUS.READY_TO_PAY,
      },
      orders: childOrders.map((order) =>
        applyRequestPaymentState(order, responseFields),
      ),
      requestedAt: requestedAt.toISOString(),
    };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    throw err;
  }
};

export const clearTablePaymentRequest = async (_parent, { input }, ctx) => {
  const { restaurantId, tableId, tableCode, reason } = input || {};

  const rid = toId(restaurantId);
  const tid = toId(tableId);
  const normalizedTableCode = String(tableCode || "").trim() || null;
  const clearReason = String(reason || "").trim() || null;

  if (!rid) throw new Error("Invalid restaurantId");
  if (!tid) throw new Error("Invalid tableId");

  await requireRestaurantPermission(ctx, rid, PERMISSIONS.PAYMENT_WRITE);

  const activeSession = await Order.findOne(
    activeTableSessionLookupFilter({
      restaurantId: rid,
      tableId: tid,
      tableCode: normalizedTableCode,
    }),
  )
    .sort({ openedAt: -1, createdAt: -1, _id: -1 })
    .lean();

  if (!activeSession) {
    return {
      ok: false,
      message: "Không tìm thấy phiên bàn đang hoạt động.",
      session: null,
      orders: [],
    };
  }

  const tx = await startSession();
  tx.startTransaction();

  try {
    const clearedState = await clearTablePaymentRequestState({
      OrderModel: Order,
      restaurantId: rid,
      activeSession,
      reason: clearReason,
      now: new Date(),
      session: tx,
    });

    await tx.commitTransaction();
    tx.endSession();

    return {
      ok: true,
      message: "Đã hủy yêu cầu thanh toán của bàn.",
      session: clearedState.session,
      orders: clearedState.orders,
    };
  } catch (err) {
    await tx.abortTransaction().catch(() => {});
    tx.endSession();
    throw err;
  }
};

export const payOrdersByTableId = async (_parent, { input }, ctx) => {
  const {
    restaurantId,
    tableId,
    paidAmount,
    method,
    paidAt,
    note,
    externalRef,
    includeUnserved = false,
    pricing,
    promotionIds,
  } = input || {};

  const rid = toId(restaurantId);
  const tid = toId(tableId);
  const actorId = toId(ctx?.user?.id || ctx?.user?._id);

  if (!rid) throw new Error("Invalid restaurantId");
  if (!tid) throw new Error("Invalid tableId");
  await requireRestaurantPermission(ctx, rid, PERMISSIONS.PAYMENT_WRITE);

  const normMethod = String(method || "").toLowerCase();
  if (
    !["cash", "card", "transfer", "bank_transfer", "e_wallet"].includes(
      normMethod,
    )
  ) {
    throw new Error("Unsupported payment method");
  }

  const table = await Table.findById(tid).lean();
  if (!table || String(table.restaurantId) !== String(rid)) {
    throw new Error("Table not found");
  }
  const tableCode = table?.code || null;

  async function findLegacyTableOrders() {
    return Order.find({
      restaurantId: rid,
      tableId: tid,
      currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
      ...orderBatchOrLegacyFilter(),
    }).lean();
  }

  const activeSession = await Order.findOne(
    activeTableSessionLookupFilter({
      restaurantId: rid,
      tableId: tid,
      tableCode,
    }),
  )
    .sort({ openedAt: -1, createdAt: -1, _id: -1 })
    .lean();

  let orders = [];
  if (activeSession) {
    const sessionChildFilter = {
      $and: [
        childOrdersForSessionFilter({
          restaurantId: rid,
          parentOrderId: activeSession._id,
        }),
        { currentStatus: { $nin: INACTIVE_ORDER_STATUSES } },
      ],
    };
    orders = await Order.find(sessionChildFilter).lean();
    if (!orders.length) orders = await findLegacyTableOrders();
  } else {
    orders = await findLegacyTableOrders();
  }

  if (!orders.length) {
    return {
      warning: true,
      pendingOrderCodes: [],
      invoice: null,
      transaction: null,
      cashflow: null,
    };
  }

  const served = [];
  const unserved = [];
  for (const o of orders) {
    const status = String(o.currentStatus || "").toLowerCase();
    const blocked =
      status !== "served" ||
      hasPendingItemWork(o) ||
      hasPendingAdjustmentRequests(o);
    if (blocked) unserved.push(o);
    else served.push(o);
  }

  const pendingCodes = unserved.map((o) => o.orderCode || String(o._id));
  if (pendingCodes.length && !includeUnserved) {
    return {
      warning: true,
      pendingOrderCodes: pendingCodes,
      invoice: null,
      transaction: null,
      cashflow: null,
    };
  }

  const payOrders = includeUnserved ? [...served, ...unserved] : served;

  if (!payOrders.length) {
    return {
      warning: true,
      pendingOrderCodes: pendingCodes,
      invoice: null,
      transaction: null,
      cashflow: null,
    };
  }

  const allLines = [];
  let aggregatedTotals = {
    subtotal: 0,
    discount: 0,
    tax: 0,
    service: 0,
    shippingFee: 0,
    grandTotal: 0,
  };
  const orderIds = payOrders.map((o) => o._id);

  for (const order of payOrders) {
    const filteredItems = (order.items || []).filter(
      (it) =>
        !EXCLUDED_ITEM_STATUSES.has(String(it.status || "").toLowerCase()),
    );

    const normalizedLines = filteredItems.map(normalizeLine).filter(Boolean);
    const linesSubtotal = normalizedLines.reduce((s, l) => s + l.subtotal, 0);
    const totals = accumulateTotals(order, linesSubtotal, linesSubtotal);

    aggregatedTotals.subtotal += totals.subtotal;
    aggregatedTotals.discount += totals.discount;
    aggregatedTotals.tax += totals.tax;
    aggregatedTotals.service += totals.service;
    aggregatedTotals.shippingFee += totals.shippingFee;
    aggregatedTotals.grandTotal += totals.grandTotal;

    allLines.push(...normalizedLines);
  }

  const mergedLines = mergeLines(allLines);
  if (!mergedLines.length || !(aggregatedTotals.grandTotal > 0)) {
    return {
      warning: true,
      pendingOrderCodes: pendingCodes,
      invoice: null,
      transaction: null,
      cashflow: null,
    };
  }

  const redemptionUserId = resolveCouponRedemptionUserIdFromOrders(payOrders);

  const {
    totals: payableTotals,
    discountTotals,
    appliedDiscount,
  } = await calculatePaymentTotalsWithOptionalDiscount({
    restaurantId: rid,
    orders: payOrders,
    aggregatedTotals,
    pricing,
    promotionIds,
    userId: redemptionUserId,
    paymentMethod: normMethod,
  });

  const now = paidAt ? dayjs(paidAt).toDate() : new Date();
  const amountToPay = resolvePaymentAmount({
    paidAmount,
    expectedTotal: payableTotals.grandTotal,
    appliedDiscount,
  });
  const session = await startSession();
  session.startTransaction();

  try {
    const trx = await PaymentTransaction.create(
      [
        {
          restaurantId: rid,
          orderIds,
          paidAmount: amountToPay,
          method: normMethod,
          status: "SUCCESS",
          paidAt: now,
          note,
          externalRef,
          createdBy: ctx?.user?.id,
        },
      ],
      { session },
    ).then((r) => r[0]);

    const number = await generateInvoiceNumber(Invoice, session);
    const invoice = await Invoice.create(
      [
        {
          restaurantId: rid,
          orderIds,
          userId: ctx?.user?.id,
          tableCode: table.code,
          number,
          issuedAt: now,
          lines: mergedLines,
          totals: {
            subtotal: payableTotals.subtotal,
            discount: payableTotals.discount,
            discountReason: payableTotals.discountReason || undefined,
            voucherCode: payableTotals.voucherCode || undefined,
            promotionId: payableTotals.promotionId || undefined,
            tax: payableTotals.tax,
            service: payableTotals.service,
            shippingFee: payableTotals.shippingFee,
            grandTotal: payableTotals.grandTotal,
          },
          paid: amountToPay,
          status:
            amountToPay + 1e-6 >= payableTotals.grandTotal
              ? "PAID"
              : amountToPay > 0
                ? "PARTIAL"
                : "UNPAID",
          currency: "VND",
          refTransactionId: trx._id,
          meta: buildInvoiceMeta({
            appliedDiscount,
            discountTotals,
            promotionIds,
          }),
        },
      ],
      { session },
    ).then((r) => r[0]);

    const cashflow = await Cashflow.create(
      [
        {
          restaurantId: rid,
          type: "INFLOW",
          amount: amountToPay,
          currency: "VND",
          category: "sale",
          subcategory: "other",
          method: method || "cash",
          status: "completed",
          source: "order",
          ref: {
            kind: "Invoice",
            id: invoice._id,
            orderIds,
          },
          note:
            pendingCodes.length && !includeUnserved
              ? `Thanh toán (đã loại ${pendingCodes.length} order chưa phục vụ)`
              : "Thanh toán theo bàn",
          occurredAt: now,
        },
      ],
      { session },
    ).then((r) => r[0]);
    await incrementCouponUsageOnce({
      totals: discountTotals,
      session,
      invoice,
      orderIds,
      restaurantId: rid,
      userId: redemptionUserId,
      redeemedAt: now,
      // Existing table payment mutation is the POS flow.
      source: "pos",
    });
    await incrementPromotionUsageOnce({ totals: discountTotals, session });
    await Order.updateMany(
      { _id: { $in: orderIds } },
      {
        $set: {
          "payment.method": normMethod,
          "payment.status": "paid",
          "payment.paidAmount": amountToPay,
          "payment.paidAt": now,
          "payment.paidBy": actorId,
          currentStatus: "completed",
        },
        $push: {
          statusTimeline: {
            status: "completed",
            at: now,
            byUserId: actorId || null,
            note: "Đã thanh toán và hoàn tất đơn.",
          },
        },
      },
      { session },
    );

    const shouldCloseParentSession =
      pendingCodes.length === 0 || includeUnserved === true;

    if (shouldCloseParentSession) {
      const parentSessionIds = activeSession
        ? [activeSession._id]
        : [
            ...new Set(
              payOrders
                .map((o) => o.parentOrderId || o.rootOrderId)
                .filter(Boolean)
                .map(String),
            ),
          ]
            .map((id) => toId(id))
            .filter(Boolean);

      if (parentSessionIds.length) {
        await Order.updateMany(
          {
            _id: { $in: parentSessionIds },
            restaurantId: rid,
            orderKind: ORDER_KIND.TABLE_SESSION,
          },
          {
            $set: {
              sessionStatus: SESSION_STATUS.CLOSED,
              orderPaymentStatus: ORDER_PAYMENT_STATUS.PAID,
              activeSessionKey: null,
              closedAt: now,
              "payment.method": normMethod,
              "payment.status": "paid",
              "payment.paidAmount": amountToPay,
              "payment.paidAt": now,
              "payment.paidBy": actorId,
              currentStatus: "completed",
            },
            $push: {
              statusTimeline: {
                status: "completed",
                at: now,
                byUserId: actorId || null,
                note: "Đã thanh toán và đóng phiên bàn.",
              },
            },
          },
          { session },
        );
      }
    }

    await EventLog.log(
      {
        restaurantId: rid,
        verb: "order.pay",
        actorUserId: ctx?.user?.id,
        object: { kind: "Table", id: tid },
        target: { kind: "Invoice", id: invoice._id },
        source: "pos",
        status: "success",
        meta: {
          orders: orderIds.map(String),
          pendingOrderCodes: pendingCodes,
          includeUnserved,
          paidAmount: amountToPay,
          method: normMethod,
          discountApplied: appliedDiscount,
          voucherCode: discountTotals?.voucherCode || null,
          promotionIds: discountTotals?.appliedPromotions || [],
        },
      },
      { session },
    );

    await Table.updateOne(
      { _id: tid },
      { $set: { status: "available" } },
      { session },
    ).catch(() => {});

    await session.commitTransaction();
    session.endSession();

    const paidOrders = await Order.find({ _id: { $in: orderIds } });
    for (const paidOrder of paidOrders) {
      const resolvedRequest = resolveActivePaymentRequest(paidOrder, actorId);
      if (resolvedRequest) {
        await paidOrder.save();
        await emitRestaurantEvent(ctx, String(paidOrder.restaurantId), "CUSTOMER_REQUEST_RESOLVED", {
          request: { requestId: resolvedRequest.requestId, type: resolvedRequest.type, status: resolvedRequest.status, message: resolvedRequest.message || null, createdAt: resolvedRequest.createdAt || null, acknowledgedAt: resolvedRequest.acknowledgedAt || null, resolvedAt: resolvedRequest.resolvedAt || null, orderCode: paidOrder.orderCode || null, tableCode: paidOrder.tableCode || paidOrder.table?.code || null },
          message: "Đơn hàng đã thanh toán. Cảm ơn quý khách.",
        });
        emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc: paidOrder, force: true });
      }
      await emitOrderEvent(
        ctx,
        String(paidOrder.restaurantId),
        "ORDER_UPDATED",
        paidOrder,
      );
    }

    return {
      warning: pendingCodes.length > 0 && !includeUnserved,
      pendingOrderCodes: pendingCodes,
      invoice,
      transaction: trx,
      cashflow,
    };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    throw err;
  }
};

export const payOrdersByOrderIds = async (_parent, { input }, ctx) => {
  const {
    restaurantId,
    orderIds = [],
    paidAmount,
    method,
    paidAt,
    note,
    externalRef,
    pricing,
    promotionIds,
  } = input || {};

  const rid = toId(restaurantId);
  if (!rid) throw new Error("Invalid restaurantId");
  await requireRestaurantPermission(ctx, rid, PERMISSIONS.PAYMENT_WRITE);
  const actorId = toId(ctx?.user?.id || ctx?.user?._id);

  const rawOrderIds = Array.isArray(orderIds) ? orderIds : [];
  if (
    !rawOrderIds.length ||
    rawOrderIds.some((id) => typeof id !== "string" || !id.trim())
  ) {
    throw new Error("Invalid orderIds");
  }

  const normalizedOrderIds = rawOrderIds.map((id) => toId(id.trim()));
  if (normalizedOrderIds.some((id) => !id)) {
    throw new Error("Invalid orderIds");
  }

  const uniqueOrderIds = [
    ...new Map(normalizedOrderIds.map((id) => [String(id), id])).values(),
  ];

  const normMethod = String(method || "").toLowerCase();
  if (
    !["cash", "card", "transfer", "bank_transfer", "e_wallet"].includes(
      normMethod,
    )
  ) {
    throw new Error("Unsupported payment method");
  }

  const orders = await Order.find({
    _id: { $in: uniqueOrderIds },
    restaurantId: rid,
    currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
    ...orderBatchOrLegacyFilter(),
  }).lean();

  if (!orders.length) {
    return {
      warning: true,
      pendingOrderCodes: [],
      invoice: null,
      transaction: null,
      cashflow: null,
    };
  }

  for (const order of orders) {
    if (hasPendingItemWork(order)) {
      throw new Error("Không thể thanh toán khi còn món chưa phục vụ xong.");
    }
    if (hasPendingAdjustmentRequests(order)) {
      throw new Error(
        "Không thể thanh toán khi còn yêu cầu hủy/trả món đang chờ duyệt.",
      );
    }
  }

  const pendingCodes = [];
  const allLines = [];
  let aggregatedTotals = {
    subtotal: 0,
    discount: 0,
    tax: 0,
    service: 0,
    shippingFee: 0,
    grandTotal: 0,
  };
  const activeOrderIds = orders.map((o) => o._id);

  for (const order of orders) {
    const filteredItems = (order.items || []).filter(
      (it) =>
        !EXCLUDED_ITEM_STATUSES.has(String(it.status || "").toLowerCase()),
    );

    const normalizedLines = filteredItems.map(normalizeLine).filter(Boolean);
    const linesSubtotal = normalizedLines.reduce((s, l) => s + l.subtotal, 0);
    const totals = accumulateTotals(order, linesSubtotal, linesSubtotal);

    aggregatedTotals.subtotal += totals.subtotal;
    aggregatedTotals.discount += totals.discount;
    aggregatedTotals.tax += totals.tax;
    aggregatedTotals.service += totals.service;
    aggregatedTotals.shippingFee += totals.shippingFee;
    aggregatedTotals.grandTotal += totals.grandTotal;

    allLines.push(...normalizedLines);
  }

  const mergedLines = mergeLines(allLines);
  if (!mergedLines.length || !(aggregatedTotals.grandTotal > 0)) {
    return {
      warning: true,
      pendingOrderCodes: pendingCodes,
      invoice: null,
      transaction: null,
      cashflow: null,
    };
  }

  const redemptionUserId = resolveCouponRedemptionUserIdFromOrders(orders);

  const {
    totals: payableTotals,
    discountTotals,
    appliedDiscount,
  } = await calculatePaymentTotalsWithOptionalDiscount({
    restaurantId: rid,
    orders,
    aggregatedTotals,
    pricing,
    promotionIds,
    userId: redemptionUserId,
    paymentMethod: normMethod,
  });

  const now = paidAt ? dayjs(paidAt).toDate() : new Date();
  const amountToPay = resolvePaymentAmount({
    paidAmount,
    expectedTotal: payableTotals.grandTotal,
    appliedDiscount,
  });
  const firstOrder = orders[0] || null;

  const session = await startSession();
  session.startTransaction();

  try {
    const trx = await PaymentTransaction.create(
      [
        {
          restaurantId: rid,
          orderIds: activeOrderIds,
          paidAmount: amountToPay,
          method: normMethod,
          status: "SUCCESS",
          paidAt: now,
          note,
          externalRef,
          createdBy: actorId || ctx?.user?.id,
        },
      ],
      { session },
    ).then((r) => r[0]);

    const number = await generateInvoiceNumber(Invoice, session);
    const invoice = await Invoice.create(
      [
        {
          restaurantId: rid,
          orderIds: activeOrderIds,
          userId: ctx?.user?.id,
          tableCode: firstOrder?.tableCode || null,
          number,
          issuedAt: now,
          lines: mergedLines,
          totals: {
            subtotal: payableTotals.subtotal,
            discount: payableTotals.discount,
            discountReason: payableTotals.discountReason || undefined,
            voucherCode: payableTotals.voucherCode || undefined,
            promotionId: payableTotals.promotionId || undefined,
            tax: payableTotals.tax,
            service: payableTotals.service,
            shippingFee: payableTotals.shippingFee,
            grandTotal: payableTotals.grandTotal,
          },
          paid: amountToPay,
          status:
            amountToPay + 1e-6 >= payableTotals.grandTotal
              ? "PAID"
              : amountToPay > 0
                ? "PARTIAL"
                : "UNPAID",
          currency: "VND",
          refTransactionId: trx._id,
          meta: buildInvoiceMeta({
            appliedDiscount,
            discountTotals,
            promotionIds,
          }),
        },
      ],
      { session },
    ).then((r) => r[0]);

    const cashflow = await Cashflow.create(
      [
        {
          restaurantId: rid,
          type: "INFLOW",
          amount: amountToPay,
          currency: "VND",
          category: "sale",
          subcategory: "other",
          method: method || "cash",
          status: "completed",
          source: "order",
          ref: {
            kind: "Invoice",
            id: invoice._id,
            orderIds: activeOrderIds,
          },
          note: "Thanh toán theo đơn",
          occurredAt: now,
        },
      ],
      { session },
    ).then((r) => r[0]);

    await incrementCouponUsageOnce({
      totals: discountTotals,
      session,
      invoice,
      orderIds: activeOrderIds,
      restaurantId: rid,
      userId: redemptionUserId,
      redeemedAt: now,
      // Existing order payment mutation is the POS flow.
      source: "pos",
    });
    await incrementPromotionUsageOnce({ totals: discountTotals, session });
    await Order.updateMany(
      { _id: { $in: activeOrderIds } },
      {
        $set: {
          "payment.method": normMethod,
          "payment.status": "paid",
          "payment.paidAmount": amountToPay,
          "payment.paidAt": now,
          "payment.paidBy": actorId,
          currentStatus: "completed",
        },
        $push: {
          statusTimeline: {
            status: "completed",
            at: now,
            byUserId: actorId || null,
            note: "Đã thanh toán và hoàn tất đơn.",
          },
        },
      },
      { session },
    );

    await EventLog.log(
      {
        restaurantId: rid,
        verb: "order.pay",
        actorUserId: ctx?.user?.id,
        object: { kind: "Order", id: firstOrder?._id || activeOrderIds[0] },
        target: { kind: "Invoice", id: invoice._id },
        source: "pos",
        status: "success",
        meta: {
          orders: activeOrderIds.map(String),
          paidAmount: amountToPay,
          method: normMethod,
          discountApplied: appliedDiscount,
          voucherCode: discountTotals?.voucherCode || null,
          promotionIds: discountTotals?.appliedPromotions || [],
        },
      },
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    const paidOrders = await Order.find({ _id: { $in: activeOrderIds } });
    for (const paidOrder of paidOrders) {
      const resolvedRequest = resolveActivePaymentRequest(paidOrder, actorId);
      if (resolvedRequest) {
        await paidOrder.save();
        await emitRestaurantEvent(ctx, String(paidOrder.restaurantId), "CUSTOMER_REQUEST_RESOLVED", {
          request: { requestId: resolvedRequest.requestId, type: resolvedRequest.type, status: resolvedRequest.status, message: resolvedRequest.message || null, createdAt: resolvedRequest.createdAt || null, acknowledgedAt: resolvedRequest.acknowledgedAt || null, resolvedAt: resolvedRequest.resolvedAt || null, orderCode: paidOrder.orderCode || null, tableCode: paidOrder.tableCode || paidOrder.table?.code || null },
          message: "Đơn hàng đã thanh toán. Cảm ơn quý khách.",
        });
        emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc: paidOrder, force: true });
      }
      await emitOrderEvent(
        ctx,
        String(paidOrder.restaurantId),
        "ORDER_UPDATED",
        paidOrder,
      );
    }

    return {
      warning: false,
      pendingOrderCodes: pendingCodes,
      invoice,
      transaction: trx,
      cashflow,
    };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    throw err;
  }
};


export const createOrderPaymentMutation = async (_parent, { input }, ctx) => {
  const rid = toId(input?.restaurantId);
  if (!rid) throw new Error("Invalid restaurantId");
  await requireRestaurantPermission(ctx, rid, PERMISSIONS.PAYMENT_WRITE);
  if (!ctx?.user?.id) throw new Error("Unauthorized");
  const baseApiUrl = process.env.PUBLIC_BASE_URL || process.env.APP_PUBLIC_URL || "http://localhost:4000";
  const payment = await createOrderPayment({ ...input, userId: ctx.user.id, baseApiUrl, clientIp: "127.0.0.1" });
  return sanitizePaymentSessionForClient(payment, { includeRaw: false });
};

export const createReservationPaymentMutation = async (
  _parent,
  { input },
  ctx,
) => {
  const userId = ctx?.user?.id;
  if (!userId) throw new Error("Unauthorized");

  const baseApiUrl =
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_PUBLIC_URL ||
    "http://localhost:4000";

  const payment = await createReservationPayment({
    reservationId: input?.reservationId,
    provider: input?.provider,
    userId,
    baseApiUrl,
    clientIp: "127.0.0.1",
  });

  return sanitizePaymentSessionForClient(payment, { includeRaw: false });
};

export const syncPaymentStatus = async (_parent, { paymentId }, ctx) => {
  if (!mongoose.isValidObjectId(paymentId))
    throw new Error("Invalid paymentId");
  await expireStaleTransferPayments({ now: new Date(), paymentId, io: ctx?.io }).catch(() => {});
  const payment = await PaymentSession.findById(paymentId).lean();
  if (!payment) throw new Error("Payment session not found");
  if (String(payment.userId || "") !== String(ctx?.user?.id || "")) {
    await requireRestaurantPermission(ctx, toId(payment.restaurantId), PERMISSIONS.PAYMENT_READ);
  }

  if (payment.provider === "vnpay" && payment.providerResponseRaw?.vnp_TxnRef) {
    return sanitizePaymentSessionForClient(payment, { includeRaw: false });
  }
  if (payment.provider === "momo" && payment.providerResponseRaw?.orderId) {
    return sanitizePaymentSessionForClient(payment, { includeRaw: false });
  }

  return sanitizePaymentSessionForClient(payment, { includeRaw: false });
};
export const cancelPaymentSessionMutation = async (_parent, { input }, ctx) => {
  if (!mongoose.isValidObjectId(input?.paymentId)) throw new Error("Invalid paymentId");
  if (!ctx?.user?.id) throw new Error("Unauthorized");
  const payment = await cancelPaymentSession({ paymentId: input.paymentId, reason: input?.reason, ctx });
  return sanitizePaymentSessionForClient(payment, { includeRaw: false });
};

export const updateRestaurantPaymentSettings = async (
  _parent,
  { input },
  ctx,
) => {
  if (!ctx?.user?.id) throw new Error("Unauthorized");
  const role = String(
    ctx?.user?.roleName || ctx?.user?.role || "",
  ).toLowerCase();
  if (!["manager", "admin"].some((x) => role.includes(x))) {
    throw new Error("Forbidden");
  }

  const rid = toId(input?.restaurantId);
  if (!rid) throw new Error("Invalid restaurantId");
  await requireRestaurantPermission(ctx, rid, PERMISSIONS.PAYMENT_WRITE);

  const providers = Array.isArray(input?.providers) ? input.providers : [];
  const normalizedProviders = providers
    .map((p, idx) => ({
      provider: String(p?.provider || "").toLowerCase(),
      label:
        String(p?.label || "").trim() ||
        (String(p?.provider || "").toLowerCase() === "momo" ? "MoMo" : "VNPAY"),
      active: p?.active !== false,
      priority: Number.isFinite(Number(p?.priority))
        ? Number(p.priority)
        : idx + 1,
      mode:
        String(p?.mode || "sandbox").toLowerCase() === "production"
          ? "production"
          : "sandbox",
    }))
    .filter((p) => ["momo", "vnpay"].includes(p.provider));

  const defaultProvider = ["momo", "vnpay"].includes(
    String(input?.defaultProvider || "").toLowerCase(),
  )
    ? String(input.defaultProvider).toLowerCase()
    : normalizedProviders[0]?.provider || "momo";

  const restaurant = await Restaurant.findByIdAndUpdate(
    rid,
    {
      $set: {
        paymentSettings: {
          defaultProvider,
          providers: normalizedProviders,
        },
      },
    },
    { new: true },
  );

  if (!restaurant) throw new Error("Restaurant not found");

  await EventLog.log({
    restaurantId: restaurant._id,
    actorUserId: ctx?.user?.id,
    verb: "payment.create",
    object: { kind: "Restaurant", id: restaurant._id },
    source: "web",
    status: "success",
    meta: {
      action: "update_payment_settings",
      defaultProvider,
      providers: normalizedProviders,
    },
  }).catch(() => {});

  return restaurant;
};

const normalizeFinanceToken = (value, fallback = "other") =>
  String(value || fallback).trim().toLowerCase();

const FINANCE_CASHFLOW_CATEGORIES = new Set([
  "sale", "refund", "payroll", "inventory", "operations", "supplier_payment", "adjustment", "other",
]);
const FINANCE_CASHFLOW_SUBCATEGORIES = new Set([
  "labor", "cogs", "rent", "utility", "maintenance", "marketing", "bank_fee", "tax", "etc", "other",
]);
const FINANCE_PAYMENT_METHODS = new Set([
  "cash", "card", "bank_transfer", "e_wallet", "transfer", "provider", "other",
]);
const FINANCE_CASHFLOW_STATUSES = new Set(["draft", "pending", "completed", "voided"]);

function normalizeManualCashflow(input = {}) {
  const category = normalizeFinanceToken(input.category);
  const subcategory = normalizeFinanceToken(input.subcategory);
  const method = normalizeFinanceToken(input.method, "cash");
  const status = normalizeFinanceToken(input.status, "completed");
  const type = String(input.type || "").toUpperCase();
  if (!["INFLOW", "OUTFLOW"].includes(type)) throw new Error("Invalid cashflow type");
  const amount = Number(input.amount || 0);
  if (!(amount > 0)) throw new Error("Amount must be greater than zero");
  if (!FINANCE_CASHFLOW_CATEGORIES.has(category)) throw new Error("Invalid cashflow category");
  if (!FINANCE_CASHFLOW_SUBCATEGORIES.has(subcategory)) throw new Error("Invalid cashflow subcategory");
  if (!FINANCE_PAYMENT_METHODS.has(method)) throw new Error("Invalid payment method");
  if (!FINANCE_CASHFLOW_STATUSES.has(status) || status === "voided") throw new Error("Invalid cashflow status");
  return {
    type,
    amount,
    currency: String(input.currency || "VND").toUpperCase(),
    category,
    subcategory,
    method,
    status,
    source: "manual",
    note: input.note || "",
    occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
    evidenceAttachments: input.evidenceAttachments || [],
  };
}

async function paidAndRefundedFor({ restaurantId, paymentTransactionId, invoiceId, orderId }) {
  const paymentFilter = { restaurantId, status: "SUCCESS" };
  if (paymentTransactionId) paymentFilter._id = paymentTransactionId;
  else if (invoiceId) paymentFilter.invoiceId = invoiceId;
  else if (orderId) paymentFilter.$or = [{ orderId }, { orderIds: orderId }];
  const payments = await PaymentTransaction.find(paymentFilter).lean();
  const paid = payments.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0);
  const refundFilter = { restaurantId, status: { $in: ["pending", "approved", "processing", "success"] } };
  if (paymentTransactionId) refundFilter.paymentTransactionId = paymentTransactionId;
  else if (invoiceId) refundFilter.invoiceId = invoiceId;
  else if (orderId) refundFilter.orderId = orderId;
  const refunds = await PaymentRefund.find(refundFilter).lean();
  const refunded = refunds.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  return { paid, refunded };
}


function canSkipRefundApproval(ctx) {
  const roleText = [ctx?.user?.roleName, ctx?.user?.userType, ctx?.user?.role?.slug, ctx?.user?.role?.name]
    .map((x) => String(x || "").toLowerCase())
    .join(" ");
  return roleText.includes("admin") || roleText.includes("accountant") || roleText.includes("kế toán");
}

async function updateRefundSourceMetadata(refund) {
  if (refund.paymentTransactionId) {
    const transaction = await PaymentTransaction.findById(refund.paymentTransactionId);
    if (transaction) {
      const refundedAmount = Number(transaction.refundedAmount || 0) + Number(refund.amount || 0);
      transaction.refundedAmount = refundedAmount;
      transaction.refundStatus = refundedAmount <= 0
        ? "none"
        : refundedAmount + 1e-6 >= Number(transaction.paidAmount || 0)
          ? "refunded"
          : "partial_refunded";
      transaction.refundIds = Array.from(new Set([...(transaction.refundIds || []).map(String), String(refund._id)])).map((id) => toId(id));
      transaction.meta = { ...(transaction.meta || {}), refundedAmount: transaction.refundedAmount, refundStatus: transaction.refundStatus };
      await transaction.save();
    }
  }

  const orderIds = [refund.orderId].filter(Boolean);
  if (!orderIds.length && refund.paymentTransactionId) {
    const trx = await PaymentTransaction.findById(refund.paymentTransactionId).lean();
    if (trx?.orderId) orderIds.push(trx.orderId);
    if (Array.isArray(trx?.orderIds)) orderIds.push(...trx.orderIds);
  }
  if (orderIds.length) {
    await Order.updateMany(
      { _id: { $in: orderIds.map((id) => toId(id)).filter(Boolean) } },
      {
        $inc: { "payment.refundedAmount": Number(refund.amount || 0) },
        $set: { "payment.refundStatus": "partial_or_full_refunded", "payment.lastRefundId": refund._id },
      },
    );
  }
}

async function buildReconciliationForBankTransaction(bankTransaction, { ctx, paymentSessionId = null, paymentTransactionId = null, note = "", forceMatch = false, matchedBy = "manual" } = {}) {
  const rid = toId(bankTransaction.restaurantId);
  let expectedAmount = null;
  let session = null;
  let paymentTransaction = null;
  let matchConfidence = 0;
  let matchReason = "manual_unresolved";
  let candidateMatches = [];

  const candidateResult = await findReconciliationCandidates(bankTransaction);
  candidateMatches = serializeCandidates(candidateResult.candidates || []);

  if (paymentSessionId) {
    session = await PaymentSession.findOne({ _id: paymentSessionId, restaurantId: rid }).lean();
    if (!session) throw new Error("Payment session not found in restaurant scope");
    expectedAmount = Number(session.amount || 0);
    matchConfidence = Math.abs(expectedAmount - Number(bankTransaction.amount || 0)) <= 1 ? 100 : 90;
    matchReason = `manual_session_match${forceMatch ? ":force" : ""}`;
  }
  if (!session && paymentTransactionId) {
    paymentTransaction = await PaymentTransaction.findOne({ _id: paymentTransactionId, restaurantId: rid }).lean();
    if (!paymentTransaction) throw new Error("Payment transaction not found in restaurant scope");
    expectedAmount = Number(paymentTransaction.paidAmount || 0);
    matchConfidence = Math.abs(expectedAmount - Number(bankTransaction.amount || 0)) <= 1 ? 100 : 90;
    matchReason = `manual_transaction_match${forceMatch ? ":force" : ""}`;
  }
  if (!session && !paymentTransaction && matchedBy === "auto") {
    const autoCandidate = chooseAutoMatch(candidateResult.candidates || []);
    if (autoCandidate?.paymentSessionId) {
      session = await PaymentSession.findOne({ _id: autoCandidate.paymentSessionId, restaurantId: rid }).lean();
      expectedAmount = Number(autoCandidate.expectedAmount || session?.amount || 0);
      matchConfidence = autoCandidate.confidence;
      matchReason = autoCandidate.reason;
    } else if (autoCandidate?.paymentTransactionId) {
      paymentTransaction = await PaymentTransaction.findOne({ _id: autoCandidate.paymentTransactionId, restaurantId: rid }).lean();
      expectedAmount = Number(autoCandidate.expectedAmount || paymentTransaction?.paidAmount || 0);
      matchConfidence = autoCandidate.confidence;
      matchReason = autoCandidate.reason;
    } else {
      matchReason = candidateResult.reason || "no_safe_candidate";
    }
  }

  if (forceMatch && matchedBy === "manual" && !String(note || "").trim()) {
    throw new Error("Force match requires a reason/note");
  }

  const receivedAmount = Number(bankTransaction.amount || 0);
  const status = expectedAmount > 0
    ? Math.abs(expectedAmount - receivedAmount) < 1 ? "matched" : "amount_mismatch"
    : "unmatched";
  const paymentSessionForRecord = session?._id || paymentSessionId || null;
  const paymentReference = session?.reference || paymentTransaction?.externalRef || paymentTransaction?.txnRef || bankTransaction.transactionId || "";

  const reconciliation = await PaymentReconciliation.findOneAndUpdate(
    { bankTransactionId: bankTransaction._id },
    {
      $set: {
        restaurantId: rid,
        paymentSessionId: paymentSessionForRecord,
        provider: bankTransaction.provider,
        expectedAmount: expectedAmount || null,
        receivedAmount,
        varianceAmount: expectedAmount ? receivedAmount - expectedAmount : null,
        status,
        bankTransactionId: bankTransaction._id,
        paymentReference,
        matchedBy,
        matchedAt: status === "unmatched" ? null : new Date(),
        note,
        matchConfidence,
        matchReason,
        candidatePaymentSessionIds: candidateMatches.filter((x) => x.paymentSessionId).map((x) => x.paymentSessionId),
        candidatePaymentTransactionIds: candidateMatches.filter((x) => x.paymentTransactionId).map((x) => x.paymentTransactionId),
        candidateMatches,
      },
      $push: {
        auditTrail: {
          action: matchedBy === "manual" ? "reconciliation.manual_match" : "reconciliation.auto_match",
          actorId: toId(ctx?.user?.id),
          nextStatus: status,
          note,
          matchConfidence,
          matchReason,
          at: new Date(),
        },
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  bankTransaction.matchStatus = status;
  bankTransaction.matchedPaymentSessionId = paymentSessionForRecord;
  await bankTransaction.save();
  await writeFinanceAudit(ctx, {
    restaurantId: rid,
    action: matchedBy === "manual" ? "reconciliation.manual_match" : "reconciliation.auto_match",
    targetType: "PaymentReconciliation",
    targetId: reconciliation._id,
    metadata: { bankTransactionId: String(bankTransaction._id), expectedAmount, receivedAmount, status, note, matchConfidence, matchReason },
  });
  return reconciliation;
}

const createManualCashflow = async (_, { input }, ctx) => {
  const rid = toId(input?.restaurantId);
  if (!rid) throw new Error("Invalid restaurantId");
  await requireFinanceWrite(ctx, rid);
  const payload = normalizeManualCashflow(input);
  const cashflow = await Cashflow.create({
    restaurantId: rid,
    ...payload,
    ref: { kind: "ManualCashflow" },
    createdBy: toId(ctx?.user?.id),
  });
  await writeFinanceAudit(ctx, { restaurantId: rid, action: "finance.cashflow.create", targetType: "Cashflow", targetId: cashflow._id, after: cashflow.toObject(), metadata: { amount: cashflow.amount, status: cashflow.status } });
  return cashflow;
};

const updateManualCashflow = async (_, { id, input }, ctx) => {
  const cashflow = toId(id) ? await Cashflow.findById(id) : null;
  if (!cashflow) throw new Error("Cashflow not found");
  const rid = toId(cashflow.restaurantId);
  await requireFinanceWrite(ctx, rid);
  if (cashflow.source !== "manual" && String(cashflow.ref?.kind || "") !== "ManualCashflow") throw new Error("Only manual cashflow can be edited");
  if (!["draft", "pending"].includes(String(cashflow.status || "completed"))) throw new Error("Only draft/pending cashflow can be edited");
  const before = cashflow.toObject();
  const payload = normalizeManualCashflow({ ...cashflow.toObject(), ...input, restaurantId: rid });
  Object.assign(cashflow, payload);
  await cashflow.save();
  await writeFinanceAudit(ctx, { restaurantId: rid, action: "finance.cashflow.update", targetType: "Cashflow", targetId: cashflow._id, before, after: cashflow.toObject(), metadata: { amount: cashflow.amount, status: cashflow.status } });
  return cashflow;
};

const voidManualCashflow = async (_, { id, reason }, ctx) => {
  if (!String(reason || "").trim()) throw new Error("Void reason is required");
  const cashflow = toId(id) ? await Cashflow.findById(id) : null;
  if (!cashflow) throw new Error("Cashflow not found");
  const rid = toId(cashflow.restaurantId);
  await requireFinanceWrite(ctx, rid);
  if (cashflow.source !== "manual" && String(cashflow.ref?.kind || "") !== "ManualCashflow") throw new Error("Only manual cashflow can be voided directly");
  const before = cashflow.toObject();
  cashflow.status = "voided";
  cashflow.voidReason = reason;
  cashflow.voidedBy = toId(ctx?.user?.id);
  cashflow.voidedAt = new Date();
  await cashflow.save();
  await writeFinanceAudit(ctx, { restaurantId: rid, action: "finance.cashflow.void", targetType: "Cashflow", targetId: cashflow._id, before, after: cashflow.toObject(), metadata: { reason, amount: cashflow.amount } });
  return cashflow;
};

const createRefundRequest = async (_, { input }, ctx) => {
  const rid = toId(input?.restaurantId);
  if (!rid) throw new Error("Invalid restaurantId");
  await requireRefundWrite(ctx, rid);
  const paymentTransactionId = toId(input?.paymentTransactionId);
  const invoiceId = toId(input?.invoiceId);
  const orderId = toId(input?.orderId);
  const amount = Number(input?.amount || 0);
  if (!(amount > 0)) throw new Error("Refund amount must be greater than zero");
  const { paid, refunded } = await paidAndRefundedFor({ restaurantId: rid, paymentTransactionId, invoiceId, orderId });
  if (paid <= 0) throw new Error("No successful payment found for refund");
  if (refunded + amount > paid + 1e-6) throw new Error("Refund amount exceeds paid amount");
  const refund = await PaymentRefund.create({
    restaurantId: rid,
    orderId,
    invoiceId,
    paymentTransactionId,
    amount,
    reason: input.reason,
    method: normalizeFinanceToken(input.method, "cash"),
    createdBy: toId(ctx?.user?.id),
    auditTrail: [{ action: "refund.create", actorId: toId(ctx?.user?.id), nextStatus: "pending", reason: input.reason, at: new Date() }],
  });
  await writeFinanceAudit(ctx, { restaurantId: rid, action: "refund.create", targetType: "PaymentRefund", targetId: refund._id, after: refund.toObject(), metadata: { amount, reason: input.reason } });
  return refund;
};

const approveRefundRequest = async (_, { id }, ctx) => {
  const refund = toId(id) ? await PaymentRefund.findById(id) : null;
  if (!refund) throw new Error("Refund not found");
  const rid = toId(refund.restaurantId);
  await requireRefundWrite(ctx, rid);
  const previousStatus = refund.status;
  if (refund.status !== "pending") throw new Error("Only pending refund can be approved");
  refund.status = "approved";
  refund.approvedBy = toId(ctx?.user?.id);
  refund.approvedAt = new Date();
  refund.auditTrail.push({ action: "refund.approve", actorId: refund.approvedBy, previousStatus, nextStatus: refund.status, at: new Date() });
  await refund.save();
  await writeFinanceAudit(ctx, { restaurantId: rid, action: "refund.approve", targetType: "PaymentRefund", targetId: refund._id, metadata: { previousStatus, nextStatus: refund.status, amount: refund.amount } });
  return refund;
};

const rejectRefundRequest = async (_, { id, reason }, ctx) => {
  const refund = toId(id) ? await PaymentRefund.findById(id) : null;
  if (!refund) throw new Error("Refund not found");
  const rid = toId(refund.restaurantId);
  await requireRefundWrite(ctx, rid);
  const previousStatus = refund.status;
  if (!["pending", "approved"].includes(refund.status)) throw new Error("Refund cannot be rejected");
  refund.status = "rejected";
  refund.auditTrail.push({ action: "refund.reject", actorId: toId(ctx?.user?.id), previousStatus, nextStatus: refund.status, reason, at: new Date() });
  await refund.save();
  await writeFinanceAudit(ctx, { restaurantId: rid, action: "refund.reject", targetType: "PaymentRefund", targetId: refund._id, metadata: { previousStatus, nextStatus: refund.status, reason, amount: refund.amount } });
  return refund;
};

const processRefundRequest = async (_, { id, input = {} }, ctx) => {
  const refund = toId(id) ? await PaymentRefund.findById(id) : null;
  if (!refund) throw new Error("Refund not found");
  const rid = toId(refund.restaurantId);
  await requireRefundWrite(ctx, rid);

  if (refund.status === "success") return refund;
  const skipApproval = Boolean(input?.skipApproval);
  if (refund.status === "pending" && (!skipApproval || !canSkipRefundApproval(ctx) || !String(input?.reason || "").trim())) {
    throw new Error("Refund must be approved before processing unless skipApproval reason is provided by Admin/Accountant");
  }
  if (!["approved", "processing", "failed", "pending"].includes(refund.status)) throw new Error("Refund cannot be processed");

  const { paid } = await paidAndRefundedFor({ restaurantId: rid, paymentTransactionId: refund.paymentTransactionId, invoiceId: refund.invoiceId, orderId: refund.orderId });
  const successfulFilter = { _id: { $ne: refund._id }, restaurantId: rid, status: "success" };
  if (refund.paymentTransactionId) successfulFilter.paymentTransactionId = refund.paymentTransactionId;
  else if (refund.invoiceId) successfulFilter.invoiceId = refund.invoiceId;
  else if (refund.orderId) successfulFilter.orderId = refund.orderId;
  const alreadySuccessful = await PaymentRefund.find(successfulFilter).lean();
  const successfulAmount = alreadySuccessful.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  if (successfulAmount + Number(refund.amount || 0) > paid + 1e-6) throw new Error("Refund amount exceeds paid amount");

  const previousStatus = refund.status;
  refund.status = "processing";
  refund.processedBy = toId(ctx?.user?.id);
  refund.auditTrail.push({ action: skipApproval ? "refund.process.skip_approval" : "refund.process.start", actorId: refund.processedBy, previousStatus, nextStatus: "processing", note: input.note, reason: input.reason, at: new Date() });

  let cashflow = refund.cashflowId ? await Cashflow.findById(refund.cashflowId) : null;
  if (!cashflow) {
    cashflow = await Cashflow.findOne({ "ref.refundId": refund._id, source: "refund", status: { $ne: "voided" } });
  }
  if (!cashflow) {
    cashflow = await Cashflow.create({
      restaurantId: rid,
      type: "OUTFLOW",
      amount: refund.amount,
      currency: refund.currency || "VND",
      category: "refund",
      subcategory: "other",
      method: refund.method === "provider" ? "provider" : refund.method,
      status: "completed",
      source: "refund",
      ref: { kind: "PaymentRefund", id: refund._id, refundId: refund._id, invoiceId: refund.invoiceId, paymentTransactionId: refund.paymentTransactionId, orderId: refund.orderId },
      note: refund.method === "provider" ? `Hoàn tiền provider/mock: ${refund.reason}` : `Hoàn tiền thủ công: ${refund.reason}`,
      occurredAt: new Date(),
      createdBy: toId(ctx?.user?.id),
    });
  }

  refund.status = "success";
  refund.providerRefundId = input.providerRefundId || refund.providerRefundId || (refund.method === "provider" ? `mock_provider_refund_${refund._id}` : `manual_refund_${refund._id}`);
  refund.processedAt = new Date();
  refund.cashflowId = cashflow._id;
  refund.auditTrail.push({ action: "refund.process.success", actorId: refund.processedBy, previousStatus: "processing", nextStatus: refund.status, note: input.note, at: new Date() });
  await refund.save();

  if (refund.invoiceId) {
    const invoice = await Invoice.findById(refund.invoiceId);
    if (invoice) {
      invoice.paid = Math.max(0, Number(invoice.paid || 0) - Number(refund.amount || 0));
      invoice.status = invoice.paid <= 0 ? "UNPAID" : invoice.paid + 1e-6 >= Number(invoice.totals?.grandTotal || 0) ? "PAID" : "PARTIAL";
      invoice.meta = { ...(invoice.meta || {}), refundedAmount: Number(invoice.meta?.refundedAmount || 0) + Number(refund.amount || 0), lastRefundId: String(refund._id) };
      await invoice.save();
    }
  }
  await updateRefundSourceMetadata(refund);
  await EventLog.create({
    restaurantId: rid,
    actorUserId: toId(ctx?.user?.id),
    verb: "payment.refund",
    object: { kind: "PaymentRefund", id: refund._id },
    source: "web",
    status: "success",
    meta: { amount: refund.amount, method: refund.method, cashflowId: String(cashflow._id) },
  }).catch(() => {});
  await writeFinanceAudit(ctx, { restaurantId: rid, action: "refund.process", targetType: "PaymentRefund", targetId: refund._id, metadata: { previousStatus, nextStatus: refund.status, amount: refund.amount, cashflowId: String(cashflow._id), skipApproval } });
  return refund;
};

const cancelRefundRequest = async (_, { id, reason }, ctx) => {
  if (!String(reason || "").trim()) throw new Error("Cancel reason is required");
  const refund = toId(id) ? await PaymentRefund.findById(id) : null;
  if (!refund) throw new Error("Refund not found");
  const rid = toId(refund.restaurantId);
  await requireRefundWrite(ctx, rid);
  if (!["pending", "approved"].includes(refund.status)) throw new Error("Refund cannot be cancelled");
  const previousStatus = refund.status;
  refund.status = "cancelled";
  refund.auditTrail.push({ action: "refund.cancel", actorId: toId(ctx?.user?.id), previousStatus, nextStatus: refund.status, reason, at: new Date() });
  await refund.save();
  await writeFinanceAudit(ctx, { restaurantId: rid, action: "refund.cancel", targetType: "PaymentRefund", targetId: refund._id, metadata: { previousStatus, nextStatus: refund.status, reason, amount: refund.amount } });
  return refund;
};

const retryRefundRequest = async (_, { id, input = {} }, ctx) => {
  const refund = toId(id) ? await PaymentRefund.findById(id) : null;
  if (!refund) throw new Error("Refund not found");
  const rid = toId(refund.restaurantId);
  await requireRefundWrite(ctx, rid);
  if (refund.status !== "failed") throw new Error("Only failed refund can be retried");
  refund.auditTrail.push({ action: "refund.retry", actorId: toId(ctx?.user?.id), previousStatus: "failed", nextStatus: "processing", note: input.note, at: new Date() });
  refund.status = "processing";
  await refund.save();
  return processRefundRequest(_, { id, input }, ctx);
};


const normalizePayableStatus = (payable) => {
  const remaining = Math.max(Number(payable.amount || 0) - Number(payable.paidAmount || 0), 0);
  if (payable.status === "voided") return "voided";
  if (remaining <= 0) return "paid";
  if (Number(payable.paidAmount || 0) > 0) return "partial";
  if (payable.dueDate && new Date(payable.dueDate).getTime() < Date.now()) return "overdue";
  return "unpaid";
};

const createSupplierPayable = async (_, { input }, ctx) => {
  const rid = toId(input?.restaurantId);
  if (!rid) throw new Error("Invalid restaurantId");
  await requireFinanceWrite(ctx, rid);
  const amount = Number(input?.amount || 0);
  if (!(amount > 0)) throw new Error("Payable amount must be greater than zero");
  const paidAmount = Number(input?.paidAmount || 0);
  if (paidAmount > amount + 1e-6) throw new Error("Paid amount cannot exceed payable amount");
  const initialStatus = normalizePayableStatus({ amount, paidAmount, dueDate: input.dueDate ? new Date(input.dueDate) : null });
  const payable = await SupplierPayable.create({
    restaurantId: rid,
    supplierName: String(input.supplierName || "").trim(),
    supplierId: toId(input.supplierId),
    sourceKind: normalizeFinanceToken(input.sourceKind, "manual"),
    sourceId: toId(input.sourceId),
    amount,
    paidAmount,
    remainingAmount: Math.max(amount - paidAmount, 0),
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    status: initialStatus,
    note: input.note || "",
    createdBy: toId(ctx?.user?.id),
    auditTrail: [{ action: "supplier_payable.create", actorId: toId(ctx?.user?.id), amount, nextStatus: initialStatus, note: input.note, at: new Date() }],
  });
  await writeFinanceAudit(ctx, { restaurantId: rid, action: "supplier_payable.create", targetType: "SupplierPayable", targetId: payable._id, after: payable.toObject(), metadata: { amount, paidAmount } });
  return payable;
};

const updateSupplierPayable = async (_, { id, input }, ctx) => {
  const payable = toId(id) ? await SupplierPayable.findById(id) : null;
  if (!payable) throw new Error("Supplier payable not found");
  const rid = toId(payable.restaurantId);
  await requireFinanceWrite(ctx, rid);
  if (["paid", "voided"].includes(payable.status)) throw new Error("Paid/voided payable cannot be edited");
  const before = payable.toObject();
  if (input.supplierName !== undefined) payable.supplierName = String(input.supplierName || "").trim();
  if (input.supplierId !== undefined) payable.supplierId = toId(input.supplierId);
  if (input.sourceKind !== undefined) payable.sourceKind = normalizeFinanceToken(input.sourceKind, "manual");
  if (input.sourceId !== undefined) payable.sourceId = toId(input.sourceId);
  if (input.amount !== undefined) payable.amount = Number(input.amount || 0);
  if (!(Number(payable.amount || 0) > 0)) throw new Error("Payable amount must be greater than zero");
  if (input.paidAmount !== undefined) payable.paidAmount = Number(input.paidAmount || 0);
  if (Number(payable.paidAmount || 0) > Number(payable.amount || 0) + 1e-6) throw new Error("Paid amount cannot exceed payable amount");
  if (input.dueDate !== undefined) payable.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.note !== undefined) payable.note = input.note || "";
  payable.remainingAmount = Math.max(Number(payable.amount || 0) - Number(payable.paidAmount || 0), 0);
  payable.status = normalizePayableStatus(payable);
  payable.auditTrail.push({ action: "supplier_payable.update", actorId: toId(ctx?.user?.id), previousStatus: before.status, nextStatus: payable.status, amount: payable.amount, note: input.note, at: new Date() });
  await payable.save();
  await writeFinanceAudit(ctx, { restaurantId: rid, action: "supplier_payable.update", targetType: "SupplierPayable", targetId: payable._id, before, after: payable.toObject() });
  return payable;
};

const recordSupplierPayment = async (_, { id, input }, ctx) => {
  const payable = toId(id) ? await SupplierPayable.findById(id) : null;
  if (!payable) throw new Error("Supplier payable not found");
  const rid = toId(payable.restaurantId);
  await requireFinanceWrite(ctx, rid);
  if (["paid", "voided"].includes(payable.status)) throw new Error("Supplier payable cannot receive payment");
  const amount = Number(input?.amount || 0);
  if (!(amount > 0)) throw new Error("Payment amount must be greater than zero");
  if (amount > Number(payable.remainingAmount || 0) + 1e-6) throw new Error("Payment exceeds payable remaining amount");
  const previousStatus = payable.status;
  const cashflow = await Cashflow.create({
    restaurantId: rid,
    type: "OUTFLOW",
    amount,
    currency: "VND",
    category: payable.sourceKind === "inventory" ? "inventory" : "supplier_payment",
    subcategory: payable.sourceKind === "inventory" ? "cogs" : "other",
    method: normalizeFinanceToken(input.method, "bank_transfer"),
    status: "completed",
    source: "manual",
    ref: { kind: "SupplierPayable", id: payable._id },
    note: input.note || `Thanh toán công nợ ${payable.supplierName}`,
    occurredAt: input.paidAt ? new Date(input.paidAt) : new Date(),
    createdBy: toId(ctx?.user?.id),
  });
  payable.paidAmount = Number(payable.paidAmount || 0) + amount;
  payable.remainingAmount = Math.max(Number(payable.amount || 0) - Number(payable.paidAmount || 0), 0);
  payable.status = normalizePayableStatus(payable);
  payable.paidBy = toId(ctx?.user?.id);
  payable.paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  payable.cashflowIds = Array.from(new Set([...(payable.cashflowIds || []).map(String), String(cashflow._id)])).map((cashflowId) => toId(cashflowId));
  payable.auditTrail.push({ action: "supplier_payable.payment", actorId: toId(ctx?.user?.id), previousStatus, nextStatus: payable.status, amount, note: input.note, at: new Date() });
  await payable.save();
  await writeFinanceAudit(ctx, { restaurantId: rid, action: "supplier_payable.payment", targetType: "SupplierPayable", targetId: payable._id, metadata: { amount, cashflowId: String(cashflow._id), previousStatus, nextStatus: payable.status } });
  return payable;
};

const voidSupplierPayable = async (_, { id, reason }, ctx) => {
  if (!String(reason || "").trim()) throw new Error("Void reason is required");
  const payable = toId(id) ? await SupplierPayable.findById(id) : null;
  if (!payable) throw new Error("Supplier payable not found");
  const rid = toId(payable.restaurantId);
  await requireFinanceWrite(ctx, rid);
  const previousStatus = payable.status;
  payable.status = "voided";
  payable.auditTrail.push({ action: "supplier_payable.void", actorId: toId(ctx?.user?.id), previousStatus, nextStatus: payable.status, reason, at: new Date() });
  await payable.save();
  await writeFinanceAudit(ctx, { restaurantId: rid, action: "supplier_payable.void", targetType: "SupplierPayable", targetId: payable._id, metadata: { reason, previousStatus } });
  return payable;
};


const reconcileBankTransaction = async (_, { bankTransactionId }, ctx) => {
  const bankTransaction = toId(bankTransactionId) ? await BankTransaction.findById(bankTransactionId) : null;
  if (!bankTransaction) throw new Error("Bank transaction not found");
  const rid = toId(bankTransaction.restaurantId);
  await requireReconciliationWrite(ctx, rid);
  return buildReconciliationForBankTransaction(bankTransaction, { ctx, matchedBy: "auto" });
};

const manuallyMatchBankTransaction = async (_, { input }, ctx) => {
  const bankTransaction = toId(input?.bankTransactionId) ? await BankTransaction.findById(input.bankTransactionId) : null;
  if (!bankTransaction) throw new Error("Bank transaction not found");
  const rid = toId(bankTransaction.restaurantId);
  await requireReconciliationWrite(ctx, rid);
  if (!input.forceMatch && !input.paymentSessionId && !input.paymentTransactionId) throw new Error("Select a payment to match or enable force match");
  if (input.forceMatch && !String(input.note || "").trim()) throw new Error("Force match requires note");
  return buildReconciliationForBankTransaction(bankTransaction, { ctx, paymentSessionId: toId(input.paymentSessionId), paymentTransactionId: toId(input.paymentTransactionId), note: input.note || "", forceMatch: Boolean(input.forceMatch), matchedBy: "manual" });
};

const resolveReconciliation = async (_, { input }, ctx) => {
  const reconciliation = toId(input?.reconciliationId) ? await PaymentReconciliation.findById(input.reconciliationId) : null;
  if (!reconciliation) throw new Error("Reconciliation not found");
  const rid = toId(reconciliation.restaurantId);
  await requireReconciliationWrite(ctx, rid);
  if (["resolved", "ignored"].includes(reconciliation.status)) return reconciliation;
  if (!String(input.note || "").trim()) throw new Error("Resolution note is required");
  const previousStatus = reconciliation.status;
  reconciliation.status = input.resolution === "ignore" ? "ignored" : "resolved";
  reconciliation.resolution = input.resolution;
  reconciliation.resolvedBy = toId(ctx?.user?.id);
  reconciliation.resolvedAt = new Date();
  reconciliation.note = [reconciliation.note, input.note].filter(Boolean).join("\n");
  reconciliation.auditTrail.push({ action: "reconciliation.resolve", actorId: reconciliation.resolvedBy, previousStatus, nextStatus: reconciliation.status, resolution: input.resolution, note: input.note, at: new Date() });
  await reconciliation.save();
  if (reconciliation.bankTransactionId) await BankTransaction.findByIdAndUpdate(reconciliation.bankTransactionId, { $set: { matchStatus: reconciliation.status } });
  await writeFinanceAudit(ctx, { restaurantId: rid, action: "reconciliation.resolve", targetType: "PaymentReconciliation", targetId: reconciliation._id, metadata: { previousStatus, nextStatus: reconciliation.status, resolution: input.resolution, note: input.note } });
  return reconciliation;
};

const ignoreBankTransaction = async (_, { id, reason }, ctx) => {
  if (!String(reason || "").trim()) throw new Error("Ignore reason is required");
  const bankTransaction = toId(id) ? await BankTransaction.findById(id) : null;
  if (!bankTransaction) throw new Error("Bank transaction not found");
  const rid = toId(bankTransaction.restaurantId);
  await requireReconciliationWrite(ctx, rid);
  bankTransaction.matchStatus = "ignored";
  await bankTransaction.save();
  await PaymentReconciliation.findOneAndUpdate(
    { bankTransactionId: bankTransaction._id },
    { $set: { restaurantId: rid, provider: bankTransaction.provider, receivedAmount: bankTransaction.amount, varianceAmount: null, status: "ignored", bankTransactionId: bankTransaction._id, note: reason, resolvedBy: toId(ctx?.user?.id), resolvedAt: new Date() }, $push: { auditTrail: { action: "bank_transaction.ignore", actorId: toId(ctx?.user?.id), nextStatus: "ignored", reason, at: new Date() } } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await writeFinanceAudit(ctx, { restaurantId: rid, action: "bank_transaction.ignore", targetType: "BankTransaction", targetId: bankTransaction._id, metadata: { reason, amount: bankTransaction.amount } });
  return bankTransaction;
};

export default {
  requestTablePayment,
  clearTablePaymentRequest,
  payOrdersByTableId,
  payOrdersByOrderIds,
  createReservationPayment: createReservationPaymentMutation,
  createOrderPayment: createOrderPaymentMutation,
  cancelPaymentSession: cancelPaymentSessionMutation,
  syncPaymentStatus,
  updateRestaurantPaymentSettings,
  createManualCashflow,
  updateManualCashflow,
  voidManualCashflow,
  createSupplierPayable,
  updateSupplierPayable,
  recordSupplierPayment,
  voidSupplierPayable,
  createRefundRequest,
  approveRefundRequest,
  rejectRefundRequest,
  cancelRefundRequest,
  retryRefundRequest,
  processRefundRequest,
  reconcileBankTransaction,
  manuallyMatchBankTransaction,
  resolveReconciliation,
  ignoreBankTransaction,
};
