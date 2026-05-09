// scripts/seed-by-weight-demo-safe.js
// Seed dữ liệu demo món bán theo cân/kg một cách an toàn.
// Nguyên tắc:
// - Không reset dữ liệu.
// - Không update dữ liệu đã tồn tại.
// - Có rồi thì skip.
// - Chỉ tạo mới menu/category/menuItem/ingredient/recipe nếu chưa có.
//
// Chạy:
//   cd cohan-restaurant-backend
//   node scripts/seed-by-weight-demo-safe.js

import mongoose from "mongoose";
import dotenv from "dotenv";
import process from "process";
import {
  Restaurant,
  Menu,
  Category,
  MenuItem,
  Ingredient,
  Recipe,
} from "../models/index.js";

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/RestaurantDB";
const MONGO_DB = process.env.MONGO_DB || "RestaurantDB";

const RESTAURANTS = [
  {
    restaurantId: "69ce9e2e8d8d711f12e251b1",
    label: "Cohan Restaurant",
    prefix: "COHAN",
    categoryName: "Hải sản cân ký",
    locale: "vi",
  },
  {
    restaurantId: "69ce9e2e8d8d711f12e251b6",
    label: "Restaurant Branch 2",
    prefix: "BR2",
    categoryName: "Hải sản cân ký",
    locale: "vi",
  },
];

const TIME_SLOTS = [
  {
    key: "breakfast",
    menuName: "Menu Sáng - Hải sản cân ký",
    categoryOrder: 70,
    dishes: [
      {
        key: "salmon",
        viName: "Cá hồi Na Uy áp chảo theo kg",
        description:
          "Món cá hồi bán theo cân, dùng để kiểm thử nhập khối lượng và ảnh minh chứng.",
        pricePerKg: 850_000,
        ingredientName: "Cá hồi Na Uy",
        ingredientSkuBase: "NORWAY_SALMON",
        costPerKg: 420_000,
        prepVi: "Áp chảo bơ tỏi",
      },
      {
        key: "tuna",
        viName: "Cá ngừ đại dương sashimi theo kg",
        description:
          "Món cá ngừ bán theo cân, phù hợp kiểm thử biến thể BY_WEIGHT.",
        pricePerKg: 780_000,
        ingredientName: "Cá ngừ đại dương",
        ingredientSkuBase: "OCEAN_TUNA",
        costPerKg: 390_000,
        prepVi: "Sashimi lạnh",
      },
    ],
  },
  {
    key: "lunch",
    menuName: "Menu Trưa - Hải sản cân ký",
    categoryOrder: 71,
    dishes: [
      {
        key: "lobster",
        viName: "Tôm hùm nướng phô mai theo kg",
        description:
          "Món tôm hùm bán theo kg để kiểm thử đơn giá cao và khối lượng lẻ.",
        pricePerKg: 1_250_000,
        ingredientName: "Tôm hùm xanh",
        ingredientSkuBase: "BLUE_LOBSTER",
        costPerKg: 720_000,
        prepVi: "Nướng phô mai",
      },
      {
        key: "king-crab",
        viName: "Cua hoàng đế hấp bia theo kg",
        description:
          "Món cua bán theo kg, dùng test StaffOrdering/POS với BY_WEIGHT.",
        pricePerKg: 1_500_000,
        ingredientName: "Cua hoàng đế Alaska",
        ingredientSkuBase: "ALASKA_KING_CRAB",
        costPerKg: 920_000,
        prepVi: "Hấp bia",
      },
    ],
  },
  {
    key: "dinner",
    menuName: "Menu Tối - Hải sản cân ký",
    categoryOrder: 72,
    dishes: [
      {
        key: "shark",
        viName: "Cá mập đại dương nướng muối ớt theo kg",
        description:
          "Món demo giá cao 1.000.000đ/kg để kiểm thử tính tiền theo gram.",
        pricePerKg: 1_000_000,
        ingredientName: "Thịt cá mập đại dương",
        ingredientSkuBase: "OCEAN_SHARK",
        costPerKg: 450_000,
        prepVi: "Nướng muối ớt",
      },
      {
        key: "red-grouper",
        viName: "Cá mú đỏ hấp Hồng Kông theo kg",
        description:
          "Món cá mú bán theo cân, dùng kiểm thử order nhiều khối lượng khác nhau.",
        pricePerKg: 950_000,
        ingredientName: "Cá mú đỏ",
        ingredientSkuBase: "RED_GROUPER",
        costPerKg: 520_000,
        prepVi: "Hấp Hồng Kông",
      },
    ],
  },
  {
    key: "late_night",
    menuName: "Menu Khuya - Hải sản cân ký",
    categoryOrder: 73,
    dishes: [
      {
        key: "squid",
        viName: "Mực lá Phú Quốc nướng sa tế theo kg",
        description:
          "Món mực bán theo kg, phục vụ kiểm thử order khuya và đơn vị gram.",
        pricePerKg: 650_000,
        ingredientName: "Mực lá Phú Quốc",
        ingredientSkuBase: "PHU_QUOC_SQUID",
        costPerKg: 280_000,
        prepVi: "Nướng sa tế",
      },
      {
        key: "oyster",
        viName: "Hàu sữa Nha Trang nướng mỡ hành theo kg",
        description:
          "Món hàu bán theo kg để test cân nặng, ảnh minh chứng và tổng tiền.",
        pricePerKg: 520_000,
        ingredientName: "Hàu sữa Nha Trang",
        ingredientSkuBase: "NHA_TRANG_OYSTER",
        costPerKg: 210_000,
        prepVi: "Nướng mỡ hành",
      },
    ],
  },
];

function toObjectId(value, label = "id") {
  if (!mongoose.isValidObjectId(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return new mongoose.Types.ObjectId(value);
}

function slug(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

async function createMenuIfMissing({ restaurantId, timeSlot, name }) {
  const existing = await Menu.findOne({ restaurantId, timeSlot }).lean();

  if (existing?._id) {
    return {
      doc: existing,
      created: false,
      reason: "exists",
    };
  }

  const created = await Menu.create({
    restaurantId,
    timeSlot,
    name,
    description: "Menu demo dùng để kiểm thử món bán theo cân/kg.",
    isActive: true,
  });

  return {
    doc: created,
    created: true,
    reason: "created",
  };
}

async function createCategoryIfMissing({ restaurantId, name, order }) {
  const existing = await Category.findOne({ restaurantId, name }).lean();

  if (existing?._id) {
    return {
      doc: existing,
      created: false,
      reason: "exists",
    };
  }

  const created = await Category.create({
    restaurantId,
    name,
    order,
    isActive: true,
  });

  return {
    doc: created,
    created: true,
    reason: "created",
  };
}

async function createIngredientIfMissing({
  restaurantId,
  sku,
  name,
  costPerKg,
}) {
  const existingBySku = await Ingredient.findOne({
    restaurantId,
    sku,
  }).lean();

  if (existingBySku?._id) {
    return {
      doc: existingBySku,
      created: false,
      reason: "exists_by_sku",
    };
  }

  const existingByName = await Ingredient.findOne({
    restaurantId,
    name,
  }).lean();

  if (existingByName?._id) {
    return {
      doc: existingByName,
      created: false,
      reason: "exists_by_name",
    };
  }

  const created = await Ingredient.create({
    restaurantId,
    sku,
    name,
    category: "Hải sản",
    baseUnit: "g",
    conversions: [
      {
        from: "kg",
        to: "g",
        ratio: 1000,
      },
      {
        from: "g",
        to: "kg",
        ratio: 0.001,
      },
    ],
    // costPerBaseUnit tính theo g.
    // Ví dụ 450.000đ/kg => 450đ/g.
    costPerBaseUnit: Math.round(Number(costPerKg || 0) / 1000),
    minStock: 1000,
    notes: "Nguyên liệu demo dùng để test món bán theo kg.",
    isActive: true,
  });

  return {
    doc: created,
    created: true,
    reason: "created",
  };
}

async function createMenuItemIfMissing({
  restaurantId,
  menuId,
  categoryId,
  code,
  name,
  description,
  basePrice,
}) {
  const existingByCode = await MenuItem.findOne({
    restaurantId,
    code,
  }).lean();

  if (existingByCode?._id) {
    return {
      doc: existingByCode,
      created: false,
      reason: "exists_by_code",
    };
  }

  const existingByNameInMenu = await MenuItem.findOne({
    restaurantId,
    menuId,
    categoryId,
    name,
  }).lean();

  if (existingByNameInMenu?._id) {
    return {
      doc: existingByNameInMenu,
      created: false,
      reason: "exists_by_name",
    };
  }

  const created = await MenuItem.create({
    restaurantId,
    menuId,
    categoryId,
    code,
    name,
    description,
    sortOrder: 10,
    labels: ["demo", "hải sản", "bán theo kg", "BY_WEIGHT"],
    basePrice,
    defaultServingKey: "kg",
    hasByWeightVariant: true,
    taxRate: 0,
    servingPortion: 1,
    servingUnit: "kg",
    status: "available",
    avgPrepTimeMin: 20,
    point: 0,
    rate: 0,
    orderCounter: 0,
    notes: "Seed an toàn để test StaffOrdering/POS BY_WEIGHT.",
  });

  return {
    doc: created,
    created: true,
    reason: "created",
  };
}

async function createRecipeIfMissing({
  restaurantId,
  menuItemId,
  ingredientId,
  pricePerKg,
  prepName,
}) {
  const existing = await Recipe.findOne({
    restaurantId,
    menuItemId,
  }).lean();

  if (existing?._id) {
    return {
      doc: existing,
      created: false,
      reason: "exists",
    };
  }

  const pricePer100g = Math.round(Number(pricePerKg || 0) / 10);

  const created = await Recipe.create({
    restaurantId,
    menuItemId,
    servingVariants: [
      {
        key: "kg",
        name: `${prepName} - bán theo kg`,
        mode: "BY_WEIGHT",
        sellQty: 1,
        sellUnit: "kg",
        price: pricePerKg,
        isDefault: true,
        ingredients: [
          {
            ingredientId,
            // Bán 1kg thì cần 1000g nguyên liệu chính.
            qty: 1000,
            unit: "g",
            wastePct: 5,
          },
        ],
      },
      {
        key: "100g",
        name: `${prepName} - bán theo 100g`,
        mode: "BY_WEIGHT",
        sellQty: 100,
        sellUnit: "g",
        price: pricePer100g,
        isDefault: false,
        ingredients: [
          {
            ingredientId,
            // Bán 100g thì cần 100g nguyên liệu chính.
            qty: 100,
            unit: "g",
            wastePct: 5,
          },
        ],
      },
    ],
    notes:
      "Recipe demo BY_WEIGHT: dùng để test weightGrams, ảnh minh chứng và tính tiền theo gram/kg.",
    isActive: true,
  });

  return {
    doc: created,
    created: true,
    reason: "created",
  };
}

async function ensureRestaurantExists(restaurantId, label) {
  const restaurant = await Restaurant.findById(restaurantId).lean();

  if (!restaurant?._id) {
    throw new Error(`Restaurant not found: ${label} (${String(restaurantId)})`);
  }

  return restaurant;
}

function buildDishCode(prefix, timeSlot, dishKey) {
  return `${slug(prefix)}_${slug(timeSlot)}_${slug(dishKey)}_KG`;
}

function buildIngredientSku(prefix, ingredientSkuBase) {
  return `${slug(prefix)}_ING_${slug(ingredientSkuBase)}`;
}

async function seedOneRestaurant(config) {
  const restaurantId = toObjectId(config.restaurantId, "restaurantId");
  const restaurant = await ensureRestaurantExists(restaurantId, config.label);

  console.log("\n========================================");
  console.log(`Restaurant: ${restaurant.name} (${String(restaurant._id)})`);
  console.log("========================================");

  const summary = {
    menusCreated: 0,
    menusSkipped: 0,
    categoriesCreated: 0,
    categoriesSkipped: 0,
    ingredientsCreated: 0,
    ingredientsSkipped: 0,
    menuItemsCreated: 0,
    menuItemsSkipped: 0,
    recipesCreated: 0,
    recipesSkipped: 0,
  };

  for (const slot of TIME_SLOTS) {
    const menuResult = await createMenuIfMissing({
      restaurantId,
      timeSlot: slot.key,
      name: slot.menuName,
    });

    if (menuResult.created) summary.menusCreated += 1;
    else summary.menusSkipped += 1;

    const categoryResult = await createCategoryIfMissing({
      restaurantId,
      name: config.categoryName,
      order: slot.categoryOrder,
    });

    if (categoryResult.created) summary.categoriesCreated += 1;
    else summary.categoriesSkipped += 1;

    console.log(`\n[${slot.key}] ${slot.menuName}`);
    console.log(
      `Menu: ${menuResult.created ? "created" : "skip"} - ${menuResult.doc.name}`,
    );
    console.log(
      `Category: ${categoryResult.created ? "created" : "skip"} - ${categoryResult.doc.name}`,
    );

    for (const dish of slot.dishes) {
      const code = buildDishCode(config.prefix, slot.key, dish.key);
      const ingredientSku = buildIngredientSku(
        config.prefix,
        dish.ingredientSkuBase,
      );

      const ingredientResult = await createIngredientIfMissing({
        restaurantId,
        sku: ingredientSku,
        name: dish.ingredientName,
        costPerKg: dish.costPerKg,
      });

      if (ingredientResult.created) summary.ingredientsCreated += 1;
      else summary.ingredientsSkipped += 1;

      const menuItemResult = await createMenuItemIfMissing({
        restaurantId,
        menuId: menuResult.doc._id,
        categoryId: categoryResult.doc._id,
        code,
        name: dish.viName,
        description: dish.description,
        basePrice: dish.pricePerKg,
      });

      if (menuItemResult.created) summary.menuItemsCreated += 1;
      else summary.menuItemsSkipped += 1;

      const recipeResult = await createRecipeIfMissing({
        restaurantId,
        menuItemId: menuItemResult.doc._id,
        ingredientId: ingredientResult.doc._id,
        pricePerKg: dish.pricePerKg,
        prepName: dish.prepVi,
      });

      if (recipeResult.created) summary.recipesCreated += 1;
      else summary.recipesSkipped += 1;

      console.log(
        [
          `- ${dish.viName}`,
          `${formatMoney(dish.pricePerKg)}đ/kg`,
          `item:${menuItemResult.created ? "created" : "skip"}`,
          `ingredient:${ingredientResult.created ? "created" : "skip"}`,
          `recipe:${recipeResult.created ? "created" : "skip"}`,
        ].join(" | "),
      );
    }

    const count = await MenuItem.countDocuments({
      restaurantId,
      categoryId: categoryResult.doc._id,
      status: { $ne: "hidden" },
    });

    // Đây là update metadata menuItemCount của category demo.
    // Không ảnh hưởng dữ liệu món/nguyên liệu/công thức.
    await Category.updateOne(
      { _id: categoryResult.doc._id },
      {
        $set: {
          menuItemCount: count,
        },
      },
    );
  }

  console.log("\nSummary:", summary);
  return summary;
}

async function main() {
  console.log("Connecting Mongo:", MONGO_URI, "| DB:", MONGO_DB);
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
  console.log("Connected");

  for (const config of RESTAURANTS) {
    await seedOneRestaurant(config);
  }

  console.log("\nDONE");
  console.log("Seeded safe BY_WEIGHT demo data.");
  console.log("\nTest examples:");
  console.log("- Cá mập 1.000.000đ/kg, nhập 500g => 500.000đ.");
  console.log("- Cá mập variant 100g, nhập 250g => 250.000đ.");
  console.log("- Cua hoàng đế 1.500.000đ/kg, nhập 300g => 450.000đ.");
  console.log(
    "- BY_WEIGHT vẫn cần weightGrams và ảnh minh chứng nếu rule hiện tại đang bật.",
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Seed failed:", error);

  try {
    await mongoose.disconnect();
  } catch {}

  process.exit(1);
});
