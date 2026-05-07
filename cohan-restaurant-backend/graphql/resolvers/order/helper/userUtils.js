// graphql/resolvers/order/helper/userUtils.js
import mongoose from "mongoose";
import { Customer, Table } from "../../../../models/index.js";

export function normalizeEmail(value) {
  const v = String(value || "").trim().toLowerCase();
  return v || undefined;
}

export function normalizePhone(value) {
  let v = String(value || "").trim();
  if (!v) return undefined;
  v = v.replace(/\s+/g, "");
  if (v.startsWith("+84")) v = "0" + v.slice(3);
  else if (v.startsWith("84")) v = "0" + v.slice(2);
  return v || undefined;
}

export function compactCustomerInput(input = {}) {
  const fullName = String(input?.fullName || input?.name || "").trim() || undefined;
  const email = normalizeEmail(input?.email);
  const phone = normalizePhone(input?.phone);
  return { fullName, email, phone };
}

export async function resolveCustomerIdentity({ email, phone, selectedUserId }) {
  if (selectedUserId) return { userId: selectedUserId, mode: "selected" };
  const [byEmail, byPhone] = await Promise.all([
    email ? Customer.findOne({ email, isGuest: true }).select("_id").lean() : null,
    phone ? Customer.findOne({ phone, isGuest: true }).select("_id").lean() : null,
  ]);
  const eid = byEmail?._id ? String(byEmail._id) : null;
  const pid = byPhone?._id ? String(byPhone._id) : null;
  if (eid && pid && eid !== pid) return { conflict: true, emailUserId: eid, phoneUserId: pid };
  return { userId: eid || pid || null, mode: eid && pid ? "both" : eid ? "email" : pid ? "phone" : "none" };
}

import { toId } from "./orderUtils.js";

export async function ensureUserForOrder(userId, customer) {
  if (userId) return userId;
  const compact = compactCustomerInput(customer);
  const identity = await resolveCustomerIdentity({
    email: compact.email,
    phone: compact.phone,
    selectedUserId: userId,
  });
  return identity?.userId || null;
}

export async function resolveTable(restaurantId, { tableId, tableCode }) {
  let table = null;
  if (tableId && mongoose.isValidObjectId(tableId)) {
    table = await Table.findOne(
      { _id: toId(tableId), restaurantId: toId(restaurantId) },
      { _id: 1, code: 1 }
    ).lean();
  } else if (tableCode) {
    table = await Table.findOne(
      { restaurantId: toId(restaurantId), code: tableCode },
      { _id: 1, code: 1 }
    ).lean();
  }
  if (!table) throw new Error("Table not found");
  return { tableId: String(table._id), tableCode: table.code };
}
