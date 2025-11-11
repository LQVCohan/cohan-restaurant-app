// src/resolvers/tableDraft.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Restaurant, Role, User, TableDraft } from "../../../models/index.js";

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

  if (
    typeof role === "object" &&
    role !== null &&
    !mongoose.isValidObjectId(role)
  ) {
    const s = (role.slug || role.name || "").toLowerCase();
    return s === want;
  }
  if (mongoose.isValidObjectId(role)) {
    const roleDoc = await Role.findById(role).lean();
    const s = (roleDoc?.slug || roleDoc?.name || "").toLowerCase();
    return s === want;
  }
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
async function isManager(user) {
  const me = user.user;
  return (
    !!me &&
    (me.role?.name?.toLowerCase?.() === "manager" ||
      (await userHasRoleSlug(me, "manager")))
  );
}

async function assertCanWriteRestaurant(user, restaurantId) {
  console.log("----------------------");
  console.log("ctx: ", user);
  console.log("----------------------");
  if (!user) throw forbidden("Unauthorized");
  if (isAdmin(user)) return true;

  const manager = await isManager(user);
  if (!manager) throw forbidden("Insufficient permission");

  const rid = toObjectIdOrNull(restaurantId);
  if (!rid) throw badInput("Invalid restaurantId");

  const r = await Restaurant.findById(rid).lean();
  if (!r) throw notFound("Restaurant not found");
  if (String(r.managerId) !== String(user.user.id)) {
    throw forbidden("You can only modify your own restaurant");
  }
  return true;
}

/* ============================ Queries ============================ */

async function tableDraft(_, { restaurantId, tableId, tableCode }, { user }) {
  await assertCanWriteRestaurant(user, restaurantId);

  if (!tableId && !tableCode) {
    throw badInput("tableId or tableCode is required");
  }

  const rid = toObjectIdOrNull(restaurantId);
  const tid = toObjectIdOrNull(tableId);

  const doc = await TableDraft.findOne(
    tid
      ? { restaurantId: rid, tableId: tid }
      : { restaurantId: rid, tableCode: String(tableCode) }
  ).lean();

  return doc ? { id: String(doc._id), ...doc } : null;
}

async function tableDraftsByRestaurant(_, { restaurantId }, { user }) {
  await assertCanWriteRestaurant(user, restaurantId);
  const rid = toObjectIdOrNull(restaurantId);

  const rows = await TableDraft.find({ restaurantId: rid })
    .sort({ updatedAt: -1 })
    .lean();
  return rows.map((d) => ({ id: String(d._id), ...d }));
}

/* ============================ Mutations ============================ */

async function upsertTableDraft(_, { input }, _ctx) {
  const {
    restaurantId,
    tableId,
    tableCode,
    customerName,
    customerPhone,
    customerEmail,
    note,
    partySize,
    timeTo,
    ttlHours,
  } = input || {};

  await assertCanWriteRestaurant(_ctx, restaurantId);

  if (!tableId && !tableCode) {
    throw badInput("tableId or tableCode is required");
  }

  const rid = toObjectIdOrNull(restaurantId);
  const tid = toObjectIdOrNull(tableId);

  // TTL mặc định 72h
  const ttl = Number.isFinite(Number(ttlHours))
    ? Math.max(1, Number(ttlHours))
    : 72;
  const expiresAt = new Date(Date.now() + ttl * 3600 * 1000);

  // Điều kiện unique
  const cond = tid
    ? { restaurantId: rid, tableId: tid }
    : { restaurantId: rid, tableCode: String(tableCode) };

  const update = {
    $set: {
      restaurantId: rid,
      ...(tid ? { tableId: tid } : { tableCode: String(tableCode) }),
      customerName: customerName ?? null,
      customerPhone: customerPhone ?? null,
      customerEmail: customerEmail ?? null,
      note: note ?? null,
      partySize: partySize ?? null,
      timeTo: timeTo ? new Date(timeTo) : null,
      expiresAt,
      updatedAt: new Date(),
    },
    $setOnInsert: {
      createdAt: new Date(),
    },
  };

  const doc = await TableDraft.findOneAndUpdate(cond, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  }).lean();

  return { id: String(doc._id), ...doc };
}

async function deleteTableDraft(
  _,
  { restaurantId, tableId, tableCode },
  { user }
) {
  await assertCanWriteRestaurant(user, restaurantId);
  if (!tableId && !tableCode)
    throw badInput("tableId or tableCode is required");

  const rid = toObjectIdOrNull(restaurantId);
  const tid = toObjectIdOrNull(tableId);

  const res = await TableDraft.deleteOne(
    tid
      ? { restaurantId: rid, tableId: tid }
      : { restaurantId: rid, tableCode: String(tableCode) }
  );

  return res?.deletedCount > 0;
}

async function clearTableDrafts(_, { restaurantId }, { user }) {
  await assertCanWriteRestaurant(user, restaurantId);
  const rid = toObjectIdOrNull(restaurantId);
  const res = await TableDraft.deleteMany({ restaurantId: rid });
  return res?.acknowledged === true;
}

export const TableDraftQuery = {
  tableDraft,
  tableDraftsByRestaurant,
};

export const TableDraftMutation = {
  upsertTableDraft,
  deleteTableDraft,
  clearTableDrafts,
};
