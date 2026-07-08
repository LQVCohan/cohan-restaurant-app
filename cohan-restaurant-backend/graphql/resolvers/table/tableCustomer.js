// src/resolvers/tableCustomer.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { requireRestaurantAccess } from "../../guards.js";
import { Table, TableCustomer } from "../../../models/index.js";

function badInput(message) {
  return new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}
function forbidden(message) {
  return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
}
function notFound(message) {
  return new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });
}

function toObjectIdOrNull(id) {
  if (!id) return null;
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
}

const normalizeCode = (value) => String(value || "").trim().toLowerCase();
const getId = (value) => String(value?._id || value?.id || value || "");
const serializeCustomer = (doc) =>
  doc ? { ...doc, id: String(doc._id || doc.id) } : null;

async function assertCanWriteRestaurant(user, restaurantId) {
  if (!user) throw forbidden("Unauthorized");

  const rid = toObjectIdOrNull(restaurantId);
  if (!rid) throw badInput("Invalid restaurantId");

  await requireRestaurantAccess({ user }, rid);
  return true;
}

function buildTableLookup(restaurantId, tableId, tableCode) {
  const tid = toObjectIdOrNull(tableId);
  if (tid) return { restaurantId, _id: tid };
  if (tableCode) return { restaurantId, code: String(tableCode) };
  throw badInput("tableId hoặc tableCode là bắt buộc");
}

function buildCustomerLookup(restaurantId, tableId, tableCode) {
  const tid = toObjectIdOrNull(tableId);
  const code = tableCode ? String(tableCode) : null;
  if (tid && code) {
    return {
      restaurantId,
      $or: [{ tableId: tid }, { tableCode: code }],
    };
  }
  if (tid) return { restaurantId, tableId: tid };
  if (code) return { restaurantId, tableCode: code };
  throw badInput("tableId hoặc tableCode là bắt buộc");
}

/* ============================ Queries ============================ */

/**
 * Lấy thông tin khách cho 1 bàn.
 * Client cũ chỉ nhận một hồ sơ nên bàn ghép trả hồ sơ đầu tiên theo mã bàn gốc.
 */
async function tableCustomer(
  _,
  { restaurantId, tableId, tableCode },
  { user },
) {
  await assertCanWriteRestaurant(user, restaurantId);

  const rid = toObjectIdOrNull(restaurantId);
  const doc = await TableCustomer.findOne(
    buildCustomerLookup(rid, tableId, tableCode),
  ).lean();
  if (doc) return serializeCustomer(doc);

  try {
    const group = await tableCustomerGroup(
      _,
      { restaurantId, tableId, tableCode },
      { user },
    );
    return group.profiles.find((profile) => profile.customer)?.customer || null;
  } catch (error) {
    if (error?.extensions?.code === "NOT_FOUND") return null;
    throw error;
  }
}

/**
 * Trả từng hồ sơ khách theo bàn vật lý. Bàn ghép chỉ là lớp hiển thị,
 * dữ liệu khách vẫn thuộc bàn gốc để tách bàn không cần copy/migrate.
 */
async function tableCustomerGroup(
  _,
  { restaurantId, tableId, tableCode },
  { user },
) {
  await assertCanWriteRestaurant(user, restaurantId);

  const rid = toObjectIdOrNull(restaurantId);
  const visibleTable = await Table.findOne(
    buildTableLookup(rid, tableId, tableCode),
  )
    .select({ _id: 1, code: 1, mergedFromTableIds: 1 })
    .lean();

  if (!visibleTable) throw notFound("Không tìm thấy bàn.");

  const mergedSourceIds = Array.isArray(visibleTable.mergedFromTableIds)
    ? visibleTable.mergedFromTableIds.filter(Boolean)
    : [];
  const sourceIds = mergedSourceIds.length
    ? mergedSourceIds
    : [visibleTable._id];

  const sourceTables = await Table.find({
    restaurantId: rid,
    _id: { $in: sourceIds },
  })
    .select({ _id: 1, code: 1 })
    .lean();

  if (sourceTables.length !== sourceIds.length) {
    throw notFound("Không tìm thấy đầy đủ các bàn gốc của bàn ghép.");
  }

  const sourceCodes = sourceTables.map((table) => String(table.code || ""));
  const customerRows = await TableCustomer.find({
    restaurantId: rid,
    $or: [
      { tableId: { $in: sourceIds } },
      { tableCode: { $in: sourceCodes } },
    ],
  })
    .sort({ updatedAt: -1 })
    .lean();

  const profiles = sourceTables
    .slice()
    .sort((a, b) =>
      String(a.code || "").localeCompare(String(b.code || ""), "vi", {
        numeric: true,
        sensitivity: "base",
      }),
    )
    .map((sourceTable) => {
      const sourceId = getId(sourceTable);
      const sourceCode = String(sourceTable.code || "");
      const customer = customerRows.find((row) => {
        if (row.tableId && getId(row.tableId) === sourceId) return true;
        return normalizeCode(row.tableCode) === normalizeCode(sourceCode);
      });
      return {
        sourceTableId: sourceId,
        sourceTableCode: sourceCode,
        customer: serializeCustomer(customer),
      };
    });

  const customerRowsInProfiles = profiles
    .map((profile) => profile.customer)
    .filter(Boolean);

  return {
    tableId: getId(visibleTable),
    tableCode: String(visibleTable.code || ""),
    isMerged: mergedSourceIds.length > 0,
    customerCount: customerRowsInProfiles.length,
    totalPartySize: customerRowsInProfiles.reduce(
      (total, customer) =>
        total + Math.max(0, Number(customer.partySize) || 0),
      0,
    ),
    profiles,
  };
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
  return rows.map(serializeCustomer);
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

  const rid = toObjectIdOrNull(restaurantId);
  const tid = toObjectIdOrNull(tableId);
  const code = tableCode ? String(tableCode) : null;
  const cond = buildCustomerLookup(rid, tableId, tableCode);

  // Tìm theo cả id và code để nâng cấp bản ghi cũ chỉ lưu tableCode,
  // tránh tạo hồ sơ trùng khi chỉnh khách trong bàn ghép.
  const update = {
    $set: {
      restaurantId: rid,
      ...(tid != null ? { tableId: tid } : {}),
      ...(code ? { tableCode: code } : {}),

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

  const hasCustomerIdentity = [
    customerName,
    customerPhone,
    customerEmail,
    customerUserId,
  ].some((value) => String(value || "").trim());

  if (hasCustomerIdentity) {
    await Table.updateOne(
      {
        ...buildTableLookup(rid, tableId, tableCode),
        status: "available",
      },
      { $set: { status: "reserved" } },
    );
  }

  return serializeCustomer(doc);
}

async function deleteTableCustomer(
  _,
  { restaurantId, tableId, tableCode },
  { user },
) {
  await assertCanWriteRestaurant(user, restaurantId);
  const rid = toObjectIdOrNull(restaurantId);
  const res = await TableCustomer.deleteOne(
    buildCustomerLookup(rid, tableId, tableCode),
  );
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
  tableCustomerGroup,
  tableCustomersByRestaurant,
};

export const TableCustomerMutation = {
  upsertTableCustomer,
  deleteTableCustomer,
  clearTableCustomers,
};
