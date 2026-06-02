import crypto from "crypto";
import {
  AiChatbotEvaluationCase,
  AiChatbotKnowledgeItem,
  AiChatbotSafetyRule,
  Category,
  CategoryMenu,
  Combo,
  Coupon,
  CustomerRankSetting,
  Floor,
  Ingredient,
  IngredientCategory,
  Menu,
  MenuItem,
  ModifierGroup,
  PayrollSetting,
  PrintSetting,
  Promotion,
  Recipe,
  Restaurant,
  SchedulingPolicy,
  Supply,
  SupplyCategory,
  SystemSetting,
  Table,
  VoucherPackage,
  Warehouse,
} from "../../models/index.js";

export const SNAPSHOT_KIND = "cohan.restaurant_config_snapshot";
export const SNAPSHOT_SCHEMA_VERSION = 1;
export const MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;

export const CONFIG_BACKUP_SECTIONS = [
  { key: "restaurantProfile", label: "Hồ sơ nhà hàng" },
  { key: "systemSettings", label: "Cấu hình hệ thống" },
  { key: "printSettings", label: "Cấu hình in" },
  { key: "customerRankSettings", label: "Hạng khách hàng" },
  { key: "payrollSettings", label: "Lương" },
  { key: "schedulingPolicy", label: "Xếp ca" },
  { key: "floorTableLayout", label: "Sơ đồ tầng/bàn" },
  { key: "menuCatalog", label: "Menu/giá/công thức" },
  { key: "inventoryMaster", label: "Kho master data" },
  { key: "promotionConfig", label: "Khuyến mãi/coupon" },
  { key: "aiChatbotConfig", label: "AI chatbot" },
];

const SECTION_KEYS = CONFIG_BACKUP_SECTIONS.map((section) => section.key);
const SINGLETON_MODELS = {
  systemSettings: SystemSetting,
  printSettings: PrintSetting,
  customerRankSettings: CustomerRankSetting,
  payrollSettings: PayrollSetting,
  schedulingPolicy: SchedulingPolicy,
};
const SENSITIVE_KEY_RE = /(password|passwordHash|refreshToken|verifyToken|emailVerifyToken|phoneVerifyToken|trackingToken|driverLocation|secret|apiKey|accessToken|privateKey|clientSecret|providerSecret|paymentSecret)/i;
const RESTAURANT_PROFILE_FIELDS = [
  "name",
  "avatar",
  "coverImage",
  "spaceImages",
  "vrTourUrl",
  "address",
  "phone",
  "email",
  "featuredMenu",
  "amenities",
  "seatingCapacity",
  "priceRange",
  "openingHours",
  "closingHours",
  "description",
  "notesOnHours",
  "notesOnAmenities",
  "cuisineType",
  "businessStatus",
  "publicationStatus",
  "operationalStatus",
  "timezone",
  "weeklyOpeningHours",
  "specialHours",
  "capabilities",
  "reservationPolicy",
  "orderPolicy",
  "reservationSettings",
  "aiChatbotSettings",
  "paymentSettings",
  "defaultCurrency",
  "manualUsdToVndRate",
];

function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

async function resolveQuery(query) {
  if (!query) return query;
  if (typeof query.lean === "function") return query.lean();
  return query;
}

async function findMany(Model, filter) {
  if (!Model?.find) return [];
  return (await resolveQuery(Model.find(filter))) || [];
}

async function findOne(Model, filter) {
  if (!Model?.findOne) return null;
  return (await resolveQuery(Model.findOne(filter))) || null;
}

function pick(source, fields) {
  const out = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source || {}, field)) out[field] = source[field];
  }
  return out;
}

function sanitizeDocument(value) {
  if (Array.isArray(value)) return value.map(sanitizeDocument).filter((item) => item !== undefined);
  if (!value || typeof value !== "object") return value;
  const source = typeof value.toObject === "function" ? value.toObject({ depopulate: true }) : value;
  const out = {};
  for (const [key, raw] of Object.entries(source)) {
    if (key === "__v" || key === "createdAt" || key === "updatedAt") continue;
    if (SENSITIVE_KEY_RE.test(key)) continue;
    if (key === "_id") {
      out.legacyId = String(raw);
      continue;
    }
    out[key] = sanitizeDocument(raw);
  }
  return out;
}

function stripRestoreFields(doc) {
  if (!doc || typeof doc !== "object") return doc;
  const out = cloneJson(doc);
  delete out._id;
  delete out.id;
  delete out.legacyId;
  delete out.__v;
  delete out.createdAt;
  delete out.updatedAt;
  for (const key of Object.keys(out)) {
    if (SENSITIVE_KEY_RE.test(key)) delete out[key];
  }
  return out;
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function calculateSnapshotChecksum(snapshot) {
  const copy = cloneJson(snapshot) || {};
  delete copy.checksum;
  return `sha256:${crypto.createHash("sha256").update(canonicalJson(copy), "utf8").digest("hex")}`;
}

export function verifyRestaurantConfigSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") throw new Error("Invalid snapshot payload");
  if (snapshot.kind !== SNAPSHOT_KIND) throw new Error("Invalid restaurant config snapshot kind");
  if (snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) throw new Error("Unsupported restaurant config snapshot schemaVersion");
  if (!snapshot.sections || typeof snapshot.sections !== "object" || !Object.keys(snapshot.sections).length) {
    throw new Error("Snapshot has no sections");
  }
  if (snapshot.checksum) {
    const expected = calculateSnapshotChecksum(snapshot);
    if (expected !== snapshot.checksum) throw new Error("Snapshot checksum mismatch");
  }
  return true;
}

export function decodeSnapshotBase64(fileContentBase64) {
  if (!fileContentBase64 || typeof fileContentBase64 !== "string") throw new Error("fileContentBase64 is required");
  const buffer = Buffer.from(fileContentBase64, "base64");
  if (buffer.byteLength > MAX_SNAPSHOT_BYTES) throw new Error("Restaurant config snapshot file is too large");
  const text = buffer.toString("utf8");
  const snapshot = JSON.parse(text);
  verifyRestaurantConfigSnapshot(snapshot);
  return snapshot;
}

export function normalizeSections(sections) {
  const hasExplicit = sections && SECTION_KEYS.some((key) => Object.prototype.hasOwnProperty.call(sections, key));
  const enabled = {};
  for (const key of SECTION_KEYS) enabled[key] = hasExplicit ? Boolean(sections?.[key]) : true;
  if (!Object.values(enabled).some(Boolean)) throw new Error("At least one restaurant config backup section must be enabled");
  return enabled;
}

function countSection(key, value) {
  if (!value) return 0;
  if (Array.isArray(value)) return value.length;
  if (key === "floorTableLayout") return (value.floors || []).length + (value.tables || []).length;
  if (key === "menuCatalog") return ["menus", "categories", "categoryMenus", "menuItems", "modifierGroups", "combos", "recipes"].reduce((sum, k) => sum + (value[k] || []).length, 0);
  if (key === "inventoryMaster") return ["warehouses", "ingredientCategories", "ingredients", "supplyCategories", "supplies"].reduce((sum, k) => sum + (value[k] || []).length, 0);
  if (key === "promotionConfig") return ["promotions", "coupons", "voucherPackages"].reduce((sum, k) => sum + (value[k] || []).length, 0);
  if (key === "aiChatbotConfig") return ["knowledgeItems", "safetyRules", "evaluationCases"].reduce((sum, k) => sum + (value[k] || []).length, 0) + (value.settings && Object.keys(value.settings).length ? 1 : 0);
  return Object.keys(value).length ? 1 : 0;
}

export function buildSectionCounts(snapshotOrSections, enabledMap = null) {
  const sections = snapshotOrSections?.sections || snapshotOrSections || {};
  const enabled = enabledMap || Object.fromEntries(SECTION_KEYS.map((key) => [key, sections[key] != null]));
  return CONFIG_BACKUP_SECTIONS.map(({ key, label }) => ({ key, label, count: enabled[key] ? countSection(key, sections[key]) : 0, enabled: Boolean(enabled[key]) }));
}

function buildCounts(sections) {
  return {
    floors: sections.floorTableLayout?.floors?.length || 0,
    tables: sections.floorTableLayout?.tables?.length || 0,
    menuItems: sections.menuCatalog?.menuItems?.length || 0,
    menus: sections.menuCatalog?.menus?.length || 0,
    categories: sections.menuCatalog?.categories?.length || 0,
    ingredients: sections.inventoryMaster?.ingredients?.length || 0,
    promotions: sections.promotionConfig?.promotions?.length || 0,
    coupons: sections.promotionConfig?.coupons?.length || 0,
  };
}

export async function buildRestaurantConfigSnapshot({ restaurantId, sections, actorId } = {}) {
  const enabled = normalizeSections(sections);
  const restaurant = await resolveQuery(Restaurant.findById(restaurantId));
  if (!restaurant) throw new Error("Restaurant not found");
  const restaurantObj = sanitizeDocument(restaurant);
  const snapshotSections = {};

  if (enabled.restaurantProfile) snapshotSections.restaurantProfile = sanitizeDocument(pick(restaurantObj, RESTAURANT_PROFILE_FIELDS));
  for (const [key, Model] of Object.entries(SINGLETON_MODELS)) {
    if (enabled[key]) snapshotSections[key] = sanitizeDocument(await findOne(Model, { restaurantId }));
  }
  if (enabled.floorTableLayout) {
    snapshotSections.floorTableLayout = {
      floors: sanitizeDocument(await findMany(Floor, { restaurantId })),
      tables: sanitizeDocument(await findMany(Table, { restaurantId })),
    };
  }
  if (enabled.menuCatalog) {
    snapshotSections.menuCatalog = {
      menus: sanitizeDocument(await findMany(Menu, { restaurantId })),
      categories: sanitizeDocument(await findMany(Category, { restaurantId })),
      categoryMenus: sanitizeDocument(await findMany(CategoryMenu, { restaurantId })),
      menuItems: sanitizeDocument(await findMany(MenuItem, { restaurantId })),
      modifierGroups: sanitizeDocument(await findMany(ModifierGroup, { restaurantId })),
      combos: sanitizeDocument(await findMany(Combo, { restaurantId })),
      recipes: sanitizeDocument(await findMany(Recipe, { restaurantId })),
    };
  }
  if (enabled.inventoryMaster) {
    snapshotSections.inventoryMaster = {
      warehouses: sanitizeDocument(await findMany(Warehouse, { restaurantId })),
      ingredientCategories: sanitizeDocument(await findMany(IngredientCategory, { restaurantId })),
      ingredients: sanitizeDocument(await findMany(Ingredient, { restaurantId })),
      supplyCategories: sanitizeDocument(await findMany(SupplyCategory, { restaurantId })),
      supplies: sanitizeDocument(await findMany(Supply, { restaurantId })),
    };
  }
  if (enabled.promotionConfig) {
    snapshotSections.promotionConfig = {
      promotions: sanitizeDocument(await findMany(Promotion, { restaurantId })),
      coupons: sanitizeDocument(await findMany(Coupon, { restaurantId })),
      voucherPackages: sanitizeDocument(await findMany(VoucherPackage, { restaurantId })),
    };
  }
  if (enabled.aiChatbotConfig) {
    snapshotSections.aiChatbotConfig = {
      settings: sanitizeDocument(restaurantObj.aiChatbotSettings || {}),
      knowledgeItems: sanitizeDocument(await findMany(AiChatbotKnowledgeItem, { restaurantId })),
      safetyRules: sanitizeDocument(await findMany(AiChatbotSafetyRule, { restaurantId })),
      evaluationCases: sanitizeDocument(await findMany(AiChatbotEvaluationCase, { restaurantId })),
    };
  }

  const snapshot = {
    kind: SNAPSHOT_KIND,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    source: {
      restaurantId: String(restaurantId),
      restaurantName: restaurantObj.name || "",
      app: "cohan-restaurant-app",
      actorId: actorId ? String(actorId) : undefined,
    },
    sections: snapshotSections,
    counts: buildCounts(snapshotSections),
  };
  snapshot.checksum = calculateSnapshotChecksum(snapshot);
  return snapshot;
}

function sectionEntries(snapshot, requestedSections) {
  const enabled = normalizeSections(requestedSections || Object.fromEntries(Object.keys(snapshot.sections || {}).map((key) => [key, true])));
  return SECTION_KEYS.filter((key) => enabled[key] && snapshot.sections?.[key] !== undefined).map((key) => [key, snapshot.sections[key]]);
}

function change(section, action, count, warning = null) {
  const label = CONFIG_BACKUP_SECTIONS.find((item) => item.key === section)?.label || section;
  return { section, action, label, count: Number(count) || 0, warning };
}

export async function previewRestaurantConfigImport({ targetRestaurantId, snapshot, mode = "clone", sections } = {}) {
  const warnings = ["Đây là Restaurant Configuration Snapshot, không thay thế database backup vận hành."];
  const errors = [];
  try {
    verifyRestaurantConfigSnapshot(snapshot);
    if (mode === "same_restaurant_restore" && String(snapshot.source?.restaurantId) !== String(targetRestaurantId)) {
      errors.push("same_restaurant_restore chỉ được dùng với đúng nhà hàng nguồn trong snapshot.");
    }
    if (mode === "replace") warnings.push("Replace sẽ xóa cấu hình thuộc section đã chọn của targetRestaurantId trước khi import.");
  } catch (error) {
    errors.push(error.message);
  }
  const changes = errors.length
    ? []
    : sectionEntries(snapshot, sections).map(([section, value]) => change(section, mode === "clone" ? "create" : "upsert", countSection(section, value)));
  return {
    valid: errors.length === 0,
    schemaVersion: snapshot?.schemaVersion || null,
    sourceRestaurantName: snapshot?.source?.restaurantName || null,
    targetRestaurantId: String(targetRestaurantId),
    mode,
    changes,
    warnings,
    errors,
  };
}

async function deleteSectionData(targetRestaurantId, section) {
  if (section === "floorTableLayout") await Promise.all([Floor.deleteMany?.({ restaurantId: targetRestaurantId }), Table.deleteMany?.({ restaurantId: targetRestaurantId })]);
  if (section === "menuCatalog") await Promise.all([Menu.deleteMany?.({ restaurantId: targetRestaurantId }), Category.deleteMany?.({ restaurantId: targetRestaurantId }), CategoryMenu.deleteMany?.({ restaurantId: targetRestaurantId }), MenuItem.deleteMany?.({ restaurantId: targetRestaurantId }), ModifierGroup.deleteMany?.({ restaurantId: targetRestaurantId }), Combo.deleteMany?.({ restaurantId: targetRestaurantId }), Recipe.deleteMany?.({ restaurantId: targetRestaurantId })]);
  if (section === "inventoryMaster") await Promise.all([Warehouse.deleteMany?.({ restaurantId: targetRestaurantId }), IngredientCategory.deleteMany?.({ restaurantId: targetRestaurantId }), Ingredient.deleteMany?.({ restaurantId: targetRestaurantId }), SupplyCategory.deleteMany?.({ restaurantId: targetRestaurantId }), Supply.deleteMany?.({ restaurantId: targetRestaurantId })]);
  if (section === "promotionConfig") await Promise.all([Promotion.deleteMany?.({ restaurantId: targetRestaurantId }), Coupon.deleteMany?.({ restaurantId: targetRestaurantId }), VoucherPackage.deleteMany?.({ restaurantId: targetRestaurantId })]);
  if (["aiChatbotConfig"].includes(section)) await Promise.all([AiChatbotKnowledgeItem.deleteMany?.({ restaurantId: targetRestaurantId }), AiChatbotSafetyRule.deleteMany?.({ restaurantId: targetRestaurantId }), AiChatbotEvaluationCase.deleteMany?.({ restaurantId: targetRestaurantId })]);
}

async function upsertSingleton(Model, targetRestaurantId, data, actorId) {
  if (!data) return null;
  const payload = { ...stripRestoreFields(data), restaurantId: targetRestaurantId };
  if (actorId) payload.updatedBy = actorId;
  return Model.findOneAndUpdate({ restaurantId: targetRestaurantId }, { $set: payload }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

async function upsertByKey(Model, targetRestaurantId, doc, keys, extra = {}) {
  const payload = { ...stripRestoreFields(doc), ...extra, restaurantId: targetRestaurantId };
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key];
  }
  const filter = { restaurantId: targetRestaurantId };
  for (const key of keys) {
    if (payload[key] != null && payload[key] !== "") {
      filter[key] = payload[key];
      break;
    }
  }
  if (Object.keys(filter).length === 1) return Model.create(payload);
  return Model.findOneAndUpdate(filter, { $set: payload }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

function modelId(doc) {
  return doc?._id ? String(doc._id) : doc?.id ? String(doc.id) : null;
}

async function importFloorTable(targetRestaurantId, data, mode) {
  const floorMap = new Map();
  for (const floor of data?.floors || []) {
    const saved = await upsertByKey(Floor, targetRestaurantId, floor, ["level", "name"]);
    if (floor.legacyId && modelId(saved)) floorMap.set(String(floor.legacyId), modelId(saved));
  }
  for (const table of data?.tables || []) {
    const nextFloorId = floorMap.get(String(table.floorId)) || floorMap.get(String(table.floorId?.legacyId)) || table.floorId;
    const extra = { floorId: nextFloorId };
    if (mode === "clone") {
      extra.status = "available";
      extra.viewLock = undefined;
    }
    await upsertByKey(Table, targetRestaurantId, table, ["code", "name"], extra);
  }
}

async function importMenuCatalog(targetRestaurantId, data, mode) {
  const map = { menu: new Map(), category: new Map(), categoryMenu: new Map(), menuItem: new Map() };
  for (const categoryMenu of data?.categoryMenus || []) {
    const saved = await upsertByKey(CategoryMenu, targetRestaurantId, categoryMenu, ["name", "slug"]);
    if (categoryMenu.legacyId && modelId(saved)) map.categoryMenu.set(String(categoryMenu.legacyId), modelId(saved));
  }
  for (const menu of data?.menus || []) {
    const saved = await upsertByKey(Menu, targetRestaurantId, menu, ["timeSlot", "name"], { categoryMenuId: map.categoryMenu.get(String(menu.categoryMenuId)) || menu.categoryMenuId });
    if (menu.legacyId && modelId(saved)) map.menu.set(String(menu.legacyId), modelId(saved));
  }
  for (const category of data?.categories || []) {
    const saved = await upsertByKey(Category, targetRestaurantId, category, ["name"]);
    if (category.legacyId && modelId(saved)) map.category.set(String(category.legacyId), modelId(saved));
  }
  for (const item of data?.menuItems || []) {
    const extra = {
      menuId: map.menu.get(String(item.menuId)) || item.menuId,
      categoryId: map.category.get(String(item.categoryId)) || item.categoryId,
    };
    if (mode === "clone") {
      extra.orderCounter = 0;
      extra.rate = 0;
    }
    const saved = await upsertByKey(MenuItem, targetRestaurantId, item, ["code", "name"], extra);
    if (item.legacyId && modelId(saved)) map.menuItem.set(String(item.legacyId), modelId(saved));
  }
  for (const group of data?.modifierGroups || []) {
    const menuItemIds = (group.menuItemIds || []).map((id) => map.menuItem.get(String(id)) || id).filter(Boolean);
    await upsertByKey(ModifierGroup, targetRestaurantId, group, ["name"], { menuItemIds });
  }
  for (const combo of data?.combos || []) await upsertByKey(Combo, targetRestaurantId, combo, ["name"], mode === "clone" ? { usageCount: 0, used: 0 } : {});
  for (const recipe of data?.recipes || []) await upsertByKey(Recipe, targetRestaurantId, recipe, ["menuItemId"], { menuItemId: map.menuItem.get(String(recipe.menuItemId)) || recipe.menuItemId });
}

async function importList(Model, targetRestaurantId, docs, keys, mode) {
  for (const doc of docs || []) await upsertByKey(Model, targetRestaurantId, doc, keys, mode === "clone" ? { usageCount: 0, used: 0 } : {});
}

export async function importRestaurantConfigSnapshot({ targetRestaurantId, snapshot, mode = "clone", sections, actorId, dryRun = true, replaceExisting = false } = {}) {
  const preview = await previewRestaurantConfigImport({ targetRestaurantId, snapshot, mode, sections });
  const errors = [...preview.errors];
  const warnings = [...preview.warnings];
  if (mode === "replace" && !replaceExisting) errors.push("replace mode requires replaceExisting=true");
  if (errors.length) return { ...preview, success: false, dryRun: Boolean(dryRun), errors };
  if (dryRun) return { ...preview, success: true, dryRun: true };

  for (const [section, data] of sectionEntries(snapshot, sections)) {
    if (mode === "replace") await deleteSectionData(targetRestaurantId, section);
    if (section === "restaurantProfile") await Restaurant.findByIdAndUpdate(targetRestaurantId, { $set: stripRestoreFields(data) }, { new: true });
    if (SINGLETON_MODELS[section]) await upsertSingleton(SINGLETON_MODELS[section], targetRestaurantId, data, actorId);
    if (section === "floorTableLayout") await importFloorTable(targetRestaurantId, data, mode);
    if (section === "menuCatalog") await importMenuCatalog(targetRestaurantId, data, mode);
    if (section === "inventoryMaster") {
      await importList(Warehouse, targetRestaurantId, data.warehouses, ["name"], mode);
      await importList(IngredientCategory, targetRestaurantId, data.ingredientCategories, ["slug", "name"], mode);
      await importList(Ingredient, targetRestaurantId, data.ingredients, ["sku", "name"], mode);
      await importList(SupplyCategory, targetRestaurantId, data.supplyCategories, ["slug", "name"], mode);
      await importList(Supply, targetRestaurantId, data.supplies, ["sku", "name"], mode);
    }
    if (section === "promotionConfig") {
      await importList(Promotion, targetRestaurantId, data.promotions, ["code", "name"], mode);
      await importList(Coupon, targetRestaurantId, data.coupons, ["code"], mode);
      await importList(VoucherPackage, targetRestaurantId, data.voucherPackages, ["code", "name"], mode);
    }
    if (section === "aiChatbotConfig") {
      if (data.settings) await Restaurant.findByIdAndUpdate(targetRestaurantId, { $set: { aiChatbotSettings: data.settings } }, { new: true });
      await importList(AiChatbotKnowledgeItem, targetRestaurantId, data.knowledgeItems, ["title", "question"], mode);
      await importList(AiChatbotSafetyRule, targetRestaurantId, data.safetyRules, ["key", "name", "title"], mode);
      await importList(AiChatbotEvaluationCase, targetRestaurantId, data.evaluationCases, ["name", "question"], mode);
    }
  }

  return { ...preview, success: true, dryRun: false, warnings };
}
