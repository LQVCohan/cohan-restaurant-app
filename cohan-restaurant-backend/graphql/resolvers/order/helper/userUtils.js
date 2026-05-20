// graphql/resolvers/order/helper/userUtils.js
import mongoose from "mongoose";
import { Table } from "../../../../models/index.js";
import {
  compactCustomerContact,
  normalizeCustomerEmail,
  normalizeCustomerPhone,
  resolveCustomerIdentityByContact,
} from "../../shared/customerIdentity.js";

import { toId } from "./orderUtils.js";

export const normalizeEmail = normalizeCustomerEmail;

export const normalizePhone = normalizeCustomerPhone;

export function compactCustomerInput(input = {}) {
  const compact = compactCustomerContact(input);
  return {
    fullName: compact.customerName,
    email: compact.email,
    phone: compact.phone,
  };
}

export async function resolveCustomerIdentity({
  email,
  phone,
  selectedUserId,
  session = null,
}) {
  const out = await resolveCustomerIdentityByContact({
    email,
    phone,
    selectedUserId,
    createIfMissing: false,
    session,
  });

  if (out?.conflict) {
    return { conflict: true, ...out.conflict };
  }

  return {
    userId: out?.userId ? String(out.userId) : null,
    mode: out?.mode || "none",
  };
}

export async function resolveOrCreateGuestCustomerForOrder({
  customer,
  selectedUserId,
  requireContact = false,
  createIfMissing = true,
  session = null,
  restaurantId = null,
}) {
  if (selectedUserId) {
    return { userId: selectedUserId, mode: "selected", isGuestCustomer: false };
  }

  const compact = compactCustomerInput(customer);
  if (!compact.email && !compact.phone) {
    if (requireContact) {
      throw new Error("Vui lòng nhập email hoặc số điện thoại để nhà hàng xác nhận đơn hàng.");
    }
    return { userId: null, mode: "none", isGuestCustomer: false };
  }

  const out = await resolveCustomerIdentityByContact({
    email: compact.email,
    phone: compact.phone,
    customerName: compact.fullName,
    createIfMissing,
    session,
    restaurantId,
  });

  if (out?.conflict) {
    throw new Error("Contact information matches multiple customer profiles. Please contact support.");
  }

  return {
    userId: out?.userId || null,
    mode: out?.mode || "none",
    isGuestCustomer: !!out?.isGuestCustomer,
  };
}

export async function ensureUserForOrder(userId, customer, options = {}) {
  if (userId) return userId;

  const identity = await resolveOrCreateGuestCustomerForOrder({
    customer,
    selectedUserId: userId,
    requireContact: !!options?.requireContact,
    createIfMissing: options?.createIfMissing ?? true,
    session: options?.session || null,
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
