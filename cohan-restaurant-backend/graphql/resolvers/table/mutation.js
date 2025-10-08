import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import Floor from "../../../models/floor.model.js";
import Table from "../../../models/table.model.js";

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

  updateTable: async (_p, { input }) => {
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
    return doc;
  },

  deleteTable: async (_p, { id }) => {
    if (!mongoose.isValidObjectId(id)) return false;
    const res = await Table.deleteOne({ _id: id });
    return res.deletedCount > 0;
  },

  moveTable: async (_p, { input }) => {
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

  swapTableCodes: async (_p, { input }) => {
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
