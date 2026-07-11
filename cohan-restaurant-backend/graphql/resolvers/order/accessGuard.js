import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Order } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { requireRestaurantAccess } from "../../guards.js";
import { ConfirmedOrderPrintMutation } from "./confirmedOrderPrintMutation.js";
import { emitOrderEvent } from "./helper/emitOrderEvent.js";

const PREPARATION_STATION_BY_ROLE = Object.freeze({
  bartender: "bar",
  chef: "kitchen",
  cook: "kitchen",
  kitchen_helper: "kitchen",
});

const PREPARATION_STATION_BY_DEPARTMENT = Object.freeze({
  bar: "bar",
  kitchen: "kitchen",
});

function normalizeAccessValue(value) {
  return String(value || "").trim().toLowerCase();
}

export function resolvePreparationStationScope(user = {}) {
  const roleCandidates = [
    user?.roleName,
    user?.role?.slug,
    user?.role?.name,
  ]
    .map(normalizeAccessValue)
    .filter(Boolean);

  for (const role of roleCandidates) {
    if (PREPARATION_STATION_BY_ROLE[role]) {
      return PREPARATION_STATION_BY_ROLE[role];
    }
  }

  const parentRole = normalizeAccessValue(
    user?.role?.parentRole?.slug || user?.role?.parentRole?.name,
  );
  const userType = normalizeAccessValue(user?.userType);
  const department = normalizeAccessValue(
    user?.role?.department || user?.department,
  );

  if (parentRole === "staff" || userType === "staff") {
    return PREPARATION_STATION_BY_DEPARTMENT[department] || null;
  }

  return null;
}

export function getOrderItemPreparationStation(item = {}) {
  const station = normalizeAccessValue(
    item?.prepStation || item?.station || item?.workItemStation,
  );
  return ["kitchen", "bar"].includes(station) ? station : null;
}

function stationForbidden() {
  return new GraphQLError("Bạn không có quyền xử lý món thuộc khu vực này.", {
    extensions: { code: "FORBIDDEN" },
  });
}

export function assertOrderItemPreparationStationAccess(user, item) {
  const requiredStation = resolvePreparationStationScope(user);
  if (!requiredStation) return true;

  if (getOrderItemPreparationStation(item) !== requiredStation) {
    throw stationForbidden();
  }

  return true;
}

export function scopeOrdersForPreparationStation(orders = [], user = {}) {
  const requiredStation = resolvePreparationStationScope(user);
  if (!requiredStation) return orders;

  return (orders || [])
    .map((order) => {
      const plainOrder =
        typeof order?.toObject === "function"
          ? order.toObject({ virtuals: true })
          : { ...order };
      const items = (plainOrder.items || []).filter(
        (item) => getOrderItemPreparationStation(item) === requiredStation,
      );
      return { ...plainOrder, items };
    })
    .filter((order) => order.items.length > 0);
}

export function withPreparationStationOrderFilter(filter = {}, user = {}) {
  const requiredStation = resolvePreparationStationScope(user);
  return requiredStation
    ? { ...filter, "items.prepStation": requiredStation }
    : filter;
}

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

function findOrderItem(order, itemKey) {
  return (order?.items || []).find(
    (item, index) =>
      String(item?._id) === String(itemKey) ||
      String(item?.dishId) === String(itemKey) ||
      String(index) === String(itemKey),
  );
}

async function runPersistedOrderMutation({
  mutation,
  mutationName,
  permissionCode,
  parent,
  args,
  ctx,
  info,
}) {
  if (resolvePreparationStationScope(ctx?.user)) throw stationForbidden();

  const persistedOrder = await loadScopedOrder({
    orderId: args?.input?.orderId,
    ctx,
    permissionCode,
  });
  const result = await mutation[mutationName].call(
    mutation,
    parent,
    args,
    ctx,
    info,
  );
  await emitOrderEvent(
    ctx,
    persistedOrder.restaurantId,
    "ORDER_UPDATED",
    result,
  );
  return result;
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
      const isReservationAddon =
        String(args?.input?.clientMeta?.source || "") ===
        "reservation_cart_addon";
      // ponytail: the canonical resolver already validates customer auth,
      // reservation ownership and every cart hold for this one source.
      if (!isReservationAddon) {
        await requireInputRestaurantAccess(ctx, args?.input?.restaurantId);
      }
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
      return ConfirmedOrderPrintMutation.confirmIncomingOrder.call(
        mutation,
        parent,
        args,
        ctx,
        info,
      );
    },

    async rejectIncomingOrder(parent, args, ctx, info) {
      return ConfirmedOrderPrintMutation.rejectIncomingOrder.call(
        mutation,
        parent,
        args,
        ctx,
        info,
      );
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

    async updateOrderStatus(parent, args, ctx, info) {
      if (resolvePreparationStationScope(ctx?.user)) throw stationForbidden();
      return mutation.updateOrderStatus.call(mutation, parent, args, ctx, info);
    },

    async updateOrderItemStatus(parent, args, ctx, info) {
      const input = args?.input || {};
      const order = await loadScopedOrder({
        orderId: input.orderId,
        restaurantId: input.restaurantId,
        ctx,
        permissionCode: PERMISSIONS.ORDER_UPDATE,
      });
      const item = findOrderItem(order, input.itemKey);
      if (!item) throw new Error("Item not found");
      assertOrderItemPreparationStationAccess(ctx?.user, item);
      return mutation.updateOrderItemStatus.call(mutation, parent, args, ctx, info);
    },

    async updateOrderItemPriority(parent, args, ctx, info) {
      const input = args?.input || {};
      const order = await loadScopedOrder({
        orderId: input.orderId,
        restaurantId: input.restaurantId,
        ctx,
        permissionCode: PERMISSIONS.ORDER_UPDATE,
      });
      const item = findOrderItem(order, input.itemKey);
      if (!item) throw new Error("Item not found");
      assertOrderItemPreparationStationAccess(ctx?.user, item);
      return mutation.updateOrderItemPriority.call(mutation, parent, args, ctx, info);
    },

    async adjustOrderItemQuantity(parent, args, ctx, info) {
      return runPersistedOrderMutation({
        mutation,
        mutationName: "adjustOrderItemQuantity",
        permissionCode: PERMISSIONS.ORDER_UPDATE,
        parent,
        args,
        ctx,
        info,
      });
    },

    async requestOrderItemVoid(parent, args, ctx, info) {
      return runPersistedOrderMutation({
        mutation,
        mutationName: "requestOrderItemVoid",
        permissionCode: PERMISSIONS.ORDER_UPDATE,
        parent,
        args,
        ctx,
        info,
      });
    },

    async reviewOrderItemVoid(parent, args, ctx, info) {
      return runPersistedOrderMutation({
        mutation,
        mutationName: "reviewOrderItemVoid",
        permissionCode: PERMISSIONS.ORDER_CANCEL,
        parent,
        args,
        ctx,
        info,
      });
    },

    async requestOrderItemReturn(parent, args, ctx, info) {
      return runPersistedOrderMutation({
        mutation,
        mutationName: "requestOrderItemReturn",
        permissionCode: PERMISSIONS.ORDER_UPDATE,
        parent,
        args,
        ctx,
        info,
      });
    },

    async reviewOrderItemReturn(parent, args, ctx, info) {
      return runPersistedOrderMutation({
        mutation,
        mutationName: "reviewOrderItemReturn",
        permissionCode: PERMISSIONS.ORDER_CANCEL,
        parent,
        args,
        ctx,
        info,
      });
    },
  };
}

export default withOrderRestaurantAccessGuards;
