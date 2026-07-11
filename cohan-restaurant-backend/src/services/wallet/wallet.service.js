import crypto from "node:crypto";
import mongoose from "mongoose";
import {
  Cashflow,
  EventLog,
  Invoice,
  Order,
  PaymentRefund,
  PaymentSession,
  PaymentTransaction,
  User,
  WalletTransaction,
} from "../../../models/index.js";
import { settlePaidOrderPaymentSession } from "../payment/paymentSession.service.js";
import { createMomoPayment, createVnpayPayment } from "../payment/providers.js";

const DEFAULT_CURRENCY = "VND";
const WALLET_PROVIDER = "cohan_wallet";
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const ACTIVE_REFUND_STATUSES = [
  "pending",
  "approved",
  "processing",
  "failed",
  "success",
];

const toObjectId = (value) => {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const roundMoney = (value) => Math.round(Number(value || 0));
const createReference = (prefix = "WL") =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;

export function requireWalletUser(ctx) {
  const userId = ctx?.user?.id || ctx?.user?._id;
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw new Error("Unauthorized");
  }
  return String(userId);
}

function normalizeAmount(amount) {
  const value = roundMoney(amount);
  if (value <= 0) throw new Error("Invalid wallet amount");
  return value;
}

function normalizeWallet(wallet = {}) {
  return {
    provider: wallet?.provider || WALLET_PROVIDER,
    status: wallet?.status || "active",
    balance: roundMoney(wallet?.balance),
    currency: wallet?.currency || DEFAULT_CURRENCY,
    createdAt: wallet?.createdAt || new Date(),
    updatedAt: wallet?.updatedAt || new Date(),
  };
}

function ensureWalletOnUser(userDoc) {
  userDoc.wallet = normalizeWallet(userDoc.wallet || {});
  if (userDoc.wallet.status !== "active") {
    throw new Error("Wallet is not active");
  }
  return userDoc.wallet;
}

function serializeWallet(wallet = {}) {
  const normalized = normalizeWallet(wallet);
  return {
    provider: normalized.provider,
    status: normalized.status,
    balance: normalized.balance,
    currency: normalized.currency,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
  };
}

function serializeWalletTransaction(transaction) {
  if (!transaction) return null;
  const obj =
    typeof transaction.toObject === "function"
      ? transaction.toObject()
      : transaction;
  return {
    id: String(obj._id || obj.id),
    userId: String(obj.userId),
    type: obj.type,
    amount: Number(obj.amount || 0),
    currency: obj.currency || DEFAULT_CURRENCY,
    balanceBefore: Number(obj.balanceBefore || 0),
    balanceAfter: Number(obj.balanceAfter || 0),
    status: obj.status || "SUCCESS",
    referenceType: obj.referenceType || null,
    referenceId: obj.referenceId ? String(obj.referenceId) : null,
    orderIds: (obj.orderIds || []).map(String),
    metadata: obj.metadata || {},
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

async function createWalletTransactionDoc({
  userId,
  type,
  amount,
  currency = DEFAULT_CURRENCY,
  balanceBefore,
  balanceAfter,
  status = "SUCCESS",
  referenceType,
  referenceId,
  orderIds = [],
  metadata = {},
  session,
}) {
  const [doc] = await WalletTransaction.create(
    [
      {
        userId,
        type,
        amount,
        currency,
        balanceBefore,
        balanceAfter,
        status,
        referenceType,
        referenceId,
        orderIds,
        metadata,
      },
    ],
    { session },
  );
  return doc;
}

export async function getWalletSummary(userId) {
  const uid = toObjectId(userId);
  if (!uid) throw new Error("Unauthorized");
  const user = await User.findById(uid).select({ wallet: 1 }).lean();
  if (!user) throw new Error("User not found");
  const rows = await WalletTransaction.aggregate([
    { $match: { userId: uid, status: "SUCCESS" } },
    {
      $group: {
        _id: "$type",
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);
  const byType = Object.fromEntries(rows.map((row) => [row._id, row]));
  const wallet = serializeWallet(user.wallet || {});
  return {
    wallet,
    balance: wallet.balance,
    currency: wallet.currency,
    status: wallet.status,
    lifetimeTopup: Number(byType.TOPUP?.total || 0),
    lifetimePayment: Number(byType.PAYMENT?.total || 0),
    lifetimeRefund: Number(byType.REFUND?.total || 0),
    lifetimeAdjustment: Number(byType.ADJUSTMENT?.total || 0),
    transactionCount: rows.reduce(
      (sum, row) => sum + Number(row.count || 0),
      0,
    ),
  };
}

export async function listWalletTransactions(userId, filter = {}) {
  const uid = toObjectId(userId);
  if (!uid) throw new Error("Unauthorized");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(filter?.limit || DEFAULT_LIMIT)),
  );
  const query = { userId: uid };
  if (filter?.type) query.type = String(filter.type).toUpperCase();
  if (filter?.status) query.status = String(filter.status).toUpperCase();
  const docs = await WalletTransaction.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit);
  return docs.map(serializeWalletTransaction);
}

export async function creditWallet({
  userId,
  amount,
  type = "TOPUP",
  referenceType,
  referenceId,
  orderIds = [],
  metadata = {},
}) {
  const uid = toObjectId(userId);
  if (!uid) throw new Error("Invalid userId");
  const normalizedAmount = normalizeAmount(amount);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const user = await User.findById(uid).session(session);
      if (!user) throw new Error("User not found");
      const wallet = ensureWalletOnUser(user);
      const balanceBefore = roundMoney(wallet.balance);
      const balanceAfter = balanceBefore + normalizedAmount;
      user.wallet.balance = balanceAfter;
      user.wallet.currency = wallet.currency || DEFAULT_CURRENCY;
      user.wallet.provider = wallet.provider || WALLET_PROVIDER;
      user.wallet.updatedAt = new Date();
      await user.save({ session });
      const transaction = await createWalletTransactionDoc({
        userId: uid,
        type,
        amount: normalizedAmount,
        currency: user.wallet.currency,
        balanceBefore,
        balanceAfter,
        referenceType,
        referenceId: toObjectId(referenceId),
        orderIds: (orderIds || []).map(toObjectId).filter(Boolean),
        metadata,
        session,
      });
      result = {
        wallet: serializeWallet(user.wallet),
        transaction: serializeWalletTransaction(transaction),
      };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export async function createWalletTopup({
  userId,
  amount,
  provider = "momo",
  reference,
  metadata = {},
  baseApiUrl = "http://localhost:5000",
  clientIp = "127.0.0.1",
}) {
  const uid = toObjectId(userId);
  if (!uid) throw new Error("Unauthorized");
  const normalizedAmount = normalizeAmount(amount);
  const normalizedProvider = String(provider || "momo").toLowerCase();
  if (normalizedProvider === "sandbox") {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_SANDBOX_WALLET_TOPUP !== "true"
    ) {
      throw new Error("Sandbox wallet topup is disabled in production");
    }
    const result = await creditWallet({
      userId,
      amount: normalizedAmount,
      type: "TOPUP",
      referenceType: "WALLET_TOPUP",
      metadata: {
        provider: "sandbox",
        reference: reference || createReference("TOPUP"),
        sandbox: true,
        ...metadata,
      },
    });
    return {
      ok: true,
      message: "Nạp ví sandbox thành công.",
      ...result,
    };
  }
  if (!["momo", "vnpay"].includes(normalizedProvider)) {
    throw new Error("Unsupported wallet topup provider");
  }

  const now = new Date();
  const payment = await PaymentSession.create({
    userId: uid,
    provider: normalizedProvider,
    paymentMethod: normalizedProvider,
    amount: normalizedAmount,
    currency: DEFAULT_CURRENCY,
    status: "pending",
    callbackStatus: "none",
    expiresAt: new Date(
      now.getTime() +
        Number(process.env.PAYMENT_SESSION_TTL_MINUTES || 10) * 60 * 1000,
    ),
    requestId: createReference("REQ"),
    reference: reference || createReference(normalizedProvider.toUpperCase()),
    metadata: {
      ...metadata,
      source: "wallet_topup",
      orderInfo:
        metadata?.orderInfo || `Nap vi Cohan ${normalizedAmount}`,
    },
    events: [
      {
        type: "payment_created",
        payload: { provider: normalizedProvider, source: "wallet_topup" },
      },
    ],
  });

  const ipnUrl = `${baseApiUrl}/api/payments/webhooks/${normalizedProvider}`;
  const returnUrl = `${baseApiUrl}/api/payments/return/${normalizedProvider}`;
  const providerResult =
    normalizedProvider === "momo"
      ? await createMomoPayment({
          payment,
          ipnUrl,
          returnUrl,
          mode:
            process.env.NODE_ENV === "production"
              ? "production"
              : "sandbox",
        })
      : createVnpayPayment({
          payment,
          ipAddr: clientIp,
          returnUrl,
          mode:
            process.env.NODE_ENV === "production"
              ? "production"
              : "sandbox",
        });
  payment.payUrl = providerResult.payUrl;
  payment.qrCodeUrl = providerResult.qrCodeUrl || null;
  payment.deeplink = providerResult.deeplink || null;
  payment.providerTransactionId =
    providerResult.providerTransactionId || payment.providerTransactionId;
  payment.providerResponseRaw = providerResult.raw;
  payment.events.push({
    type: "redirect_generated",
    payload: { provider: normalizedProvider },
  });
  await payment.save();
  await EventLog.log({
    actorUserId: uid,
    verb: "payment.create",
    object: { kind: "PaymentSession", id: payment._id },
    source: "api",
    status: "success",
    meta: {
      provider: normalizedProvider,
      amount: normalizedAmount,
      source: "wallet_topup",
    },
  }).catch(() => {});
  return {
    ok: true,
    message: "Đã tạo phiên nạp ví. Vui lòng hoàn tất thanh toán.",
    wallet: (await getWalletSummary(uid)).wallet,
    transaction: null,
    paymentSession: payment.toObject(),
    amount: normalizedAmount,
  };
}

function createWalletSettlementAdapter(payment) {
  const settlementPayment = {
    ...payment.toObject(),
    provider: "e_wallet",
    paymentMethod: "e_wallet",
    metadata: { ...(payment.metadata || {}) },
  };
  settlementPayment.save = async ({ session } = {}) => {
    payment.metadata = settlementPayment.metadata;
    return payment.save(session ? { session } : undefined);
  };
  return settlementPayment;
}

async function findExistingWalletPayment({
  restaurantId,
  userId,
  idempotencyKey,
}) {
  return PaymentTransaction.findOne({
    restaurantId,
    userId,
    method: "e_wallet",
    externalRef: idempotencyKey,
    status: "SUCCESS",
  }).lean();
}

async function buildExistingWalletPaymentResult({
  transaction,
  userId,
  orderIds,
  idempotencyKey,
}) {
  const paymentSession = await PaymentSession.findOne({
    provider: WALLET_PROVIDER,
    reference: idempotencyKey,
  }).lean();
  return {
    ok: true,
    message: "Thanh toán bằng ví đã được xử lý.",
    wallet: (await getWalletSummary(userId)).wallet,
    transaction: null,
    paymentSession,
    paymentTransactionId: String(transaction._id),
    orderIds,
    amount: Number(transaction.paidAmount || 0),
  };
}

export async function payOrdersWithWallet({
  userId,
  restaurantId,
  orderIds = [],
  idempotencyKey,
}) {
  const uid = toObjectId(userId);
  const rid = toObjectId(restaurantId);
  if (!uid) throw new Error("Unauthorized");
  if (!rid) throw new Error("Invalid restaurantId");

  const uniqueOrderIds = [...new Set((orderIds || []).map(String))].sort();
  if (
    !uniqueOrderIds.length ||
    uniqueOrderIds.some((id) => !mongoose.isValidObjectId(id))
  ) {
    throw new Error("Invalid orderIds");
  }
  const safeIdempotencyKey = String(
    idempotencyKey ||
      `${String(uid)}:${String(rid)}:${uniqueOrderIds.join(":")}`,
  ).trim();
  if (!safeIdempotencyKey) throw new Error("Invalid idempotencyKey");

  const existing = await findExistingWalletPayment({
    restaurantId: rid,
    userId: uid,
    idempotencyKey: safeIdempotencyKey,
  });
  if (existing) {
    return buildExistingWalletPaymentResult({
      transaction: existing,
      userId: uid,
      orderIds: uniqueOrderIds,
      idempotencyKey: safeIdempotencyKey,
    });
  }

  const session = await mongoose.startSession();
  try {
    let result;
    try {
      await session.withTransaction(async () => {
        const orderObjectIds = uniqueOrderIds.map(
          (id) => new mongoose.Types.ObjectId(id),
        );
        const orders = await Order.find({
          _id: { $in: orderObjectIds },
          restaurantId: rid,
        }).session(session);
        if (orders.length !== orderObjectIds.length) {
          throw new Error("No eligible orders");
        }

        let amount = 0;
        for (const order of orders) {
          if (String(order.userId || "") !== String(uid)) {
            throw new Error("Forbidden");
          }
          const paymentStatus = String(
            order?.payment?.status || "",
          ).toLowerCase();
          const orderStatus = String(order.currentStatus || "").toLowerCase();
          if (
            paymentStatus === "paid" ||
            String(order.orderPaymentStatus || "").toLowerCase() === "paid"
          ) {
            throw new Error("Order already paid");
          }
          if (["cancelled", "completed"].includes(orderStatus)) {
            throw new Error("Order is not payable");
          }
          amount += Math.max(
            0,
            roundMoney(order?.totals?.grandTotal || 0) -
              roundMoney(order?.payment?.paidAmount || 0),
          );
        }
        amount = normalizeAmount(amount);

        const user = await User.findById(uid).session(session);
        if (!user) throw new Error("User not found");
        const wallet = ensureWalletOnUser(user);
        const balanceBefore = roundMoney(wallet.balance);
        if (balanceBefore < amount) {
          throw new Error("Insufficient wallet balance");
        }
        const balanceAfter = balanceBefore - amount;
        const now = new Date();
        const providerTransactionId = createReference("WALLETPAY");

        const [payment] = await PaymentSession.create(
          [
            {
              restaurantId: rid,
              orderId:
                orderObjectIds.length === 1 ? orderObjectIds[0] : null,
              userId: uid,
              provider: WALLET_PROVIDER,
              paymentMethod: "e_wallet",
              amount,
              currency: wallet.currency || DEFAULT_CURRENCY,
              status: "success",
              callbackStatus: "verified",
              requestId: createReference("REQ"),
              reference: safeIdempotencyKey,
              providerTransactionId,
              reconciledAt: now,
              metadata: {
                source: "order_payment",
                orderIds: uniqueOrderIds,
                idempotencyKey: safeIdempotencyKey,
                internalWallet: true,
                walletProvider: WALLET_PROVIDER,
              },
              events: [
                {
                  type: "payment_created",
                  payload: { provider: WALLET_PROVIDER, source: "wallet" },
                },
                {
                  type: "payment_success",
                  payload: { source: "wallet_balance" },
                },
              ],
            },
          ],
          { session },
        );

        user.wallet.balance = balanceAfter;
        user.wallet.provider = wallet.provider || WALLET_PROVIDER;
        user.wallet.currency = wallet.currency || DEFAULT_CURRENCY;
        user.wallet.updatedAt = now;
        await user.save({ session });

        // Shared provider settlement still uses `provider` as the accounting
        // method. The adapter keeps the stored provider truthful while the
        // ledger receives the canonical e_wallet method.
        const settlementPayment = createWalletSettlementAdapter(payment);
        const settlement = await settlePaidOrderPaymentSession({
          payment: settlementPayment,
          source: WALLET_PROVIDER,
          session,
        });
        if (!settlement?.paymentTransactionId || !settlement?.invoiceId) {
          throw new Error("Wallet payment settlement failed");
        }

        await PaymentTransaction.updateOne(
          { _id: settlement.paymentTransactionId },
          {
            $set: {
              userId: uid,
              "meta.provider": WALLET_PROVIDER,
              "meta.idempotencyKey": safeIdempotencyKey,
            },
          },
          { session },
        );

        for (const order of orders) {
          await Order.updateOne(
            { _id: order._id, restaurantId: rid },
            {
              $set: {
                "payment.method": "e_wallet",
                "payment.provider": WALLET_PROVIDER,
                "payment.transactionId": settlement.paymentTransactionId,
                "payment.txnRef": providerTransactionId,
                "payment.status": "paid",
                "payment.paidAmount": roundMoney(
                  order?.totals?.grandTotal || 0,
                ),
                "payment.currency": user.wallet.currency,
                "payment.paidAt": now,
                "payment.paidBy": uid,
                orderPaymentStatus: "paid",
              },
            },
            { session },
          );
        }

        const walletTransaction = await createWalletTransactionDoc({
          userId: uid,
          type: "PAYMENT",
          amount,
          currency: user.wallet.currency,
          balanceBefore,
          balanceAfter,
          referenceType: "ORDER_PAYMENT",
          referenceId: settlement.paymentTransactionId,
          orderIds: orderObjectIds,
          metadata: {
            restaurantId: String(rid),
            paymentSessionId: String(payment._id),
            paymentTransactionId: String(settlement.paymentTransactionId),
            invoiceId: String(settlement.invoiceId),
            txnRef: providerTransactionId,
            idempotencyKey: safeIdempotencyKey,
          },
          session,
        });

        await EventLog.log(
          {
            restaurantId: rid,
            actorUserId: uid,
            verb: "order.pay",
            object: {
              kind: "PaymentTransaction",
              id: settlement.paymentTransactionId,
            },
            source: "api",
            status: "success",
            meta: {
              method: "cohan_balance",
              amount,
              orderIds: uniqueOrderIds,
              paymentSessionId: String(payment._id),
              invoiceId: String(settlement.invoiceId),
            },
          },
          { session },
        );

        result = {
          ok: true,
          message: "Thanh toán bằng ví thành công.",
          wallet: serializeWallet(user.wallet),
          transaction: serializeWalletTransaction(walletTransaction),
          paymentSession: payment.toObject(),
          paymentTransactionId: String(settlement.paymentTransactionId),
          orderIds: uniqueOrderIds,
          amount,
        };
      });
    } catch (error) {
      if (error?.code === 11000) {
        const duplicate = await findExistingWalletPayment({
          restaurantId: rid,
          userId: uid,
          idempotencyKey: safeIdempotencyKey,
        });
        if (duplicate) {
          return buildExistingWalletPaymentResult({
            transaction: duplicate,
            userId: uid,
            orderIds: uniqueOrderIds,
            idempotencyKey: safeIdempotencyKey,
          });
        }
      }
      throw error;
    }
    return result;
  } finally {
    await session.endSession();
  }
}

async function findRefundPaymentTransaction({ order, restaurantId, session }) {
  const transactionId = toObjectId(order?.payment?.transactionId);
  if (transactionId) {
    const linked = await PaymentTransaction.findOne({
      _id: transactionId,
      restaurantId,
      status: "SUCCESS",
    }).session(session);
    if (linked) return linked;
  }
  return PaymentTransaction.findOne({
    restaurantId,
    status: "SUCCESS",
    $or: [{ orderId: order._id }, { orderIds: order._id }],
  })
    .sort({ paidAt: -1, _id: -1 })
    .session(session);
}

function invoicePaymentStatus(invoice) {
  const paid = Number(invoice?.paid || 0);
  const total = Number(invoice?.totals?.grandTotal || 0);
  if (paid <= 0) return "UNPAID";
  return paid + 1e-6 >= total ? "PAID" : "PARTIAL";
}

export async function refundToWallet({
  userId,
  restaurantId,
  orderIds = [],
  amount,
  reason,
  referenceType = "RESTAURANT_REFUND",
  referenceId,
  processedBy,
}) {
  const uid = toObjectId(userId);
  const rid = toObjectId(restaurantId);
  const actorId = toObjectId(processedBy);
  if (!uid) throw new Error("Invalid userId");
  if (!rid) throw new Error("Invalid restaurantId");
  if (!actorId) throw new Error("Unauthorized");
  const normalizedReason = String(reason || "").trim();
  if (!normalizedReason) throw new Error("Refund reason is required");
  const normalizedAmount = normalizeAmount(amount);
  const uniqueOrderIds = [...new Set((orderIds || []).map(String))];
  if (
    uniqueOrderIds.length !== 1 ||
    !mongoose.isValidObjectId(uniqueOrderIds[0])
  ) {
    throw new Error("Exactly one refund order is required");
  }
  const orderId = new mongoose.Types.ObjectId(uniqueOrderIds[0]);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const order = await Order.findOne({
        _id: orderId,
        restaurantId: rid,
        userId: uid,
      }).session(session);
      if (!order) {
        throw new Error("Refund order is not eligible for this restaurant");
      }
      const paymentTransaction = await findRefundPaymentTransaction({
        order,
        restaurantId: rid,
        session,
      });
      if (!paymentTransaction) {
        throw new Error("Successful payment transaction not found for refund");
      }
      const invoice = await Invoice.findOne({
        restaurantId: rid,
        refTransactionId: paymentTransaction._id,
      }).session(session);
      const orderPaidAmount = Math.max(
        0,
        roundMoney(
          order?.payment?.paidAmount || order?.totals?.grandTotal || 0,
        ),
      );
      if (orderPaidAmount <= 0) {
        throw new Error("Order has no refundable payment");
      }

      const orderRefunds = await PaymentRefund.find({
        restaurantId: rid,
        orderId: order._id,
        status: { $in: ACTIVE_REFUND_STATUSES },
      })
        .session(session)
        .lean();
      const orderReserved = orderRefunds.reduce(
        (sum, refund) => sum + roundMoney(refund.amount || 0),
        0,
      );
      if (orderReserved + normalizedAmount > orderPaidAmount + 1e-6) {
        throw new Error(
          `Refund amount exceeds refundable balance (${Math.max(
            0,
            orderPaidAmount - orderReserved,
          )})`,
        );
      }

      const transactionRefunds = await PaymentRefund.find({
        restaurantId: rid,
        paymentTransactionId: paymentTransaction._id,
        status: { $in: ACTIVE_REFUND_STATUSES },
      })
        .session(session)
        .lean();
      const transactionReserved = transactionRefunds.reduce(
        (sum, refund) => sum + roundMoney(refund.amount || 0),
        0,
      );
      if (
        transactionReserved + normalizedAmount >
        Number(paymentTransaction.paidAmount || 0) + 1e-6
      ) {
        throw new Error("Refund amount exceeds payment transaction balance");
      }

      const user = await User.findById(uid).session(session);
      if (!user) throw new Error("User not found");
      const wallet = ensureWalletOnUser(user);
      const balanceBefore = roundMoney(wallet.balance);
      const balanceAfter = balanceBefore + normalizedAmount;
      const now = new Date();
      user.wallet.balance = balanceAfter;
      user.wallet.provider = wallet.provider || WALLET_PROVIDER;
      user.wallet.currency = wallet.currency || DEFAULT_CURRENCY;
      user.wallet.updatedAt = now;
      await user.save({ session });

      const [refund] = await PaymentRefund.create(
        [
          {
            restaurantId: rid,
            orderId: order._id,
            invoiceId: invoice?._id || null,
            paymentTransactionId: paymentTransaction._id,
            amount: normalizedAmount,
            currency: user.wallet.currency,
            reason: normalizedReason,
            method: "e_wallet",
            status: "success",
            providerRefundId: createReference("REFUND"),
            createdBy: actorId,
            approvedBy: actorId,
            approvedAt: now,
            processedBy: actorId,
            processedAt: now,
            auditTrail: [
              {
                at: now,
                action: "refund_to_wallet",
                actorId,
                nextStatus: "success",
                reason: normalizedReason,
                note: `Refunded ${normalizedAmount} to Cohan Wallet`,
              },
            ],
          },
        ],
        { session },
      );

      const walletTransaction = await createWalletTransactionDoc({
        userId: uid,
        type: "REFUND",
        amount: normalizedAmount,
        currency: user.wallet.currency,
        balanceBefore,
        balanceAfter,
        referenceType,
        referenceId: toObjectId(referenceId) || refund._id,
        orderIds: [order._id],
        metadata: {
          restaurantId: String(rid),
          reason: normalizedReason,
          refundId: String(refund._id),
          paymentTransactionId: String(paymentTransaction._id),
          invoiceId: invoice?._id ? String(invoice._id) : null,
        },
        session,
      });

      const refundCashflow = await Cashflow.findOneAndUpdate(
        {
          restaurantId: rid,
          source: "refund",
          "ref.refundId": refund._id,
        },
        {
          $setOnInsert: {
            restaurantId: rid,
            type: "OUTFLOW",
            amount: normalizedAmount,
            currency: user.wallet.currency,
            category: "refund",
            subcategory: "other",
            method: "e_wallet",
            status: "completed",
            source: "refund",
            occurredAt: now,
            ref: {
              kind: "PaymentRefund",
              id: refund._id,
              orderId: order._id,
              invoiceId: invoice?._id || null,
              paymentTransactionId: paymentTransaction._id,
              refundId: refund._id,
            },
            note: normalizedReason,
            createdBy: actorId,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, session },
      );
      if (refundCashflow?._id) {
        refund.cashflowId = refundCashflow._id;
        await refund.save({ session });
      }

      const nextTransactionRefunded =
        Number(paymentTransaction.refundedAmount || 0) + normalizedAmount;
      paymentTransaction.refundedAmount = nextTransactionRefunded;
      paymentTransaction.refundStatus =
        nextTransactionRefunded + 1e-6 >=
        Number(paymentTransaction.paidAmount || 0)
          ? "refunded"
          : "partial_refunded";
      paymentTransaction.refundIds = Array.from(
        new Set([
          ...(paymentTransaction.refundIds || []).map(String),
          String(refund._id),
        ]),
      ).map((id) => new mongoose.Types.ObjectId(id));
      await paymentTransaction.save({ session });

      const successfulOrderRefunded =
        orderRefunds
          .filter((item) => item.status === "success")
          .reduce(
            (sum, item) => sum + roundMoney(item.amount || 0),
            0,
          ) + normalizedAmount;
      const orderRefundStatus =
        successfulOrderRefunded + 1e-6 >= orderPaidAmount
          ? "refunded"
          : "partially_refunded";
      order.payment = {
        ...(order.payment || {}),
        status: orderRefundStatus,
        refundedAmount: successfulOrderRefunded,
      };
      order.orderPaymentStatus = orderRefundStatus;
      await order.save({ session });

      if (invoice) {
        invoice.paid = Math.max(
          0,
          Number(invoice.paid || 0) - normalizedAmount,
        );
        invoice.status = invoicePaymentStatus(invoice);
        invoice.meta = {
          ...(invoice.meta || {}),
          refundedAmount:
            Number(invoice.meta?.refundedAmount || 0) + normalizedAmount,
          lastRefundId: String(refund._id),
        };
        await invoice.save({ session });
      }

      await EventLog.log(
        {
          restaurantId: rid,
          actorUserId: actorId,
          verb: "payment.refund",
          object: { kind: "PaymentRefund", id: refund._id },
          source: "api",
          status: "success",
          meta: {
            method: "cohan_wallet",
            amount: normalizedAmount,
            userId: String(uid),
            orderId: String(order._id),
            paymentTransactionId: String(paymentTransaction._id),
            invoiceId: invoice?._id ? String(invoice._id) : null,
          },
        },
        { session },
      );

      result = {
        ok: true,
        message: "Đã hoàn tiền vào ví khách hàng.",
        wallet: serializeWallet(user.wallet),
        transaction: serializeWalletTransaction(walletTransaction),
        refundId: String(refund._id),
        amount: normalizedAmount,
      };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export async function adjustWalletBalance({
  restaurantId,
  userId,
  amount,
  reason,
  actorId,
}) {
  const rid = toObjectId(restaurantId);
  const uid = toObjectId(userId);
  const aid = toObjectId(actorId);
  if (!rid) throw new Error("Invalid restaurantId");
  if (!uid) throw new Error("Invalid userId");
  if (!aid) throw new Error("Unauthorized");
  const normalizedReason = String(reason || "").trim();
  if (!normalizedReason) throw new Error("Adjustment reason is required");
  const normalizedAmount = roundMoney(amount);
  if (!normalizedAmount) throw new Error("Invalid wallet amount");

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const customerOrder = await Order.exists({
        restaurantId: rid,
        userId: uid,
      }).session(session);
      if (!customerOrder) {
        throw new Error("Customer does not belong to selected restaurant");
      }
      const user = await User.findById(uid).session(session);
      if (!user) throw new Error("User not found");
      const wallet = ensureWalletOnUser(user);
      const balanceBefore = roundMoney(wallet.balance);
      const balanceAfter = balanceBefore + normalizedAmount;
      if (balanceAfter < 0) {
        throw new Error("Wallet balance cannot be negative");
      }
      const now = new Date();
      user.wallet.balance = balanceAfter;
      user.wallet.provider = wallet.provider || WALLET_PROVIDER;
      user.wallet.currency = wallet.currency || DEFAULT_CURRENCY;
      user.wallet.updatedAt = now;
      await user.save({ session });
      const walletTransaction = await createWalletTransactionDoc({
        userId: uid,
        type: "ADJUSTMENT",
        amount: Math.abs(normalizedAmount),
        currency: user.wallet.currency,
        balanceBefore,
        balanceAfter,
        referenceType: "MANUAL_ADJUSTMENT",
        metadata: {
          restaurantId: String(rid),
          direction: normalizedAmount > 0 ? "credit" : "debit",
          reason: normalizedReason,
          actorId: String(aid),
        },
        session,
      });
      await EventLog.log(
        {
          restaurantId: rid,
          actorUserId: aid,
          verb: "wallet.adjust",
          object: { kind: "WalletTransaction", id: walletTransaction._id },
          source: "api",
          status: "success",
          meta: {
            userId: String(uid),
            amount: normalizedAmount,
            balanceBefore,
            balanceAfter,
            reason: normalizedReason,
          },
        },
        { session },
      );
      result = {
        ok: true,
        message: "Đã điều chỉnh số dư ví.",
        wallet: serializeWallet(user.wallet),
        transaction: serializeWalletTransaction(walletTransaction),
      };
    });
    return result;
  } finally {
    await session.endSession();
  }
}
