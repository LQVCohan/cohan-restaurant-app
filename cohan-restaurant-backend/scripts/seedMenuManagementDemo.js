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

const SEED_KEY = "cohan-menu-catalog-v1";
const DEMO_RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "";
const DEMO_RESET = process.env.DEMO_RESET === "1";
const CATEGORY_NAMES = ["Món nước", "Đồ uống", "Món chính", "Khai vị & súp"];

async function resolveRestaurant() {
  if (DEMO_RESTAURANT_ID) {
    const restaurant = await Restaurant.findById(DEMO_RESTAURANT_ID);
    if (!restaurant) {
      throw new Error(`DEMO_RESTAURANT_NOT_FOUND: ${DEMO_RESTAURANT_ID}`);
    }
    return restaurant;
  }

  const existing = await Restaurant.findOne({ status: "active" }).sort({ createdAt: 1 });
  if (existing) return existing;

  return Restaurant.create({
    name: "Nhà hàng COHAN Thủ Đức",
    status: "active",
    description:
      "Không gian ẩm thực Việt hiện đại, phù hợp cho gia đình và các buổi gặp gỡ.",
  });
}

async function upsertOne(Model, filter, payload) {
  return Model.findOneAndUpdate(
    filter,
    { $set: payload },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

function buildOrderItem(menuItem, recipe) {
  const defaultVariant =
    recipe.servingVariants.find((variant) => variant.isDefault) ||
    recipe.servingVariants[0];
  const quantity = 2;
  return {
    dishId: menuItem._id,
    menuId: menuItem.menuId,
    categoryId: menuItem.categoryId,
    name: menuItem.name,
    unit: defaultVariant.sellUnit || "portion",
    servingKey: defaultVariant.key,
    servingVariant: {
      key: defaultVariant.key,
      name: defaultVariant.name,
      mode: defaultVariant.mode,
      price: defaultVariant.price,
      sellQty: defaultVariant.sellQty,
      sellUnit: defaultVariant.sellUnit,
    },
    quantity,
    baseUnitPrice: defaultVariant.price,
    unitPrice: defaultVariant.price,
    lineSubtotal: defaultVariant.price * quantity,
    ingredientsSnapshot: [],
    status: "served",
  };
}

async function main() {
  assertDemoScriptAllowed("seedMenuManagementDemo.js");
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017";
  const dbName = process.env.MONGO_DB || "cohan";
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(mongoUri, { dbName });

  const restaurant = await resolveRestaurant();
  const restaurantId = restaurant._id;

  if (DEMO_RESET) {
    await Promise.all([
      Order.deleteMany({ restaurantId, "clientMeta.seedKey": SEED_KEY }),
      Recipe.deleteMany({ restaurantId, notes: SEED_KEY }),
      MenuItem.deleteMany({ restaurantId, notes: SEED_KEY }),
      Menu.deleteMany({ restaurantId, description: { $in: [
        "Bữa sáng nhẹ nhàng với các món Việt quen thuộc.",
        "Thực đơn trưa cân bằng, phục vụ nhanh và đầy đủ dinh dưỡng.",
        "Các món chính chọn lọc cho bữa tối và dịp gặp gỡ.",
        "Món nhẹ và súp nóng phục vụ đến cuối ngày.",
      ] } }),
      Category.deleteMany({ restaurantId, name: { $in: CATEGORY_NAMES } }),
      CategoryMenu.deleteMany({
        restaurantId,
        name: { $in: ["Bữa sáng", "Bữa trưa", "Bữa tối"] },
      }),
      Ingredient.deleteMany({ restaurantId, notes: SEED_KEY }),
    ]);
  }

  const [breakfastGroup, lunchGroup, dinnerGroup] = await Promise.all([
    upsertOne(
      CategoryMenu,
      { restaurantId, name: "Bữa sáng" },
      {
        restaurantId,
        name: "Bữa sáng",
        icon: "☀️",
        description: "Khởi đầu ngày mới với các món Việt nóng hổi và dễ dùng.",
      },
    ),
    upsertOne(
      CategoryMenu,
      { restaurantId, name: "Bữa trưa" },
      {
        restaurantId,
        name: "Bữa trưa",
        icon: "🥗",
        description: "Lựa chọn cân bằng cho bữa trưa tại nhà hàng hoặc mang đi.",
      },
    ),
    upsertOne(
      CategoryMenu,
      { restaurantId, name: "Bữa tối" },
      {
        restaurantId,
        name: "Bữa tối",
        icon: "🌙",
        description: "Món chính và món dùng chung phù hợp cho gia đình, bạn bè.",
      },
    ),
  ]);

  const menuDefs = [
    {
      timeSlot: "breakfast",
      name: "Thực đơn sáng",
      description: "Bữa sáng nhẹ nhàng với các món Việt quen thuộc.",
      categoryMenuId: breakfastGroup._id,
    },
    {
      timeSlot: "lunch",
      name: "Thực đơn trưa",
      description: "Thực đơn trưa cân bằng, phục vụ nhanh và đầy đủ dinh dưỡng.",
      categoryMenuId: lunchGroup._id,
    },
    {
      timeSlot: "dinner",
      name: "Thực đơn tối",
      description: "Các món chính chọn lọc cho bữa tối và dịp gặp gỡ.",
      categoryMenuId: dinnerGroup._id,
    },
    {
      timeSlot: "late_night",
      name: "Thực đơn khuya",
      description: "Món nhẹ và súp nóng phục vụ đến cuối ngày.",
      categoryMenuId: dinnerGroup._id,
    },
  ];
  const menus = {};
  for (const definition of menuDefs) {
    menus[definition.timeSlot] = await upsertOne(
      Menu,
      { restaurantId, timeSlot: definition.timeSlot },
      {
        restaurantId,
        timeSlot: definition.timeSlot,
        name: definition.name,
        description: definition.description,
        isActive: true,
        categoryMenuId: definition.categoryMenuId,
      },
    );
  }

  const categories = {
    noodle: await upsertOne(
      Category,
      { restaurantId, name: "Món nước" },
      { restaurantId, name: "Món nước", icon: "🍜", isActive: true },
    ),
    drink: await upsertOne(
      Category,
      { restaurantId, name: "Đồ uống" },
      { restaurantId, name: "Đồ uống", icon: "🥤", isActive: true },
    ),
    main: await upsertOne(
      Category,
      { restaurantId, name: "Món chính" },
      { restaurantId, name: "Món chính", icon: "🍽️", isActive: true },
    ),
    starter: await upsertOne(
      Category,
      { restaurantId, name: "Khai vị & súp" },
      { restaurantId, name: "Khai vị & súp", icon: "🥣", isActive: true },
    ),
  };

  const warehouse = await upsertOne(
    Warehouse,
    { restaurantId, code: "KHO-TT-01" },
    {
      restaurantId,
      name: "Kho trung tâm Thủ Đức",
      code: "KHO-TT-01",
      isActive: true,
    },
  );

  const ingredientDefs = [
    {
      key: "riceNoodle",
      name: "Bánh phở tươi",
      baseUnit: "g",
      minStock: 3000,
      costPerBaseUnit: 0.035,
      onHand: 9000,
      reserved: 300,
    },
    {
      key: "beef",
      name: "Thịt bò Úc",
      baseUnit: "g",
      minStock: 4000,
      costPerBaseUnit: 0.22,
      onHand: 7500,
      reserved: 500,
    },
    {
      key: "peachTea",
      name: "Nền trà đào",
      baseUnit: "ml",
      minStock: 5000,
      costPerBaseUnit: 0.025,
      onHand: 12000,
      reserved: 600,
    },
    {
      key: "pumpkin",
      name: "Bí đỏ Đà Lạt",
      baseUnit: "g",
      minStock: 2500,
      costPerBaseUnit: 0.04,
      onHand: 6000,
      reserved: 200,
    },
  ];
  const ingredients = {};
  for (const definition of ingredientDefs) {
    const ingredient = await upsertOne(
      Ingredient,
      { restaurantId, name: definition.name },
      {
        restaurantId,
        name: definition.name,
        baseUnit: definition.baseUnit,
        minStock: definition.minStock,
        costPerBaseUnit: definition.costPerBaseUnit,
        notes: SEED_KEY,
      },
    );
    ingredients[definition.key] = ingredient;
    await upsertOne(
      StockItem,
      {
        restaurantId,
        warehouseId: warehouse._id,
        ingredientId: ingredient._id,
      },
      {
        restaurantId,
        warehouseId: warehouse._id,
        ingredientId: ingredient._id,
        onHand: definition.onHand,
        reserved: definition.reserved,
      },
    );
  }

  const menuItemDefs = [
    {
      code: "MON-PHO-001",
      name: "Phở bò đặc biệt",
      description:
        "Nước dùng hầm xương trong 12 giờ, dùng cùng bò tái, nạm, gân và rau thơm.",
      menu: menus.breakfast,
      category: categories.noodle,
      status: "available",
      price: 79000,
      image: "/images/menu/pho-bo-dac-biet.svg",
      ingredientKey: "riceNoodle",
      ingredientQty: 180,
      foodType: "NON_VEGETARIAN",
      meatTypes: ["BEEF"],
      prepStation: "kitchen",
      avgPrepTimeMin: 12,
    },
    {
      code: "NUOC-TRA-001",
      name: "Trà đào cam sả",
      description:
        "Trà đen ủ lạnh, đào miếng, cam vàng và sả tươi, vị thanh mát dễ uống.",
      menu: menus.lunch,
      category: categories.drink,
      status: "available",
      price: 49000,
      image: "/images/menu/tra-dao-cam-sa.svg",
      ingredientKey: "peachTea",
      ingredientQty: 300,
      foodType: "VEGAN",
      meatTypes: [],
      prepStation: "bar",
      avgPrepTimeMin: 5,
    },
    {
      code: "MON-BO-002",
      name: "Bò nướng sốt tiêu đen",
      description:
        "Thăn bò nướng vừa chín, phủ sốt tiêu đen, dùng kèm rau củ theo mùa.",
      menu: menus.dinner,
      category: categories.main,
      status: "available",
      price: 169000,
      image: "/images/menu/bo-nuong-tieu-den.svg",
      ingredientKey: "beef",
      ingredientQty: 220,
      foodType: "NON_VEGETARIAN",
      meatTypes: ["BEEF"],
      prepStation: "kitchen",
      avgPrepTimeMin: 18,
    },
    {
      code: "SUP-BIDO-001",
      name: "Súp bí đỏ kem tươi",
      description:
        "Bí đỏ Đà Lạt xay mịn cùng kem tươi, bánh mì nướng giòn và hạt bí rang.",
      menu: menus.late_night,
      category: categories.starter,
      status: "available",
      price: 59000,
      image: "/images/menu/sup-bi-do.svg",
      ingredientKey: "pumpkin",
      ingredientQty: 250,
      foodType: "VEGETARIAN",
      meatTypes: [],
      prepStation: "kitchen",
      avgPrepTimeMin: 10,
    },
  ];

  const createdItems = [];
  for (const definition of menuItemDefs) {
    const item = await upsertOne(
      MenuItem,
      { restaurantId, code: definition.code },
      {
        restaurantId,
        menuId: definition.menu._id,
        categoryId: definition.category._id,
        code: definition.code,
        name: definition.name,
        description: definition.description,
        status: definition.status,
        basePrice: definition.price,
        defaultServingKey: "standard",
        hasByWeightVariant: false,
        thumbImage: definition.image,
        foodType: definition.foodType,
        meatTypes: definition.meatTypes,
        prepStation: definition.prepStation,
        avgPrepTimeMin: definition.avgPrepTimeMin,
        servingPortion: 1,
        servingUnit: "người",
        notes: SEED_KEY,
      },
    );
    createdItems.push(item);

    await upsertOne(
      Recipe,
      { restaurantId, menuItemId: item._id },
      {
        restaurantId,
        menuItemId: item._id,
        notes: SEED_KEY,
        servingVariants: [
          {
            key: "standard",
            name: "Phần tiêu chuẩn",
            mode: "PORTION",
            sellQty: 1,
            sellUnit: "portion",
            price: definition.price,
            isDefault: true,
            ingredients: [
              {
                ingredientId: ingredients[definition.ingredientKey]._id,
                qty: definition.ingredientQty,
                unit: ingredients[definition.ingredientKey].baseUnit,
                wastePct: 3,
              },
            ],
          },
        ],
      },
    );
  }

  const orderItemSource = createdItems[0];
  const orderRecipe = await Recipe.findOne({
    restaurantId,
    menuItemId: orderItemSource._id,
  }).lean();
  const orderItem = buildOrderItem(orderItemSource, orderRecipe);
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");

  for (const [suffix, currentStatus] of [
    ["001", "served"],
    ["002", "completed"],
  ]) {
    await upsertOne(
      Order,
      { restaurantId, orderCode: `COHAN-${today}-${suffix}` },
      {
        restaurantId,
        orderCode: `COHAN-${today}-${suffix}`,
        orderType: "dine_in",
        currentStatus,
        kitchenStatus: "served",
        orderPaymentStatus: "paid",
        items: [orderItem],
        totals: {
          subtotal: orderItem.lineSubtotal,
          discount: 0,
          tax: 0,
          service: 0,
          grandTotal: orderItem.lineSubtotal,
        },
        payment: {
          method: "cash",
          status: "paid",
          paidAmount: orderItem.lineSubtotal,
        },
        statusTimeline: [
          {
            status: currentStatus,
            note:
              currentStatus === "completed"
                ? "Đơn hàng đã hoàn tất"
                : "Món đã được phục vụ tại bàn",
          },
        ],
        note: "Khách dùng bữa tại nhà hàng",
        clientMeta: { seedKey: SEED_KEY },
      },
    );
  }

  console.log(
    `[seed:menu-management] completed for restaurant=${restaurantId}; items=${createdItems.length}`,
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[seed:menu-management] failed", error);
  await mongoose.disconnect();
  process.exit(1);
});
