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
