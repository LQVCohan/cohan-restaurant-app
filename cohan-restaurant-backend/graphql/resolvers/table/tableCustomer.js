// src/resolvers/tableCustomer.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import {
  Restaurant,
  Role,
  User, // để giống file tableDraft, phòng khi cần sau
  TableCustomer,
} from "../../../models/index.js";

function badInput(message) {
  return new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}
function forbidden(message) {
  return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
}
function notFound(message = "Resource not found") {
  return new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });
}
function toObjectIdOrNull(id) {
  if (!id) return null;
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
}

async function userHasRoleSlug(userDoc, slug) {
  if (!userDoc) return false;
  const want = String(slug).toLowerCase();
  const role = userDoc.role;
  if (!role) return false;

  // nếu role là object embed
  if (
    typeof role === "object" &&
    role !== null &&
    !mongoose.isValidObjectId(role)
  ) {
    const s = (role.slug || role.name || "").toLowerCase();
    return s === want;
  }
  // nếu role là ObjectId
  if (mongoose.isValidObjectId(role)) {
    const roleDoc = await Role.findById(role).lean();
    const s = (roleDoc?.slug || roleDoc?.name || "").toLowerCase();
    return s === want;
  }
  // nếu role là string
  if (typeof role === "string") {
    return role.toLowerCase() === want;
  }
  return false;
}

function isAdmin(user) {
  return (
    !!user &&
    (user.roleName?.toLowerCase?.() === "admin" ||
      user.role === "admin" ||
      user.role?.slug?.toLowerCase?.() === "admin")
  );
}

async function isStaff(userDoc) {
  if (!userDoc) return false;
  const roleName = String(
    userDoc?.roleName ||
      userDoc?.role?.slug ||
      userDoc?.role?.name ||
      userDoc?.userType ||
      ""
  ).toLowerCase();
  if (roleName === "staff") return true;
  return userHasRoleSlug(userDoc, "staff");
}

async function isManager(user) {
  const me = user;
  return (
    !!me &&
    (me.role?.name?.toLowerCase?.() === "manager" ||
      (await userHasRoleSlug(me, "manager")))
  );
}

async function assertCanWriteRestaurant(user, restaurantId) {
  if (!user) throw forbidden("Unauthorized");
  if (isAdmin(user)) return true;

  const rid = toObjectIdOrNull(restaurantId);
  if (!rid) throw badInput("Invalid restaurantId");

  const staff = await isStaff(user);
  if (staff) {
    const scopedRid =
      user?.restaurantForStaff || user?.primaryRestaurantId || null;
    if (!scopedRid) throw forbidden("Staff chưa được phân nhà hàng");
    if (String(scopedRid) !== String(rid)) {
      throw forbidden("You can only modify your assigned restaurant");
    }
    return true;
  }

  const manager = await isManager(user);
  if (!manager) throw forbidden("Insufficient permission");

  const r = await Restaurant.findById(rid).lean();
  if (!r) throw notFound("Restaurant not found");
  if (String(r.managerId) !== String(user.user?.id || user.id)) {
    throw forbidden("You can only modify your own restaurant");
  }
  return true;
}

/* ============================ Queries ============================ */

/**
 * Lấy thông tin khách cho 1 bàn
 * Ưu tiên: tableId > tableCode
 */
async function tableCustomer(_, { restaurantId, tableId, tableCode }, { user }) {
  await assertCanWriteRestaurant(user, restaurantId);

  if (!tableId && !tableCode) {
    throw badInput("tableId hoặc tableCode là bắt buộc");
  }

  const rid = toObjectIdOrNull(restaurantId);
  const tid = toObjectIdOrNull(tableId);

  const cond =
    tid != null
      ? { restaurantId: rid, tableId: tid }
      : { restaurantId: rid, tableCode: String(tableCode) };

  const doc = await TableCustomer.findOne(cond).lean();

  return doc ? { id: String(doc._id), ...doc } : null;
}

/**
 * Lấy toàn bộ khách theo nhà hàng
 */
async function tableCustomersByRestaurant(_, { restaurantId }, { user }) {
  await assertCanWriteRestaurant(user, restaurantId);
  const rid = toObjectIdOrNull(restaurantId);

  const rows = await TableCustomer.find({ restaurantId: rid })
    .sort({ updatedAt: -1 })
    .lean();
  return rows.map((d) => ({ id: String(d._id), ...d }));
}

/* ============================ Mutations ============================ */

async function upsertTableCustomer(_, { input }, _ctx) {
  const {
    restaurantId,
    tableId,
    tableCode,
    customerName,
    customerPhone,
    customerEmail,
    customerUserId,
    note,
    dietaryNotes,
    customerPreferences,
    partySize,
    timeTo,
  } = input || {};

  await assertCanWriteRestaurant(_ctx?.user, restaurantId);

  if (!tableId && !tableCode) {
    throw badInput("tableId hoặc tableCode là bắt buộc");
  }

  const rid = toObjectIdOrNull(restaurantId);
  const tid = toObjectIdOrNull(tableId);

  // Điều kiện unique: ưu tiên tableId > tableCode
  const cond =
    tid != null
      ? { restaurantId: rid, tableId: tid }
      : { restaurantId: rid, tableCode: String(tableCode) };

  const update = {
    $set: {
      restaurantId: rid,
      ...(tid != null ? { tableId: tid } : {}),
      ...(tableCode ? { tableCode: String(tableCode) } : {}),

      customerName: customerName ?? null,
      customerPhone: customerPhone ?? null,
      customerEmail: customerEmail ?? null,
      customerUserId: toObjectIdOrNull(customerUserId),
      note: note ?? null,
      dietaryNotes: dietaryNotes ?? null,
      customerPreferences: customerPreferences ?? null,
      partySize: partySize ?? null,
      timeTo: timeTo ? new Date(timeTo) : null,

      updatedAt: new Date(),
    },
    $setOnInsert: {
      createdAt: new Date(),
    },
  };

  const doc = await TableCustomer.findOneAndUpdate(cond, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  }).lean();

  return { id: String(doc._id), ...doc };
}

async function deleteTableCustomer(
  _,
  { restaurantId, tableId, tableCode },
  { user }
) {
  await assertCanWriteRestaurant(user, restaurantId);
  if (!tableId && !tableCode) {
    throw badInput("tableId hoặc tableCode là bắt buộc");
  }

  const rid = toObjectIdOrNull(restaurantId);
  const tid = toObjectIdOrNull(tableId);

  const cond =
    tid != null
      ? { restaurantId: rid, tableId: tid }
      : { restaurantId: rid, tableCode: String(tableCode) };

  const res = await TableCustomer.deleteOne(cond);
  return res?.deletedCount > 0;
}

async function clearTableCustomers(_, { restaurantId }, { user }) {
  await assertCanWriteRestaurant(user, restaurantId);
  const rid = toObjectIdOrNull(restaurantId);
  const res = await TableCustomer.deleteMany({ restaurantId: rid });
  return res?.acknowledged === true;
}

export const TableCustomerQuery = {
  tableCustomer,
  tableCustomersByRestaurant,
};

export const TableCustomerMutation = {
  upsertTableCustomer,
  deleteTableCustomer,
  clearTableCustomers,
};
