import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import Table from "../../../models/table.model.js";
import { logEvent } from "../../../src/services/eventLog.service.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import {
  hasActiveOrdersForTable,
  hasActiveReservationsForTable,
} from "../../../utils/tableStateGuards.js";

const businessError = (message, code) =>
  new GraphQLError(message, { extensions: { code } });

const tableId = (value) => String(value?._id || value?.id || value || "");
const MERGEABLE_STATUSES = new Set(["available", "occupied"]);

const mergedCodeFor = (tables) =>
  tables
    .map((table) => String(table.code || "").trim())
    .filter(Boolean)
    .sort((a, b) =>
      a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" }),
    )
    .join("+");

const uniqueTags = (tables) =>
  Array.from(
    new Set(
      tables.flatMap((table) =>
        Array.isArray(table.tags)
          ? table.tags.map((tag) => String(tag || "").trim()).filter(Boolean)
          : [],
      ),
    ),
  );

const assertTablesCanMerge = async (tables, restaurantId) => {
  const unavailable = tables.find(
    (table) =>
      !MERGEABLE_STATUSES.has(String(table.status || "").toLowerCase()),
  );
  if (unavailable) {
    throw businessError(
      `Bàn ${unavailable.code || "đã chọn"} không ở trạng thái có thể ghép. Chỉ hỗ trợ bàn trống hoặc đang có khách nhưng chưa phát sinh order/đặt chỗ.`,
      "TABLE_NOT_AVAILABLE_FOR_MERGE",
    );
  }

  const states = await Promise.all(
    tables.map(async (table) => {
      const [hasOrders, hasReservations] = await Promise.all([
        hasActiveOrdersForTable({
          restaurantId,
          tableId: table._id,
          tableCode: table.code,
        }),
        hasActiveReservationsForTable({
          restaurantId,
          tableId: table._id,
        }),
      ]);
      return { table, hasOrders, hasReservations };
    }),
  );

  const withOrders = states.find((state) => state.hasOrders);
  if (withOrders) {
    throw businessError(
      `Bàn ${withOrders.table.code || "đã chọn"} đang có order hoạt động, không thể ghép.`,
      "TABLE_HAS_ACTIVE_ORDERS",
    );
  }

  const withReservation = states.find((state) => state.hasReservations);
  if (withReservation) {
    throw businessError(
      `Bàn ${withReservation.table.code || "đã chọn"} đang có đặt chỗ hoạt động, không thể ghép.`,
      "TABLE_HAS_ACTIVE_RESERVATION",
    );
  }
};

const rollbackMergedSources = async ({ restaurantId, mergedTableId }) => {
  if (!mergedTableId) return;
  await Table.updateMany(
    { restaurantId, mergedIntoTableId: mergedTableId },
    {
      $set: { isJoinable: false },
      $unset: { joinGroupId: "", mergedIntoTableId: "" },
    },
  ).catch(() => {});
};

const mergeTables = async (_parent, { input }, ctx) => {
  const { restaurantId, tableIds, anchorId, joinGroupId } = input;

  if (!mongoose.isValidObjectId(restaurantId)) {
    throw businessError("Invalid restaurantId", "BAD_USER_INPUT");
  }
  if (!Array.isArray(tableIds) || tableIds.length < 2) {
    throw businessError("Cần ít nhất 2 bàn để ghép.", "BAD_USER_INPUT");
  }
  if (!tableIds.every(mongoose.isValidObjectId)) {
    throw businessError("Invalid tableIds", "BAD_USER_INPUT");
  }
  if (!mongoose.isValidObjectId(anchorId)) {
    throw businessError("Invalid anchorId", "BAD_USER_INPUT");
  }

  const uniqueIds = Array.from(new Set(tableIds.map(String)));
  if (uniqueIds.length !== tableIds.length) {
    throw businessError("Danh sách bàn ghép bị trùng.", "BAD_USER_INPUT");
  }
  if (!uniqueIds.includes(String(anchorId))) {
    throw businessError("anchorId must belong to tableIds", "BAD_USER_INPUT");
  }

  await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.TABLE_WRITE);

  const tables = await Table.find({
    _id: { $in: uniqueIds },
    restaurantId,
  }).lean();

  if (tables.length !== uniqueIds.length) {
    throw businessError(
      "Có bàn không tồn tại hoặc không thuộc nhà hàng này.",
      "TABLE_NOT_FOUND",
    );
  }

  const floorIds = new Set(tables.map((table) => String(table.floorId || "")));
  if (floorIds.size !== 1) {
    throw businessError(
      "Chỉ có thể ghép các bàn trong cùng một tầng.",
      "TABLE_MERGE_CROSS_FLOOR",
    );
  }

  const alreadyMerged = tables.find(
    (table) =>
      table.joinGroupId ||
      table.mergedIntoTableId ||
      (Array.isArray(table.mergedFromTableIds) && table.mergedFromTableIds.length > 0),
  );
  if (alreadyMerged) {
    throw businessError(
      `Bàn ${alreadyMerged.code || "đã chọn"} đang thuộc một nhóm ghép. Vui lòng tách bàn trước.`,
      "TABLE_ALREADY_MERGED",
    );
  }

  await assertTablesCanMerge(tables, restaurantId);

  const anchor = tables.find((table) => tableId(table) === String(anchorId));
  const groupId = joinGroupId || new mongoose.Types.ObjectId().toString();
  const mergedCode = mergedCodeFor(tables);
  const capacity = tables.reduce(
    (total, table) => total + Math.max(0, Number(table.capacity) || 0),
    0,
  );
  const mergedStatus = tables.some(
    (table) => String(table.status || "").toLowerCase() === "occupied",
  )
    ? "occupied"
    : "available";

  if (!mergedCode || capacity < 2 || !anchor?.position) {
    throw businessError(
      "Dữ liệu bàn không hợp lệ để tạo bàn ghép.",
      "TABLE_MERGE_INVALID_SOURCE",
    );
  }

  let mergedTable = null;
  try {
    mergedTable = await Table.create({
      restaurantId,
      floorId: anchor.floorId,
      code: mergedCode,
      type: anchor.type || "standard",
      capacity,
      position: anchor.position,
      status: mergedStatus,
      floorLevel: anchor.floorLevel ?? 1,
      tags: uniqueTags(tables),
      zone: anchor.zone,
      deposit: anchor.deposit,
      isJoinable: true,
      joinGroupId: groupId,
      mergedFromTableIds: uniqueIds,
    });

    const mergedTableId = mergedTable._id || mergedTable.id;
    const updated = await Table.updateMany(
      {
        _id: { $in: uniqueIds },
        restaurantId,
        joinGroupId: null,
        mergedIntoTableId: null,
      },
      {
        $set: {
          isJoinable: true,
          joinGroupId: groupId,
          mergedIntoTableId: mergedTableId,
        },
      },
    );

    if (
      Number.isInteger(updated?.modifiedCount) &&
      updated.modifiedCount !== uniqueIds.length
    ) {
      throw businessError(
        "Danh sách bàn vừa thay đổi. Vui lòng tải lại và ghép lại.",
        "TABLE_MERGE_WRITE_CONFLICT",
      );
    }
  } catch (error) {
    const mergedTableId = mergedTable?._id || mergedTable?.id;
    await rollbackMergedSources({ restaurantId, mergedTableId });
    if (mergedTableId) {
      await Table.deleteOne({ _id: mergedTableId }).catch(() => {});
    }
    if (error?.code === 11000) {
      throw businessError(
        `Bàn ghép ${mergedCode} đã tồn tại. Vui lòng tải lại danh sách bàn.`,
        "TABLE_CODE_DUPLICATE",
      );
    }
    throw error;
  }

  const mergedTableId = mergedTable._id || mergedTable.id;
  await logEvent({
    restaurantId,
    floorId: anchor.floorId,
    tableId: mergedTableId,
    verb: "table.merge",
    object: { kind: "Table", id: mergedTableId, code: mergedCode },
    meta: {
      joinGroupId: groupId,
      sourceTableIds: uniqueIds,
      sourceCodes: tables.map((table) => table.code),
      sourceAnchorId: anchorId,
      mergedTableId,
      capacity,
      status: mergedStatus,
    },
    actorUserId: ctx.user?.id,
    ip: ctx.req?.ip,
    userAgent: ctx.req?.headers?.["user-agent"],
  });

  return {
    joinGroupId: groupId,
    anchorId,
    tableIds: uniqueIds,
  };
};

const splitCompositeTable = async ({
  restaurantId,
  joinGroupId,
  mergedTable,
  ctx,
}) => {
  const mergedTableId = mergedTable._id || mergedTable.id;
  const sourceIds = Array.from(
    new Set((mergedTable.mergedFromTableIds || []).map(String).filter(Boolean)),
  );

  if (sourceIds.length < 2) {
    throw businessError(
      "Nhóm bàn ghép không còn đủ dữ liệu bàn gốc.",
      "TABLE_MERGE_SOURCE_MISSING",
    );
  }

  const [hasOrders, hasReservations] = await Promise.all([
    hasActiveOrdersForTable({
      restaurantId,
      tableId: mergedTableId,
      tableCode: mergedTable.code,
    }),
    hasActiveReservationsForTable({
      restaurantId,
      tableId: mergedTableId,
    }),
  ]);
  if (hasOrders) {
    throw businessError(
      "Không thể tách bàn ghép đang có order hoạt động.",
      "TABLE_HAS_ACTIVE_ORDERS",
    );
  }
  if (hasReservations) {
    throw businessError(
      "Không thể tách bàn ghép đang có đặt chỗ hoạt động.",
      "TABLE_HAS_ACTIVE_RESERVATION",
    );
  }

  const restoreSources = () =>
    Table.updateMany(
      {
        _id: { $in: sourceIds },
        restaurantId,
        mergedIntoTableId: mergedTableId,
      },
      {
        $set: { isJoinable: false },
        $unset: { joinGroupId: "", mergedIntoTableId: "" },
      },
    );

  const hideSourcesAgain = () =>
    Table.updateMany(
      { _id: { $in: sourceIds }, restaurantId },
      {
        $set: {
          isJoinable: true,
          joinGroupId,
          mergedIntoTableId: mergedTableId,
        },
      },
    ).catch(() => {});

  const restored = await restoreSources();
  if (
    Number.isInteger(restored?.modifiedCount) &&
    restored.modifiedCount !== sourceIds.length
  ) {
    await hideSourcesAgain();
    throw businessError(
      "Không thể khôi phục đầy đủ các bàn gốc.",
      "TABLE_SPLIT_WRITE_CONFLICT",
    );
  }

  const deleted = await Table.deleteOne({
    _id: mergedTableId,
    restaurantId,
    joinGroupId,
  });
  if (deleted.deletedCount !== 1) {
    await hideSourcesAgain();
    throw businessError(
      "Không thể xóa bàn ghép để hoàn tất tách bàn.",
      "TABLE_SPLIT_WRITE_CONFLICT",
    );
  }

  await logEvent({
    restaurantId,
    floorId: mergedTable.floorId,
    tableId: mergedTableId,
    verb: "table.split",
    object: { kind: "Table", id: mergedTableId, code: mergedTable.code },
    meta: {
      joinGroupId,
      removedMergedTableId: mergedTableId,
      restoredTableIds: sourceIds,
    },
    actorUserId: ctx.user?.id,
    ip: ctx.req?.ip,
    userAgent: ctx.req?.headers?.["user-agent"],
  });

  return { ok: true, unmergedTableIds: sourceIds };
};

const splitTables = async (_parent, { input }, ctx) => {
  const { restaurantId, joinGroupId, mode, tableIds } = input;

  if (!mongoose.isValidObjectId(restaurantId)) {
    throw businessError("Invalid restaurantId", "BAD_USER_INPUT");
  }
  if (!joinGroupId) {
    throw businessError("joinGroupId is required", "BAD_USER_INPUT");
  }
  if (!["ALL", "PARTIAL"].includes(mode)) {
    throw businessError("mode must be ALL or PARTIAL", "BAD_USER_INPUT");
  }
  if (
    mode === "PARTIAL" &&
    (!Array.isArray(tableIds) ||
      tableIds.length === 0 ||
      !tableIds.every(mongoose.isValidObjectId))
  ) {
    throw businessError(
      "tableIds hợp lệ là bắt buộc khi tách một phần.",
      "BAD_USER_INPUT",
    );
  }

  await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.TABLE_WRITE);

  const groupedTables = await Table.find({ restaurantId, joinGroupId }).lean();
  const mergedTable = groupedTables.find(
    (table) =>
      Array.isArray(table.mergedFromTableIds) &&
      table.mergedFromTableIds.length > 0,
  );

  // Bàn ghép mới là một thực thể duy nhất, nên tách từ thực thể này luôn khôi phục cả nhóm.
  if (mergedTable) {
    return splitCompositeTable({
      restaurantId,
      joinGroupId,
      mergedTable,
      ctx,
    });
  }

  // Tương thích với dữ liệu nhóm cũ chỉ có joinGroupId.
  const groupTableIds = groupedTables.map((table) => tableId(table));
  const requestedIds = new Set((tableIds || []).map(String));
  const requestedGroupTableIds =
    mode === "PARTIAL"
      ? groupTableIds.filter((id) => requestedIds.has(id))
      : groupTableIds;
  const remainingCount = groupTableIds.length - requestedGroupTableIds.length;
  const unmergedTableIds =
    mode === "PARTIAL" && remainingCount === 1
      ? groupTableIds
      : requestedGroupTableIds;

  const affected = unmergedTableIds.length
    ? await Table.updateMany(
        {
          restaurantId,
          joinGroupId,
          _id: { $in: unmergedTableIds },
        },
        {
          $set: { isJoinable: false },
          $unset: { joinGroupId: "" },
        },
      )
    : { modifiedCount: 0 };

  await logEvent({
    restaurantId,
    verb: "table.split",
    object: { kind: "Table" },
    meta: {
      joinGroupId,
      mode,
      unmergedCount: affected.modifiedCount || 0,
      tableIds: mode === "PARTIAL" ? tableIds : undefined,
    },
    actorUserId: ctx.user?.id,
    ip: ctx.req?.ip,
    userAgent: ctx.req?.headers?.["user-agent"],
  });

  return { ok: true, unmergedTableIds };
};

const deleteTable = async (_parent, { id }, ctx) => {
  if (!mongoose.isValidObjectId(id)) return false;

  const before = await Table.findById(id).lean({ virtuals: true });
  if (!before) return false;
  await requireRestaurantPermission(ctx, before.restaurantId, PERMISSIONS.TABLE_WRITE);

  if (
    before.mergedIntoTableId ||
    (Array.isArray(before.mergedFromTableIds) && before.mergedFromTableIds.length > 0)
  ) {
    throw businessError(
      "Bàn đang thuộc nhóm ghép. Vui lòng tách bàn trước khi xóa.",
      "TABLE_MERGE_GROUP_ACTIVE",
    );
  }

  const activeOrderExists = await hasActiveOrdersForTable({
    restaurantId: before.restaurantId,
    tableId: before._id,
    tableCode: before.code,
  });
  if (activeOrderExists) {
    throw businessError(
      "Không thể xóa bàn đang có phiên hoặc order hoạt động.",
      "TABLE_HAS_ACTIVE_ORDERS",
    );
  }

  const activeReservationExists = await hasActiveReservationsForTable({
    restaurantId: before.restaurantId,
    tableId: before._id,
  });
  if (activeReservationExists) {
    throw businessError(
      "Không thể xóa bàn đang có đặt chỗ hoạt động.",
      "TABLE_HAS_ACTIVE_RESERVATION",
    );
  }

  const result = await Table.deleteOne({ _id: id });
  if (result.deletedCount > 0) {
    await logEvent({
      restaurantId: before.restaurantId,
      floorId: before.floorId,
      tableId: before._id,
      actorUserId: ctx?.user?.id,
      verb: "table.delete",
      object: { kind: "Table", id: before._id, code: before.code },
      meta: { status: before.status },
      ip: ctx?.req?.ip,
      userAgent: ctx?.req?.headers?.["user-agent"],
    });
  }

  return result.deletedCount > 0;
};

export default { mergeTables, splitTables, deleteTable };
