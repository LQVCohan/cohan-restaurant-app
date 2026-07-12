import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { Menu, MenuItem, Recipe, AuditLog } from "../../../models/index.js";
import { MENU_PERMISSION, requireMenuPermission } from "./menuPermission.js";

const TIME_SLOTS = ["breakfast", "lunch", "dinner", "late_night"];

function isOid(value) {
  return mongoose.isValidObjectId(value);
}

function assertTimeSlot(timeSlot) {
  if (!TIME_SLOTS.includes(timeSlot)) {
    throw new GraphQLError("Invalid timeSlot", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
}

function getActorId(ctx) {
  return ctx?.user?.id || ctx?.user?._id || null;
}

function clonePlain(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function buildCopiedItemPayload(sourceItem, targetMenuId) {
  return {
    restaurantId: sourceItem.restaurantId,
    menuId: targetMenuId,
    categoryId: sourceItem.categoryId,
    code: undefined,
    name: sourceItem.name,
    description: sourceItem.description,
    sortOrder: sourceItem.sortOrder,
    labels: clonePlain(sourceItem.labels || []),
    foodType: sourceItem.foodType || "UNKNOWN",
    meatTypes: clonePlain(sourceItem.meatTypes || []),
    dietTags: clonePlain(sourceItem.dietTags || []),
    allergenTags: clonePlain(sourceItem.allergenTags || []),
    tasteProfile: clonePlain(sourceItem.tasteProfile),
    basePrice: sourceItem.basePrice,
    defaultServingKey: sourceItem.defaultServingKey,
    hasByWeightVariant: sourceItem.hasByWeightVariant,
    taxRate: sourceItem.taxRate,
    servingPortion: sourceItem.servingPortion,
    servingUnit: sourceItem.servingUnit,
    prepStation: sourceItem.prepStation,
    printStationId: sourceItem.printStationId,
    thumbImage: sourceItem.thumbImage,
    mediaAssetIds: clonePlain(sourceItem.mediaAssetIds || []),
    status: sourceItem.status,
    avgPrepTimeMin: sourceItem.avgPrepTimeMin,
    point: sourceItem.point,
    rate: sourceItem.rate,
    orderCounter: 0,
    notes: sourceItem.notes,
  };
}

async function resolveSourceMenu({ restaurantId, sourceMenuId, sourceTimeSlot }) {
  if (sourceMenuId) {
    return Menu.findOne({ _id: sourceMenuId, restaurantId }).lean();
  }

  assertTimeSlot(sourceTimeSlot);
  const matchingMenus = await Menu.find({
    restaurantId,
    timeSlot: sourceTimeSlot,
  })
    .limit(2)
    .lean();

  if (matchingMenus.length > 1) {
    throw new GraphQLError(
      "Khung giờ nguồn có nhiều thực đơn. Vui lòng chọn sourceMenuId trước khi sao chép.",
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }
  return matchingMenus[0] || null;
}

export const CopyMenuMutation = {
  copyMenu: async (_, { input }, ctx) => {
    const {
      restaurantId,
      sourceMenuId,
      sourceTimeSlot,
      targetTimeSlot,
      name,
      description,
      coverImage,
      categoryMenuId,
      isActive = false,
      copyItems = true,
      copyRecipes = true,
    } = input || {};

    if (!isOid(restaurantId)) throw new GraphQLError("Invalid restaurantId");
    if (sourceMenuId && !isOid(sourceMenuId)) {
      throw new GraphQLError("Invalid sourceMenuId");
    }
    assertTimeSlot(targetTimeSlot);
    if (sourceTimeSlot) assertTimeSlot(sourceTimeSlot);
    if (!sourceMenuId && !sourceTimeSlot) {
      throw new GraphQLError("sourceMenuId or sourceTimeSlot is required", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    if (categoryMenuId && !isOid(categoryMenuId)) {
      throw new GraphQLError("Invalid categoryMenuId");
    }

    await requireMenuPermission(ctx, restaurantId, MENU_PERMISSION.COPY_MENU);

    const sourceMenu = await resolveSourceMenu({
      restaurantId,
      sourceMenuId,
      sourceTimeSlot,
    });
    if (!sourceMenu) throw new GraphQLError("Source menu not found");

    const session = await mongoose.startSession();
    try {
      let targetMenu = null;
      let copiedItemCount = 0;
      let copiedRecipeCount = 0;

      await session.withTransaction(async () => {
        targetMenu = await Menu.create(
          [
            {
              restaurantId,
              timeSlot: targetTimeSlot,
              name: name || `${sourceMenu.name || "Menu"} (bản sao)`,
              description:
                description !== undefined
                  ? description
                  : sourceMenu.description,
              coverImage:
                coverImage !== undefined ? coverImage : sourceMenu.coverImage,
              categoryMenuId:
                categoryMenuId !== undefined
                  ? categoryMenuId || null
                  : sourceMenu.categoryMenuId,
              isActive: typeof isActive === "boolean" ? isActive : false,
            },
          ],
          { session },
        ).then((rows) => rows[0]);

        if (!copyItems) return;

        const sourceItems = await MenuItem.find({
          restaurantId,
          menuId: sourceMenu._id,
        })
          .lean()
          .session(session);

        if (!sourceItems.length) return;

        const insertedItems = await MenuItem.insertMany(
          sourceItems.map((item) =>
            buildCopiedItemPayload(item, targetMenu._id),
          ),
          { session, ordered: true },
        );

        copiedItemCount = insertedItems.length;

        if (!copyRecipes || !insertedItems.length) return;

        const sourceItemIds = sourceItems.map((item) => item._id);
        const recipes = await Recipe.find({
          restaurantId,
          menuItemId: { $in: sourceItemIds },
        })
          .lean()
          .session(session);

        const newItemByOldItemId = new Map(
          sourceItems.map((sourceItem, index) => [
            String(sourceItem._id),
            insertedItems[index],
          ]),
        );

        const recipePayloads = recipes
          .map((recipe) => {
            const targetItem = newItemByOldItemId.get(
              String(recipe.menuItemId),
            );
            if (!targetItem) return null;
            return {
              restaurantId,
              menuItemId: targetItem._id,
              servingVariants: clonePlain(recipe.servingVariants || []),
              notes: recipe.notes || "",
              isActive:
                typeof recipe.isActive === "boolean"
                  ? recipe.isActive
                  : true,
            };
          })
          .filter(Boolean);

        if (recipePayloads.length) {
          const insertedRecipes = await Recipe.insertMany(recipePayloads, {
            session,
            ordered: true,
          });
          copiedRecipeCount = insertedRecipes.length;
        }
      });

      const targetMenuDoc = await Menu.findById(targetMenu._id).lean({
        virtuals: true,
      });

      await AuditLog.create({
        restaurantId,
        entity: "Menu",
        entityId: targetMenuDoc._id,
        action: "create",
        byUserId: getActorId(ctx),
        diff: {
          type: "copy_menu",
          sourceMenuId: sourceMenu._id,
          sourceTimeSlot: sourceMenu.timeSlot,
          targetTimeSlot,
          copiedItemCount,
          copiedRecipeCount,
        },
      });

      return targetMenuDoc;
    } catch (error) {
      throw new GraphQLError(error?.message || "copyMenu failed", {
        extensions: error?.extensions || { code: "COPY_MENU_FAILED" },
      });
    } finally {
      await session.endSession();
    }
  },
};
