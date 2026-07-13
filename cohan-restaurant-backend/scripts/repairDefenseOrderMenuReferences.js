import "dotenv/config.js";
import mongoose from "mongoose";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { MenuItem, Order, Restaurant } from "../models/index.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const CUSTOMER_ORDER_SEED_KEY = "customer-manager-demo";
const DEMO_RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "";
const PRIMARY_RESTAURANT_NAME = "Nhà hàng COHAN Thủ Đức";

const scriptPath = fileURLToPath(import.meta.url);
const idString = (value) => String(value?._id || value?.id || value || "");

function repairError(message) {
  return new Error(`DEFENSE_ORDER_REFERENCE_REPAIR_FAILED: ${message}`);
}

export function synchronizeOrderItemReferences(items = [], menuItemById = new Map()) {
  let changedItems = 0;

  const synchronizedItems = items.map((item) => {
    const dishId = idString(item?.dishId);
    const menuItem = menuItemById.get(dishId);
    if (!menuItem) {
      throw repairError(`missing MenuItem for dish ${dishId || "<empty>"}`);
    }
    if (!menuItem.menuId || !menuItem.categoryId) {
      throw repairError(`dish ${dishId} has incomplete menu/category references`);
    }

    const menuChanged = idString(item.menuId) !== idString(menuItem.menuId);
    const categoryChanged = idString(item.categoryId) !== idString(menuItem.categoryId);
    if (menuChanged || categoryChanged) changedItems += 1;

    return {
      ...item,
      menuId: menuItem.menuId,
      categoryId: menuItem.categoryId,
    };
  });

  return { items: synchronizedItems, changedItems };
}

async function resolveRestaurant() {
  if (DEMO_RESTAURANT_ID) {
    const restaurant = await Restaurant.findById(DEMO_RESTAURANT_ID).lean();
    if (!restaurant) {
      throw repairError(`restaurant ${DEMO_RESTAURANT_ID} was not found`);
    }
    return restaurant;
  }

  const restaurant = await Restaurant.findOne({
    name: PRIMARY_RESTAURANT_NAME,
    status: "active",
  }).lean();
  if (!restaurant) {
    throw repairError(`restaurant ${PRIMARY_RESTAURANT_NAME} was not found`);
  }
  return restaurant;
}

export async function repairDefenseOrderMenuReferences(restaurantId) {
  const orders = await Order.find({
    restaurantId,
    "clientMeta.demoTag": CUSTOMER_ORDER_SEED_KEY,
  })
    .select("_id items")
    .lean();

  const dishIds = [
    ...new Map(
      orders
        .flatMap((order) => order.items || [])
        .map((item) => [idString(item.dishId), item.dishId])
        .filter(([key]) => key),
    ).values(),
  ];

  const menuItems = await MenuItem.find({
    _id: { $in: dishIds },
    restaurantId,
    deletedAt: null,
  })
    .select("_id menuId categoryId")
    .lean();
  const menuItemById = new Map(
    menuItems.map((menuItem) => [idString(menuItem._id), menuItem]),
  );

  let updatedOrders = 0;
  let updatedItems = 0;

  for (const order of orders) {
    const result = synchronizeOrderItemReferences(order.items, menuItemById);
    if (!result.changedItems) continue;

    await Order.updateOne(
      { _id: order._id },
      { $set: { items: result.items } },
      { runValidators: true },
    );
    updatedOrders += 1;
    updatedItems += result.changedItems;
  }

  return {
    ordersChecked: orders.length,
    menuItemsResolved: menuItems.length,
    updatedOrders,
    updatedItems,
  };
}

async function main() {
  assertDemoScriptAllowed("repairDefenseOrderMenuReferences.js");
  const mongoUri =
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/RestaurantDB?replicaSet=rs0";
  const dbName = process.env.MONGO_DB || "RestaurantDB";

  console.log("Repairing defense order menu references:", safeDbInfo());
  await mongoose.connect(mongoUri, { dbName });
  try {
    const restaurant = await resolveRestaurant();
    const summary = await repairDefenseOrderMenuReferences(restaurant._id);
    console.table([summary]);
    console.log("✅ Defense order menu/category references repaired");
  } finally {
    await mongoose.disconnect();
  }
}

if (path.resolve(process.argv[1] || "") === scriptPath) {
  main().catch(async (error) => {
    console.error(error?.stack || error?.message || error);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exitCode = 1;
  });
}
