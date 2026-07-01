// src/resolvers/restaurant.mutation.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import {
  User,
  Role,
  Restaurant,
  RestaurantCategoryIndex,
} from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requirePermission } from "../../../src/services/auth/authorization.service.js";
import { rewriteRestaurantProfileDescription as rewriteRestaurantProfileDescriptionService } from "../../../src/services/ai/restaurantProfileRewrite.service.js";
import { canAccessRestaurant, canManageBrand, isActiveBrandOperator, isBrandOwner, isSystemAdmin } from "../../../src/services/auth/restaurantScope.service.js";

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

  const lat =
    typeof addressInput.lat === "number" && Number.isFinite(addressInput.lat)
      ? addressInput.lat
      : undefined;
  const lng =
    typeof addressInput.lng === "number" && Number.isFinite(addressInput.lng)
      ? addressInput.lng
      : undefined;

  return {
    line1: cleanAddressValue(addressInput.line1),
    line2: cleanAddressValue(addressInput.line2),
    ward: cleanAddressValue(addressInput.ward),
    district: cleanAddressValue(addressInput.district),
    city: cleanAddressValue(addressInput.city),
    country: cleanAddressValue(addressInput.country, "Vietnam"),
    postalCode: cleanAddressValue(addressInput.postalCode),
    ...(lat !== undefined ? { lat } : {}),
    ...(lng !== undefined ? { lng } : {}),
  };
}

async function userHasRoleSlug(userDoc, slug) {
  if (!userDoc) return false;
  const want = String(slug).toLowerCase();
  const role = userDoc.role;
  if (!role) return false;

  // role có thể là object, ObjectId hoặc string
  if (
    typeof role === "object" &&
    role !== null &&
    !mongoose.isValidObjectId(role)
  ) {
    const s = (role.slug || role.name || "").toLowerCase();
    return s === want;
  }
  if (mongoose.isValidObjectId(role)) {
    const roleDoc = await Role.findById(role).lean();
    const s = (roleDoc?.slug || roleDoc?.name || "").toLowerCase();
    return s === want;
  }
  if (typeof role === "string") {
    return role.toLowerCase() === want;
  }
  return false;
}

function isAdmin(user) {
  return isSystemAdmin(user);
}

async function isManager(user) {
  return (
    !!user &&
    (user.roleName?.toLowerCase?.() === "manager" ||
      (await userHasRoleSlug(user, "manager")))
  );
}

/** Kiểm tra quyền sửa/xoá theo nhà hàng */
async function assertCanMutateRestaurant(user, restaurantDoc) {
  if (!user) throw forbidden("Unauthorized");
  if (isAdmin(user)) return true;
  if (restaurantDoc.brandId && await canManageBrand(user, restaurantDoc.brandId)) return true;
  if (!restaurantDoc._id || !await canAccessRestaurant(user, restaurantDoc._id)) throw forbidden("You can only modify restaurants in your BrandMembership scope");
  return true;
}

/* ========== Mutations ========== */

/** Tạo nhà hàng */
async function createRestaurant(_, { input }, ctx) {
  const { user } = ctx || {};
  if (!user) throw forbidden("Unauthorized");
  await requirePermission(ctx, PERMISSIONS.RESTAURANT_WRITE);
  const admin = isAdmin(user);

  const { managerId, ...rest } = input || {};
  if (rest.brandId) {
    if (!await canManageBrand(user, rest.brandId)) throw forbidden("Cannot create restaurant in this brand");
    rest.brandId = toObjectId(rest.brandId);
  } else if (!admin) {
    throw forbidden("Admin only");
  }
  if (rest.address) {
    rest.address = normalizeRestaurantAddress(rest.address);
  }
  // Legacy/direct manager metadata kept for GraphQL contract only; BrandMembership is the authorization source.
  let legacyManagerId;
  if (managerId) {
    legacyManagerId = toObjectId(managerId);
    const managerDoc = await User.findById(legacyManagerId).populate("role");
    if (!managerDoc) throw badInput("Manager not found");
    const isRoleManager = await userHasRoleSlug(managerDoc, "manager");
    const isBrandOperator = rest.brandId ? await isActiveBrandOperator(legacyManagerId, rest.brandId) : false;
    if (!isRoleManager && !isBrandOperator) throw forbidden("Target user is not allowed to manage this brand restaurant");
  }

  const created = await Restaurant.create({ ...rest, ...(legacyManagerId ? { managerId: legacyManagerId } : {}) });
  return created.toObject();
}

/** Cập nhật nhà hàng (không đổi manager qua đây) */
async function updateRestaurant(_, { id, input }, ctx) {
  const { user } = ctx || {};
  if (!user) throw forbidden("Unauthorized");
  const _id = toObjectId(id);

  const doc = await Restaurant.findById(_id);
  if (!doc) throw notFound("Restaurant not found");
  await requirePermission(ctx, PERMISSIONS.RESTAURANT_WRITE);
  await assertCanMutateRestaurant(user, doc);

  const { managerId, ...rest } = input || {}; // chặn đổi manager ở mutation này
  if (rest.brandId && String(rest.brandId) !== String(doc.brandId || "")) {
    if (!isSystemAdmin(user) && !(doc.brandId && await isBrandOwner(user, doc.brandId))) throw forbidden("Only system admin or brand owner can move restaurant between brands");
    rest.brandId = toObjectId(rest.brandId);
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
  if (!isAdmin(user)) throw forbidden("Admin only");
  const _id = toObjectId(id);

  const doc = await Restaurant.findById(_id);
  if (!doc) throw notFound("Restaurant not found");

  await Restaurant.deleteOne({ _id });
  return true;
}

/** Cập nhật legacy/cache managerId nhà hàng (Admin only). Brand flow should assign managers through BrandMembership. */
async function updateRestaurantManager(_, { input }, ctx) {
  const { user } = ctx || {};
  await requirePermission(ctx, PERMISSIONS.RESTAURANT_WRITE);
  if (!isAdmin(user)) throw forbidden("Admin only");

  const { restaurantId, managerId } = input || {};
  if (!restaurantId || !managerId)
    throw badInput("restaurantId and managerId are required");

  const rId = toObjectId(restaurantId);
  const mId = toObjectId(managerId);

  const doc = await Restaurant.findById(rId);
  if (!doc) throw notFound("Restaurant not found");

  const managerDoc = await User.findById(mId).populate("role");
  if (!managerDoc) throw badInput("Manager not found");
  const isRoleManager = await userHasRoleSlug(managerDoc, "manager");
  if (!isRoleManager) throw forbidden("Target user is not a manager");

  doc.managerId = mId;
  await doc.save();
  return doc.toObject();
}

async function updateRestaurantCategoryIndex(_, { input }, ctx) {
  const { user } = ctx || {};
  if (!user) throw forbidden("Unauthorized");
  const admin = isAdmin(user);
  const manager = await isManager(user);
  if (!admin && !manager) throw forbidden("Insufficient permission");

  const { restaurantId, timeSlot, categoryIds = [] } = input || {};
  if (!restaurantId || !timeSlot) {
    throw badInput("restaurantId and timeSlot are required");
  }

  const rId = toObjectId(restaurantId);
  const doc = await Restaurant.findById(rId);
  if (!doc) throw notFound("Restaurant not found");
  await requirePermission(ctx, PERMISSIONS.RESTAURANT_WRITE);
  if (!admin) await assertCanMutateRestaurant(user, doc);

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

export const RestaurantMutation = {
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  updateRestaurantManager,
  updateRestaurantCategoryIndex,
  rewriteRestaurantProfileDescription,
};
