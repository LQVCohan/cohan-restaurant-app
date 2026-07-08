import "dotenv/config.js";
import mongoose from "mongoose";
import process from "node:process";
import { Ingredient, Restaurant, StockItem, StockMovement, Warehouse } from "../models/index.js";
import { safeDbInfo } from "./lib/scriptSafety.js";

const SCRIPT_NAME = "seedRestaurantIngredientStock.js";
const RESTAURANT_ID = "69ce9e2e8d8d711f12e251b1";
const EXPECTED_RESTAURANT_NAME = "Cohan Restaurant";
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

const BUFFER_BY_UNIT = {
  g: 20000,
  kg: 20,
  ml: 20000,
  l: 20,
  unit: 200,
  piece: 200,
  pack: 100,
  bottle: 100,
  can: 100,
  tbsp: 1000,
  tsp: 1000,
};

function getArgValue(prefix) {
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : "";
}

function toObjectId(value, label) {
  if (!mongoose.isValidObjectId(value)) throw new Error(`${label} không hợp lệ: ${value}`);
  return new mongoose.Types.ObjectId(value);
}

function getVietnamDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getTargetAvailable(ingredient) {
  const minStock = Math.max(0, Number(ingredient.minStock || 0));
  const buffer = BUFFER_BY_UNIT[ingredient.baseUnit] || 1000;
  return Math.ceil(minStock + buffer);
}

async function resolveWarehouse(restaurantId, requestedWarehouseId) {
  if (requestedWarehouseId) {
    const warehouse = await Warehouse.findOne({
      _id: toObjectId(requestedWarehouseId, "warehouseId"),
      restaurantId,
      isActive: { $ne: false },
    }).lean();
    if (!warehouse) throw new Error("Không tìm thấy kho active thuộc nhà hàng này.");
    return warehouse;
  }

  const warehouse = await Warehouse.findOne({
    restaurantId,
    isActive: { $ne: false },
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (!warehouse) throw new Error("Nhà hàng chưa có kho active để seed tồn kho.");
  return warehouse;
}

async function buildPlan({ restaurant, warehouse, receivedAt, seedDate }) {
  const ingredients = await Ingredient.find({
    restaurantId: restaurant._id,
    isActive: { $ne: false },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  })
    .sort({ name: 1, _id: 1 })
    .lean();

  if (!ingredients.length) throw new Error("Không có nguyên liệu active để seed tồn kho.");

  const stockItems = await StockItem.find({
    restaurantId: restaurant._id,
    warehouseId: warehouse._id,
    ingredientId: { $in: ingredients.map((ingredient) => ingredient._id) },
  })
    .select({ ingredientId: 1, onHand: 1, reserved: 1 })
    .lean();

  const existingMovements = await StockMovement.find({
    restaurantId: restaurant._id,
    warehouseId: warehouse._id,
    "meta.script": SCRIPT_NAME,
    "meta.seedDate": seedDate,
  })
    .select({ ingredientId: 1 })
    .lean();

  const stockByIngredientId = new Map(
    stockItems.map((stock) => [String(stock.ingredientId), stock]),
  );
  const seededIngredientIds = new Set(
    existingMovements.map((movement) => String(movement.ingredientId)),
  );

  return ingredients.map((ingredient) => {
    const ingredientId = String(ingredient._id);
    const stock = stockByIngredientId.get(ingredientId);
    const currentOnHand = Math.max(0, Number(stock?.onHand || 0));
    const reserved = Math.max(0, Number(stock?.reserved || 0));
    const targetAvailable = getTargetAvailable(ingredient);
    const targetOnHand = Math.ceil(targetAvailable + reserved);
    const qtyToReceive = Math.max(0, targetOnHand - currentOnHand);
    const suffix = String(ingredient.sku || ingredient._id).replace(/[^a-zA-Z0-9]/g, "").slice(-12);
    const lot = `SEED-${seedDate.replaceAll("-", "")}-${suffix}`;
    const costPerBaseUnit = Math.max(0, Number(ingredient.costPerBaseUnit || 0));

    return {
      ingredient,
      currentOnHand,
      reserved,
      targetAvailable,
      targetOnHand,
      qtyToReceive,
      lot,
      costPerBaseUnit,
      totalValue: qtyToReceive * costPerBaseUnit,
      receivedAt,
      alreadySeededToday: seededIngredientIds.has(ingredientId),
    };
  });
}

async function applyPlan({ restaurant, warehouse, rows, seedDate, receivedAt }) {
  const applicableRows = rows.filter(
    (row) => !row.alreadySeededToday && row.qtyToReceive > 0,
  );
  if (!applicableRows.length) return 0;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const row of applicableRows) {
        const filter = {
          restaurantId: restaurant._id,
          warehouseId: warehouse._id,
          ingredientId: row.ingredient._id,
        };

        await StockItem.findOneAndUpdate(
          filter,
          {
            $set: {
              onHand: row.targetOnHand,
              costPerUnit: row.costPerBaseUnit,
              note: `Nhập kho khởi tạo ngày ${seedDate} (${row.ingredient.baseUnit}).`,
            },
            $setOnInsert: {
              ...filter,
              reserved: 0,
              pricePerUnit: 0,
            },
            $push: {
              batches: {
                lot: row.lot,
                qty: row.qtyToReceive,
                costPerBaseUnit: row.costPerBaseUnit,
              },
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
            session,
          },
        );

        await StockMovement.create(
          [
            {
              ...filter,
              type: "inbound",
              qty: row.qtyToReceive,
              reason: `Nhập kho khởi tạo ngày ${seedDate}`,
              meta: {
                script: SCRIPT_NAME,
                seedDate,
                receivedAt,
                lot: row.lot,
                expiry: null,
                supplierNote: "Nguồn nhập khởi tạo dữ liệu tồn kho nhà hàng",
                ingredientName: row.ingredient.name,
                sku: row.ingredient.sku || null,
                baseUnit: row.ingredient.baseUnit,
                costPerBaseUnit: row.costPerBaseUnit,
                totalValue: row.totalValue,
                beforeOnHand: row.currentOnHand,
                targetOnHand: row.targetOnHand,
                targetAvailable: row.targetAvailable,
                reservedPreserved: row.reserved,
              },
              createdAt: receivedAt,
              updatedAt: receivedAt,
            },
          ],
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return applicableRows.length;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const requestedWarehouseId = getArgValue("--warehouseId=");
  const receivedAt = new Date();
  const seedDate = getVietnamDateKey(receivedAt);

  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");

  const dbName = process.env.MONGO_DB?.trim();
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(process.env.MONGO_URI, dbName ? { dbName } : {});

  try {
    const restaurant = await Restaurant.findById(RESTAURANT_ID)
      .select({ _id: 1, name: 1, brandId: 1 })
      .lean();
    if (!restaurant) throw new Error(`Không tìm thấy nhà hàng ${RESTAURANT_ID}`);
    if (restaurant.name !== EXPECTED_RESTAURANT_NAME) {
      throw new Error(
        `Sai nhà hàng: expected "${EXPECTED_RESTAURANT_NAME}", got "${restaurant.name}"`,
      );
    }

    const warehouse = await resolveWarehouse(restaurant._id, requestedWarehouseId);
    const rows = await buildPlan({ restaurant, warehouse, receivedAt, seedDate });
    const pendingRows = rows.filter(
      (row) => !row.alreadySeededToday && row.qtyToReceive > 0,
    );

    console.log({
      mode: apply ? "apply" : "validate-only",
      seedDate,
      receivedAt: receivedAt.toISOString(),
      restaurant: restaurant.name,
      restaurantId: String(restaurant._id),
      warehouse: warehouse.name,
      warehouseId: String(warehouse._id),
      ingredients: rows.length,
      pendingInboundRows: pendingRows.length,
      alreadySeededToday: rows.filter((row) => row.alreadySeededToday).length,
    });

    console.table(
      rows.slice(0, 20).map((row) => ({
        ingredient: row.ingredient.name,
        unit: row.ingredient.baseUnit,
        current: row.currentOnHand,
        reserved: row.reserved,
        target: row.targetOnHand,
        inbound: row.qtyToReceive,
        status: row.alreadySeededToday
          ? "seeded-today"
          : row.qtyToReceive > 0
            ? "pending"
            : "enough-stock",
      })),
    );

    if (!apply) {
      console.log("Không ghi DB. Chạy lại với --apply để seed tồn kho.");
      return;
    }

    const changedRows = await applyPlan({
      restaurant,
      warehouse,
      rows,
      seedDate,
      receivedAt,
    });
    console.log(`Đã nhập kho ${changedRows} nguyên liệu cho ngày ${seedDate}.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error(error?.stack || error?.message || error);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  process.exitCode = 1;
});
