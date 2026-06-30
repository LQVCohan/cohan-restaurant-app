import crypto from "node:crypto";
import mongoose from "mongoose";
import {
  Cashflow,
  EventLog,
  Invoice,
  Order,
  PaymentReconciliation,
  PaymentSession,
  PaymentTransaction,
  Reservation,
  Restaurant,
  Table,
  BankTransaction,
  Coupon,
  CouponRedemption,
  Promotion,
  UserCoupon,
  User,
  WalletTransaction,
} from "../../../models/index.js";
import { generateInvoiceNumber } from "../../../utils/generateInvoiceNumber.ts";
import { calculateDiscountBreakdown } from "../discountCalculation.service.js";
import {
  createMomoPayment,
  createVnpayPayment,
  verifyMomoCallback,
  verifyVnpayCallback,
} from "./providers.js";
import { syncKitchenOrderWorkItemsForKitchenEntry } from "../kitchen/kitchenOrderWorkItem.service.js";

const SUPPORTED = ["momo", "vnpay", "bank_transfer"];
const RESERVATION_SUPPORTED = ["momo", "vnpay"];
const EXCLUDED_ITEM_STATUSES = new Set(["cancelled", "returned"]);
const TRANSFER_PAYMENT_TTL_MINUTES_RAW = Number(process.env.PAYMENT_SESSION_TTL_MINUTES || 10);
export const TRANSFER_PAYMENT_TTL_MINUTES = Number.isFinite(TRANSFER_PAYMENT_TTL_MINUTES_RAW) && TRANSFER_PAYMENT_TTL_MINUTES_RAW > 0 ? TRANSFER_PAYMENT_TTL_MINUTES_RAW : 10;
export const TRANSFER_PAYMENT_TTL_MS = TRANSFER_PAYMENT_TTL_MINUTES * 60 * 1000;
export const TRANSFER_HALF_TIME_RATIO = 0.5;
export const TRANSFER_MAX_REJECTED_PROOFS = 3;
const CLOSED_CHILD_PAYMENT_STATUSES = new Set(["paid", "cancelled"]);
function isBankTransferPayment(payment = {}) {
  const provider = String(payment.provider || "").toLowerCase();
  const paymentMethod = String(payment.paymentMethod || "").toLowerCase();
  return ["bank_transfer", "transfer"].includes(provider) || ["bank_transfer", "transfer"].includes(paymentMethod);
}
function buildVietQrUrl({ bankCode, bankAccountNumber, amount, transferContent, accountName }) {
  const code = String(bankCode || "").trim();
  const account = String(bankAccountNumber || "").replace(/\s+/g, "").trim();
  if (!code || !account) return null;
  const url = new URL(`https://img.vietqr.io/image/${encodeURIComponent(code)}-${encodeURIComponent(account)}-compact2.png`);
  if (Number(amount) > 0) url.searchParams.set("amount", String(Math.round(Number(amount))));
  if (transferContent) url.searchParams.set("addInfo", String(transferContent));
  if (accountName) url.searchParams.set("accountName", String(accountName));
  return url.toString();
}
const normalizeBankAccountNumber = (value) => String(value || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
const normalizeDescription = (value) => String(value || "").toUpperCase().replace(/\s+/g, " ").trim();
const normalizeOccurredAt = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const buildBankTransactionFingerprint = ({ provider, transactionId, bankAccountNumber, amount, occurredAt, description }) => {
  const normalizedTxId = normalizeDescription(transactionId);
  return JSON.stringify({
    provider: String(provider || "").toLowerCase(),
    tx: normalizedTxId || null,
    account: normalizeBankAccountNumber(bankAccountNumber),
    amount: Math.round(Number(amount || 0)),
    occurredAt: normalizeOccurredAt(occurredAt),
    description: normalizeDescription(description),
  });
};
export function sanitizePaymentSessionForClient(session, { includeRaw = false } = {}) {
  if (!session) return session;
  const payload = typeof session.toObject === "function" ? session.toObject() : { ...session };
  if (!includeRaw) {
    payload.providerResponseRaw = null;
    payload.callbackRaw = null;
  }
  return payload;
}
function getPaymentSessionTtlMinutes() {
  const raw = Number(process.env.PAYMENT_SESSION_TTL_MINUTES || 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 10;
}
export function buildOrderPaymentFingerprint({ orderIds = [], provider, paymentMethod, amount, pricing, promotionIds = [], discountTotals }) {
  return JSON.stringify({
    orderIds: [...new Set(orderIds.map(String))].sort(),
    provider: String(provider || ""),
    paymentMethod: String(paymentMethod || ""),
    amount: Number(amount || 0),
    pricing: pricing ? {
      voucherCode: String(pricing?.voucherCode || "").trim().toUpperCase(),
      taxRate: Number(pricing?.taxRate || 0),
      serviceRate: Number(pricing?.serviceRate || 0),
      shippingFee: Number(pricing?.shippingFee || 0),
    } : null,
    promotionIds: [...new Set((promotionIds || []).map(String).filter(Boolean))].sort(),
    discountGrandTotal: Number(discountTotals?.grandTotal || 0),
  });
}
export async function expirePendingPaymentSessionIfNeeded(payment, now = new Date()) {
  if (!payment || String(payment.status) !== "pending") return false;
  if (isBankTransferPayment(payment) && ["SUBMITTED", "VERIFYING", "VERIFIED"].includes(String(payment?.transfer?.status || "").toUpperCase())) return false;
  if (!payment.expiresAt || new Date(payment.expiresAt).getTime() > now.getTime()) return false;
  payment.status = "expired";
  payment.cancelledAt = payment.cancelledAt || now;
  payment.cancelReason = payment.cancelReason || "expired_by_ttl";
  payment.events = Array.isArray(payment.events) ? payment.events : [];
  payment.events.push({ type: "payment_expired", payload: { reason: payment.cancelReason } });
  await payment.save();
  return true;
}
export async function cancelPaymentSession({ paymentId, reason, ctx }) {
  const payment = await PaymentSession.findById(paymentId);
  if (!payment) throw new Error("Payment session not found");
  const actorId = ctx?.user?.id;
  if (!actorId || !mongoose.isValidObjectId(actorId)) throw new Error("Unauthorized");
  if (String(payment.userId || "") !== String(actorId)) {
    const { requireRestaurantPermission } = await import("../auth/authorization.service.js");
    const { PERMISSIONS } = await import("../../constants/permissions.js");
    await requireRestaurantPermission(ctx, payment.restaurantId, PERMISSIONS.PAYMENT_WRITE);
  }
  if (String(payment.status || "") !== "pending") throw new Error("Only pending payment session can be cancelled");
  const now = new Date();
  payment.status = "cancelled";
  payment.cancelledAt = now;
  payment.cancelledBy = actorId;
  payment.cancelReason = String(reason || "").trim() || "cancelled_by_user";
  payment.events = Array.isArray(payment.events) ? payment.events : [];
  payment.events.push({ type: "payment_cancelled", payload: { reason: payment.cancelReason, cancelledBy: actorId } });
  await payment.save();
  return payment.toObject();
}

function createRef(prefix = "PAY") {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${ts}-${rnd}`;
}

export function normalizeProvider(provider) {
  const p = String(provider || "").toLowerCase();
  if (!SUPPORTED.includes(p)) throw new Error("Unsupported provider");
  return p;
}

function getRestaurantPaymentSettings(restaurant) {
  const defaults = {
    defaultProvider: "momo",
    providers: [
      { provider: "momo", label: "MoMo", active: true, priority: 1, mode: "sandbox" },
      { provider: "vnpay", label: "VNPAY", active: true, priority: 2, mode: "sandbox" },
    ],
  };
  const current = restaurant?.paymentSettings || {};
  const providers = Array.isArray(current.providers) && current.providers.length
    ? current.providers
    : defaults.providers;

  return {
    defaultProvider: SUPPORTED.includes(current.defaultProvider) ? current.defaultProvider : defaults.defaultProvider,
    providers: providers
      .filter((p) => SUPPORTED.includes(String(p.provider || "").toLowerCase()))
      .map((p, idx) => ({
        provider: String(p.provider).toLowerCase(),
        label: p.label || (String(p.provider).toLowerCase() === "momo" ? "MoMo" : "VNPAY"),
        active: p.active !== false,
        priority: Number.isFinite(Number(p.priority)) ? Number(p.priority) : idx + 1,
        mode: p.mode === "production" ? "production" : "sandbox",
      }))
      .sort((a, b) => a.priority - b.priority),
  };
}

export async function getProviderPublicConfig(restaurantId) {
  const restaurant = await Restaurant.findById(restaurantId).lean();
  if (!restaurant) throw new Error("Restaurant not found");
  const settings = getRestaurantPaymentSettings(restaurant);

  return {
    defaultProvider: settings.defaultProvider,
    providers: settings.providers.map((p) => ({
      provider: p.provider,
      label: p.label,
      active: p.active,
      priority: p.priority,
      mode: p.mode,
    })),
  };
}

export async function createReservationPayment({ reservationId, provider, userId, baseApiUrl, clientIp }) {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) throw new Error("Reservation not found");
  if (!mongoose.isValidObjectId(userId) || String(reservation.userId) !== String(userId)) {
    throw new Error("Unauthorized");
  }
  if (!(Number(reservation.depositAmount || 0) > 0)) {
    throw new Error("Reservation does not require deposit payment");
  }

  const normalizedProvider = normalizeProvider(provider);
  if (!RESERVATION_SUPPORTED.includes(normalizedProvider)) {
    throw new Error("Reservation payment only supports momo/vnpay in this flow.");
  }
  const restaurant = await Restaurant.findById(reservation.restaurantId).lean();
  if (!restaurant) throw new Error("Restaurant not found");
  const paymentSettings = getRestaurantPaymentSettings(restaurant);
  const providerCfg = paymentSettings.providers.find((p) => p.provider === normalizedProvider);
  if (!providerCfg || !providerCfg.active) throw new Error("Provider is inactive");

  const requestId = createRef("REQ");
  const reference = createRef(normalizedProvider.toUpperCase());

  const payment = await PaymentSession.create({
    restaurantId: reservation.restaurantId,
    reservationId: reservation._id,
    userId: reservation.userId,
    provider: normalizedProvider,
    paymentMethod: normalizedProvider,
    amount: Number(reservation.depositAmount || 0),
    currency: "VND",
    status: "pending",
    callbackStatus: "none",
    requestId,
    reference,
    metadata: {
      reservationOrderCode: reservation.orderCode,
      reservationStatusBeforePayment: reservation.status,
    },
    events: [{ type: "payment_created", payload: { provider: normalizedProvider } }],
  });

  await EventLog.log({
    restaurantId: reservation.restaurantId,
    actorUserId: userId,
    verb: "payment.create",
    object: { kind: "PaymentSession", id: payment._id },
    target: { kind: "Reservation", id: reservation._id },
    source: "api",
    status: "success",
    meta: { provider: normalizedProvider, amount: payment.amount, reference },
  }).catch(() => {});

  const ipnUrl = `${baseApiUrl}/api/payments/webhooks/${normalizedProvider}`;
  const returnUrl = `${baseApiUrl}/api/payments/return/${normalizedProvider}`;

  let providerResult;
  if (normalizedProvider === "momo") {
    providerResult = await createMomoPayment({
      payment,
      ipnUrl,
      returnUrl,
      mode: providerCfg.mode,
    });
  } else {
    providerResult = createVnpayPayment({
      payment,
      ipAddr: clientIp,
      returnUrl,
      mode: providerCfg.mode,
    });
  }

  payment.payUrl = providerResult.payUrl;
  payment.qrCodeUrl = providerResult.qrCodeUrl || null;
  payment.deeplink = providerResult.deeplink || null;
  payment.providerResponseRaw = providerResult.raw;
  payment.providerTransactionId = providerResult.providerTransactionId || payment.providerTransactionId;
  payment.events.push({ type: "redirect_generated", payload: { payUrl: providerResult.payUrl } });
  await payment.save();

  return payment.toObject();
}

export async function createOrderPayment({ restaurantId, orderIds = [], provider, paymentMethod, pricing = null, promotionIds = [], baseApiUrl, clientIp, userId }) {
  if (!mongoose.isValidObjectId(restaurantId)) throw new Error("Invalid restaurantId");
  if (!mongoose.isValidObjectId(userId)) throw new Error("Unauthorized");
  if (!Array.isArray(orderIds) || !orderIds.length) throw new Error("Invalid orderIds");
  const normalizedProvider = normalizeProvider(provider);
  const restaurant = await Restaurant.findById(restaurantId).lean();
  if (!restaurant) throw new Error("Restaurant not found");
  const paymentSettings = getRestaurantPaymentSettings(restaurant);
  const providerCfg = paymentSettings.providers.find((p) => p.provider === normalizedProvider);
  if (normalizedProvider !== "bank_transfer" && (!providerCfg || !providerCfg.active)) throw new Error("Provider is inactive");
  const rawIds = [...new Set(orderIds.map(String))];
  if (rawIds.some((id) => !mongoose.isValidObjectId(id))) throw new Error("Invalid orderIds");
  const uniqueOrderIds = rawIds;
  const orders = await Order.find({ _id: { $in: uniqueOrderIds }, restaurantId });
  if (!orders.length || orders.length !== uniqueOrderIds.length) throw new Error("No eligible orders");

  const forbidden = new Set(["cancelled", "completed"]);
  for (const order of orders) {
    const status = String(order?.currentStatus || "").toLowerCase();
    const payStatus = String(order?.payment?.status || "").toLowerCase();
    if (payStatus === "paid") throw new Error("Order already paid");
    if (forbidden.has(status) && payStatus !== "payment_requested") throw new Error("Order is not payable");
  }

  const sortedOrderIds = orders.map((o) => String(o._id)).sort();
  const aggregatedTotals = orders.reduce((acc, order) => ({
    subtotal: acc.subtotal + Number(order?.totals?.subtotal || 0),
    discount: acc.discount + Number(order?.totals?.discount || 0),
    tax: acc.tax + Number(order?.totals?.tax || 0),
    service: acc.service + Number(order?.totals?.service || 0),
    shippingFee: acc.shippingFee + Number(order?.totals?.shippingFee || 0),
    grandTotal: acc.grandTotal + Number(order?.totals?.grandTotal || 0),
  }), { subtotal: 0, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 0 });
  let discountTotals = null;
  const normalizedPromotionIds = Array.isArray(promotionIds) ? promotionIds.map(String).filter(Boolean) : [];
  const appliedDiscount = Boolean(pricing?.voucherCode || normalizedPromotionIds.length > 0);
  if (appliedDiscount) {
    const items = orders.flatMap((order) => (order.items || []).filter((item) => !EXCLUDED_ITEM_STATUSES.has(String(item?.status || "").toLowerCase())));
    discountTotals = await calculateDiscountBreakdown({ restaurantId, items, pricing: { ...pricing }, promotionIds: normalizedPromotionIds, userId, paymentMethod: paymentMethod || normalizedProvider, orderType: orders[0]?.orderType || "dine_in" });
  }
  const expectedAmount = Number(appliedDiscount ? discountTotals?.grandTotal : aggregatedTotals.grandTotal);
  const now = new Date();
  const orderIdsKey = sortedOrderIds.join(":");
  const discountFingerprint = buildOrderPaymentFingerprint({
    orderIds: sortedOrderIds,
    provider: normalizedProvider,
    paymentMethod: paymentMethod || normalizedProvider,
    amount: expectedAmount,
    pricing,
    promotionIds: normalizedPromotionIds,
    discountTotals,
  });
  const existingPendingCandidates = await PaymentSession.find({
    restaurantId,
    provider: normalizedProvider,
    paymentMethod: paymentMethod || normalizedProvider,
    status: "pending",
    "metadata.source": "order_payment",
  }).sort({ createdAt: -1 });
  for (const existingPending of existingPendingCandidates) {
    if (await expirePendingPaymentSessionIfNeeded(existingPending, now)) continue;
    const existingOrderIds = Array.isArray(existingPending?.metadata?.orderIds)
      ? existingPending.metadata.orderIds.map(String).sort()
      : [];
    const orderIdsMatch = existingOrderIds.length === sortedOrderIds.length
      && existingOrderIds.every((id, idx) => id === sortedOrderIds[idx]);
    if (!orderIdsMatch) continue;
    const existingFingerprint = String(existingPending?.metadata?.discountFingerprint || "");
    if (existingFingerprint === discountFingerprint) return existingPending.toObject();
    existingPending.status = "cancelled";
    existingPending.cancelledAt = now;
    existingPending.cancelReason = "superseded_by_new_payment_context";
    existingPending.events = Array.isArray(existingPending.events) ? existingPending.events : [];
    existingPending.events.push({ type: "payment_cancelled", payload: { reason: "superseded_by_new_payment_context" } });
    await existingPending.save();
  }
  const date = new Date();
  const reference = `ORD-${date.toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const payment = await PaymentSession.create({
    restaurantId,
    orderId: orders.length === 1 ? orders[0]._id : null,
    userId,
    provider: normalizedProvider,
    paymentMethod: paymentMethod || normalizedProvider,
    amount: expectedAmount,
    currency: "VND",
    status: "pending",
    callbackStatus: "none",
    expiresAt: new Date(now.getTime() + getPaymentSessionTtlMinutes() * 60 * 1000),
    requestId: createRef("REQ"),
    reference,
    metadata: {
      orderIds: orders.map((o) => String(o._id)),
      orderIdsKey,
      orderCodes: orders.map((o) => o.orderCode).filter(Boolean),
      expectedAmount,
      source: "order_payment",
      discountFingerprint,
      appliedDiscount,
      discountTotals,
      promotionIds: normalizedPromotionIds,
      pricing: pricing || null,
      customerName: orders.find((o) => o?.shipping?.fullName)?.shipping?.fullName || orders.find((o) => o?.customerInfo?.name)?.customerInfo?.name || null,
      customerPhone: orders.find((o) => o?.shipping?.phone)?.shipping?.phone || orders.find((o) => o?.customerInfo?.phone)?.customerInfo?.phone || null,
    },
  });

  if (["momo", "vnpay"].includes(normalizedProvider)) {
    const ipnUrl = `${baseApiUrl}/api/payments/webhooks/${normalizedProvider}`;
    const returnUrl = `${baseApiUrl}/api/payments/return/${normalizedProvider}`;
    const providerResult = normalizedProvider === "momo"
      ? await createMomoPayment({ payment, ipnUrl, returnUrl, mode: providerCfg?.mode || "sandbox" })
      : createVnpayPayment({ payment, ipAddr: clientIp, returnUrl, mode: providerCfg?.mode || "sandbox" });
    payment.payUrl = providerResult.payUrl;
    payment.qrCodeUrl = providerResult.qrCodeUrl || null;
    payment.deeplink = providerResult.deeplink || null;
    payment.providerResponseRaw = providerResult.raw;
  } else {
    const transferContent = `TT ${reference}`;
    payment.transfer = {
      ...(payment.transfer || {}),
      status: "INSTRUCTIONS_SHOWN",
      instructionsShownAt: now,
      rejectedCount: 0,
      maxRejectedCount: TRANSFER_MAX_REJECTED_PROOFS,
      proofCycleStartedAt: now,
    };
    payment.metadata = {
      ...(payment.metadata || {}),
      bankTransfer: {
        bankName: process.env.BANK_TRANSFER_BANK_NAME || "Vietcombank",
        bankAccountNumber: process.env.BANK_TRANSFER_ACCOUNT_NUMBER || "1234567890",
        accountName: process.env.BANK_TRANSFER_ACCOUNT_NAME || "COHAN RESTAURANT",
        bankCode: process.env.BANK_TRANSFER_BANK_CODE || "VCB",
        transferContent,
        expectedAmount,
        qrImageUrl: buildVietQrUrl({
          bankCode: process.env.BANK_TRANSFER_BANK_CODE || "VCB",
          bankAccountNumber: process.env.BANK_TRANSFER_ACCOUNT_NUMBER || "1234567890",
          amount: expectedAmount,
          transferContent,
          accountName: process.env.BANK_TRANSFER_ACCOUNT_NAME || "COHAN RESTAURANT",
        }),
      },
    };
  }
  await payment.save();
  return payment.toObject();
}

export async function settlePaidOrderPaymentSession({ payment, source = "callback", session = null }) {
  const orderIds = Array.isArray(payment?.metadata?.orderIds) && payment.metadata.orderIds.length
    ? payment.metadata.orderIds
    : payment.orderId ? [String(payment.orderId)] : [];
  if (!orderIds.length) return null;
  if (payment?.metadata?.settlement?.invoiceId) return payment.metadata.settlement;
  const orders = await Order.find({ _id: { $in: orderIds }, restaurantId: payment.restaurantId }).session(session);
  if (!orders.length) return null;
  const now = new Date();
  const existingTrx = await PaymentTransaction.findOne({ restaurantId: payment.restaurantId, txnRef: payment.providerTransactionId || payment.reference }).session(session);
  const existingInvoice = await Invoice.findOne({ restaurantId: payment.restaurantId, refTransactionId: existingTrx?._id }).session(session);
  if (existingTrx && existingInvoice) {
    payment.metadata = { ...(payment.metadata || {}), settlement: { paymentTransactionId: existingTrx._id, invoiceId: existingInvoice._id } };
    await payment.save({ session });
    return payment.metadata.settlement;
  }
  const lines = [];
  const totals = { subtotal: 0, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 0 };
  for (const order of orders) {
    totals.subtotal += Number(order?.totals?.subtotal || 0);
    totals.discount += Number(order?.totals?.discount || 0);
    totals.tax += Number(order?.totals?.tax || 0);
    totals.service += Number(order?.totals?.service || 0);
    totals.shippingFee += Number(order?.totals?.shippingFee || 0);
    totals.grandTotal += Number(order?.totals?.grandTotal || 0);
    for (const item of order.items || []) {
      const st = String(item?.status || "").toLowerCase();
      if (["cancelled", "returned"].includes(st)) continue;
      lines.push({ dishId: String(item?.dishId || ""), menuId: String(item?.menuId || ""), categoryId: String(item?.categoryId || ""), name: item?.name, unit: item?.unit, price: Number(item?.unitPrice ?? item?.price ?? item?.basePrice ?? 0), modifiersPrice: Number(item?.modifiersPrice || 0), quantity: Number(item?.quantity || 0), totals: Number(item?.lineSubtotal || 0), modifiers: item?.modifiers || [] });
    }
  }
  const trx = await PaymentTransaction.create([{ restaurantId: payment.restaurantId, orderIds, paidAmount: payment.amount, method: payment.provider, status: "SUCCESS", paidAt: now, note: `Auto settlement from ${source}`, txnRef: payment.providerTransactionId || payment.reference, externalRef: payment.reference }], { session }).then((x) => x[0]);
  const isDiscounted = Boolean(payment?.metadata?.appliedDiscount && payment?.metadata?.discountTotals);
  const discountTotals = isDiscounted ? payment.metadata.discountTotals : null;
  const authoritativeTotals = isDiscounted
    ? {
      subtotal: Number(discountTotals?.subtotal || 0),
      discount: Number(discountTotals?.totalDiscount ?? discountTotals?.discount ?? 0),
      discountReason: discountTotals?.discountReason || null,
      voucherCode: discountTotals?.voucherCode || null,
      promotionId: discountTotals?.appliedPromotions?.[0] || null,
      tax: Number(discountTotals?.tax || 0),
      service: Number(discountTotals?.service || 0),
      shippingFee: Number(discountTotals?.shippingFee || 0),
      grandTotal: Number(discountTotals?.grandTotal || 0),
    }
    : { ...totals, grandTotal: totals.grandTotal || payment.amount };
  const invoiceMeta = isDiscounted ? { discountApplied: true, ...(discountTotals || {}), requestedPromotionIds: payment?.metadata?.promotionIds || [] } : undefined;
  const invoiceStatus = Number(payment.amount || 0) >= Number(authoritativeTotals.grandTotal || 0) ? "PAID" : "PARTIAL";
  const invoice = await Invoice.create([{ restaurantId: payment.restaurantId, orderIds, number: await generateInvoiceNumber(Invoice, session), issuedAt: now, lines, totals: authoritativeTotals, paid: payment.amount, status: invoiceStatus, currency: "VND", refTransactionId: trx._id, meta: invoiceMeta }], { session }).then((x) => x[0]);
  const cashflow = await Cashflow.create([{ restaurantId: payment.restaurantId, type: "INFLOW", amount: payment.amount, currency: "VND", ref: { kind: "Invoice", id: invoice._id, orderIds }, note: "Thanh toán tự động", occurredAt: now }], { session }).then((x) => x[0]);
  const releaseOrderIds = [];
  for (const order of orders) {
    const previousStatus = String(order?.currentStatus || "").toLowerCase();
    const alreadyPaid = String(order?.payment?.status || "").toLowerCase() === "paid";
    order.payment = {
      ...(order.payment || {}),
      method: payment.provider,
      provider: payment.provider,
      status: "paid",
      paidAmount: payment.amount,
      paidAt: now,
      txnRef: payment.providerTransactionId || payment.reference,
    };
    if (["draft", "failed"].includes(previousStatus) || isBankTransferPayment(payment)) {
      order.currentStatus = "pending";
      order.customerVisibleNote = "Nhà hàng đã nhận đơn và đang xử lý.";
      const lastTimelineStatus = Array.isArray(order.statusTimeline) && order.statusTimeline.length
        ? String(order.statusTimeline[order.statusTimeline.length - 1]?.status || "").toLowerCase()
        : "";
      if (lastTimelineStatus !== "pending") {
        order.statusTimeline = Array.isArray(order.statusTimeline) ? order.statusTimeline : [];
        order.statusTimeline.push({
          status: "pending",
          at: now,
          byUserId: payment.userId || undefined,
          note: `Payment verified via ${source}; order released to restaurant.`,
        });
      }
      if (!alreadyPaid && previousStatus === "draft") releaseOrderIds.push(String(order._id));
    }
    await order.save({ session });
    if (!alreadyPaid && previousStatus === "draft") {
      await syncKitchenOrderWorkItemsForKitchenEntry({
        order,
        actorUserId: payment.userId || null,
        now,
        session,
      });
    }
  }
  if (payment?.metadata?.appliedDiscount && payment?.metadata?.discountTotals?.couponId) {
    const rawCouponId = String(payment.metadata.discountTotals.couponId || "");
    if (!mongoose.isValidObjectId(rawCouponId)) throw new Error("Invalid couponId in payment discount metadata");
    const couponId = new mongoose.Types.ObjectId(rawCouponId);
    const exists = await CouponRedemption.findOne({ invoiceId: invoice._id, couponId }).session(session);
    if (!exists) {
      const coupon = await Coupon.findById(couponId).session(session);
      const perUserLimit = Number(coupon?.constraints?.perUserLimit || 0);
      if (mongoose.isValidObjectId(payment.userId) && perUserLimit > 0) {
        const userRedemptionCount = await CouponRedemption.countDocuments({ couponId, userId: payment.userId }).session(session);
        if (userRedemptionCount >= perUserLimit) throw new Error("Invalid coupon: per-user usage limit reached");
      }
      const updateResult = await Coupon.updateOne({
        _id: couponId,
        $expr: { $or: [{ $lte: ["$maxUsage", 0] }, { $lt: ["$used", "$maxUsage"] }] },
      }, { $inc: { used: 1 } }, { session });
      if (!updateResult.modifiedCount) throw new Error("Invalid coupon: usage limit reached");
      await CouponRedemption.create([{ couponId, userId: payment.userId, restaurantId: payment.restaurantId, orderIds, invoiceId: invoice._id, couponCode: String(payment?.metadata?.discountTotals?.voucherCode || ""), discountAmount: Number(payment?.metadata?.discountTotals?.voucherDiscount || 0), subtotal: Number(payment?.metadata?.discountTotals?.subtotal || 0), grandTotal: Number(payment?.metadata?.discountTotals?.grandTotal || 0), source: "online", redeemedAt: now }], { session });
      await UserCoupon.updateMany({ userId: payment.userId, couponId, status: "saved" }, { $set: { status: "used", usedAt: now, invoiceId: invoice._id } }, { session });
    }
  }
  for (const promotionId of (payment?.metadata?.discountTotals?.appliedPromotions || [])) {
    if (mongoose.isValidObjectId(promotionId)) await Promotion.updateOne({ _id: promotionId }, { $inc: { usageCount: 1 } }, { session });
  }
  const parentSessionId = String(orders.find((o) => o?.parentOrderId)?.parentOrderId || orders.find((o) => o?.rootOrderId)?.rootOrderId || "");
  if (mongoose.isValidObjectId(parentSessionId)) {
    const childOrders = await Order.find({ restaurantId: payment.restaurantId, $or: [{ parentOrderId: parentSessionId }, { rootOrderId: parentSessionId }] }).session(session);
    const allSettled = childOrders.every((order) => CLOSED_CHILD_PAYMENT_STATUSES.has(String(order?.payment?.status || "").toLowerCase()) || ["completed", "cancelled"].includes(String(order?.currentStatus || "").toLowerCase()));
    if (allSettled) {
      const parent = await Order.findById(parentSessionId).session(session);
      if (parent) {
        parent.sessionStatus = "CLOSED";
        parent.orderPaymentStatus = "PAID";
        parent.activeSessionKey = null;
        parent.closedAt = now;
        parent.currentStatus = "completed";
        parent.payment = { ...(parent.payment || {}), status: "paid" };
        await parent.save({ session });
        if (parent.tableId) await Table.updateOne({ _id: parent.tableId }, { $set: { status: "available" } }, { session });
      }
    }
  }
  payment.metadata = {
    ...(payment.metadata || {}),
    settlement: { paymentTransactionId: trx._id, invoiceId: invoice._id, cashflowId: cashflow._id },
    release: releaseOrderIds.length
      ? { releasedAt: now, releasedBy: source, orderIds: releaseOrderIds }
      : payment?.metadata?.release,
  };
  await payment.save({ session });
  return payment.metadata.settlement;
}

async function creditWalletTopupPayment({ payment, provider, session }) {
  if (payment?.metadata?.walletTopup?.walletTransactionId) {
    payment.events.push({ type: "idempotent_skip", payload: { reason: "wallet_topup_already_credited" } });
    await payment.save({ session });
    return payment.metadata.walletTopup;
  }

  const claim = await PaymentSession.findOneAndUpdate(
    {
      _id: payment._id,
      "metadata.source": "wallet_topup",
      "metadata.walletTopup.walletTransactionId": { $exists: false },
      "metadata.walletTopup.creditingAt": { $exists: false },
    },
    {
      $set: { "metadata.walletTopup.creditingAt": new Date() },
      $push: { events: { type: "wallet_topup_credit_claimed", payload: { provider }, at: new Date() } },
    },
    { new: true, session },
  );

  if (!claim) {
    const latest = await PaymentSession.findById(payment._id).session(session);
    if (latest?.metadata?.walletTopup?.walletTransactionId) {
      latest.events.push({ type: "idempotent_skip", payload: { reason: "wallet_topup_already_credited" } });
      await latest.save({ session });
      payment.metadata = latest.metadata;
      return latest.metadata.walletTopup;
    }
    throw new Error("Wallet topup settlement is already in progress");
  }

  const user = await User.findById(claim.userId).session(session);
  if (!user) throw new Error("Wallet topup user not found");
  user.wallet = user.wallet || {};
  const balanceBefore = Math.round(Number(user.wallet.balance || 0));
  const balanceAfter = balanceBefore + Math.round(Number(claim.amount || 0));
  user.wallet.balance = balanceAfter;
  user.wallet.currency = user.wallet.currency || claim.currency || "VND";
  user.wallet.provider = user.wallet.provider || "cohan_wallet";
  user.wallet.status = user.wallet.status || "active";
  user.wallet.updatedAt = new Date();
  await user.save({ session });
  const [walletTransaction] = await WalletTransaction.create([{
    userId: claim.userId,
    type: "TOPUP",
    amount: Math.round(Number(claim.amount || 0)),
    currency: user.wallet.currency,
    balanceBefore,
    balanceAfter,
    status: "SUCCESS",
    referenceType: "PAYMENT_SESSION",
    referenceId: claim._id,
    metadata: { provider, reference: claim.reference, providerTransactionId: claim.providerTransactionId, source: "wallet_topup" },
  }], { session });
  claim.metadata = {
    ...(claim.metadata || {}),
    walletTopup: { ...((claim.metadata || {}).walletTopup || {}), walletTransactionId: walletTransaction._id, creditedAt: new Date() },
    settlement: { ...((claim.metadata || {}).settlement || {}), walletTransactionId: walletTransaction._id },
  };
  claim.events.push({ type: "wallet_topup_credited", payload: { walletTransactionId: String(walletTransaction._id) } });
  await claim.save({ session });
  payment.metadata = claim.metadata;
  await EventLog.log({ actorUserId: claim.userId, verb: "wallet.topup", object: { kind: "WalletTransaction", id: walletTransaction._id }, source: "api", status: "success", meta: { provider, paymentSessionId: String(claim._id), amount: claim.amount } }, { session }).catch(() => {});
  return claim.metadata.walletTopup;
}

function mapProviderStatus(provider, payload) {
  if (provider === "momo") {
    return Number(payload?.resultCode) === 0 ? "success" : "failed";
  }
  const code = String(payload?.vnp_ResponseCode || "");
  if (code === "00") return "success";
  if (["24", "51"].includes(code)) return "cancelled";
  return "failed";
}

export async function applyPaymentProviderCallback({ provider, payload, source = "webhook" }) {
  const normalizedProvider = normalizeProvider(provider);
  const reference = normalizedProvider === "momo" ? payload?.orderId : payload?.vnp_TxnRef;
  if (!reference) throw new Error("Missing reference/order id");

  const payment = await PaymentSession.findOne({ provider: normalizedProvider, reference });
  if (!payment) throw new Error("Payment session not found");

  const signatureValid = normalizedProvider === "momo"
    ? verifyMomoCallback(payload)
    : verifyVnpayCallback(payload);

  payment.callbackRaw = payload;
  const now = new Date();
  payment.callbackAt = now;
  payment.callbackStatus = signatureValid ? "verified" : "rejected";
  payment.events.push({ type: "callback_received", payload: { source, signatureValid } });

  if (!signatureValid) {
    await payment.save();
    await EventLog.log({
      restaurantId: payment.restaurantId,
      actorUserId: payment.userId,
      verb: "payment.capture",
      object: { kind: "PaymentSession", id: payment._id },
      target: payment.reservationId ? { kind: "Reservation", id: payment.reservationId } : undefined,
      source: "api",
      status: "failed",
      meta: { reason: "INVALID_SIGNATURE", provider: normalizedProvider },
    }).catch(() => {});
    return payment.toObject();
  }
  if (["cancelled", "expired"].includes(String(payment.status || "").toLowerCase())) {
    payment.events.push({ type: "callback_ignored", payload: { reason: `status_${String(payment.status || "").toLowerCase()}` } });
    await payment.save();
    return payment.toObject();
  }
  if (String(payment.status || "").toLowerCase() === "pending" && payment.expiresAt && new Date(payment.expiresAt).getTime() <= now.getTime()) {
    payment.status = "expired";
    payment.cancelledAt = payment.cancelledAt || now;
    payment.cancelReason = payment.cancelReason || "expired_by_ttl";
    payment.events.push({ type: "payment_expired", payload: { reason: payment.cancelReason } });
    payment.events.push({ type: "callback_ignored", payload: { reason: "expired_by_ttl" } });
    await payment.save();
    return payment.toObject();
  }

  if (Math.round(Number(payment.amount || 0)) !== Math.round(Number(normalizedProvider === "momo" ? payload?.amount : Number(payload?.vnp_Amount || 0) / 100))) {
    payment.callbackStatus = "rejected";
    payment.events.push({ type: "callback_rejected", payload: { reason: "amount_mismatch" } });
    await payment.save();
    throw new Error("Amount mismatch");
  }

  if (payment.status === "success") {
    if (payment?.metadata?.source === "wallet_topup" && !payment?.metadata?.walletTopup?.walletTransactionId) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await creditWalletTopupPayment({ payment, provider: normalizedProvider, session });
        });
      } finally {
        await session.endSession();
      }
    } else {
      payment.events.push({ type: "idempotent_skip", payload: { reason: "already_success" } });
      await payment.save();
    }
    const out = (await PaymentSession.findById(payment._id).lean()) || payment.toObject();
    out.realtimeEmitSkipped = true;
    return out;
  }

  payment.status = mapProviderStatus(normalizedProvider, payload);
  payment.providerTransactionId =
    (normalizedProvider === "momo" ? payload?.transId : payload?.vnp_TransactionNo) || payment.providerTransactionId;
  payment.reconciledAt = new Date();
  payment.events.push({ type: `payment_${payment.status}`, payload: { source } });

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await payment.save({ session });

      if (payment.reservationId) {
        const reservation = await Reservation.findById(payment.reservationId).session(session);
        if (!reservation) throw new Error("Reservation not found for payment");

        if (payment.status === "success") {
          if (!reservation.depositTxnId) {
            const trx = await PaymentTransaction.create([
              {
                restaurantId: reservation.restaurantId,
                orderIds: [],
                paidAmount: reservation.depositAmount,
                method: normalizedProvider,
                status: "SUCCESS",
                paidAt: new Date(),
                note: `Reservation deposit ${reservation.orderCode}`,
                txnRef: payment.providerTransactionId || payment.reference,
                userId: reservation.userId,
              },
            ], { session }).then((x) => x[0]);
            reservation.depositTxnId = trx._id;
          }

          reservation.depositStatus = "paid";
          reservation.status = "confirmed";
          reservation.paymentMethod = normalizedProvider;
          reservation.paymentReference = payment.reference;
          await reservation.save({ session });
          await Table.updateOne({ _id: reservation.tableId }, { $set: { status: "reserved" } }, { session });
        } else if (["failed", "cancelled", "expired"].includes(payment.status)) {
          reservation.depositStatus = payment.status === "cancelled" ? "cancelled" : "failed";
          reservation.status = "cancelled";
          reservation.paymentMethod = normalizedProvider;
          reservation.paymentReference = payment.reference;
          await reservation.save({ session });
          await Table.updateOne({ _id: reservation.tableId }, { $set: { status: "available" } }, { session });
        }
      }

      if (payment.status === "success" && payment?.metadata?.source === "wallet_topup") {
        await creditWalletTopupPayment({ payment, provider: normalizedProvider, session });
      }

      if (payment.status === "success" && (payment.orderId || payment?.metadata?.orderIds?.length)) {
        await settlePaidOrderPaymentSession({ payment, source, session });
      }

      await EventLog.log({
        restaurantId: payment.restaurantId,
        actorUserId: payment.userId,
        verb: "payment.capture",
        object: { kind: "PaymentSession", id: payment._id },
        target: payment.reservationId
          ? { kind: "Reservation", id: payment.reservationId }
          : payment.orderId
          ? { kind: "Order", id: payment.orderId }
          : undefined,
        source: "api",
        status: payment.status === "success" ? "success" : "failed",
        meta: {
          provider: normalizedProvider,
          paymentStatus: payment.status,
          callbackStatus: payment.callbackStatus,
          providerTransactionId: payment.providerTransactionId,
        },
      }, { session });
    });
  } finally {
    await session.endSession();
  }

  return (await PaymentSession.findById(payment._id).lean()) || payment.toObject();
}

export async function getPaymentSessionById(paymentId, userId = null) {
  const query = { _id: paymentId };
  if (userId) query.userId = userId;
  const paymentSession = await PaymentSession.findOne(query);
  if (!paymentSession) throw new Error("Payment session not found");
  await expirePendingPaymentSessionIfNeeded(paymentSession, new Date());
  return paymentSession.toObject();
}

export async function listReservationPayments(reservationId, userId) {
  return PaymentSession.find({ reservationId, userId }).sort({ createdAt: -1 }).lean();
}


export async function reconcileBankTransferWebhook({ provider, payload }) {
  const transactionId = String(payload?.transactionId || payload?.id || payload?.txnId || "");
  const amount = Number(payload?.amount || 0);
  const description = String(payload?.description || payload?.content || "");
  const normalizedDescription = normalizeDescription(description);
  const bankAccountNumber = String(payload?.bankAccountNumber || payload?.accountNumber || "");
  const normalizedBankAccountNumber = normalizeBankAccountNumber(bankAccountNumber);
  const payloadRestaurantId = (
    payload?.restaurantId && mongoose.isValidObjectId(payload.restaurantId)
      ? new mongoose.Types.ObjectId(payload.restaurantId)
      : null
  );
  const occurredAt = payload?.transactionDate ? new Date(payload.transactionDate) : new Date();
  const fingerprintOccurredAt = payload?.transactionDate || payload?.occurredAt || null;
  const requiresBankAccount = process.env.NODE_ENV === "production" || Boolean(process.env.BANK_TRANSFER_ACCOUNT_NUMBER);
  if (!Number.isFinite(amount) || amount <= 0) return { matched: false, reason: "invalid_amount", ignored: true };
  if (!normalizedDescription) return { matched: false, reason: "missing_description", ignored: true };
  if (requiresBankAccount && !normalizedBankAccountNumber) return { matched: false, reason: "missing_bank_account", ignored: true };
  const bankTxFingerprint = buildBankTransactionFingerprint({
    provider,
    transactionId,
    bankAccountNumber: normalizedBankAccountNumber,
    amount,
    occurredAt: fingerprintOccurredAt,
    description: normalizedDescription,
  });

  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const existingByTxnId = transactionId
        ? await BankTransaction.findOne({ provider, transactionId }).session(session)
        : null;
      const existingByFingerprint = await BankTransaction.findOne({ provider, fingerprint: bankTxFingerprint }).session(session);
      const existing = existingByTxnId || existingByFingerprint;
      if (existing) return { duplicate: true, bankTransaction: existing };
      let bankTx;
      try {
        bankTx = await BankTransaction.create([{
          provider,
          restaurantId: payloadRestaurantId || null,
          transactionId,
          amount,
          description: normalizedDescription,
          transferContent: normalizedDescription,
          bankAccountNumber: normalizedBankAccountNumber,
          occurredAt,
          fingerprint: bankTxFingerprint,
          raw: payload,
          matchStatus: "unmatched",
        }], { session }).then((x) => x[0]);
      } catch (err) {
        if (err?.code !== 11000) throw err;
        const duplicate = (transactionId
          ? await BankTransaction.findOne({ provider, transactionId }).session(session)
          : null) || await BankTransaction.findOne({ provider, fingerprint: bankTxFingerprint }).session(session);
        if (duplicate) return { duplicate: true, bankTransaction: duplicate };
        throw err;
      }

      const now = new Date();
      const refs = normalizedDescription.match(/ORD-\d{8}-[A-Z0-9]{6}/g) || [];
      const candidates = await PaymentSession.find({
        status: "pending",
        $or: [{ provider: "bank_transfer" }, { paymentMethod: "bank_transfer" }],
      }).session(session);
      let payment = null;
      for (const candidate of candidates) {
        if (await expirePendingPaymentSessionIfNeeded(candidate, now)) continue;
        const ref = String(candidate.reference || "").toUpperCase();
        const candidateAccount = normalizeBankAccountNumber(candidate?.metadata?.bankTransfer?.bankAccountNumber);
        const accountOk = Boolean(candidateAccount) && candidateAccount === normalizedBankAccountNumber;
        if (accountOk && (refs.includes(ref) || normalizedDescription.includes(ref))) {
          payment = candidate;
          break;
        }
      }
      if (!payment) {
        const hasReference = refs.length > 0;
        await PaymentReconciliation.create([{ restaurantId: payloadRestaurantId, provider, status: "unmatched", receivedAmount: amount, bankTransactionId: bankTx._id, raw: payload, note: hasReference ? "Bank account mismatch" : "No pending payment session matched" }], { session });
        return { matched: false, bankTransaction: bankTx };
      }

      bankTx.matchedPaymentSessionId = payment._id;
      bankTx.restaurantId = payment.restaurantId || bankTx.restaurantId || null;
      if (Math.round(amount) !== Math.round(Number(payment.amount || 0))) {
        bankTx.matchStatus = "amount_mismatch";
        await bankTx.save({ session });
        payment.callbackStatus = "rejected";
        await payment.save({ session });
        await PaymentReconciliation.create([{
          restaurantId: payment.restaurantId,
          paymentSessionId: payment._id,
          provider,
          expectedAmount: payment.amount,
          receivedAmount: amount,
          varianceAmount: amount - payment.amount,
          status: "amount_mismatch",
          bankTransactionId: bankTx._id,
          paymentReference: payment.reference,
          matchedBy: "webhook",
          matchedAt: new Date(),
          raw: payload,
          note: "Amount mismatch",
        }], { session });
        return { matched: false, reason: "amount_mismatch", bankTransaction: bankTx };
      }

      bankTx.matchStatus = "matched";
      await bankTx.save({ session });
      payment.status = "success";
      payment.callbackStatus = "verified";
      payment.providerTransactionId = transactionId || payment.providerTransactionId;
      payment.reconciledAt = new Date();
      payment.callbackRaw = payload;
      payment.transfer = payment.transfer || {};
      payment.transfer.status = "VERIFIED";
      payment.transfer.verifiedAt = new Date();
      payment.transfer.providerTransactionId = transactionId || payment.providerTransactionId;
      payment.transfer.receivedAmount = amount;
      payment.transfer.varianceAmount = 0;
      payment.transfer.rejectReason = undefined;
      payment.transfer.rejectedAt = undefined;
      if (Array.isArray(payment.events)) {
        payment.events.push({
          type: "transfer_verified",
          payload: { by: "bank_webhook", provider, transactionId },
        });
      }
      await payment.save({ session });

      await PaymentReconciliation.create([{
        restaurantId: payment.restaurantId,
        paymentSessionId: payment._id,
        provider,
        expectedAmount: payment.amount,
        receivedAmount: amount,
        varianceAmount: 0,
        status: "matched",
        bankTransactionId: bankTx._id,
        paymentReference: payment.reference,
        matchedBy: "webhook",
        matchedAt: new Date(),
        raw: payload,
      }], { session });
      await settlePaidOrderPaymentSession({ payment, source: "bank_webhook", session });
      return { matched: true, payment, bankTransaction: bankTx };
    });
  } finally {
    await session.endSession();
  }
}
