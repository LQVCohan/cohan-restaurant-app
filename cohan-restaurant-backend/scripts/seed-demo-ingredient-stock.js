import "dotenv/config.js";
import mongoose from "mongoose";
import process from "process";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

import {
  Ingredient,
  Restaurant,
  Warehouse,
  StockItem,
  StockMovement,
} from "../models/index.js";

const DEFAULT_TARGET_BY_UNIT = {
  g: 50000,
  kg: 50,
  ml: 50000,
  l: 50,

  unit: 500,
  piece: 500,
  pack: 300,
  bottle: 300,
  can: 300,

  tbsp: 2000,
  tsp: 2000,
};

function parseArgs(argv = []) {
  const args = {};

  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;

    const [key, ...rest] = raw.slice(2).split("=");
    const value = rest.length ? rest.join("=") : "true";
    args[key] = value;
  }

  return args;
}

function toObjectId(value, fieldName) {
  if (!value) return null;

  if (!mongoose.isValidObjectId(value)) {
    throw new Error(`${fieldName} không hợp lệ: ${value}`);
  }

  return new mongoose.Types.ObjectId(value);
}

function getDefaultTarget(baseUnit, multiplier = 1) {
  const unit = String(baseUnit || "")
    .trim()
    .toLowerCase();
  const base = DEFAULT_TARGET_BY_UNIT[unit] || 1000;
  return Math.max(1, Math.round(base * multiplier));
}

async function resolveRestaurant({ restaurantId }) {
  if (restaurantId) {
    const restaurant = await Restaurant.findById(restaurantId).lean();
    if (!restaurant) {
      throw new Error(`Không tìm thấy restaurantId=${restaurantId}`);
    }
    return restaurant;
  }

  const restaurant = await Restaurant.findOne({}).sort({ createdAt: 1 }).lean();

  if (!restaurant) {
    throw new Error(
      "Chưa có nhà hàng trong DB. Hãy seed/import restaurant trước.",
    );
  }

  console.log(
    `ℹ️ Không truyền --restaurantId, script dùng nhà hàng đầu tiên: ${restaurant.name || restaurant._id}`,
  );

  return restaurant;
}

async function resolveWarehouse({ restaurantId, warehouseId }) {
  if (warehouseId) {
    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      restaurantId,
    }).lean();

    if (!warehouse) {
      throw new Error(
        `Không tìm thấy warehouseId=${warehouseId} trong nhà hàng này`,
      );
    }

    return warehouse;
  }

  let warehouse = await Warehouse.findOne({
    restaurantId,
    isActive: { $ne: false },
  })
    .sort({ createdAt: 1 })
    .lean();

  if (warehouse) {
    console.log(
      `ℹ️ Không truyền --warehouseId, script dùng kho đầu tiên: ${warehouse.name || warehouse._id}`,
    );
    return warehouse;
  }

  warehouse = await Warehouse.create({
    restaurantId,
    name: "Kho demo test",
    code: "DEMO-STOCK",
    address: "Tạo tự động bởi seed-demo-ingredient-stock.js",
    isActive: true,
  });

  console.log(`✅ Đã tạo kho demo: ${warehouse.name}`);

  return warehouse.toObject();
}

async function main() {
  assertDemoScriptAllowed("seed-demo-ingredient-stock.js");
  const args = parseArgs(process.argv.slice(2));

  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017";
  const dbName = process.env.MONGO_DB || "cohan";

  const restaurantIdArg = args.restaurantId || process.env.RESTAURANT_ID;
  const warehouseIdArg = args.warehouseId || process.env.WAREHOUSE_ID;

  const dryRun = args.dryRun === "true" || args["dry-run"] === "true";
  const onlyZero = args.onlyZero !== "false";
  const multiplier = Number(
    args.multiplier || process.env.SEED_STOCK_MULTIPLIER || 1,
  );

  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error("--multiplier phải là số > 0");
  }

  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(mongoUri, { dbName });

  console.log("✅ Connected Mongo");
  console.log(`📦 DB: ${dbName}`);
  console.log(`🧪 dryRun=${dryRun}`);
  console.log(`🎯 onlyZero=${onlyZero}`);
  console.log(`🔢 multiplier=${multiplier}`);

  const restaurantId = toObjectId(restaurantIdArg, "restaurantId");
  const warehouseId = toObjectId(warehouseIdArg, "warehouseId");

  const restaurant = await resolveRestaurant({ restaurantId });
  const restaurantObjectId = restaurant._id;

  const warehouse = await resolveWarehouse({
    restaurantId: restaurantObjectId,
    warehouseId,
  });
  const warehouseObjectId = warehouse._id;

  const ingredients = await Ingredient.find({
    restaurantId: restaurantObjectId,
    isActive: { $ne: false },
    deletedAt: null,
  })
    .sort({ name: 1 })
    .lean();

  if (!ingredients.length) {
    console.log("⚠️ Không có nguyên liệu active nào để seed.");
    await mongoose.disconnect();
    return;
  }

  const stockItems = await StockItem.find({
    restaurantId: restaurantObjectId,
    warehouseId: warehouseObjectId,
    ingredientId: { $in: ingredients.map((i) => i._id) },
  }).lean();

  const stockByIngredient = new Map(
    stockItems.map((s) => [
      String(s.ingredientId),
      {
        onHand: Number(s.onHand || 0),
        reserved: Number(s.reserved || 0),
      },
    ]),
  );

  const plan = ingredients
    .map((ingredient) => {
      const stock = stockByIngredient.get(String(ingredient._id)) || {
        onHand: 0,
        reserved: 0,
      };

      const available = stock.onHand - stock.reserved;
      const target = getDefaultTarget(ingredient.baseUnit, multiplier);
      const qtyToAdd = Math.max(0, target - available);

      return {
        ingredient,
        onHand: stock.onHand,
        reserved: stock.reserved,
        available,
        target,
        qtyToAdd,
      };
    })
    .filter((row) => {
      if (onlyZero) return row.available <= 0 && row.qtyToAdd > 0;
      return row.qtyToAdd > 0;
    });

  console.log("");
  console.log(`🏪 Restaurant: ${restaurant.name || restaurantObjectId}`);
  console.log(`🏬 Warehouse: ${warehouse.name || warehouseObjectId}`);
  console.log(`🥕 Ingredients active: ${ingredients.length}`);
  console.log(`🧾 Need seed: ${plan.length}`);
  console.log("");

  for (const row of plan.slice(0, 20)) {
    console.log(
      `- ${row.ingredient.name}: available=${row.available} ${row.ingredient.baseUnit}, add=${row.qtyToAdd} ${row.ingredient.baseUnit}, target=${row.target}`,
    );
  }

  if (plan.length > 20) {
    console.log(`... và ${plan.length - 20} nguyên liệu khác`);
  }

  if (dryRun) {
    console.log("");
    console.log("🧪 Dry run: không ghi DB.");
    await mongoose.disconnect();
    return;
  }

  if (!plan.length) {
    console.log("✅ Không có nguyên liệu nào cần seed thêm.");
    await mongoose.disconnect();
    return;
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      for (const row of plan) {
        const { ingredient, qtyToAdd, target, available } = row;

        await StockItem.findOneAndUpdate(
          {
            restaurantId: restaurantObjectId,
            warehouseId: warehouseObjectId,
            ingredientId: ingredient._id,
          },
          {
            $inc: { onHand: qtyToAdd },
            $setOnInsert: {
              restaurantId: restaurantObjectId,
              warehouseId: warehouseObjectId,
              ingredientId: ingredient._id,
              reserved: 0,
              batches: [],
              costPerUnit: Number(ingredient.costPerBaseUnit || 0),
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            session,
          },
        );

        await StockMovement.create(
          [
            {
              restaurantId: restaurantObjectId,
              warehouseId: warehouseObjectId,
              ingredientId: ingredient._id,
              type: "adjustment",
              qty: qtyToAdd,
              reason: "Seed tồn kho nguyên liệu demo/test để kiểm tra order",
              meta: {
                script: "seed-demo-ingredient-stock.js",
                beforeAvailable: available,
                target,
                baseUnit: ingredient.baseUnit,
                ingredientName: ingredient.name,
              },
            },
          ],
          { session },
        );
      }
    });

    console.log("");
    console.log(`✅ Đã seed tồn kho cho ${plan.length} nguyên liệu.`);
    console.log("🎉 Xong. Bây giờ reload menu/order để kiểm tra món còn hàng.");
  } finally {
    session.endSession();
    await mongoose.disconnect();
  }
}

main().catch(async (err) => {
  console.error("❌ Seed stock failed:");
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
