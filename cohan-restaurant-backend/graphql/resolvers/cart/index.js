import mongoose from "mongoose";
import { CartQuery } from "./query.js";
import { CustomerCartQuery } from "./customerQuery.js";
import { CartMutation } from "./mutation.js";
import { CustomerCartMutation } from "./customerMutation.js";
import { CartAvailabilityWatchMutation } from "./availabilityWatchMutation.js";
import { resolveCustomerServingVariantKey } from "./servingVariantResolution.js";
import {
  createSupplyAwareAddCartItem,
  createSupplyAwareLiveState,
} from "./orderableSupplyCart.js";
import {
  CartFieldResolvers,
  CartItemFieldResolvers,
  MenuAvailabilityWatchFieldResolvers,
} from "./types.js";

const withResolvedServingVariantKey =
  (resolver, { respectItemType = false } = {}) =>
  async (parent, args, ctx, info) => {
    const input = args?.input;
    const itemType = String(input?.itemType || "MENU_ITEM").toUpperCase();
    if (
      !input?.restaurantId ||
      !input?.menuItemId ||
      !mongoose.isValidObjectId(input.restaurantId) ||
      !mongoose.isValidObjectId(input.menuItemId) ||
      (respectItemType && itemType !== "MENU_ITEM")
    ) {
      return resolver(parent, args, ctx, info);
    }

    const servingVariantKey = await resolveCustomerServingVariantKey({
      restaurantId: input.restaurantId,
      menuItemId: input.menuItemId,
      requestedKey: input.servingVariantKey,
    });

    return resolver(
      parent,
      {
        ...args,
        input: {
          ...input,
          servingVariantKey,
        },
      },
      ctx,
      info,
    );
  };

const menuItemLiveState = createSupplyAwareLiveState(
  withResolvedServingVariantKey(CustomerCartQuery.menuItemLiveState, {
    respectItemType: true,
  }),
);
const addCartItem = createSupplyAwareAddCartItem(
  withResolvedServingVariantKey(CustomerCartMutation.addCartItem),
);

export default {
  Query: {
    ...CartQuery,
    ...CustomerCartQuery,
    menuItemLiveState,
  },
  Mutation: {
    ...CartMutation,
    ...CustomerCartMutation,
    addCartItem,
    ...CartAvailabilityWatchMutation,
  },
  Cart: {
    ...CartFieldResolvers,
  },
  CartItem: {
    ...CartItemFieldResolvers,
  },
  MenuAvailabilityWatch: {
    ...MenuAvailabilityWatchFieldResolvers,
  },
};
