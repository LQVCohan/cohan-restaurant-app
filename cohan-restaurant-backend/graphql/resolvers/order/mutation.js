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

/**
 * quantity ở đây phải là float → dùng parseFloat
 */
function normalizeItem(i) {
  const qty = parseFloat(i.quantity ?? 1);
  const price = Number(i.price || 0);
  const lineSubtotal = Math.round(price * qty);
  return {
    dishId: i.dishId ?? i.id,
    menuId: i.menuId,
    categoryId: i.categoryId,
    name: i.name,
    unit: i.unit || "portion",
    price: Number(i.price || 0),
    modifiersPrice: Number(i.modifiersPrice || 0),
    method: i.method || i.cookingMethod || "",
    methodDelta: Number(i.methodDelta || 0),
    description: i.description || "",
    quantity: Number.isFinite(qty) ? qty : 1,
    modifiers: (i.modifiers || []).map((m) => ({
      optionId: m.optionId,
      optionName: m.optionName,
      groupId: m.groupId,
      price: Number(m.price || 0),
    })),
    lineSubtotal,
  };
}

/**
 * Tính total phải nhân được với quantity là số lẻ
 */
function computeTotals(items) {
  let base = 0;
  let mods = 0;
  for (const it of items) {
    const qty = Number(it.quantity || 0);
    base += Number(it.price || 0) * qty;
    mods += Number(it.modifiersPrice || 0) * qty;
  }
  const subtotal = base + mods;
  const tax = Math.round(subtotal * 0.1);
  const service = Math.round(subtotal * 0.05);
  const discount = 0;
  const grandTotal = subtotal + tax + service - discount;
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

// tạo hoặc tìm user khách từ phone/email
async function ensureUserForOrder(ctxUserId, explicitUserId, customer) {
  if (ctxUserId) return toId(ctxUserId);
  if (explicitUserId && mongoose.isValidObjectId(explicitUserId)) {
    return toId(explicitUserId);
  }

  const phone = customer?.phone?.trim();
  const email = customer?.email?.trim()?.toLowerCase();
  const fullName = customer?.fullName?.trim();

  if (!phone && !email) return undefined;

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
  } else if (!user.roleName) {
    user.roleName = "customer";
    await user.save();
  }

  return user._id;
}

export const OrderMutation = {
  // ===================== POS upsert by table =====================
  async upsertTableOrder(_, { input }, ctx) {
    const {
      restaurantId,
      tableCode,
      orderCode,
      items,
      note,
      customer,
      clientMeta,
    } = input;

    if (!restaurantId) throw new Error("restaurantId is required");
    if (!tableCode) throw new Error("tableCode is required");
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("No items to upsert");
    }

    // lấy (hoặc tạo) user nếu có truyền customer
    const userId = await ensureUserForOrder(
      ctx?.user?.id,
      null,
      customer || {}
    );

    // tìm order hiện có của bàn này
    let existingOrder = null;
    if (orderCode) {
      existingOrder = await Order.findOne({
        restaurantId: toId(restaurantId),
        orderCode,
      });
    } else {
      existingOrder = await Order.findOne({
        restaurantId: toId(restaurantId),
        tableCode,
        currentStatus: { $in: ["confirmed", "preparing", "served"] },
      }).sort({ createdAt: -1 });
    }

    const normalizedItems = items.map(normalizeItem);

    let isNewOrder = false;
    let doc;

    if (!existingOrder) {
      // tạo mới
      isNewOrder = true;
      doc = await Order.create({
        orderCode: orderCode || `POS-${tableCode}-${Date.now().toString(36)}`,
        restaurantId: toId(restaurantId),
        tableCode,
        userId,
        orderType: "dine_in",
        shipping: null,
        items: normalizedItems,
        totals: computeTotals(normalizedItems),
        note: note || "",
        payment: {
          method: "cash",
          status: "pending",
        },
        customer: customer
          ? {
              fullName: customer.fullName,
              phone: customer.phone,
              email: customer.email,
            }
          : undefined,
        currentStatus: "confirmed",
        statusTimeline: [
          {
            status: "confirmed",
            at: new Date(),
            byUserId: userId,
            note: "Created from POS",
          },
        ],
        clientMeta,
      });
    } else {
      // append
      const mergedItems = [...(existingOrder.items || []), ...normalizedItems];
      existingOrder.items = mergedItems;
      existingOrder.totals = computeTotals(mergedItems);
      if (note) existingOrder.note = note;
      if (customer) {
        existingOrder.customer = {
          fullName: customer.fullName,
          phone: customer.phone,
          email: customer.email,
        };
        if (userId) existingOrder.userId = userId;
      }
      doc = await existingOrder.save();
    }

    return {
      isNewOrder,
      order: doc.toJSON(),
    };
  },

  // ===================== create order chuẩn =====================
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
      customer,
      tableCode,
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
      tableCode: tableCode || undefined,
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
      customer: customer
        ? {
            fullName: customer.fullName,
            phone: customer.phone,
            email: customer.email,
          }
        : undefined,
      statusTimeline: [
        { status: "confirmed", at: new Date(), byUserId: effectiveUserId },
      ],
    });

    await createPaymentTxn(doc, paymentMethod);
    return doc.toJSON();
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

    // refund nếu đã trả
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
