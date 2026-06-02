import { beforeEach, describe, expect, it, vi } from "vitest";

const models = vi.hoisted(() => {
  const makeModel = () => ({
    findById: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  });
  return ({
  AiChatbotEvaluationCase: makeModel(),
  AiChatbotKnowledgeItem: makeModel(),
  AiChatbotSafetyRule: makeModel(),
  Category: makeModel(),
  CategoryMenu: makeModel(),
  Combo: makeModel(),
  Coupon: makeModel(),
  CustomerRankSetting: makeModel(),
  Floor: makeModel(),
  Ingredient: makeModel(),
  IngredientCategory: makeModel(),
  Menu: makeModel(),
  MenuItem: makeModel(),
  ModifierGroup: makeModel(),
  PayrollSetting: makeModel(),
  PrintSetting: makeModel(),
  Promotion: makeModel(),
  Recipe: makeModel(),
  Restaurant: makeModel(),
  SchedulingPolicy: makeModel(),
  Supply: makeModel(),
  SupplyCategory: makeModel(),
  SystemSetting: makeModel(),
  Table: makeModel(),
  VoucherPackage: makeModel(),
  Warehouse: makeModel(),
  });
});

vi.mock("../../models/index.js", () => models);

const lean = (value) => ({ lean: vi.fn().mockResolvedValue(value) });
const id = (suffix) => `507f1f77bcf86cd7994390${suffix}`.slice(0, 24);

async function loadService() {
  return import("../../src/services/restaurantConfigBackup.service.js");
}

function resetModel(model) {
  Object.values(model).forEach((fn) => fn?.mockReset?.());
  model.find.mockReturnValue(lean([]));
  model.findOne.mockReturnValue(lean(null));
  model.findOneAndUpdate.mockImplementation((filter, update) => Promise.resolve({ _id: id("999"), ...filter, ...(update?.$set || {}) }));
  model.create.mockImplementation((payload) => Promise.resolve({ _id: id("888"), ...payload }));
  model.findByIdAndUpdate.mockImplementation((target, update) => Promise.resolve({ _id: target, ...(update?.$set || {}) }));
  model.deleteMany.mockResolvedValue({ deletedCount: 0 });
}

function setupSnapshotData() {
  Object.values(models).forEach(resetModel);
  models.Restaurant.findById.mockReturnValue(lean({
    _id: id("001"),
    name: "Cohan Demo",
    managerId: id("002"),
    avgRating: 4.9,
    passwordHash: "secret",
    refreshToken: "refresh",
    emailVerifyToken: "verify",
    trackingToken: "track",
    driverLocation: { lat: 1 },
    paymentSettings: { defaultProvider: "momo", providerSecret: "hidden", providers: [{ provider: "momo" }] },
    aiChatbotSettings: { enabled: true },
  }));
  models.SystemSetting.findOne.mockReturnValue(lean({ _id: id("003"), restaurantId: id("001"), locale: "vi", passwordHash: "bad" }));
  models.PrintSetting.findOne.mockReturnValue(lean({ _id: id("004"), restaurantId: id("001"), printers: [{ name: "Kitchen", localIp: "192.168.1.9" }], stations: [], templates: [], jobs: [] }));
  models.Floor.find.mockReturnValue(lean([{ _id: id("005"), restaurantId: id("001"), name: "Tầng 1", level: 1 }]));
  models.Table.find.mockReturnValue(lean([{ _id: id("006"), restaurantId: id("001"), floorId: id("005"), code: "A1", status: "occupied", viewLock: { by: "u1" } }]));
  models.Menu.find.mockReturnValue(lean([{ _id: id("007"), restaurantId: id("001"), timeSlot: "lunch", name: "Trưa" }]));
  models.Category.find.mockReturnValue(lean([{ _id: id("008"), restaurantId: id("001"), name: "Phở" }]));
  models.MenuItem.find.mockReturnValue(lean([{ _id: id("009"), restaurantId: id("001"), menuId: id("007"), categoryId: id("008"), code: "PHO", name: "Phở bò", orderCounter: 12, rate: 4.8 }]));
  models.Recipe.find.mockReturnValue(lean([{ _id: id("010"), restaurantId: id("001"), menuItemId: id("009"), servings: [] }]));
  models.Promotion.find.mockReturnValue(lean([{ _id: id("011"), restaurantId: id("001"), code: "SALE", usageCount: 5, used: 3 }]));
  models.Coupon.find.mockReturnValue(lean([{ _id: id("012"), restaurantId: id("001"), code: "COUPON", usageCount: 7, used: 4 }]));
}

describe("restaurantConfigBackup.service", () => {
  beforeEach(() => {
    vi.resetModules();
    setupSnapshotData();
  });

  it("build snapshot includes expected sections", async () => {
    const { buildRestaurantConfigSnapshot } = await loadService();
    const snapshot = await buildRestaurantConfigSnapshot({ restaurantId: id("001") });
    expect(snapshot.kind).toBe("cohan.restaurant_config_snapshot");
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.sections.restaurantProfile.name).toBe("Cohan Demo");
    expect(snapshot.sections.systemSettings.locale).toBe("vi");
    expect(snapshot.sections.floorTableLayout.floors).toHaveLength(1);
    expect(snapshot.sections.menuCatalog.menuItems).toHaveLength(1);
  });

  it("snapshot strips sensitive fields", async () => {
    const { buildRestaurantConfigSnapshot } = await loadService();
    const snapshot = await buildRestaurantConfigSnapshot({ restaurantId: id("001") });
    const text = JSON.stringify(snapshot);
    expect(text).not.toContain("passwordHash");
    expect(text).not.toContain("trackingToken");
    expect(text).not.toContain("emailVerifyToken");
    expect(text).not.toContain("refreshToken");
    expect(text).not.toContain("driverLocation");
    expect(text).not.toContain("providerSecret");
  });

  it("snapshot has checksum", async () => {
    const { buildRestaurantConfigSnapshot } = await loadService();
    const snapshot = await buildRestaurantConfigSnapshot({ restaurantId: id("001") });
    expect(snapshot.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("verify checksum detects tampered file", async () => {
    const { buildRestaurantConfigSnapshot, verifyRestaurantConfigSnapshot } = await loadService();
    const snapshot = await buildRestaurantConfigSnapshot({ restaurantId: id("001") });
    snapshot.source.restaurantName = "Tampered";
    expect(() => verifyRestaurantConfigSnapshot(snapshot)).toThrow(/checksum/i);
  });

  it("preview import clone reports create/update counts", async () => {
    const { buildRestaurantConfigSnapshot, previewRestaurantConfigImport } = await loadService();
    const snapshot = await buildRestaurantConfigSnapshot({ restaurantId: id("001") });
    const preview = await previewRestaurantConfigImport({ targetRestaurantId: id("099"), snapshot, mode: "clone" });
    expect(preview.valid).toBe(true);
    expect(preview.changes.find((item) => item.section === "floorTableLayout").count).toBe(2);
    expect(preview.changes.find((item) => item.section === "menuCatalog").count).toBe(4);
  });

  it("import dryRun does not write DB", async () => {
    const { buildRestaurantConfigSnapshot, importRestaurantConfigSnapshot } = await loadService();
    const snapshot = await buildRestaurantConfigSnapshot({ restaurantId: id("001") });
    const result = await importRestaurantConfigSnapshot({ targetRestaurantId: id("099"), snapshot, dryRun: true });
    expect(result.success).toBe(true);
    expect(models.SystemSetting.findOneAndUpdate).not.toHaveBeenCalled();
    expect(models.Table.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("import same_restaurant_restore rejects source mismatch", async () => {
    const { buildRestaurantConfigSnapshot, importRestaurantConfigSnapshot } = await loadService();
    const snapshot = await buildRestaurantConfigSnapshot({ restaurantId: id("001") });
    const result = await importRestaurantConfigSnapshot({ targetRestaurantId: id("099"), snapshot, mode: "same_restaurant_restore", dryRun: false });
    expect(result.success).toBe(false);
    expect(result.errors.join(" ")).toMatch(/same_restaurant_restore/);
  });

  it("import clone resets runtime fields", async () => {
    const { buildRestaurantConfigSnapshot, importRestaurantConfigSnapshot } = await loadService();
    const snapshot = await buildRestaurantConfigSnapshot({ restaurantId: id("001") });
    await importRestaurantConfigSnapshot({ targetRestaurantId: id("099"), snapshot, mode: "clone", dryRun: false });
    expect(models.Table.findOneAndUpdate.mock.calls.find((call) => call[0].code === "A1")[1].$set.status).toBe("available");
    expect(models.MenuItem.findOneAndUpdate.mock.calls.find((call) => call[0].code === "PHO")[1].$set.orderCounter).toBe(0);
    expect(models.MenuItem.findOneAndUpdate.mock.calls.find((call) => call[0].code === "PHO")[1].$set.rate).toBe(0);
    expect(models.Promotion.findOneAndUpdate.mock.calls.find((call) => call[0].code === "SALE")[1].$set.usageCount).toBe(0);
    expect(models.Coupon.findOneAndUpdate.mock.calls.find((call) => call[0].code === "COUPON")[1].$set.used).toBe(0);
  });

  it("restaurantProfile does not overwrite managerId in clone mode", async () => {
    const { buildRestaurantConfigSnapshot, importRestaurantConfigSnapshot } = await loadService();
    const snapshot = await buildRestaurantConfigSnapshot({ restaurantId: id("001") });
    await importRestaurantConfigSnapshot({ targetRestaurantId: id("099"), snapshot, mode: "clone", dryRun: false, sections: { restaurantProfile: true } });
    expect(models.Restaurant.findByIdAndUpdate.mock.calls[0][1].$set.managerId).toBeUndefined();
  });

  it("invalid kind/schemaVersion rejected", async () => {
    const { previewRestaurantConfigImport } = await loadService();
    const invalidKind = { kind: "wrong", schemaVersion: 1, sections: { systemSettings: {} } };
    expect((await previewRestaurantConfigImport({ targetRestaurantId: id("001"), snapshot: invalidKind })).valid).toBe(false);
    const invalidVersion = { kind: "cohan.restaurant_config_snapshot", schemaVersion: 999, sections: { systemSettings: {} } };
    expect((await previewRestaurantConfigImport({ targetRestaurantId: id("001"), snapshot: invalidVersion })).valid).toBe(false);
  });
});

describe("restaurantConfigBackup.service deep remapping", () => {
  const snapshotBase = (sections) => ({
    kind: "cohan.restaurant_config_snapshot",
    schemaVersion: 1,
    createdAt: "2026-06-02T00:00:00.000Z",
    source: { restaurantId: id("001"), restaurantName: "Source", app: "cohan-restaurant-app" },
    sections,
    counts: {},
  });

  beforeEach(() => {
    vi.resetModules();
    setupSnapshotData();
  });

  it("clone remaps table floorId", async () => {
    const oldFloor = id("101");
    const newFloor = id("201");
    models.Floor.findOneAndUpdate.mockResolvedValueOnce({ _id: newFloor, level: 1, name: "Tầng 1" });
    const { importRestaurantConfigSnapshot } = await loadService();
    await importRestaurantConfigSnapshot({
      targetRestaurantId: id("099"),
      mode: "clone",
      dryRun: false,
      snapshot: snapshotBase({ floorTableLayout: { floors: [{ legacyId: oldFloor, name: "Tầng 1", level: 1 }], tables: [{ legacyId: id("102"), floorId: oldFloor, code: "A1", status: "occupied" }] } }),
    });
    const tableUpdate = models.Table.findOneAndUpdate.mock.calls[0][1];
    expect(tableUpdate.$set.floorId).toBe(newFloor);
    expect(tableUpdate.$set.floorId).not.toBe(oldFloor);
  });

  it("clone remaps menuItem menuId/categoryId", async () => {
    const oldMenu = id("111");
    const oldCategory = id("112");
    const newMenu = id("211");
    const newCategory = id("212");
    models.Menu.findOneAndUpdate.mockResolvedValueOnce({ _id: newMenu });
    models.Category.findOneAndUpdate.mockResolvedValueOnce({ _id: newCategory });
    const { importRestaurantConfigSnapshot } = await loadService();
    await importRestaurantConfigSnapshot({
      targetRestaurantId: id("099"),
      mode: "clone",
      dryRun: false,
      snapshot: snapshotBase({ menuCatalog: { menus: [{ legacyId: oldMenu, timeSlot: "lunch", name: "Trưa" }], categories: [{ legacyId: oldCategory, name: "Món chính" }], categoryMenus: [], menuItems: [{ legacyId: id("113"), menuId: oldMenu, categoryId: oldCategory, code: "PHO", name: "Phở" }], modifierGroups: [], combos: [], recipes: [] } }),
    });
    const itemUpdate = models.MenuItem.findOneAndUpdate.mock.calls[0][1];
    expect(itemUpdate.$set.menuId).toBe(newMenu);
    expect(itemUpdate.$set.categoryId).toBe(newCategory);
  });

  it("clone remaps recipe menuItemId and ingredient lines", async () => {
    const oldMenu = id("121");
    const oldCategory = id("122");
    const oldItem = id("123");
    const oldIngredient = id("124");
    const newMenu = id("221");
    const newCategory = id("222");
    const newItem = id("223");
    const newIngredient = id("224");
    models.Menu.findOneAndUpdate.mockResolvedValueOnce({ _id: newMenu });
    models.Category.findOneAndUpdate.mockResolvedValueOnce({ _id: newCategory });
    models.MenuItem.findOneAndUpdate.mockResolvedValueOnce({ _id: newItem });
    models.Ingredient.findOneAndUpdate.mockResolvedValueOnce({ _id: newIngredient });
    const { importRestaurantConfigSnapshot } = await loadService();
    await importRestaurantConfigSnapshot({
      targetRestaurantId: id("099"),
      mode: "clone",
      dryRun: false,
      snapshot: snapshotBase({
        menuCatalog: { menus: [{ legacyId: oldMenu, timeSlot: "lunch", name: "Trưa" }], categories: [{ legacyId: oldCategory, name: "Món" }], categoryMenus: [], menuItems: [{ legacyId: oldItem, menuId: oldMenu, categoryId: oldCategory, code: "PHO", name: "Phở" }], modifierGroups: [], combos: [], recipes: [{ legacyId: id("125"), menuItemId: oldItem, servingVariants: [{ key: "regular", ingredients: [{ ingredientId: oldIngredient, quantity: 1 }] }] }] },
        inventoryMaster: { warehouses: [], ingredientCategories: [], ingredients: [{ legacyId: oldIngredient, sku: "BEEF", name: "Thịt bò" }], supplyCategories: [], supplies: [] },
      }),
    });
    const recipePayload = models.Recipe.findOneAndUpdate.mock.calls[0][1].$set;
    expect(recipePayload.menuItemId).toBe(newItem);
    expect(recipePayload.servingVariants[0].ingredients[0].ingredientId).toBe(newIngredient);
  });

  it("clone skips recipe ingredient lines when inventoryMaster not selected", async () => {
    const oldMenu = id("131");
    const oldCategory = id("132");
    const oldItem = id("133");
    const oldIngredient = id("134");
    models.Menu.findOneAndUpdate.mockResolvedValueOnce({ _id: id("231") });
    models.Category.findOneAndUpdate.mockResolvedValueOnce({ _id: id("232") });
    models.MenuItem.findOneAndUpdate.mockResolvedValueOnce({ _id: id("233") });
    const { importRestaurantConfigSnapshot } = await loadService();
    const result = await importRestaurantConfigSnapshot({
      targetRestaurantId: id("099"),
      mode: "clone",
      dryRun: false,
      sections: { menuCatalog: true, inventoryMaster: false },
      snapshot: snapshotBase({ menuCatalog: { menus: [{ legacyId: oldMenu, timeSlot: "lunch", name: "Trưa" }], categories: [{ legacyId: oldCategory, name: "Món" }], categoryMenus: [], menuItems: [{ legacyId: oldItem, menuId: oldMenu, categoryId: oldCategory, code: "PHO", name: "Phở" }], modifierGroups: [], combos: [], recipes: [{ legacyId: id("135"), menuItemId: oldItem, servingVariants: [{ ingredients: [{ ingredientId: oldIngredient, quantity: 1 }] }] }] } }),
    });
    const recipePayload = models.Recipe.findOneAndUpdate.mock.calls[0][1].$set;
    expect(JSON.stringify(recipePayload)).not.toContain(oldIngredient);
    expect(recipePayload.servingVariants[0].ingredients).toEqual([]);
    expect(result.warnings.join(" ")).toMatch(/Recipes may lose ingredient links/);
    expect(result.warnings.join(" ")).toMatch(/Skipped recipe ingredient line/);
  });

  it("clone remaps promotion refs", async () => {
    const oldMenu = id("141");
    const oldCategory = id("142");
    const oldItem = id("143");
    const oldGift = id("144");
    const newCategory = id("242");
    const newItem = id("243");
    const newGift = id("244");
    models.Menu.findOneAndUpdate.mockResolvedValueOnce({ _id: id("241") });
    models.Category.findOneAndUpdate.mockResolvedValueOnce({ _id: newCategory });
    models.MenuItem.findOneAndUpdate
      .mockResolvedValueOnce({ _id: newItem })
      .mockResolvedValueOnce({ _id: newGift });
    const { importRestaurantConfigSnapshot } = await loadService();
    await importRestaurantConfigSnapshot({
      targetRestaurantId: id("099"),
      mode: "clone",
      dryRun: false,
      snapshot: snapshotBase({
        menuCatalog: { menus: [{ legacyId: oldMenu, timeSlot: "lunch", name: "Trưa" }], categories: [{ legacyId: oldCategory, name: "Món" }], categoryMenus: [], menuItems: [{ legacyId: oldItem, menuId: oldMenu, categoryId: oldCategory, code: "A", name: "A" }, { legacyId: oldGift, menuId: oldMenu, categoryId: oldCategory, code: "B", name: "B" }], modifierGroups: [], combos: [], recipes: [] },
        promotionConfig: { promotions: [{ legacyId: id("145"), code: "SALE", categoryId: oldCategory, itemId: oldItem, giftItemId: oldGift, comboItems: [{ itemId: oldItem, quantity: 1 }], usageCount: 9 }], coupons: [], voucherPackages: [] },
      }),
    });
    const promotionPayload = models.Promotion.findOneAndUpdate.mock.calls[0][1].$set;
    expect(promotionPayload.categoryId).toBe(newCategory);
    expect(promotionPayload.itemId).toBe(newItem);
    expect(promotionPayload.giftItemId).toBe(newGift);
    expect(promotionPayload.comboItems[0].itemId).toBe(newItem);
    expect(promotionPayload.usageCount).toBe(0);
  });

  it("clone remaps coupon constraints known refs", async () => {
    const oldMenu = id("151");
    const oldCategory = id("152");
    const oldItem = "legacy-menu-item-for-coupon";
    const missingItem = "legacy-missing-menu-item";
    const newCategory = id("252");
    const newItem = id("253");
    models.Menu.findOneAndUpdate.mockResolvedValueOnce({ _id: id("251") });
    models.Category.findOneAndUpdate.mockResolvedValueOnce({ _id: newCategory });
    models.MenuItem.findOneAndUpdate.mockResolvedValueOnce({ _id: newItem });
    const { importRestaurantConfigSnapshot } = await loadService();
    const result = await importRestaurantConfigSnapshot({
      targetRestaurantId: id("099"),
      mode: "clone",
      dryRun: false,
      snapshot: snapshotBase({
        menuCatalog: { menus: [{ legacyId: oldMenu, timeSlot: "lunch", name: "Trưa" }], categories: [{ legacyId: oldCategory, name: "Món" }], categoryMenus: [], menuItems: [{ legacyId: oldItem, menuId: oldMenu, categoryId: oldCategory, code: "A", name: "A" }], modifierGroups: [], combos: [], recipes: [] },
        promotionConfig: { promotions: [], coupons: [{ legacyId: id("155"), code: "C", constraints: { categoryId: oldCategory, itemIds: [oldItem, missingItem], nested: { menuItemIds: [oldItem] } }, used: 4, usageCount: 6 }], voucherPackages: [] },
      }),
    });
    const couponPayload = models.Coupon.findOneAndUpdate.mock.calls[0][1].$set;
    expect(couponPayload.constraints.categoryId).toBe(newCategory);
    expect(couponPayload.constraints.itemIds).toEqual([newItem]);
    expect(couponPayload.constraints.nested.menuItemIds).toEqual([newItem]);
    expect(couponPayload.used).toBe(0);
    expect(couponPayload.usageCount).toBe(0);
    expect(result.warnings.join(" ")).toMatch(/Removed coupon itemIds reference/);
  });

  it("ai safety rules upsert by ruleType and pattern", async () => {
    const { importRestaurantConfigSnapshot } = await loadService();
    await importRestaurantConfigSnapshot({
      targetRestaurantId: id("099"),
      mode: "clone",
      dryRun: false,
      snapshot: snapshotBase({ aiChatbotConfig: { settings: {}, knowledgeItems: [], safetyRules: [{ legacyId: id("161"), ruleType: "blocked_topic", pattern: "medical", responseMessage: "handoff" }], evaluationCases: [] } }),
    });
    expect(models.AiChatbotSafetyRule.findOneAndUpdate.mock.calls[0][0]).toEqual(expect.objectContaining({ restaurantId: id("099"), ruleType: "blocked_topic", pattern: "medical" }));
  });

  it("clone clears table viewLock", async () => {
    models.Floor.findOneAndUpdate.mockResolvedValueOnce({ _id: id("271") });
    const { importRestaurantConfigSnapshot } = await loadService();
    await importRestaurantConfigSnapshot({
      targetRestaurantId: id("099"),
      mode: "clone",
      dryRun: false,
      snapshot: snapshotBase({ floorTableLayout: { floors: [{ legacyId: id("171"), name: "Tầng 1", level: 1 }], tables: [{ legacyId: id("172"), floorId: id("171"), code: "A1", viewLock: { by: "source" } }] } }),
    });
    expect(models.Table.findOneAndUpdate.mock.calls[0][1].$unset).toEqual({ viewLock: "" });
  });

  it("normalize ObjectId refs to string in snapshot", async () => {
    const oldFloor = id("181");
    const fakeObjectId = { toHexString: () => oldFloor };
    models.Table.find.mockReturnValue(lean([{ _id: id("182"), restaurantId: id("001"), floorId: fakeObjectId, code: "A1" }]));
    const { buildRestaurantConfigSnapshot } = await loadService();
    const snapshot = await buildRestaurantConfigSnapshot({ restaurantId: id("001"), sections: { floorTableLayout: true } });
    expect(snapshot.sections.floorTableLayout.tables[0].floorId).toBe(oldFloor);
    expect(JSON.stringify(snapshot.sections.floorTableLayout.tables[0].floorId)).not.toBe("{}");
  });
});
