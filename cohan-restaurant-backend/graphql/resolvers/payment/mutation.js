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
  Coupon,
  CouponRedemption,
  Promotion,
  UserCoupon,
} from "../../../models/index.js";
import { createReservationPayment } from "../../../src/services/payment/paymentSession.service.js";
import { calculateDiscountBreakdown } from "../../../src/services/discountCalculation.service.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { emitOrderEvent } from "../order/helper/emitOrderEvent.js";
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
      ? discountTotals.appliedPromotions.map(String)
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

  return payment;
};

export const syncPaymentStatus = async (_parent, { paymentId }) => {
  if (!mongoose.isValidObjectId(paymentId))
    throw new Error("Invalid paymentId");
  const payment = await PaymentSession.findById(paymentId).lean();
  if (!payment) throw new Error("Payment session not found");

  if (payment.provider === "vnpay" && payment.providerResponseRaw?.vnp_TxnRef) {
    return payment;
  }
  if (payment.provider === "momo" && payment.providerResponseRaw?.orderId) {
    return payment;
  }

  return payment;
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

export default {
  requestTablePayment,
  clearTablePaymentRequest,
  payOrdersByTableId,
  payOrdersByOrderIds,
  createReservationPayment: createReservationPaymentMutation,
  syncPaymentStatus,
  updateRestaurantPaymentSettings,
};
