import "dotenv/config.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import process from "node:process";
import { Ingredient, Menu, MenuItem, Recipe, Restaurant } from "../models/index.js";
import { safeDbInfo } from "./lib/scriptSafety.js";

const EXPECTED_BRAND_ID = "6a447f6bea9844b4c8544c49";
const TARGET_RESTAURANTS = [
  {
    id: "69ce9e2e8d8d711f12e251b1",
    expectedName: "Cohan Restaurant",
    codePrefix: "CR1",
  },
  {
    id: "6a447f6bea9844b4c8544c4f",
    expectedName: "Cohan Restaurant 2",
    codePrefix: "CR2",
  },
];

const RECIPE_BINDINGS = [
  { code: "PHO-BO-TAI", name: "Phở bò tái", timeSlot: "breakfast", ingredients: ["Bánh phở tươi", "Thịt bò"] },
  { code: "BUN-BO-HUE", name: "Bún bò Huế", timeSlot: "breakfast", ingredients: ["Bún bò sợi lớn", "Thịt bò", "Thịt heo", "Sả"] },
  { code: "BANH-MI-OP-LA", name: "Bánh mì ốp la chả lụa", timeSlot: "breakfast", ingredients: ["Bánh mì", "Trứng gà", "Chả lụa"] },
  { code: "BANH-CUON-CHA-LUA", name: "Bánh cuốn chả lụa", timeSlot: "breakfast", ingredients: ["Bánh cuốn", "Thịt heo", "Chả lụa"] },
  { code: "CHAO-SUON-TRUNG", name: "Cháo sườn trứng", timeSlot: "breakfast", ingredients: ["Gạo nấu cháo", "Sườn non heo", "Trứng gà"] },
  { code: "CA-PHE-SUA-DA", name: "Cà phê sữa đá", timeSlot: "breakfast", ingredients: ["Cà phê rang xay", "Sữa đặc"] },
  { code: "TRA-TAC", name: "Trà tắc", timeSlot: "breakfast", ingredients: ["Trà đen", "Tắc"] },

  { code: "COM-GA-XOI-MO", name: "Cơm gà xối mỡ", timeSlot: "lunch", ingredients: ["Gạo thơm", "Đùi gà"] },
  { code: "COM-SUON-NUONG", name: "Cơm sườn nướng mật ong", timeSlot: "lunch", ingredients: ["Gạo thơm", "Sườn non heo", "Mật ong"] },
  { code: "CA-LOC-KHO-TO", name: "Cá lóc kho tộ", timeSlot: "lunch", ingredients: ["Cá lóc", "Nước dừa tươi", "Nước mắm"] },
  { code: "CANH-CHUA-CA-LOC", name: "Canh chua cá lóc", timeSlot: "lunch", ingredients: ["Cá lóc", "Cà chua", "Thơm", "Bạc hà", "Me"] },
  { code: "THIT-KHO-TRUNG", name: "Thịt kho trứng nước dừa", timeSlot: "lunch", ingredients: ["Thịt heo", "Trứng gà", "Nước dừa tươi"] },
  { code: "RAU-MUONG-XAO-TOI", name: "Rau muống xào tỏi", timeSlot: "lunch", ingredients: ["Rau muống", "Tỏi"] },
  { code: "TOM-SU-RANG-ME-PHAN", name: "Tôm sú rang me", timeSlot: "lunch", ingredients: ["Tôm sú", "Me"] },
  { code: "BO-LUC-LAC", name: "Bò lúc lắc", timeSlot: "lunch", ingredients: ["Thịt bò", "Hành tây", "Ớt chuông"] },
  { code: "NUOC-CAM-TUOI", name: "Nước cam tươi", timeSlot: "lunch", ingredients: ["Cam tươi"] },
  { code: "CHANH-DAY-SODA", name: "Chanh dây soda", timeSlot: "lunch", ingredients: ["Chanh dây", "Soda"] },

  { code: "GOI-NGO-SEN-TOM-THIT", name: "Gỏi ngó sen tôm thịt", timeSlot: "dinner", ingredients: ["Ngó sen", "Tôm sú", "Thịt heo"] },
  { code: "CA-DUC-NUONG-MUOI-OT", name: "Cá đục nướng muối ớt", timeSlot: "dinner", ingredients: ["Cá đục", "Muối", "Ớt tươi"] },
  { code: "CA-MU-HAP-HONG-KONG", name: "Cá mú hấp Hồng Kông", timeSlot: "dinner", ingredients: ["Cá mú", "Gừng", "Nước tương"] },
  { code: "CA-CHEM-HAP-XI-DAU", name: "Cá chẽm hấp xì dầu", timeSlot: "dinner", ingredients: ["Cá chẽm", "Gừng", "Nước tương"] },
  { code: "MUC-LA-NUONG-SA-TE", name: "Mực lá nướng sa tế", timeSlot: "dinner", ingredients: ["Mực lá", "Sa tế", "Sả"] },
  { code: "TOM-SU-RANG-MUOI", name: "Tôm sú rang muối", timeSlot: "dinner", ingredients: ["Tôm sú", "Muối", "Tỏi"] },
  { code: "CUA-CA-MAU-SOT-ME", name: "Cua Cà Mau sốt me", timeSlot: "dinner", ingredients: ["Cua Cà Mau", "Me"] },
  { code: "NGHEU-HAP-SA", name: "Nghêu hấp sả", timeSlot: "dinner", ingredients: ["Nghêu", "Sả"] },
  { code: "GA-NUONG-LU", name: "Gà nướng lu", timeSlot: "dinner", ingredients: ["Gà ta làm sạch", "Mật ong"] },
  { code: "SUON-NON-NUONG-MAT-ONG", name: "Sườn non nướng mật ong", timeSlot: "dinner", ingredients: ["Sườn non heo", "Mật ong"] },
  { code: "LAU-HAI-SAN", name: "Lẩu hải sản chua cay", timeSlot: "dinner", ingredients: ["Tôm sú", "Mực lá", "Nghêu", "Nấm tươi"] },
  { code: "LAU-GA-LA-E", name: "Lẩu gà lá é", timeSlot: "dinner", ingredients: ["Gà ta làm sạch", "Lá é", "Nấm tươi"] },
  { code: "COM-CHIEN-HAI-SAN", name: "Cơm chiên hải sản", timeSlot: "dinner", ingredients: ["Gạo thơm", "Tôm sú", "Mực lá", "Trứng gà"] },

  { code: "MI-XAO-BO", name: "Mì xào bò", timeSlot: "late_night", ingredients: ["Mì trứng", "Thịt bò"] },
  { code: "CHAO-HAI-SAN", name: "Cháo hải sản", timeSlot: "late_night", ingredients: ["Gạo nấu cháo", "Tôm sú", "Mực lá"] },
  { code: "CANH-GA-CHIEN-NUOC-MAM", name: "Cánh gà chiên nước mắm", timeSlot: "late_night", ingredients: ["Cánh gà", "Nước mắm"] },
  { code: "KHOAI-TAY-CHIEN", name: "Khoai tây chiên", timeSlot: "late_night", ingredients: ["Khoai tây", "Dầu ăn"] },
  { code: "SODA-CHANH", name: "Soda chanh", timeSlot: "late_night", ingredients: ["Soda", "Chanh tươi"] },
  { code: "DUA-HAU-LANH", name: "Dưa hấu lạnh", timeSlot: "late_night", ingredients: ["Dưa hấu"] },
];

const ACTIVE_RECIPE_FILTER = {
  $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
};

function getArgValue(prefix) {
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : "";
}

function validateBindingCatalog() {
  if (RECIPE_BINDINGS.length !== 36) {
    throw new Error(`Expected 36 recipe bindings, got ${RECIPE_BINDINGS.length}`);
  }

  const codes = new Set();
  const names = new Set();
  for (const binding of RECIPE_BINDINGS) {
    if (!binding.code || !binding.name || !binding.timeSlot) {
      throw new Error("Recipe binding is missing code, name or timeSlot");
    }
    if (!Array.isArray(binding.ingredients) || binding.ingredients.length === 0) {
      throw new Error(`Recipe binding ${binding.code} has no required ingredients`);
    }
    if (codes.has(binding.code)) throw new Error(`Duplicate recipe binding code: ${binding.code}`);
    if (names.has(binding.name)) throw new Error(`Duplicate recipe binding name: ${binding.name}`);
    codes.add(binding.code);
    names.add(binding.name);
  }

  const pho = RECIPE_BINDINGS.find((binding) => binding.code === "PHO-BO-TAI");
  for (const required of ["Bánh phở tươi", "Thịt bò"]) {
    if (!pho?.ingredients.includes(required)) {
      throw new Error(`PHO-BO-TAI must require ${required}`);
    }
  }

  return {
    bindings: RECIPE_BINDINGS.length,
    phoCoreIngredients: pho.ingredients.length,
  };
}

function runRecipeSeed(requestedRestaurantId) {
  const scriptPath = fileURLToPath(
    new URL("./seedProductionRecipes.js", import.meta.url),
  );
  const args = [scriptPath, "--apply"];
  if (requestedRestaurantId) args.push(`--restaurantId=${requestedRestaurantId}`);

  const result = spawnSync(process.execPath, args, {
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Production recipe seed failed with exit code ${result.status}`);
  }
}

async function requireRestaurant(target) {
  const restaurant = await Restaurant.findById(target.id).select({
    _id: 1,
    name: 1,
    brandId: 1,
  });
  if (!restaurant) throw new Error(`Restaurant not found: ${target.id}`);
  if (restaurant.name !== target.expectedName) {
    throw new Error(
      `Restaurant ${target.id} name mismatch: expected "${target.expectedName}", got "${restaurant.name}"`,
    );
  }
  if (String(restaurant.brandId || "") !== EXPECTED_BRAND_ID) {
    throw new Error(`Restaurant ${target.id} does not belong to brand ${EXPECTED_BRAND_ID}`);
  }
  return restaurant;
}

async function verifyRestaurantBindings(target) {
  const restaurant = await requireRestaurant(target);
  const expectedCodes = RECIPE_BINDINGS.map(
    (binding) => `${target.codePrefix}-${binding.code}`,
  );

  const menuItems = await MenuItem.find({
    restaurantId: restaurant._id,
    code: { $in: expectedCodes },
  })
    .select({ _id: 1, restaurantId: 1, menuId: 1, code: 1, name: 1 })
    .lean();
  const itemByCode = new Map(menuItems.map((item) => [item.code, item]));

  const menuIds = [...new Set(menuItems.map((item) => String(item.menuId)))];
  const menus = await Menu.find({
    _id: { $in: menuIds },
    restaurantId: restaurant._id,
  })
    .select({ _id: 1, restaurantId: 1, timeSlot: 1 })
    .lean();
  const menuById = new Map(menus.map((menu) => [String(menu._id), menu]));

  const menuItemIds = menuItems.map((item) => item._id);
  const recipes = await Recipe.find({
    restaurantId: restaurant._id,
    menuItemId: { $in: menuItemIds },
    ...ACTIVE_RECIPE_FILTER,
  }).lean();
  const recipesByMenuItemId = new Map();
  for (const recipe of recipes) {
    const key = String(recipe.menuItemId);
    const bucket = recipesByMenuItemId.get(key) || [];
    bucket.push(recipe);
    recipesByMenuItemId.set(key, bucket);
  }

  const referencedIngredientIds = new Set();
  for (const recipe of recipes) {
    for (const variant of recipe.servingVariants || []) {
      for (const line of variant.ingredients || []) {
        if (line.ingredientId) referencedIngredientIds.add(String(line.ingredientId));
      }
    }
  }

  const ingredients = await Ingredient.find({
    _id: { $in: [...referencedIngredientIds] },
    restaurantId: restaurant._id,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  })
    .select({ _id: 1, name: 1 })
    .lean();
  const ingredientNameById = new Map(
    ingredients.map((ingredient) => [String(ingredient._id), ingredient.name]),
  );

  if (ingredientNameById.size !== referencedIngredientIds.size) {
    throw new Error(
      `${target.expectedName} has missing or cross-restaurant ingredient references`,
    );
  }

  let checkedVariants = 0;
  for (const binding of RECIPE_BINDINGS) {
    const expectedCode = `${target.codePrefix}-${binding.code}`;
    const menuItem = itemByCode.get(expectedCode);
    if (!menuItem) {
      throw new Error(`Missing menu item ${expectedCode} in ${target.expectedName}`);
    }
    if (menuItem.name !== binding.name) {
      throw new Error(
        `${expectedCode} name mismatch: expected "${binding.name}", got "${menuItem.name}"`,
      );
    }

    const menu = menuById.get(String(menuItem.menuId));
    if (!menu) {
      throw new Error(`${expectedCode} is not connected to a menu in ${target.expectedName}`);
    }
    if (menu.timeSlot !== binding.timeSlot) {
      throw new Error(
        `${expectedCode} menu timeSlot mismatch: expected ${binding.timeSlot}, got ${menu.timeSlot}`,
      );
    }

    const itemRecipes = recipesByMenuItemId.get(String(menuItem._id)) || [];
    if (itemRecipes.length !== 1) {
      throw new Error(
        `${expectedCode} must have exactly one active recipe, got ${itemRecipes.length}`,
      );
    }

    const recipe = itemRecipes[0];
    const variants = Array.isArray(recipe.servingVariants)
      ? recipe.servingVariants
      : [];
    if (variants.length === 0) {
      throw new Error(`${expectedCode} recipe has no serving variants`);
    }

    for (const variant of variants) {
      const ingredientNames = new Set(
        (variant.ingredients || [])
          .map((line) => ingredientNameById.get(String(line.ingredientId)))
          .filter(Boolean),
      );
      const missing = binding.ingredients.filter(
        (ingredientName) => !ingredientNames.has(ingredientName),
      );
      if (missing.length > 0) {
        throw new Error(
          `${expectedCode}/${variant.key || "unknown"} is missing core ingredients: ${missing.join(", ")}`,
        );
      }
      checkedVariants += 1;
    }
  }

  return {
    restaurantId: String(restaurant._id),
    restaurantName: restaurant.name,
    menuItems: menuItems.length,
    recipes: recipes.length,
    checkedVariants,
    ingredientReferences: referencedIngredientIds.size,
  };
}

async function main() {
  const validation = validateBindingCatalog();
  const apply = process.argv.includes("--apply");
  const requestedRestaurantId = getArgValue("--restaurantId=");
  const targets = requestedRestaurantId
    ? TARGET_RESTAURANTS.filter((target) => target.id === requestedRestaurantId)
    : TARGET_RESTAURANTS;

  if (!targets.length) {
    throw new Error(`Unsupported restaurantId: ${requestedRestaurantId}`);
  }

  console.log("Recipe binding validation passed:", validation);
  if (!apply) {
    console.log("No database changes were made. Add --apply to seed and verify recipe bindings.");
    return;
  }
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required when --apply is used");
  }

  // The catalog seed upserts ingredient records before it creates or restores recipes.
  runRecipeSeed(requestedRestaurantId);

  const dbName = process.env.MONGO_DB?.trim();
  console.log("Connecting to verify recipe bindings:", safeDbInfo());
  await mongoose.connect(process.env.MONGO_URI, dbName ? { dbName } : {});

  try {
    const results = [];
    for (const target of targets) {
      results.push(await verifyRestaurantBindings(target));
    }
    console.table(results);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error(error?.stack || error?.message || error);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  process.exitCode = 1;
});
