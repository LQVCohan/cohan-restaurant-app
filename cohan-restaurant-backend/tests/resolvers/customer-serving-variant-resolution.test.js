import { beforeEach, describe, expect, it, vi } from "vitest";

const models = vi.hoisted(() => ({
  Recipe: { findOne: vi.fn() },
}));

vi.mock("../../models/index.js", () => models);

const { resolveCustomerServingVariantKey } = await import(
  "../../graphql/resolvers/cart/servingVariantResolution.js"
);

const recipeQuery = (recipe) => ({
  select: vi.fn(() => ({
    lean: vi.fn().mockResolvedValue(recipe),
  })),
});

const baseInput = {
  restaurantId: "507f1f77bcf86cd799439011",
  menuItemId: "507f1f77bcf86cd799439012",
};

describe("customer serving variant resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps a real explicit variant key without an extra recipe read", async () => {
    await expect(
      resolveCustomerServingVariantKey({
        ...baseInput,
        requestedKey: "large",
      }),
    ).resolves.toBe("large");

    expect(models.Recipe.findOne).not.toHaveBeenCalled();
  });

  it("keeps portion when the recipe actually defines that key", async () => {
    models.Recipe.findOne.mockReturnValue(
      recipeQuery({
        servingVariants: [
          { key: "portion", isDefault: false },
          { key: "default", isDefault: true },
        ],
      }),
    );

    await expect(
      resolveCustomerServingVariantKey({
        ...baseInput,
        requestedKey: "portion",
      }),
    ).resolves.toBe("portion");
  });

  it("maps the legacy portion fallback to the recipe default key", async () => {
    models.Recipe.findOne.mockReturnValue(
      recipeQuery({
        servingVariants: [
          { key: "default", isDefault: true },
          { key: "large", isDefault: false },
        ],
      }),
    );

    await expect(
      resolveCustomerServingVariantKey({
        ...baseInput,
        requestedKey: "portion",
      }),
    ).resolves.toBe("default");
  });

  it("uses the recipe default when the client omits the key", async () => {
    models.Recipe.findOne.mockReturnValue(
      recipeQuery({
        servingVariants: [
          { key: "small", isDefault: false },
          { key: "standard", isDefault: true },
        ],
      }),
    );

    await expect(
      resolveCustomerServingVariantKey({
        ...baseInput,
        requestedKey: "",
      }),
    ).resolves.toBe("standard");
  });

  it("rejects a legacy fallback when no active recipe exists", async () => {
    models.Recipe.findOne.mockReturnValue(recipeQuery(null));

    await expect(
      resolveCustomerServingVariantKey({
        ...baseInput,
        requestedKey: "portion",
      }),
    ).rejects.toMatchObject({
      message: "Món chưa có công thức đang hoạt động.",
      extensions: { code: "BAD_USER_INPUT" },
    });
  });
});
