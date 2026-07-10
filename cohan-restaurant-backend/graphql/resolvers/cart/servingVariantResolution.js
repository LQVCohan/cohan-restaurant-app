import { GraphQLError } from "graphql";
import { Recipe } from "../../../models/index.js";

const LEGACY_PORTION_KEY = "portion";

const normalizeServingKey = (value) => String(value || "").trim();

const badInput = (message) =>
  new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });

export async function resolveCustomerServingVariantKey({
  restaurantId,
  menuItemId,
  requestedKey,
}) {
  const normalizedKey = normalizeServingKey(requestedKey);

  // Real explicit keys remain authoritative. The only compatibility value is
  // "portion", which older clients used as a key even though it is a sell unit.
  if (normalizedKey && normalizedKey !== LEGACY_PORTION_KEY) {
    return normalizedKey;
  }

  const recipe = await Recipe.findOne({
    restaurantId,
    menuItemId,
    isActive: true,
    deletedAt: null,
  })
    .select({ servingVariants: 1 })
    .lean();

  if (!recipe) {
    throw badInput("Món chưa có công thức đang hoạt động.");
  }

  const variants = Array.isArray(recipe.servingVariants)
    ? recipe.servingVariants
    : [];
  const exactVariant = normalizedKey
    ? variants.find(
        (variant) => normalizeServingKey(variant?.key) === normalizedKey,
      )
    : null;
  const resolvedVariant =
    exactVariant || variants.find((variant) => variant?.isDefault) || variants[0];
  const resolvedKey = normalizeServingKey(resolvedVariant?.key);

  if (!resolvedKey) {
    throw badInput("Món chưa có biến thể phục vụ hợp lệ.");
  }

  return resolvedKey;
}
