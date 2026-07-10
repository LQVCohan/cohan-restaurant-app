import { CartQuery } from "./query.js";
import { CustomerCartQuery } from "./customerQuery.js";
import { CartMutation } from "./mutation.js";
import { CustomerCartMutation } from "./customerMutation.js";
import { CartAvailabilityWatchMutation } from "./availabilityWatchMutation.js";
import { resolveCustomerServingVariantKey } from "./servingVariantResolution.js";
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

export default {
  Query: {
    ...CartQuery,
    ...CustomerCartQuery,
    menuItemLiveState: withResolvedServingVariantKey(
      CustomerCartQuery.menuItemLiveState,
      { respectItemType: true },
    ),
  },
  Mutation: {
    ...CartMutation,
    ...CustomerCartMutation,
    addCartItem: withResolvedServingVariantKey(
      CustomerCartMutation.addCartItem,
    ),
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
