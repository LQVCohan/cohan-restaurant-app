import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  auditUpdateMany: vi.fn(),
  auditUpdateOne: vi.fn(),
  auditHistoryLean: vi.fn(),
  recipeLean: vi.fn(),
  recipeUpdateOne: vi.fn(),
  menuItemLean: vi.fn(),
}));

vi.mock("../../models/index.js", () => ({
  AuditLog: {
    create: mocks.auditCreate,
    updateMany: mocks.auditUpdateMany,
    updateOne: mocks.auditUpdateOne,
    findOneAndUpdate: vi.fn(() => ({ lean: mocks.auditHistoryLean })),
  },
  Recipe: {
    findOne: vi.fn(() => ({ lean: mocks.recipeLean })),
    updateOne: mocks.recipeUpdateOne,
  },
  MenuItem: {
    findOneAndUpdate: vi.fn(() => ({ lean: mocks.menuItemLean })),
  },
}));

const restaurantId = "64f000000000000000000001";
const menuItemId = "64f000000000000000000002";
const historyId = "64f000000000000000000003";

const beforeVariants = [
  { key: "default", price: 55000, name: "Mặc định" },
  { key: "large", price: 70000, name: "Lớn" },
];
const afterVariants = [
  { key: "default", price: 65000, name: "Mặc định" },
  { key: "large", price: 80000, name: "Lớn" },
];

describe("menuPriceHistory.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auditCreate.mockResolvedValue({ _id: historyId });
    mocks.auditUpdateMany.mockResolvedValue({ modifiedCount: 0 });
    mocks.auditUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.recipeUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it("persists the previous and new variant prices", async () => {
    const { recordMenuPriceChange } = await import(
      "../../src/services/menuPriceHistory.service.js"
    );

    await recordMenuPriceChange({
      restaurantId,
      menuItemId,
      beforeVariants,
      afterVariants,
      ctx: { user: { id: restaurantId } },
      source: "bulk",
    });

    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId,
        entityId: menuItemId,
        module: "menu_price_history",
        before: {
          servingVariantPrices: [
            { key: "default", price: 55000 },
            { key: "large", price: 70000 },
          ],
        },
        after: {
          servingVariantPrices: [
            { key: "default", price: 65000 },
            { key: "large", price: 80000 },
          ],
        },
      }),
    );
    expect(mocks.auditUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("restores the stored prices and synchronizes MenuItem.basePrice", async () => {
    mocks.auditHistoryLean.mockResolvedValue({
      _id: historyId,
      before: {
        servingVariantPrices: [
          { key: "default", price: 55000 },
          { key: "large", price: 70000 },
        ],
      },
    });
    mocks.recipeLean.mockResolvedValue({
      _id: "64f000000000000000000004",
      servingVariants: afterVariants,
    });
    mocks.menuItemLean.mockResolvedValue({ _id: menuItemId, basePrice: 55000 });

    const { restoreMenuItemPrices } = await import(
      "../../src/services/menuPriceHistory.service.js"
    );
    const result = await restoreMenuItemPrices({
      restaurantId,
      menuItemIds: [menuItemId],
      ctx: { user: { id: restaurantId } },
    });

    expect(mocks.recipeUpdateOne).toHaveBeenCalledWith(
      expect.any(Object),
      {
        $set: {
          servingVariants: [
            expect.objectContaining({ key: "default", price: 55000 }),
            expect.objectContaining({ key: "large", price: 70000 }),
          ],
        },
      },
      { runValidators: true },
    );
    expect(result).toEqual({
      restoredCount: 1,
      skippedCount: 0,
      items: [{ _id: menuItemId, basePrice: 55000 }],
    });
    expect(mocks.auditUpdateOne).toHaveBeenCalledWith(
      { _id: historyId },
      expect.objectContaining({
        $set: expect.objectContaining({ "metadata.status": "restored" }),
      }),
    );
  });
});
