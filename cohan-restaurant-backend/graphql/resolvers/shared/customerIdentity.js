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
  const seen = new Set([latest]);
  const rest = [];
  for (const value of refRestaurants || []) {
    const id = String(value);
    if (!mongoose.isValidObjectId(id) || seen.has(id)) continue;
    seen.add(id);
    rest.push(id);
  }
  return [latest, ...rest].slice(0, RECENT_RESTAURANT_LIMIT);
}

export function applyRecentRestaurant(customer, restaurantId) {
  if (!customer || !mongoose.isValidObjectId(restaurantId)) return false;
  const next = normalizeRecentRestaurantIds(customer.refRestaurants || [], restaurantId);
  if (!next) return false;
  const current = (customer.refRestaurants || []).map(String);
  if (current.length === next.length && current.every((id, index) => id === next[index])) return false;
  customer.refRestaurants = next.map((id) => new mongoose.Types.ObjectId(id));
  return true;
}

export function ensureCustomerRestaurant(customer, restaurantId) {
  if (!mongoose.isValidObjectId(restaurantId) || !customer) return false;
  const id = String(restaurantId);
  const refs = [];
  const seen = new Set();
  for (const value of customer.customerRestaurants || []) {
    const current = String(value);
    if (!mongoose.isValidObjectId(current) || seen.has(current)) continue;
    seen.add(current);
    refs.push(current);
  }
  if (!seen.has(id)) {
    refs.push(id);
    seen.add(id);
  }
  const current = (customer.customerRestaurants || []).map(String);
  if (current.length === refs.length && current.every((item, index) => item === refs[index])) return false;
  customer.customerRestaurants = refs.map((item) => new mongoose.Types.ObjectId(item));
  return true;
}

export function applyCustomerRestaurantTouch(customer, restaurantId, {
  touchRecentOnMatch = true,
  addCustomerRestaurant = true,
} = {}) {
  const recentChanged = touchRecentOnMatch ? applyRecentRestaurant(customer, restaurantId) : false;
  const membershipChanged = addCustomerRestaurant ? ensureCustomerRestaurant(customer, restaurantId) : false;
  return recentChanged || membershipChanged;
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
    const query = Customer.findOne({ _id: selectedUserId, userType: "CUSTOMER", deletedAt: null });
    if (session) query.session(session);
    const selected = await query;
    if (!selected) return { userId: null, isGuestCustomer: false, mode: "none" };
    if (
      restaurantId &&
      applyCustomerRestaurantTouch(selected, restaurantId, { touchRecentOnMatch, addCustomerRestaurant })
    ) {
      await selected.save(session ? { session } : undefined);
    }
    return { user: selected, userId: selected._id, isGuestCustomer: !!selected.isGuest, mode: "selected" };
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
    if (
      restaurantId &&
      applyCustomerRestaurantTouch(matchedRegistered, restaurantId, { touchRecentOnMatch, addCustomerRestaurant })
    ) {
      await matchedRegistered.save(session ? { session } : undefined);
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
      if (restaurantId) {
        applyCustomerRestaurantTouch(matchedGuest, restaurantId, { touchRecentOnMatch, addCustomerRestaurant });
      }
      await matchedGuest.save(session ? { session } : undefined);
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
  const guestPayload = {
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
  };
  if (mongoose.isValidObjectId(restaurantId)) {
    if (touchRecentOnMatch) guestPayload.refRestaurants = [restaurantId];
    if (addCustomerRestaurant) guestPayload.customerRestaurants = [restaurantId];
  }

  const createdGuest = await Customer.create(
    [guestPayload],
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
