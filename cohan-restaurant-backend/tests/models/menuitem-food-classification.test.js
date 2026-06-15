import { describe, expect, it } from "vitest";
import MenuItem from "../../models/menuitem.model.js";

describe("MenuItem food classification", () => {
  const basePayload = {
    restaurantId: "507f1f77bcf86cd799439011",
    menuId: "507f1f77bcf86cd799439012",
    categoryId: "507f1f77bcf86cd799439013",
    name: "Seasonal plate",
  };

  it("defaults existing menu items to UNKNOWN foodType", async () => {
    const item = new MenuItem(basePayload);

    await expect(item.validate()).resolves.toBeUndefined();
    expect(item.foodType).toBe("UNKNOWN");
    expect(item.meatTypes).toEqual([]);
  });

  it("accepts explicit foodType and meatTypes values", async () => {
    const item = new MenuItem({
      ...basePayload,
      foodType: "NON_VEGETARIAN",
      meatTypes: ["BEEF", "SEAFOOD"],
    });

    await expect(item.validate()).resolves.toBeUndefined();
    expect(item.foodType).toBe("NON_VEGETARIAN");
    expect(item.meatTypes).toEqual(["BEEF", "SEAFOOD"]);
  });

  it("rejects unsupported foodType values", async () => {
    const item = new MenuItem({ ...basePayload, foodType: "PESCATARIAN" });

    await expect(item.validate()).rejects.toThrow(/PESCATARIAN/);
  });
});
