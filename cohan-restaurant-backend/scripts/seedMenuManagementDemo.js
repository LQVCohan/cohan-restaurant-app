import "dotenv/config.js";
import mongoose from "mongoose";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";
import {
  Category,
  CategoryMenu,
  Ingredient,
  Menu,
  MenuItem,
  Order,
  Recipe,
  Restaurant,
  StockItem,
  Warehouse,
} from "../models/index.js";

const TAG = "[demo-menu-management-2026]";
const DEMO_RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "";
const DEMO_RESET = process.env.DEMO_RESET === "1";

async function resolveRestaurant() {
  if (DEMO_RESTAURANT_ID) {
    const restaurant = await Restaurant.findById(DEMO_RESTAURANT_ID);
    if (!restaurant)
      throw new Error(`DEMO_RESTAURANT_NOT_FOUND: ${DEMO_RESTAURANT_ID}`);
    return restaurant;
  }
  const existing = await Restaurant.findOne({ status: "active" }).sort({
    createdAt: 1,
  });
  if (existing) return existing;
  return Restaurant.create({
    name: `Menu Demo Restaurant ${TAG}`,
    status: "active",
    description: `Auto-created for MenuManagement demo seed ${TAG}`,
  });
}

async function upsertOne(Model, filter, payload) {
  return Model.findOneAndUpdate(
    filter,
    { $set: payload },
    { new: true, upsert: true },
  );
}

function buildOrderItem(menuItem, recipe) {
  const defaultVariant =
    recipe.servingVariants.find((v) => v.isDefault) ||
    recipe.servingVariants[0];
  return {
    dishId: menuItem._id,
    menuId: menuItem.menuId,
    categoryId: menuItem.categoryId,
    name: menuItem.name,
    unit: "portion",
    servingKey: defaultVariant.key,
    servingVariant: {
      key: defaultVariant.key,
      name: defaultVariant.name,
      mode: defaultVariant.mode,
      price: defaultVariant.price,
      sellQty: defaultVariant.sellQty,
      sellUnit: defaultVariant.sellUnit,
    },
    quantity: 2,
    baseUnitPrice: defaultVariant.price,
    unitPrice: defaultVariant.price,
    lineSubtotal: defaultVariant.price * 2,
    ingredientsSnapshot: [],
    status: "served",
  };
}

async function main() {
  assertDemoScriptAllowed("seedMenuManagementDemo.js");
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
  const DB_NAME = process.env.MONGO_DB || "cohan";
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });

  const restaurant = await resolveRestaurant();
  const restaurantId = restaurant._id;

  if (DEMO_RESET) {
    await Promise.all([
      Order.deleteMany({ restaurantId, note: { $regex: TAG } }),
      Recipe.deleteMany({ restaurantId, notes: { $regex: TAG } }),
      MenuItem.deleteMany({ restaurantId, notes: { $regex: TAG } }),
      Menu.deleteMany({ restaurantId, description: { $regex: TAG } }),
      Category.deleteMany({ restaurantId, name: { $regex: TAG } }),
      CategoryMenu.deleteMany({ restaurantId, description: { $regex: TAG } }),
      Ingredient.deleteMany({ restaurantId, notes: { $regex: TAG } }),
    ]);
  }

  const [breakfastGroup, lunchGroup, dinnerGroup] = await Promise.all([
    upsertOne(
      CategoryMenu,
      { restaurantId, name: "Morning Comfort" },
      { restaurantId, name: "Morning Comfort", icon: "☀️", description: TAG },
    ),
    upsertOne(
      CategoryMenu,
      { restaurantId, name: "Lunch Express" },
      { restaurantId, name: "Lunch Express", icon: "🥗", description: TAG },
    ),
    upsertOne(
      CategoryMenu,
      { restaurantId, name: "Night Specials" },
      { restaurantId, name: "Night Specials", icon: "🌙", description: TAG },
    ),
  ]);

  const menuDefs = [
    ["breakfast", "Breakfast Menu", breakfastGroup._id],
    ["lunch", "Lunch Menu", lunchGroup._id],
    ["dinner", "Dinner Menu", dinnerGroup._id],
    ["late_night", "Late Night Menu", dinnerGroup._id],
  ];
  const menus = {};
  for (const [timeSlot, name, categoryMenuId] of menuDefs) {
    menus[timeSlot] = await upsertOne(
      Menu,
      { restaurantId, timeSlot },
      {
        restaurantId,
        timeSlot,
        name,
        description: `Seeded ${TAG}`,
        isActive: true,
        categoryMenuId,
      },
    );
  }

  const categories = {
    noodle: await upsertOne(
      Category,
      { restaurantId, name: `Noodles ${TAG}` },
      { restaurantId, name: `Noodles ${TAG}`, icon: "🍜", isActive: true },
    ),
    drink: await upsertOne(
      Category,
      { restaurantId, name: `Drinks ${TAG}` },
      { restaurantId, name: `Drinks ${TAG}`, icon: "🥤", isActive: true },
    ),
    grill: await upsertOne(
      Category,
      { restaurantId, name: `Grill ${TAG}` },
      { restaurantId, name: `Grill ${TAG}`, icon: "🔥", isActive: true },
    ),
  };

  const warehouse = await upsertOne(
    Warehouse,
    { restaurantId, name: "Main Demo Warehouse" },
    {
      restaurantId,
      name: "Main Demo Warehouse",
      code: "WH-DEMO-01",
      isActive: true,
    },
  );

  const ingredientDefs = [
    {
      name: `Rice Noodle ${TAG}`,
      baseUnit: "g",
      minStock: 1000,
      costPerBaseUnit: 0.03,
    },
    {
      name: `Beef Slice ${TAG}`,
      baseUnit: "g",
      minStock: 3000,
      costPerBaseUnit: 0.12,
    },
    {
      name: `Milk Tea Base ${TAG}`,
      baseUnit: "ml",
      minStock: 4000,
      costPerBaseUnit: 0.02,
    },
  ];
  const ingredients = {};
  for (const def of ingredientDefs) {
    const ing = await upsertOne(
      Ingredient,
      { restaurantId, name: def.name },
      { restaurantId, ...def, notes: TAG },
    );
    ingredients[def.name] = ing;
  }

  const menuItemDefs = [
    {
      code: "MM-PHO",
      name: `Pho Signature ${TAG}`,
      menu: menus.breakfast,
      category: categories.noodle,
      status: "available",
      price: 65000,
    },
    {
      code: "MM-TEA",
      name: `Milk Tea Classic ${TAG}`,
      menu: menus.lunch,
      category: categories.drink,
      status: "unavailable",
      price: 42000,
    },
    {
      code: "MM-BEEF",
      name: `Beef Grill Plate ${TAG}`,
      menu: menus.dinner,
      category: categories.grill,
      status: "out_of_stock",
      price: 92000,
    },
    {
      code: "MM-SOUP",
      name: `Night Soup ${TAG}`,
      menu: menus.late_night,
      category: categories.noodle,
      status: "hidden",
      price: 39000,
    },
  ];

  const createdItems = [];
  for (const def of menuItemDefs) {
    const item = await upsertOne(
      MenuItem,
      {
        restaurantId,
        menuId: def.menu._id,
        categoryId: def.category._id,
        name: def.name,
      },
      {
        restaurantId,
        menuId: def.menu._id,
        categoryId: def.category._id,
        code: def.code,
        name: def.name,
        description: `Demo item ${TAG}`,
        status: def.status,
        basePrice: def.price,
        defaultServingKey: "regular",
        hasByWeightVariant: true,
        notes: TAG,
      },
    );
    createdItems.push(item);

    await upsertOne(
      Recipe,
      { restaurantId, menuItemId: item._id },
      {
        restaurantId,
        menuItemId: item._id,
        notes: TAG,
        servingVariants: [
          {
            key: "regular",
            name: "Regular",
            mode: "PORTION",
            sellQty: 1,
            sellUnit: "portion",
            price: def.price,
            isDefault: true,
            ingredients: [
              {
                ingredientId: ingredients[`Rice Noodle ${TAG}`]._id,
                qty: 120,
                unit: "g",
                wastePct: 5,
              },
            ],
          },
          {
            key: "by_weight",
            name: "By Weight",
            mode: "BY_WEIGHT",
            sellQty: 100,
            sellUnit: "g",
            price: Math.round(def.price / 2),
            isDefault: false,
            ingredients: [
              {
                ingredientId: ingredients[`Beef Slice ${TAG}`]._id,
                qty: 80,
                unit: "g",
                wastePct: 3,
              },
            ],
          },
        ],
      },
    );
  }

  await upsertOne(
    StockItem,
    {
      restaurantId,
      warehouseId: warehouse._id,
      ingredientId: ingredients[`Rice Noodle ${TAG}`]._id,
    },
    {
      restaurantId,
      warehouseId: warehouse._id,
      ingredientId: ingredients[`Rice Noodle ${TAG}`]._id,
      onHand: 5000,
      reserved: 100,
    },
  );
  await upsertOne(
    StockItem,
    {
      restaurantId,
      warehouseId: warehouse._id,
      ingredientId: ingredients[`Milk Tea Base ${TAG}`]._id,
    },
    {
      restaurantId,
      warehouseId: warehouse._id,
      ingredientId: ingredients[`Milk Tea Base ${TAG}`]._id,
      onHand: 4200,
      reserved: 200,
    },
  );
  await upsertOne(
    StockItem,
    {
      restaurantId,
      warehouseId: warehouse._id,
      ingredientId: ingredients[`Beef Slice ${TAG}`]._id,
    },
    {
      restaurantId,
      warehouseId: warehouse._id,
      ingredientId: ingredients[`Beef Slice ${TAG}`]._id,
      onHand: 0,
      reserved: 0,
    },
  );

  const orderItemSource = createdItems[0];
  const orderRecipe = await Recipe.findOne({
    restaurantId,
    menuItemId: orderItemSource._id,
  }).lean();
  const item = buildOrderItem(orderItemSource, orderRecipe);

  await upsertOne(
    Order,
    {
      restaurantId,
      orderCode: `MM-DEMO-SERVED-${new Date().toISOString().slice(0, 10)}`,
    },
    {
      restaurantId,
      orderCode: `MM-DEMO-SERVED-${new Date().toISOString().slice(0, 10)}`,
      orderType: "dine_in",
      currentStatus: "served",
      kitchenStatus: "served",
      orderPaymentStatus: "paid",
      items: [item],
      totals: {
        subtotal: item.lineSubtotal,
        discount: 0,
        tax: 0,
        service: 0,
        grandTotal: item.lineSubtotal,
      },
      payment: {
        method: "cash",
        status: "paid",
        paidAmount: item.lineSubtotal,
      },
      statusTimeline: [{ status: "served", note: TAG }],
      note: `seed ${TAG}`,
    },
  );

  await upsertOne(
    Order,
    {
      restaurantId,
      orderCode: `MM-DEMO-COMPLETED-${new Date().toISOString().slice(0, 10)}`,
    },
    {
      restaurantId,
      orderCode: `MM-DEMO-COMPLETED-${new Date().toISOString().slice(0, 10)}`,
      orderType: "dine_in",
      currentStatus: "completed",
      kitchenStatus: "served",
      orderPaymentStatus: "paid",
      items: [item],
      totals: {
        subtotal: item.lineSubtotal,
        discount: 0,
        tax: 0,
        service: 0,
        grandTotal: item.lineSubtotal,
      },
      payment: {
        method: "cash",
        status: "paid",
        paidAmount: item.lineSubtotal,
      },
      statusTimeline: [{ status: "completed", note: TAG }],
      note: `seed ${TAG}`,
    },
  );

  console.log(
    `[seed:demo:menu-management] done for restaurant=${restaurantId}`,
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[seed:demo:menu-management] failed", error);
  await mongoose.disconnect();
  process.exit(1);
});
