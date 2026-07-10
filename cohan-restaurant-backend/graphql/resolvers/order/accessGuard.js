import mongoose from "mongoose";
import { Order } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { requireRestaurantAccess } from "../../guards.js";
import { ConfirmedOrderPrintMutation } from "./confirmedOrderPrintMutation.js";

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function objectIdStrings(values = []) {
  return values
    .map((value) => toObjectId(value))
    .filter(Boolean)
    .map((value) => String(value));
}

async function requireInputRestaurantAccess(ctx, restaurantId) {
  const rid = toObjectId(restaurantId);
  if (!rid) throw new Error("Invalid restaurantId");
  await requireRestaurantAccess(ctx, rid);
  return rid;
}

async function loadScopedOrder({ orderId, restaurantId, ctx, permissionCode }) {
  const oid = toObjectId(orderId);
  if (!oid) throw new Error("Invalid orderId");

  const order = await Order.findById(oid).lean();
  if (!order) throw new Error("Order not found");

  if (restaurantId && String(order.restaurantId) !== String(toObjectId(restaurantId))) {
    throw new Error("Order not found");
  }

  if (permissionCode) {
    await requireRestaurantPermission(ctx, order.restaurantId, permissionCode);
  } else {
    await requireRestaurantAccess(ctx, order.restaurantId);
  }
  return order;
}

async function assertOrderIdsBelongToRestaurant({ restaurantId, orderIds }) {
  const rawIds = Array.isArray(orderIds) ? orderIds : [];
  const ids = objectIdStrings(rawIds);
  if (!ids.length || ids.length !== rawIds.length) {
    throw new Error("Invalid orderIds");
  }

  const uniqueIds = [...new Set(ids)];

  const count = await Order.countDocuments({
    restaurantId,
    _id: { $in: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)) },
  });

  if (count !== uniqueIds.length) throw new Error("Order not found");
}

async function assertOrderItemBelongsToRestaurant({ restaurantId, orderId, orderItemId }) {
  const oid = toObjectId(orderId);
  const itemId = toObjectId(orderItemId);
  if (!oid) throw new Error("Invalid orderId");
  if (!itemId) throw new Error("Invalid orderItemId");

  const order = await Order.findOne({
    _id: oid,
    restaurantId,
    "items._id": itemId,
  }).lean();

  if (!order) throw new Error("Order item not found");
}

export function withOrderRestaurantAccessGuards(mutation = {}) {
  return {
    ...mutation,

    async createOrderForTable(parent, args, ctx, info) {
      await requireInputRestaurantAccess(ctx, args?.input?.restaurantId);
      return mutation.createOrderForTable.call(mutation, parent, args, ctx, info);
    },

    async createOffPremiseOrder(parent, args, ctx, info) {
      await requireInputRestaurantAccess(ctx, args?.input?.restaurantId);
      return mutation.createOffPremiseOrder.call(mutation, parent, args, ctx, info);
    },

    async createStaffRemoteOrder(parent, args, ctx, info) {
      await requireInputRestaurantAccess(ctx, args?.input?.restaurantId);
      return mutation.createStaffRemoteOrder.call(mutation, parent, args, ctx, info);
    },

    async confirmIncomingOrder(parent, args, ctx, info) {
      // The station-aware resolver loads the order and enforces ORDER_UPDATE
      // against the persisted restaurant, so a guard-level lookup would duplicate
      // both the database read and the permission check.
      return ConfirmedOrderPrintMutation.confirmIncomingOrder.call(
        mutation,
        parent,
        args,
        ctx,
        info,
      );
    },

    async rejectIncomingOrder(parent, args, ctx, info) {
      const input = args?.input || {};
      await loadScopedOrder({
        orderId: input.id,
        restaurantId: input.restaurantId,
        ctx,
      });
      return mutation.rejectIncomingOrder.call(mutation, parent, args, ctx, info);
    },

    async createTemporaryBillPrintJob(parent, args, ctx, info) {
      const input = args?.input || {};
      await loadScopedOrder({
        orderId: input.orderId,
        restaurantId: input.restaurantId,
        ctx,
      });
      return mutation.createTemporaryBillPrintJob.call(mutation, parent, args, ctx, info);
    },

    async requestPaymentForOrder(parent, args, ctx, info) {
      const input = args?.input || {};
      const rid = await requireInputRestaurantAccess(ctx, input.restaurantId);
      await assertOrderIdsBelongToRestaurant({
        restaurantId: rid,
        orderIds: input.orderIds || [],
      });
      return mutation.requestPaymentForOrder.call(mutation, parent, args, ctx, info);
    },

    async requestPaymentForTable(parent, args, ctx, info) {
      await requireInputRestaurantAccess(ctx, args?.input?.restaurantId);
      return mutation.requestPaymentForTable.call(mutation, parent, args, ctx, info);
    },

    async remindOrderItem(parent, args, ctx, info) {
      const input = args?.input || {};
      const rid = await requireInputRestaurantAccess(ctx, input.restaurantId);
      await assertOrderItemBelongsToRestaurant({
        restaurantId: rid,
        orderId: input.orderId,
        orderItemId: input.orderItemId,
      });
      return mutation.remindOrderItem.call(mutation, parent, args, ctx, info);
    },

    async adjustOrderItemQuantity(parent, args, ctx, info) {
      await loadScopedOrder({
        orderId: args?.input?.orderId,
        ctx,
        permissionCode: PERMISSIONS.ORDER_UPDATE,
      });
      return mutation.adjustOrderItemQuantity.call(mutation, parent, args, ctx, info);
    },

    async requestOrderItemVoid(parent, args, ctx, info) {
      await loadScopedOrder({
        orderId: args?.input?.orderId,
        ctx,
        permissionCode: PERMISSIONS.ORDER_UPDATE,
      });
      return mutation.requestOrderItemVoid.call(mutation, parent, args, ctx, info);
    },

    async reviewOrderItemVoid(parent, args, ctx, info) {
      await loadScopedOrder({
        orderId: args?.input?.orderId,
        ctx,
        permissionCode: PERMISSIONS.ORDER_CANCEL,
      });
      return mutation.reviewOrderItemVoid.call(mutation, parent, args, ctx, info);
    },

    async requestOrderItemReturn(parent, args, ctx, info) {
      await loadScopedOrder({
        orderId: args?.input?.orderId,
        ctx,
        permissionCode: PERMISSIONS.ORDER_UPDATE,
      });
      return mutation.requestOrderItemReturn.call(mutation, parent, args, ctx, info);
    },

    async reviewOrderItemReturn(parent, args, ctx, info) {
      await loadScopedOrder({
        orderId: args?.input?.orderId,
        ctx,
        permissionCode: PERMISSIONS.ORDER_CANCEL,
      });
      return mutation.reviewOrderItemReturn.call(mutation, parent, args, ctx, info);
    },
  };
}

export default withOrderRestaurantAccessGuards;
