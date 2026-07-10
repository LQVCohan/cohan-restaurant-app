import AuditLog from "../../models/audit-log.model.js";
import MenuItem from "../../models/menuitem.model.js";
import MenuPriceEvent from "../../models/menu-price-event.model.js";
import Recipe from "../../models/recipe.model.js";

const toPriceMap = (prices = []) =>
  new Map(
    prices
      .map((entry) => [String(entry?.key || ""), Number(entry?.price)])
      .filter(([key, price]) => key && Number.isFinite(price)),
  );

export const buildRestoredVariants = (
  currentVariants = [],
  beforePrices = [],
  appliedPrices = [],
) => {
  const beforeByKey = toPriceMap(beforePrices);
  const appliedByKey = toPriceMap(appliedPrices);
  const candidates = [];
  const seenKeys = new Set();
  let alreadyRestoredCount = 0;
  let skippedCount = 0;

  for (const variant of currentVariants || []) {
    const key = String(variant?.key || "");
    if (!beforeByKey.has(key) || !appliedByKey.has(key)) continue;

    seenKeys.add(key);
    const currentPrice = Number(variant?.price);
    const beforePrice = beforeByKey.get(key);
    const appliedPrice = appliedByKey.get(key);

    if (currentPrice === beforePrice) {
      alreadyRestoredCount += 1;
    } else if (currentPrice === appliedPrice) {
      candidates.push({ key, beforePrice, appliedPrice });
    } else {
      skippedCount += 1;
    }
  }

  for (const key of beforeByKey.keys()) {
    if (!seenKeys.has(key)) skippedCount += 1;
  }

  return {
    candidates,
    alreadyRestoredCount,
    skippedCount,
  };
};

const computeMinVariantPrice = (variants = []) => {
  const prices = variants
    .map((variant) => Number(variant?.price))
    .filter((price) => Number.isFinite(price) && price >= 0);
  return prices.length ? Math.min(...prices) : 0;
};

const readRecipe = (event, item) =>
  Recipe.findOne({
    _id: item.recipeId,
    restaurantId: event.restaurantId,
    menuItemId: item.menuItemId,
  }).lean();

const restoreEventItem = async (event, item) => {
  const recipe = await readRecipe(event, item);
  if (!recipe) {
    return {
      restoredCount: 0,
      skippedCount: Math.max(item.beforePrices?.length || 0, 1),
    };
  }

  const preview = buildRestoredVariants(
    recipe.servingVariants,
    item.beforePrices,
    item.appliedPrices,
  );

  if (preview.candidates.length) {
    const set = {};
    const arrayFilters = [];

    preview.candidates.forEach((candidate, index) => {
      const token = `variant${index}`;
      set[`servingVariants.$[${token}].price`] = candidate.beforePrice;
      arrayFilters.push({
        [`${token}.key`]: candidate.key,
        [`${token}.price`]: candidate.appliedPrice,
      });
    });

    await Recipe.updateOne(
      { _id: recipe._id, restaurantId: event.restaurantId },
      { $set: set },
      { arrayFilters },
    );
  }

  const finalRecipe = await readRecipe(event, item);
  if (!finalRecipe) {
    return {
      restoredCount: 0,
      skippedCount: Math.max(item.beforePrices?.length || 0, 1),
    };
  }

  const beforeByKey = toPriceMap(item.beforePrices);
  const finalByKey = toPriceMap(finalRecipe.servingVariants);
  let restoredCount = 0;
  let skippedCount = 0;

  for (const [key, beforePrice] of beforeByKey.entries()) {
    if (finalByKey.get(key) === beforePrice) restoredCount += 1;
    else skippedCount += 1;
  }

  if (restoredCount > 0) {
    await MenuItem.updateOne(
      { _id: item.menuItemId, restaurantId: event.restaurantId },
      { $set: { basePrice: computeMinVariantPrice(finalRecipe.servingVariants) } },
    );
  }

  return { restoredCount, skippedCount };
};

const restoreClaimedEvent = async (event) => {
  let restoredVariantCount = 0;
  let skippedVariantCount = 0;

  for (const item of event.items || []) {
    const result = await restoreEventItem(event, item);
    restoredVariantCount += result.restoredCount;
    skippedVariantCount += result.skippedCount;
  }

  const status = skippedVariantCount > 0 ? "partially_restored" : "restored";
  const restoredAt = new Date();

  await MenuPriceEvent.updateOne(
    { _id: event._id, status: "processing" },
    {
      $set: {
        status,
        restoredAt,
        restoredVariantCount,
        skippedVariantCount,
        lastError: null,
      },
    },
  );

  await AuditLog.create({
    restaurantId: event.restaurantId,
    entity: "MenuPriceEvent",
    entityId: event._id,
    action: "update",
    diff: {
      type: "menu_price_restore_completed",
      eventName: event.eventName,
      status,
      restoredAt,
      restoredVariantCount,
      skippedVariantCount,
    },
  });

  return { status, restoredVariantCount, skippedVariantCount };
};

export const restoreExpiredMenuPriceEvents = async ({
  now = new Date(),
  limit = 50,
  logger = console,
} = {}) => {
  const summary = {
    processedCount: 0,
    restoredVariantCount: 0,
    skippedVariantCount: 0,
    failedCount: 0,
  };

  while (summary.processedCount < limit) {
    const event = await MenuPriceEvent.findOneAndUpdate(
      { status: "scheduled", restoreAt: { $lte: now } },
      {
        $set: { status: "processing", lastError: null },
        $inc: { attempts: 1 },
      },
      { new: true, sort: { restoreAt: 1 } },
    ).lean();

    if (!event) break;
    summary.processedCount += 1;

    try {
      const result = await restoreClaimedEvent(event);
      summary.restoredVariantCount += result.restoredVariantCount;
      summary.skippedVariantCount += result.skippedVariantCount;
    } catch (error) {
      summary.failedCount += 1;
      await MenuPriceEvent.updateOne(
        { _id: event._id, status: "processing" },
        {
          $set: {
            status: "scheduled",
            lastError: error?.message || "Không thể hoàn giá.",
          },
        },
      );
      logger?.error?.({ error, eventId: event._id }, "menu price restore failed");
      break;
    }
  }

  return summary;
};
