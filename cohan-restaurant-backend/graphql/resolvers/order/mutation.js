// src/graphql/resolvers/order/mutation.js

import mongoose from "mongoose";
import crypto from "crypto";

import {
  Order,
  Reservation,
  TableCustomer,
  Warehouse,
  CheckoutSession,
  Coupon,
  Customer,
  User,
  WalletTransaction,
  PrintSetting,
  Promotion,
  Cart,
} from "../../../models/index.js";

import { normalizeItem, toId } from "./helper/orderUtils.js";
import { emitOrderEvent, emitRestaurantEvent } from "./helper/emitOrderEvent.js";
import {
  ensureUserForOrder,
  resolveTable,
  compactCustomerInput,
  resolveCustomerIdentity,
  normalizeEmail,
  normalizePhone,
} from "./helper/userUtils.js";
import { markTableStatus } from "./helper/tableUtils.js";
import { createOrderTrackingEvent } from "./helper/tracking.js";
import generateOrderCode from "../../../utils/generateOrderCode.js";
import { calculateDiscountBreakdown } from "../../../src/services/discountCalculation.service.js";
import { hydrateCheckoutOrderItems } from "../../../src/services/orderItemHydration.service.js";
import {
  loadCustomerRankContext,
  resolveCustomerRankAliasesForRestaurant,
} from "../../../src/services/customerRankSetting.service.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { hasRole } from "../../../utils/authz.js";
import { applyCartDerivedFields, computeCartTotalAmount } from "../../../models/cartDerivedFields.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { getPublicRestaurantOrThrow } from "../shared/restaurantCapabilityGuards.js";
import { GraphQLError } from "graphql";
import {
  ORDER_KIND,
  SPLIT_STATUS,
  SESSION_STATUS,
  KITCHEN_STATUS,
  ORDER_PAYMENT_STATUS,
  activeTableSessionFilter,
  buildActiveTableSessionKey,
} from "../../../utils/orderLifecycle.js";

import {
  reserveForOrderTx,
  commitReservationForOrderTx,
  cancelReservationForOrderTx,
} from "../../../src/services/inventory.service.js";
import {
  ensureOrderTracking,
  updatePublicStatusHistory,
  emitCustomerTrackingUpdateIfChanged,
  toCustomerTrackingPayload,
} from "../../../src/services/orderTracking.service.js";
import {
  syncKitchenOrderWorkItemsForKitchenEntry,
  upsertKitchenOrderWorkItemForStatusChange,
  syncKitchenOrderWorkItemForVoidOrReturn,
  syncKitchenOrderWorkItemsForOrderStatusChange,
} from "../../../src/services/kitchen/kitchenOrderWorkItem.service.js";

const RESERVABLE_STATUSES = [
  "draft",
  "pending",
  "confirmed",
  "customer_attached",
];
const COMMIT_STATUSES = ["preparing", "ready", "served", "completed"];

async function requireOrderPermission(ctx, order, permissionCode) {
  const restaurantId = order?.restaurantId;
  if (!restaurantId) throw new Error("Invalid restaurantId");
  await requireRestaurantPermission(ctx, restaurantId, permissionCode);
}
const RANK_POINT_DIVISOR = 1_000_000;

function hasPendingItemWork(order) {
  return (order?.items || []).some((item) =>
    ["pending", "confirmed", "preparing", "ready"].includes(
      String(item?.status || ""),
    ),
  );
}

function hasPendingAdjustmentRequests(order) {
  return (order?.items || []).some((item) => {
    const hasPendingVoid = (item?.voidRequests || []).some(
      (req) => req?.status === "pending",
    );
    const hasPendingReturn = (item?.returnRequests || []).some(
      (req) => req?.status === "pending",
    );
    return hasPendingVoid || hasPendingReturn;
  });
}

function assertOrderCanRequestPayment(order) {
  if (!order) throw new Error("Order not found");
  if (["cancelled", "completed"].includes(order.currentStatus)) {
    throw new Error("Đơn đã kết thúc, không thể yêu cầu thanh toán.");
  }
  if (hasPendingItemWork(order)) {
    throw new Error(
      "Không thể yêu cầu thanh toán khi còn món chưa phục vụ xong.",
    );
  }
  if (hasPendingAdjustmentRequests(order)) {
    throw new Error(
      "Không thể yêu cầu thanh toán khi còn yêu cầu hủy/trả món đang chờ duyệt.",
    );
  }
}

function appendCustomerRequest(order, type, message = null) {
  order.customerRequests = Array.isArray(order.customerRequests) ? order.customerRequests : [];
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
const ACTIVE_CUSTOMER_REQUEST_STATUSES = ["PENDING", "ACKNOWLEDGED"];
function findActiveCustomerRequest(order, type) {
  return (order.customerRequests || []).find((req) =>
    req?.type === type && ACTIVE_CUSTOMER_REQUEST_STATUSES.includes(String(req?.status || "").toUpperCase()));
}
function serializeCustomerRequestForStaff(order, req) {
  if (!req) return null;
  return {
    requestId: req.requestId,
    type: req.type,
    status: req.status,
    message: req.message || null,
    createdAt: req.createdAt || null,
    acknowledgedAt: req.acknowledgedAt || null,
    resolvedAt: req.resolvedAt || null,
    trackingCode: order.trackingCode || null,
    tableCode: order.tableCode || order.table?.code || null,
    orderCode: order.orderCode || null,
  };
}

const CANCELLED_ITEM_STATUSES = ["cancelled", "returned"];
const PRINT_STATIONS = {
  cashier: "cashier",
};
const TRACKING_INVALID_MESSAGE = "Không thể xử lý yêu cầu. Vui lòng kiểm tra lại mã theo dõi hoặc liên hệ nhân viên.";
const TRACKING_REVOKED_MESSAGE = "Liên kết theo dõi đơn hàng đã hết hiệu lực.";
const DEFAULT_STAFF_CALL_REASON = "Khách cần hỗ trợ tại bàn.";
const STAFF_CALL_REASON_MAX_LENGTH = 200;
const STAFF_CALL_RATE_LIMIT_MS = 60 * 1000;

function normalizeCallStaffReason(reason) {
  const normalized = String(reason || "").trim().replace(/\s+/g, " ");
  if (!normalized) return DEFAULT_STAFF_CALL_REASON;
  return normalized.slice(0, STAFF_CALL_REASON_MAX_LENGTH);
}

async function enqueueTemporaryBillPrintJob(order) {
  if (!order?.restaurantId || order.currentStatus !== "confirmed") {
    return { jobs: [], message: "Only confirmed orders can be printed" };
  }

  const printSetting = await PrintSetting.findOne({
    restaurantId: order.restaurantId,
  }).lean();
  if (!printSetting) {
    return { jobs: [], message: "Chưa cấu hình in cho nhà hàng." };
  }

  const cashierPrinters = Array.isArray(
    printSetting?.stations?.[PRINT_STATIONS.cashier],
  )
    ? printSetting.stations[PRINT_STATIONS.cashier]
    : [];
  const printerId = cashierPrinters[0];
  if (!printerId) {
    return { jobs: [], message: "Chưa cấu hình máy in thu ngân." };
  }

  const createdAt = new Date().toISOString();
  const job = {
    id: `job_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    orderId: String(order._id),
    stationId: PRINT_STATIONS.cashier,
    stationType: PRINT_STATIONS.cashier,
    printerId,
    printType: "temporary_bill",
    items: [],
    status: "pending",
    retryCount: 0,
    payload: { orderCode: order.orderCode, tableCode: order.tableCode },
    createdAt,
    printedAt: null,
    updatedAt: createdAt,
  };

  await PrintSetting.updateOne(
    { _id: printSetting._id },
    {
      $push: { jobs: { $each: [job], $position: 0, $slice: 300 } },
      $set: { updatedAt: new Date() },
    },
  );

  return { jobs: [job], message: "Đã tạo job in tạm tính." };
}

function normalizePriorityLevel(value) {
  const key = String(value || "").toUpperCase();
  if (["LOW", "MEDIUM", "HIGH"].includes(key)) return key;
  return "MEDIUM";
}

async function syncCustomerMetricsByOrderUser(userId) {
  if (!userId || !mongoose.isValidObjectId(userId)) return;
  const uid = toId(userId);
  if (!uid) return;

  const completedOrders = await Order.find({
    userId: uid,
    currentStatus: "completed",
    "payment.status": { $in: ["paid", "partially_refunded", "refunded"] },
  }).lean();

  const totalSpending = completedOrders.reduce(
    (sum, o) => sum + Number(o?.totals?.grandTotal || 0),
    0,
  );
  const totalOrders = completedOrders.length;
  const loyaltyPoints = Math.max(
    0,
    Math.floor((Number(totalSpending) || 0) / RANK_POINT_DIVISOR),
  );
  // customerType is legacy/manual customer data. Current coupon rank
  // eligibility is resolved from CustomerRankSetting per restaurant.
  await Customer.findByIdAndUpdate(uid, {
    totalSpending,
    totalOrders,
    loyaltyPoints,
  });
}

/** =========================
 * Guards
 * ========================= */
function assertPositiveIntegerGrams(v, field = "weightGrams") {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(
      `${field} must be a positive integer (grams). Có lỗi trong chuyển đổi sang đơn vị chuẩn.`,
    );
  }
  return n;
}

function assertPositiveNumber(v, field = "quantity") {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${field} must be > 0`);
  return n;
}

function getReturnBaselineQuantity(item) {
  const original = Number(item?.originalQuantity || 0);
  if (Number.isFinite(original) && original > 0) return original;

  return Number(item?.quantity || 0) + Number(item?.returnedQuantity || 0);
}

function getRemainingReturnableQuantity(item) {
  const baseline = getReturnBaselineQuantity(item);
  const returned = Number(item?.returnedQuantity || 0);
  return Math.max(0, baseline - returned);
}

/** =========================
 * Inventory line builders (NEW STANDARD)
 * - REQUIRED servingKey
 * - BY_WEIGHT requires weightGrams integer (grams)
 * ========================= */

const CART_HOLD_CHECKOUT_ERROR =
  "Món trong giỏ đã hết hạn hoặc không còn khớp với đơn hàng. Vui lòng kiểm tra lại giỏ.";

function assertCustomerRemoteCheckoutAuth(ctx, inputUserId) {
  const authUserId =
    ctx?.user?.id && mongoose.isValidObjectId(ctx.user.id)
      ? String(ctx.user.id)
      : null;
  if (!authUserId) {
    throw new GraphQLError("Vui lòng đăng nhập để đặt món.", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }

  if (!hasRole(ctx?.user, ["customer"])) {
    throw new GraphQLError(
      "Chỉ tài khoản khách hàng mới có thể đặt món từ xa.",
      { extensions: { code: "FORBIDDEN" } },
    );
  }

  if (inputUserId && String(inputUserId) !== String(authUserId)) {
    throw new GraphQLError(
      "Không thể checkout bằng tài khoản khách hàng khác.",
      {
        extensions: { code: "FORBIDDEN" },
      },
    );
  }

  return authUserId;
}

function getCheckoutCartRef(item = {}) {
  const cartId = item.cartId ? String(item.cartId) : "";
  const cartItemId = item.cartItemId ? String(item.cartItemId) : "";
  return { cartId, cartItemId, hasRef: Boolean(cartId || cartItemId) };
}

function normalizeCartHoldServingKey(value) {
  const key = String(value || "").trim();
  return key || "portion";
}

function buildCartHoldOrderCode(cartId, cartItemId) {
  return `CART:${cartId}:${cartItemId}`;
}

function assertCartHoldCheckoutAllowed({ item, authUserId }) {
  const { cartId, cartItemId } = getCheckoutCartRef(item);

  if (!authUserId) {
    throw new GraphQLError("Vui lòng đăng nhập để đặt món.", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }

  if (!cartId || !cartItemId) {
    throw new Error(CART_HOLD_CHECKOUT_ERROR);
  }

  if (
    !mongoose.isValidObjectId(cartId) ||
    !mongoose.isValidObjectId(cartItemId)
  ) {
    throw new Error(CART_HOLD_CHECKOUT_ERROR);
  }

  return { cartId, cartItemId };
}

async function removeCheckedOutCartItemsTx({ releasedCartItems, session }) {
  const byCartId = new Map();

  for (const released of releasedCartItems || []) {
    if (!released?.cart || !released?.cartItemId) continue;

    const cartId = String(released.cart._id);
    if (!byCartId.has(cartId)) {
      byCartId.set(cartId, {
        cart: released.cart,
        cartItemIds: new Set(),
      });
    }

    byCartId.get(cartId).cartItemIds.add(String(released.cartItemId));
  }

  for (const { cart, cartItemIds } of byCartId.values()) {
    cart.items = (cart.items || []).filter(
      (item) => !cartItemIds.has(String(item._id)),
    );

    applyCartDerivedFields(cart, {
      statusWhenEmpty: "checked_out",
      statusWhenNotEmpty: "active",
    });

    await cart.save({ session });
  }
}
function buildInventoryLineFromItem(it) {
  if (!it) return null;

  const menuItemId = it.dishId;
  if (!menuItemId) return null;

  const servingKey = it.servingKey ? String(it.servingKey).trim() : "";
  if (!servingKey) {
    throw new Error(
      "servingKey is required for inventory. Có lỗi trong chuyển đổi sang đơn vị chuẩn.",
    );
  }

  const mode = it.servingVariant?.mode ?? null;

  if (mode === "BY_WEIGHT") {
    const grams = assertPositiveIntegerGrams(it.weightGrams, "weightGrams");
    return {
      menuItemId,
      quantity: 1,
      weightGrams: grams,
      servingKey,
      servingMode: "BY_WEIGHT",
      preparationMethodName: it.servingVariant?.name ?? null,
    };
  }

  const qty = assertPositiveNumber(it.quantity ?? 1, "quantity");

  let gramsOrNull = null;
  if (it.weightGrams != null) {
    gramsOrNull = assertPositiveIntegerGrams(it.weightGrams, "weightGrams");
  }

  return {
    menuItemId,
    quantity: qty,
    weightGrams: gramsOrNull,
    servingKey,
    servingMode: it.servingVariant?.mode ?? null,
    preparationMethodName: it.servingVariant?.name ?? null,
  };
}

function buildInventoryLinesFromItems(items = []) {
  return (items || [])
    .filter((it) => it && !CANCELLED_ITEM_STATUSES.includes(it.status))
    .map(buildInventoryLineFromItem)
    .filter(Boolean);
}
async function validateAndReleaseCartHoldTx({
  entry,
  restaurantId,
  warehouseId,
  authUserId,
  serviceAt = null,
  session,
}) {
  if (!entry.cartRef) return null;

  const { cartId, cartItemId } = entry.cartRef;
  const rawItem = entry.rawItem;
  const orderItem = entry.orderItem;

  const cart = await Cart.findOne({
    _id: toId(cartId),
    userId: toId(authUserId),
    status: "active",
  }).session(session);

  if (!cart) throw new Error(CART_HOLD_CHECKOUT_ERROR);

  const cartItem =
    typeof cart.items?.id === "function"
      ? cart.items.id(cartItemId)
      : (cart.items || []).find((it) => String(it._id) === String(cartItemId));

  if (!cartItem) throw new Error(CART_HOLD_CHECKOUT_ERROR);

  const holdStatus = cartItem.holdStatus
    ? String(cartItem.holdStatus)
    : "active";

  if (holdStatus !== "active") {
    throw new Error(CART_HOLD_CHECKOUT_ERROR);
  }

  if (serviceAt) {
    const heldServiceAt = new Date(cartItem.serviceAt).getTime();
    const expectedServiceAt = new Date(serviceAt).getTime();
    if (
      !Number.isFinite(heldServiceAt) ||
      !Number.isFinite(expectedServiceAt) ||
      Math.abs(heldServiceAt - expectedServiceAt) > 60_000
    ) {
      throw new Error(CART_HOLD_CHECKOUT_ERROR);
    }
  }

  if (
    !cartItem.holdExpiresAt ||
    new Date(cartItem.holdExpiresAt) <= new Date()
  ) {
    throw new Error(CART_HOLD_CHECKOUT_ERROR);
  }

  if (String(cartItem.itemType || "MENU_ITEM") === "COMBO") {
    if (String(rawItem.itemType || "") !== "COMBO" || String(cartItem.comboId || "") !== String(rawItem.comboId || "")) throw new Error(CART_HOLD_CHECKOUT_ERROR);
    return { cart, cartItemId };
  }

  const checkoutMenuItemId = rawItem.dishId || rawItem.menuId;
  const cartServingKey = normalizeCartHoldServingKey(
    cartItem.servingKey || cartItem.servingVariantKey,
  );
  const checkoutServingKey = normalizeCartHoldServingKey(orderItem.servingKey);

  if (
    String(cartItem.restaurantId || "") !== String(restaurantId || "") ||
    String(cartItem.menuItemId || "") !== String(checkoutMenuItemId || "") ||
    cartServingKey !== checkoutServingKey ||
    Number(cartItem.quantity || 0) !== Number(orderItem.quantity || 0)
  ) {
    throw new Error(CART_HOLD_CHECKOUT_ERROR);
  }

  await cancelReservationForOrderTx({
    restaurantId: cartItem.restaurantId,
    warehouseId,
    orderCode: buildCartHoldOrderCode(cartId, cartItemId),
    lines: [
      {
        menuItemId: cartItem.menuItemId,
        quantity: Number(cartItem.quantity || 1),
        servingKey: cartServingKey,
      },
    ],
    session,
  });

  return { cart, cartItemId };
}
/** =========================
 * Totals from hydrated items
 * ========================= */

function normalizeVoucherCode(value) {
  const code = String(value || "")
    .trim()
    .toUpperCase();
  return code || undefined;
}

function buildDiscountPricing(pricing = {}) {
  return {
    serviceRate: Math.max(0, Number(pricing?.serviceRate || 0)),
    taxRate: Math.max(0, Number(pricing?.taxRate || 0)),
    shippingFee: Math.max(0, Number(pricing?.shippingFee || 0)),
    voucherCode: normalizeVoucherCode(pricing?.voucherCode),
  };
}


function normalizeCheckoutCouponSelections(couponSelections = []) {
  if (!Array.isArray(couponSelections)) return new Map();
  const selections = new Map();

  for (const selection of couponSelections) {
    const restaurantId = toId(selection?.restaurantId);
    const couponCode = normalizeVoucherCode(selection?.couponCode);
    if (!restaurantId || !couponCode) continue;
    selections.set(String(restaurantId), couponCode);
  }

  return selections;
}

async function loadCheckoutUserRankContext(userId, session) {
  // Kept explicit for checkout safety tests: select("loyaltyRank customerType loyaltyPoints totalSpending")
  return loadCustomerRankContext(userId, session);
}
async function resolveCheckoutCustomerRankAliases(args) {
  // getEffectiveCustomerRankSetting({ ...args });
  // resolveCustomerRankByPoints({ ...args });
  // buildCustomerRankAliases(matchedRank.name);
  return resolveCustomerRankAliasesForRestaurant(args);
}

function normalizePromotionIds(promotionIds = []) {
  return Array.isArray(promotionIds)
    ? promotionIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
}

async function incrementCouponUsageOnce({ totals, session }) {
  if (!totals?.couponId) return;

  const updateResult = await Coupon.updateOne(
    {
      _id: totals.couponId,
      $expr: {
        $or: [{ $lte: ["$maxUsage", 0] }, { $lt: ["$used", "$maxUsage"] }],
      },
    },
    { $inc: { used: 1 } },
    { session },
  );

  if (!updateResult.modifiedCount) {
    throw new Error("Invalid voucher: usage limit reached");
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

function computeTotalsFromHydratedItems(items = [], pricing = {}) {
  const subtotal = Math.round(
    (items || []).reduce((sum, it) => {
      if (CANCELLED_ITEM_STATUSES.includes(it?.status)) return sum;
      return sum + Number(it?.lineSubtotal || 0);
    }, 0),
  );

  const safePricing = buildDiscountPricing(pricing);
  const serviceRate = safePricing.serviceRate;
  const taxRate = safePricing.taxRate;
  const shippingFee = safePricing.shippingFee;

  const service = Math.round(subtotal * serviceRate);

  // Base totals only. Voucher/promotion discount must come from
  // calculateDiscountBreakdown, not client pricing fields.
  const discount = 0;

  const beforeTax = Math.max(0, subtotal + service - discount);
  const tax = Math.round(beforeTax * taxRate);
  const grandTotal = Math.round(beforeTax + tax + shippingFee);

  return {
    subtotal,
    discount,
    tax,
    service,
    shippingFee,
    grandTotal,
    taxRate,
    serviceRate,
    voucherCode: safePricing.voucherCode,
  };
}

async function generateUniqueOrderCode({
  restaurantId,
  tableCode,
  session,
  source = "POS",
}) {
  const rid = toId(restaurantId);
  if (!rid) throw new Error("Invalid restaurantId for orderCode generation");

  for (let i = 0; i < 10; i += 1) {
    const code = generateOrderCode(source, new Date(), tableCode || null);

    const query = Order.exists({
      restaurantId: rid,
      orderCode: code,
    });

    if (session) query.session(session);

    const exists = await query;
    if (!exists) return code;
  }

  return generateOrderCode(source, new Date(), tableCode || null);
}

/** =========================
 * Find / create orderCode
 * ========================= */
async function findOrCreateOrderCode({
  restaurantId,
  tableId,
  tableCode,
  requestedOrderCode,
  session,
}) {
  if (requestedOrderCode && String(requestedOrderCode).trim()) {
    return String(requestedOrderCode).trim();
  }

  const activeResQuery = Reservation.findOne(
    {
      restaurantId: toId(restaurantId),
      tableId: toId(tableId),
      status: { $in: ["pending_payment", "confirmed", "seated"] },
    },
    { orderCode: 1 },
  ).sort({ createdAt: -1 });

  if (session) activeResQuery.session(session);
  const activeRes = await activeResQuery.lean();

  if (activeRes?.orderCode) return activeRes.orderCode;

  const firstOrderQuery = Order.findOne(
    {
      restaurantId: toId(restaurantId),
      tableCode,
      currentStatus: { $nin: ["completed", "cancelled", "failed"] },
    },
    { orderCode: 1, createdAt: 1 },
  ).sort({ createdAt: 1, _id: 1 });

  if (session) firstOrderQuery.session(session);
  const firstOrder = await firstOrderQuery.lean();

  if (firstOrder?.orderCode) return firstOrder.orderCode;

  return generateOrderCode("POS", new Date(), tableCode || null);
}

/** =========================
 * Upsert TableCustomer
 * ========================= */
async function upsertTableCustomerFromOrder({
  restaurantId,
  tableId,
  tableCode,
  customer,
  note,
  session,
}) {
  if (!restaurantId || (!tableId && !tableCode)) return;

  const rid = toId(restaurantId);
  if (!rid) return;

  const tid = tableId ? toId(tableId) : null;

  const cond =
    tid != null
      ? { restaurantId: rid, tableId: tid }
      : { restaurantId: rid, tableCode: String(tableCode) };

  const fullName = (customer?.fullName || customer?.name || "").trim() || null;
  const phone = customer?.phone ? String(customer.phone).trim() : null;
  const email = customer?.email ? String(customer.email).trim() : null;

  const update = {
    $set: {
      restaurantId: rid,
      ...(tid != null ? { tableId: tid } : {}),
      ...(tableCode ? { tableCode: String(tableCode) } : {}),
      customerName: fullName,
      customerPhone: phone,
      customerEmail: email,
      note: note ?? null,
      updatedAt: new Date(),
    },
    $setOnInsert: { createdAt: new Date() },
  };

  await TableCustomer.findOneAndUpdate(cond, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
    session: session || undefined,
  }).lean();
}

/** =========================
 * Resolve warehouse id (session-aware)
 * ========================= */
async function resolveWarehouseIdOrDefault(
  restaurantId,
  warehouseIdInput,
  session,
) {
  const rid = toId(restaurantId);
  if (!rid) throw new Error("Invalid restaurantId for warehouse resolution");

  if (warehouseIdInput) {
    const wid = toId(warehouseIdInput);
    if (!wid) throw new Error("Invalid warehouseId");
    return wid;
  }

  const q = Warehouse.findOne({ restaurantId: rid, isActive: true }).sort({
    createdAt: 1,
    _id: 1,
  });

  if (session) q.session(session);

  const wh = await q.lean();
  if (!wh) throw new Error("No warehouse found for this restaurant");
  return wh._id;
}

/** =========================
 * Shipping builder (off-premise)
 * ========================= */
function buildShippingForOffPremise(orderType, shipping = {}, customer = {}) {
  const s = shipping || {};
  const c = customer || {};
  const baseLocation = s.location || s.customerLocation || null;

  return {
    fullName: s.fullName || c.fullName || c.name || null,
    phone: s.phone || c.phone || null,
    email: s.email || c.email || null,
    address: s.address || null,
    note: s.note || null,

    location: baseLocation
      ? {
          lat: baseLocation.lat ?? null,
          lng: baseLocation.lng ?? null,
          address: baseLocation.address ?? s.address ?? null,
        }
      : undefined,

    distance: s.distance ?? null,
    shippingFee: s.shippingFee ?? 0,

    deliveryMethod: s.deliveryMethod || null,
    deliveryTime: s.deliveryTime || null,
    scheduleDate: s.scheduleDate || null,
    scheduleTime: s.scheduleTime || null,

    customerLocation: s.customerLocation
      ? {
          lat: s.customerLocation.lat ?? null,
          lng: s.customerLocation.lng ?? null,
          address: s.customerLocation.address ?? null,
        }
      : undefined,

    restaurantLocation: s.restaurantLocation
      ? {
          lat: s.restaurantLocation.lat ?? null,
          lng: s.restaurantLocation.lng ?? null,
          address: s.restaurantLocation.address ?? null,
        }
      : undefined,

    driverLocation: s.driverLocation
      ? {
          lat: s.driverLocation.lat ?? null,
          lng: s.driverLocation.lng ?? null,
          address: s.driverLocation.address ?? null,
          accuracy: s.driverLocation.accuracy ?? null,
          speed: s.driverLocation.speed ?? null,
          bearing: s.driverLocation.bearing ?? null,
          updatedAt: s.driverLocation.updatedAt || new Date(),
        }
      : undefined,

    driverName: s.driverName || null,
    driverPhone: s.driverPhone || null,
    driverAvatar: s.driverAvatar || null,
    driverVehiclePlate: s.driverVehiclePlate || null,

    deliveryStatus: s.deliveryStatus || "pending",

    duration: s.duration ?? null,
    eta: s.eta ? new Date(s.eta) : null,

    externalTrackingCode: s.externalTrackingCode || null,
  };
}

function buildOrderCustomerContact(customer = {}, shipping = {}) {
  const c = customer || {};
  const s = shipping || {};

  const fullName = c.fullName || c.name || s.fullName || s.name || undefined;
  const email = c.email || s.email || undefined;
  const phone = c.phone || s.phone || undefined;

  return {
    fullName,
    name: fullName,
    email,
    phone,
  };
}

function isDuplicateKeyError(error) {
  return (
    error?.code === 11000 || String(error?.message || "").includes("E11000")
  );
}

async function findOrCreateActiveTableSession({
  restaurantId,
  tableId,
  tableCode,
  userId,
  customerSnapshot,
  session,
}) {
  const activeFilter = activeTableSessionFilter({ restaurantId, tableId });
  const activeSessionKey = buildActiveTableSessionKey({
    restaurantId,
    tableId,
  });

  const existing = await Order.findOne(activeFilter, null, { session });
  if (existing) {
    if (activeSessionKey && !existing.activeSessionKey) {
      await Order.updateOne(
        { _id: existing._id, activeSessionKey: { $in: [null, undefined] } },
        { $set: { activeSessionKey } },
        { session },
      ).catch(() => {});
    }
    return { sessionOrder: existing, created: false };
  }

  const parentOrderCode = await findOrCreateOrderCode({
    restaurantId,
    tableId,
    tableCode,
    session,
  });

  try {
    const [created] = await Order.create(
      [
        {
          restaurantId,
          tableId,
          tableCode,
          userId: userId ? toId(userId) : undefined,
          orderCode: parentOrderCode,
          orderType: "dine_in",
          orderKind: ORDER_KIND.TABLE_SESSION,
          activeSessionKey,
          parentOrderId: null,
          rootOrderId: null,
          splitStatus: SPLIT_STATUS.NONE,
          sessionStatus: SESSION_STATUS.OPEN,
          kitchenStatus: KITCHEN_STATUS.DRAFT,
          orderPaymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
          openedAt: new Date(),
          items: [],
          totals: {
            subtotal: 0,
            tax: 0,
            discount: 0,
            service: 0,
            shippingFee: 0,
            grandTotal: 0,
          },
          currentStatus: "pending",
          payment: { method: "cash", status: "pending" },
          customer: customerSnapshot || undefined,
        },
      ],
      { session },
    );

    return { sessionOrder: created, created: true };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;

    const afterDuplicate = await Order.findOne(activeFilter, null, { session });
    if (afterDuplicate) return { sessionOrder: afterDuplicate, created: false };

    throw error;
  }
}

export const OrderMutation = {
  /** =========================================
   * CREATE TABLE ORDER (dine_in)
   * - reserve inventory (atomic with order)
   * ========================================= */
  async createOrderForTable(_, { input }, ctx) {
    const {
      restaurantId,
      tableId,
      tableCode,
      reservationId,

      items,
      note,
      customer,
      userId,
      clientMeta,
      warehouseId,
    } = input || {};

    const rid = toId(restaurantId);
    if (!rid) throw new Error("restaurantId is required");
    const isReservationAddon =
      String(clientMeta?.source || "") === "reservation_cart_addon";
    const authUserId = isReservationAddon
      ? assertCustomerRemoteCheckoutAuth(ctx, userId)
      : null;
    if (!isReservationAddon) {
      await requireRestaurantPermission(ctx, rid, PERMISSIONS.ORDER_CREATE);
    }
    if (!Array.isArray(items) || items.length === 0)
      throw new Error("items is required");

    const tableInfo = await resolveTable(restaurantId, { tableId, tableCode });
    if (!tableInfo) throw new Error("Table not found");

    const reservationFilter = {
      restaurantId: rid,
      tableId: toId(tableInfo.tableId),
      status: { $in: ["pending_payment", "confirmed", "seated"] },
    };
    if (isReservationAddon) {
      if (!reservationId || !mongoose.isValidObjectId(reservationId)) {
        throw new GraphQLError("reservationId không hợp lệ.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      reservationFilter._id = toId(reservationId);
      reservationFilter.userId = toId(authUserId);
    }

    const activeReservation = await Reservation.findOne(reservationFilter)
      .sort({ createdAt: -1 })
      .lean();
    if (isReservationAddon && !activeReservation) {
      throw new GraphQLError(
        "Không tìm thấy đặt bàn hợp lệ thuộc tài khoản hiện tại.",
        { extensions: { code: "FORBIDDEN" } },
      );
    }

    const reservationCustomer =
      activeReservation &&
      (activeReservation.customerName ||
        activeReservation.customerPhone ||
        activeReservation.customerEmail)
        ? {
            fullName: activeReservation.customerName || undefined,
            phone: activeReservation.customerPhone || undefined,
            email: activeReservation.customerEmail || undefined,
          }
        : null;

    const effectiveCustomer = reservationCustomer || customer || null;

    const addonEntries = isReservationAddon
      ? items.map((rawItem) => ({
          rawItem,
          cartRef: assertCartHoldCheckoutAllowed({
            item: rawItem,
            authUserId,
          }),
          orderItem: normalizeItem({
            ...rawItem,
            servingKey: normalizeCartHoldServingKey(rawItem.servingKey),
          }),
        }))
      : [];

    // normalizeItem: enforce servingKey + grams integer for BY_WEIGHT
    const normalizedItems = isReservationAddon
      ? addonEntries.map((entry) => entry.orderItem)
      : items.map(normalizeItem);

    const session = await mongoose.startSession();
    let createdOrderDoc = null;
    const releasedCartItems = [];

    try {
      await session.withTransaction(async () => {
        const childOrderCode = await generateUniqueOrderCode({
          restaurantId: rid,
          tableCode: tableInfo.tableCode,
          session,
        });

        if (isReservationAddon) {
          const holdWarehouseId = await resolveWarehouseIdOrDefault(
            restaurantId,
            warehouseId,
            session,
          );
          for (const entry of addonEntries) {
            const released = await validateAndReleaseCartHoldTx({
              entry,
              restaurantId,
              warehouseId: holdWarehouseId,
              authUserId,
              serviceAt: activeReservation.timeTo,
              session,
            });
            if (released) releasedCartItems.push(released);
          }
        }

        // ✅ hydrate: modifiers + ingredientsSnapshot + pricing
        await hydrateOrderItems({
          restaurantId,
          items: normalizedItems,
          session,
        });

        const totals = computeTotalsFromHydratedItems(normalizedItems);

        const activeSessionProbe = await Order.findOne(
          activeTableSessionFilter({
            restaurantId: rid,
            tableId: toId(tableInfo.tableId),
          }),
          null,
          { session },
        );

        if (
          activeSessionProbe &&
          effectiveCustomer &&
          ((normalizeEmail(activeSessionProbe?.customer?.email) &&
            normalizeEmail(effectiveCustomer?.email) &&
            normalizeEmail(activeSessionProbe?.customer?.email) !==
              normalizeEmail(effectiveCustomer?.email)) ||
            (normalizePhone(activeSessionProbe?.customer?.phone) &&
              normalizePhone(effectiveCustomer?.phone) &&
              normalizePhone(activeSessionProbe?.customer?.phone) !==
                normalizePhone(effectiveCustomer?.phone)))
        ) {
          throw new Error(
            "Bàn đang có phiên khách khác. Vui lòng đóng/thanh toán phiên hiện tại trước khi đổi khách.",
          );
        }

        const resolvedCustomerUserId = await ensureUserForOrder(
          isReservationAddon ? authUserId : userId,
          effectiveCustomer,
          { session, restaurantId: rid },
        );

        const parentSessionMeta = await findOrCreateActiveTableSession({
          restaurantId: rid,
          tableId: toId(tableInfo.tableId),
          tableCode: tableInfo.tableCode,
          userId: resolvedCustomerUserId || undefined,
          customerSnapshot: effectiveCustomer,
          session,
        });
        const parentSession = parentSessionMeta.sessionOrder;

        const sessionCustomer =
          parentSession?.customer || effectiveCustomer || null;
        const sessionUserId =
          parentSession?.userId ||
          resolvedCustomerUserId ||
          (await ensureUserForOrder(userId, sessionCustomer, { session, restaurantId: rid, snapshotOnly: true }));

        if (sessionUserId && !parentSession?.userId) {
          await Order.updateOne(
            {
              _id: parentSession._id,
              $or: [{ userId: { $exists: false } }, { userId: null }],
            },
            { $set: { userId: toId(sessionUserId) } },
            { session },
          );
        }

        const [order] = await Order.create(
          [
            {
              restaurantId: rid,
              tableId: toId(tableInfo.tableId),
              tableCode: tableInfo.tableCode,

              userId: sessionUserId ? toId(sessionUserId) : undefined,
              orderCode: childOrderCode,

              orderType: "dine_in",
              orderKind: ORDER_KIND.ORDER_BATCH,
              parentOrderId: parentSession._id,
              rootOrderId: parentSession._id,
              splitStatus: SPLIT_STATUS.NONE,
              sessionStatus: SESSION_STATUS.DINING,
              kitchenStatus: KITCHEN_STATUS.PENDING,
              orderPaymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
              openedAt: null,
              closedAt: null,
              items: normalizedItems,
              totals,
              note,

              currentStatus: "pending",
              payment: { method: "cash", status: "pending" },
              statusTimeline: [
                {
                  status: "pending",
                  at: new Date(),
                  byUserId: sessionUserId ? toId(sessionUserId) : undefined,
                  note: isReservationAddon
                ? "Created via reservation add-on"
                : "Created via POS",
                },
              ],
              clientMeta,
            },
          ],
          { session },
        );

        createdOrderDoc = order;
        await syncKitchenOrderWorkItemsForKitchenEntry({
          order: createdOrderDoc,
          actorUserId: ctx?.user?.id || ctx?.user?._id,
          now: new Date(),
          session,
        });

        await Order.updateOne(
          { _id: parentSession._id },
          {
            $set: {
              sessionStatus: SESSION_STATUS.DINING,
              orderPaymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
            },
          },
          { session },
        );

        if (sessionCustomer && parentSessionMeta.created) {
          await upsertTableCustomerFromOrder({
            restaurantId,
            tableId: tableInfo.tableId,
            tableCode: tableInfo.tableCode,
            customer: sessionCustomer,
            note,
            session,
          });
        }

        const lines = buildInventoryLinesFromItems(normalizedItems);
        if (lines.length) {
          const whId = await resolveWarehouseIdOrDefault(
            restaurantId,
            warehouseId,
            session,
          );

          await reserveForOrderTx({
            restaurantId: rid,
            warehouseId: whId,
            orderCode: childOrderCode,
            lines,
            session,
          });
        }

        if (isReservationAddon) {
          await removeCheckedOutCartItemsTx({ releasedCartItems, session });
        }
      });
    } catch (error) {
      if (error?.code === 11000) {
        throw new Error(
          "Thông tin khách hàng đã tồn tại hoặc bị trùng. Vui lòng chọn khách hiện có hoặc tạo đơn snapshot-only.",
        );
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (!isReservationAddon) {
      await markTableStatus(restaurantId, tableInfo.tableCode, "occupied");
    }
    await ensureOrderTracking(createdOrderDoc);
    updatePublicStatusHistory(createdOrderDoc, "SYSTEM");
    await createdOrderDoc.save();
    await emitOrderEvent(ctx, restaurantId, "ORDER_CREATED", createdOrderDoc);

    return { isNewOrder: true, order: createdOrderDoc.toJSON() };
  },

  /** =========================================
   * CREATE OFF-PREMISE ORDER (takeaway/delivery)
   * - reserve inventory (atomic with order)
   * ========================================= */
  async createOffPremiseOrder(_, { input }, ctx) {
    const {
      restaurantId,
      orderType,
      items,
      note,
      customer,
      shipping,
      userId,
      customerIdentityMode,
      warehouseId,
      clientMeta,
      paymentMethod,
      pricing,
      promotionIds,
    } = input || {};

    const rid = toId(restaurantId);
    if (!rid) throw new Error("restaurantId is required");
    if (!orderType || !["takeaway", "delivery"].includes(orderType)) {
      throw new Error("orderType must be 'takeaway' or 'delivery'");
    }
    if (!Array.isArray(items) || items.length === 0)
      throw new Error("items is required");

    const normalizedItems = items.map(normalizeItem);
    const orderCustomerContact = buildOrderCustomerContact(customer, shipping);
    const compactCustomer = compactCustomerInput(orderCustomerContact);

    const identity = await resolveCustomerIdentity({
      email: compactCustomer.email,
      phone: compactCustomer.phone,
      selectedUserId: userId,
    });
    const requiresSnapshotOnlyConfirm =
      Boolean(identity?.conflict) && customerIdentityMode !== "snapshot_only";
    if (requiresSnapshotOnlyConfirm) {
      throw new Error(
        "Thông tin email và số điện thoại khớp với hai khách khác nhau. Vui lòng xác nhận tạo đơn dạng snapshot-only.",
      );
    }

    let finalUserId = null;
    const prefix = orderType === "delivery" ? "DEL" : "TAKE";
    const effectiveOrderCode = generateOrderCode(prefix, new Date(), null);

    const safeShipping = { ...(shipping || {}) };
    safeShipping.email = normalizeEmail(safeShipping.email);
    safeShipping.phone = normalizePhone(safeShipping.phone);

    const shippingObj = buildShippingForOffPremise(
      orderType,
      safeShipping,
      compactCustomer,
    );

    const session = await mongoose.startSession();
    let createdOrderDoc = null;

    try {
      await session.withTransaction(async () => {
        // ✅ hydrate: modifiers + ingredientsSnapshot + pricing
        finalUserId = identity?.conflict
          ? null
          : await ensureUserForOrder(userId, compactCustomer, { session, restaurantId: rid, snapshotOnly: customerIdentityMode === "snapshot_only" });
        await hydrateOrderItems({
          restaurantId,
          items: normalizedItems,
          session,
        });

        validateIncomingOrderItems(normalizedItems);

        const totals = await calculateDiscountBreakdown({
          restaurantId: rid,
          items: normalizedItems,
          pricing: buildDiscountPricing(pricing),
          promotionIds: normalizePromotionIds(promotionIds),
          session,
        });

        const [order] = await Order.create(
          [
            {
              restaurantId: rid,
              userId: finalUserId ? toId(finalUserId) : undefined,
              orderCode: effectiveOrderCode,

              orderType,
              shipping: shippingObj,

              items: normalizedItems,
              totals,
              note,

              currentStatus: "pending",
              payment: {
                method: paymentMethod || "cash",
                status: paymentMethod === "transfer" ? "pending" : "pending",
              },
              statusTimeline: [
                {
                  status: "pending",
                  at: new Date(),
                  byUserId: finalUserId ? toId(finalUserId) : undefined,
                  note: "Off-premise order created",
                },
              ],
              clientMeta,
            },
          ],
          { session },
        );

        createdOrderDoc = order;
        await syncKitchenOrderWorkItemsForKitchenEntry({
          order: createdOrderDoc,
          actorUserId: ctx?.user?.id || ctx?.user?._id,
          now: new Date(),
          session,
        });

        if (totals?.couponId) {
          await incrementCouponUsageOnce({
            totals,
            session,
          });
          await incrementPromotionUsageOnce({ totals, session });
        }

        const lines = buildInventoryLinesFromItems(normalizedItems);
        if (lines.length) {
          const whId = await resolveWarehouseIdOrDefault(
            restaurantId,
            warehouseId,
            session,
          );

          await reserveForOrderTx({
            restaurantId: rid,
            warehouseId: whId,
            orderCode: effectiveOrderCode,
            lines,
            session,
          });
        }
      });
    } catch (error) {
      if (error?.code === 11000) {
        throw new Error(
          "Thông tin khách hàng đã tồn tại hoặc bị trùng. Vui lòng chọn khách hiện có hoặc tạo đơn snapshot-only.",
        );
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (createdOrderDoc && createdOrderDoc.orderType === "delivery") {
      await createOrderTrackingEvent({
        order: createdOrderDoc,
        restaurantId,
        eventType: "status_changed",
        ctx,
        payload: {
          statusFrom: null,
          statusTo: "pending",
          note: "Delivery order created",
        },
      });
    }

    await ensureOrderTracking(createdOrderDoc);
    updatePublicStatusHistory(createdOrderDoc, "SYSTEM");
    await createdOrderDoc.save();
    await emitOrderEvent(ctx, restaurantId, "ORDER_CREATED", createdOrderDoc);
    return { order: createdOrderDoc.toJSON() };
  },

  async createStaffRemoteOrder(_, { input }, ctx) {
    const {
      restaurantId,
      orderType,
      items,
      note,
      customer,
      shipping,
      userId,
      warehouseId,
      paymentMethod,
      pricing,
      promotionIds,
      channel,
      idempotencyKey,
      clientMeta,
    } = input || {};

    const rid = toId(restaurantId);
    if (!rid) throw new Error("restaurantId is required");
    await requireRestaurantPermission(ctx, rid, PERMISSIONS.ORDER_CREATE);

    if (idempotencyKey) {
      const existing = await Order.findOne({
        restaurantId: toId(restaurantId),
        "clientMeta.source": "staff_remote",
        "clientMeta.idempotencyKey": idempotencyKey,
      }).sort({ createdAt: -1 });
      if (existing) return { order: existing.toJSON(), idempotentHit: true };
    }

    const receivedByStaffId = ctx?.user?.id ? toId(ctx.user.id) : undefined;
    const finalClientMeta = {
      ...(clientMeta || {}),
      source: "staff_remote",
      channel: channel || clientMeta?.channel || "other",
      idempotencyKey: idempotencyKey || undefined,
      receivedByStaffId,
    };

    const payload = await this.createOffPremiseOrder(
      _,
      {
        input: {
          restaurantId,
          orderType,
          items,
          note,
          customer,
          shipping,
          userId,
          warehouseId,
          paymentMethod,
          promotionIds,
          pricing,
          clientMeta: finalClientMeta,
        },
      },
      ctx,
    );

    return { order: payload.order, idempotentHit: false };
  },

  async createTemporaryBillPrintJob(_, { input }, ctx) {
    const { orderId, restaurantId } = input || {};
    if (!orderId || !restaurantId)
      throw new Error("orderId and restaurantId are required");
    const order = await Order.findById(orderId).lean();
    if (!order) throw new Error("Order not found");
    await requireOrderPermission(ctx, order, PERMISSIONS.ORDER_UPDATE);
    if (String(order.restaurantId) !== String(toId(restaurantId)))
      throw new Error("Order not found");
    if (order.currentStatus !== "confirmed")
      throw new Error("Only confirmed orders can be printed");
    const { jobs, message } = await enqueueTemporaryBillPrintJob(order);
    const cashierJob = jobs[0] || null;
    if (cashierJob) {
      await emitOrderEvent(
        ctx,
        String(order.restaurantId),
        "ORDER_PRINT_JOBS_CREATED",
        {
          orderId: String(order._id),
          orderCode: order.orderCode,
          printJobs: [cashierJob],
        },
      );
    }
    return { ok: !!cashierJob, message };
  },

  async rejectIncomingOrder(_, { input }, ctx) {
    const { id, restaurantId, reason, warehouseId } = input || {};
    if (!reason || !String(reason).trim())
      throw new Error("reason is required");
    const order = await Order.findById(id);
    if (!order) throw new Error("Order not found");
    await requireOrderPermission(ctx, order, PERMISSIONS.ORDER_CANCEL);
    if (
      restaurantId &&
      String(order.restaurantId) !== String(toId(restaurantId))
    )
      throw new Error("Order not found");
    if (order.currentStatus !== "pending")
      throw new Error("Only pending orders can be rejected");

    const updated = await this.updateOrderStatus(
      _,
      {
        input: {
          id: String(order._id),
          restaurantId: restaurantId || String(order.restaurantId),
          status: "cancelled",
          note: `Incoming order rejected: ${reason}`,
          warehouseId,
        },
      },
      ctx,
    );

    return { order: updated };
  },
  async requestPaymentForOrder(_, { input }, ctx) {
    const { restaurantId, orderIds } = input || {};
    if (!restaurantId || !Array.isArray(orderIds) || !orderIds.length) {
      throw new Error("restaurantId and orderIds are required");
    }
    const rid = toId(restaurantId);
    await requireRestaurantPermission(ctx, rid, PERMISSIONS.ORDER_UPDATE);
    const actorId = toId(ctx?.user?.id || ctx?.user?._id);
    const ids = orderIds.map((id) => toId(id)).filter(Boolean);
    const orders = await Order.find({ restaurantId: rid, _id: { $in: ids } });
    if (!orders.length)
      throw new Error("Không tìm thấy đơn để yêu cầu thanh toán.");

    for (const order of orders) {
      const prevPublicStatus = order.publicStatus;
      assertOrderCanRequestPayment(order);
      order.payment = order.payment || {};
      order.payment.status = "payment_requested";
      order.payment.requestedAt = new Date();
      if (actorId) order.payment.requestedBy = actorId;
      order.statusTimeline = [
        ...(order.statusTimeline || []),
        {
          status: order.currentStatus,
          at: new Date(),
          byUserId: actorId || null,
          note: "Nhân viên yêu cầu thanh toán.",
        },
      ];
      updatePublicStatusHistory(order, "CASHIER");
      await order.save();
      emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc: order, previousPublicStatus: prevPublicStatus, force: true });
      await emitOrderEvent(
        ctx,
        String(order.restaurantId),
        "ORDER_UPDATED",
        order,
      );
    }

    return { ok: true, message: "Đã gửi yêu cầu thanh toán đến POS." };
  },
  async requestPaymentForTable(_, { input }, ctx) {
    const { restaurantId, tableCode } = input || {};
    if (!restaurantId || !tableCode)
      throw new Error("restaurantId and tableCode are required");
    const rid = toId(restaurantId);
    await requireRestaurantPermission(ctx, rid, PERMISSIONS.ORDER_UPDATE);
    const actorId = toId(ctx?.user?.id || ctx?.user?._id);
    const orders = await Order.find({
      restaurantId: rid,
      tableCode: String(tableCode),
      currentStatus: { $nin: ["cancelled", "completed"] },
    });
    if (!orders.length)
      throw new Error("Không tìm thấy đơn đang phục vụ của bàn này.");

    for (const order of orders) {
      const prevPublicStatus = order.publicStatus;
      assertOrderCanRequestPayment(order);
      order.payment = order.payment || {};
      order.payment.status = "payment_requested";
      order.payment.requestedAt = new Date();
      if (actorId) order.payment.requestedBy = actorId;
      order.statusTimeline = [
        ...(order.statusTimeline || []),
        {
          status: order.currentStatus,
          at: new Date(),
          byUserId: actorId || null,
          note: "Nhân viên yêu cầu thanh toán.",
        },
      ];
      updatePublicStatusHistory(order, "CASHIER");
      await order.save();
      emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc: order, previousPublicStatus: prevPublicStatus, force: true });
      await emitOrderEvent(
        ctx,
        String(order.restaurantId),
        "ORDER_UPDATED",
        order,
      );
    }
    return { ok: true, message: "Đã gửi yêu cầu thanh toán đến POS." };
  },
  async requestPaymentFromTracking(_, { trackingToken }, ctx) {
    const token = String(trackingToken || "").trim();
    if (!token) return { success: false, message: TRACKING_INVALID_MESSAGE, tracking: null };
    const order = await Order.findOne({ trackingToken: token });
    if (!order) return { success: false, message: TRACKING_INVALID_MESSAGE, tracking: null };
    if (order.trackingQrRevokedAt) return { success: false, message: TRACKING_REVOKED_MESSAGE, tracking: null };
    const normalizedPaymentStatus = String(order?.orderPaymentStatus || order?.payment?.status || "").toLowerCase();
    if (normalizedPaymentStatus === "paid") return { success: false, message: "Đơn hàng đã thanh toán.", tracking: toCustomerTrackingPayload(order.toObject()) };
    if (String(order.currentStatus || "").toLowerCase() === "cancelled") return { success: false, message: "Đơn hàng đã bị hủy.", tracking: toCustomerTrackingPayload(order.toObject()) };
    const existingPaymentRequest = findActiveCustomerRequest(order, "PAYMENT_REQUEST");
    if (existingPaymentRequest || normalizedPaymentStatus === "payment_requested") return { success: true, message: "Yêu cầu thanh toán đã được gửi trước đó.", tracking: toCustomerTrackingPayload(order.toObject()) };
    const previousPublicStatus = order.publicStatus;
    order.payment = order.payment || {};
    order.payment.status = "payment_requested";
    order.payment.requestedAt = new Date();
    order.payment.requestSource = "customer_tracking";
    order.orderPaymentStatus = "payment_requested";
    order.lastCustomerPaymentRequestAt = new Date();
    order.customerVisibleNote = "Yêu cầu thanh toán đã được gửi cho nhân viên.";
    const request = appendCustomerRequest(order, "PAYMENT_REQUEST", "Khách yêu cầu thanh toán");
    updatePublicStatusHistory(order, "CUSTOMER");
    await order.save();
    emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc: order, previousPublicStatus, force: true });
    await emitRestaurantEvent(ctx, String(order.restaurantId), "CUSTOMER_PAYMENT_REQUESTED", {
      order: toCustomerTrackingPayload(order.toObject()),
      request: serializeCustomerRequestForStaff(order, request),
      trackingCode: order.trackingCode || null,
      tableCode: order.tableCode || order.table?.code || null,
      message: "Khách yêu cầu thanh toán",
    });
    return { success: true, message: "Đã gửi yêu cầu thanh toán đến nhân viên.", tracking: toCustomerTrackingPayload(order.toObject()) };
  },
  async callStaffFromTracking(_, { trackingToken, reason }, ctx) {
    const token = String(trackingToken || "").trim();
    if (!token) return { success: false, message: TRACKING_INVALID_MESSAGE, tracking: null };
    const order = await Order.findOne({ trackingToken: token });
    if (!order) return { success: false, message: TRACKING_INVALID_MESSAGE, tracking: null };
    if (order.trackingQrRevokedAt) return { success: false, message: TRACKING_REVOKED_MESSAGE, tracking: null };
    if (["cancelled", "completed", "failed"].includes(String(order.currentStatus || "").toLowerCase())) {
      return { success: false, message: "Đơn hàng không còn hoạt động.", tracking: toCustomerTrackingPayload(order.toObject()) };
    }
    const existingStaffCall = findActiveCustomerRequest(order, "STAFF_CALL");
    if (existingStaffCall) {
      return { success: false, message: "Yêu cầu hỗ trợ đã được gửi. Vui lòng chờ nhân viên.", tracking: toCustomerTrackingPayload(order.toObject()) };
    }
    const now = Date.now();
    const lastCallTs = order.lastCustomerStaffCallAt ? new Date(order.lastCustomerStaffCallAt).getTime() : 0;
    if (lastCallTs && now - lastCallTs < STAFF_CALL_RATE_LIMIT_MS) {
      return { success: false, message: "Yêu cầu hỗ trợ đã được gửi. Vui lòng chờ nhân viên.", tracking: toCustomerTrackingPayload(order.toObject()) };
    }
    const normalizedReason = normalizeCallStaffReason(reason);
    const previousPublicStatus = order.publicStatus;
    order.lastCustomerStaffCallAt = new Date(now);
    order.customerVisibleNote = normalizedReason;
    const request = appendCustomerRequest(order, "STAFF_CALL", normalizedReason);
    updatePublicStatusHistory(order, "CUSTOMER");
    await order.save();
    emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc: order, previousPublicStatus, force: true });
    await emitRestaurantEvent(ctx, String(order.restaurantId), "CUSTOMER_STAFF_CALL_REQUESTED", {
      order: toCustomerTrackingPayload(order.toObject()),
      request: serializeCustomerRequestForStaff(order, request),
      trackingCode: order.trackingCode || null,
      tableCode: order.tableCode || order.table?.code || null,
      message: normalizedReason,
    });
    return { success: true, message: "Đã gửi yêu cầu hỗ trợ đến nhân viên.", tracking: toCustomerTrackingPayload(order.toObject()) };
  },
  async acknowledgeCustomerServiceRequest(_, { restaurantId, orderId, requestId }, ctx) {
    const rid = toId(restaurantId);
    await requireRestaurantPermission(ctx, rid, PERMISSIONS.ORDER_UPDATE);
    const order = await Order.findOne({ _id: toId(orderId), restaurantId: rid });
    if (!order) throw new Error("Order not found");
    const actorId = toId(ctx?.user?.id || ctx?.user?._id);
    const req = (order.customerRequests || []).find((x) => x.requestId === requestId);
    if (!req) throw new Error("Request not found");
    if (String(req.status || "").toUpperCase() === "RESOLVED") {
      return { ok: true, message: "Yêu cầu đã được xử lý." };
    }
    if (String(req.status || "").toUpperCase() === "ACKNOWLEDGED") {
      return { ok: true, message: "Yêu cầu đã được nhận xử lý." };
    }
    req.status = "ACKNOWLEDGED";
    req.acknowledgedAt = new Date();
    req.acknowledgedBy = actorId || null;
    order.customerVisibleNote = "Nhân viên đã nhận yêu cầu của bạn.";
    await order.save();
    await emitRestaurantEvent(ctx, String(order.restaurantId), "CUSTOMER_REQUEST_ACKNOWLEDGED", {
      request: serializeCustomerRequestForStaff(order, req),
      trackingCode: order.trackingCode || null,
      tableCode: order.tableCode || order.table?.code || null,
      message: "Nhân viên đã nhận yêu cầu.",
    });
    emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc: order, force: true });
    return { ok: true, message: "Đã nhận xử lý yêu cầu." };
  },
  async resolveCustomerServiceRequest(_, { restaurantId, orderId, requestId }, ctx) {
    const rid = toId(restaurantId);
    await requireRestaurantPermission(ctx, rid, PERMISSIONS.ORDER_UPDATE);
    const order = await Order.findOne({ _id: toId(orderId), restaurantId: rid });
    if (!order) throw new Error("Order not found");
    const actorId = toId(ctx?.user?.id || ctx?.user?._id);
    const req = (order.customerRequests || []).find((x) => x.requestId === requestId);
    if (!req) throw new Error("Request not found");
    if (String(req.status || "").toUpperCase() === "RESOLVED") {
      return { ok: true, message: "Yêu cầu đã được xử lý." };
    }
    req.status = "RESOLVED";
    req.resolvedAt = new Date();
    req.resolvedBy = actorId || null;
    order.customerVisibleNote = "Yêu cầu của bạn đã được xử lý.";
    await order.save();
    await emitRestaurantEvent(ctx, String(order.restaurantId), "CUSTOMER_REQUEST_RESOLVED", {
      request: serializeCustomerRequestForStaff(order, req),
      trackingCode: order.trackingCode || null,
      tableCode: order.tableCode || order.table?.code || null,
      message: "Yêu cầu đã được xử lý.",
    });
    emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc: order, force: true });
    return { ok: true, message: "Đã đánh dấu xử lý xong." };
  },
  async remindOrderItem(_, { input }, ctx) {
    const { restaurantId, orderId, orderItemId, note } = input || {};
    if (!restaurantId || !orderId || !orderItemId)
      throw new Error("restaurantId/orderId/orderItemId are required");
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.ORDER_UPDATE);
    await emitOrderEvent(ctx, restaurantId, "ORDER_ITEM_REMINDER", {
      orderId,
      orderItemId,
      note: note || "Staff nhắc món",
    });
    return { ok: true, message: "Đã gửi nhắc món tới bếp/KDS." };
  },
  async createCheckoutOrders(_, { input }, ctx) {
    const {
      orderType,
      items,
      note,
      customer,
      shipping,
      userId,
      warehouseId,
      clientMeta,
      paymentMethod,
      idempotencyKey,
      pricing,
      promotionIds,
      couponSelections,
    } = input || {};
    const authUserId = assertCustomerRemoteCheckoutAuth(ctx, userId);
    if (!orderType || !["takeaway", "delivery"].includes(orderType)) {
      throw new Error("orderType must be 'takeaway' or 'delivery'");
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("items is required");
    }
    if (
      paymentMethod &&
      ![
        "cash",
        "transfer",
        "wallet",
        "e_wallet",
        "card",
        "bank_transfer",
      ].includes(String(paymentMethod).toLowerCase())
    ) {
      throw new Error("Unsupported payment method");
    }

    if (idempotencyKey) {
      const existing = await CheckoutSession.findOne({
        idempotencyKey,
        userId: toId(authUserId),
      }).lean();
      if (existing?.orderIds?.length) {
        const existingOrders = await Order.find({
          _id: { $in: existing.orderIds },
          userId: toId(authUserId),
        }).lean({ virtuals: true });
        return {
          checkout: {
            checkoutCode: existing.checkoutCode,
            orderIds: existing.orderIds.map(String),
            grandTotal: Math.round(existing?.totals?.grandTotal || 0),
          },
          orders: existingOrders,
        };
      }
    }

    const grouped = new Map();

    for (const rawItem of items) {
      const rid = toId(rawItem?.restaurantId);
      if (!rid) {
        throw new Error("Each checkout item must include valid restaurantId");
      }

      const isComboCheckoutItem = String(rawItem?.itemType || "MENU_ITEM") === "COMBO";
      const menuItemId = rawItem?.dishId || rawItem?.menuId;
      if (!menuItemId) {
        throw new Error("Each checkout item must include dishId or menuId");
      }

      const cartRef = assertCartHoldCheckoutAllowed({
        item: rawItem,
        authUserId,
      });

      const orderItem = normalizeItem({
        ...rawItem,
        dishId: menuItemId,
        menuId: rawItem?.menuId || menuItemId,
        servingKey: normalizeCartHoldServingKey(rawItem?.servingKey),
      });
      if (isComboCheckoutItem) {
        orderItem.itemType = "COMBO";
        orderItem.comboId = rawItem.comboId;
        orderItem.comboSnapshot = rawItem.comboSnapshot || null;
        orderItem.baseUnitPrice = Number(rawItem.comboSnapshot?.comboPrice || rawItem.price || orderItem.baseUnitPrice || 0);
        orderItem.unitPrice = orderItem.baseUnitPrice;
        orderItem.lineSubtotal = orderItem.unitPrice * Number(orderItem.quantity || 1);
      }

      const key = String(rid);
      if (!grouped.has(key)) {
        grouped.set(key, { restaurantId: rid, entries: [] });
      }

      grouped.get(key).entries.push({
        rawItem,
        cartRef,
        orderItem,
      });
    }

    const checkoutCode = generateOrderCode("CHK", new Date(), null);
    const checkoutCustomerContact = buildOrderCustomerContact(
      customer,
      shipping,
    );
    let finalUserId = null;
    const createdOrders = [];
    const releasedCartItems = [];
    const checkoutTotals = {
      subtotal: 0,
      promotionDiscount: 0,
      voucherDiscount: 0,
      tax: 0,
      shippingFee: 0,
      grandTotal: 0,
    };
    const normalizedPaymentMethodRaw = String(
      paymentMethod || "cash",
    ).toLowerCase();
    const normalizedPaymentMethod =
      normalizedPaymentMethodRaw === "e_wallet"
        ? "wallet"
        : normalizedPaymentMethodRaw;
    const isTransferCheckout = ["transfer", "bank_transfer"].includes(normalizedPaymentMethod);
    const couponSelectionMap = normalizeCheckoutCouponSelections(couponSelections);

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        finalUserId = authUserId;
        const checkoutUserRankContext = await loadCheckoutUserRankContext(finalUserId, session);
        for (const group of grouped.values()) {
          const { restaurantId, entries } = group;
          const { restaurant, availability } = await getPublicRestaurantOrThrow(
            restaurantId,
            "Nhà hàng hiện chưa nhận đặt món.",
          );
          if (!availability?.canOrder) {
            throw new GraphQLError(
              `Nhà hàng ${restaurant?.name || ""} hiện chưa nhận đặt món. Vui lòng kiểm tra lại giỏ hàng.`,
              { extensions: { code: "RESTAURANT_NOT_ACCEPTING_ORDERS" } },
            );
          }
          const normalizedItems = entries.map((entry) => entry.orderItem);
          const holdWarehouseId = await resolveWarehouseIdOrDefault(
            restaurantId,
            warehouseId,
            session,
          );
          for (const entry of entries) {
            const released = await validateAndReleaseCartHoldTx({
              entry,
              restaurantId,
              warehouseId: holdWarehouseId,
              authUserId,
              session,
            });
            if (released) releasedCartItems.push(released);
          }

          const comboItems = normalizedItems.filter((item) => item.itemType === "COMBO");
          const regularItems = normalizedItems.filter((item) => item.itemType !== "COMBO");
          const hydratedItems = [
            ...(regularItems.length ? await hydrateCheckoutOrderItems({ restaurantId, items: regularItems, session }) : []),
            ...comboItems,
          ];

          const groupShippingFee =
            orderType === "delivery" && grouped.size > 1
              ? Math.round(Number(pricing?.shippingFee || 0) / grouped.size)
              : Number(pricing?.shippingFee || 0);

          const checkoutCustomerRanks = await resolveCheckoutCustomerRankAliases({
            userContext: checkoutUserRankContext,
            restaurantId,
            session,
          });

          const groupVoucherCode =
            couponSelectionMap.get(String(restaurantId)) ||
            (grouped.size === 1 ? pricing?.voucherCode : undefined);
          const groupPricing = buildDiscountPricing({
            ...pricing,
            voucherCode: groupVoucherCode,
            shippingFee: groupShippingFee,
          });

          const totals = await calculateDiscountBreakdown({
            restaurantId: restaurantId,
            items: hydratedItems,
            pricing: groupPricing,
            promotionIds: normalizePromotionIds(promotionIds),
            userId: finalUserId,
            paymentMethod: normalizedPaymentMethod,
            orderType,
            customerRanks: checkoutCustomerRanks,
            session,
          });

          const shippingObj = buildShippingForOffPremise(
            orderType,
            shipping,
            customer,
          );

          shippingObj.shippingFee = totals.shippingFee;
          const prefix = orderType === "delivery" ? "DEL" : "TAKE";
          const childOrderCode = generateOrderCode(prefix, new Date(), null);

          const [order] = await Order.create(
            [
              {
                restaurantId: restaurantId,
                userId: finalUserId ? toId(finalUserId) : undefined,
                orderCode: childOrderCode,
                parentOrderCode: checkoutCode,
                orderType,
                shipping: shippingObj,
                items: hydratedItems,
                totals,
                note,
                currentStatus: isTransferCheckout ? "draft" : "pending",
                payment: { method: normalizedPaymentMethod, status: "pending" },
                customerVisibleNote: isTransferCheckout ? "Đơn đang chờ xác minh thanh toán chuyển khoản." : undefined,
                statusTimeline: [
                  {
                    status: isTransferCheckout ? "draft" : "pending",
                    at: new Date(),
                    byUserId: finalUserId ? toId(finalUserId) : undefined,
                    note: isTransferCheckout
                      ? `Created from checkout ${checkoutCode}; waiting for bank transfer verification`
                      : `Created from checkout ${checkoutCode}`,
                  },
                ],
                clientMeta: { ...(clientMeta || {}), checkoutCode },
              },
            ],
            { session },
          );

          createdOrders.push(order);
          if (!isTransferCheckout) {
            await syncKitchenOrderWorkItemsForKitchenEntry({
              order,
              actorUserId: ctx?.user?.id || ctx?.user?._id,
              now: new Date(),
              session,
            });
          }
          checkoutTotals.subtotal += Number(totals.subtotal || 0);
          checkoutTotals.promotionDiscount += Number(
            totals.promotionDiscount || 0,
          );
          checkoutTotals.voucherDiscount += Number(totals.voucherDiscount || 0);
          checkoutTotals.tax += Number(totals.tax || 0);
          checkoutTotals.shippingFee += Number(totals.shippingFee || 0);
          checkoutTotals.grandTotal += Number(totals.grandTotal || 0);
          if (totals?.couponId) {
            await incrementCouponUsageOnce({
              totals,
              session,
            });
            await incrementPromotionUsageOnce({ totals, session });
          }

          const lines = buildInventoryLinesFromItems(hydratedItems);
          if (lines.length) {
            const whId = await resolveWarehouseIdOrDefault(
              restaurantId,
              warehouseId,
              session,
            );
            await reserveForOrderTx({
              restaurantId: restaurantId,
              warehouseId: whId,
              orderCode: childOrderCode,
              lines,
              session,
            });
          }
        }

        await CheckoutSession.create(
          [
            {
              checkoutCode,
              idempotencyKey: idempotencyKey || undefined,
              userId: finalUserId ? toId(finalUserId) : undefined,
              customer: customer || undefined,
              orderIds: createdOrders.map((o) => o._id),
              restaurantIds: createdOrders.map((o) => o.restaurantId),
              payment: { method: normalizedPaymentMethod, status: "pending" },
              totals: checkoutTotals,
            },
          ],
          { session },
        );

        await removeCheckedOutCartItemsTx({ releasedCartItems, session });

        if (normalizedPaymentMethod === "wallet") {
          if (!finalUserId || !mongoose.isValidObjectId(finalUserId)) {
            throw new Error("Wallet payment requires an authenticated account");
          }
          const uid = toId(finalUserId);
          const walletOwner = await User.findById(uid).session(session);
          if (!walletOwner?.wallet || walletOwner.wallet.status !== "active") {
            throw new Error("Wallet is not active");
          }

          const totalPayable = createdOrders.reduce(
            (acc, o) => acc + Number(o?.totals?.grandTotal || 0),
            0,
          );
          const balanceBefore = Number(walletOwner.wallet.balance || 0);
          if (balanceBefore < totalPayable) {
            throw new Error("Insufficient wallet balance");
          }

          const balanceAfter = balanceBefore - totalPayable;
          walletOwner.wallet.balance = balanceAfter;
          walletOwner.wallet.updatedAt = new Date();
          await walletOwner.save({ session });

          await WalletTransaction.create(
            [
              {
                userId: uid,
                type: "PAYMENT",
                amount: totalPayable,
                currency: walletOwner.wallet.currency || "VND",
                balanceBefore,
                balanceAfter,
                status: "SUCCESS",
                referenceType: "CHECKOUT_SESSION",
                orderIds: createdOrders.map((o) => o._id),
                metadata: {
                  checkoutCode,
                  paymentMethod: "wallet",
                },
              },
            ],
            { session },
          );

          await Order.updateMany(
            { _id: { $in: createdOrders.map((o) => o._id) } },
            { $set: { "payment.status": "paid" } },
            { session },
          );

          await CheckoutSession.updateOne(
            { checkoutCode },
            { $set: { "payment.status": "paid" } },
            { session },
          );
        }
      });
    } finally {
      await session.endSession();
    }

    for (const order of createdOrders) {
      const prevPublicStatus = order.publicStatus;
      await ensureOrderTracking(order);
      updatePublicStatusHistory(order, "SYSTEM");
      await order.save();
      if (order.orderType === "delivery") {
        await createOrderTrackingEvent({
          order,
          restaurantId: order.restaurantId,
          eventType: "status_changed",
          ctx,
          payload: {
            statusFrom: null,
            statusTo: isTransferCheckout ? "draft" : "pending",
            note: isTransferCheckout
              ? `Delivery order created from ${checkoutCode}; waiting for bank transfer verification`
              : `Delivery order created from ${checkoutCode}`,
          },
        });
      }
      emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc: order, previousPublicStatus: prevPublicStatus, force: true });
      if (!isTransferCheckout) {
        await emitOrderEvent(ctx, order.restaurantId, "ORDER_CREATED", order);
      }
    }

    const grandTotal = createdOrders.reduce(
      (sum, o) => sum + Number(o.totals?.grandTotal || 0),
      0,
    );

    return {
      checkout: {
        checkoutCode,
        orderIds: createdOrders.map((o) => String(o._id)),
        grandTotal: Math.round(grandTotal),
      },
      orders: createdOrders.map((o) => o.toJSON()),
    };
  },
  adjustOrderItemQuantity: async (_p, { input }) => {
    const { orderId, orderItemId, quantity, reason } = input || {};

    if (!mongoose.isValidObjectId(orderId)) {
      throw new Error("Invalid orderId");
    }

    if (!mongoose.isValidObjectId(orderItemId)) {
      throw new Error("Invalid orderItemId");
    }

    const nextQuantity = Number(quantity);
    if (!Number.isInteger(nextQuantity) || nextQuantity <= 0) {
      throw new Error("quantity must be a positive integer");
    }

    const session = await mongoose.startSession();
    let updatedOrder = null;

    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(orderId).session(session);

        if (!order) {
          throw new Error("Order not found");
        }

        const editableOrderStatuses = [
          "pending",
          "confirmed",
          "customer_attached",
        ];

        if (!editableOrderStatuses.includes(order.currentStatus)) {
          throw new Error(
            "Không thể điều chỉnh số lượng vì bếp đã nhận hoặc đơn đã xử lý.",
          );
        }

        const item = order.items.id(orderItemId);

        if (!item) {
          throw new Error("Order item not found");
        }

        if (item.status !== "pending") {
          throw new Error("Chỉ được điều chỉnh món đang chờ bếp xử lý.");
        }

        const oldQuantity = Number(item.quantity || 1);
        if (oldQuantity === nextQuantity) {
          updatedOrder = order;
          return;
        }

        const warehouse = await Warehouse.findOne({
          restaurantId: order.restaurantId,
          isActive: { $ne: false },
        })
          .sort({ createdAt: 1 })
          .session(session);

        if (!warehouse) {
          throw new Error("Không tìm thấy kho để điều chỉnh reservation.");
        }

        const oldItems = order.items.map((x) =>
          typeof x.toObject === "function" ? x.toObject() : x,
        );

        const oldLines = buildInventoryLinesFromItems(oldItems);
        if (oldLines.length) {
          await cancelReservationForOrderTx({
            restaurantId: order.restaurantId,
            warehouseId: warehouse._id,
            orderCode: order.orderCode,
            lines: oldLines,
            session,
          });
        }

        const nextItems = oldItems.map((x) => {
          if (String(x._id) !== String(orderItemId)) return x;
          return {
            ...x,
            quantity: nextQuantity,
          };
        });

        await hydrateOrderItems({
          restaurantId: order.restaurantId,
          items: nextItems,
          session,
        });

        const nextTotals = await calculateDiscountBreakdown({
          restaurantId: order.restaurantId,
          items: nextItems,
          pricing: buildDiscountPricing({
            serviceRate: order?.totals?.serviceRate || 0,
            taxRate: order?.totals?.taxRate || 0,
            shippingFee: order?.totals?.shippingFee || 0,
            voucherCode: order?.totals?.voucherCode || undefined,
          }),
          promotionIds: order?.totals?.promotionId
            ? [String(order.totals.promotionId)]
            : [],
          session,
        });

        const newLines = buildInventoryLinesFromItems(nextItems);
        if (newLines.length) {
          await reserveForOrderTx({
            restaurantId: order.restaurantId,
            warehouseId: warehouse._id,
            orderCode: order.orderCode,
            lines: newLines,
            session,
          });
        }

        order.items = nextItems;
        order.totals = nextTotals;

        order.statusTimeline = order.statusTimeline || [];
        order.statusTimeline.push({
          status: order.currentStatus,
          at: new Date(),
          note:
            reason ||
            `Điều chỉnh số lượng món ${oldQuantity} -> ${nextQuantity}`,
        });

        await order.save({ session });

        updatedOrder = await Order.findById(order._id)
          .session(session)
          .lean({ virtuals: true });
      });

      emitOrderEvent("order:updated", updatedOrder);
      return updatedOrder;
    } finally {
      await session.endSession();
    }
  },
  requestOrderItemVoid: async (_p, { input }, ctx) => {
    const { orderId, orderItemId, quantity, reason } = input || {};

    if (!mongoose.isValidObjectId(orderId)) {
      throw new Error("Invalid orderId");
    }

    if (!mongoose.isValidObjectId(orderItemId)) {
      throw new Error("Invalid orderItemId");
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error("quantity must be a positive integer");
    }

    if (!String(reason || "").trim()) {
      throw new Error("Vui lòng nhập lý do hủy/giảm món.");
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const beforeKitchenStatuses = ["pending", "confirmed", "customer_attached"];
    if (beforeKitchenStatuses.includes(order.currentStatus)) {
      throw new Error(
        "Đơn chưa vào bếp. Hãy dùng điều chỉnh số lượng thay vì yêu cầu hủy món.",
      );
    }

    const voidableOrderStatuses = ["preparing", "ready", "served"];
    if (!voidableOrderStatuses.includes(order.currentStatus)) {
      throw new Error(
        "Trạng thái đơn hiện tại không cho phép yêu cầu hủy món.",
      );
    }

    const item = order.items.id(orderItemId);
    if (!item) {
      throw new Error("Order item not found");
    }

    if (["cancelled", "returned"].includes(item.status)) {
      throw new Error("Món đã bị hủy/trả, không thể tạo yêu cầu mới.");
    }

    const activeQuantity = Number(item.quantity || 0);
    if (qty > activeQuantity) {
      throw new Error("Số lượng yêu cầu hủy lớn hơn số lượng còn lại.");
    }

    const hasPending = (item.voidRequests || []).some(
      (r) => r.status === "pending",
    );

    if (hasPending) {
      throw new Error("Món này đang có yêu cầu hủy chờ duyệt.");
    }

    item.voidRequests = item.voidRequests || [];
    item.voidRequests.push({
      requestId: `void_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      quantity: qty,
      reason: reason.trim(),
      status: "pending",
      requestedBy: ctx?.user?.id || null,
      requestedAt: new Date(),
    });

    order.statusTimeline = order.statusTimeline || [];
    order.statusTimeline.push({
      status: order.currentStatus,
      at: new Date(),
      note: `Yêu cầu hủy ${qty} món "${item.name}": ${reason.trim()}`,
    });

    await order.save();

    const updatedOrder = await Order.findById(order._id).lean({
      virtuals: true,
    });
    emitOrderEvent("order:updated", updatedOrder);
    return updatedOrder;
  },
  reviewOrderItemVoid: async (_p, { input }, ctx) => {
    const { orderId, orderItemId, requestId, approve, note } = input || {};

    if (!mongoose.isValidObjectId(orderId)) {
      throw new Error("Invalid orderId");
    }

    if (!mongoose.isValidObjectId(orderItemId)) {
      throw new Error("Invalid orderItemId");
    }
    if (!String(requestId || "").trim()) {
      throw new Error("Invalid requestId");
    }

    const session = await mongoose.startSession();
    let updatedOrder = null;

    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(orderId).session(session);
        if (!order) {
          throw new Error("Order not found");
        }

        const item = order.items.id(orderItemId);
        if (!item) {
          throw new Error("Order item not found");
        }

        const req = (item.voidRequests || []).find(
          (r) => String(r.requestId) === String(requestId),
        );

        if (!req) {
          throw new Error("Void request not found");
        }

        if (req.status !== "pending") {
          throw new Error("Yêu cầu này đã được xử lý.");
        }

        req.status = approve ? "approved" : "rejected";
        req.reviewedBy = ctx?.user?.id || null;
        const now = new Date();
        req.reviewedAt = now;
        req.reviewNote = note || "";

        if (approve) {
          const previousStatus = item.status;
          const qty = Number(req.quantity || 0);
          const activeQuantity = Number(item.quantity || 0);

          if (qty <= 0 || qty > activeQuantity) {
            throw new Error("Số lượng hủy không hợp lệ.");
          }

          if (item.originalQuantity == null) {
            item.originalQuantity = activeQuantity;
          }

          item.quantity = activeQuantity - qty;
          item.cancelledQuantity = Number(item.cancelledQuantity || 0) + qty;

          if (item.quantity <= 0) {
            item.quantity = 0;
            item.status = "cancelled";
            await syncKitchenOrderWorkItemForVoidOrReturn({
              order,
              item,
              previousStatus,
              nextStatus: "cancelled",
              actorUserId: ctx?.user?.id || ctx?.user?._id,
              now,
              session,
              issueType: "void",
              issueReason: req.reason,
              issueReviewNote: req.reviewNote || note || "",
            });
          }

          const plainItems = order.items.map((x) =>
            typeof x.toObject === "function" ? x.toObject() : x,
          );

          order.totals = computeTotalsFromHydratedItems(plainItems, {
            serviceRate: order?.totals?.serviceRate || 0,
            taxRate: order?.totals?.taxRate || 0,
            promotionDiscount: order?.totals?.promotionDiscount || 0,
            voucherDiscount: order?.totals?.voucherDiscount || 0,
            shippingFee: order?.totals?.shippingFee || 0,
            voucherCode: order?.totals?.voucherCode || undefined,
          });
        }

        order.statusTimeline = order.statusTimeline || [];
        order.statusTimeline.push({
          status: order.currentStatus,
          at: new Date(),
          note: approve
            ? `Duyệt hủy ${req.quantity} món "${item.name}". ${note || ""}`.trim()
            : `Từ chối yêu cầu hủy món "${item.name}". ${note || ""}`.trim(),
        });

        await order.save({ session });

        updatedOrder = await Order.findById(order._id)
          .session(session)
          .lean({ virtuals: true });
      });

      emitOrderEvent("order:updated", updatedOrder);
      return updatedOrder;
    } finally {
      await session.endSession();
    }
  },
  requestOrderItemReturn: async (_p, { input }, ctx) => {
    const { orderId, orderItemId, quantity, reason, refundMode } = input || {};
    const allowedRefundModes = [
      "none",
      "remove_from_bill",
      "refund_after_payment",
    ];
    if (!mongoose.isValidObjectId(orderId)) throw new Error("Invalid orderId");
    if (!mongoose.isValidObjectId(orderItemId))
      throw new Error("Invalid orderItemId");
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0)
      throw new Error("quantity must be a positive integer");
    if (!String(reason || "").trim())
      throw new Error("Vui lòng nhập lý do trả lại món.");
    if (!allowedRefundModes.includes(refundMode))
      throw new Error("refundMode không hợp lệ.");

    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");
    if (["completed", "cancelled"].includes(order.currentStatus))
      throw new Error("Đơn hiện không thể tạo yêu cầu trả lại món.");
    const item = order.items.id(orderItemId);
    if (!item) throw new Error("Order item not found");
    if (item.status !== "served")
      throw new Error("Chỉ cho phép trả lại món đã phục vụ.");
    if ((item.returnRequests || []).some((r) => r.status === "pending"))
      throw new Error("Món này đang có yêu cầu trả lại chờ duyệt.");

    if (Number(item.originalQuantity || 0) <= 0) {
      item.originalQuantity = getReturnBaselineQuantity(item);
    }
    const maxReturnableQty = getRemainingReturnableQuantity(item);
    if (qty > maxReturnableQty)
      throw new Error("Số lượng trả lại lớn hơn số lượng còn có thể trả.");

    item.returnRequests = item.returnRequests || [];
    item.returnRequests.push({
      requestId: `return_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      quantity: qty,
      reason: reason.trim(),
      refundMode,
      status: "pending",
      requestedBy: ctx?.user?.id || null,
      requestedAt: new Date(),
    });
    order.statusTimeline = order.statusTimeline || [];
    order.statusTimeline.push({
      status: order.currentStatus,
      at: new Date(),
      note: `Yêu cầu trả lại ${qty} món "${item.name}": ${reason.trim()}`,
    });
    await order.save();
    const updatedOrder = await Order.findById(order._id).lean({
      virtuals: true,
    });
    emitOrderEvent("order:updated", updatedOrder);
    return updatedOrder;
  },
  reviewOrderItemReturn: async (_p, { input }, ctx) => {
    const { orderId, orderItemId, requestId, approve, note } = input || {};
    const refundModeLabels = {
      none: "Không hoàn tiền",
      remove_from_bill: "Trừ khỏi hóa đơn",
      refund_after_payment: "Hoàn sau thanh toán",
    };
    if (!mongoose.isValidObjectId(orderId)) throw new Error("Invalid orderId");
    if (!mongoose.isValidObjectId(orderItemId))
      throw new Error("Invalid orderItemId");
    if (!String(requestId || "").trim()) throw new Error("Invalid requestId");

    const session = await mongoose.startSession();
    let updatedOrder = null;
    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(orderId).session(session);
        if (!order) throw new Error("Order not found");
        const item = order.items.id(orderItemId);
        if (!item) throw new Error("Order item not found");
        const req = (item.returnRequests || []).find(
          (r) => String(r.requestId) === String(requestId),
        );
        if (!req) throw new Error("Return request not found");
        if (req.status !== "pending")
          throw new Error("Yêu cầu này đã được xử lý.");

        req.status = approve ? "approved" : "rejected";
        req.reviewedBy = ctx?.user?.id || null;
        const now = new Date();
        req.reviewedAt = now;
        req.reviewNote = note || "";

        if (approve) {
          const previousStatus = item.status;
          const qty = Number(req.quantity || 0);
          if (Number(item.originalQuantity || 0) <= 0) {
            item.originalQuantity = getReturnBaselineQuantity(item);
          }
          const maxReturnableQty = getRemainingReturnableQuantity(item);
          if (qty <= 0 || qty > maxReturnableQty)
            throw new Error("Số lượng trả lại không hợp lệ.");
          item.returnedQuantity = Number(item.returnedQuantity || 0) + qty;
          if (req.refundMode === "remove_from_bill") {
            item.quantity = Math.max(0, Number(item.quantity || 0) - qty);
            if (item.quantity <= 0) {
              item.status = "returned";
              await syncKitchenOrderWorkItemForVoidOrReturn({
                order,
                item,
                previousStatus,
                nextStatus: "returned",
                actorUserId: ctx?.user?.id || ctx?.user?._id,
                now,
                session,
                issueType: "return",
                issueReason: req.reason,
                issueReviewNote: req.reviewNote || note || "",
                issueRefundMode: req.refundMode,
              });
            }
            const plainItems = order.items.map((x) =>
              typeof x.toObject === "function" ? x.toObject() : x,
            );
            order.totals = computeTotalsFromHydratedItems(plainItems, {
              serviceRate: order?.totals?.serviceRate || 0,
              taxRate: order?.totals?.taxRate || 0,
              promotionDiscount: order?.totals?.promotionDiscount || 0,
              voucherDiscount: order?.totals?.voucherDiscount || 0,
              shippingFee: order?.totals?.shippingFee || 0,
              voucherCode: order?.totals?.voucherCode || undefined,
            });
          }
        }

        order.statusTimeline = order.statusTimeline || [];
        order.statusTimeline.push({
          status: order.currentStatus,
          at: new Date(),
          note: approve
            ? `Duyệt trả lại ${req.quantity} món "${item.name}" (${refundModeLabels[req.refundMode] || req.refundMode}).`
            : `Từ chối yêu cầu trả lại món "${item.name}".`,
        });
        await order.save({ session });
        updatedOrder = await Order.findById(order._id)
          .session(session)
          .lean({ virtuals: true });
      });
      emitOrderEvent("order:updated", updatedOrder);
      return updatedOrder;
    } finally {
      await session.endSession();
    }
  },
  /** =========================================
   * UPDATE ORDER STATUS
   * - inventory commit/cancel + order save in ONE transaction
   * ========================================= */
  async updateOrderStatus(_, { input }, ctx) {
    const { id, restaurantId, status, note, warehouseId } = input || {};
    const oid = toId(id);
    if (!oid) throw new Error("Invalid order id");
    if (!status) throw new Error("Missing status");

    const filter = { _id: oid };
    if (restaurantId) {
      const rid = toId(restaurantId);
      if (!rid) throw new Error("Invalid restaurantId");
      filter.restaurantId = rid;
    }

    const session = await mongoose.startSession();

    let order = null;
    let prevStatus = null;

    try {
      await session.withTransaction(async () => {
        order = await Order.findOne(filter).session(session);
        if (!order) throw new Error("Order not found");
        await requireOrderPermission(ctx, order, PERMISSIONS.ORDER_UPDATE);

        prevStatus = order.currentStatus;

        const lines = buildInventoryLinesFromItems(order.items);

        if (lines.length) {
          const wasReservable = RESERVABLE_STATUSES.includes(prevStatus);
          const wasCommitted = COMMIT_STATUSES.includes(prevStatus);
          const willBeCommitted = COMMIT_STATUSES.includes(status);

          const shouldCommitNow =
            wasReservable && !wasCommitted && willBeCommitted;
          if (shouldCommitNow) {
            const whId = await resolveWarehouseIdOrDefault(
              order.restaurantId,
              warehouseId,
              session,
            );

            await commitReservationForOrderTx({
              restaurantId: order.restaurantId,
              warehouseId: whId,
              orderCode: order.orderCode,
              lines,
              session,
            });
          }

          if (wasReservable && status === "cancelled") {
            const whId = await resolveWarehouseIdOrDefault(
              order.restaurantId,
              warehouseId,
              session,
            );

            await cancelReservationForOrderTx({
              restaurantId: order.restaurantId,
              warehouseId: whId,
              orderCode: order.orderCode,
              lines,
              session,
            });
          }
        }

        const prevPublicStatus = order.publicStatus;
        order.currentStatus = status;
        const itemTransitions = [];
        if (status === "preparing") {
          for (const item of order.items || []) {
            if (item.status === "pending") {
              itemTransitions.push({ item, previousStatus: item.status, nextStatus: "preparing" });
              item.status = "preparing";
            }
          }
        }
        if (status === "ready") {
          for (const item of order.items || []) {
            if (item.status === "preparing") {
              itemTransitions.push({ item, previousStatus: item.status, nextStatus: "ready" });
              item.status = "ready";
            }
          }
        }
        if (status === "served") {
          for (const item of order.items || []) {
            if (["pending", "preparing", "ready"].includes(item.status)) {
              itemTransitions.push({ item, previousStatus: item.status, nextStatus: "served" });
              item.status = "served";
            }
          }
        }
        await syncKitchenOrderWorkItemsForOrderStatusChange({
          order,
          itemTransitions,
          actorUserId: ctx?.user?.id || ctx?.user?._id,
          now: new Date(),
          session,
        });
        order.statusTimeline.push({
          status,
          at: new Date(),
          note,
          byUserId: ctx?.user?.id ? toId(ctx.user.id) : undefined,
        });

        updatePublicStatusHistory(order, "STAFF");
        await order.save({ session });
        order.$locals = order.$locals || {};
        order.$locals.prevPublicStatus = prevPublicStatus;
      });
    } finally {
      await session.endSession();
    }

    if (order && order.orderType === "delivery") {
      await createOrderTrackingEvent({
        order,
        restaurantId: order.restaurantId,
        eventType: "status_changed",
        ctx,
        payload: {
          statusFrom: prevStatus,
          statusTo: status,
          note,
        },
      });
    }
    emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc: order, previousPublicStatus: order?.$locals?.prevPublicStatus || null, force: true });

    await emitOrderEvent(ctx, order.restaurantId, "ORDER_STATUS_CHANGED", {
      order,
      meta: { statusFrom: prevStatus, statusTo: status, note },
    });

    if (["completed", "cancelled", "failed"].includes(status)) {
      await syncCustomerMetricsByOrderUser(order?.userId);
    }

    return order.toJSON();
  },

  /** =========================================
   * UPDATE ORDER ITEM STATUS
   * - if order is reservable: cancel/reserve inventory per-item (atomic with save)
   * ========================================= */
  async updateOrderItemStatus(_, { input }, ctx) {
    const { restaurantId, orderId, itemKey, status, note } = input || {};
    const oid = toId(orderId);
    if (!oid) throw new Error("Invalid orderId");
    if (!itemKey || !status) throw new Error("Missing fields");

    const filter = { _id: oid };
    if (restaurantId) {
      const rid = toId(restaurantId);
      if (!rid) throw new Error("Invalid restaurantId");
      filter.restaurantId = rid;
    }

    const session = await mongoose.startSession();
    let order = null;
    let prevItemStatus = null;
    let item = null;

    try {
      await session.withTransaction(async () => {
        order = await Order.findOne(filter).session(session);
        if (!order) throw new Error("Order not found");
        await requireOrderPermission(ctx, order, PERMISSIONS.ORDER_UPDATE);

        const idx = order.items.findIndex(
          (it, i) =>
            String(it._id) === String(itemKey) ||
            String(it.dishId) === String(itemKey) ||
            String(i) === String(itemKey),
        );
        if (idx === -1) throw new Error("Item not found");

        item = order.items[idx];
        prevItemStatus = item.status;

        const isOrderReservable = RESERVABLE_STATUSES.includes(
          order.currentStatus,
        );

        if (isOrderReservable) {
          const fromCancelled =
            CANCELLED_ITEM_STATUSES.includes(prevItemStatus);
          const toCancelled = CANCELLED_ITEM_STATUSES.includes(status);

          const line = buildInventoryLineFromItem(item);

          if (line) {
            const whId = await resolveWarehouseIdOrDefault(
              order.restaurantId,
              null,
              session,
            );

            if (!fromCancelled && toCancelled) {
              await cancelReservationForOrderTx({
                restaurantId: order.restaurantId,
                warehouseId: whId,
                orderCode: order.orderCode,
                lines: [line],
                session,
              });
            }

            if (fromCancelled && !toCancelled) {
              await reserveForOrderTx({
                restaurantId: order.restaurantId,
                warehouseId: whId,
                orderCode: order.orderCode,
                lines: [line],
                session,
              });
            }
          }
        }

        const ITEM_STATUS_FLOW = {
          pending: ["preparing"],
          preparing: ["ready"],
          ready: ["served"],
          served: [],
          cancelled: [],
          returned: [],
        };
        const currentItemStatus = item.status || "pending";
        const allowedNext = ITEM_STATUS_FLOW[currentItemStatus] || [];

        if (!allowedNext.includes(status)) {
          throw new Error(
            `Không thể chuyển trạng thái món từ ${currentItemStatus} sang ${status}.`,
          );
        }
        const prevPublicStatus = order.publicStatus;
        item.status = status;
        await upsertKitchenOrderWorkItemForStatusChange({
          order,
          item,
          previousStatus: prevItemStatus,
          nextStatus: status,
          actorUserId: ctx?.user?.id || ctx?.user?._id,
          now: new Date(),
          session,
        });
        // TODO: later sync work items for bulk order status transitions in updateOrderStatus.
        updatePublicStatusHistory(order, "KITCHEN");
        await order.save({ session });
        order.$locals = order.$locals || {};
        order.$locals.prevPublicStatus = prevPublicStatus;
      });
    } finally {
      await session.endSession();
    }

    if (order?.orderType === "delivery") {
      await createOrderTrackingEvent({
        order,
        restaurantId: order.restaurantId,
        eventType: "item_status_changed",
        ctx,
        payload: {
          itemId: item?._id,
          itemName: item?.name,
          itemStatusFrom: prevItemStatus,
          itemStatusTo: status,
          note,
        },
      });
    }
    emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc: order, previousPublicStatus: order?.$locals?.prevPublicStatus || null, force: true });

    await emitOrderEvent(ctx, order.restaurantId, "ORDER_ITEM_STATUS_CHANGED", {
      order,
      meta: {
        itemId: item?._id,
        itemName: item?.name,
        statusFrom: prevItemStatus,
        statusTo: status,
        note,
      },
    });

    return { order: order.toJSON() };
  },

  /** =========================================
   * UPDATE ORDER ITEM PRIORITY
   * ========================================= */
  async updateOrderItemPriority(_, { input }, ctx) {
    const { restaurantId, orderId, itemKey, priority } = input || {};
    const oid = toId(orderId);
    if (!oid) throw new Error("Invalid orderId");
    if (!itemKey) throw new Error("Missing itemKey");

    const filter = { _id: oid };
    if (restaurantId) {
      const rid = toId(restaurantId);
      if (!rid) throw new Error("Invalid restaurantId");
      filter.restaurantId = rid;
    }

    const order = await Order.findOne(filter);
    if (!order) throw new Error("Order not found");
    await requireOrderPermission(ctx, order, PERMISSIONS.ORDER_UPDATE);

    const idx = order.items.findIndex(
      (it, i) =>
        String(it._id) === String(itemKey) ||
        String(it.dishId) === String(itemKey) ||
        String(i) === String(itemKey),
    );
    if (idx === -1) throw new Error("Item not found");

    order.items[idx].priority = normalizePriorityLevel(priority);
    await order.save();

    await emitOrderEvent(
      ctx,
      order.restaurantId,
      "ORDER_ITEM_PRIORITY_CHANGED",
      {
        order,
        meta: {
          itemId: order.items[idx]?._id,
          itemName: order.items[idx]?.name,
          priority: order.items[idx]?.priority,
        },
      },
    );

    return { order: order.toJSON() };
  },

  /** =========================================
   * UPDATE ORDER CUSTOMER BY CODE
   * ========================================= */
  async updateOrderCustomerByCode(_, { input }) {
    const { restaurantId, orderCode, userId, customer } = input || {};
    const rid = toId(restaurantId);
    if (!rid) throw new Error("Invalid restaurantId");
    if (!orderCode) throw new Error("orderCode is required");
    if (!customer) throw new Error("customer is required");

    const finalUserId = await ensureUserForOrder(userId, customer, { restaurantId: rid });

    const res = await Order.updateMany(
      {
        restaurantId: rid,
        orderCode: String(orderCode),
        currentStatus: { $nin: ["completed", "cancelled"] },
      },
      { $set: { userId: finalUserId ? toId(finalUserId) : undefined } },
    );

    const one = await Order.findOne({
      restaurantId: rid,
      orderCode: String(orderCode),
      currentStatus: { $nin: ["completed", "cancelled"] },
    })
      .select({ tableId: 1, tableCode: 1 })
      .lean();

    await upsertTableCustomerFromOrder({
      restaurantId,
      tableId: one?.tableId,
      tableCode: one?.tableCode,
      customer,
      session: null,
    });

    return { success: true, modifiedCount: res.modifiedCount };
  },

  /** =========================================
   * CANCEL ORDER
   * - cancel reservation + save in one transaction
   * ========================================= */
  async cancelOrder(_, { restaurantId, orderId, reason, warehouseId }, ctx) {
    const rid = toId(restaurantId);
    const oid = toId(orderId);
    if (!rid || !oid) throw new Error("Missing/invalid fields");
    await requireRestaurantPermission(ctx, rid, PERMISSIONS.ORDER_CANCEL);

    const session = await mongoose.startSession();

    let order = null;
    let prevStatus = null;

    try {
      await session.withTransaction(async () => {
        order = await Order.findOne({ _id: oid, restaurantId: rid }).session(
          session,
        );
        if (!order) throw new Error("Order not found");

        prevStatus = order.currentStatus;

        const lines = buildInventoryLinesFromItems(order.items);

        if (RESERVABLE_STATUSES.includes(prevStatus) && lines.length) {
          const whId = await resolveWarehouseIdOrDefault(
            restaurantId,
            warehouseId,
            session,
          );

          await cancelReservationForOrderTx({
            restaurantId: rid,
            warehouseId: whId,
            orderCode: order.orderCode,
            lines,
            session,
          });
        }

        const prevPublicStatus = order.publicStatus;
        order.currentStatus = "cancelled";
        order.statusTimeline.push({
          status: "cancelled",
          at: new Date(),
          note: reason || "Cancelled",
          byUserId: ctx?.user?.id ? toId(ctx.user.id) : undefined,
        });

        updatePublicStatusHistory(order, "STAFF");
        await order.save({ session });
        order.$locals = order.$locals || {};
        order.$locals.prevPublicStatus = prevPublicStatus;
      });
    } finally {
      await session.endSession();
    }

    if (order?.orderType === "delivery") {
      await createOrderTrackingEvent({
        order,
        restaurantId,
        eventType: "status_changed",
        ctx,
        payload: {
          statusFrom: prevStatus,
          statusTo: "cancelled",
          note: reason || "Cancelled",
        },
      });
    }
    emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc: order, previousPublicStatus: order?.$locals?.prevPublicStatus || null });

    await emitOrderEvent(ctx, restaurantId, "ORDER_CANCELLED", order);

    if (order?.tableCode) {
      await markTableStatus(restaurantId, order.tableCode, "available");
    }

    return { success: true, order: order.toJSON() };
  },
};

export default { OrderMutation };


export const __customerRemoteCheckoutTestables = {
  assertCustomerRemoteCheckoutAuth,
  assertCartHoldCheckoutAllowed,
  removeCheckedOutCartItemsTx,
  computeCartTotalAmount,
};
