import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import Floor from "../../../models/floor.model.js";
import Table from "../../../models/table.model.js";
import { logEvent } from "../../../src/services/eventLog.service.js";
const ensureFloorLevel = async (floorId) => {
  const f = await Floor.findById(floorId).select({ level: 1 }).lean();
  if (!f) throw new GraphQLError("Floor not found");
  return f.level ?? 1;
};

export default {
  createTable: async (_p, { input }) => {
    const { restaurantId, floorId } = input;
    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(floorId)
    ) {
      throw new GraphQLError("Invalid restaurantId or floorId");
    }
    const level = await ensureFloorLevel(floorId);
    const created = await Table.create({ ...input, floorLevel: level });

    return created.toObject({ virtuals: true });
  },
  mergeTables: async (_p, { input }, ctx) => {
    const { restaurantId, tableIds, anchorId, joinGroupId } = input;

    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }
    if (!tableIds || !Array.isArray(tableIds) || tableIds.length < 2) {
      throw new GraphQLError("tableIds must contain at least 2 ids");
    }
    if (!tableIds.every(mongoose.isValidObjectId)) {
      throw new GraphQLError("Invalid tableIds");
    }
    if (anchorId && !mongoose.isValidObjectId(anchorId)) {
      throw new GraphQLError("Invalid anchorId");
    }

    // Lấy toàn bộ bàn, đảm bảo cùng nhà hàng
    const tables = await Table.find({
      _id: { $in: tableIds },
      restaurantId,
    })
      .select({ _id: 1, restaurantId: 1, code: 1, floorId: 1 })
      .lean();

    if (tables.length !== tableIds.length) {
      throw new GraphQLError("Some tables not found or not in this restaurant");
    }

    // Tạo joinGroupId nếu chưa truyền
    const groupId = joinGroupId || new mongoose.Types.ObjectId().toString();

    // Set thuộc tính nhóm
    await Table.updateMany(
      { _id: { $in: tableIds } },
      { $set: { isJoinable: true, joinGroupId: groupId } }
    );

    // log sự kiện gộp
    const anchor = anchorId || tableIds[0];
    await logEvent({
      restaurantId,
      verb: "table.merge",
      object: { kind: "Table", id: anchor },
      meta: {
        joinGroupId: groupId,
        tableIds,
        anchorId: anchor,
      },
      actorUserId: ctx.user?.id,
      ip: ctx.req?.ip,
      userAgent: ctx.req?.headers["user-agent"],
    });

    return { joinGroupId: groupId, anchorId: anchor, tableIds };
  },

  // ===== SPLIT TABLES =====
  splitTables: async (_p, { input }, ctx) => {
    const { restaurantId, joinGroupId, mode, tableIds } = input;

    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }
    if (!joinGroupId) throw new GraphQLError("joinGroupId is required");
    if (!["ALL", "PARTIAL"].includes(mode)) {
      throw new GraphQLError("mode must be ALL or PARTIAL");
    }
    if (mode === "PARTIAL") {
      if (!tableIds || !Array.isArray(tableIds) || tableIds.length === 0) {
        throw new GraphQLError("tableIds is required in PARTIAL mode");
      }
      if (!tableIds.every(mongoose.isValidObjectId)) {
        throw new GraphQLError("Invalid tableIds");
      }
    }

    // Xác định tập bàn sẽ tách
    let toUnmergeFilter = { restaurantId, joinGroupId };
    if (mode === "PARTIAL") {
      toUnmergeFilter._id = { $in: tableIds };
    }

    const affected = await Table.updateMany(toUnmergeFilter, {
      $set: { isJoinable: false },
      $unset: { joinGroupId: "" },
    });

    // Lấy lại id các bàn đã tách (để trả về)
    const unmerged = await Table.find({
      restaurantId,
      ...(mode === "PARTIAL" ? { _id: { $in: tableIds } } : {}), // ALL: tất cả bàn của group cũ đã clear
      // Sau khi tách, joinGroupId đã null -> dựa vào ids ở PARTIAL
    })
      .select({ _id: 1 })
      .lean();

    const unmergedTableIds = unmerged.map((x) => x._id.toString());

    // log
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
      userAgent: ctx.req?.headers["user-agent"],
    });

    return { ok: true, unmergedTableIds };
  },
  updateTable: async (_p, { input }, ctx) => {
    const { id, ...patch } = input;
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");

    // Nếu đổi floorId thì cập nhật floorLevel
    if (patch.floorId) {
      if (!mongoose.isValidObjectId(patch.floorId))
        throw new GraphQLError("Invalid floorId");
      const level = await ensureFloorLevel(patch.floorId);
      patch.floorLevel = level;
    }
    const doc = await Table.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean({ virtuals: true });
    if (!doc) throw new GraphQLError("Table not found");
    await logEvent({
      restaurantId: doc.restaurantId,
      floorId: doc.floorId,
      tableId: doc.id,
      actorUserId: ctx.user?.id,
      verb: "table.update",
      object: { kind: "Table", id: doc.id, code: doc.code },
      meta: { patch },
      ip: ctx.req?.ip,
      userAgent: ctx.req?.headers["user-agent"],
    });
    return doc;
  },

  deleteTable: async (_p, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return false;

    // Lấy thông tin bàn trước khi xóa để ghi log
    const before = await Table.findById(id).lean({ virtuals: true });
    if (!before) return false;

    const res = await Table.deleteOne({ _id: id });

    // Ghi log nếu xóa thành công
    if (res.deletedCount > 0) {
      await logEvent({
        restaurantId: before.restaurantId,
        floorId: before.floorId,
        tableId: before._id,
        actorUserId: ctx?.user?.id,
        verb: "table.delete",
        object: { kind: "Table", id: before._id, code: before.code },
        meta: { name: before.name, status: before.status },
        ip: ctx?.req?.ip,
        userAgent: ctx?.req?.headers?.["user-agent"],
      });
    }

    return res.deletedCount > 0;
  },

  moveTable: async (_p, { input }, ctx) => {
    const { id, floorId, position } = input;
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");

    const patch = {};
    if (position) patch.position = position;
    if (floorId) {
      if (!mongoose.isValidObjectId(floorId))
        throw new GraphQLError("Invalid floorId");
      const level = await ensureFloorLevel(floorId);
      patch.floorId = floorId;
      patch.floorLevel = level;
    }

    const doc = await Table.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean({ virtuals: true });
    if (!doc) throw new GraphQLError("Table not found");
    logEvent({
      restaurantId: doc.restaurantId,
      floorId: doc.floorId,
      tableId: doc.id,
      actorUserId: ctx.user?.id,
      verb: "table.move",
      object: { kind: "Table", id: doc.id, code: doc.code },
      meta: { toFloorId: input.floorId, position: input.position },
      ip: ctx.req?.ip,
      userAgent: ctx.req?.headers["user-agent"],
    });
    return doc;
  },

  setTableStatus: async (_p, { input }) => {
    const { id, status } = input;
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");
    const doc = await Table.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, runValidators: true }
    ).lean({ virtuals: true });
    if (!doc) throw new GraphQLError("Table not found");
    return doc;
  },

  swapTableCodes: async (_p, { input }, ctx) => {
    const { restaurantId, floorId, aId, bId } = input;
    if (![restaurantId, floorId, aId, bId].every(mongoose.isValidObjectId)) {
      throw new GraphQLError("Invalid ids");
    }
    const [a, b] = await Promise.all([
      Table.findOne({ _id: aId, restaurantId, floorId })
        .select({ code: 1 })
        .lean(),
      Table.findOne({ _id: bId, restaurantId, floorId })
        .select({ code: 1 })
        .lean(),
    ]);
    if (!a || !b) throw new GraphQLError("Tables not found");

    // Hoán đổi an toàn với code tạm
    const temp = `__SWAP__${a.code}__${Date.now()}`;
    await Table.updateOne({ _id: aId }, { $set: { code: temp } });
    await Table.updateOne({ _id: bId }, { $set: { code: a.code } });
    await Table.updateOne({ _id: aId }, { $set: { code: b.code } });
    logEvent({
      restaurantId,
      verb: "table.swap_codes",
      object: { kind: "Table", id: aId, code: a.code },
      target: { kind: "Table", id: bId, code: b.code },
      meta: { afterA: a.code, afterB: b.code },
      actorUserId: ctx.user?.id,
    });
    return true;
  },

  bulkUpsertTables: async (_p, { input }) => {
    const { restaurantId, floorId, items } = input;
    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(floorId)
    ) {
      throw new GraphQLError("Invalid restaurantId or floorId");
    }
    const level = await ensureFloorLevel(floorId);

    const ops = items.map((it) => ({
      updateOne: {
        filter: { restaurantId, floorId, code: it.code },
        update: {
          $set: {
            ...it,
            restaurantId,
            floorId,
            floorLevel: level,
          },
        },
        upsert: true,
      },
    }));

    const res = await Table.bulkWrite(ops, { ordered: false });
    const affected = (res.upsertedCount || 0) + (res.modifiedCount || 0);
    return affected;
  },
};
