import "dotenv/config.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import process from "node:process";
import { safeDbInfo } from "./lib/scriptSafety.js";
import { Menu, Restaurant } from "../models/index.js";

const EXPECTED_BRAND_ID = "6a447f6bea9844b4c8544c49";
const FIRST_RESTAURANT_ID = "69ce9e2e8d8d711f12e251b1";
const SECOND_RESTAURANT_ID = "6a447f6bea9844b4c8544c4f";

const MENU_DEFINITIONS = {
  breakfast: {
    id: "69fe7335ce835ed35b6b90b9",
    name: "Thực đơn buổi sáng",
    description:
      "Điểm tâm Việt Nam được chuẩn bị trong ngày, phục vụ nhanh và đủ năng lượng.",
  },
  lunch: {
    id: "69ce9e348d8d711f12e2521d",
    name: "Thực đơn buổi trưa",
    description:
      "Các món cơm và món Việt cân bằng, phù hợp dùng riêng hoặc dùng chung.",
  },
  dinner: {
    id: "69ce9e348d8d711f12e25220",
    name: "Thực đơn buổi tối",
    description:
      "Hải sản tươi, món nướng và lẩu dành cho gia đình, nhóm bạn và tiệc thân mật.",
  },
  late_night: {
    id: "69fe7341ce835ed35b6b91ea",
    name: "Thực đơn khuya",
    description: "Các món nóng và món ăn nhẹ phục vụ khách dùng bữa muộn.",
  },
};

function getArgValue(prefix) {
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : "";
}

async function requireRestaurant(id, expectedName) {
  const restaurant = await Restaurant.findById(id).select({
    _id: 1,
    name: 1,
    brandId: 1,
  });
  if (!restaurant) throw new Error(`Restaurant not found: ${id}`);
  if (restaurant.name !== expectedName) {
    throw new Error(
      `Restaurant ${id} name mismatch: expected "${expectedName}", got "${restaurant.name}"`,
    );
  }
  if (String(restaurant.brandId || "") !== EXPECTED_BRAND_ID) {
    throw new Error(`Restaurant ${id} does not belong to brand ${EXPECTED_BRAND_ID}`);
  }
  return restaurant;
}

async function bindConfirmedMenus() {
  const restaurant = await requireRestaurant(
    FIRST_RESTAURANT_ID,
    "Cohan Restaurant",
  );

  for (const [timeSlot, definition] of Object.entries(MENU_DEFINITIONS)) {
    const menu = await Menu.findById(definition.id);
    if (!menu) throw new Error(`Confirmed menu not found: ${definition.id}`);
    if (String(menu.restaurantId) !== FIRST_RESTAURANT_ID) {
      throw new Error(`Menu ${definition.id} does not belong to Cohan Restaurant`);
    }
    if (menu.timeSlot !== timeSlot) {
      throw new Error(
        `Menu ${definition.id} timeSlot mismatch: expected ${timeSlot}, got ${menu.timeSlot}`,
      );
    }

    await Menu.updateOne(
      { _id: menu._id, restaurantId: restaurant._id, timeSlot },
      {
        $set: {
          name: definition.name,
          description: definition.description,
          isActive: true,
        },
      },
      { runValidators: true },
    );
  }
}

async function createMissingMenusForSecondRestaurant() {
  const restaurant = await requireRestaurant(
    SECOND_RESTAURANT_ID,
    "Cohan Restaurant 2",
  );

  for (const [timeSlot, definition] of Object.entries(MENU_DEFINITIONS)) {
    await Menu.findOneAndUpdate(
      { restaurantId: restaurant._id, timeSlot },
      {
        $set: {
          restaurantId: restaurant._id,
          timeSlot,
          name: definition.name,
          description: definition.description,
          isActive: true,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
  }
}

function runCatalogSeed() {
  const scriptPath = fileURLToPath(
    new URL("./seedProductionMenuCatalog.js", import.meta.url),
  );
  const result = spawnSync(process.execPath, [scriptPath, ...process.argv.slice(2)], {
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status || 1;
}

async function main() {
  if (!process.argv.includes("--apply")) {
    runCatalogSeed();
    return;
  }
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required when --apply is used");

  const requestedRestaurantId = getArgValue("--restaurantId=");
  if (
    requestedRestaurantId &&
    ![FIRST_RESTAURANT_ID, SECOND_RESTAURANT_ID].includes(requestedRestaurantId)
  ) {
    throw new Error(`Unsupported restaurantId: ${requestedRestaurantId}`);
  }

  const dbName = process.env.MONGO_DB?.trim();
  console.log("Preparing confirmed/missing menus:", safeDbInfo());
  await mongoose.connect(process.env.MONGO_URI, dbName ? { dbName } : {});

  try {
    if (!requestedRestaurantId || requestedRestaurantId === FIRST_RESTAURANT_ID) {
      await bindConfirmedMenus();
    }
    if (!requestedRestaurantId || requestedRestaurantId === SECOND_RESTAURANT_ID) {
      await createMissingMenusForSecondRestaurant();
    }
  } finally {
    await mongoose.disconnect();
  }

  runCatalogSeed();
}

main().catch(async (error) => {
  console.error(error?.stack || error?.message || error);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  process.exitCode = 1;
});
