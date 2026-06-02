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

const RECIPE_INGREDIENT_WARNING = "Skipped recipe ingredient line because ingredient was not imported or could not be remapped.";
const RECIPE_DEPENDENCY_WARNING = "Recipes may lose ingredient links because inventoryMaster is not selected.";
const PROMOTION_DEPENDENCY_WARNING = "Promotion item/category references may be removed because menuCatalog is not selected.";

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

function isObjectIdLike(value) {
  return value && typeof value === "object" && typeof value.toHexString === "function";
}

export function refKey(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (isObjectIdLike(value)) return value.toHexString();
  if (value.legacyId) return String(value.legacyId);
  if (value._id) return refKey(value._id);
  if (value.id) return String(value.id);
  return String(value);
}

function sanitizeDocument(value) {
  if (Array.isArray(value)) return value.map(sanitizeDocument).filter((item) => item !== undefined);
  if (isObjectIdLike(value)) return value.toHexString();
  if (!value || typeof value !== "object") return value;
  const source = typeof value.toObject === "function" ? value.toObject({ depopulate: true }) : value;
  if (isObjectIdLike(source)) return source.toHexString();
  const out = {};
  for (const [key, raw] of Object.entries(source)) {
    if (key === "__v" || key === "createdAt" || key === "updatedAt") continue;
    if (SENSITIVE_KEY_RE.test(key)) continue;
    if (key === "_id") {
      out.legacyId = refKey(raw);
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

function enabledSectionsForSnapshot(snapshot, requestedSections) {
  const requested = requestedSections || Object.fromEntries(Object.keys(snapshot?.sections || {}).map((key) => [key, true]));
  return normalizeSections(requested);
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
  const enabled = enabledSectionsForSnapshot(snapshot, requestedSections);
  return SECTION_KEYS.filter((key) => enabled[key] && snapshot.sections?.[key] !== undefined).map((key) => [key, snapshot.sections[key]]);
}

function change(section, action, count, warning = null) {
  const label = CONFIG_BACKUP_SECTIONS.find((item) => item.key === section)?.label || section;
  return { section, action, label, count: Number(count) || 0, warning };
}

function hasIngredientLinesInValue(value) {
  if (Array.isArray(value)) return value.some(hasIngredientLinesInValue);
  if (!value || typeof value !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(value, "ingredientId") && value.ingredientId) return true;
  return Object.values(value).some(hasIngredientLinesInValue);
}

function hasRecipeIngredientLines(recipes = []) {
  return recipes.some((recipe) => hasIngredientLinesInValue(recipe?.servingVariants) || hasIngredientLinesInValue(recipe?.ingredients));
}

function hasPromotionKnownRefs(value) {
  if (Array.isArray(value)) return value.some(hasPromotionKnownRefs);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, item]) => {
    if (["categoryId", "categoryIds", "itemId", "itemIds", "menuItemId", "menuItemIds", "giftItemId"].includes(key) && item) return true;
    return hasPromotionKnownRefs(item);
  });
}

function addDependencyWarnings(snapshot, enabled, warnings) {
  if (enabled.menuCatalog && !enabled.inventoryMaster && hasRecipeIngredientLines(snapshot?.sections?.menuCatalog?.recipes || [])) {
    warnings.push(RECIPE_DEPENDENCY_WARNING);
  }
  if (enabled.promotionConfig && !enabled.menuCatalog && hasPromotionKnownRefs(snapshot?.sections?.promotionConfig || {})) {
    warnings.push(PROMOTION_DEPENDENCY_WARNING);
  }
  if (enabled.floorTableLayout) {
    const layout = snapshot?.sections?.floorTableLayout;
    if (layout && !(layout.floors || []).length && !(layout.tables || []).length) warnings.push("Floor/table layout section is selected but contains no floors or tables.");
  }
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

export async function previewRestaurantConfigImport({ targetRestaurantId, snapshot, mode = "clone", sections } = {}) {
  const warnings = ["Đây là Restaurant Configuration Snapshot, không thay thế database backup vận hành."];
  const errors = [];
  try {
    verifyRestaurantConfigSnapshot(snapshot);
    const enabled = enabledSectionsForSnapshot(snapshot, sections);
    if (mode === "same_restaurant_restore" && String(snapshot.source?.restaurantId) !== String(targetRestaurantId)) {
      errors.push("same_restaurant_restore chỉ được dùng với đúng nhà hàng nguồn trong snapshot.");
    }
    if (mode === "replace") warnings.push("Replace sẽ xóa cấu hình thuộc section đã chọn của targetRestaurantId trước khi import.");
    addDependencyWarnings(snapshot, enabled, warnings);
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
    warnings: uniqueStrings(warnings),
    errors,
  };
}

function createImportContext() {
  return {
    floorMap: new Map(),
    menuMap: new Map(),
    categoryMap: new Map(),
    categoryMenuMap: new Map(),
    menuItemMap: new Map(),
    ingredientMap: new Map(),
    warehouseMap: new Map(),
    supplyMap: new Map(),
    comboMap: new Map(),
    warnings: [],
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

function cleanupPayload(payload) {
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key];
  }
  return payload;
}

async function upsertByKey(Model, targetRestaurantId, doc, keys, extra = {}, options = {}) {
  const payload = cleanupPayload({ ...stripRestoreFields(doc), ...extra, restaurantId: targetRestaurantId });
  const filter = { restaurantId: targetRestaurantId };
  for (const key of keys) {
    if (payload[key] != null && payload[key] !== "") {
      filter[key] = payload[key];
      break;
    }
  }
  const update = { $set: payload };
  if (options.unset && Object.keys(options.unset).length) update.$unset = options.unset;
  if (Object.keys(filter).length === 1) return Model.create(payload);
  return Model.findOneAndUpdate(filter, update, { upsert: true, new: true, setDefaultsOnInsert: true });
}

async function upsertByCompositeKeys(Model, targetRestaurantId, doc, keys, extra = {}) {
  const payload = cleanupPayload({ ...stripRestoreFields(doc), ...extra, restaurantId: targetRestaurantId });
  const filter = { restaurantId: targetRestaurantId };
  for (const key of keys) {
    if (payload[key] != null && payload[key] !== "") filter[key] = payload[key];
  }
  if (Object.keys(filter).length !== keys.length + 1) return upsertByKey(Model, targetRestaurantId, payload, keys, {});
  return Model.findOneAndUpdate(filter, { $set: payload }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

function modelId(doc) {
  if (!doc) return null;
  if (isObjectIdLike(doc)) return doc.toHexString();
  if (doc._id) return refKey(doc._id);
  if (doc.id) return String(doc.id);
  return null;
}

function rememberLegacy(contextMap, doc, saved) {
  const legacy = refKey(doc?.legacyId || doc?._id || doc?.id);
  const savedId = modelId(saved);
  if (legacy && savedId) contextMap.set(legacy, savedId);
  return savedId;
}

function remapId(value, map) {
  if (!value) return value;
  const key = refKey(value);
  return map.get(key) || null;
}

async function importFloorTable(targetRestaurantId, data, mode, context) {
  for (const floor of data?.floors || []) {
    const saved = await upsertByKey(Floor, targetRestaurantId, floor, ["level", "name"]);
    rememberLegacy(context.floorMap, floor, saved);
  }
  for (const table of data?.tables || []) {
    let nextFloorId = remapId(table.floorId, context.floorMap);
    if (!nextFloorId && table.floorName) {
      const matchedFloor = await findOne(Floor, { restaurantId: targetRestaurantId, name: table.floorName });
      nextFloorId = modelId(matchedFloor);
    }
    if (!nextFloorId) {
      context.warnings.push(`Skipped table ${table.code || table.name || table.legacyId || "unknown"} because floorId could not be remapped.`);
      continue;
    }
    const extra = { floorId: nextFloorId };
    const options = {};
    if (mode === "clone") {
      extra.status = "available";
      options.unset = { viewLock: "" };
    }
    await upsertByKey(Table, targetRestaurantId, table, ["code", "name"], extra, options);
  }
}

async function importInventoryMaster(targetRestaurantId, data, mode, context) {
  for (const warehouse of data?.warehouses || []) {
    const saved = await upsertByKey(Warehouse, targetRestaurantId, warehouse, ["name"]);
    rememberLegacy(context.warehouseMap, warehouse, saved);
  }
  for (const category of data?.ingredientCategories || []) await upsertByKey(IngredientCategory, targetRestaurantId, category, ["slug", "name"], mode === "clone" ? { usageCount: 0, used: 0 } : {});
  for (const ingredient of data?.ingredients || []) {
    const saved = await upsertByKey(Ingredient, targetRestaurantId, ingredient, ["sku", "name"], mode === "clone" ? { usageCount: 0, used: 0 } : {});
    rememberLegacy(context.ingredientMap, ingredient, saved);
  }
  for (const category of data?.supplyCategories || []) await upsertByKey(SupplyCategory, targetRestaurantId, category, ["slug", "name"], mode === "clone" ? { usageCount: 0, used: 0 } : {});
  for (const supply of data?.supplies || []) {
    const saved = await upsertByKey(Supply, targetRestaurantId, supply, ["sku", "name"], mode === "clone" ? { usageCount: 0, used: 0 } : {});
    rememberLegacy(context.supplyMap, supply, saved);
  }
}

function remapRecipeIngredientRefs(value, context) {
  if (Array.isArray(value)) return value.map((item) => remapRecipeIngredientRefs(item, context)).filter((item) => item !== null);
  if (!value || typeof value !== "object") return value;
  const payload = { ...value };
  if (payload.ingredientId) {
    const mapped = remapId(payload.ingredientId, context.ingredientMap);
    if (!mapped) {
      context.warnings.push(RECIPE_INGREDIENT_WARNING);
      return null;
    }
    payload.ingredientId = mapped;
  }
  for (const [key, child] of Object.entries(payload)) {
    if (key === "ingredientId") continue;
    payload[key] = remapRecipeIngredientRefs(child, context);
  }
  return payload;
}

async function importMenuCatalogBase(targetRestaurantId, data, mode, context) {
  for (const categoryMenu of data?.categoryMenus || []) {
    const saved = await upsertByKey(CategoryMenu, targetRestaurantId, categoryMenu, ["name", "slug"]);
    rememberLegacy(context.categoryMenuMap, categoryMenu, saved);
  }
  for (const menu of data?.menus || []) {
    const categoryMenuId = menu.categoryMenuId ? remapId(menu.categoryMenuId, context.categoryMenuMap) : undefined;
    const extra = {};
    if (menu.categoryMenuId && categoryMenuId) extra.categoryMenuId = categoryMenuId;
    if (mode === "clone" && menu.categoryMenuId && !categoryMenuId) context.warnings.push(`Removed menu categoryMenuId for ${menu.name || menu.timeSlot || menu.legacyId || "unknown"} because it could not be remapped.`);
    const saved = await upsertByKey(Menu, targetRestaurantId, menu, ["timeSlot", "name"], extra);
    rememberLegacy(context.menuMap, menu, saved);
  }
  for (const category of data?.categories || []) {
    const saved = await upsertByKey(Category, targetRestaurantId, category, ["name"]);
    rememberLegacy(context.categoryMap, category, saved);
  }
  for (const item of data?.menuItems || []) {
    const menuId = remapId(item.menuId, context.menuMap);
    const categoryId = remapId(item.categoryId, context.categoryMap);
    if (!menuId || !categoryId) {
      context.warnings.push(`Skipped menu item ${item.code || item.name || item.legacyId || "unknown"} because menuId/categoryId could not be remapped.`);
      continue;
    }
    const extra = { menuId, categoryId };
    if (mode === "clone") {
      extra.orderCounter = 0;
      extra.rate = 0;
    }
    const saved = await upsertByKey(MenuItem, targetRestaurantId, item, ["code", "name"], extra);
    rememberLegacy(context.menuItemMap, item, saved);
  }
  for (const group of data?.modifierGroups || []) {
    const menuItemIds = (group.menuItemIds || []).map((idValue) => remapId(idValue, context.menuItemMap)).filter(Boolean);
    await upsertByKey(ModifierGroup, targetRestaurantId, group, ["name"], { menuItemIds });
  }
  for (const combo of data?.combos || []) {
    const saved = await upsertByKey(Combo, targetRestaurantId, combo, ["name"], mode === "clone" ? { usageCount: 0, used: 0 } : {});
    rememberLegacy(context.comboMap, combo, saved);
  }
}

async function importMenuCatalogRecipes(targetRestaurantId, data, context) {
  for (const recipe of data?.recipes || []) {
    const menuItemId = remapId(recipe.menuItemId, context.menuItemMap);
    if (!menuItemId) {
      context.warnings.push(`Skipped recipe ${recipe.legacyId || "unknown"} because menuItemId could not be remapped.`);
      continue;
    }
    const payload = stripRestoreFields(recipe);
    payload.menuItemId = menuItemId;
    if (payload.servingVariants) payload.servingVariants = remapRecipeIngredientRefs(payload.servingVariants, context);
    if (payload.ingredients) payload.ingredients = remapRecipeIngredientRefs(payload.ingredients, context);
    await upsertByKey(Recipe, targetRestaurantId, payload, ["menuItemId"], { menuItemId });
  }
}

function remapPromotionDoc(doc, context, mode) {
  const payload = stripRestoreFields(doc);
  for (const [field, map] of [["categoryId", context.categoryMap], ["itemId", context.menuItemMap], ["giftItemId", context.menuItemMap]]) {
    if (!payload[field]) continue;
    const mapped = remapId(payload[field], map);
    if (mapped) payload[field] = mapped;
    else {
      delete payload[field];
      context.warnings.push(`Removed promotion ${field} because it could not be remapped.`);
    }
  }
  if (Array.isArray(payload.comboItems)) {
    payload.comboItems = payload.comboItems
      .map((line) => {
        const mapped = remapId(line?.itemId, context.menuItemMap);
        if (!mapped) {
          context.warnings.push("Skipped promotion combo item because menu item could not be remapped.");
          return null;
        }
        return { ...line, itemId: mapped };
      })
      .filter(Boolean);
  }
  if (mode === "clone") {
    payload.usageCount = 0;
    payload.used = 0;
  }
  return payload;
}

function remapKnownRefByKey(key, value, context) {
  const isCategory = key === "categoryId" || key === "categoryIds";
  const isItem = key === "itemId" || key === "itemIds" || key === "menuItemId" || key === "menuItemIds" || key === "giftItemId";
  if (!isCategory && !isItem) return { handled: false, value };
  const map = isCategory ? context.categoryMap : context.menuItemMap;
  if (Array.isArray(value)) {
    const next = value.map((item) => remapId(item, map)).filter(Boolean);
    if (next.length !== value.length) context.warnings.push(`Removed coupon ${key} reference because it could not be remapped.`);
    return { handled: true, value: next };
  }
  const mapped = remapId(value, map);
  if (!mapped) {
    context.warnings.push(`Removed coupon ${key} reference because it could not be remapped.`);
    return { handled: true, value: undefined };
  }
  return { handled: true, value: mapped };
}

function deepRemapKnownRefs(value, context) {
  if (Array.isArray(value)) return value.map((item) => deepRemapKnownRefs(item, context)).filter((item) => item !== undefined);
  if (!value || typeof value !== "object") return value;
  const payload = {};
  for (const [key, child] of Object.entries(value)) {
    const remapped = remapKnownRefByKey(key, child, context);
    const nextValue = remapped.handled ? remapped.value : deepRemapKnownRefs(child, context);
    if (nextValue !== undefined) payload[key] = nextValue;
  }
  return payload;
}

function remapCouponDoc(doc, context, mode) {
  const payload = stripRestoreFields(doc);
  if (payload.constraints) payload.constraints = deepRemapKnownRefs(payload.constraints, context);
  for (const key of ["categoryId", "categoryIds", "itemId", "itemIds", "menuItemId", "menuItemIds", "giftItemId"]) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) continue;
    const remapped = remapKnownRefByKey(key, payload[key], context);
    if (remapped.value === undefined) delete payload[key];
    else payload[key] = remapped.value;
  }
  if (mode === "clone") {
    payload.used = 0;
    payload.usageCount = 0;
  }
  return payload;
}

async function importPromotionConfig(targetRestaurantId, data, mode, context) {
  for (const promotion of data?.promotions || []) {
    const payload = remapPromotionDoc(promotion, context, mode);
    await upsertByKey(Promotion, targetRestaurantId, payload, ["code", "name"]);
  }
  for (const coupon of data?.coupons || []) {
    const payload = remapCouponDoc(coupon, context, mode);
    await upsertByKey(Coupon, targetRestaurantId, payload, ["code"]);
  }
  for (const voucherPackage of data?.voucherPackages || []) {
    await upsertByKey(VoucherPackage, targetRestaurantId, voucherPackage, ["code", "name"], mode === "clone" ? { usageCount: 0, used: 0 } : {});
  }
}

async function importList(Model, targetRestaurantId, docs, keys, mode) {
  for (const doc of docs || []) await upsertByKey(Model, targetRestaurantId, doc, keys, mode === "clone" ? { usageCount: 0, used: 0 } : {});
}

async function importAiChatbotConfig(targetRestaurantId, data, mode) {
  if (data.settings) await Restaurant.findByIdAndUpdate(targetRestaurantId, { $set: { aiChatbotSettings: data.settings } }, { new: true });
  await importList(AiChatbotKnowledgeItem, targetRestaurantId, data.knowledgeItems, ["title", "question"], mode);
  for (const rule of data.safetyRules || []) await upsertByCompositeKeys(AiChatbotSafetyRule, targetRestaurantId, rule, ["ruleType", "pattern"], mode === "clone" ? { usageCount: 0, used: 0 } : {});
  await importList(AiChatbotEvaluationCase, targetRestaurantId, data.evaluationCases, ["name", "question"], mode);
}

export async function importRestaurantConfigSnapshot({ targetRestaurantId, snapshot, mode = "clone", sections, actorId, dryRun = true, replaceExisting = false } = {}) {
  const preview = await previewRestaurantConfigImport({ targetRestaurantId, snapshot, mode, sections });
  const errors = [...preview.errors];
  const warnings = [...preview.warnings];
  if (mode === "replace" && !replaceExisting) errors.push("replace mode requires replaceExisting=true");
  if (errors.length) return { ...preview, success: false, dryRun: Boolean(dryRun), errors, warnings: uniqueStrings(warnings) };
  if (dryRun) return { ...preview, success: true, dryRun: true, warnings: uniqueStrings(warnings) };

  const enabled = enabledSectionsForSnapshot(snapshot, sections);
  const context = createImportContext();
  for (const [section] of sectionEntries(snapshot, sections)) {
    if (mode === "replace") await deleteSectionData(targetRestaurantId, section);
  }

  const data = snapshot.sections || {};
  if (enabled.restaurantProfile && data.restaurantProfile) await Restaurant.findByIdAndUpdate(targetRestaurantId, { $set: stripRestoreFields(data.restaurantProfile) }, { new: true });
  for (const [section, Model] of Object.entries(SINGLETON_MODELS)) {
    if (enabled[section] && data[section]) await upsertSingleton(Model, targetRestaurantId, data[section], actorId);
  }
  if (enabled.floorTableLayout && data.floorTableLayout) await importFloorTable(targetRestaurantId, data.floorTableLayout, mode, context);
  if (enabled.menuCatalog && data.menuCatalog) await importMenuCatalogBase(targetRestaurantId, data.menuCatalog, mode, context);
  if (enabled.inventoryMaster && data.inventoryMaster) await importInventoryMaster(targetRestaurantId, data.inventoryMaster, mode, context);
  if (enabled.menuCatalog && data.menuCatalog) await importMenuCatalogRecipes(targetRestaurantId, data.menuCatalog, context);
  if (enabled.promotionConfig && data.promotionConfig) await importPromotionConfig(targetRestaurantId, data.promotionConfig, mode, context);
  if (enabled.aiChatbotConfig && data.aiChatbotConfig) await importAiChatbotConfig(targetRestaurantId, data.aiChatbotConfig, mode);

  return { ...preview, success: true, dryRun: false, warnings: uniqueStrings([...warnings, ...context.warnings]) };
}
