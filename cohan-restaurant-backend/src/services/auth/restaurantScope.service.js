import mongoose from "mongoose";
import * as Models from "../../../models/index.js";

const model = (name) => (name in Models ? Models[name] : undefined);
const BrandMembership = model("BrandMembership");
const Restaurant = model("Restaurant");

const emptyFilter = () => ({ _id: { $in: [] } });
const roleName = (user) => {
  const role = user?.role;
  const value =
    user?.roleName ||
    role?.slug ||
    role?.name ||
    (typeof role === "string" ? role : "");
  return String(value || "").trim().toLowerCase();
};
const toObjectId = (id) => (mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null);
const idString = (value) => String(value?._id || value?.id || value || "");
const uniqueIds = (ids) => [...new Map(ids.filter(Boolean).map((id) => [String(id), id])).values()];

export const getUserId = (user) => idString(user);
export const isSystemAdmin = (user) => {
  const currentRole = roleName(user);
  return currentRole ? currentRole === "admin" : String(user?.userType || "").toUpperCase() === "ADMIN";
};

export const getUserBrandMemberships = async (user) => {
  const uid = toObjectId(getUserId(user));
  if (!uid || typeof BrandMembership?.find !== "function") return [];
  return BrandMembership.find({ userId: uid, status: "active" }).lean();
};

export async function getScopedRestaurantFilter(user) {
  if (!user) return emptyFilter();
  if (isSystemAdmin(user)) return {};

  const memberships = await getUserBrandMemberships(user);
  const ors = memberships.flatMap((membership) => {
    if (["owner", "admin"].includes(membership.role)) {
      return [{ brandId: membership.brandId }];
    }

    if (!["manager", "staff"].includes(membership.role)) return [];
    const restaurantIds = uniqueIds(membership.restaurantIds || []);
    return restaurantIds.length
      ? [{ brandId: membership.brandId, _id: { $in: restaurantIds } }]
      : [];
  });

  return ors.length ? { $or: ors } : emptyFilter();
}

const includesId = (values, target) =>
  (values || []).some((value) => String(value) === String(target));

export async function canAccessRestaurant(user, restaurantId) {
  if (!user || !restaurantId) return false;
  if (isSystemAdmin(user)) return true;

  const rid = toObjectId(restaurantId);
  if (!rid) return false;
  const scopedFilter = await getScopedRestaurantFilter(user);

  if (typeof Restaurant?.exists === "function") {
    return Boolean(
      await Restaurant.exists({
        $and: [{ _id: rid }, scopedFilter],
      }),
    );
  }

  if (typeof Restaurant?.findById !== "function") return false;
  const query = Restaurant.findById(rid);
  const restaurant = typeof query?.select === "function"
    ? await query.select("_id brandId").lean()
    : await query;
  if (!restaurant) return false;
  if (scopedFilter._id?.$in) {
    return includesId(scopedFilter._id.$in, restaurant._id);
  }
  return (scopedFilter.$or || []).some(
    (clause) =>
      String(clause.brandId) === String(restaurant.brandId) &&
      (!clause._id?.$in || includesId(clause._id.$in, restaurant._id)),
  );
}

export async function getStaffRestaurantIds(userId, { roles = ["staff"] } = {}) {
  const uid = toObjectId(userId);
  if (!uid || typeof BrandMembership?.find !== "function") return [];
  const membershipQuery = BrandMembership.find({
    userId: uid,
    status: "active",
    role: { $in: roles },
  });
  const memberships = typeof membershipQuery?.select === "function"
    ? await membershipQuery.select("brandId restaurantIds role status").lean()
    : await membershipQuery;
  const pairs = (memberships || []).flatMap((membership) =>
    (membership.restaurantIds || []).map((restaurantId) => ({
      brandId: membership.brandId,
      restaurantId,
    })),
  );
  if (!pairs.length || typeof Restaurant?.find !== "function") return [];
  const restaurants = await Restaurant.find({
    $or: pairs.map(({ brandId, restaurantId }) => ({ _id: restaurantId, brandId })),
  })
    .select("_id")
    .lean();
  return uniqueIds(restaurants.map((restaurant) => restaurant._id)).map(String);
}

export async function staffBelongsToRestaurantByMembership(userId, restaurantId, options = {}) {
  const rid = toObjectId(restaurantId);
  if (!rid) return false;
  const ids = await getStaffRestaurantIds(userId, options);
  return ids.some((id) => String(id) === String(rid));
}

export async function getStaffMembershipRestaurantFilter(restaurantId, options = {}) {
  const rid = toObjectId(restaurantId);
  if (!rid || typeof BrandMembership?.find !== "function") return emptyFilter();
  const roles = options.roles || ["staff"];
  const memberships = await BrandMembership.find({
    status: "active",
    role: { $in: roles },
    restaurantIds: rid,
  })
    .select("userId brandId restaurantIds")
    .lean();
  if (!memberships?.length) return emptyFilter();
  const restaurant = await Restaurant.findById(rid).select("_id brandId").lean();
  if (!restaurant) return emptyFilter();
  const userIds = memberships
    .filter((membership) => String(membership.brandId) === String(restaurant.brandId))
    .map((membership) => membership.userId);
  return userIds.length ? { _id: { $in: uniqueIds(userIds) } } : emptyFilter();
}

export async function canReadBrand(user, brandId) {
  if (!user || !mongoose.isValidObjectId(brandId)) return false;
  if (isSystemAdmin(user)) return true;
  return (await getUserBrandMemberships(user)).some(
    (membership) => String(membership.brandId) === String(brandId),
  );
}

export async function canManageBrand(user, brandId) {
  if (!user || !mongoose.isValidObjectId(brandId)) return false;
  if (isSystemAdmin(user)) return true;
  return (await getUserBrandMemberships(user)).some(
    (membership) =>
      String(membership.brandId) === String(brandId) &&
      ["owner", "admin"].includes(membership.role),
  );
}

export const canManageBrandRestaurants = canManageBrand;

export async function isBrandOwner(user, brandId) {
  if (!user || !mongoose.isValidObjectId(brandId)) return false;
  if (isSystemAdmin(user)) return true;
  return (await getUserBrandMemberships(user)).some(
    (membership) =>
      String(membership.brandId) === String(brandId) && membership.role === "owner",
  );
}

export async function isActiveBrandOperator(candidateUserId, brandId) {
  const uid = toObjectId(candidateUserId);
  const bid = toObjectId(brandId);
  if (!uid || !bid || typeof BrandMembership?.exists !== "function") return false;
  return Boolean(
    await BrandMembership.exists({
      userId: uid,
      brandId: bid,
      status: "active",
      role: { $in: ["owner", "admin", "manager"] },
    }),
  );
}

export async function ensureBrandRestaurants(brandId, restaurantIds = []) {
  const ids = [...new Set((restaurantIds || []).filter(Boolean).map(String))];
  if (!ids.length) return [];
  const objectIds = ids.map(toObjectId);
  if (objectIds.some((id) => !id) || !toObjectId(brandId)) throw new Error("Invalid ID");
  const count = await Restaurant.countDocuments({
    _id: { $in: objectIds },
    brandId: toObjectId(brandId),
  });
  if (count !== ids.length) throw new Error("restaurantIds must belong to the brand");
  return objectIds;
}
