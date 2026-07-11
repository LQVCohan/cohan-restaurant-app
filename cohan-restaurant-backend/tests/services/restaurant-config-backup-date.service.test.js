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

  return {
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
  };
});

vi.mock("../../models/index.js", () => models);

const lean = (value) => ({ lean: vi.fn().mockResolvedValue(value) });
const SOURCE_RESTAURANT_ID = "507f1f77bcf86cd799439001";
const TARGET_RESTAURANT_ID = "507f1f77bcf86cd799439002";
const OLD_FLOOR_ID = "507f1f77bcf86cd799439003";
const NEW_FLOOR_ID = "507f1f77bcf86cd799439004";
const TABLE_ID = "507f1f77bcf86cd799439005";

function resetModel(model) {
  Object.values(model).forEach((fn) => fn.mockReset());
  model.findById.mockReturnValue(lean(null));
  model.findOne.mockReturnValue(lean(null));
  model.find.mockReturnValue(lean([]));
  model.findOneAndUpdate.mockImplementation((filter, update) => Promise.resolve({ _id: TABLE_ID, ...filter, ...(update?.$set || {}) }));
  model.findByIdAndUpdate.mockImplementation((target, update) => Promise.resolve({ _id: target, ...(update?.$set || {}) }));
  model.create.mockImplementation((payload) => Promise.resolve({ _id: TABLE_ID, ...payload }));
  model.deleteMany.mockResolvedValue({ deletedCount: 0 });
}

async function loadService() {
  return import("../../src/services/restaurantConfigBackup.service.js");
}

describe("restaurant config backup date handling", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(models).forEach(resetModel);
  });

  it("serializes Date values as ISO strings in snapshots", async () => {
    const generatedAt = new Date("2026-07-11T01:00:00.000Z");
    const expiresAt = new Date("2026-07-11T03:00:00.000Z");
    const lockExpiresAt = new Date("2026-07-11T01:05:00.000Z");

    models.Restaurant.findById.mockReturnValue(lean({ _id: SOURCE_RESTAURANT_ID, name: "Nhà hàng nguồn" }));
    models.Floor.find.mockReturnValue(lean([{ _id: OLD_FLOOR_ID, restaurantId: SOURCE_RESTAURANT_ID, name: "Tầng 1", level: 1 }]));
    models.Table.find.mockReturnValue(lean([{
      _id: TABLE_ID,
      restaurantId: SOURCE_RESTAURANT_ID,
      floorId: OLD_FLOOR_ID,
      code: "A1",
      tableQrGeneratedAt: generatedAt,
      tableQrExpiresAt: expiresAt,
      viewLock: { expiresAt: lockExpiresAt },
    }]));

    const { buildRestaurantConfigSnapshot } = await loadService();
    const snapshot = await buildRestaurantConfigSnapshot({
      restaurantId: SOURCE_RESTAURANT_ID,
      sections: { floorTableLayout: true },
    });
    const table = snapshot.sections.floorTableLayout.tables[0];

    expect(table.tableQrGeneratedAt).toBe(generatedAt.toISOString());
    expect(table.tableQrExpiresAt).toBe(expiresAt.toISOString());
    expect(table.viewLock.expiresAt).toBe(lockExpiresAt.toISOString());
  });

  it("strips source table runtime state when cloning an older snapshot", async () => {
    models.Floor.findOneAndUpdate.mockResolvedValue({ _id: NEW_FLOOR_ID, name: "Tầng 1", level: 1 });

    const snapshot = {
      kind: "cohan.restaurant_config_snapshot",
      schemaVersion: 1,
      createdAt: "2026-07-11T00:00:00.000Z",
      source: { restaurantId: SOURCE_RESTAURANT_ID, restaurantName: "Nhà hàng nguồn", app: "cohan-restaurant-app" },
      sections: {
        floorTableLayout: {
          floors: [{ legacyId: OLD_FLOOR_ID, name: "Tầng 1", level: 1 }],
          tables: [{
            legacyId: TABLE_ID,
            floorId: OLD_FLOOR_ID,
            code: "A1",
            capacity: 4,
            position: { x: 10, y: 20 },
            status: "occupied",
            tableAccessUrl: "https://source.example/table/A1",
            tableQrCodeDataUrl: "data:image/png;base64,source",
            tableQrGeneratedAt: {},
            tableQrExpiresAt: {},
            viewLock: { expiresAt: {} },
            mergedFromTableIds: ["507f1f77bcf86cd799439006"],
            mergeAnchorTableId: "507f1f77bcf86cd799439007",
            mergedAt: {},
            mergedIntoTableId: "507f1f77bcf86cd799439008",
          }],
        },
      },
      counts: { floors: 1, tables: 1 },
    };

    const { importRestaurantConfigSnapshot } = await loadService();
    const result = await importRestaurantConfigSnapshot({
      targetRestaurantId: TARGET_RESTAURANT_ID,
      snapshot,
      mode: "clone",
      dryRun: false,
    });

    expect(result.success).toBe(true);
    const update = models.Table.findOneAndUpdate.mock.calls[0][1];
    expect(update.$set.floorId).toBe(NEW_FLOOR_ID);
    expect(update.$set.status).toBe("available");
    for (const field of [
      "tableAccessUrl",
      "tableQrCodeDataUrl",
      "tableQrGeneratedAt",
      "tableQrExpiresAt",
      "viewLock",
      "mergedFromTableIds",
      "mergeAnchorTableId",
      "mergedAt",
      "mergedIntoTableId",
    ]) {
      expect(update.$set[field]).toBeUndefined();
    }
    expect(update.$unset).toBeUndefined();
  });
});
