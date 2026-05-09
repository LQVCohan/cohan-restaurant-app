// src/resolvers/tableCustomer.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { requireRestaurantAccess } from "../../guards.js";
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

function toObjectIdOrNull(id) {
  if (!id) return null;
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
}

async function assertCanWriteRestaurant(user, restaurantId) {
  if (!user) throw forbidden("Unauthorized");

  const rid = toObjectIdOrNull(restaurantId);
  if (!rid) throw badInput("Invalid restaurantId");

  await requireRestaurantAccess({ user }, rid);
  return true;
}

/* ============================ Queries ============================ */

/**
 * Lấy thông tin khách cho 1 bàn
 * Ưu tiên: tableId > tableCode
 */
async function tableCustomer(
  _,
  { restaurantId, tableId, tableCode },
  { user },
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
  { user },
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
