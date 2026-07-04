import mongoose from "mongoose";
import dotenv from "dotenv";
import { MenuItem, Order } from "../../models/index.js";

dotenv.config();

const ACTIVE_ORDER_STATUSES = ["draft", "pending", "confirmed", "preparing"];
const VALID_STATIONS = new Set(["kitchen", "bar"]);
const apply = process.argv.includes("--apply");
const restaurantIdArg = String(
  process.argv.find((value) => value.startsWith("--restaurant-id="))?.split("=")[1] || "",
).trim();

if (restaurantIdArg && !mongoose.isValidObjectId(restaurantIdArg)) {
  throw new Error("Invalid --restaurant-id");
}

const mongoUri =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/RestaurantDB";
const dbName = process.env.MONGO_DB || "RestaurantDB";

await mongoose.connect(mongoUri, { dbName });

try {
  const orderQuery = {
    currentStatus: { $in: ACTIVE_ORDER_STATUSES },
    items: {
      $elemMatch: {
        $or: [
          { prepStation: { $exists: false } },
          { prepStation: null },
          { prepStation: { $nin: ["kitchen", "bar"] } },
        ],
      },
    },
  };
  if (restaurantIdArg) {
    orderQuery.restaurantId = new mongoose.Types.ObjectId(restaurantIdArg);
  }

  const orders = await Order.find(orderQuery)
    .select({ _id: 1, orderCode: 1, restaurantId: 1, currentStatus: 1, items: 1 })
    .lean();

  const dishIds = [
    ...new Set(
      orders.flatMap((order) =>
        (order.items || [])
          .filter(
            (item) =>
              !VALID_STATIONS.has(String(item?.prepStation || "").toLowerCase()) &&
              item?.dishId,
          )
          .map((item) => String(item.dishId)),
      ),
    ),
  ].filter((id) => mongoose.isValidObjectId(id));

  const menuItems = dishIds.length
    ? await MenuItem.find({ _id: { $in: dishIds } })
        .select({ _id: 1, restaurantId: 1, name: 1, prepStation: 1 })
        .lean()
    : [];
  const menuItemById = new Map(
    menuItems.map((item) => [String(item._id), item]),
  );

  const operations = [];
  const preview = [];
  const unresolved = [];

  for (const order of orders) {
    for (const item of order.items || []) {
      if (VALID_STATIONS.has(String(item?.prepStation || "").toLowerCase())) {
        continue;
      }

      const menuItem = menuItemById.get(String(item?.dishId || ""));
      const station = String(menuItem?.prepStation || "").toLowerCase();
      const sameRestaurant =
        menuItem && String(menuItem.restaurantId) === String(order.restaurantId);

      if (!sameRestaurant || !VALID_STATIONS.has(station)) {
        unresolved.push({
          orderId: String(order._id),
          orderCode: order.orderCode,
          orderItemId: String(item?._id || ""),
          dishId: String(item?.dishId || ""),
          itemName: item?.name || "",
          reason: !menuItem
            ? "menu_item_not_found"
            : !sameRestaurant
              ? "restaurant_mismatch"
              : "menu_item_station_missing",
        });
        continue;
      }

      preview.push({
        orderId: String(order._id),
        orderCode: order.orderCode,
        status: order.currentStatus,
        orderItemId: String(item._id),
        itemName: item.name,
        station,
      });
      operations.push({
        updateOne: {
          filter: { _id: order._id },
          update: {
            $set: { "items.$[target].prepStation": station },
          },
          arrayFilters: [{ "target._id": item._id }],
        },
      });
    }
  }

  console.log(
    `${apply ? "APPLY" : "DRY RUN"}: ${preview.length} order item snapshot(s) across ${orders.length} active order(s)`,
  );
  console.table(preview.slice(0, 50));

  if (unresolved.length) {
    console.log(`Unresolved: ${unresolved.length}`);
    console.table(unresolved.slice(0, 50));
  }

  if (apply && operations.length) {
    const result = await Order.bulkWrite(operations, { ordered: false });
    console.log(`Updated order item snapshots: ${result.modifiedCount || 0}`);
  }

  if (apply && unresolved.length) {
    process.exitCode = 2;
  }
} finally {
  await mongoose.disconnect();
}
