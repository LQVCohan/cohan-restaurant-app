import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Combo: {
    find: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    create: vi.fn(),
    deleteOne: vi.fn(),
  },
  Promotion: {
    find: vi.fn(),
    findOne: vi.fn(),
  },
  MenuItem: {
    find: vi.fn(),
  },
}));

const guardMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));

vi.mock("../../../models/index.js", () => modelMocks);
vi.mock("../../../src/services/auth/authorization.service.js", () => guardMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((value) => typeof value === "string" && value.startsWith("valid-")),
  },
}));

const ctx = { user: { id: "valid-user", roleName: "manager" } };

const makeChain = (result) => {
  const chain = {
    select: vi.fn(() => chain),
    sort: vi.fn(() => chain),
    populate: vi.fn(() => chain),
    lean: vi.fn(async () => result),
  };
  return chain;
};

const menuItemDocument = {
  _id: "valid-menu-item",
  name: "Phở bò",
  basePrice: 55000,
  thumbImage: "",
  status: "available",
};

const comboDocument = {
  _id: "valid-combo",
  restaurantId: { _id: "valid-r1", name: "Cohan" },
  name: "Combo sáng",
  description: "Bữa sáng nhanh",
  imageUrl: "",
  price: 45000,
  isActive: true,
  items: [{ menuItemId: menuItemDocument, qty: 1 }],
  createdAt: new Date("2026-07-10T00:00:00.000Z"),
  updatedAt: new Date("2026-07-10T01:00:00.000Z"),
};

const validInput = {
  restaurantId: "valid-r1",
  name: "Combo sáng",
  description: "Bữa sáng nhanh",
  imageUrl: "",
  price: 45000,
  isActive: true,
  items: [{ menuItemId: "valid-menu-item", qty: 1 }],
};

const loadResolvers = async () => (await import("../../../graphql/resolvers/customerCombo/index.js")).default;

describe("customerCombo resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.requireRestaurantPermission.mockResolvedValue(undefined);
    modelMocks.MenuItem.find.mockReturnValue(makeChain([{ _id: "valid-menu-item" }]));
    modelMocks.Combo.find.mockReturnValue(makeChain([]));
    modelMocks.Combo.findOne.mockReturnValue(makeChain(null));
    modelMocks.Combo.findById.mockReturnValue(makeChain(comboDocument));
    modelMocks.Combo.findOneAndUpdate.mockReturnValue(makeChain(comboDocument));
    modelMocks.Combo.findByIdAndUpdate.mockReturnValue(makeChain(comboDocument));
    modelMocks.Combo.create.mockResolvedValue({ _id: "valid-combo" });
    modelMocks.Combo.deleteOne.mockResolvedValue({ deletedCount: 1 });
    modelMocks.Promotion.find.mockReturnValue(makeChain([]));
    modelMocks.Promotion.findOne.mockReturnValue(makeChain(null));
  });

  it("rejects a non-integer quantity before reading menu items or writing", async () => {
    const resolvers = await loadResolvers();

    await expect(
      resolvers.Mutation.createCombo(null, {
        input: { ...validInput, items: [{ menuItemId: "valid-menu-item", qty: 1.5 }] },
      }, ctx),
    ).rejects.toThrow("Số lượng món ở dòng 1 phải là số nguyên lớn hơn 0.");

    expect(modelMocks.MenuItem.find).not.toHaveBeenCalled();
    expect(modelMocks.Combo.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate menu items and asks the caller to increase quantity", async () => {
    const resolvers = await loadResolvers();

    await expect(
      resolvers.Mutation.createCombo(null, {
        input: {
          ...validInput,
          items: [
            { menuItemId: "valid-menu-item", qty: 1 },
            { menuItemId: "valid-menu-item", qty: 2 },
          ],
        },
      }, ctx),
    ).rejects.toThrow("Mỗi món chỉ được thêm một lần");

    expect(modelMocks.MenuItem.find).not.toHaveBeenCalled();
    expect(modelMocks.Combo.create).not.toHaveBeenCalled();
  });

  it("scopes update by both combo id and restaurant id", async () => {
    const resolvers = await loadResolvers();

    const result = await resolvers.Mutation.updateCombo(
      null,
      { id: "valid-combo", input: validInput },
      ctx,
    );

    expect(modelMocks.Combo.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "valid-combo", restaurantId: "valid-r1" },
      expect.objectContaining({ restaurantId: "valid-r1", name: "Combo sáng" }),
      { new: true },
    );
    expect(result.id).toBe("valid-combo");
  });

  it("does not move a guessed combo from another restaurant", async () => {
    modelMocks.Combo.findOneAndUpdate.mockReturnValueOnce(makeChain(null));
    const resolvers = await loadResolvers();

    await expect(
      resolvers.Mutation.updateCombo(
        null,
        { id: "valid-other-combo", input: validInput },
        ctx,
      ),
    ).rejects.toThrow("Không tìm thấy combo trong nhà hàng đã chọn.");

    expect(modelMocks.Combo.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "valid-other-combo", restaurantId: "valid-r1" },
      expect.any(Object),
      { new: true },
    );
  });

  it("escapes regular-expression characters in manager search", async () => {
    const resolvers = await loadResolvers();

    await resolvers.Query.managerCombos(
      null,
      { restaurantId: "valid-r1", search: "Combo (A)+", status: "all" },
      ctx,
    );

    expect(modelMocks.Combo.find).toHaveBeenCalledWith({
      restaurantId: "valid-r1",
      name: { $regex: "Combo \\(A\\)\\+", $options: "i" },
    });
  });
});
