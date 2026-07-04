// src/graphql/resolvers/menu/mutation.js (CLEAN + UPDATED for Recipe-based pricing)
import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import {
  Menu,
  MenuItem,
  Restaurant,
  Recipe,
  AuditLog,
} from "../../../models/index.js";
import { MENU_PERMISSION, requireMenuPermission } from "./menuPermission.js";

const MENU_ITEM_STATUS = ["available", "unavailable", "out_of_stock", "hidden"];
const MENU_ITEM_PREP_STATIONS = ["kitchen", "bar"];
const TIME_SLOTS = ["breakfast", "lunch", "dinner", "late_night"];
const MENU_ITEM_DIET_TAGS = ["vegan", "keto", "halal"];
const MENU_ITEM_ALLERGEN_TAGS = ["seafood", "peanut", "milk", "egg", "gluten"];
const MENU_ITEM_FOOD_TYPES = [
  "VEGETARIAN",
  "NON_VEGETARIAN",
  "VEGAN",
  "MIXED",
  "UNKNOWN",
];
const MENU_ITEM_MEAT_TYPES = [
  "BEEF",
  "PORK",
  "CHICKEN",
  "DUCK",
  "SEAFOOD",
  "FISH",
  "LAMB",
  "OTHER",
];
const MENU_ITEM_SUGAR_LEVELS = [0, 30, 50, 70, 100];
const MENU_ITEM_SPICE_LEVELS = ["Không", "Vừa", "Nồng", "Rất cay"];

function isOid(v) {
  return mongoose.isValidObjectId(v);
}
function toNumOrUndef(v) {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function assertTimeSlot(timeSlot) {
  if (!TIME_SLOTS.includes(timeSlot)) {
    throw new GraphQLError("Invalid timeSlot");
  }
}
function assertStatus(status) {
  if (!MENU_ITEM_STATUS.includes(status)) {
    throw new GraphQLError("Invalid status");
  }
}
function badInput(message) {
  return new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}
function normalizePrepStation(value, { required = false } = {}) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized && !required) return undefined;
  if (!MENU_ITEM_PREP_STATIONS.includes(normalized)) {
    throw badInput("prepStation must be kitchen or bar");
  }
  return normalized;
}
function normalizeStringTags(values, whitelist, fieldName) {
  if (values === undefined) return undefined;
  if (!Array.isArray(values)) throw badInput(`${fieldName} must be an array`);
  const out = [];
  const seen = new Set();
  for (const raw of values) {
    const value = String(raw || "").trim();
    if (!value) continue;
    if (!whitelist.includes(value)) throw badInput(`Invalid ${fieldName} value: ${value}`);
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}
function normalizeEnumValue(value, whitelist, fieldName) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return undefined;
  const normalized = String(value).trim().toUpperCase();
  if (!whitelist.includes(normalized)) {
    throw badInput(`Invalid ${fieldName} value: ${value}`);
  }
  return normalized;
}
function normalizeEnumList(values, whitelist, fieldName) {
  if (values === undefined) return undefined;
  if (!Array.isArray(values)) throw badInput(`${fieldName} must be an array`);
  const out = [];
  const seen = new Set();
  for (const raw of values) {
    const value = normalizeEnumValue(raw, whitelist, fieldName);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}
function normalizeTasteProfile(raw) {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object") throw badInput("tasteProfile must be an object");
  const containsOnion = raw.containsOnion === undefined ? false : Boolean(raw.containsOnion);
  const containsCilantro = raw.containsCilantro === undefined ? false : Boolean(raw.containsCilantro);
  const sugar = raw.sugar === undefined ? 100 : Number(raw.sugar);
  if (!MENU_ITEM_SUGAR_LEVELS.includes(sugar)) throw badInput("Invalid tasteProfile.sugar");
  const spice = raw.spice === undefined ? "Vừa" : String(raw.spice).trim();
  if (!MENU_ITEM_SPICE_LEVELS.includes(spice)) throw badInput("Invalid tasteProfile.spice");
  return { containsOnion, containsCilantro, sugar, spice };
}

function getActorId(ctx) {
  return ctx?.user?.id || ctx?.user?._id || null;
}

async function writeAuditLog({
  restaurantId = null,
  entity,
  entityId,
  action,
  ctx,
  diff = {},
  session = null,
}) {
  if (!entity || !entityId || !action) return;

  const payload = {
    restaurantId,
    entity,
    entityId,
    action,
    byUserId: getActorId(ctx),
    diff,
  };

  if (session) {
    await AuditLog.create([payload], { session });
    return;
  }

  await AuditLog.create(payload);
}

function roundWith(n, roundTo = 0) {
  const p = Math.pow(10, roundTo);
  return Math.round(n * p) / p;
}

function computeMinVariantPrice(servingVariants = []) {
  const prices = (servingVariants || [])
    .map((v) => Number(v?.price))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return prices.length ? Math.min(...prices) : 0;
}

function buildDefaultVariantFromBasePrice(basePrice) {
  const price = Number.isFinite(basePrice) && basePrice >= 0 ? basePrice : 0;
  return {
    key: "default",
    name: "Mặc định",
    mode: "PORTION",
    sellQty: 1,
    sellUnit: "portion",
    ingredients: [],
    price,
    isDefault: true,
  };
}

function includesMeaningfulItemField(input = {}) {
  return [
    "categoryId",
    "name",
    "description",
    "thumbImage",
    "mediaAssetIds",
    "modifierGroupIds",
    "notes",
    "status",
    "prepStation",
    "avgPrepTimeMin",
    "foodType",
    "meatTypes",
    "point",
    "rate",
    "orderCounter",
  ].some((field) => input[field] !== undefined);
}

async function requireMenuItemUpdatePermissions(ctx, restaurantId, input = {}) {
  const wantsPriceUpdate = input.basePrice !== undefined;
  const wantsItemUpdate = includesMeaningfulItemField(input);

  if (wantsItemUpdate) {
    await requireMenuPermission(ctx, restaurantId, MENU_PERMISSION.UPDATE_ITEM);
  }
  if (wantsPriceUpdate) {
    await requireMenuPermission(ctx, restaurantId, MENU_PERMISSION.UPDATE_PRICE);
  }
  if (!wantsItemUpdate && !wantsPriceUpdate) {
    await requireMenuPermission(ctx, restaurantId, MENU_PERMISSION.UPDATE_ITEM);
  }
}

export const MenuMutation = {
  // ================================
  // ENSURE MENU (CREATE / UPDATE)
  // ================================
  ensureMenu: async (_, { input }, ctx) => {
    const {
      restaurantId,
      timeSlot,
      name,
      description,
      coverImage,
      isActive,
      categoryMenuId,
    } = input || {};

    if (!isOid(restaurantId)) throw new GraphQLError("Invalid restaurantId");
    assertTimeSlot(timeSlot);

    const beforeMenu = await Menu.findOne({ restaurantId, timeSlot }).lean();
    await requireMenuPermission(
      ctx,
      restaurantId,
      beforeMenu ? MENU_PERMISSION.UPDATE_MENU : MENU_PERMISSION.CREATE_MENU,
    );

    // check restaurant tồn tại (nhẹ)
    const restExists = await Restaurant.exists({ _id: restaurantId });
    if (!restExists) throw new GraphQLError("Restaurant not found");

    if (categoryMenuId !== undefined && categoryMenuId !== null) {
      if (categoryMenuId && !isOid(categoryMenuId)) {
        throw new GraphQLError("Invalid categoryMenuId");
      }
    }

    const patch = {};
    if (name !== undefined && name !== null) patch.name = name || "Menu";
    if (description !== undefined) patch.description = description;
    if (coverImage !== undefined) patch.coverImage = coverImage;
    if (typeof isActive === "boolean") patch.isActive = isActive;
    if (categoryMenuId !== undefined) patch.categoryMenuId = categoryMenuId;
    const doc = await Menu.findOneAndUpdate(
      { restaurantId, timeSlot },
      {
        $setOnInsert: {
          restaurantId,
          timeSlot,
          name: "Menu",
          isActive: true,
        },
        ...(Object.keys(patch).length ? { $set: patch } : {}),
      },
      { new: true, upsert: true, runValidators: true },
    ).lean({ virtuals: true });
    await writeAuditLog({
      restaurantId,
      entity: "Menu",
      entityId: doc._id || doc.id,
      action: beforeMenu ? "update" : "create",
      ctx,
      diff: {
        restaurantId,
        timeSlot,
        before: beforeMenu
          ? {
              name: beforeMenu.name,
              description: beforeMenu.description,
              coverImage: beforeMenu.coverImage,
              isActive: beforeMenu.isActive,
              categoryMenuId: beforeMenu.categoryMenuId,
            }
          : null,
        after: {
          name: doc.name,
          description: doc.description,
          coverImage: doc.coverImage,
          isActive: doc.isActive,
          categoryMenuId: doc.categoryMenuId,
        },
      },
    });
    return doc;
  },

  // ================================
  // MENU ITEM CRUD
  // - Pricing is Recipe-based (servingVariants.price)
  // - basePrice in MenuItem is only cached/display (synced from recipe)
  // ================================
  createMenuItem: async (_, { input }, ctx) => {
    const {
      restaurantId,
      timeSlot,
      categoryId,
      name,
      description,
      basePrice,
      thumbImage,
      mediaAssetIds,
      modifierGroupIds,
      status,
      prepStation,
      avgPrepTimeMin,
      point,
      rate,
      orderCounter,
      notes,
      dietTags,
      allergenTags,
      foodType,
      meatTypes,
      tasteProfile,
    } = input || {};

    if (!isOid(restaurantId) || !isOid(categoryId)) {
      throw new GraphQLError("Invalid restaurantId or categoryId");
    }
    assertTimeSlot(timeSlot);
    if (!name || typeof name !== "string") {
      throw new GraphQLError("name is required");
    }
    if (status) assertStatus(status);
    const normalizedPrepStation = normalizePrepStation(prepStation, {
      required: true,
    });
    await requireMenuPermission(ctx, restaurantId, MENU_PERMISSION.CREATE_ITEM);

    const basePriceNum = toNumOrUndef(basePrice);
    if (basePriceNum !== undefined && basePriceNum < 0) {
      throw new GraphQLError("basePrice must be >= 0");
    }

    const avgPrep = toNumOrUndef(avgPrepTimeMin);
    if (avgPrep !== undefined && avgPrep < 0) {
      throw new GraphQLError("avgPrepTimeMin must be >= 0");
    }
    const pointNum = toNumOrUndef(point);
    if (pointNum !== undefined && pointNum < 0) {
      throw new GraphQLError("point must be >= 0");
    }

    const rateNum = toNumOrUndef(rate);
    if (rateNum !== undefined && (rateNum < 0 || rateNum > 5)) {
      throw new GraphQLError("rate must be between 0 and 5");
    }

    const orderCounterNum = toNumOrUndef(orderCounter);
    if (orderCounterNum !== undefined && orderCounterNum < 0) {
      throw new GraphQLError("orderCounter must be >= 0");
    }
    const normalizedDietTags = normalizeStringTags(
      dietTags,
      MENU_ITEM_DIET_TAGS,
      "dietTags",
    );
    const normalizedAllergenTags = normalizeStringTags(
      allergenTags,
      MENU_ITEM_ALLERGEN_TAGS,
      "allergenTags",
    );
    const normalizedFoodType =
      normalizeEnumValue(foodType, MENU_ITEM_FOOD_TYPES, "foodType") ||
      undefined;
    const normalizedMeatTypes = normalizeEnumList(
      meatTypes,
      MENU_ITEM_MEAT_TYPES,
      "meatTypes",
    );
    const normalizedTasteProfile = normalizeTasteProfile(tasteProfile);

    const session = await mongoose.startSession();
    try {
      let createdMenuItem = null;

      await session.withTransaction(async () => {
        // 1) ensure menu
        const menu = await Menu.findOneAndUpdate(
          { restaurantId, timeSlot },
          {
            $setOnInsert: {
              restaurantId,
              timeSlot,
              name: "Menu",
              isActive: true,
            },
          },
          { new: true, upsert: true, runValidators: true, session },
        );

        // 2) create menu item (basePrice only cached/display)
        createdMenuItem = await MenuItem.create(
          [
            {
              restaurantId,
              menuId: menu._id,
              categoryId,
              name,
              description,
              basePrice: basePriceNum ?? 0,
              thumbImage,
              mediaAssetIds,
              modifierGroupIds,
              status: status || undefined,
              prepStation: normalizedPrepStation,
              avgPrepTimeMin: avgPrep ?? undefined,
              point: pointNum ?? undefined,
              rate: rateNum ?? undefined,
              orderCounter: orderCounterNum ?? undefined,
              notes,
              foodType: normalizedFoodType,
              meatTypes: normalizedMeatTypes ?? [],
              dietTags: normalizedDietTags ?? [],
              allergenTags: normalizedAllergenTags ?? [],
              tasteProfile: normalizedTasteProfile,
              // byWeight: deprecated - derived from recipe variant mode
            },
          ],
          { session },
        ).then((rows) => rows[0]);

        // 3) auto-create recipe with a default servingVariant
        const defaultVariant = buildDefaultVariantFromBasePrice(
          basePriceNum ?? 0,
        );

        await Recipe.create(
          [
            {
              restaurantId,
              menuItemId: createdMenuItem._id,
              servingVariants: [defaultVariant],
              notes: "",
              isActive: true,
            },
          ],
          { session },
        );

        // 4) sync basePrice from recipe (min variant price)
        const minPrice = computeMinVariantPrice([defaultVariant]);
        await MenuItem.updateOne(
          { _id: createdMenuItem._id },
          { $set: { basePrice: minPrice } },
          { session },
        );
      });

      const doc = await MenuItem.findById(createdMenuItem._id).lean({
        virtuals: true,
        getters: true,
      });
      await writeAuditLog({
        restaurantId,
        entity: "MenuItem",
        entityId: doc._id || doc.id,
        action: "create",
        ctx,
        diff: {
          restaurantId: doc.restaurantId,
          menuId: doc.menuId,
          categoryId: doc.categoryId,
          name: doc.name,
          prepStation: doc.prepStation,
          basePrice: doc.basePrice,
          status: doc.status,
        },
      });
      return doc;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new GraphQLError(err?.message || "createMenuItem failed");
    } finally {
      await session.endSession();
    }
  },

  updateMenuItem: async (_, { input }, ctx) => {
    const { id } = input || {};
    if (!isOid(id)) throw new GraphQLError("Invalid id");
    const existing = await MenuItem.findById(id).lean();
    if (!existing) throw new GraphQLError("MenuItem not found");
    await requireMenuItemUpdatePermissions(ctx, existing.restaurantId, input);

    // only allow basic fields here. Pricing must go to Recipe (but we support basePrice as shortcut)
    const session = await mongoose.startSession();

    try {
      let updatedItem = null;

      await session.withTransaction(async () => {
        const item = await MenuItem.findById(id).session(session);
        if (!item) throw new GraphQLError("MenuItem not found");

        // basic fields
        const fields = [
          "categoryId",
          "name",
          "description",
          "thumbImage",
          "mediaAssetIds",
          "modifierGroupIds",
          "notes",
          "foodType",
          "meatTypes",
          "dietTags",
          "allergenTags",
        ];
        for (const f of fields) {
          if (input[f] !== undefined) item[f] = input[f];
        }
        if (input.prepStation !== undefined) {
          item.prepStation = normalizePrepStation(input.prepStation, {
            required: true,
          });
        }
        if (input.dietTags !== undefined) {
          item.dietTags = normalizeStringTags(input.dietTags, MENU_ITEM_DIET_TAGS, "dietTags");
        }
        if (input.allergenTags !== undefined) {
          item.allergenTags = normalizeStringTags(
            input.allergenTags,
            MENU_ITEM_ALLERGEN_TAGS,
            "allergenTags",
          );
        }
        if (input.foodType !== undefined) {
          item.foodType =
            normalizeEnumValue(input.foodType, MENU_ITEM_FOOD_TYPES, "foodType") ||
            "UNKNOWN";
        }
        if (input.meatTypes !== undefined) {
          item.meatTypes = normalizeEnumList(
            input.meatTypes,
            MENU_ITEM_MEAT_TYPES,
            "meatTypes",
          );
        }
        if (input.tasteProfile !== undefined) {
          item.tasteProfile = normalizeTasteProfile(input.tasteProfile);
        }

        if (input.status !== undefined) {
          if (input.status) assertStatus(input.status);
          item.status = input.status;
        }

        if (input.avgPrepTimeMin !== undefined) {
          const n = toNumOrUndef(input.avgPrepTimeMin);
          if (n !== undefined && n < 0)
            throw new GraphQLError("avgPrepTimeMin must be >= 0");
          item.avgPrepTimeMin = n;
        }

        if (input.point !== undefined) {
          const n = toNumOrUndef(input.point);
          if (n !== undefined && n < 0)
            throw new GraphQLError("point must be >= 0");
          item.point = n;
        }

        if (input.rate !== undefined) {
          const n = toNumOrUndef(input.rate);
          if (n !== undefined && (n < 0 || n > 5))
            throw new GraphQLError("rate must be between 0 and 5");
          item.rate = n;
        }

        if (input.orderCounter !== undefined) {
          const n = toNumOrUndef(input.orderCounter);
          if (n !== undefined && n < 0)
            throw new GraphQLError("orderCounter must be >= 0");
          item.orderCounter = n;
        }

        // ❗ ignore byWeight updates (deprecated, derived from recipe)
        // if (typeof input.byWeight === "boolean") { ... }  <-- removed

        // ✅ basePrice update = update default servingVariant price in Recipe
        if (input.basePrice !== undefined) {
          const nextPrice = toNumOrUndef(input.basePrice);
          if (nextPrice === undefined || nextPrice < 0) {
            throw new GraphQLError("basePrice must be a number >= 0");
          }

          const recipe = await Recipe.findOne({
            restaurantId: item.restaurantId,
            menuItemId: item._id,
          }).session(session);

          if (recipe) {
            const variants = Array.isArray(recipe.servingVariants)
              ? recipe.servingVariants
              : [];

            // pick default or first or create default
            let v = variants.find((x) => x?.isDefault) || variants[0] || null;

            if (!v) {
              variants.push(buildDefaultVariantFromBasePrice(nextPrice));
            } else {
              v.price = nextPrice;
              // do NOT change mode/sellUnit here; recipe editor handles that
            }

            recipe.servingVariants = variants;
            await recipe.save({ session });

            // sync menuItem.basePrice = min variant price
            const minPrice = computeMinVariantPrice(recipe.servingVariants);
            item.basePrice = minPrice;
          } else {
            // if somehow no recipe, still update cached basePrice
            item.basePrice = nextPrice;
          }
        }

        await item.save({ session });

        updatedItem = await MenuItem.findById(item._id)
          .lean({ virtuals: true, getters: true })
          .session(session);
      });
      await writeAuditLog({
        restaurantId: existing.restaurantId,
        entity: "MenuItem",
        entityId: updatedItem._id || updatedItem.id,
        action: "update",
        ctx,
        diff: {
          before: {
            categoryId: existing.categoryId,
            name: existing.name,
            description: existing.description,
            thumbImage: existing.thumbImage,
            prepStation: existing.prepStation,
            basePrice: existing.basePrice,
            status: existing.status,
            avgPrepTimeMin: existing.avgPrepTimeMin,
            point: existing.point,
            rate: existing.rate,
            orderCounter: existing.orderCounter,
            notes: existing.notes,
          },
          after: {
            categoryId: updatedItem.categoryId,
            name: updatedItem.name,
            description: updatedItem.description,
            thumbImage: updatedItem.thumbImage,
            prepStation: updatedItem.prepStation,
            basePrice: updatedItem.basePrice,
            status: updatedItem.status,
            avgPrepTimeMin: updatedItem.avgPrepTimeMin,
            point: updatedItem.point,
            rate: updatedItem.rate,
            orderCounter: updatedItem.orderCounter,
            notes: updatedItem.notes,
          },
        },
      });
      return updatedItem;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new GraphQLError(err?.message || "updateMenuItem failed");
    } finally {
      await session.endSession();
    }
  },

  deleteMenuItem: async (_, { id }, ctx) => {
    if (!isOid(id)) throw new GraphQLError("Invalid id");
    const existing = await MenuItem.findById(id).lean();
    if (!existing) return true;
    await requireMenuPermission(ctx, existing.restaurantId, MENU_PERMISSION.DELETE_ITEM);

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const item = await MenuItem.findById(id).session(session);
        if (!item) return;

        await Recipe.deleteOne({
          restaurantId: item.restaurantId,
          menuItemId: item._id,
        }).session(session);

        await MenuItem.deleteOne({ _id: item._id }).session(session);
        await writeAuditLog({
          restaurantId: item.restaurantId,
          entity: "MenuItem",
          entityId: item._id,
          action: "delete",
          ctx,
          session,
          diff: {
            restaurantId: item.restaurantId,
            menuId: item.menuId,
            categoryId: item.categoryId,
            name: item.name,
            prepStation: item.prepStation,
            basePrice: item.basePrice,
            status: item.status,
          },
        });
      });

      return true;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new GraphQLError(err?.message || "deleteMenuItem failed");
    } finally {
      await session.endSession();
    }
  },

  updateMenuItemBasic: async (_p, { input }, ctx) => {
    const { restaurantId, menuItemId, name, description, categoryId, status } =
      input || {};

    if (![restaurantId, menuItemId].every(isOid)) {
      throw new GraphQLError("Invalid ids");
    }
    if (categoryId && !isOid(categoryId)) {
      throw new GraphQLError("Invalid categoryId");
    }
    await requireMenuPermission(ctx, restaurantId, MENU_PERMISSION.UPDATE_ITEM);

    const patch = {};
    if (typeof name === "string") patch.name = name;
    if (typeof description === "string") patch.description = description;
    if (categoryId) patch.categoryId = categoryId;
    if (input.prepStation !== undefined) {
      patch.prepStation = normalizePrepStation(input.prepStation, {
        required: true,
      });
    }
    if (status !== undefined) {
      if (status) assertStatus(status);
      patch.status = status;
    }

    if (input.point !== undefined) {
      const n = toNumOrUndef(input.point);
      if (n !== undefined && n < 0)
        throw new GraphQLError("point must be >= 0");
      patch.point = n;
    }

    if (input.rate !== undefined) {
      const n = toNumOrUndef(input.rate);
      if (n !== undefined && (n < 0 || n > 5)) {
        throw new GraphQLError("rate must be between 0 and 5");
      }
      patch.rate = n;
    }

    if (input.orderCounter !== undefined) {
      const n = toNumOrUndef(input.orderCounter);
      if (n !== undefined && n < 0)
        throw new GraphQLError("orderCounter must be >= 0");
      patch.orderCounter = n;
    }
    if (input.dietTags !== undefined) {
      patch.dietTags = normalizeStringTags(input.dietTags, MENU_ITEM_DIET_TAGS, "dietTags");
    }
    if (input.allergenTags !== undefined) {
      patch.allergenTags = normalizeStringTags(
        input.allergenTags,
        MENU_ITEM_ALLERGEN_TAGS,
        "allergenTags",
      );
    }
    if (input.foodType !== undefined) {
      patch.foodType =
        normalizeEnumValue(input.foodType, MENU_ITEM_FOOD_TYPES, "foodType") ||
        "UNKNOWN";
    }
    if (input.meatTypes !== undefined) {
      patch.meatTypes = normalizeEnumList(
        input.meatTypes,
        MENU_ITEM_MEAT_TYPES,
        "meatTypes",
      );
    }
    if (input.tasteProfile !== undefined) {
      patch.tasteProfile = normalizeTasteProfile(input.tasteProfile);
    }
    const beforeItem = await MenuItem.findOne({
      _id: menuItemId,
      restaurantId,
    }).lean();
    const doc = await MenuItem.findOneAndUpdate(
      { _id: menuItemId, restaurantId },
      Object.keys(patch).length ? { $set: patch } : {},
      { new: true, runValidators: true },
    ).lean({ virtuals: true });

    if (!doc) throw new GraphQLError("MenuItem not found");
    await writeAuditLog({
      restaurantId,
      entity: "MenuItem",
      entityId: doc._id || doc.id,
      action: "update",
      ctx,
      diff: {
        type: "basic_update",
        before: beforeItem
          ? {
              name: beforeItem.name,
              description: beforeItem.description,
              categoryId: beforeItem.categoryId,
              prepStation: beforeItem.prepStation,
              status: beforeItem.status,
              point: beforeItem.point,
              rate: beforeItem.rate,
              orderCounter: beforeItem.orderCounter,
            }
          : null,
        after: {
          name: doc.name,
          description: doc.description,
          categoryId: doc.categoryId,
          prepStation: doc.prepStation,
          status: doc.status,
          point: doc.point,
          rate: doc.rate,
          orderCounter: doc.orderCounter,
        },
      },
    });
    return doc;
  },

  toggleMenuItemStatus: async (_, { id, status }, ctx) => {
    if (!isOid(id)) throw new GraphQLError("Invalid id");
    assertStatus(status);
    const existing = await MenuItem.findById(id).lean();
    if (!existing) throw new GraphQLError("MenuItem not found");
    await requireMenuPermission(ctx, existing.restaurantId, MENU_PERMISSION.UPDATE_ITEM);

    const item = await MenuItem.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, runValidators: true },
    ).lean({ virtuals: true });

    if (!item) throw new GraphQLError("MenuItem not found");
    await writeAuditLog({
      restaurantId: existing.restaurantId,
      entity: "MenuItem",
      entityId: item._id || item.id,
      action: "update",
      ctx,
      diff: {
        field: "status",
        before: existing.status,
        after: item.status,
      },
    });
    return item;
  },

  // ================================
  // BULK UPDATE PRICES
  // - Update Recipe.servingVariants.price (all variants)
  // - Sync MenuItem.basePrice = min variant price
  // ================================
  bulkUpdateMenuItemPrices: async (_, { input }, ctx) => {
    try {
      const {
        restaurantId,
        timeSlot,
        target,
        mode,
        value,
        roundTo = 0,
        floorZero = true,
      } = input || {};

      if (!isOid(restaurantId)) throw new GraphQLError("Invalid restaurantId");
      if (timeSlot) assertTimeSlot(timeSlot);
      await requireMenuPermission(ctx, restaurantId, MENU_PERMISSION.UPDATE_PRICE);

      if (
        !target ||
        (!target.categoryId && !Array.isArray(target.menuItemIds))
      ) {
        throw new GraphQLError("Provide categoryId or menuItemIds");
      }
      if (mode !== "PERCENT" && mode !== "AMOUNT") {
        throw new GraphQLError("mode must be PERCENT or AMOUNT");
      }

      const vNum = Number(value);
      if (!Number.isFinite(vNum))
        throw new GraphQLError("value must be a number");

      let menuId = null;
      if (timeSlot) {
        const menu = await Menu.findOne({ restaurantId, timeSlot }).lean();
        if (!menu) return { updatedCount: 0, items: [] };
        menuId = menu._id;
      }

      const q = { restaurantId };
      if (menuId) q.menuId = menuId;

      if (target.categoryId) {
        if (!isOid(target.categoryId))
          throw new GraphQLError("Invalid categoryId");
        q.categoryId = target.categoryId;
      }

      if (Array.isArray(target.menuItemIds) && target.menuItemIds.length > 0) {
        const validIds = target.menuItemIds.filter(isOid);
        if (!validIds.length) return { updatedCount: 0, items: [] };
        q._id = { $in: validIds };
      }

      const items = await MenuItem.find(q)
        .select({ _id: 1, restaurantId: 1 })
        .lean();
      if (!items.length) return { updatedCount: 0, items: [] };

      const menuItemIds = items.map((i) => i._id);

      // load recipes in one query
      const recipes = await Recipe.find({
        restaurantId,
        menuItemId: { $in: menuItemIds },
      }).lean();

      const recipeByMenuItemId = new Map(
        recipes.map((r) => [String(r.menuItemId), r]),
      );

      const recipeOps = [];
      const menuItemOps = [];

      const factor = mode === "PERCENT" ? vNum / 100 : null;

      for (const mi of items) {
        const r = recipeByMenuItemId.get(String(mi._id));

        // if no recipe, skip (or you can auto-create default recipe here)
        if (!r) continue;

        const variants = Array.isArray(r.servingVariants)
          ? r.servingVariants
          : [];
        if (!variants.length) continue;

        let changed = false;

        for (const v of variants) {
          const oldP = Number(v?.price);
          if (!Number.isFinite(oldP)) continue;

          let next = mode === "PERCENT" ? oldP * (1 + factor) : oldP + vNum;

          next = roundWith(next, roundTo);
          if (floorZero && next < 0) next = 0;

          if (next !== oldP) {
            v.price = next;
            changed = true;
          }
        }

        if (!changed) continue;

        const minPrice = computeMinVariantPrice(variants);

        recipeOps.push({
          updateOne: {
            filter: { _id: r._id },
            update: { $set: { servingVariants: variants } },
          },
        });

        menuItemOps.push({
          updateOne: {
            filter: { _id: mi._id },
            update: { $set: { basePrice: minPrice } },
          },
        });
      }

      if (recipeOps.length) {
        await Recipe.bulkWrite(recipeOps, { ordered: false });
      }
      if (menuItemOps.length) {
        await MenuItem.bulkWrite(menuItemOps, { ordered: false });
      }

      const updatedIds = menuItemOps.map((x) => x.updateOne.filter._id);
      const updatedItems = updatedIds.length
        ? await MenuItem.find({ _id: { $in: updatedIds } }).lean({
            virtuals: true,
          })
        : [];
      if (updatedItems.length) {
        await Promise.all(
          updatedItems.map((item) =>
            writeAuditLog({
              restaurantId: item.restaurantId,
              entity: "MenuItem",
              entityId: item._id || item.id,
              action: "update",
              ctx,
              diff: {
                type: "bulk_price_update",
                restaurantId,
                timeSlot,
                mode,
                value: vNum,
                roundTo,
                floorZero,
                basePriceAfter: item.basePrice,
              },
            }),
          ),
        );
      }
      return {
        updatedCount: updatedItems.length,
        items: updatedItems,
      };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new GraphQLError(err?.message || "Bulk update failed", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },
};
