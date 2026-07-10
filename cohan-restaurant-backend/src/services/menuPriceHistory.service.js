import mongoose from "mongoose";
import { AuditLog, MenuItem, Recipe } from "../../models/index.js";

export const MENU_PRICE_HISTORY_MODULE = "menu_price_history";
const ACTIVE_STATUS = "active";

const getActorId = (ctx) => ctx?.user?.id || ctx?.user?._id || null;

const toObjectId = (value) =>
  mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : value;

export const snapshotVariantPrices = (variants = []) =>
  (Array.isArray(variants) ? variants : [])
    .map((variant) => {
      const key = String(variant?.key || "").trim();
      const price = Number(variant?.price);
      if (!key || !Number.isFinite(price)) return null;
      return { key, price };
    })
    .filter(Boolean);

const snapshotMap = (snapshot = []) =>
  new Map(snapshot.map((entry) => [String(entry.key), Number(entry.price)]));

export const didVariantPricesChange = (before = [], after = []) => {
  const beforeMap = snapshotMap(before);
  const afterMap = snapshotMap(after);
  if (beforeMap.size !== afterMap.size) return true;
  for (const [key, price] of beforeMap) {
    if (!afterMap.has(key) || afterMap.get(key) !== price) return true;
  }
  return false;
};

const minSnapshotPrice = (snapshot = []) => {
  const prices = snapshot
    .map((entry) => Number(entry?.price))
    .filter((price) => Number.isFinite(price) && price >= 0);
  return prices.length ? Math.min(...prices) : 0;
};

const normalizeRestoreAt = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export async function recordMenuPriceChange({
  restaurantId,
  menuItemId,
  beforeVariants,
  afterVariants,
  ctx,
  source = "bulk",
  restoreAt = null,
}) {
  const before = snapshotVariantPrices(beforeVariants);
  const after = snapshotVariantPrices(afterVariants);
  if (!didVariantPricesChange(before, after)) return null;

  const actorId = getActorId(ctx);
  const history = await AuditLog.create({
    restaurantId,
    entity: "MenuItem",
    entityId: menuItemId,
    action: "update",
    byUserId: actorId,
    actorId,
    module: MENU_PRICE_HISTORY_MODULE,
    targetType: "MenuItem",
    targetId: menuItemId,
    before: { servingVariantPrices: before },
    after: { servingVariantPrices: after },
    diff: {
      type: source === "bulk" ? "bulk_price_update" : "manual_price_update",
      before: { servingVariantPrices: before },
      after: { servingVariantPrices: after },
      basePriceBefore: minSnapshotPrice(before),
      basePriceAfter: minSnapshotPrice(after),
    },
    metadata: {
      status: ACTIVE_STATUS,
      source,
      restoreAt: normalizeRestoreAt(restoreAt),
    },
  });

  await AuditLog.updateMany(
    {
      _id: { $ne: history._id },
      restaurantId: toObjectId(restaurantId),
      entityId: toObjectId(menuItemId),
      module: MENU_PRICE_HISTORY_MODULE,
      "metadata.status": ACTIVE_STATUS,
    },
    {
      $set: {
        "metadata.status": "superseded",
        "metadata.supersededAt": new Date(),
      },
    },
  );

  return history;
}

const applyPriceSnapshot = (variants = [], snapshot = []) => {
  const prices = snapshotMap(snapshot);
  let matchedCount = 0;
  let changed = false;
  const nextVariants = (Array.isArray(variants) ? variants : []).map((variant) => {
    const key = String(variant?.key || "");
    if (!prices.has(key)) return variant;
    matchedCount += 1;
    const price = prices.get(key);
    if (Number(variant?.price) === price) return variant;
    changed = true;
    return { ...variant, price };
  });
  return { nextVariants, matchedCount, changed };
};

async function restoreOneMenuItemPrice({ restaurantId, menuItemId, ctx, reason }) {
  const now = new Date();
  const history = await AuditLog.findOneAndUpdate(
    {
      restaurantId: toObjectId(restaurantId),
      entityId: toObjectId(menuItemId),
      module: MENU_PRICE_HISTORY_MODULE,
      "metadata.status": ACTIVE_STATUS,
    },
    {
      $set: {
        "metadata.status": "restoring",
        "metadata.restoreStartedAt": now,
      },
    },
    { sort: { createdAt: -1 }, new: true },
  ).lean();

  if (!history) return { status: "skipped", item: null };

  try {
    const recipe = await Recipe.findOne({ restaurantId, menuItemId }).lean();
    const snapshot =
      history?.before?.servingVariantPrices ||
      history?.diff?.before?.servingVariantPrices ||
      [];

    if (!recipe || !snapshot.length) {
      await AuditLog.updateOne(
        { _id: history._id },
        {
          $set: {
            "metadata.status": "failed",
            "metadata.restoreFailedAt": new Date(),
            "metadata.restoreError": !recipe
              ? "Recipe not found"
              : "Previous price snapshot is empty",
          },
        },
      );
      return { status: "skipped", item: null };
    }

    const currentSnapshot = snapshotVariantPrices(recipe.servingVariants);
    const { nextVariants, matchedCount } = applyPriceSnapshot(
      recipe.servingVariants,
      snapshot,
    );

    if (!matchedCount) {
      await AuditLog.updateOne(
        { _id: history._id },
        {
          $set: {
            "metadata.status": "failed",
            "metadata.restoreFailedAt": new Date(),
            "metadata.restoreError": "No matching serving variants",
          },
        },
      );
      return { status: "skipped", item: null };
    }

    const restoredSnapshot = snapshotVariantPrices(nextVariants);
    const basePrice = minSnapshotPrice(restoredSnapshot);

    await Recipe.updateOne(
      { _id: recipe._id, restaurantId, menuItemId },
      { $set: { servingVariants: nextVariants } },
      { runValidators: true },
    );
    const item = await MenuItem.findOneAndUpdate(
      { _id: menuItemId, restaurantId },
      { $set: { basePrice } },
      { new: true, runValidators: true },
    ).lean({ virtuals: true });

    const actorId = getActorId(ctx);
    await AuditLog.updateOne(
      { _id: history._id },
      {
        $set: {
          "metadata.status": "restored",
          "metadata.restoredAt": new Date(),
          "metadata.restoredByUserId": actorId,
          "metadata.restoreReason": reason,
        },
      },
    );

    await AuditLog.updateMany(
      {
        _id: { $ne: history._id },
        restaurantId: toObjectId(restaurantId),
        entityId: toObjectId(menuItemId),
        module: MENU_PRICE_HISTORY_MODULE,
        "metadata.status": ACTIVE_STATUS,
      },
      {
        $set: {
          "metadata.status": "superseded",
          "metadata.supersededAt": new Date(),
        },
      },
    );

    await AuditLog.create({
      restaurantId,
      entity: "MenuItem",
      entityId: menuItemId,
      action: "update",
      byUserId: actorId,
      actorId,
      module: "menu_price_restore",
      targetType: "MenuItem",
      targetId: menuItemId,
      before: { servingVariantPrices: currentSnapshot },
      after: { servingVariantPrices: restoredSnapshot },
      diff: {
        type: "price_restore",
        before: { servingVariantPrices: currentSnapshot },
        after: { servingVariantPrices: restoredSnapshot },
        basePriceBefore: minSnapshotPrice(currentSnapshot),
        basePriceAfter: basePrice,
      },
      metadata: {
        sourceHistoryId: history._id,
        reason,
      },
    });

    return { status: "restored", item };
  } catch (error) {
    await AuditLog.updateOne(
      { _id: history._id },
      {
        $set: {
          "metadata.status": ACTIVE_STATUS,
          "metadata.lastRestoreError": error?.message || "Restore failed",
        },
        $unset: { "metadata.restoreStartedAt": 1 },
      },
    );
    throw error;
  }
}

export async function restoreMenuItemPrices({
  restaurantId,
  menuItemIds = [],
  ctx = null,
  reason = "manual",
}) {
  const uniqueIds = [...new Set(menuItemIds.map(String).filter(Boolean))];
  const items = [];
  let skippedCount = 0;

  for (const menuItemId of uniqueIds) {
    const result = await restoreOneMenuItemPrice({
      restaurantId,
      menuItemId,
      ctx,
      reason,
    });
    if (result.status === "restored" && result.item) items.push(result.item);
    else skippedCount += 1;
  }

  return {
    restoredCount: items.length,
    skippedCount,
    items,
  };
}
