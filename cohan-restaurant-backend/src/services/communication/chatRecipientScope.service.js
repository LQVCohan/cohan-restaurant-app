import * as Models from "../../../models/index.js";

const model = (name) => (name in Models ? Models[name] : null);
const uniq = (arr = []) => [...new Set(arr.map(String).filter(Boolean))];

async function brandScopedUserIds(restaurantId, branches) {
  const restaurant = await model("Restaurant").findById(restaurantId).select("brandId").lean();
  if (!restaurant?.brandId) return [];

  const memberships = await model("BrandMembership").find({
    brandId: restaurant.brandId,
    status: "active",
    $or: branches,
  }).select("userId").lean();

  const membershipIds = uniq(memberships.map((item) => item.userId));
  if (!membershipIds.length || typeof model("User")?.find !== "function") return membershipIds;

  const users = await model("User").find({
    _id: { $in: membershipIds },
    status: "active",
    deletedAt: null,
  }).select("_id").lean();

  return users.map((user) => String(user._id));
}

async function directStaffIds(restaurantId) {
  if (typeof model("User")?.find !== "function") return [];
  const users = await model("User").find({
    userType: "STAFF",
    status: "active",
    deletedAt: null,
    restaurantForStaff: restaurantId,
  }).select("_id").lean();
  return users.map((user) => String(user._id));
}

export async function resolveChatRecipientIdsByRole({ restaurantId, targetRole, senderId }) {
  const role = String(targetRole || "").toLowerCase();
  if (!role || !restaurantId) return [];

  const ids = new Set();
  if (["kitchen", "cashier", "staff", "support"].includes(role)) {
    (await directStaffIds(restaurantId)).forEach((id) => ids.add(id));
  }

  if (["management", "manager", "support"].includes(role)) {
    (await brandScopedUserIds(restaurantId, [
      { role: { $in: ["owner", "admin"] } },
      { role: "manager", restaurantIds: restaurantId },
    ])).forEach((id) => ids.add(id));
  }

  return [...ids].filter((id) => id !== String(senderId));
}
