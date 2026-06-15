import mongoose from "mongoose";
import { Order } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { emitCustomerTrackingUpdateIfChanged } from "../../../src/services/orderTracking.service.js";
import { emitOrderEvent } from "./helper/emitOrderEvent.js";

const toObjectId = (value) =>
  value && mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null;

const cleanProofImages = (values = []) => {
  const list = Array.isArray(values)
    ? [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]
    : [];
  if (!list.length) throw new Error("At least one proof image is required");
  return list;
};

const requiresByWeightProof = (item = {}) => {
  const mode = String(item?.servingVariant?.mode || "").toUpperCase();
  const unit = String(item?.unit || item?.servingVariant?.sellUnit || "").toLowerCase();
  return mode === "BY_WEIGHT" || unit === "kg" || Number(item?.weightGrams || 0) > 0;
};

export const OrderProofMutation = {
  async uploadOrderItemProof(_parent, { input }, ctx) {
    const orderId = toObjectId(input?.orderId);
    const restaurantId = toObjectId(input?.restaurantId);
    if (!orderId || !restaurantId) throw new Error("Invalid order or restaurant");

    const proofImages = cleanProofImages(input?.proofImages || []);
    const order = await Order.findOne({ _id: orderId, restaurantId });
    if (!order) throw new Error("Order not found");
    await requireRestaurantPermission(ctx, order.restaurantId, PERMISSIONS.ORDER_UPDATE);

    const item = order.items.id(input?.orderItemId);
    if (!item) throw new Error("Order item not found");
    if (!requiresByWeightProof(item)) {
      throw new Error("Proof is only required for by-weight items");
    }

    const now = new Date();
    const paidAt = order?.payment?.paidAt ? new Date(order.payment.paidAt) : null;
    const deadlineAt = paidAt && !Number.isNaN(paidAt.getTime())
      ? new Date(paidAt.getTime() + 10 * 60 * 1000)
      : null;
    const isLate = deadlineAt ? now.getTime() > deadlineAt.getTime() : false;

    item.proofImages = proofImages;
    order.customerVisibleNote = "Nhà hàng đã cập nhật ảnh minh chứng cân ký cho món của bạn.";
    order.statusTimeline = order.statusTimeline || [];
    order.statusTimeline.push({
      status: order.currentStatus,
      at: now,
      byUserId: ctx?.user?.id || ctx?.user?._id || null,
      note: `${isLate ? "Cập nhật trễ" : "Cập nhật"} ảnh minh chứng cân ký cho món ${item.name}.`,
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
