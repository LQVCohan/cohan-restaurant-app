import mongoose from "mongoose";
import { PosCustomer } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";
import { normalizePosCustomerPhone } from "./query.js";

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function clean(value) {
  return String(value || "").trim();
}

function sourceOf(value) {
  const key = clean(value).toUpperCase();
  return ["POS", "DELIVERY", "TAKEAWAY"].includes(key) ? key : "POS";
}

function safeFields(input = {}, includeDefaultSource = false) {
  const fields = { isActive: true };
  if (clean(input.source) || includeDefaultSource) fields.source = sourceOf(input.source);
  const fullName = clean(input.fullName);
  if (fullName) fields.fullName = fullName;
  const email = clean(input.email).toLowerCase();
  if (email) fields.email = email;
  const defaultAddress = clean(input.defaultAddress);
  if (defaultAddress) fields.defaultAddress = defaultAddress;
  const note = clean(input.note);
  if (note) fields.note = note;
  return fields;
}

function nextAddressBook(existing = [], address = "") {
  const addr = clean(address);
  const current = Array.isArray(existing) ? existing : [];
  if (!addr) return current.slice(0, 10);
  const lower = addr.toLowerCase();
  const rest = current.filter((item) => clean(item && item.address).toLowerCase() !== lower);
  return [{ address: addr, note: "", lastUsedAt: new Date() }, ...rest].slice(0, 10);
}

export const PosCustomerMutation = {
  async upsertPosCustomer(_, { input } = {}, ctx) {
    const rid = toObjectId(input && input.restaurantId);
    if (!rid) throw new Error("Invalid restaurantId");
    await requireRestaurantAccess(ctx, rid);

    const phone = normalizePosCustomerPhone(input && input.phone);
    if (!phone) throw new Error("phone is required");

    const existing = await PosCustomer.findOne({ restaurantId: rid, phone });
    if (existing) {
      const fields = safeFields(input || {}, false);
      for (const key of Object.keys(fields)) existing[key] = fields[key];
      existing.addressBook = nextAddressBook(existing.addressBook, input && input.defaultAddress);
      await existing.save();
      return existing.toObject({ virtuals: true });
    }

    const created = await PosCustomer.create({
      restaurantId: rid,
      phone,
      ...safeFields(input || {}, true),
      addressBook: nextAddressBook([], input && input.defaultAddress),
    });
    return created.toObject({ virtuals: true });
  },
};

export default PosCustomerMutation;
