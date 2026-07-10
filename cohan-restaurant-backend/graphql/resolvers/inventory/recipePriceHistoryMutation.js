import { Recipe } from "../../../models/index.js";
import { recordMenuPriceChange } from "../../../src/services/menuPriceHistory.service.js";

export function createRecipePriceHistoryMutations(baseRecipeMutations) {
  return {
    upsertRecipe: async (parent, args, ctx, info) => {
      const input = args?.input || {};
      const tracksPrice = Array.isArray(input.servingVariants);
      const before = tracksPrice
        ? await Recipe.findOne({
            restaurantId: input.restaurantId,
            menuItemId: input.menuItemId,
          })
            .select({ servingVariants: 1 })
            .lean()
        : null;

      const result = await baseRecipeMutations.upsertRecipe(
        parent,
        args,
        ctx,
        info,
      );

      if (tracksPrice && before && result) {
        await recordMenuPriceChange({
          restaurantId: input.restaurantId,
          menuItemId: input.menuItemId,
          beforeVariants: before.servingVariants,
          afterVariants: result.servingVariants,
          ctx,
          source: "manual",
        });
      }

      return result;
    },
  };
}
