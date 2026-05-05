import mongoose from "mongoose";
import { PosCustomer } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizePosCustomerPhone(value) {
  return String(value || "")
    .trim()
    .replace(/[\s.\-()]/g, "");
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
};

export default PosCustomerQuery;
