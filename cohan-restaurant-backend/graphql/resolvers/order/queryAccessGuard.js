import mongoose from "mongoose";
import { Order } from "../../../models/index.js";
import { requireAuth, requireRestaurantAccess } from "../../guards.js";
import { resolveUserRoles } from "../../../src/services/scheduling/schedulingPermission.service.js";

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function currentUserId(ctx) {
  return String(ctx?.user?.id || ctx?.user?._id || "");
}

function isAdmin(ctx) {
  requireAuth(ctx);
  return resolveUserRoles(ctx.user).includes("ADMIN");
}

function isSelf(ctx, userId) {
  const uid = String(userId || "");
  return !!uid && currentUserId(ctx) === uid;
}

async function requireInputRestaurantAccess(ctx, restaurantId) {
  const rid = toObjectId(restaurantId);
  if (!rid) throw new Error("Invalid restaurantId");
  await requireRestaurantAccess(ctx, rid);
  return rid;
}

async function requireFilterRestaurantAccess(ctx, filter = {}) {
  if (filter?.restaurantId) {
    await requireInputRestaurantAccess(ctx, filter.restaurantId);
    return;
  }

  if (isAdmin(ctx)) return;
  throw new Error("restaurantId is required for order query");
}

async function loadOrderForRead({ orderId }) {
  const oid = toObjectId(orderId);
  if (!oid) throw new Error("Invalid orderId");

  const order = await Order.findById(oid).lean();
  if (!order) throw new Error("Order not found");
  return order;
}

async function requireOrderReadAccess(ctx, order) {
  requireAuth(ctx);
  if (order?.userId && isSelf(ctx, order.userId)) return;
  await requireRestaurantAccess(ctx, order.restaurantId);
}

async function requireUserOrdersReadAccess(ctx, userId) {
  requireAuth(ctx);
  if (isSelf(ctx, userId)) return;
  if (isAdmin(ctx)) return;
  throw new Error("FORBIDDEN_SCOPE");
}

export function withOrderQueryRestaurantAccessGuards(query = {}) {
  return {
    ...query,

    async order(parent, args, ctx, info) {
      const order = await loadOrderForRead({ orderId: args?.id });
      await requireOrderReadAccess(ctx, order);
      return query.order.call(query, parent, args, ctx, info);
    },

    async orders(parent, args, ctx, info) {
      await requireFilterRestaurantAccess(ctx, args?.filter || {});
      return query.orders.call(query, parent, args, ctx, info);
    },

    async ordersByRestaurantNow(parent, args, ctx, info) {
      await requireInputRestaurantAccess(ctx, args?.restaurantId);
      return query.ordersByRestaurantNow.call(query, parent, args, ctx, info);
    },

    async ordersByRestaurant(parent, args, ctx, info) {
      await requireInputRestaurantAccess(ctx, args?.restaurantId);
      return query.ordersByRestaurant.call(query, parent, args, ctx, info);
    },

    async ordersByTableCode(parent, args, ctx, info) {
      await requireInputRestaurantAccess(ctx, args?.restaurantId);
      return query.ordersByTableCode.call(query, parent, args, ctx, info);
    },

    async ordersGroupedByTable(parent, args, ctx, info) {
      await requireInputRestaurantAccess(ctx, args?.restaurantId);
      return query.ordersGroupedByTable.call(query, parent, args, ctx, info);
    },

    async ordersByUser(parent, args, ctx, info) {
      await requireUserOrdersReadAccess(ctx, args?.userId);
      return query.ordersByUser.call(query, parent, args, ctx, info);
    },

    async managerDashboard(parent, args, ctx, info) {
      await requireInputRestaurantAccess(ctx, args?.restaurantId);
      return query.managerDashboard.call(query, parent, args, ctx, info);
    },

    async reportsOverview(parent, args, ctx, info) {
      await requireInputRestaurantAccess(ctx, args?.restaurantId);
      return query.reportsOverview.call(query, parent, args, ctx, info);
    },

    async demandForecast(parent, args, ctx, info) {
      await requireInputRestaurantAccess(ctx, args?.restaurantId);
      return query.demandForecast.call(query, parent, args, ctx, info);
    },

    async menuEngineeringAssistant(parent, args, ctx, info) {
      await requireInputRestaurantAccess(ctx, args?.restaurantId);
      return query.menuEngineeringAssistant.call(query, parent, args, ctx, info);
    },

    async smartPromotionEngine(parent, args, ctx, info) {
      await requireInputRestaurantAccess(ctx, args?.restaurantId);
      return query.smartPromotionEngine.call(query, parent, args, ctx, info);
    },
  };
}

export default withOrderQueryRestaurantAccessGuards;
