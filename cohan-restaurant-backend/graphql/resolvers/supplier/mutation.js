import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import Supplier from "../../../models/supplier.model.js";
import { requireRole } from "../../../utils/authz.js";

function normalizeDup(err) {
  if (err?.code === 11000) return new GraphQLError("Supplier name already exists");
  return err;
}

export default {
  createSupplier: async (_p, { input }, ctx) => {
    requireRole(ctx?.user, ["admin"]);
    try {
      const doc = await Supplier.create(input);
      return doc.toObject({ virtuals: true });
    } catch (err) {
      const e = normalizeDup(err);
      if (e instanceof GraphQLError) throw e;
      throw new GraphQLError(e?.message || "createSupplier failed");
    }
  },

  updateSupplier: async (_p, { input }, ctx) => {
    const { id, ...patch } = input || {};
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");
    requireRole(ctx?.user, ["admin"]);

    try {
      const doc = await Supplier.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true })
        .lean();
      if (!doc) throw new GraphQLError("Supplier not found");
      return doc;
    } catch (err) {
      const e = normalizeDup(err);
      if (e instanceof GraphQLError) throw e;
      throw new GraphQLError(e?.message || "updateSupplier failed");
    }
  },

  deleteSupplier: async (_p, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return false;
    requireRole(ctx?.user, ["admin"]);
    const res = await Supplier.deleteOne({ _id: id });
    return res.deletedCount > 0;
  },

  bumpSupplierReliability: async (_p, { id, delta = 1 }, ctx) => {
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");
    requireRole(ctx?.user, ["admin"]);

    const doc = await Supplier.findByIdAndUpdate(
      id,
      { $inc: { reliabilityScore: delta } },
      { new: true }
    ).lean();

    if (!doc) throw new GraphQLError("Supplier not found");
    return doc;
  },
};
