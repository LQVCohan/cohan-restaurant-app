import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Cart } from "../../../models/index.js";

export const CartQuery = {
  async myCart(_, { userId }, ctx) {
    const uid = userId || ctx.user?.id;
    if (!mongoose.isValidObjectId(uid)) {
      throw new GraphQLError("Invalid userId");
    }

    const cart = await Cart.findOne({
      userId: uid,
      status: "active",
    }).lean({ virtuals: true });

    return cart;
  },
};
