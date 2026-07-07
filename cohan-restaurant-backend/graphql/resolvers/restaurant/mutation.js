// src/resolvers/restaurant.mutation.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Restaurant, RestaurantCategoryIndex, Customer } from "../../../models/index.js";
import { touchRecentRestaurant } from "../shared/customerIdentity.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requirePermission } from "../../../src/services/auth/authorization.service.js";
import { rewriteRestaurantProfileDescription as rewriteRestaurantProfileDescriptionService } from "../../../src/services/ai/restaurantProfileRewrite.service.js";
import {
  canAccessRestaurant,
  canManageBrand,
  isBrandOwner,
  isSystemAdmin,
} from "../../../src/services/auth/restaurantScope.service.js";

/* ========== Helpers chung cho Mutation ========== */
function badInput(message) {
  return new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}
function forbidden(message) {
  return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
}
function notFound(message = "Resource not found") {
  return new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });
}
function toObjectId(id) {
  if (!mongoose.isValidObjectId(id)) throw badInput("Invalid ID");
  return new mongoose.Types.ObjectId(id);
}

function cleanAddressValue(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function normalizeRestaurantAddress(addressInput = {}) {
  if (!addressInput || typeof addressInput !== "object") return undefined;

  const hasLat = addressInput.lat !== null && addressInput.lat !== undefined;
  const hasLng = addressInput.lng !== null && addressInput.lng !== undefined;
  if (hasLat !== hasLng) {
    throw badInput("Restaurant latitude and longitude must be provided together");
  }

  let lat;
  let lng;
  if (hasLat) {
    if (
      typeof addressInput.lat !== "number" ||
      !Number.isFinite(addressInput.lat) ||
      typeof addressInput.lng !== "number" ||
      !Number.isFinite(addressInput.lng)
    ) {
      throw badInput("Restaurant coordinates must be finite numbers");
    }
    if (
      addressInput.lat < -90 ||
      addressInput.lat > 90 ||
      addressInput.lng < -180 ||
      addressInput.lng > 180
    ) {
      throw badInput("Restaurant coordinates are out of range");
    }
    lat = addressInput.lat;
    lng = addressInput.lng;
  }

  return {
    line1: cleanAddressValue(addressInput.line1),
    line2: cleanAddressValue(addressInput.line2),
    ward: cleanAddressValue(addressInput.ward),
    district: cleanAddressValue(addressInput.district),
    city: cleanAddressValue(addressInput.city),
    country: cleanAddressValue(addressInput.country, "Vietnam"),
    postalCode: cleanAddressValue(addressInput.postalCode),
    ...(lat !== undefined ? { lat, lng } : {}),
  };
}

/** Kiểm tra quyền sửa theo BrandMembership của nhà hàng */
async function assertCanMutateRestaurant(user, restaurantDoc) {
  if (!user) throw forbidden("Unauthorized");
  if (isSystemAdmin(user)) return true;
  if (restaurantDoc.brandId && await canManageBrand(user, restaurantDoc.brandId)) return true;
  if (!restaurantDoc._id || !await canAccessRestaurant(user, restaurantDoc._id)) {
    throw forbidden("You can only modify restaurants in your BrandMembership scope");
  }
  return true;
}

/* ========== Mutations ========== */

/** Tạo nhà hàng */
async function createRestaurant(_, { input }, ctx) {
  const { user } = ctx || {};
  if (!user) throw forbidden("Unauthorized");
  await requirePermission(ctx, PERMISSIONS.RESTAURANT_WRITE);

  const rest = { ...(input || {}) };
  if (rest.brandId) {
    if (!await canManageBrand(user, rest.brandId)) {
      throw forbidden("Cannot create restaurant in this brand");
    }
    rest.brandId = toObjectId(rest.brandId);
  } else if (!isSystemAdmin(user)) {
    throw forbidden("Admin only");
  }
  if (rest.address) {
    rest.address = normalizeRestaurantAddress(rest.address);
  }

  const created = await Restaurant.create(rest);
  return created.toObject();
}

/** Cập nhật nhà hàng */
async function updateRestaurant(_, { id, input }, ctx) {
  const { user } = ctx || {};
  if (!user) throw forbidden("Unauthorized");
  const _id = toObjectId(id);

  const doc = await Restaurant.findById(_id);
  if (!doc) throw notFound("Restaurant not found");
  await requirePermission(ctx, PERMISSIONS.RESTAURANT_WRITE);
  await assertCanMutateRestaurant(user, doc);

  const rest = { ...(input || {}) };
  const changesBrand =
    Object.prototype.hasOwnProperty.call(rest, "brandId") &&
    String(rest.brandId || "") !== String(doc.brandId || "");

  if (changesBrand) {
    const targetBrandId = rest.brandId;
    if (!targetBrandId) {
      if (!isSystemAdmin(user)) {
        throw forbidden("Only system admin can remove a restaurant from its brand");
      }
      rest.brandId = null;
    } else {
      const canMoveBetweenBrands =
        isSystemAdmin(user) ||
        (
          doc.brandId &&
          await isBrandOwner(user, doc.brandId) &&
          await isBrandOwner(user, targetBrandId)
        );
      if (!canMoveBetweenBrands) {
        throw forbidden("Only system admin or owner of both brands can move a restaurant between brands");
      }
      rest.brandId = toObjectId(targetBrandId);
    }
  }

  if (rest.address) {
    rest.address = normalizeRestaurantAddress(rest.address);
  }
  Object.assign(doc, rest);
  await doc.save();
  return doc.toObject();
}

/** Xoá nhà hàng */
async function deleteRestaurant(_, { id }, ctx) {
  const { user } = ctx || {};
  await requirePermission(ctx, PERMISSIONS.RESTAURANT_WRITE);
  if (!isSystemAdmin(user)) throw forbidden("Admin only");
  const _id = toObjectId(id);

  const doc = await Restaurant.findById(_id);
  if (!doc) throw notFound("Restaurant not found");

  await Restaurant.deleteOne({ _id });
  return true;
}

async function updateRestaurantCategoryIndex(_, { input }, ctx) {
  const { user } = ctx || {};
  if (!user) throw forbidden("Unauthorized");
  await requirePermission(ctx, PERMISSIONS.RESTAURANT_WRITE);

  const { restaurantId, timeSlot, categoryIds = [] } = input || {};
  if (!restaurantId || !timeSlot) {
    throw badInput("restaurantId and timeSlot are required");
  }

  const rId = toObjectId(restaurantId);
  const doc = await Restaurant.findById(rId);
  if (!doc) throw notFound("Restaurant not found");
  await assertCanMutateRestaurant(user, doc);

  const validCategoryIds = categoryIds
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const uniq = [...new Set(validCategoryIds.map((id) => String(id)))].map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  const updated = await RestaurantCategoryIndex.findOneAndUpdate(
    { restaurantId: rId, timeSlot },
    {
      $set: {
        categoryIds: uniq,
        categories: uniq.map((categoryId) => ({
          categoryId,
          menuItemCount: 0,
        })),
        distinctCategoryCount: uniq.length,
      },
    },
    { new: true, upsert: true },
  ).lean();

  return updated;
}

async function rewriteRestaurantProfileDescription(_, { input }, ctx) {
  const { user } = ctx || {};
  if (!user) throw forbidden("Unauthorized");
  const restaurantId = input?.restaurantId;
  if (!restaurantId) throw badInput("restaurantId is required");

  const rId = toObjectId(restaurantId);
  const doc = await Restaurant.findById(rId);
  if (!doc) throw notFound("Restaurant not found");
  await requirePermission(ctx, PERMISSIONS.RESTAURANT_WRITE);
  await assertCanMutateRestaurant(user, doc);

  return rewriteRestaurantProfileDescriptionService({
    restaurantName: input?.restaurantName || doc.name,
    cuisineType: input?.cuisineType || doc.cuisineType,
    currentText: input?.currentText || doc.description,
    chefName: input?.chefName || "",
    tone: input?.tone || "ấm áp, chuyên nghiệp, đáng tin cậy",
  });
}

async function recordRecentRestaurant(_, { restaurantId }, ctx) {
  if (!ctx?.user?.id && !ctx?.user?._id) {
    throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHENTICATED" } });
  }
  if (!mongoose.isValidObjectId(restaurantId)) throw badInput("Invalid restaurantId");
  if (String(ctx.user.userType || "").toUpperCase() !== "CUSTOMER") return false;
  const restaurant = await Restaurant.exists({
    _id: restaurantId,
    businessStatus: "active",
    publicationStatus: "published",
  });
  if (!restaurant) throw notFound("Restaurant not found");
  const customer = await Customer.findOne({ _id: ctx.user.id || ctx.user._id, userType: "CUSTOMER", deletedAt: null });
  if (!customer) return false;
  await touchRecentRestaurant(customer, restaurantId);
  return true;
}

export const RestaurantMutation = {
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  updateRestaurantCategoryIndex,
  rewriteRestaurantProfileDescription,
  recordRecentRestaurant,
};
