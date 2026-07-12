import { describe, expect, it, vi } from "vitest";

vi.mock("../../models/index.js", () => ({
  Menu: { collection: {} },
}));

const legacyIndexes = [
  { name: "_id_", key: { _id: 1 } },
  {
    name: "restaurantId_1_timeSlot_1",
    key: { restaurantId: 1, timeSlot: 1 },
    unique: true,
  },
];

describe("migrateMenuMultiSlotIndexes", () => {
  it("reports the legacy unique index without changing it in check mode", async () => {
    const collection = {
      indexes: vi.fn().mockResolvedValue(legacyIndexes),
      dropIndex: vi.fn(),
      createIndex: vi.fn(),
    };
    const logger = { log: vi.fn() };
    const { migrateMenuMultiSlotIndexes } = await import(
      "../../scripts/migrateMenuMultiSlotIndexes.js"
    );

    const report = await migrateMenuMultiSlotIndexes({
      apply: false,
      collection,
      logger,
    });

    expect(report.legacyIndexes).toEqual(["restaurantId_1_timeSlot_1"]);
    expect(collection.dropIndex).not.toHaveBeenCalled();
    expect(collection.createIndex).not.toHaveBeenCalled();
  });

  it("drops the unique slot index and creates the lookup index in apply mode", async () => {
    const collection = {
      indexes: vi.fn().mockResolvedValue(legacyIndexes),
      dropIndex: vi.fn().mockResolvedValue(undefined),
      createIndex: vi.fn().mockResolvedValue(
        "restaurantId_1_timeSlot_1_isActive_1",
      ),
    };
    const logger = { log: vi.fn() };
    const { migrateMenuMultiSlotIndexes } = await import(
      "../../scripts/migrateMenuMultiSlotIndexes.js"
    );

    const report = await migrateMenuMultiSlotIndexes({
      apply: true,
      collection,
      logger,
    });

    expect(collection.dropIndex).toHaveBeenCalledWith(
      "restaurantId_1_timeSlot_1",
    );
    expect(collection.createIndex).toHaveBeenCalledWith(
      { restaurantId: 1, timeSlot: 1, isActive: 1 },
      { name: "restaurantId_1_timeSlot_1_isActive_1" },
    );
    expect(report.created).toBe(true);
  });

  it("creates the lookup index when the menu collection does not exist yet", async () => {
    const collection = {
      indexes: vi.fn().mockRejectedValue({
        code: 26,
        codeName: "NamespaceNotFound",
      }),
      dropIndex: vi.fn(),
      createIndex: vi.fn().mockResolvedValue(
        "restaurantId_1_timeSlot_1_isActive_1",
      ),
    };
    const logger = { log: vi.fn() };
    const { migrateMenuMultiSlotIndexes } = await import(
      "../../scripts/migrateMenuMultiSlotIndexes.js"
    );

    const report = await migrateMenuMultiSlotIndexes({
      apply: true,
      collection,
      logger,
    });

    expect(collection.dropIndex).not.toHaveBeenCalled();
    expect(collection.createIndex).toHaveBeenCalledWith(
      { restaurantId: 1, timeSlot: 1, isActive: 1 },
      { name: "restaurantId_1_timeSlot_1_isActive_1" },
    );
    expect(report.created).toBe(true);
  });
});
