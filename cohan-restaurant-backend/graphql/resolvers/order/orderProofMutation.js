import mongoose from "mongoose";
import { Order } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import {
  normalizeOrderProofImages,
  requiresOrderItemProofImage,
} from "../../../src/services/orderProofRules.service.js";
import { emitCustomerTrackingUpdateIfChanged } from "../../../src/services/orderTracking.service.js";
import { emitOrderEvent } from "./helper/emitOrderEvent.js";

const MAX_PROOF_IMAGES = 5;
const DEFAULT_WAIVER_REASON = "Khách hàng xác nhận không cần ảnh minh chứng.";

const toObjectId = (value) =>
  value && mongoose.isValidObjectId(String(value))
    ? new mongoose.Types.ObjectId(String(value))
    : null;

const actorId = (ctx) => ctx?.user?.id || ctx?.user?._id || null;

const isAllowedProofImageUrl = (value) => {
  const url = String(value || "").trim();
  if (url.startsWith("/uploads/")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

const cleanProofImages = (values = []) => {
  const list = normalizeOrderProofImages(values);
  if (!list.length) throw new Error("At least one proof image is required");
  if (list.length > MAX_PROOF_IMAGES) {
    throw new Error(`At most ${MAX_PROOF_IMAGES} proof images are allowed`);
  }
  if (list.some((value) => !isAllowedProofImageUrl(value))) {
    throw new Error("Invalid proof image URL");
  }
  return list;
};

const cleanWaiverReason = (value) => {
  const reason = String(value || DEFAULT_WAIVER_REASON).trim();
  if (reason.length < 5) throw new Error("Proof waiver reason is too short");
  return reason.slice(0, 300);
};

const proofWaiversFor = (order) => {
  const current = order?.clientMeta?.proofWaivers;
  return current && typeof current === "object" ? { ...current } : {};
};

const saveProofWaivers = (order, proofWaivers) => {
  order.clientMeta = {
    ...(order.clientMeta && typeof order.clientMeta === "object" ? order.clientMeta : {}),
    proofWaivers,
  };
  order.markModified?.("clientMeta");
};

async function requireProofUpdatePermission(ctx, restaurantId) {
  try {
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.ORDER_UPDATE);
  } catch (primaryError) {
    try {
      await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.PAYMENT_WRITE);
    } catch {
      throw primaryError;
    }
  }
}

export const OrderProofMutation = {
  async uploadOrderItemProof(_parent, { input }, ctx) {
    const orderId = toObjectId(input?.orderId);
    if (!orderId) throw new Error("Invalid order");

    const restaurantId = toObjectId(input?.restaurantId);
    const filter = restaurantId ? { _id: orderId, restaurantId } : { _id: orderId };
    const proofImages = cleanProofImages(input?.proofImages || []);
    const order = await Order.findOne(filter);
    if (!order) throw new Error("Order not found");
    await requireProofUpdatePermission(ctx, order.restaurantId);

    const item = order.items.id(input?.orderItemId);
    if (!item) throw new Error("Order item not found");
    if (!requiresOrderItemProofImage(item)) {
      throw new Error("Proof is only allowed for items that require evidence");
    }

    const now = new Date();
    const paidAt = order?.payment?.paidAt ? new Date(order.payment.paidAt) : null;
    const deadlineAt = paidAt && !Number.isNaN(paidAt.getTime())
      ? new Date(paidAt.getTime() + 10 * 60 * 1000)
      : null;
    const isLate = deadlineAt ? now.getTime() > deadlineAt.getTime() : false;

    item.proofImages = proofImages;
    const proofWaivers = proofWaiversFor(order);
    delete proofWaivers[String(item._id)];
    saveProofWaivers(order, proofWaivers);

    order.customerVisibleNote = `Nhà hàng đã cập nhật ảnh minh chứng cho món ${item.name}.`;
    order.statusTimeline = order.statusTimeline || [];
    order.statusTimeline.push({
      status: order.currentStatus,
      at: now,
      byUserId: actorId(ctx),
      note: `${isLate ? "Cập nhật trễ" : "Cập nhật"} ảnh minh chứng cho món ${item.name}.`,
    });
    await order.save();

    emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc: order, force: true });
    await emitOrderEvent(ctx, String(order.restaurantId), "ORDER_ITEM_PROOF_UPDATED", {
      order,
      meta: {
        itemId: String(item._id),
        itemName: item.name,
        proofCount: proofImages.length,
        deadlineAt,
        isLate,
      },
    });

    return { order: order.toJSON() };
  },

  async setOrderItemProofWaiver(_parent, { input }, ctx) {
    const orderId = toObjectId(input?.orderId);
    if (!orderId) throw new Error("Invalid order");

    const restaurantId = toObjectId(input?.restaurantId);
    const filter = restaurantId ? { _id: orderId, restaurantId } : { _id: orderId };
    const order = await Order.findOne(filter);
    if (!order) throw new Error("Order not found");
    await requireProofUpdatePermission(ctx, order.restaurantId);

    if (String(order.currentStatus || "").toLowerCase() !== "pending") {
      throw new Error("Proof waiver can only be changed while the order is pending");
    }

    const item = order.items.id(input?.orderItemId);
    if (!item) throw new Error("Order item not found");
    if (!requiresOrderItemProofImage(item)) {
      throw new Error("Proof waiver is only allowed for items that require evidence");
    }

    const waived = input?.waived === true;
    const now = new Date();
    const itemId = String(item._id);
    const proofWaivers = proofWaiversFor(order);

    if (waived) {
      proofWaivers[itemId] = {
        waived: true,
        waivedAt: now.toISOString(),
        waivedBy: actorId(ctx) ? String(actorId(ctx)) : null,
        reason: cleanWaiverReason(input?.reason),
        source: "staff_customer_confirmation",
      };
    } else {
      delete proofWaivers[itemId];
    }
    saveProofWaivers(order, proofWaivers);

    const actionText = waived ? "ghi nhận khách không cần" : "hủy miễn";
    order.customerVisibleNote = waived
      ? `Nhà hàng đã ghi nhận khách không yêu cầu ảnh minh chứng cho món ${item.name}.`
      : `Nhà hàng đã yêu cầu lại ảnh minh chứng cho món ${item.name}.`;
    order.statusTimeline = order.statusTimeline || [];
    order.statusTimeline.push({
      status: order.currentStatus,
      at: now,
      byUserId: actorId(ctx),
      note: `${actionText} ảnh minh chứng cho món ${item.name}.`,
    });
    await order.save();

    emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc: order, force: true });
    await emitOrderEvent(
      ctx,
      String(order.restaurantId),
      "ORDER_ITEM_PROOF_WAIVER_UPDATED",
      {
        order,
        meta: {
          itemId,
          itemName: item.name,
          waived,
          waiver: proofWaivers[itemId] || null,
        },
      },
    );

    return { order: order.toJSON() };
  },
};

export default OrderProofMutation;
