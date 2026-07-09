import "dotenv/config.js";
import fs from "node:fs/promises";
import path from "node:path";
import process from "process";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { safeDbInfo } from "./lib/scriptSafety.js";
import {
  Category,
  CategoryMenu,
  Coupon,
  Floor,
  Ingredient,
  Menu,
  MenuItem,
  Order,
  Promotion,
  Recipe,
  Reservation,
  Restaurant,
  Shift,
  Staff,
  StockItem,
  Table,
  User,
  Warehouse,
} from "../models/index.js";

const STEPS = [
  "restaurants",
  "floors",
  "tables",
  "categories",
  "categoryMenus",
  "menus",
  "menuItems",
  "warehouses",
  "ingredients",
  "recipes",
  "stockItems",
  "staff",
  "shifts",
  "promotions",
  "coupons",
  "reservations",
  "orders",
];

const STEP_TO_FILE = Object.fromEntries(STEPS.map((s) => [s, `${s}.json`]));
const CHECKPOINT_PATH = path.resolve(
  "scripts/.checkpoints/import-restaurant-data.json",
);
const DEFAULT_SOURCE_DIR = path.resolve("scripts/import-data");

const STEP_COLLECTIONS = {
  restaurants: [Restaurant],
  floors: [Floor],
  tables: [Table],
  categories: [Category],
  categoryMenus: [CategoryMenu],
  menus: [Menu],
  menuItems: [MenuItem],
  warehouses: [Warehouse],
  ingredients: [Ingredient],
  recipes: [Recipe],
  stockItems: [StockItem],
  staff: [Staff],
  shifts: [Shift],
  promotions: [Promotion],
  coupons: [Coupon],
  reservations: [Reservation],
  orders: [Order],
};

const RESET_SCOPE_MAP = {
  none: [],
  orders_only: ["orders"],
  reservations_orders: ["reservations", "orders"],
  inventory_only: ["ingredients", "recipes", "stockItems"],
  restaurant_domain: STEPS,
};

const options = {
  sourceDir: path.resolve(process.env.IMPORT_SOURCE_DIR || DEFAULT_SOURCE_DIR),
  dryRun: process.env.DRY_RUN === "1",
  importResume: process.env.IMPORT_RESUME === "1",
  importFrom: process.env.IMPORT_FROM || "",
  importOnly: process.env.IMPORT_ONLY || "",
  clearCheckpoint: process.env.CLEAR_CHECKPOINT === "1",
  resetScope: process.env.RESET_SCOPE || "none",
  allowCreateStaffUsers: process.env.ALLOW_CREATE_STAFF_USERS === "1",
};

function log(tag, msg, meta = null) {
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[${tag}] ${msg}${suffix}`);
}

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (!mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function bool(v, fallback = false) {
  if (typeof v === "boolean") return v;
  if (v == null) return fallback;
  return ["1", "true", "yes"].includes(String(v).toLowerCase());
}

function required(v, name) {
  if (v == null || v === "") {
    throw new Error(`Missing required field "${name}"`);
  }
  return v;
}

function restaurantKeyFromInput(row) {
  return String(
    row.restaurantKey ||
      row.key ||
      row.code ||
      row.slug ||
      row.nameSeedKey ||
      row.name ||
      "",
  )
    .trim()
    .toLowerCase();
}

function normalizeTimeSlot(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

function normalizeEmail(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

async function connectDb() {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
  const DB_NAME = process.env.MONGO_DB || "cohan";
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  log("DB", "connected", { dbName: DB_NAME });
}

async function ensureRestaurantManagerIndex() {
  if (options.dryRun) return;
  const indexes = await Restaurant.collection.indexes();
  const uniqueManagerIndexes = indexes.filter(
    (idx) =>
      idx?.unique &&
      idx?.key &&
      Object.prototype.hasOwnProperty.call(idx.key, "managerId"),
  );

  for (const idx of uniqueManagerIndexes) {
    await Restaurant.collection.dropIndex(idx.name);
    await Restaurant.collection.createIndex(idx.key, { background: true });
    log("MIGRATION", "recreated restaurants index as non-unique", {
      droppedIndex: idx.name,
      key: idx.key,
    });
  }

  const hasManagerIndex = indexes.some(
    (idx) =>
      idx?.key?.managerId === 1 && Object.keys(idx.key || {}).length === 1,
  );
  if (!hasManagerIndex) {
    await Restaurant.collection.createIndex(
      { managerId: 1 },
      { background: true },
    );
    log("MIGRATION", "created restaurants.managerId non-unique index");
  }
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function loadCheckpoint() {
  try {
    const raw = await fs.readFile(CHECKPOINT_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveCheckpoint(payload) {
  await ensureDir(CHECKPOINT_PATH);
  await fs.writeFile(
    CHECKPOINT_PATH,
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
  log("CHECKPOINT", "saved", {
    lastCompletedStep: payload.lastCompletedStep || null,
    failedStep: payload.failedStep || null,
  });
}

async function clearCheckpoint() {
  try {
    await fs.rm(CHECKPOINT_PATH, { force: true });
    log("CHECKPOINT", "cleared");
  } catch {
    // noop
  }
}

async function readJsonFile(filePath) {
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    throw new Error(`Missing input file: ${filePath}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON: ${filePath} (${err.message})`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Input JSON must be array: ${filePath}`);
  }
  return parsed;
}

class KeyResolver {
  constructor({ dryRun }) {
    this.dryRun = dryRun;
    this.cache = new Map();
    this.virtualIds = new Map();
  }

  set(key, id) {
    this.cache.set(key, String(id));
  }

  get(key) {
    return this.cache.get(key) || null;
  }

  getVirtualId(key) {
    if (!this.virtualIds.has(key)) {
      this.virtualIds.set(key, new mongoose.Types.ObjectId().toString());
    }
    return this.virtualIds.get(key);
  }

  async resolveRestaurantId(restaurantKey) {
    const key = `restaurant:${String(restaurantKey).toLowerCase()}`;
    const cached = this.get(key);
    if (cached) return toObjectId(cached);
    const doc = await Restaurant.findOne({ name: restaurantKey })
      .select({ _id: 1 })
      .lean();
    if (doc?._id) {
      this.set(key, doc._id);
      return doc._id;
    }
    if (this.dryRun) {
      const fake = this.getVirtualId(key);
      this.set(key, fake);
      return toObjectId(fake);
    }
    throw new Error(`Cannot resolve restaurant key "${restaurantKey}"`);
  }

  async resolveUserIdByEmail(email, { required: must = true } = {}) {
    if (!email) {
      if (must) throw new Error("Missing user email");
      return null;
    }
    const norm = normalizeEmail(email);
    const key = `user-email:${norm}`;
    const cached = this.get(key);
    if (cached) return toObjectId(cached);
    const doc = await User.findOne({ email: norm }).select({ _id: 1 }).lean();
    if (!doc?._id) {
      if (must) throw new Error(`Cannot resolve user by email "${norm}"`);
      return null;
    }
    this.set(key, doc._id);
    return doc._id;
  }
}

function buildImportContext(runId) {
  return {
    runId,
    options,
    stepData: new Map(),
    resolver: new KeyResolver({ dryRun: options.dryRun }),
    restaurantIdsInSource: [],
  };
}

async function upsertWithSummary({
  model,
  filter,
  payload,
  summary,
  ctx,
  keyCache,
  keyCacheValue,
}) {
  const existing = await model.findOne(filter).select({ _id: 1 }).lean();
  if (ctx.options.dryRun) {
    if (existing?._id) {
      summary.updated += 1;
      if (keyCache && keyCacheValue)
        ctx.resolver.set(keyCacheValue, existing._id);
      return existing._id;
    }
    summary.created += 1;
    const fakeId = ctx.resolver.getVirtualId(
      `dry:${model.modelName}:${JSON.stringify(filter)}`,
    );
    if (keyCache && keyCacheValue) ctx.resolver.set(keyCacheValue, fakeId);
    return toObjectId(fakeId);
  }
  if (existing?._id) {
    await model.updateOne({ _id: existing._id }, { $set: payload });
    summary.updated += 1;
    if (keyCache && keyCacheValue)
      ctx.resolver.set(keyCacheValue, existing._id);
    return existing._id;
  }
  const created = await model.create(payload);
  summary.created += 1;
  if (keyCache && keyCacheValue) ctx.resolver.set(keyCacheValue, created._id);
  return created._id;
}

function prepareStepsToRun(checkpoint) {
  if (options.importOnly) {
    if (!STEPS.includes(options.importOnly)) {
      throw new Error(`IMPORT_ONLY invalid step: ${options.importOnly}`);
    }
    return [options.importOnly];
  }
  let fromStep = options.importFrom || "";
  if (!fromStep && options.importResume && checkpoint?.lastCompletedStep) {
    const idx = STEPS.indexOf(checkpoint.lastCompletedStep);
    if (idx >= 0 && idx + 1 < STEPS.length) fromStep = STEPS[idx + 1];
  }
  if (!fromStep) return [...STEPS];
  if (!STEPS.includes(fromStep))
    throw new Error(`IMPORT_FROM invalid step: ${fromStep}`);
  return STEPS.slice(STEPS.indexOf(fromStep));
}

async function loadStepData(step) {
  const fileName = STEP_TO_FILE[step];
  const filePath = path.join(options.sourceDir, fileName);
  return readJsonFile(filePath);
}

async function resetScope(ctx, stepsToRun) {
  const scope = String(options.resetScope || "none");
  if (scope === "none") return;

  let targetSteps = [];
  if (scope === "from_step") {
    const from = options.importFrom || stepsToRun[0];
    if (!STEPS.includes(from))
      throw new Error(
        `RESET_SCOPE=from_step requires valid IMPORT_FROM. Got: ${from}`,
      );
    targetSteps = STEPS.slice(STEPS.indexOf(from));
  } else {
    targetSteps = RESET_SCOPE_MAP[scope] || [];
  }
  if (!targetSteps.length) return;

  const restaurants = ctx.stepData.get("restaurants") || [];
  const ids = [];
  for (const row of restaurants) {
    const key = restaurantKeyFromInput(row);
    if (!key) continue;
    try {
      const rid = await ctx.resolver.resolveRestaurantId(
        row.name || row.restaurantKey || row.key || key,
      );
      if (rid) ids.push(rid);
    } catch {
      // ignore unresolved restaurant before import
    }
  }

  const ridFilter = ids.length ? { restaurantId: { $in: ids } } : null;
  log("RESET", "start", { scope, targetSteps });
  for (const step of targetSteps) {
    const models = STEP_COLLECTIONS[step] || [];
    for (const model of models) {
      if (
        !ridFilter &&
        model !== Coupon &&
        model !== Staff &&
        model !== Shift &&
        model !== Reservation &&
        model !== Order
      ) {
        continue;
      }
      let filter = {};
      if (
        [
          "Floor",
          "Table",
          "Category",
          "CategoryMenu",
          "Menu",
          "MenuItem",
          "Warehouse",
          "Ingredient",
          "Recipe",
          "StockItem",
          "Promotion",
        ].includes(model.modelName)
      ) {
        filter = ridFilter || { _id: null };
      } else if (
        model.modelName === "Reservation" ||
        model.modelName === "Order" ||
        model.modelName === "Shift"
      ) {
        filter = ridFilter || { _id: null };
      } else if (model.modelName === "Staff") {
        filter = ridFilter
          ? { primaryRestaurant: { $in: ids } }
          : { _id: null };
      } else if (model.modelName === "Coupon") {
        filter = ridFilter || { _id: null };
      } else if (model.modelName === "Restaurant") {
        filter = { _id: { $in: ids } };
      } else {
        continue;
      }
      if (options.dryRun) {
        log("RESET", "dry-run deleteMany", { model: model.modelName, filter });
        continue;
      }
      const rs = await model.deleteMany(filter);
      log("RESET", "deleted", {
        model: model.modelName,
        deletedCount: rs.deletedCount,
      });
    }
  }
}

function ensureRecipeVariants(variants, context) {
  const rows = asArray(variants);
  const keys = rows.map((v) => String(v?.key || "").trim()).filter(Boolean);
  if (new Set(keys).size !== keys.length)
    throw new Error(`${context}: servingVariants.key must be unique`);
  const defaultCount = rows.filter((v) => bool(v?.isDefault, false)).length;
  if (defaultCount > 1)
    throw new Error(`${context}: only one servingVariant isDefault=true`);
  for (const v of rows) {
    const mode = String(v?.mode || "").toUpperCase();
    const sellUnit = String(v?.sellUnit || "").toLowerCase();
    if (mode === "PORTION" && sellUnit !== "portion")
      throw new Error(`${context}: PORTION must use sellUnit=portion`);
    if (mode === "BY_WEIGHT" && !["g", "kg"].includes(sellUnit))
      throw new Error(`${context}: BY_WEIGHT sellUnit must be g/kg`);
  }
}

async function runStep(stepName, fn, checkpoint, ctx) {
  const startedAt = Date.now();
  log("STEP", `${stepName} started`);
  try {
    const summary = await fn();
    const durationMs = Date.now() - startedAt;
    log("STEP", `${stepName} done`, { ...summary, durationMs });

    checkpoint.lastCompletedStep = stepName;
    checkpoint.failedStep = null;
    checkpoint.completedSteps = [
      ...new Set([...(checkpoint.completedSteps || []), stepName]),
    ];
    checkpoint.updatedAt = new Date().toISOString();
    await saveCheckpoint(checkpoint);
  } catch (err) {
    checkpoint.failedStep = stepName;
    checkpoint.updatedAt = new Date().toISOString();
    await saveCheckpoint(checkpoint);
    throw err;
  }
}

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) throw new Error(`Invalid date: ${v}`);
  return d;
}

async function importRestaurants(ctx) {
  const rows = ctx.stepData.get("restaurants");
  const summary = {
    input: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const name = required(row.name, "name");
      const managerEmail = normalizeEmail(row.managerEmail || "");
      let managerId = toObjectId(row.managerId);
      if (!managerId && managerEmail) {
        managerId = await ctx.resolver.resolveUserIdByEmail(managerEmail, {
          required: true,
        });
      }
      const payload = {
        name,
        phone: row.phone || undefined,
        email: row.email || undefined,
        address: row.address || undefined,
        status: row.status || "active",
        managerId: managerId || undefined,
        reservationSettings: row.reservationSettings || undefined,
        paymentSettings: row.paymentSettings || undefined,
      };
      const filter = managerId ? { name, managerId } : { name };
      const rid = await upsertWithSummary({
        model: Restaurant,
        filter,
        payload,
        summary,
        ctx,
      });
      const key = restaurantKeyFromInput(row);
      if (key) ctx.resolver.set(`restaurant:${key}`, rid);
    } catch (err) {
      summary.failed += 1;
      log("ERROR", `restaurants failed`, { index: i, reason: err.message });
      if (!ctx.options.dryRun) throw err;
    }
  }
  return summary;
}

async function importFloors(ctx) {
  const rows = ctx.stepData.get("floors");
  const summary = {
    input: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const rKey = required(row.restaurantKey, "restaurantKey");
      const level = Number(required(row.level, "level"));
      const rid = await ctx.resolver.resolveRestaurantId(rKey);
      const payload = {
        restaurantId: rid,
        name: required(row.name, "name"),
        level,
        description: row.description || "",
        isActive: row.isActive ?? true,
        meta: row.meta || undefined,
        layout: asArray(row.layout),
      };
      const filter = { restaurantId: rid, level };
      const id = await upsertWithSummary({
        model: Floor,
        filter,
        payload,
        summary,
        ctx,
      });
      ctx.resolver.set(`floor:${rKey.toLowerCase()}:${level}`, id);
    } catch (err) {
      summary.failed += 1;
      log("ERROR", "floors failed", { index: i, reason: err.message });
      if (!ctx.options.dryRun) throw err;
    }
  }
  return summary;
}

async function importTables(ctx) {
  const rows = ctx.stepData.get("tables");
  const summary = {
    input: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const rKey = required(row.restaurantKey, "restaurantKey");
      const floorLevel = Number(required(row.floorLevel, "floorLevel"));
      const tableCode = String(required(row.code, "code")).trim();
      const rid = await ctx.resolver.resolveRestaurantId(rKey);
      const floorId = toObjectId(
        ctx.resolver.get(`floor:${rKey.toLowerCase()}:${floorLevel}`),
      );
      if (!floorId)
        throw new Error(`Cannot resolve floor for level=${floorLevel}`);
      const payload = {
        restaurantId: rid,
        floorId,
        floorLevel,
        code: tableCode,
        type: row.type || "standard",
        capacity: Number(required(row.capacity, "capacity")),
        position: row.position || { x: 0, y: 0 },
        photos: asArray(row.photos),
        notes: row.notes || undefined,
        status: row.status || "available",
        tags: asArray(row.tags),
        isJoinable: bool(row.isJoinable, false),
        joinGroupId: row.joinGroupId || undefined,
        deposit: row.deposit ?? 1,
      };
      const filter = { restaurantId: rid, floorId, code: tableCode };
      const id = await upsertWithSummary({
        model: Table,
        filter,
        payload,
        summary,
        ctx,
      });
      ctx.resolver.set(
        `table:${rKey.toLowerCase()}:${floorLevel}:${tableCode.toLowerCase()}`,
        id,
      );
      ctx.resolver.set(
        `table2:${rKey.toLowerCase()}:${tableCode.toLowerCase()}`,
        id,
      );
    } catch (err) {
      summary.failed += 1;
      log("ERROR", "tables failed", { index: i, reason: err.message });
      if (!ctx.options.dryRun) throw err;
    }
  }
  return summary;
}

async function importCategories(ctx) {
  const rows = ctx.stepData.get("categories");
  const summary = {
    input: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const rKey = required(row.restaurantKey, "restaurantKey");
      const name = String(required(row.name, "name")).trim();
      const rid = await ctx.resolver.resolveRestaurantId(rKey);
      const payload = {
        restaurantId: rid,
        name,
        order: row.order ?? 0,
        isActive: row.isActive ?? true,
      };
      const id = await upsertWithSummary({
        model: Category,
        filter: { restaurantId: rid, name },
        payload,
        summary,
        ctx,
      });
      ctx.resolver.set(
        `category:${rKey.toLowerCase()}:${name.toLowerCase()}`,
        id,
      );
    } catch (err) {
      summary.failed += 1;
      log("ERROR", "categories failed", { index: i, reason: err.message });
      if (!ctx.options.dryRun) throw err;
    }
  }
  return summary;
}

async function importCategoryMenus(ctx) {
  const rows = ctx.stepData.get("categoryMenus");
  const summary = {
    input: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const rKey = required(row.restaurantKey, "restaurantKey");
      const name = required(row.name, "name");
      const rid = await ctx.resolver.resolveRestaurantId(rKey);
      const payload = {
        restaurantId: rid,
        name,
        description: row.description || "",
        order: row.order ?? 0,
        isActive: row.isActive ?? true,
        coverImage: row.coverImage || undefined,
      };
      const id = await upsertWithSummary({
        model: CategoryMenu,
        filter: { restaurantId: rid, name },
        payload,
        summary,
        ctx,
      });
      ctx.resolver.set(
        `categoryMenu:${rKey.toLowerCase()}:${String(name).toLowerCase()}`,
        id,
      );
    } catch (err) {
      summary.failed += 1;
      log("ERROR", "categoryMenus failed", { index: i, reason: err.message });
      if (!ctx.options.dryRun) throw err;
    }
  }
  return summary;
}

async function importMenus(ctx) {
  const rows = ctx.stepData.get("menus");
  const summary = {
    input: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const rKey = required(row.restaurantKey, "restaurantKey");
      const timeSlot = normalizeTimeSlot(required(row.timeSlot, "timeSlot"));
      const rid = await ctx.resolver.resolveRestaurantId(rKey);
      const categoryMenuId = row.categoryMenuName
        ? toObjectId(
            ctx.resolver.get(
              `categoryMenu:${rKey.toLowerCase()}:${String(row.categoryMenuName).toLowerCase()}`,
            ),
          )
        : null;
      const payload = {
        restaurantId: rid,
        timeSlot,
        name: row.name || `Menu ${timeSlot}`,
        description: row.description || "",
        coverImage: row.coverImage || undefined,
        isActive: row.isActive ?? true,
        categoryMenuId: categoryMenuId || undefined,
      };
      const id = await upsertWithSummary({
        model: Menu,
        filter: { restaurantId: rid, timeSlot },
        payload,
        summary,
        ctx,
      });
      ctx.resolver.set(`menu:${rKey.toLowerCase()}:${timeSlot}`, id);
    } catch (err) {
      summary.failed += 1;
      log("ERROR", "menus failed", { index: i, reason: err.message });
      if (!ctx.options.dryRun) throw err;
    }
  }
  return summary;
}

async function importMenuItems(ctx) {
  const rows = ctx.stepData.get("menuItems");
  const summary = {
    input: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const rKey = required(row.restaurantKey, "restaurantKey");
      const timeSlot = normalizeTimeSlot(
        required(row.menuTimeSlot, "menuTimeSlot"),
      );
      const categoryName = required(row.categoryName, "categoryName");
      const name = required(row.name, "name");
      const rid = await ctx.resolver.resolveRestaurantId(rKey);
      const menuId = toObjectId(
        ctx.resolver.get(`menu:${rKey.toLowerCase()}:${timeSlot}`),
      );
      const categoryId = toObjectId(
        ctx.resolver.get(
          `category:${rKey.toLowerCase()}:${String(categoryName).toLowerCase()}`,
        ),
      );
      if (!menuId || !categoryId)
        throw new Error(`Cannot resolve menu/category for item "${name}"`);
      const payload = {
        restaurantId: rid,
        menuId,
        categoryId,
        code: row.code || undefined,
        name,
        description: row.description || "",
        sortOrder: row.sortOrder ?? 1000,
        labels: asArray(row.labels),
        basePrice: row.basePrice ?? 0,
        defaultServingKey: row.defaultServingKey || undefined,
        hasByWeightVariant: bool(row.hasByWeightVariant, false),
        taxRate: row.taxRate ?? undefined,
        servingPortion: row.servingPortion ?? 1,
        servingUnit: row.servingUnit || "người",
        thumbImage: row.thumbImage || undefined,
        status: row.status || "available",
        avgPrepTimeMin: row.avgPrepTimeMin ?? 10,
        point: row.point ?? 0,
        rate: row.rate ?? 0,
        orderCounter: row.orderCounter ?? 0,
        notes: row.notes || "",
      };
      const filter = row.code
        ? { restaurantId: rid, code: String(row.code).toUpperCase() }
        : { restaurantId: rid, menuId, categoryId, name };
      const id = await upsertWithSummary({
        model: MenuItem,
        filter,
        payload,
        summary,
        ctx,
      });
      const bizItemKey = String(row.itemKey || row.code || row.name)
        .trim()
        .toLowerCase();
      ctx.resolver.set(
        `menuItem:${rKey.toLowerCase()}:${timeSlot}:${String(categoryName).toLowerCase()}:${bizItemKey}`,
        id,
      );
      ctx.resolver.set(`menuItem2:${rKey.toLowerCase()}:${bizItemKey}`, id);
    } catch (err) {
      summary.failed += 1;
      log("ERROR", "menuItems failed", { index: i, reason: err.message });
      if (!ctx.options.dryRun) throw err;
    }
  }
  return summary;
}

async function importWarehouses(ctx) {
  const rows = ctx.stepData.get("warehouses");
  const summary = {
    input: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const rKey = required(row.restaurantKey, "restaurantKey");
      const rid = await ctx.resolver.resolveRestaurantId(rKey);
      const name = required(row.name, "name");
      const payload = {
        restaurantId: rid,
        name,
        code: row.code || undefined,
        address: row.address || "",
        isActive: row.isActive ?? true,
      };
      const id = await upsertWithSummary({
        model: Warehouse,
        filter: { restaurantId: rid, name },
        payload,
        summary,
        ctx,
      });
      ctx.resolver.set(
        `warehouse:${rKey.toLowerCase()}:${String(name).toLowerCase()}`,
        id,
      );
      if (row.code)
        ctx.resolver.set(
          `warehouseCode:${rKey.toLowerCase()}:${String(row.code).toLowerCase()}`,
          id,
        );
    } catch (err) {
      summary.failed += 1;
      log("ERROR", "warehouses failed", { index: i, reason: err.message });
      if (!ctx.options.dryRun) throw err;
    }
  }
  return summary;
}

async function importIngredients(ctx) {
  const rows = ctx.stepData.get("ingredients");
  const summary = {
    input: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const rKey = required(row.restaurantKey, "restaurantKey");
      const name = required(row.name, "name");
      const rid = await ctx.resolver.resolveRestaurantId(rKey);
      const payload = {
        restaurantId: rid,
        name,
        sku: row.sku || undefined,
        category: row.category || undefined,
        baseUnit: row.baseUnit || "g",
        conversions: asArray(row.conversions),
        costPerBaseUnit: row.costPerBaseUnit ?? 0,
        photos: asArray(row.photos),
        minStock: row.minStock ?? 0,
        notes: row.notes || "",
        isActive: row.isActive ?? true,
      };
      const id = await upsertWithSummary({
        model: Ingredient,
        filter: { restaurantId: rid, name },
        payload,
        summary,
        ctx,
      });
      ctx.resolver.set(
        `ingredient:${rKey.toLowerCase()}:${String(name).toLowerCase()}`,
        id,
      );
    } catch (err) {
      summary.failed += 1;
      log("ERROR", "ingredients failed", { index: i, reason: err.message });
      if (!ctx.options.dryRun) throw err;
    }
  }
  return summary;
}

async function importRecipes(ctx) {
  const rows = ctx.stepData.get("recipes");
  const summary = {
    input: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const rKey = required(row.restaurantKey, "restaurantKey");
      const rid = await ctx.resolver.resolveRestaurantId(rKey);
      const menuItemKey = required(row.menuItemKey, "menuItemKey");
      const menuItemId =
        toObjectId(
          ctx.resolver.get(
            `menuItem2:${rKey.toLowerCase()}:${String(menuItemKey).toLowerCase()}`,
          ),
        ) || toObjectId(row.menuItemId);
      if (!menuItemId)
        throw new Error(
          `Cannot resolve menuItem for recipe key "${menuItemKey}"`,
        );
      const servingVariants = asArray(row.servingVariants).map((v) => ({
        key: required(v.key, "servingVariants.key"),
        name: v.name || undefined,
        mode: required(v.mode, "servingVariants.mode"),
        sellQty: v.sellQty ?? 1,
        sellUnit: v.sellUnit || "portion",
        ingredients: asArray(v.ingredients).map((line) => {
          const ingName = line.ingredientName
            ? String(line.ingredientName)
            : null;
          const ingId =
            toObjectId(line.ingredientId) ||
            (ingName
              ? toObjectId(
                  ctx.resolver.get(
                    `ingredient:${rKey.toLowerCase()}:${ingName.toLowerCase()}`,
                  ),
                )
              : null);
          if (!ingId)
            throw new Error(
              `Cannot resolve ingredient in recipe "${menuItemKey}"`,
            );
          return {
            ingredientId: ingId,
            qty: Number(required(line.qty, "line.qty")),
            unit: required(line.unit, "line.unit"),
            wastePct: line.wastePct ?? 0,
          };
        }),
        price: v.price ?? 0,
        isDefault: bool(v.isDefault, false),
      }));
      ensureRecipeVariants(servingVariants, `recipe#${i}`);
      const payload = {
        restaurantId: rid,
        menuItemId,
        servingVariants,
        notes: row.notes || "",
        isActive: row.isActive ?? true,
      };
      await upsertWithSummary({
        model: Recipe,
        filter: { restaurantId: rid, menuItemId },
        payload,
        summary,
        ctx,
      });
    } catch (err) {
      summary.failed += 1;
      log("ERROR", "recipes failed", { index: i, reason: err.message });
      if (!ctx.options.dryRun) throw err;
    }
  }
  return summary;
}

async function importStockItems(ctx) {
  const rows = ctx.stepData.get("stockItems");
  const summary = {
    input: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const rKey = required(row.restaurantKey, "restaurantKey");
      const rid = await ctx.resolver.resolveRestaurantId(rKey);
      const warehouseName = row.warehouseName || row.warehouseCode;
      if (!warehouseName)
        throw new Error("Missing warehouseName/warehouseCode");
      const warehouseId =
        toObjectId(
          ctx.resolver.get(
            `warehouse:${rKey.toLowerCase()}:${String(warehouseName).toLowerCase()}`,
          ),
        ) ||
        toObjectId(
          ctx.resolver.get(
            `warehouseCode:${rKey.toLowerCase()}:${String(warehouseName).toLowerCase()}`,
          ),
        );
      if (!warehouseId)
        throw new Error(`Cannot resolve warehouse "${warehouseName}"`);

      const ingredientId = row.ingredientName
        ? toObjectId(
            ctx.resolver.get(
              `ingredient:${rKey.toLowerCase()}:${String(row.ingredientName).toLowerCase()}`,
            ),
          )
        : toObjectId(row.ingredientId);
      const supplyId = toObjectId(row.supplyId);
      if (!ingredientId && !supplyId)
        throw new Error("StockItem requires ingredientId or supplyId");
      const onHand = Number(required(row.onHand, "onHand"));
      const reserved = Number(row.reserved ?? 0);
      if (!Number.isInteger(onHand) || !Number.isInteger(reserved)) {
        throw new Error("StockItem onHand/reserved must be integer");
      }
      const payload = {
        restaurantId: rid,
        warehouseId,
        ingredientId: ingredientId || undefined,
        supplyId: supplyId || undefined,
        onHand,
        reserved,
        costPerUnit: row.costPerUnit ?? 0,
        pricePerUnit: row.pricePerUnit ?? 0,
        note: row.note || "",
        batches: asArray(row.batches),
      };
      const filter = ingredientId
        ? { restaurantId: rid, warehouseId, ingredientId }
        : { restaurantId: rid, warehouseId, supplyId };
      await upsertWithSummary({
        model: StockItem,
        filter,
        payload,
        summary,
        ctx,
      });
    } catch (err) {
      summary.failed += 1;
      log("ERROR", "stockItems failed", { index: i, reason: err.message });
      if (!ctx.options.dryRun) throw err;
    }
  }
  return summary;
}

async function importStaff(ctx) {
  const rows = ctx.stepData.get("staff");
  const summary = {
    input: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const email = normalizeEmail(required(row.email, "email"));
      const rKey = required(row.restaurantKey, "restaurantKey");
      const rid = await ctx.resolver.resolveRestaurantId(rKey);

      let user = await User.findOne({ email });
      if (!user && !ctx.options.allowCreateStaffUsers) {
        throw new Error(
          `Staff user missing: ${email}. Set ALLOW_CREATE_STAFF_USERS=1 to auto-create.`,
        );
      }
      if (!user && ctx.options.allowCreateStaffUsers) {
        if (ctx.options.dryRun) {
          const fake = ctx.resolver.getVirtualId(`staff-user:${email}`);
          ctx.resolver.set(`user-email:${email}`, fake);
          summary.created += 1;
          continue;
        }
        user = await Staff.create({
          email,
          fullName: row.fullName || email.split("@")[0],
          userType: "STAFF",
          provider: "local",
          status: "active",
          primaryRestaurant: rid,
          department: row.department || "service",
          positionTitle: row.positionTitle || "Staff",
          employeeCode: row.employeeCode || undefined,
        });
        summary.created += 1;
      } else if (user) {
        if (!ctx.options.dryRun) {
          await Staff.updateOne(
            { _id: user._id },
            {
              $set: {
                userType: "STAFF",
                fullName: row.fullName || user.fullName,
                primaryRestaurant: rid,
                department: row.department || "service",
                employmentStatus: row.employmentStatus || "working",
                positionTitle:
                  row.positionTitle || user.positionTitle || "Staff",
                employeeCode: row.employeeCode || user.employeeCode,
                shiftType: row.shiftType || user.shiftType,
                workingDays: asArray(row.workingDays),
              },
            },
          );
        }
        summary.updated += 1;
      }
      ctx.resolver.set(
        `staff-email:${email}`,
        user?._id || ctx.resolver.get(`user-email:${email}`),
      );
    } catch (err) {
      summary.failed += 1;
      log("ERROR", "staff failed", { index: i, reason: err.message });
      if (!ctx.options.dryRun) throw err;
    }
  }
  return summary;
}

async function importShifts(ctx) {
  const rows = ctx.stepData.get("shifts");
  const summary = {
    input: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const rKey = required(row.restaurantKey, "restaurantKey");
      const rid = await ctx.resolver.resolveRestaurantId(rKey);
      const email = normalizeEmail(required(row.staffEmail, "staffEmail"));
      const employeeId = await ctx.resolver.resolveUserIdByEmail(email, {
        required: true,
      });
      const startTime = toDate(required(row.startTime, "startTime"));
      const endTime = toDate(required(row.endTime, "endTime"));
      const payload = {
        employeeId,
        restaurantId: rid,
        shiftType: row.shiftType || "morning",
        startTime,
        endTime,
        status: row.status || "scheduled",
        notes: row.notes || "",
      };
      await upsertWithSummary({
        model: Shift,
        filter: {
          employeeId,
          restaurantId: rid,
          startTime,
          endTime,
          shiftType: payload.shiftType,
        },
        payload,
        summary,
        ctx,
      });
    } catch (err) {
      summary.failed += 1;
      log("ERROR", "shifts failed", { index: i, reason: err.message });
      if (!ctx.options.dryRun) throw err;
    }
  }
  return summary;
}

async function importPromotions(ctx) {
  const rows = ctx.stepData.get("promotions");
  const summary = {
    input: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const rKey = required(row.restaurantKey, "restaurantKey");
      const rid = await ctx.resolver.resolveRestaurantId(rKey);
      const code = row.code ? String(row.code).trim().toUpperCase() : null;
      const itemId = row.itemKey
        ? toObjectId(
            ctx.resolver.get(
              `menuItem2:${rKey.toLowerCase()}:${String(row.itemKey).toLowerCase()}`,
            ),
          )
        : toObjectId(row.itemId);
      const categoryId = row.categoryName
        ? toObjectId(
            ctx.resolver.get(
              `category:${rKey.toLowerCase()}:${String(row.categoryName).toLowerCase()}`,
            ),
          )
        : toObjectId(row.categoryId);
      const payload = {
        name: required(row.name, "name"),
        code: code || undefined,
        description: row.description || "",
        scope: row.scope || "ORDER",
        restaurantId: rid,
        categoryId: categoryId || undefined,
        itemId: itemId || undefined,
        discountType: row.discountType || "PERCENT",
        discountValue: Number(required(row.discountValue, "discountValue")),
        minOrderValue: Number(row.minOrderValue ?? 0),
        maxDiscount: Number(row.maxDiscount ?? 0),
        usageLimit: Number(row.usageLimit ?? 0),
        usageCount: Number(row.usageCount ?? 0),
        targetAudience: row.targetAudience || "all",
        conditions: asArray(row.conditions),
        level: Number(row.level ?? 1),
        startAt: toDate(row.startAt),
        endAt: toDate(row.endAt),
        isActive: row.isActive ?? true,
        stacking: bool(row.stacking, false),
      };
      const filter = code
        ? { restaurantId: rid, code }
        : { restaurantId: rid, name: payload.name };
      const id = await upsertWithSummary({
        model: Promotion,
        filter,
        payload,
        summary,
        ctx,
      });
      if (code)
        ctx.resolver.set(
          `promotion:${rKey.toLowerCase()}:${code.toLowerCase()}`,
          id,
        );
    } catch (err) {
      summary.failed += 1;
      log("ERROR", "promotions failed", { index: i, reason: err.message });
      if (!ctx.options.dryRun) throw err;
    }
  }
  return summary;
}

async function importCoupons(ctx) {
  const rows = ctx.stepData.get("coupons");
  const summary = {
    input: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const code = String(required(row.code, "code")).trim().toUpperCase();
      const restaurantId = row.restaurantKey
        ? await ctx.resolver.resolveRestaurantId(row.restaurantKey)
        : toObjectId(row.restaurantId);
      const payload = {
        name: required(row.name, "name"),
        code,
        category: row.category || "order",
        description: row.description || "",
        discountType: row.discountType || "PERCENT",
        discountValue: Number(required(row.discountValue, "discountValue")),
        minOrderValue: Number(row.minOrderValue ?? 0),
        maxDiscount: Number(row.maxDiscount ?? 0),
        maxUsage: Number(row.maxUsage ?? 0),
        used: Number(row.used ?? 0),
        publishAt: toDate(row.publishAt),
        restaurantId: restaurantId || undefined,
        constraints: row.constraints || undefined,
        startAt: toDate(row.startAt),
        endAt: toDate(row.endAt),
        isActive: row.isActive ?? true,
      };
      const id = await upsertWithSummary({
        model: Coupon,
        filter: { code },
        payload,
        summary,
        ctx,
      });
      ctx.resolver.set(`coupon:${code.toLowerCase()}`, id);
    } catch (err) {
      summary.failed += 1;
      log("ERROR", "coupons failed", { index: i, reason: err.message });
      if (!ctx.options.dryRun) throw err;
    }
  }
  return summary;
}

async function importReservations(ctx) {
  const rows = ctx.stepData.get("reservations");
  const summary = {
    input: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const rKey = required(row.restaurantKey, "restaurantKey");
      const tableCode = required(row.tableCode, "tableCode");
      const userEmail = required(row.userEmail, "userEmail");
      const timeTo = toDate(required(row.timeTo, "timeTo"));
      const rid = await ctx.resolver.resolveRestaurantId(rKey);
      const tableId = toObjectId(
        ctx.resolver.get(
          `table2:${rKey.toLowerCase()}:${String(tableCode).toLowerCase()}`,
        ),
      );
      const userId = await ctx.resolver.resolveUserIdByEmail(userEmail, {
        required: true,
      });
      if (!tableId) throw new Error(`Cannot resolve table ${tableCode}`);
      const payload = {
        restaurantId: rid,
        restaurantName: row.restaurantName || "",
        tableId,
        userId,
        orderCode: row.orderCode || undefined,
        timeTo,
        durationMinutes: row.durationMinutes ?? 60,
        isUnlimitedTime: bool(row.isUnlimitedTime, false),
        customerName: row.customerName || undefined,
        customerPhone: row.customerPhone || undefined,
        customerEmail: row.customerEmail || undefined,
        partySize: row.partySize ?? 2,
        note: row.note || "",
        linkedMenuSubtotal: row.linkedMenuSubtotal ?? 0,
        depositAmount: row.depositAmount ?? 0,
        depositStatus: row.depositStatus || "pending",
        paymentMethod: row.paymentMethod || "momo",
        paymentReference: row.paymentReference || undefined,
        status: row.status || "pending_payment",
      };
      const filter = {
        restaurantId: rid,
        tableId,
        userId,
        timeTo,
      };
      const id = await upsertWithSummary({
        model: Reservation,
        filter,
        payload,
        summary,
        ctx,
      });
      ctx.resolver.set(
        `reservation:${rKey.toLowerCase()}:${String(tableCode).toLowerCase()}:${normalizeEmail(userEmail)}:${timeTo.toISOString()}`,
        id,
      );
    } catch (err) {
      summary.failed += 1;
      log("ERROR", "reservations failed", { index: i, reason: err.message });
      if (!ctx.options.dryRun) throw err;
    }
  }
  return summary;
}

async function importOrders(ctx) {
  const rows = ctx.stepData.get("orders");
  const summary = {
    input: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const rKey = required(row.restaurantKey, "restaurantKey");
      const orderCode = required(row.orderCode, "orderCode");
      const createdAt = toDate(required(row.createdAt, "createdAt"));
      const rid = await ctx.resolver.resolveRestaurantId(rKey);
      const tableId = row.tableCode
        ? toObjectId(
            ctx.resolver.get(
              `table2:${rKey.toLowerCase()}:${String(row.tableCode).toLowerCase()}`,
            ),
          )
        : toObjectId(row.tableId);
      const userId = row.userEmail
        ? await ctx.resolver.resolveUserIdByEmail(row.userEmail, {
            required: false,
          })
        : toObjectId(row.userId);
      const reservationId = row.reservationRef
        ? toObjectId(ctx.resolver.get(`reservation:${row.reservationRef}`))
        : toObjectId(row.reservationId);
      const promotionId = row.totals?.promotionCode
        ? toObjectId(
            ctx.resolver.get(
              `promotion:${rKey.toLowerCase()}:${String(row.totals.promotionCode).toLowerCase()}`,
            ),
          )
        : toObjectId(row?.totals?.promotionId);

      const items = asArray(row.items).map((item, idx) => {
        const categoryId = item.categoryName
          ? toObjectId(
              ctx.resolver.get(
                `category:${rKey.toLowerCase()}:${String(item.categoryName).toLowerCase()}`,
              ),
            )
          : toObjectId(item.categoryId);
        const menuId = item.menuTimeSlot
          ? toObjectId(
              ctx.resolver.get(
                `menu:${rKey.toLowerCase()}:${normalizeTimeSlot(item.menuTimeSlot)}`,
              ),
            )
          : toObjectId(item.menuId);
        const dishId = item.itemKey
          ? toObjectId(
              ctx.resolver.get(
                `menuItem2:${rKey.toLowerCase()}:${String(item.itemKey).toLowerCase()}`,
              ),
            )
          : toObjectId(item.dishId);
        if (!categoryId || !menuId || !dishId) {
          throw new Error(`Order item #${idx} ref resolve failed`);
        }
        return {
          ...item,
          dishId,
          menuId,
          categoryId,
        };
      });

      const totals = {
        subtotal: row?.totals?.subtotal ?? 0,
        discount: row?.totals?.discount ?? 0,
        discountReason: row?.totals?.discountReason || undefined,
        voucherCode: row?.totals?.voucherCode || undefined,
        promotionId: promotionId || undefined,
        tax: row?.totals?.tax ?? 0,
        taxRate: row?.totals?.taxRate ?? 0,
        service: row?.totals?.service ?? 0,
        serviceRate: row?.totals?.serviceRate ?? 0,
        shippingFee: row?.totals?.shippingFee ?? 0,
        grandTotal: row?.totals?.grandTotal ?? 0,
      };

      const payload = {
        orderCode,
        parentOrderCode: row.parentOrderCode || undefined,
        dailySequence: row.dailySequence || undefined,
        tableId: tableId || undefined,
        tableCode: row.tableCode || undefined,
        tableName: row.tableName || undefined,
        guestCount: row.guestCount ?? 1,
        userId: userId || undefined,
        restaurantId: rid,
        reservationId: reservationId || undefined,
        orderType: row.orderType || "dine_in",
        shipping: row.shipping || undefined,
        items,
        totals,
        payment: row.payment || undefined,
        printStatus: row.printStatus || undefined,
        statusTimeline: asArray(row.statusTimeline),
        currentStatus: row.currentStatus || "confirmed",
        priority: row.priority || "MEDIUM",
        note: row.note || undefined,
        clientMeta: row.clientMeta || undefined,
        createdAt,
        updatedAt: toDate(row.updatedAt) || createdAt,
      };

      const filter = { restaurantId: rid, orderCode, createdAt };
      if (ctx.options.dryRun) {
        const existing = await Order.findOne(filter).select({ _id: 1 }).lean();
        if (existing?._id) summary.updated += 1;
        else summary.created += 1;
      } else {
        await Order.replaceOne(filter, payload, { upsert: true });
        const existing = await Order.findOne(filter).select({ _id: 1 }).lean();
        if (existing?._id) summary.updated += 1;
      }
    } catch (err) {
      summary.failed += 1;
      log("ERROR", "orders failed", {
        index: i,
        orderCode: row?.orderCode,
        reason: err.message,
      });
      if (!ctx.options.dryRun) throw err;
    }
  }
  return summary;
}

const STEP_HANDLERS = {
  restaurants: importRestaurants,
  floors: importFloors,
  tables: importTables,
  categories: importCategories,
  categoryMenus: importCategoryMenus,
  menus: importMenus,
  menuItems: importMenuItems,
  warehouses: importWarehouses,
  ingredients: importIngredients,
  recipes: importRecipes,
  stockItems: importStockItems,
  staff: importStaff,
  shifts: importShifts,
  promotions: importPromotions,
  coupons: importCoupons,
  reservations: importReservations,
  orders: importOrders,
};

async function preLoadStepData(stepsToRun, ctx) {
  for (const step of stepsToRun) {
    const rows = await loadStepData(step);
    ctx.stepData.set(step, rows);
  }
  const restaurants = ctx.stepData.get("restaurants") || [];
  ctx.restaurantIdsInSource = restaurants
    .map((r) => restaurantKeyFromInput(r))
    .filter(Boolean);
}

async function main() {
  const runId = crypto.randomUUID();
  const checkpointBase = {
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastCompletedStep: null,
    completedSteps: [],
    failedStep: null,
    runId,
    sourceDir: options.sourceDir,
    options,
  };
  let checkpoint = checkpointBase;

  log("RUN", "start import", { runId, options });

  if (options.clearCheckpoint) await clearCheckpoint();
  const existingCheckpoint = await loadCheckpoint();
  if (existingCheckpoint)
    checkpoint = {
      ...existingCheckpoint,
      runId,
      options,
      updatedAt: new Date().toISOString(),
    };

  const ctx = buildImportContext(runId);

  await connectDb();
  try {
    await ensureRestaurantManagerIndex();
    const stepsToRun = prepareStepsToRun(checkpoint);
    log("RUN", "steps selected", { stepsToRun });
    await preLoadStepData(stepsToRun, ctx);
    await resetScope(ctx, stepsToRun);

    for (const stepName of stepsToRun) {
      await runStep(
        stepName,
        () => STEP_HANDLERS[stepName](ctx),
        checkpoint,
        ctx,
      );
    }

    checkpoint.failedStep = null;
    checkpoint.updatedAt = new Date().toISOString();
    await saveCheckpoint(checkpoint);
    log("RUN", "completed", {
      runId,
      lastCompletedStep: checkpoint.lastCompletedStep,
      completedSteps: checkpoint.completedSteps,
      dryRun: options.dryRun,
    });
  } finally {
    await mongoose.disconnect();
    log("DB", "disconnected");
  }
}

main().catch((err) => {
  log("FATAL", err.message, { stack: err.stack });
  process.exit(1);
});
