import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import Restaurant from "../../models/restaurant.model.js";
import {
  RESTAURANT_CUISINE_TEMPLATES,
  getRestaurantCuisineTemplate,
  listRestaurantCuisineTemplateSummaries,
} from "../../src/data/restaurantCuisineTemplates.js";
import { listCuisineTemplates } from "../../src/services/restaurantCuisineTemplate.service.js";

function collectLegacyIds(items = []) {
  return new Set(items.map((item) => item.legacyId).filter(Boolean));
}

describe("restaurant cuisine starter templates", () => {
  it("provides seven versioned packages with complete dish and menu previews", () => {
    expect(RESTAURANT_CUISINE_TEMPLATES).toHaveLength(7);
    expect(listRestaurantCuisineTemplateSummaries()).toHaveLength(7);

    const summaries = listCuisineTemplates();
    expect(summaries).toHaveLength(7);

    for (const template of RESTAURANT_CUISINE_TEMPLATES) {
      const summary = summaries.find((item) => item.key === template.key);
      const menuCatalog = template.sections.menuCatalog;

      expect(template.version).toBeGreaterThan(0);
      expect(template.ingredientCount).toBe(10);
      expect(template.sections.inventoryMaster.ingredients).toHaveLength(10);
      expect(template.menuCount).toBe(menuCatalog.menus.length);
      expect(template.menuItemCount).toBe(menuCatalog.menuItems.length);
      expect(summary?.recipeCount).toBe(menuCatalog.recipes.length);
      expect(summary?.dishNames).toEqual(
        menuCatalog.menuItems.map((item) => item.name),
      );
      expect(summary?.dishNames).toHaveLength(template.menuItemCount);
      expect(summary?.timeSlotCount).toBe(
        new Set(menuCatalog.menus.map((menu) => menu.timeSlot)).size,
      );
      expect(summary?.menus).toHaveLength(menuCatalog.menus.length);

      for (const menu of menuCatalog.menus) {
        const preview = summary?.menus.find(
          (entry) => entry.key === menu.legacyId,
        );
        const expectedDishes = menuCatalog.menuItems
          .filter((item) => item.menuId === menu.legacyId)
          .map((item) => item.name);

        expect(preview).toEqual({
          key: menu.legacyId,
          name: menu.name,
          timeSlot: menu.timeSlot,
          dishCount: expectedDishes.length,
          dishNames: expectedDishes,
        });
      }

      expect(getRestaurantCuisineTemplate(template.key)?.key).toBe(template.key);
    }
  });

  it("keeps every menu item and recipe reference inside its package", () => {
    for (const template of RESTAURANT_CUISINE_TEMPLATES) {
      const menuCatalog = template.sections.menuCatalog;
      const menuIds = collectLegacyIds(menuCatalog.menus);
      const categoryIds = collectLegacyIds(menuCatalog.categories);
      const itemIds = collectLegacyIds(menuCatalog.menuItems);
      const ingredientIds = collectLegacyIds(
        template.sections.inventoryMaster.ingredients,
      );

      for (const item of menuCatalog.menuItems) {
        expect(menuIds.has(item.menuId)).toBe(true);
        expect(categoryIds.has(item.categoryId)).toBe(true);
        expect(item.prepStation).toBe("kitchen");
        expect(item.status).toBe("available");
      }

      for (const recipe of menuCatalog.recipes) {
        expect(itemIds.has(recipe.menuItemId)).toBe(true);
        expect(recipe.servingVariants).toHaveLength(1);
        expect(recipe.servingVariants[0].isDefault).toBe(true);
        for (const line of recipe.servingVariants[0].ingredients) {
          expect(ingredientIds.has(line.ingredientId)).toBe(true);
          expect(line.qty).toBeGreaterThan(0);
        }
      }
    }
  });

  it("marks only newly created brand restaurants as pending drafts", async () => {
    const brandRestaurant = new Restaurant({
      name: "Chi nhánh mới",
      brandId: new mongoose.Types.ObjectId(),
    });
    await brandRestaurant.validate();

    expect(brandRestaurant.initialSetup?.status).toBe("pending");
    expect(brandRestaurant.publicationStatus).toBe("draft");

    const legacyRestaurant = new Restaurant({ name: "Nhà hàng độc lập" });
    await legacyRestaurant.validate();

    expect(legacyRestaurant.initialSetup).toBeUndefined();
    expect(legacyRestaurant.publicationStatus).toBe("published");
  });
});
