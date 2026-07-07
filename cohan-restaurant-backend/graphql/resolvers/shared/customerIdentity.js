import mongoose from "mongoose";
import { Customer } from "../../../models/index.js";

const GUEST_TTL_DAYS = 30;
const GUEST_TTL_MS = GUEST_TTL_DAYS * 24 * 60 * 60 * 1000;

export const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const BASIC_PHONE_REGEX = /^0\d{9,10}$/;

export const buildGuestExpiresAt = () => new Date(Date.now() + GUEST_TTL_MS);

export function normalizeCustomerEmail(value) {
  const v = String(value || "").trim().toLowerCase();
  return v || undefined;
}

export function normalizeCustomerPhone(value) {
  let v = String(value || "").trim();
  if (!v) return undefined;
  v = v.replace(/\s+/g, "");
  if (v.startsWith("+84")) v = `0${v.slice(3)}`;
  else if (v.startsWith("84")) v = `0${v.slice(2)}`;
  return v || undefined;
}

export function compactCustomerContact(input = {}) {
  const customerName = String(input?.customerName || input?.fullName || input?.name || "").trim() || undefined;
  const email = normalizeCustomerEmail(input?.email ?? input?.customerEmail);
  const phone = normalizeCustomerPhone(input?.phone ?? input?.customerPhone);
  return { customerName, email, phone };
}

async function findOneByField(field, value, session = null) {
  if (!value) return null;
  const q = Customer.findOne({ [field]: value }).sort({ isGuest: 1, updatedAt: -1 });
  if (session) q.session(session);
  return q;
}

export const RECENT_RESTAURANT_LIMIT = 12;

export function normalizeRecentRestaurantIds(refRestaurants = [], restaurantId) {
  if (!mongoose.isValidObjectId(restaurantId)) return null;
  const latest = String(restaurantId);
  return [
    latest,
    ...refRestaurants.map(String).filter((id) => mongoose.isValidObjectId(id) && id !== latest),
  ].slice(0, RECENT_RESTAURANT_LIMIT);
}

export async function touchRecentRestaurant(customer, restaurantId, { session = null } = {}) {
  if (!customer || !mongoose.isValidObjectId(restaurantId)) return false;
  const next = normalizeRecentRestaurantIds(customer.refRestaurants || [], restaurantId);
  if (!next) return false;
  const current = (customer.refRestaurants || []).map(String).slice(0, RECENT_RESTAURANT_LIMIT);
  if (current.length === next.length && current.every((id, index) => id === next[index])) return false;
  customer.refRestaurants = next.map((id) => new mongoose.Types.ObjectId(id));
  await customer.save(session ? { session } : undefined);
  return true;
}

export function ensureCustomerRestaurant(customer, restaurantId) {
  if (!restaurantId || !customer) return false;
  const id = String(restaurantId);
  const refs = Array.isArray(customer.customerRestaurants) ? customer.customerRestaurants.map(String) : [];
  if (refs.includes(id)) return false;
  customer.customerRestaurants = [...refs, id];
  return true;
}

export async function findCustomerByContact({ email, phone, session = null }) {
  const [byEmail, byPhone] = await Promise.all([
    findOneByField("email", email, session),
    findOneByField("phone", phone, session),
  ]);
  return { byEmail, byPhone };
}

export async function resolveCustomerIdentityByContact({
  email,
  phone,
  selectedUserId,
  customerName,
  createIfMissing = false,
  session = null,
  restaurantId,
  guestFallbackName = "Khách",
  fillGuestProfile = true,
  touchGuestOnMatch = true,
  touchRecentOnMatch = true,
  addCustomerRestaurant = true,
}) {
  if (selectedUserId) {
    if (restaurantId && (touchRecentOnMatch || addCustomerRestaurant)) {
      const selected = await Customer.findById(selectedUserId);
      if (selected) {
        if (addCustomerRestaurant) ensureCustomerRestaurant(selected, restaurantId);
        if (touchRecentOnMatch) {
          await touchRecentRestaurant(selected, restaurantId, { session });
        } else if (addCustomerRestaurant) {
          await selected.save(session ? { session } : undefined);
        }
      }
    }
    return { userId: selectedUserId, isGuestCustomer: false, mode: "selected" };
  }

  const { byEmail, byPhone } = await findCustomerByContact({ email, phone, session });
  const emailUserId = byEmail?._id ? String(byEmail._id) : null;
  const phoneUserId = byPhone?._id ? String(byPhone._id) : null;

  if (emailUserId && phoneUserId && emailUserId !== phoneUserId) {
    return {
      userId: null,
      isGuestCustomer: false,
      mode: "none",
      conflict: { emailUserId, phoneUserId },
    };
  }

  const matchedRegistered = [byEmail, byPhone].find((u) => u && !u.isGuest);
  if (matchedRegistered) {
    if (touchRecentOnMatch && restaurantId) {
      const changedRelation = addCustomerRestaurant && ensureCustomerRestaurant(matchedRegistered, restaurantId);
      if (changedRelation) await matchedRegistered.save(session ? { session } : undefined);
      await touchRecentRestaurant(matchedRegistered, restaurantId, { session });
    }
    return {
      user: matchedRegistered,
      userId: matchedRegistered._id,
      isGuestCustomer: false,
      mode: "matched_registered",
      customerName: customerName || matchedRegistered.fullName || "",
      customerPhone: phone || matchedRegistered.phone || "",
      customerEmail: email || matchedRegistered.email || "",
    };
  }

  const matchedGuest = byEmail || byPhone;
  if (matchedGuest) {
    if (touchGuestOnMatch) {
      matchedGuest.guestExpiresAt = buildGuestExpiresAt();
      matchedGuest.guestLastSeenAt = new Date();
      if (customerName) matchedGuest.fullName = customerName;
      if (fillGuestProfile && !matchedGuest.email && email) matchedGuest.email = email;
      if (fillGuestProfile && !matchedGuest.phone && phone) matchedGuest.phone = phone;
      if (addCustomerRestaurant) ensureCustomerRestaurant(matchedGuest, restaurantId);
      await matchedGuest.save(session ? { session } : undefined);
      if (touchRecentOnMatch && restaurantId) await touchRecentRestaurant(matchedGuest, restaurantId, { session });
    }

    return {
      user: matchedGuest,
      userId: matchedGuest._id,
      isGuestCustomer: true,
      mode: "matched_guest",
      customerName: customerName || matchedGuest.fullName || "",
      customerPhone: phone || matchedGuest.phone || "",
      customerEmail: email || matchedGuest.email || "",
    };
  }

  if (!createIfMissing) {
    return { userId: null, isGuestCustomer: false, mode: "none" };
  }

  const now = new Date();
  const createdGuest = await Customer.create(
    [{
      fullName: customerName || guestFallbackName,
      email,
      phone,
      status: "pending",
      customerType: "NEW",
      loyaltyPoints: 0,
      totalOrders: 0,
      totalSpending: 0,
      isGuest: true,
      guestExpiresAt: buildGuestExpiresAt(),
      guestLastSeenAt: now,
      ...(restaurantId ? {
        refRestaurants: [restaurantId],
        ...(addCustomerRestaurant ? { customerRestaurants: [restaurantId] } : {}),
      } : {}),
    }],
    session ? { session } : undefined,
  ).then((rows) => rows[0]);

  return {
    user: createdGuest,
    userId: createdGuest._id,
    isGuestCustomer: true,
    mode: "created_guest",
    customerName: createdGuest.fullName || "",
    customerPhone: createdGuest.phone || "",
    customerEmail: createdGuest.email || "",
  };
}

export async function resolveOrCreateGuestCustomer(params) {
  return resolveCustomerIdentityByContact({ ...params, createIfMissing: true });
}
