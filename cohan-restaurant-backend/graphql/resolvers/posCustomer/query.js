import mongoose from "mongoose";
import { PosCustomer, User } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizePosCustomerPhone(value) {
  let normalized = String(value || "")
    .trim()
    .replace(/[\s.\-()]/g, "");
  if (normalized.startsWith("+84")) normalized = `0${normalized.slice(3)}`;
  if (normalized.startsWith("84")) normalized = `0${normalized.slice(2)}`;
  return normalized;
}

function buildSearchFilter(search) {
  const raw = String(search || "").trim();
  if (!raw) return {};

  const escaped = escapeRegex(raw);
  const phone = normalizePosCustomerPhone(raw);
  const or = [
    { fullName: new RegExp(escaped, "i") },
    { email: new RegExp(escaped, "i") },
    { defaultAddress: new RegExp(escaped, "i") },
  ];

  if (phone) {
    or.push({ phone: new RegExp(escapeRegex(phone), "i") });
  }

  return { $or: or };
}

export const PosCustomerQuery = {
  async posCustomers(_, { restaurantId, search = "", limit = 20 } = {}, ctx) {
    const rid = toObjectId(restaurantId);
    if (!rid) throw new Error("Invalid restaurantId");
    await requireRestaurantAccess(ctx, rid);

    const safeLimit = Math.max(1, Math.min(Number(limit || 20), 100));
    const query = {
      restaurantId: rid,
      isActive: { $ne: false },
      ...buildSearchFilter(search),
    };

    return PosCustomer.find(query)
      .sort({ lastOrderAt: -1, updatedAt: -1, createdAt: -1 })
      .limit(safeLimit)
      .lean({ virtuals: true });
  },
  async posCustomerCandidates(_, { restaurantId, keyword = "", email, phone } = {}, ctx) {
    const rid = toObjectId(restaurantId);
    if (!rid) throw new Error("Invalid restaurantId");
    await requireRestaurantAccess(ctx, rid);

    const nEmail = String(email || "").trim().toLowerCase() || null;
    const nPhone = normalizePosCustomerPhone(phone || "") || null;
    const search = String(keyword || "").trim();

    const userOr = [];
    if (nEmail) userOr.push({ email: nEmail });
    if (nPhone) userOr.push({ phone: nPhone });
    if (search) {
      const escaped = escapeRegex(search);
      userOr.push({ fullName: new RegExp(escaped, "i") });
      userOr.push({ email: new RegExp(escaped, "i") });
      userOr.push({ phone: new RegExp(escapeRegex(normalizePosCustomerPhone(search)), "i") });
    }

    const userRows = userOr.length
      ? await User.find({
          deletedAt: null,
          $or: userOr,
        })
          .select("_id fullName email phone address")
          .limit(30)
          .lean()
      : [];

    const out = new Map();
    for (const u of userRows) {
      const id = String(u._id);
      out.set(id, {
        id,
        fullName: u.fullName || null,
        email: u.email || null,
        phone: u.phone || null,
        address: u?.address?.line1 || null,
        source: "USER",
      });
    }
    return [...out.values()];
  },
};

export default PosCustomerQuery;
