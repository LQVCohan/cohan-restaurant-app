import "dotenv/config.js";
import crypto from "node:crypto";
import process from "node:process";
import mongoose from "mongoose";
import { Combo, MenuItem, Restaurant } from "../models/index.js";
import { maskMongoUri } from "./lib/scriptSafety.js";

const DEFAULT_RESTAURANT_ID = "6a5559eec3e3d7a76c59c0da";
const DEFAULT_MONGO_URI = "mongodb://127.0.0.1:27017/RestaurantDB";

const LEGACY_MISALIGNED_COMBO_NAMES = [
  "Combo sáng Phở & Trà đào",
  "Combo tối Bò lúc lắc",
];

const COMBO_SPECS = [
  {
    name: "Combo sáng Phở & Trà tắc",
    description:
      "Phở bò đặc biệt dùng cùng trà tắc; cả hai món đều thuộc menu buổi sáng.",
    discountPercent: 10,
    items: [
      ["MON-PHO-001", 1],
      ["TRA-TAC", 1],
    ],
  },
  {
    name: "Combo sáng Bún bò & Cà phê",
    description:
      "Bún bò Huế đậm vị kết hợp cà phê sữa đá trong menu buổi sáng.",
    discountPercent: 10,
    items: [
      ["BUN-BO-HUE", 1],
      ["CA-PHE-SUA-DA", 1],
    ],
  },
  {
    name: "Combo cơm trưa gà & nước cam",
    description:
      "Cơm gà xối mỡ kèm nước cam tươi, cùng thuộc menu buổi trưa.",
    discountPercent: 9,
    items: [
      ["COM-GA-XOI-MO", 1],
      ["NUOC-CAM-TUOI", 1],
    ],
  },
  {
    name: "Combo cơm nhà 2-3 người",
    description:
      "Thịt kho trứng, canh chua cá lóc và rau muống xào tỏi cho bữa trưa gia đình.",
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
      "Cá lóc kho tộ, canh chua cá lóc và rau muống xào tỏi trong menu buổi trưa.",
    discountPercent: 11,
    items: [
      ["CA-LOC-KHO-TO", 1],
      ["CANH-CHUA-CA-LOC", 1],
      ["RAU-MUONG-XAO-TOI", 1],
    ],
  },
  {
    name: "Combo trưa Bò lúc lắc",
    description:
      "Bò lúc lắc, rau muống xào tỏi và chanh dây soda trong menu buổi trưa.",
    discountPercent: 10,
    items: [
      ["BO-LUC-LAC", 1],
      ["RAU-MUONG-XAO-TOI", 1],
      ["CHANH-DAY-SODA", 1],
    ],
  },
  {
    name: "Combo trưa Sườn nướng & Tôm rang me",
    description:
      "Cơm sườn nướng mật ong, tôm sú rang me và nước cam trong menu buổi trưa.",
    discountPercent: 10,
    items: [
      ["COM-SUON-NUONG", 1],
      ["TOM-SU-RANG-ME-PHAN", 1],
      ["NUOC-CAM-TUOI", 1],
    ],
  },
  {
    name: "Combo hải sản 3-4 người",
    description:
      "Gỏi ngó sen, nghêu hấp sả, tôm rang muối, cá đục nướng và cơm chiên hải sản trong menu tối.",
    discountPercent: 10,
    items: [
      ["GOI-NGO-SEN-TOM-THIT", 1],
      ["NGHEU-HAP-SA", 1],
      ["TOM-SU-RANG-MUOI", 1],
      ["CA-DUC-NUONG-MUOI-OT", 1],
      ["COM-CHIEN-HAI-SAN", 1],
    ],
  },
  {
    name: "Combo lẩu gà sum vầy",
    description:
      "Lẩu gà lá é, gỏi ngó sen và cơm chiên hải sản trong menu buổi tối.",
    discountPercent: 10,
    items: [
      ["LAU-GA-LA-E", 1],
      ["GOI-NGO-SEN-TOM-THIT", 1],
      ["COM-CHIEN-HAI-SAN", 1],
    ],
  },
  {
    name: "Combo lẩu hải sản nhóm bạn",
    description:
      "Lẩu hải sản chua cay, nghêu hấp sả và cơm chiên hải sản trong menu buổi tối.",
    discountPercent: 10,
    items: [
      ["LAU-HAI-SAN-CHUA-CAY", 1],
      ["NGHEU-HAP-SA", 1],
      ["COM-CHIEN-HAI-SAN", 1],
    ],
  },
  {
    name: "Combo hải sản cao cấp",
    description:
      "Cua Cà Mau sốt me, cá mú hấp, cá chẽm hấp và mực lá nướng trong menu tối.",
    discountPercent: 9,
    items: [
      ["CUA-CA-MAU-SOT-ME", 1],
      ["CA-MU-HAP-HONG-KONG", 1],
      ["CA-CHEM-HAP-XI-DAU", 1],
      ["MUC-LA-NUONG-SA-TE", 1],
    ],
  },
  {
    name: "Combo tối Mì xào bò",
    description:
      "Mì xào bò, khoai tây chiên và trà đào cam sả trong menu đêm.",
    discountPercent: 10,
    items: [
      ["MI-XAO-BO", 1],
      ["KHOAI-TAY-CHIEN", 1],
      ["NUOC-TRA-001", 1],
    ],
  },
  {
    name: "Combo đêm thanh nhẹ",
    description:
      "Súp bí đỏ, khoai tây chiên, dưa hấu lạnh và trà đào cam sả trong menu đêm.",
    discountPercent: 11,
    items: [
      ["SUP-BIDO-001", 1],
      ["KHOAI-TAY-CHIEN", 1],
      ["DUA-HAU-LANH", 1],
      ["NUOC-TRA-001", 1],
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

function collectRequiredCodes() {
  return [
    ...new Set(
      COMBO_SPECS.flatMap((combo) => combo.items.map(([code]) => code)),
    ),
  ];
}

function assertSameMenu(spec, rows) {
  const menuIds = [
    ...new Set(rows.map((row) => String(row.menuItem?.menuId || ""))),
  ].filter(Boolean);

  if (menuIds.length !== 1) {
    const detail = rows
      .map(
        (row) =>
          `${row.menuItem?.code || row.menuItem?.name || "unknown"}:${row.menuItem?.menuId || "missing-menu"}`,
      )
      .join(", ");
    throw new Error(
      `Combo "${spec.name}" có món thuộc nhiều menu/buổi khác nhau: ${detail}`,
    );
  }

  return menuIds[0];
}

function buildComboPayload(spec, restaurantId, menuItemsByCode) {
  const rows = spec.items.map(([code, qty]) => ({
    menuItem: menuItemsByCode.get(code),
    qty,
  }));

  assertSameMenu(spec, rows);

  const originalPrice = rows.reduce(
    (total, row) =>
      total + Number(row.menuItem?.basePrice || 0) * Number(row.qty || 1),
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

async function validateContext(restaurantId) {
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

  const requiredCodes = collectRequiredCodes();
  const menuItems = await MenuItem.find({
    restaurantId: restaurantObjectId,
    code: { $in: requiredCodes },
  })
    .select({
      code: 1,
      name: 1,
      menuId: 1,
      basePrice: 1,
      thumbImage: 1,
      status: 1,
    })
    .lean();

  const itemsByCode = new Map();
  const duplicateCodes = [];
  for (const item of menuItems) {
    if (itemsByCode.has(item.code)) duplicateCodes.push(item.code);
    itemsByCode.set(item.code, item);
  }

  if (duplicateCodes.length > 0) {
    throw new Error(
      `Trùng code món trong cùng nhà hàng: ${[...new Set(duplicateCodes)].join(", ")}`,
    );
  }

  const missingCodes = requiredCodes.filter((code) => !itemsByCode.has(code));
  if (missingCodes.length > 0) {
    throw new Error(`Thiếu món theo code: ${missingCodes.join(", ")}`);
  }

  const unavailableCodes = menuItems
    .filter((item) => item.status !== "available")
    .map((item) => item.code);
  if (unavailableCodes.length > 0) {
    console.warn(
      `[seed:aligned-combos] Cảnh báo món chưa available: ${unavailableCodes.join(", ")}`,
    );
  }

  return {
    restaurant,
    restaurantObjectId,
    menuItemsByCode: itemsByCode,
    requiredCodes,
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const restaurantId =
    readArg("restaurantId") ||
    process.env.SEED_RESTAURANT_ID ||
    DEFAULT_RESTAURANT_ID;
  const mongoUri =
    process.env.MONGODB_URI || process.env.MONGO_URI || DEFAULT_MONGO_URI;
  const mongoDb = process.env.MONGO_DB;

  console.log("[seed:aligned-combos] Chế độ:", apply ? "APPLY" : "VALIDATE ONLY");
  console.log("[seed:aligned-combos] Nhà hàng:", restaurantId);
  console.log("[seed:aligned-combos] Mongo:", maskMongoUri(mongoUri));
  if (mongoDb) console.log("[seed:aligned-combos] DB:", mongoDb);

  await mongoose.connect(mongoUri, mongoDb ? { dbName: mongoDb } : {});
  const context = await validateContext(restaurantId);

  const payloads = COMBO_SPECS.map((spec) =>
    buildComboPayload(
      spec,
      context.restaurantObjectId,
      context.menuItemsByCode,
    ),
  );

  console.log(
    `[seed:aligned-combos] Đã xác thực ${payloads.length} combo, tất cả món trong từng combo cùng menu/buổi.`,
  );
  for (const payload of payloads) {
    console.log(
      `- ${payload.name}: ${payload.items.length} dòng món, giá ${payload.price.toLocaleString("vi-VN")}đ`,
    );
  }

  if (!apply) {
    console.log("\n✅ Validate thành công. Chạy lại với --apply để ghi dữ liệu.");
    return;
  }

  await Combo.deleteMany({
    restaurantId: context.restaurantObjectId,
    name: { $in: LEGACY_MISALIGNED_COMBO_NAMES },
  });

  for (const payload of payloads) {
    await Combo.findOneAndUpdate(
      {
        restaurantId: context.restaurantObjectId,
        name: payload.name,
      },
      {
        $set: payload,
        $setOnInsert: {
          _id: stableObjectId(
            context.restaurantObjectId,
            "combo",
            payload.name,
          ),
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

  console.log(
    `\n✅ Đã upsert ${payloads.length} combo và xóa combo seed cũ bị lệch buổi.`,
  );
}

main()
  .catch((error) => {
    console.error("\n❌ Seed combo theo buổi thất bại:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
