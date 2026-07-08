import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Restaurant } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requirePermission } from "../../../src/services/auth/authorization.service.js";
import {
  canAccessRestaurant,
  canManageBrand,
  isSystemAdmin,
} from "../../../src/services/auth/restaurantScope.service.js";
import {
  applyCuisineTemplate,
  listCuisineTemplates,
  skipCuisineTemplateSetup,
} from "../../../src/services/restaurantCuisineTemplate.service.js";

const badInput = (message) =>
  new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
const forbidden = (message) =>
  new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
const notFound = (message) =>
  new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });

function actorId(ctx) {
  return ctx?.user?.id || ctx?.user?._id || null;
}

async function loadSetupRestaurant(ctx, restaurantId, { requireTemplateWrite = false } = {}) {
  if (!ctx?.user) throw forbidden("Unauthorized");
  if (!mongoose.isValidObjectId(restaurantId)) throw badInput("Invalid restaurantId");

  await requirePermission(ctx, PERMISSIONS.RESTAURANT_WRITE);
  if (requireTemplateWrite) {
    await Promise.all([
      requirePermission(ctx, PERMISSIONS.MENU_WRITE),
      requirePermission(ctx, PERMISSIONS.INVENTORY_WRITE),
    ]);
  }

  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) throw notFound("Restaurant not found");

  const allowed =
    isSystemAdmin(ctx.user) ||
    (restaurant.brandId && await canManageBrand(ctx.user, restaurant.brandId)) ||
    await canAccessRestaurant(ctx.user, restaurant._id);
  if (!allowed) throw forbidden("You cannot configure this restaurant");

  return restaurant;
}

export const RestaurantInitialSetupQuery = {
  restaurantCuisineTemplates: (_parent, _args, ctx) => {
    if (!ctx?.user) throw forbidden("Unauthorized");
    return listCuisineTemplates();
  },
};

export const RestaurantInitialSetupMutation = {
  applyRestaurantCuisineTemplate: async (_parent, { restaurantId, templateKey }, ctx) => {
    await loadSetupRestaurant(ctx, restaurantId, { requireTemplateWrite: true });
    try {
      return await applyCuisineTemplate({
        restaurantId,
        templateKey,
        actorId: actorId(ctx),
      });
    } catch (error) {
      throw badInput(error?.message || "Không thể áp dụng mô hình ẩm thực.");
    }
  },

  skipRestaurantCuisineSetup: async (_parent, { restaurantId }, ctx) => {
    await loadSetupRestaurant(ctx, restaurantId);
    try {
      return await skipCuisineTemplateSetup({
        restaurantId,
        actorId: actorId(ctx),
      });
    } catch (error) {
      throw badInput(error?.message || "Không thể bỏ qua thiết lập ban đầu.");
    }
  },
};
