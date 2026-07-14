import "dotenv/config.js";
import crypto from "node:crypto";
import process from "node:process";
import mongoose from "mongoose";
import {
  Combo,
  MenuItem,
  ModifierGroup,
  Restaurant,
} from "../models/index.js";
import { maskMongoUri } from "./lib/scriptSafety.js";

const DEFAULT_RESTAURANT_ID = "6a5559eec3e3d7a76c59c0da";
const DEFAULT_MONGO_URI = "mongodb://127.0.0.1:27017/RestaurantDB";

const COMBO_SPECS = [
  {
    name: "Combo sáng Phở & Trà đào",
    description:
      "Phở bò đặc biệt dùng cùng trà đào cam sả, phù hợp bữa sáng hoặc bữa trưa nhanh.",
    discountPercent: 10,
    items: [
      ["MON-PHO-001", 1],
      ["NUOC-TRA-001", 1],
    ],
  },
  {
    name: "Combo sáng Bún bò & Cà phê",
    description:
      "Bún bò Huế đậm vị kết hợp cà phê sữa đá phong cách Việt Nam.",
    discountPercent: 10,
    items: [
      ["BUN-BO-HUE", 1],
      ["CA-PHE-SUA-DA", 1],
    ],
  },
  {
    name: "Combo cơm trưa gà & nước cam",
    description:
      "Cơm gà xối mỡ kèm nước cam tươi, lựa chọn gọn nhẹ cho một người.",
    discountPercent: 9,
    items: [
      ["COM-GA-XOI-MO", 1],
      ["NUOC-CAM-TUOI", 1],
    ],
  },
  {
    name: "Combo cơm nhà 2-3 người",
    description:
      "Thịt kho trứng, canh chua cá lóc và rau muống xào tỏi cho bữa cơm gia đình.",
    discountPercent: 11,
    items: [
      ["THIT-KHO-TRUNG", 1],
      ["CANH-CHUA-CA-LOC", 1],
      ["RAU-MUONG-XAO-TOI", 1],
    ],
  },
  {
    name: "Combo cơm nhà cá lóc 2-3 người",
    description:
      "Cá lóc kho tộ, canh chua cá lóc và rau muống xào tỏi cho bữa cơm gia đình.",
    discountPercent: 11,
    items: [
      ["CA-LOC-KHO-TO", 1],
      ["CANH-CHUA-CA-LOC", 1],
      ["RAU-MUONG-XAO-TOI", 1],
    ],
  },
  {
    name: "Combo tối Mì xào bò",
    description:
      "Mì xào bò dùng cùng khoai tây chiên và trà tắc.",
    discountPercent: 10,
    items: [
      ["MI-XAO-BO", 1],
      ["KHOAI-TAY-CHIEN", 1],
      ["TRA-TAC", 1],
    ],
  },
  {
    name: "Combo hải sản 3-4 người",
    description:
      "Set hải sản dùng chung gồm gỏi, nghêu, tôm rang muối, cơm chiên và trái cây.",
    discountPercent: 10,
    items: [
      ["GOI-NGO-SEN-TOM-THIT", 1],
      ["NGHEU-HAP-SA", 1],
      ["TOM-SU-RANG-MUOI", 1],
      ["COM-CHIEN-HAI-SAN", 1],
      ["DUA-HAU-LANH", 1],
    ],
  },
  {
    name: "Combo lẩu gà sum vầy",
    description:
      "Lẩu gà lá é, cơm chiên hải sản, hai ly trà tắc và dưa hấu lạnh.",
    discountPercent: 10,
    items: [
      ["LAU-GA-LA-E", 1],
      ["COM-CHIEN-HAI-SAN", 1],
      ["TRA-TAC", 2],
      ["DUA-HAU-LANH", 1],
    ],
  },
  {
    name: "Combo lẩu hải sản nhóm bạn",
    description:
      "Lẩu hải sản chua cay kèm khoai tây chiên, hai ly chanh dây soda và trái cây.",
    discountPercent: 10,
    items: [
      ["LAU-HAI-SAN-CHUA-CAY", 1],
      ["KHOAI-TAY-CHIEN", 1],
      ["CHANH-DAY-SODA", 2],
      ["DUA-HAU-LANH", 1],
    ],
  },
  {
    name: "Combo thanh nhẹ",
    description:
      "Súp bí đỏ, rau muống xào tỏi, khoai tây chiên, nước cam và dưa hấu.",
    discountPercent: 11,
    items: [
      ["SUP-BIDO-001", 1],
      ["RAU-MUONG-XAO-TOI", 1],
      ["KHOAI-TAY-CHIEN", 1],
      ["NUOC-CAM-TUOI", 1],
      ["DUA-HAU-LANH", 1],
    ],
  },
  {
    name: "Combo tối Bò lúc lắc",
    description:
      "Bò lúc lắc dùng cùng khoai tây chiên và chanh dây soda.",
    discountPercent: 10,
    items: [
      ["BO-LUC-LAC", 1],
      ["KHOAI-TAY-CHIEN", 1],
      ["CHANH-DAY-SODA", 1],
    ],
  },
];

const MODIFIER_SPECS = [
  {
    name: "Kích cỡ đồ uống",
    groupType: "SIZE",
    selectionType: "single",
    required: true,
    itemCodes: [
      "NUOC-TRA-001",
      "CA-PHE-SUA-DA",
      "TRA-TAC",
      "NUOC-CAM-TUOI",
      "CHANH-DAY-SODA",
    ],
    options: [
      { name: "Vừa", amount: 0, isDefault: true },
      { name: "Lớn", amount: 10000 },
    ],
  },
  {
    name: "Mức đường",
    groupType: "PREPARATION",
    selectionType: "single",
    required: true,
    itemCodes: [
      "NUOC-TRA-001",
      "CA-PHE-SUA-DA",
      "TRA-TAC",
      "NUOC-CAM-TUOI",
      "CHANH-DAY-SODA",
    ],
    options: [
      { name: "100% đường", amount: 0, isDefault: true },
      { name: "70% đường", amount: 0 },
      { name: "50% đường", amount: 0 },
      { name: "30% đường", amount: 0 },
      { name: "Không đường", amount: 0 },
    ],
  },
  {
    name: "Lượng đá",
    groupType: "PREPARATION",
    selectionType: "single",
    required: true,
    itemCodes: [
      "NUOC-TRA-001",
      "CA-PHE-SUA-DA",
      "TRA-TAC",
      "NUOC-CAM-TUOI",
      "CHANH-DAY-SODA",
    ],
    options: [
      { name: "Đá bình thường", amount: 0, isDefault: true },
      { name: "Ít đá", amount: 0 },
      { name: "Không đá", amount: 0 },
    ],
  },
  {
    name: "Mức độ cay",
    groupType: "PREPARATION",
    selectionType: "single",
    required: true,
    itemCodes: [
      "BUN-BO-HUE",
      "TOM-SU-RANG-ME-PHAN",
      "CUA-CA-MAU-SOT-ME",
      "CA-DUC-NUONG-MUOI-OT",
      "MUC-LA-NUONG-SA-TE",
      "LAU-GA-LA-E",
      "LAU-HAI-SAN-CHUA-CAY",
    ],
    options: [
      { name: "Không cay", amount: 0 },
      { name: "Cay vừa", amount: 0, isDefault: true },
      { name: "Cay nhiều", amount: 0 },
      { name: "Rất cay", amount: 0 },
    ],
  },
  {
    name: "Topping phở và bún bò",
    groupType: "TOPPING",
    selectionType: "multiple",
    required: false,
    maxSelected: 4,
    itemCodes: ["MON-PHO-001", "BUN-BO-HUE"],
    options: [
      { name: "Thêm thịt bò", amount: 35000 },
      { name: "Thêm chả lụa", amount: 18000 },
      { name: "Thêm trứng", amount: 12000 },
      { name: "Thêm bánh phở hoặc bún", amount: 15000 },
    ],
  },
  {
    name: "Topping cháo",
    groupType: "TOPPING",
    selectionType: "multiple",
    required: false,
    maxSelected: 3,
    itemCodes: ["CHAO-SUON-TRUNG", "CHAO-HAI-SAN"],
    options: [
      { name: "Thêm trứng", amount: 12000 },
      { name: "Thêm quẩy", amount: 10000 },
      { name: "Thêm một phần topping", amount: 25000 },
    ],
  },
  {
    name: "Rau thơm và hành",
    groupType: "PREPARATION",
    selectionType: "multiple",
    required: false,
    maxSelected: 2,
    itemCodes: [
      "MON-PHO-001",
      "BUN-BO-HUE",
      "BANH-MI-OP-LA",
      "BANH-CUON-CHA-LUA",
      "CHAO-SUON-TRUNG",
      "CANH-CHUA-CA-LOC",
      "GOI-NGO-SEN-TOM-THIT",
      "CA-MU-HAP-HONG-KONG",
      "CA-CHEM-HAP-XI-DAU",
      "NGHEU-HAP-SA",
      "LAU-GA-LA-E",
      "LAU-HAI-SAN-CHUA-CAY",
      "CHAO-HAI-SAN",
    ],
    options: [
      { name: "Không hành", amount: 0 },
      { name: "Không ngò", amount: 0 },
    ],
  },
  {
    name: "Mức chín thịt bò",
    groupType: "PREPARATION",
    selectionType: "single",
    required: true,
    itemCodes: ["MON-BO-002", "BO-LUC-LAC"],
    options: [
      { name: "Tái", amount: 0 },
      { name: "Chín vừa", amount: 0, isDefault: true },
      { name: "Chín kỹ", amount: 0 },
    ],
  },
  {
    name: "Món ăn kèm lẩu",
    groupType: "TOPPING",
    selectionType: "multiple",
    required: false,
    maxSelected: 4,
    itemCodes: ["LAU-GA-LA-E", "LAU-HAI-SAN-CHUA-CAY"],
    options: [
      { name: "Thêm bún", amount: 25000 },
      { name: "Thêm rau và nấm", amount: 45000 },
      { name: "Thêm thịt gà", amount: 120000 },
      { name: "Thêm hải sản", amount: 180000 },
    ],
  },
  {
    name: "Topping cơm phần",
    groupType: "TOPPING",
    selectionType: "multiple",
    required: false,
    maxSelected: 3,
    itemCodes: ["COM-GA-XOI-MO", "COM-SUON-NUONG"],
    options: [
      { name: "Thêm trứng ốp la", amount: 12000 },
      { name: "Thêm cơm", amount: 15000 },
      { name: "Thêm dưa chua", amount: 10000 },
    ],
  },
  {
    name: "Khẩu phần gà nướng",
    groupType: "SIZE",
    selectionType: "single",
    required: true,
    itemCodes: ["GA-NUONG-MAT-ONG"],
    options: [
      { name: "Nửa con", amount: 0, isDefault: true },
      { name: "Nguyên con", amount: 220000 },
    ],
  },
];

function readArg(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1];
  return undefined;
}

function stableObjectId(...parts) {
  const hex = crypto
    .createHash("sha1")
    .update(parts.map(String).join(":"))
    .digest("hex")
    .slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
}

function roundToThousand(value) {
  return Math.max(1000, Math.round(Number(value) / 1000) * 1000);
}

function getRequestedMode() {
  const only = String(readArg("only") || "all").trim().toLowerCase();
  if (!["all", "combos", "modifiers"].includes(only)) {
    throw new Error('--only must be one of: "all", "combos", "modifiers"');
  }
  return only;
}

function collectRequiredCodes(mode) {
  const codes = new Set();

  if (mode === "all" || mode === "combos") {
    for (const combo of COMBO_SPECS) {
      for (const [code] of combo.items) codes.add(code);
    }
  }

  if (mode === "all" || mode === "modifiers") {
    for (const group of MODIFIER_SPECS) {
      for (const code of group.itemCodes) codes.add(code);
    }
  }

  return [...codes];
}

function buildComboPayload(spec, restaurantId, menuItemsByCode) {
  const rows = spec.items.map(([code, qty]) => {
    const menuItem = menuItemsByCode.get(code);
    return { menuItem, qty };
  });

  const originalPrice = rows.reduce(
    (total, row) => total + Number(row.menuItem.basePrice || 0) * row.qty,
    0,
  );
  const price = roundToThousand(
    originalPrice * (1 - Number(spec.discountPercent || 0) / 100),
  );

  return {
    restaurantId,
    name: spec.name,
    description: spec.description,
    imageUrl: rows[0]?.menuItem?.thumbImage || "",
    items: rows.map((row) => ({
      menuItemId: row.menuItem._id,
      qty: row.qty,
    })),
    price,
    isActive: true,
  };
}

function buildModifierPayload(spec, restaurantId, menuItemsByCode) {
  return {
    restaurantId,
    name: spec.name,
    groupType: spec.groupType,
    coverage: "ITEMS",
    menuItemIds: spec.itemCodes.map((code) => menuItemsByCode.get(code)._id),
    selectionType: spec.selectionType,
    required: Boolean(spec.required),
    minSelected: spec.required ? 1 : 0,
    maxSelected:
      spec.selectionType === "single"
        ? 1
        : Number(spec.maxSelected || spec.options.length),
    options: spec.options.map((option) => ({
      _id: stableObjectId(
        restaurantId,
        "modifier-option",
        spec.name,
        option.name,
      ),
      name: option.name,
      isDefault: Boolean(option.isDefault),
      priceRule: {
        rule: "DELTA",
        amount: Number(option.amount || 0),
      },
      inventoryRule: {
        rule: "NONE",
        ingredientLines: [],
      },
      isActive: true,
    })),
    note: "Seed từ RestaurantDB.menuitems.json",
    isActive: true,
  };
}

async function validateContext({ restaurantId, mode }) {
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw new Error(`restaurantId không hợp lệ: ${restaurantId}`);
  }

  const restaurantObjectId = new mongoose.Types.ObjectId(restaurantId);
  const restaurant = await Restaurant.findById(restaurantObjectId)
    .select({ name: 1, status: 1 })
    .lean();

  if (!restaurant) {
    throw new Error(`Không tìm thấy nhà hàng ${restaurantId}`);
  }

  const requiredCodes = collectRequiredCodes(mode);
  const menuItems = await MenuItem.find({
    restaurantId: restaurantObjectId,
    code: { $in: requiredCodes },
  })
    .select({ code: 1, name: 1, basePrice: 1, thumbImage: 1, status: 1 })
    .lean();

  const duplicates = new Map();
  for (const item of menuItems) {
    const rows = duplicates.get(item.code) || [];
    rows.push(item);
    duplicates.set(item.code, rows);
  }

  const duplicateCodes = [...duplicates.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([code]) => code);
  if (duplicateCodes.length > 0) {
    throw new Error(`Trùng code món trong cùng nhà hàng: ${duplicateCodes.join(", ")}`);
  }

  const menuItemsByCode = new Map(menuItems.map((item) => [item.code, item]));
  const missingCodes = requiredCodes.filter((code) => !menuItemsByCode.has(code));
  if (missingCodes.length > 0) {
    throw new Error(`Thiếu món theo code: ${missingCodes.join(", ")}`);
  }

  const unavailableCodes = menuItems
    .filter((item) => item.status !== "available")
    .map((item) => item.code);
  if (unavailableCodes.length > 0) {
    console.warn(
      `[seed:combo-modifier] Cảnh báo món chưa available: ${unavailableCodes.join(", ")}`,
    );
  }

  return {
    restaurant,
    restaurantObjectId,
    menuItemsByCode,
    requiredCodes,
  };
}

async function seedCombos({ restaurantId, menuItemsByCode, apply }) {
  const payloads = COMBO_SPECS.map((spec) =>
    buildComboPayload(spec, restaurantId, menuItemsByCode),
  );

  console.log(`\n[combos] ${payloads.length} combo hợp lệ:`);
  for (const payload of payloads) {
    console.log(
      `- ${payload.name}: ${payload.items.length} dòng món, giá ${payload.price.toLocaleString("vi-VN")}đ`,
    );
  }

  if (!apply) return;

  for (const payload of payloads) {
    await Combo.findOneAndUpdate(
      { restaurantId, name: payload.name },
      {
        $set: payload,
        $setOnInsert: {
          _id: stableObjectId(restaurantId, "combo", payload.name),
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  console.log(`[combos] Đã upsert ${payloads.length} combo.`);
}

async function seedModifiers({ restaurantId, menuItemsByCode, apply }) {
  const payloads = MODIFIER_SPECS.map((spec) =>
    buildModifierPayload(spec, restaurantId, menuItemsByCode),
  );

  console.log(`\n[modifiers] ${payloads.length} nhóm modifier hợp lệ:`);
  for (const payload of payloads) {
    console.log(
      `- ${payload.name}: ${payload.menuItemIds.length} món, ${payload.options.length} lựa chọn`,
    );
  }

  if (!apply) return;

  for (const payload of payloads) {
    await ModifierGroup.findOneAndUpdate(
      { restaurantId, name: payload.name },
      {
        $set: payload,
        $setOnInsert: {
          _id: stableObjectId(restaurantId, "modifier-group", payload.name),
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  console.log(`[modifiers] Đã upsert ${payloads.length} nhóm modifier.`);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const mode = getRequestedMode();
  const restaurantId =
    readArg("restaurantId") ||
    process.env.SEED_RESTAURANT_ID ||
    DEFAULT_RESTAURANT_ID;
  const mongoUri =
    process.env.MONGODB_URI || process.env.MONGO_URI || DEFAULT_MONGO_URI;
  const mongoDb = process.env.MONGO_DB;

  console.log("[seed:combo-modifier] Chế độ:", apply ? "APPLY" : "VALIDATE ONLY");
  console.log("[seed:combo-modifier] Phạm vi:", mode);
  console.log("[seed:combo-modifier] Nhà hàng:", restaurantId);
  console.log("[seed:combo-modifier] Mongo:", maskMongoUri(mongoUri));
  if (mongoDb) console.log("[seed:combo-modifier] DB:", mongoDb);

  await mongoose.connect(mongoUri, mongoDb ? { dbName: mongoDb } : {});

  const context = await validateContext({ restaurantId, mode });
  console.log(
    `[seed:combo-modifier] Đã xác thực nhà hàng "${context.restaurant.name}" và ${context.requiredCodes.length} mã món.`,
  );

  if (mode === "all" || mode === "combos") {
    await seedCombos({
      restaurantId: context.restaurantObjectId,
      menuItemsByCode: context.menuItemsByCode,
      apply,
    });
  }

  if (mode === "all" || mode === "modifiers") {
    await seedModifiers({
      restaurantId: context.restaurantObjectId,
      menuItemsByCode: context.menuItemsByCode,
      apply,
    });
  }

  console.log(
    apply
      ? "\n✅ Hoàn tất seed combo và modifier."
      : "\n✅ Validate thành công. Chạy lại với --apply để ghi dữ liệu.",
  );
}

main()
  .catch((error) => {
    console.error("\n❌ Seed combo/modifier thất bại:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
