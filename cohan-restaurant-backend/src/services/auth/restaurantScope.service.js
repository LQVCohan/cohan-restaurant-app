import mongoose from "mongoose";
import * as Models from "../../../models/index.js";

const model = (name) => (name in Models ? Models[name] : undefined);
const BrandMembership = model("BrandMembership");
const Restaurant = model("Restaurant");

const emptyFilter = () => ({ _id: { $in: [] } });
const roleName = (user) => String(user?.roleName || user?.role?.slug || user?.role || "").toLowerCase();
const toObjectId = (id) => (mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null);
const idString = (value) => String(value?._id || value?.id || value || "");
const operationalRoles = new Set([
  "manager",
  "hr",
  "accountant",
  "staff",
  "server",
  "supervisor",
  "host",
  "cashier",
  "chef",
  "cook",
  "kitchen_helper",
  "cleaner",
  "shipper",
  "storekeeper",
  "bartender",
]);
const userRoleNames = (user) => [
  roleName(user),
  String(user?.userType || "").toLowerCase(),
  ...(Array.isArray(user?.roles) ? user.roles.map((role) => String(role).toLowerCase()) : []),
].filter(Boolean);
const hasOperationalRole = (user) => userRoleNames(user).some((role) => operationalRoles.has(role));
const uniqueIds = (ids) => [...new Map(ids.filter(Boolean).map((id) => [String(id), id])).values()];

const legacyRestaurantValuesFromUser = (user) => [
  user?.restaurantId,
  user?.restaurantForStaff,
  ...(user?.restaurantIds || []),
  ...(user?.restaurants || []),
];
const legacyRestaurantIdsFromUser = (user) => legacyRestaurantValuesFromUser(user)
  .map(toObjectId)
  .filter(Boolean);
const legacyRestaurantIdStringsFromUser = (user) => legacyRestaurantValuesFromUser(user)
  .map(idString)
  .filter(Boolean);

export const getUserId = (user) => idString(user);
export const isSystemAdmin = (user) => String(user?.userType || "").toUpperCase() === "ADMIN" || roleName(user) === "admin";

export const getUserBrandMemberships = async (user) => {
  const uid = toObjectId(getUserId(user));
  if (!uid || typeof BrandMembership?.find !== "function") return [];
  return BrandMembership.find({ userId: uid, status: "active" }).lean();
};

function membershipScope(memberships) {
  return {
    brandIds: memberships
      .filter((membership) => ["owner", "admin"].includes(membership.role))
      .map((membership) => membership.brandId),
    restaurantIds: memberships
      .filter((membership) => ["manager", "staff"].includes(membership.role))
      .flatMap((membership) => membership.restaurantIds || []),
  };
}

export async function getScopedRestaurantFilter(user) {
  if (!user) return emptyFilter();
  if (isSystemAdmin(user)) return {};

  const memberships = await getUserBrandMemberships(user);
  const { brandIds, restaurantIds } = membershipScope(memberships);
  const scopedBrandIds = uniqueIds(brandIds);
  const scopedRestaurantIds = uniqueIds(restaurantIds);
  const ors = [
    ...(scopedBrandIds.length ? [{ brandId: { $in: scopedBrandIds } }] : []),
    ...(scopedRestaurantIds.length ? [{ _id: { $in: scopedRestaurantIds } }] : []),
  ];

  // Legacy restaurant scope remains valid only until the user has an active BrandMembership.
  if (!memberships.length && hasOperationalRole(user)) {
    const legacyIds = legacyRestaurantIdsFromUser(user);
    if (legacyIds.length) ors.push({ _id: { $in: legacyIds } });

    const uid = toObjectId(getUserId(user));
    if (uid && userRoleNames(user).includes("manager")) {
      ors.push({ managerId: uid });
    }
  }

  return ors.length ? { $or: ors } : emptyFilter();
}

async function loadRestaurantForScope(restaurantId) {
  if (!mongoose.isValidObjectId(restaurantId) || typeof Restaurant?.findById !== "function") return null;
  const query = Restaurant.findById(restaurantId);
  return typeof query?.select === "function"
    ? query.select("_id brandId managerId").lean()
    : query;
}

async function legacyManagerOwnsRestaurant(user, restaurantId) {
  const uid = getUserId(user);
  if (!uid || !userRoleNames(user).includes("manager") || typeof Restaurant?.exists !== "function") {
    return false;
  }

  try {
    return Boolean(await Restaurant.exists({ _id: restaurantId, managerId: uid }));
  } catch {
    return false;
  }
}

export async function canAccessRestaurant(user, restaurantId) {
  if (!user || !restaurantId) return false;
  if (isSystemAdmin(user)) return true;

  const memberships = await getUserBrandMemberships(user);
  const assignedMembershipRestaurantIds = membershipScope(memberships).restaurantIds;
  if (assignedMembershipRestaurantIds.some((id) => String(id) === String(restaurantId))) {
    return true;
  }

  const restaurant = await loadRestaurantForScope(restaurantId);
  const matching = restaurant?.brandId
    ? memberships.filter((membership) => String(membership.brandId) === String(restaurant.brandId))
    : [];

  if (matching.some((membership) => ["owner", "admin"].includes(membership.role))) return true;
  if (
    matching.some(
      (membership) =>
        ["manager", "staff"].includes(membership.role) &&
        (membership.restaurantIds || []).some((id) => String(id) === String(restaurant?._id)),
    )
  ) {
    return true;
  }

  // An active membership is authoritative; never widen it with legacy fields.
  if (memberships.length) return false;
  if (!hasOperationalRole(user)) return false;

  const target = String(restaurant?._id || restaurantId);
  if (restaurant && String(restaurant.managerId || "") === getUserId(user)) return true;
  if (legacyRestaurantIdStringsFromUser(user).some((id) => id === target)) return true;
  return legacyManagerOwnsRestaurant(user, restaurantId);
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
