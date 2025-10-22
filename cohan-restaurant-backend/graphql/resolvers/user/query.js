import { User } from "../../../models/index.js";
import { GraphQLError } from "graphql";
import mongoose from "mongoose";

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id);
}

export const UserQuery = {
  async me(_, __, { user }) {
    try {
      if (!user?.id) {
        throw new GraphQLError("Unauthorized", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const fullUser = await User.findById(toObjectId(user.id))
        .populate({ path: "role", select: "name slug" })
        .lean();

      if (!fullUser) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return fullUser;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new GraphQLError(err.message || "Failed to fetch user info", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },
};
