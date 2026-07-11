import mongoose from "mongoose";
import {
  Category,
  Menu,
  MenuItem,
  Recipe,
  Supply,
} from "../../models/index.js";

const SUPPLY_CATEGORY_NAME = "Nước & hàng bán kèm";
const SUPPLY_CATEGORY_ICON = "🥤";
const SUPPLY_SERVING_KEY = "supply_unit";
const ACTIVE_SUPPLY_FILTER = {
  isActive: true,
  pricePerUnit: { $gt: 0 },
  $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
};

const toObjectId = (value) =>
  mongoose.isValidObjectId(String(value || ""))
    ? new mongoose.Types.ObjectId(String(value))
    : null;

const buildSupplyDescription = (supply) => {
  const note = String(supply?.notes || "").trim();
  const availability = "Mặt hàng bán kèm, phục vụ ở tất cả các buổi.";
  return note ? `${availability} ${note}` : availability;
};

export async function syncOrderableSuppliesToMenus(restaurantId) {
  const rid = toObjectId(restaurantId);
  if (!rid) return;

  const [menus, supplies] = await Promise.all([
    Menu.find({ restaurantId: rid, isActive: true })
      .select({ _id: 1 })
      .lean(),
    Supply.find({ restaurantId: rid, ...ACTIVE_SUPPLY_FILTER })
      .select({
        _id: 1,
        name: 1,
        sku: 1,
        notes: 1,
        photos: 1,
        pricePerUnit: 1,
      })
      .lean(),
  ]);

  const activeSupplyIds = supplies.map((supply) => supply._id);
  await MenuItem.updateMany(
    {
      restaurantId: rid,
      sourceType: "supply",
      ...(activeSupplyIds.length
        ? { supplyId: { $nin: activeSupplyIds } }
        : {}),
    },
    { $set: { status: "hidden" } },
  );

  if (!menus.length || !supplies.length) return;

  const category = await Category.findOneAndUpdate(
    { restaurantId: rid, name: SUPPLY_CATEGORY_NAME },
    {
      $set: {
        icon: SUPPLY_CATEGORY_ICON,
        isActive: true,
      },
      $setOnInsert: { order: 900 },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  for (const menu of menus) {
    for (const supply of supplies) {
      const price = Number(supply.pricePerUnit || 0);
      const menuItem = await MenuItem.findOneAndUpdate(
        {
          restaurantId: rid,
          menuId: menu._id,
          supplyId: supply._id,
        },
        {
          $set: {
            categoryId: category._id,
            sourceType: "supply",
            code: supply.sku || undefined,
            name: supply.name,
            description: buildSupplyDescription(supply),
            basePrice: price,
            defaultServingKey: SUPPLY_SERVING_KEY,
            hasByWeightVariant: false,
            prepStation: "bar",
            thumbImage: supply.photos?.[0] || undefined,
            status: "available",
            servingPortion: 1,
            servingUnit: "đơn vị",
            avgPrepTimeMin: 0,
          },
          $setOnInsert: {
            restaurantId: rid,
            menuId: menu._id,
            supplyId: supply._id,
            sortOrder: 900,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      await Recipe.findOneAndUpdate(
        { restaurantId: rid, menuItemId: menuItem._id },
        {
          $set: {
            isActive: true,
            deletedAt: null,
            deleteExpiresAt: null,
            notes: "Tự động đồng bộ từ vật phẩm bán kèm.",
            servingVariants: [
              {
                key: SUPPLY_SERVING_KEY,
                name: "Đơn vị",
                mode: "PORTION",
                sellQty: 1,
                sellUnit: "portion",
                ingredients: [],
                price,
                isDefault: true,
              },
            ],
          },
          $setOnInsert: {
            restaurantId: rid,
            menuItemId: menuItem._id,
          },
        },
        { upsert: true, setDefaultsOnInsert: true },
      );
    }
  }
}

export const ORDERABLE_SUPPLY_MENU_COPY = {
  categoryName: SUPPLY_CATEGORY_NAME,
  availability: "Có trong tất cả các buổi",
};
