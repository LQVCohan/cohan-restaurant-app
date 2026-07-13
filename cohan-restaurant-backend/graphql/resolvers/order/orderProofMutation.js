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

const toObjectId = (value) =>
  value && mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null;

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
    order.customerVisibleNote = `Nhà hàng đã cập nhật ảnh minh chứng cho món ${item.name}.`;
    order.statusTimeline = order.statusTimeline || [];
    order.statusTimeline.push({
      status: order.currentStatus,
      at: now,
      byUserId: ctx?.user?.id || ctx?.user?._id || null,
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
};

export default OrderProofMutation;
