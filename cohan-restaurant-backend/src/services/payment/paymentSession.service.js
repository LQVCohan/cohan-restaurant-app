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
} from "../../../models/index.js";
import { generateInvoiceNumber } from "../../../utils/generateInvoiceNumber.ts";
import {
  createMomoPayment,
  createVnpayPayment,
  verifyMomoCallback,
  verifyVnpayCallback,
} from "./providers.js";

const SUPPORTED = ["momo", "vnpay", "bank_transfer"];

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

export async function createOrderPayment({ restaurantId, orderIds = [], provider, paymentMethod, baseApiUrl, clientIp, userId }) {
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

  const expectedAmount = orders.reduce((sum, order) => sum + Number(order?.totals?.grandTotal || 0), 0);
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
    requestId: createRef("REQ"),
    reference,
    metadata: {
      orderIds: orders.map((o) => String(o._id)),
      orderCodes: orders.map((o) => o.orderCode).filter(Boolean),
      expectedAmount,
      source: "order_payment",
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
    payment.metadata = {
      ...(payment.metadata || {}),
      bankTransfer: {
        bankName: process.env.BANK_TRANSFER_BANK_NAME || "Vietcombank",
        bankAccountNumber: process.env.BANK_TRANSFER_ACCOUNT_NUMBER || "1234567890",
        accountName: process.env.BANK_TRANSFER_ACCOUNT_NAME || "COHAN RESTAURANT",
        transferContent,
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
  const invoice = await Invoice.create([{ restaurantId: payment.restaurantId, orderIds, number: await generateInvoiceNumber(Invoice, session), issuedAt: now, lines, totals: { ...totals, grandTotal: totals.grandTotal || payment.amount }, paid: payment.amount, status: "PAID", currency: "VND", refTransactionId: trx._id }], { session }).then((x) => x[0]);
  const cashflow = await Cashflow.create([{ restaurantId: payment.restaurantId, type: "INFLOW", amount: payment.amount, currency: "VND", ref: { kind: "Invoice", id: invoice._id, orderIds }, note: "Thanh toán tự động", occurredAt: now }], { session }).then((x) => x[0]);
  await Order.updateMany({ _id: { $in: orderIds } }, { $set: { "payment.method": payment.provider, "payment.provider": payment.provider, "payment.status": "paid", "payment.paidAmount": payment.amount, "payment.paidAt": now, "payment.txnRef": payment.providerTransactionId || payment.reference, currentStatus: "completed" } }, { session });
  payment.metadata = { ...(payment.metadata || {}), settlement: { paymentTransactionId: trx._id, invoiceId: invoice._id, cashflowId: cashflow._id } };
  await payment.save({ session });
  return payment.metadata.settlement;
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
  payment.callbackAt = new Date();
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

  if (Math.round(Number(payment.amount || 0)) !== Math.round(Number(normalizedProvider === "momo" ? payload?.amount : Number(payload?.vnp_Amount || 0) / 100))) {
    payment.callbackStatus = "rejected";
    payment.events.push({ type: "callback_rejected", payload: { reason: "amount_mismatch" } });
    await payment.save();
    throw new Error("Amount mismatch");
  }

  if (payment.status === "success") {
    payment.events.push({ type: "idempotent_skip", payload: { reason: "already_success" } });
    await payment.save();
    return payment.toObject();
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

  return payment.toObject();
}

export async function getPaymentSessionById(paymentId, userId = null) {
  const query = { _id: paymentId };
  if (userId) query.userId = userId;
  const session = await PaymentSession.findOne(query).lean();
  if (!session) throw new Error("Payment session not found");
  return session;
}

export async function listReservationPayments(reservationId, userId) {
  return PaymentSession.find({ reservationId, userId }).sort({ createdAt: -1 }).lean();
}


export async function reconcileBankTransferWebhook({ provider, payload }) {
  const transactionId = String(payload?.transactionId || payload?.id || payload?.txnId || "");
  const amount = Number(payload?.amount || 0);
  const description = String(payload?.description || payload?.content || "");
  const bankAccountNumber = String(payload?.bankAccountNumber || payload?.accountNumber || "");
  const occurredAt = payload?.transactionDate ? new Date(payload.transactionDate) : new Date();

  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const exists = transactionId
        ? await BankTransaction.findOne({ provider, transactionId }).session(session)
        : null;
      if (exists) return { duplicate: true, bankTransaction: exists };
      const bankTx = await BankTransaction.create([{
        provider,
        transactionId,
        amount,
        description,
        transferContent: description,
        bankAccountNumber,
        occurredAt,
        raw: payload,
        matchStatus: "unmatched",
      }], { session }).then((x) => x[0]);

      const normalizedDescription = description.toUpperCase();
      const refs = normalizedDescription.match(/ORD-\d{8}-[A-Z0-9]{6}/g) || [];
      const candidates = await PaymentSession.find({
        status: "pending",
        $or: [{ provider: "bank_transfer" }, { paymentMethod: "bank_transfer" }],
      }).session(session);
      const payment = candidates.find((p) => {
        const ref = String(p.reference || "").toUpperCase();
        const accountOk = !p?.metadata?.bankTransfer?.bankAccountNumber
          || String(p?.metadata?.bankTransfer?.bankAccountNumber) === bankAccountNumber;
        return accountOk && (refs.includes(ref) || normalizedDescription.includes(ref));
      });
      if (!payment) return { matched: false, bankTransaction: bankTx };

      bankTx.matchedPaymentSessionId = payment._id;
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
