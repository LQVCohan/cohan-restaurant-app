import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import Order from "../../../models/order.model.js";
import Reservation from "../../../models/reservation.model.js";
import Table from "../../../models/table.model.js";
import TableCustomer from "../../../models/tableCustomer.model.js";
import { logEvent } from "../../../src/services/eventLog.service.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import {
  hasActiveOrdersForTable,
  hasActiveReservationsForTable,
} from "../../../utils/tableStateGuards.js";

const ACTIVE_ORDER_STATUSES = { $nin: ["completed", "cancelled", "failed"] };
const ACTIVE_RESERVATION_STATUSES = [
  "pending_payment",
  "confirmed",
  "seated",
  "pending_change",
];
const MERGEABLE_STATUSES = new Set(["available", "occupied", "reserved"]);

const businessError = (message, code) =>
  new GraphQLError(message, { extensions: { code } });

const tableId = (value) => String(value?._id || value?.id || value || "");
const normalizeCode = (value) => String(value || "").trim();

const mergedCodeFor = (tables) =>
  tables
    .map((table) => normalizeCode(table.code))
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
          ? table.tags.map((tag) => normalizeCode(tag)).filter(Boolean)
          : [],
      ),
    ),
  );

const hasCustomerIdentity = (row) =>
  Boolean(
    normalizeCode(row?.customerName) ||
      normalizeCode(row?.customerPhone) ||
      normalizeCode(row?.customerEmail) ||
      row?.customerUserId ||
      Number(row?.partySize || 0) > 0,
  );

const getCompositePosition = (tables, anchor) => {
  const positioned = tables.filter(
    (table) =>
      Number.isFinite(Number(table?.position?.x)) &&
      Number.isFinite(Number(table?.position?.y)),
  );
  if (!positioned.length) return anchor?.position || null;

  const left = Math.min(...positioned.map((table) => Number(table.position.x)));
  const top = Math.min(...positioned.map((table) => Number(table.position.y)));
  const right = Math.max(
    ...positioned.map(
      (table) => Number(table.position.x) + Math.max(1, Number(table.position.w) || 80),
    ),
  );
  const bottom = Math.max(
    ...positioned.map(
      (table) => Number(table.position.y) + Math.max(1, Number(table.position.h) || 80),
    ),
  );

  return {
    x: left,
    y: top,
    w: Math.max(80, right - left),
    h: Math.max(80, bottom - top),
    rotation: 0,
    shape: "rect",
  };
};

const getOrderSessionKey = (order) =>
  String(
    order?.parentOrderId ||
      order?.rootOrderId ||
      (order?.orderKind === "table_session" ? order?._id : "") ||
      order?.parentOrderCode ||
      order?.orderCode ||
      order?._id ||
      "",
  );

const assertTableShapesCanMerge = (tables) => {
  const unavailable = tables.find(
    (table) => !MERGEABLE_STATUSES.has(String(table.status || "").toLowerCase()),
  );
  if (unavailable) {
    throw businessError(
      `Bàn ${unavailable.code || "đã chọn"} không ở trạng thái có thể ghép. Chỉ hỗ trợ bàn trống, đã đặt hoặc đang có khách.`,
      "TABLE_NOT_AVAILABLE_FOR_MERGE",
    );
  }
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

  const session = await mongoose.startSession();
  let outcome = null;

  try {
    await session.withTransaction(async () => {
      const tables = await Table.find({
        _id: { $in: uniqueIds },
        restaurantId,
      })
        .session(session)
        .lean();

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

      assertTableShapesCanMerge(tables);

      const sourceCodes = tables.map((table) => normalizeCode(table.code));
      const tableById = new Map(tables.map((table) => [tableId(table), table]));
      const activeReservations = await Reservation.find({
        restaurantId,
        tableId: { $in: uniqueIds },
        status: { $in: ACTIVE_RESERVATION_STATUSES },
      })
        .session(session)
        .lean();

      const reservationSourceIds = new Set(
        activeReservations.map((reservation) => String(reservation.tableId)),
      );
      if (reservationSourceIds.size > 1) {
        throw businessError(
          "Không thể ghép hai bàn đang có hai đơn đặt bàn hoạt động khác nhau.",
          "TABLE_MULTIPLE_ACTIVE_RESERVATIONS",
        );
      }

      const activeOrders = await Order.find({
        restaurantId,
        tableId: { $in: uniqueIds },
        orderType: "dine_in",
        currentStatus: ACTIVE_ORDER_STATUSES,
      })
        .session(session)
        .select({
          _id: 1,
          orderKind: 1,
          parentOrderId: 1,
          rootOrderId: 1,
          parentOrderCode: 1,
          orderCode: 1,
          tableId: 1,
          tableCode: 1,
          totals: 1,
        })
        .lean();

      const customerRows = await TableCustomer.find({
        restaurantId,
        $or: [
          { tableId: { $in: uniqueIds } },
          { tableCode: { $in: sourceCodes } },
        ],
      })
        .session(session)
        .select({
          customerName: 1,
          customerPhone: 1,
          customerEmail: 1,
          customerUserId: 1,
          partySize: 1,
        })
        .lean();

      const customerProfileCount = customerRows.filter(hasCustomerIdentity).length;
      const anchor = tableById.get(String(anchorId));
      const groupId = joinGroupId || new mongoose.Types.ObjectId().toString();
      const mergedCode = mergedCodeFor(tables);
      const capacity = tables.reduce(
        (total, table) => total + Math.max(0, Number(table.capacity) || 0),
        0,
      );
      const position = getCompositePosition(tables, anchor);
      const hasSeatedReservation = activeReservations.some(
        (reservation) => String(reservation.status).toLowerCase() === "seated",
      );
      const hasOccupiedSource = tables.some(
        (table) => String(table.status || "").toLowerCase() === "occupied",
      );
      const hasReservation = activeReservations.length > 0;
      const mergedStatus =
        activeOrders.length > 0 ||
        hasSeatedReservation ||
        customerProfileCount > 0 ||
        hasOccupiedSource
          ? "occupied"
          : hasReservation ||
              tables.some(
                (table) => String(table.status || "").toLowerCase() === "reserved",
              )
            ? "reserved"
            : "available";

      if (!mergedCode || capacity < 2 || !position || !anchor) {
        throw businessError(
          "Dữ liệu bàn không hợp lệ để tạo bàn ghép.",
          "TABLE_MERGE_INVALID_SOURCE",
        );
      }

      const [mergedTable] = await Table.create(
        [
          {
            restaurantId,
            floorId: anchor.floorId,
            code: mergedCode,
            type: anchor.type || "standard",
            capacity,
            position,
            status: mergedStatus,
            floorLevel: anchor.floorLevel ?? 1,
            tags: uniqueTags(tables),
            zone: anchor.zone,
            deposit: anchor.deposit,
            notes: `Bàn ghép từ ${sourceCodes.join(", ")}`,
            isJoinable: true,
            joinGroupId: groupId,
            mergedFromTableIds: uniqueIds,
            mergeAnchorTableId: anchorId,
            mergedAt: new Date(),
          },
        ],
        { session },
      );

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
        { session },
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

      for (const reservation of activeReservations) {
        const source = tableById.get(String(reservation.tableId));
        await Reservation.updateOne(
          { _id: reservation._id, restaurantId },
          {
            $set: {
              tableId: mergedTableId,
              sourceTableId: reservation.sourceTableId || reservation.tableId,
              sourceTableCode:
                reservation.sourceTableCode || source?.code || null,
              tableMergeGroupId: groupId,
            },
          },
          { session },
        );
      }

      outcome = {
        joinGroupId: groupId,
        anchorId: String(anchorId),
        tableIds: uniqueIds,
        mergedTableId: String(mergedTableId),
        mergedTableCode: mergedCode,
        floorId: anchor.floorId,
        capacity,
        status: mergedStatus,
        sourceCodes,
        customerProfileCount,
        activeReservationCount: activeReservations.length,
        activeOrderCount: activeOrders.filter(
          (order) => order.orderKind !== "table_session",
        ).length,
        activeOrderSessionCount: new Set(activeOrders.map(getOrderSessionKey)).size,
      };
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw businessError(
        "Mã bàn ghép đã tồn tại. Vui lòng tải lại danh sách bàn.",
        "TABLE_CODE_DUPLICATE",
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }

  await logEvent({
    restaurantId,
    floorId: outcome.floorId,
    tableId: outcome.mergedTableId,
    verb: "table.merge",
    object: {
      kind: "Table",
      id: outcome.mergedTableId,
      code: outcome.mergedTableCode,
    },
    meta: {
      joinGroupId: outcome.joinGroupId,
      sourceTableIds: outcome.tableIds,
      sourceCodes: outcome.sourceCodes,
      sourceAnchorId: outcome.anchorId,
      mergedTableId: outcome.mergedTableId,
      capacity: outcome.capacity,
      status: outcome.status,
      customerProfileCount: outcome.customerProfileCount,
      activeReservationCount: outcome.activeReservationCount,
      activeOrderCount: outcome.activeOrderCount,
      activeOrderSessionCount: outcome.activeOrderSessionCount,
    },
    actorUserId: ctx.user?.id,
    ip: ctx.req?.ip,
    userAgent: ctx.req?.headers?.["user-agent"],
  });

  return {
    joinGroupId: outcome.joinGroupId,
    anchorId: outcome.anchorId,
    tableIds: outcome.tableIds,
    mergedTableId: outcome.mergedTableId,
    mergedTableCode: outcome.mergedTableCode,
  };
};

const resolveSourceStatus = ({ sourceId, activeOrders, reservations, customers }) => {
  if (activeOrders.some((order) => String(order.tableId) === String(sourceId))) {
    return "occupied";
  }
  const sourceReservations = reservations.filter(
    (reservation) => String(reservation.tableId) === String(sourceId),
  );
  if (
    sourceReservations.some(
      (reservation) => String(reservation.status).toLowerCase() === "seated",
    )
  ) {
    return "occupied";
  }
  if (
    customers.some(
      (customer) =>
        String(customer.tableId || "") === String(sourceId) &&
        hasCustomerIdentity(customer),
    )
  ) {
    return "occupied";
  }
  return sourceReservations.length ? "reserved" : "available";
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

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const sourceTables = await Table.find({
        _id: { $in: sourceIds },
        restaurantId,
        mergedIntoTableId: mergedTableId,
      })
        .session(session)
        .lean();
      if (sourceTables.length !== sourceIds.length) {
        throw businessError(
          "Không thể khôi phục đầy đủ các bàn gốc.",
          "TABLE_SPLIT_WRITE_CONFLICT",
        );
      }

      const sourceById = new Map(
        sourceTables.map((table) => [tableId(table), table]),
      );
      const fallbackSourceId = String(
        mergedTable.mergeAnchorTableId || sourceIds[0],
      );

      const movedReservations = await Reservation.find({
        restaurantId,
        tableMergeGroupId: joinGroupId,
      })
        .session(session)
        .lean();
      if (movedReservations.length) {
        await Reservation.bulkWrite(
          movedReservations.map((reservation) => {
            const sourceId = String(
              reservation.sourceTableId || fallbackSourceId,
            );
            const source = sourceById.get(sourceId) || sourceById.get(fallbackSourceId);
            return {
              updateOne: {
                filter: { _id: reservation._id, restaurantId },
                update: {
                  $set: { tableId: source?._id || fallbackSourceId },
                  $unset: {
                    sourceTableId: "",
                    sourceTableCode: "",
                    tableMergeGroupId: "",
                  },
                },
              },
            };
          }),
          { session },
        );
      }

      const compositeOrders = await Order.find({
        restaurantId,
        tableId: mergedTableId,
        orderType: "dine_in",
        currentStatus: ACTIVE_ORDER_STATUSES,
      })
        .session(session)
        .lean();
      if (compositeOrders.length) {
        await Order.bulkWrite(
          compositeOrders.map((order) => {
            const mergeMeta = order?.clientMeta?.tableMerge || {};
            const sourceId = String(mergeMeta.sourceTableId || fallbackSourceId);
            const source = sourceById.get(sourceId) || sourceById.get(fallbackSourceId);
            const clientMeta = { ...(order.clientMeta || {}) };
            delete clientMeta.tableMerge;
            return {
              updateOne: {
                filter: { _id: order._id, restaurantId },
                update: {
                  $set: {
                    tableId: source?._id || fallbackSourceId,
                    tableCode: source?.code || mergeMeta.sourceTableCode,
                    clientMeta,
                  },
                },
              },
            };
          }),
          { session },
        );
      }

      const restoredReservations = await Reservation.find({
        restaurantId,
        tableId: { $in: sourceIds },
        status: { $in: ACTIVE_RESERVATION_STATUSES },
      })
        .session(session)
        .lean();
      const activeOrders = await Order.find({
        restaurantId,
        tableId: { $in: sourceIds },
        orderType: "dine_in",
        currentStatus: ACTIVE_ORDER_STATUSES,
      })
        .session(session)
        .select({ tableId: 1 })
        .lean();
      const customers = await TableCustomer.find({
        restaurantId,
        tableId: { $in: sourceIds },
      })
        .session(session)
        .lean();

      await Table.bulkWrite(
        sourceTables.map((source) => ({
          updateOne: {
            filter: {
              _id: source._id,
              restaurantId,
              mergedIntoTableId: mergedTableId,
            },
            update: {
              $set: {
                isJoinable: false,
                status: resolveSourceStatus({
                  sourceId: source._id,
                  activeOrders,
                  reservations: restoredReservations,
                  customers,
                }),
              },
              $unset: { joinGroupId: "", mergedIntoTableId: "" },
            },
          },
        })),
        { session },
      );

      const deleted = await Table.deleteOne(
        { _id: mergedTableId, restaurantId, joinGroupId },
        { session },
      );
      if (deleted.deletedCount !== 1) {
        throw businessError(
          "Không thể xóa bàn ghép để hoàn tất tách bàn.",
          "TABLE_SPLIT_WRITE_CONFLICT",
        );
      }
    });
  } finally {
    await session.endSession();
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

  // Bàn ghép là một thực thể duy nhất; tách từ thực thể này luôn trả cả nhóm.
  if (mergedTable) {
    return splitCompositeTable({
      restaurantId,
      joinGroupId,
      mergedTable,
      ctx,
    });
  }

  // Tương thích dữ liệu nhóm cũ chỉ có joinGroupId.
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
