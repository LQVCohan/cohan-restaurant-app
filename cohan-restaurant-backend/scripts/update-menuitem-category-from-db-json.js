import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import process from "process";
import { MenuItem } from "../models/index.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/RestaurantDB";
const MONGO_DB = process.env.MONGO_DB || "RestaurantDB";
const DEFAULT_DB_DIR = process.env.JSON_DB_DIR || path.resolve(process.cwd(), "DB");

const CATEGORY_FILE_HINTS = ["category", "categories", "danhmuc"];
const DISH_FILE_HINTS = ["dish", "dishes", "menu-item", "menuitem", "mon-an", "monan"];

const NAME_TYPE_RULES = [
  { type: "Đồ uống", keywords: ["trà", "tea", "coffee", "cà phê", "nước", "juice", "sinh tố", "cocktail", "mocktail", "bia", "rượu"] },
  { type: "Tráng miệng", keywords: ["tráng miệng", "dessert", "bánh", "chè", "kem", "pudding"] },
  { type: "Lẩu", keywords: ["lẩu", "hotpot"] },
  { type: "Nướng", keywords: ["nướng", "bbq", "grill"] },
  { type: "Hải sản", keywords: ["hải sản", "seafood", "tôm", "cá", "mực", "nghêu", "sò"] },
  { type: "Phở & Bún", keywords: ["phở", "bún", "hủ tiếu", "miến", "mì", "ramen"] },
  { type: "Cơm", keywords: ["cơm", "cháo", "xôi"] },
  { type: "Fast Food", keywords: ["burger", "pizza", "gà rán", "fast", "khoai tây chiên", "sandwich"] },
  { type: "Món chay", keywords: ["chay", "vegan"] },
  { type: "Món Việt", keywords: ["việt", "vietnam", "gỏi cuốn", "bò kho", "canh chua"] },
];

const normalizeText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const toHexObjectIdString = (raw) => {
  if (!raw) return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    return mongoose.isValidObjectId(s) ? s : null;
  }

  if (raw instanceof mongoose.Types.ObjectId) {
    return String(raw);
  }

  if (typeof raw === "object") {
    if (raw.$oid && mongoose.isValidObjectId(raw.$oid)) return String(raw.$oid);
    if (raw._id && mongoose.isValidObjectId(raw._id)) return String(raw._id);
    if (raw.id && mongoose.isValidObjectId(raw.id)) return String(raw.id);
  }

  return null;
};

function parseArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((x) => x.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function pickNameField(row = {}) {
  return row.name || row.dishName || row.menuItemName || row.tenMon || row.title || "";
}

function pickCategoryNameField(row = {}) {
  const candidate =
    row.categoryName ||
    row.category ||
    row.category_type ||
    row.categoryType ||
    row.group ||
    row.loai ||
    row.type ||
    "";

  if (typeof candidate === "string") return candidate;
  if (candidate && typeof candidate === "object") {
    return candidate.name || candidate.categoryName || candidate.loai || "";
  }
  return "";
}

function pickCategoryIdField(row = {}) {
  return (
    toHexObjectIdString(row.categoryId) ||
    toHexObjectIdString(row.category_id) ||
    toHexObjectIdString(row.category?.id) ||
    toHexObjectIdString(row.category?._id)
  );
}

async function findJsonFileByHints(dirPath, hints = []) {
  const files = await fs.readdir(dirPath);
  const jsonFiles = files.filter((f) => f.toLowerCase().endsWith(".json"));

  const hit = jsonFiles.find((f) => {
    const n = normalizeText(f);
    return hints.some((h) => n.includes(normalizeText(h)));
  });

  return hit ? path.join(dirPath, hit) : null;
}

async function readJsonArray(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.data)) return parsed.data;
  if (Array.isArray(parsed?.items)) return parsed.items;
  throw new Error(`File không phải mảng JSON: ${filePath}`);
}

function inferCategoryTypeFromDishName(dishName) {
  const normalizedDish = normalizeText(dishName);
  if (!normalizedDish) return "";

  for (const rule of NAME_TYPE_RULES) {
    if (rule.keywords.some((kw) => normalizedDish.includes(normalizeText(kw)))) {
      return rule.type;
    }
  }

  return "";
}

function buildCategoryResolver(categoryRows = []) {
  const rows = categoryRows
    .map((row) => {
      const id =
        toHexObjectIdString(row.id) ||
        toHexObjectIdString(row._id) ||
        toHexObjectIdString(row.categoryId) ||
        toHexObjectIdString(row.category_id);

      const name = row.name || row.categoryName || row.tenDanhMuc;
      return {
        id: id || "",
        name: String(name || "").trim(),
        normalizedName: normalizeText(name || ""),
      };
    })
    .filter((x) => x.id && x.name);

  const byExact = new Map(rows.map((r) => [r.normalizedName, r]));
  const byId = new Map(rows.map((r) => [r.id, r]));

  const resolveByName = (inputName) => {
    const n = normalizeText(inputName);
    if (!n) return null;

    if (byExact.has(n)) return byExact.get(n);

    const includeHit = rows.find((r) => r.normalizedName.includes(n) || n.includes(r.normalizedName));
    if (includeHit) return includeHit;

    return null;
  };

  const resolveById = (inputId) => {
    const id = toHexObjectIdString(inputId);
    if (!id) return null;
    return byId.get(id) || null;
  };

  return { resolveByName, resolveById };
}

function buildMenuItemQuery(dishRow) {
  const query = {};

  const id =
    toHexObjectIdString(dishRow.id) ||
    toHexObjectIdString(dishRow._id) ||
    toHexObjectIdString(dishRow.menuItemId) ||
    toHexObjectIdString(dishRow.menu_item_id);

  if (id) {
    query._id = new mongoose.Types.ObjectId(id);
    return query;
  }

  const name = pickNameField(dishRow);
  if (!name) return null;
  query.name = new RegExp(`^${String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

  const restaurantId = toHexObjectIdString(dishRow.restaurantId);
  if (restaurantId) {
    query.restaurantId = new mongoose.Types.ObjectId(restaurantId);
  }

  const menuId = toHexObjectIdString(dishRow.menuId);
  if (menuId) {
    query.menuId = new mongoose.Types.ObjectId(menuId);
  }

  return query;
}

async function main() {
  const dbDir = parseArg("db-dir") || DEFAULT_DB_DIR;
  const categoryFileArg = parseArg("category-file");
  const dishFileArg = parseArg("dish-file");
  const dryRun = hasFlag("dry-run");

  const categoryFile = categoryFileArg || (await findJsonFileByHints(dbDir, CATEGORY_FILE_HINTS));
  const dishFile = dishFileArg || (await findJsonFileByHints(dbDir, DISH_FILE_HINTS));

  if (!categoryFile || !dishFile) {
    throw new Error(
      `Không tìm thấy đủ file JSON trong ${dbDir}. Dùng --category-file=... và --dish-file=... để chỉ định rõ.`
    );
  }

  console.log("📁 DB dir:", dbDir);
  console.log("📄 Category JSON:", categoryFile);
  console.log("📄 Dish JSON:", dishFile);
  console.log("🧪 Dry run:", dryRun ? "YES" : "NO");

  const categoryRows = await readJsonArray(categoryFile);
  const dishRows = await readJsonArray(dishFile);
  const { resolveByName, resolveById } = buildCategoryResolver(categoryRows);

  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
  console.log("✅ Mongo connected");

  let updated = 0;
  let skippedNoCategory = 0;
  let skippedNoDish = 0;
  let skippedNoMatch = 0;
  let skippedInvalidCategoryId = 0;

  for (const dishRow of dishRows) {
    const dishName = pickNameField(dishRow);
    if (!dishName) {
      skippedNoDish += 1;
      continue;
    }

    const categoryIdFromJson = pickCategoryIdField(dishRow);
    const categoryFromJson = pickCategoryNameField(dishRow);
    const inferredType = inferCategoryTypeFromDishName(dishName);
    const desiredCategoryName = categoryFromJson || inferredType;

    const resolvedCategory = categoryIdFromJson
      ? resolveById(categoryIdFromJson) || resolveByName(desiredCategoryName)
      : resolveByName(desiredCategoryName);

    if (!resolvedCategory) {
      if (!desiredCategoryName && !categoryIdFromJson) {
        skippedNoCategory += 1;
      } else {
        skippedNoMatch += 1;
        console.log(
          `⚠️ Không match category cho món "${dishName}" (categoryId=${categoryIdFromJson || "N/A"}, loại="${desiredCategoryName || "N/A"}")`
        );
      }
      continue;
    }

    const categoryObjectId = toHexObjectIdString(resolvedCategory.id);
    if (!categoryObjectId) {
      skippedInvalidCategoryId += 1;
      console.log(`⚠️ Category id không hợp lệ: ${resolvedCategory.id} (${resolvedCategory.name})`);
      continue;
    }

    const query = buildMenuItemQuery(dishRow);
    if (!query) {
      skippedNoDish += 1;
      continue;
    }

    const item = await MenuItem.findOne(query).select({ _id: 1, name: 1, categoryId: 1 }).lean();
    if (!item) {
      skippedNoDish += 1;
      console.log(`⚠️ Không tìm thấy món trong DB: "${dishName}"`);
      continue;
    }

    if (String(item.categoryId) === categoryObjectId) {
      continue;
    }

    if (!dryRun) {
      await MenuItem.updateOne(
        { _id: item._id },
        { $set: { categoryId: new mongoose.Types.ObjectId(categoryObjectId) } }
      );
    }

    updated += 1;
    console.log(`${dryRun ? "🧪" : "✅"} ${item.name} -> ${resolvedCategory.name} (${categoryObjectId})`);
  }

  console.log("\n===== KẾT QUẢ =====");
  console.log("Updated:", updated);
  console.log("Skipped (không có loại):", skippedNoCategory);
  console.log("Skipped (không xác định món):", skippedNoDish);
  console.log("Skipped (không match category):", skippedNoMatch);
  console.log("Skipped (category id không hợp lệ):", skippedInvalidCategoryId);

  await mongoose.disconnect();
  console.log("👋 Done");
}

main().catch(async (err) => {
  console.error("❌", err.message || err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
