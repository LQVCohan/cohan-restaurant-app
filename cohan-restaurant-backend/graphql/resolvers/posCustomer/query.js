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
    const hasAnyFilter = Boolean(nEmail || nPhone || search);

    if (!hasAnyFilter) {
      const recentPosRows = await PosCustomer.find({
        restaurantId: rid,
        isActive: { $ne: false },
      })
        .sort({ lastOrderAt: -1, updatedAt: -1, createdAt: -1 })
        .limit(30)
        .lean({ virtuals: true });

      return recentPosRows.map((c) => ({
        id: String(c._id || c.id),
        fullName: c.fullName || null,
        email: c.email || null,
        phone: c.phone || null,
        address: c.defaultAddress || null,
        note: c.note || null,
        source: "POS",
      }));
    }

    const posOr = [];
    if (nEmail) posOr.push({ email: nEmail });
    if (nPhone) posOr.push({ phone: nPhone });
    if (search) {
      const escaped = escapeRegex(search);
      posOr.push({ fullName: new RegExp(escaped, "i") });
      posOr.push({ email: new RegExp(escaped, "i") });
      posOr.push({ defaultAddress: new RegExp(escaped, "i") });
      const searchPhone = normalizePosCustomerPhone(search);
      if (searchPhone) {
        posOr.push({ phone: new RegExp(escapeRegex(searchPhone), "i") });
      }
    }

    const posRows = posOr.length
      ? await PosCustomer.find({
          restaurantId: rid,
          isActive: { $ne: false },
          $or: posOr,
        })
          .limit(30)
          .lean({ virtuals: true })
      : [];

    const userOr = [];
    if (nEmail) userOr.push({ email: nEmail });
    if (nPhone) userOr.push({ phone: nPhone });
    if (search) {
      const escaped = escapeRegex(search);
      userOr.push({ fullName: new RegExp(escaped, "i") });
      userOr.push({ email: new RegExp(escaped, "i") });
      const searchPhone = normalizePosCustomerPhone(search);
      if (searchPhone) {
        userOr.push({ phone: new RegExp(escapeRegex(searchPhone), "i") });
      }
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
    for (const c of posRows) {
      const id = String(c._id || c.id);
      out.set(`POS:${id}`, {
        id,
        fullName: c.fullName || null,
        email: c.email || null,
        phone: c.phone || null,
        address: c.defaultAddress || null,
        note: c.note || null,
        source: "POS",
      });
    }

    for (const u of userRows) {
      const id = String(u._id);
      out.set(`USER:${id}`, {
        id,
        fullName: u.fullName || null,
        email: u.email || null,
        phone: u.phone || null,
        address: u?.address?.line1 || null,
        note: null,
        source: "USER",
      });
    }
    return [...out.values()];
  },
};

export default PosCustomerQuery;
