// src/graphql/order/mutation.js
import mongoose from "mongoose";
import { Order, PaymentTransaction, User } from "../../../models/index.js";

const toId = (id) => new mongoose.Types.ObjectId(id);

const mapDeliveryToOrderType = (deliveryMethod) => {
  if (deliveryMethod === "dinein") return "dine_in";
  if (deliveryMethod === "pickup") return "takeaway";
  return "delivery";
};

const normalizePaymentMethod = (m) => (m === "transfer" ? "bank_transfer" : m);

function normalizeItem(i) {
  return {
    dishId: i.dishId ?? i.id,
    menuId: i.menuId,
    categoryId: i.categoryId,
    name: i.name,
    unit: i.unit || "phần",
    image: i.image,
    price: Number(i.price || 0),
    modifiersPrice: Number(i.modifiersPrice || 0),
    method: i.method || i.cookingMethod || "",
    methodDelta: Number(i.methodDelta || 0),
    description: i.description || "",
    quantity: Number(i.quantity || 1),
    modifiers: (i.modifiers || []).map((m) => ({
      optionId: m.optionId,
      optionName: m.optionName,
      groupId: m.groupId,
      price: Number(m.price || 0),
    })),
  };
}

function computeTotals(items) {
  let base = 0;
  let mods = 0;
  for (const it of items) {
    base += Number(it.price || 0) * Number(it.quantity || 0);
    mods += Number(it.modifiersPrice || 0) * Number(it.quantity || 0);
  }
  const subtotal = base;
  const total = subtotal + mods;
  const tax = Math.round(total * 0.1);
  const service = 0;
  const discount = 0;
  const grandTotal = total + tax + service - discount;
  return { subtotal, discount, tax, service, grandTotal };
}

async function createPaymentTxn(orderDoc, method) {
  const normalized = normalizePaymentMethod(method);
  const amount = orderDoc?.totals?.grandTotal || 0;
  return PaymentTransaction.create({
    restaurantId: orderDoc.restaurantId,
    orderId: orderDoc._id,
    method: normalized,
    currency: "VND",
    amount,
    status: "succeeded",
    provider: normalized === "bank_transfer" ? "vietqr" : undefined,
    paidAt: new Date(),
    message: "Auto-created on confirmed payment",
  });
}

// ✅ tạo hoặc tìm user guest theo email/phone, TTL 30 ngày
async function ensureUserForOrder(ctxUserId, explicitUserId, customer) {
  if (ctxUserId) return toId(ctxUserId);
  if (explicitUserId && mongoose.isValidObjectId(explicitUserId)) {
    return toId(explicitUserId);
  }

  const phone = customer?.phone?.trim();
  const email = customer?.email?.trim()?.toLowerCase();
  const fullName = customer?.fullName?.trim();

  if (!phone && !email) return undefined; // server vẫn cho phép, nếu bạn muốn bắt buộc hãy throw

  // tìm theo phone hoặc email
  const q = [];
  if (phone) q.push({ phone });
  if (email) q.push({ email });
  let user = await User.findOne(q.length ? { $or: q } : { _id: null });

  if (!user) {
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    user = await User.create({
      fullName,
      phone,
      email,
      roleName: "customer",
      isGuest: true,
      guestExpiresAt: expires,
    });
  } else {
    // nếu có sẵn, đảm bảo roleName hợp lệ
    if (!user.roleName) {
      user.roleName = "customer";
      await user.save();
    }
  }

  return user._id;
}

export const OrderMutation = {
  async createOrder(_, { input }, ctx) {
    const {
      orderCode,
      userId,
      restaurantId,
      reservationId,
      orderType,
      shipping,
      items,
      note,
      paymentMethod,
      customer, // { fullName, phone, email }
    } = input;

    if (!restaurantId) throw new Error("restaurantId is required");
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Order must contain items");
    }

    const effectiveUserId = await ensureUserForOrder(
      ctx?.user?.id,
      userId,
      customer || {
        fullName: shipping?.fullName,
        phone: shipping?.phone,
        email: shipping?.email,
      }
    );

    const normalizedItems = items.map(normalizeItem);
    const totals = computeTotals(normalizedItems);

    const doc = await Order.create({
      orderCode: orderCode || null,
      userId: effectiveUserId,
      restaurantId: toId(restaurantId),
      reservationId:
        reservationId && mongoose.isValidObjectId(reservationId)
          ? toId(reservationId)
          : undefined,
      orderType: orderType || mapDeliveryToOrderType(shipping?.deliveryMethod),
      shipping,
      items: normalizedItems,
      totals,
      note,
      currentStatus: "confirmed",
      payment: {
        method: paymentMethod,
        status: "paid",
        paidAmount: totals.grandTotal,
        currency: "VND",
        paidAt: new Date(),
      },
      statusTimeline: [
        { status: "confirmed", at: new Date(), byUserId: effectiveUserId },
      ],
    });

    await createPaymentTxn(doc, paymentMethod);
    return doc.toJSON(); // có virtual id
  },

  async updateOrderStatus(_, { input }, ctx) {
    const { id, status, note } = input;
    if (!mongoose.isValidObjectId(id)) throw new Error("Invalid order id");
    const doc = await Order.findById(id);
    if (!doc) throw new Error("Order not found");

    const byUserId =
      ctx?.user?.id && mongoose.isValidObjectId(ctx.user.id)
        ? toId(ctx.user.id)
        : undefined;

    doc.currentStatus = status;
    doc.statusTimeline = [
      ...(doc.statusTimeline || []),
      { status, at: new Date(), note, byUserId },
    ];
    await doc.save();
    return doc.toJSON();
  },

  async cancelOrder(_, { id, reason }, ctx) {
    if (!mongoose.isValidObjectId(id)) throw new Error("Invalid order id");
    const doc = await Order.findById(id);
    if (!doc) throw new Error("Order not found");

    const byUserId =
      ctx?.user?.id && mongoose.isValidObjectId(ctx.user.id)
        ? toId(ctx.user.id)
        : undefined;

    doc.currentStatus = "cancelled";
    doc.statusTimeline = [
      ...(doc.statusTimeline || []),
      { status: "cancelled", at: new Date(), note: reason, byUserId },
    ];
    await doc.save();

    const paid =
      doc.payment?.status === "paid" && (doc.totals?.grandTotal || 0) > 0;
    if (paid) {
      await PaymentTransaction.create({
        restaurantId: doc.restaurantId,
        orderId: doc._id,
        method: normalizePaymentMethod(doc.payment?.method || "cash"),
        currency: "VND",
        amount: doc.totals?.grandTotal || 0,
        status: "refunded",
        message: reason || "Order cancelled - refunded",
        paidAt: new Date(),
      });
    }

    return doc.toJSON();
  },
};
