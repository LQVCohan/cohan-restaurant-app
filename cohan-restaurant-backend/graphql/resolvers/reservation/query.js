// src/graphql/reservation/query.js
import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { Reservation } from "../../../models/index.js";

function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new GraphQLError("Invalid ID", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return new mongoose.Types.ObjectId(id);
}

export const ReservationQuery = {
  async reservation(_, { id }, ctx) {
    const doc = await Reservation.findById(toObjectId(id));
    return doc || null;
  },

  async myReservations(_, { limit = 20, cursor }, ctx) {
    const userId = ctx?.auth?.user?.id || ctx?.user?.id;
    if (!userId) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const f = { userId: toObjectId(userId) };
    if (cursor && mongoose.isValidObjectId(cursor)) {
      f._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const docs = await Reservation.find(f).sort({ _id: -1 }).limit(limit);
    return docs;
  },
};
