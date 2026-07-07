import mongoose from "mongoose";
import * as Models from "../../../models/index.js";

const model = (name) => (name in Models ? Models[name] : undefined);
const BrandMembership = model("BrandMembership");
const Restaurant = model("Restaurant");

const emptyFilter = () => ({ _id: { $in: [] } });
const roleName = (user) => String(user?.roleName || user?.role?.slug || user?.role || "").toLowerCase();
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

async function loadRestaurantForScope(restaurantId) {
  if (!mongoose.isValidObjectId(restaurantId) || typeof Restaurant?.findById !== "function") return null;
  const query = Restaurant.findById(restaurantId);
  return typeof query?.select === "function"
    ? query.select("_id brandId").lean()
    : query;
}

export async function canAccessRestaurant(user, restaurantId) {
  if (!user || !restaurantId) return false;
  if (isSystemAdmin(user)) return true;

  const [memberships, restaurant] = await Promise.all([
    getUserBrandMemberships(user),
    loadRestaurantForScope(restaurantId),
  ]);
  if (!restaurant?.brandId) return false;

  const matching = memberships.filter(
    (membership) => String(membership.brandId) === String(restaurant.brandId),
  );

  if (matching.some((membership) => ["owner", "admin"].includes(membership.role))) return true;
  return matching.some(
    (membership) =>
      ["manager", "staff"].includes(membership.role) &&
      (membership.restaurantIds || []).some((id) => String(id) === String(restaurant._id)),
  );
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
