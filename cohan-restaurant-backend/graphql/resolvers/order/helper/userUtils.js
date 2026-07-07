// graphql/resolvers/order/helper/userUtils.js
import mongoose from "mongoose";
import { Customer, Table } from "../../../../models/index.js";
import {
  applyCustomerRestaurantTouch,
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
    touchGuestOnMatch: false,
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
    const out = await resolveCustomerIdentityByContact({
      selectedUserId,
      createIfMissing: false,
      session,
      restaurantId,
      touchRecentOnMatch: true,
      addCustomerRestaurant: true,
    });
    return {
      userId: out?.userId || null,
      mode: out?.mode || "none",
      isGuestCustomer: !!out?.isGuestCustomer,
    };
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
  if (userId) {
    if (options?.restaurantId) {
      const query = Customer.findOne({ _id: userId, userType: "CUSTOMER", deletedAt: null });
      if (options?.session) query.session(options.session);
      const customerDoc = await query;
      if (customerDoc && applyCustomerRestaurantTouch(customerDoc, options.restaurantId)) {
        await customerDoc.save(options?.session ? { session: options.session } : undefined);
      }
    }
    return userId;
  }

  const identity = await resolveOrCreateGuestCustomerForOrder({
    customer,
    selectedUserId: userId,
    requireContact: !!options?.requireContact,
    createIfMissing: options?.createIfMissing ?? true,
    session: options?.session || null,
    restaurantId: options?.restaurantId || null,
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
