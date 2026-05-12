// graphql/resolvers/order/helper/userUtils.js
import mongoose from "mongoose";
import { Customer, Table } from "../../../../models/index.js";

import { toId } from "./orderUtils.js";

const GUEST_TTL_DAYS = 30;
const GUEST_TTL_MS = GUEST_TTL_DAYS * 24 * 60 * 60 * 1000;

const buildGuestExpiresAt = () => new Date(Date.now() + GUEST_TTL_MS);

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

async function findCustomerByField(field, value, session = null) {
  if (!value) return null;
  const query = Customer.findOne({ [field]: value }).sort({
    isGuest: 1,
    updatedAt: -1,
  });
  if (session) query.session(session);
  return query;
}

function buildIdentityResult(byEmail, byPhone, selectedUserId) {
  if (selectedUserId) return { userId: selectedUserId, mode: "selected" };

  const emailUserId = byEmail?._id ? String(byEmail._id) : null;
  const phoneUserId = byPhone?._id ? String(byPhone._id) : null;
  if (emailUserId && phoneUserId && emailUserId !== phoneUserId) {
    return { conflict: true, emailUserId, phoneUserId };
  }

  const matchedRegistered = [byEmail, byPhone].find(
    (candidate) => candidate && !candidate.isGuest,
  );
  if (matchedRegistered) {
    return {
      userId: String(matchedRegistered._id),
      mode: "registered",
    };
  }

  return {
    userId: emailUserId || phoneUserId || null,
    mode: emailUserId && phoneUserId
      ? "both"
      : emailUserId
        ? "email"
        : phoneUserId
          ? "phone"
          : "none",
  };
}

export async function resolveCustomerIdentity({
  email,
  phone,
  selectedUserId,
  session = null,
}) {
  if (selectedUserId) return { userId: selectedUserId, mode: "selected" };

  const [byEmail, byPhone] = await Promise.all([
    findCustomerByField("email", email, session),
    findCustomerByField("phone", phone, session),
  ]);

  return buildIdentityResult(byEmail, byPhone, selectedUserId);
}

export async function resolveOrCreateGuestCustomerForOrder({
  customer,
  selectedUserId,
  requireContact = false,
  createIfMissing = true,
  session = null,
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

  const [byEmail, byPhone] = await Promise.all([
    findCustomerByField("email", compact.email, session),
    findCustomerByField("phone", compact.phone, session),
  ]);

  const emailUserId = byEmail?._id ? String(byEmail._id) : null;
  const phoneUserId = byPhone?._id ? String(byPhone._id) : null;
  if (emailUserId && phoneUserId && emailUserId !== phoneUserId) {
    throw new Error(
      "Contact information matches multiple customer profiles. Please contact support.",
    );
  }

  const matchedRegistered = [byEmail, byPhone].find(
    (candidate) => candidate && !candidate.isGuest,
  );
  if (matchedRegistered) {
    return {
      userId: matchedRegistered._id,
      mode: "matched_registered",
      isGuestCustomer: false,
    };
  }

  const matchedGuest = byEmail || byPhone;
  if (matchedGuest) {
    const now = new Date();
    matchedGuest.guestExpiresAt = buildGuestExpiresAt();
    matchedGuest.guestLastSeenAt = now;
    if (compact.fullName) matchedGuest.fullName = compact.fullName;
    if (!matchedGuest.email && compact.email) matchedGuest.email = compact.email;
    if (!matchedGuest.phone && compact.phone) matchedGuest.phone = compact.phone;
    await matchedGuest.save(session ? { session } : undefined);

    return {
      userId: matchedGuest._id,
      mode: "matched_guest",
      isGuestCustomer: true,
    };
  }

  if (!createIfMissing) {
    return { userId: null, mode: "none", isGuestCustomer: false };
  }

  const now = new Date();
  const createdGuest = await Customer.create(
    [
      {
        fullName: compact.fullName || "Khách",
        email: compact.email,
        phone: compact.phone,
        status: "pending",
        customerType: "NEW",
        loyaltyPoints: 0,
        totalOrders: 0,
        totalSpending: 0,
        isGuest: true,
        guestExpiresAt: buildGuestExpiresAt(),
        guestLastSeenAt: now,
      },
    ],
    session ? { session } : undefined,
  ).then((rows) => rows[0]);

  return {
    userId: createdGuest._id,
    mode: "created_guest",
    isGuestCustomer: true,
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
