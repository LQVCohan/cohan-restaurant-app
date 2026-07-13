import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  DISH_DEFS,
  INGREDIENT_DEFS,
  recipeCost,
  validateDefenseMenuCatalog,
} from "../../scripts/seedDefenseMenuCatalog.js";
import {
  DEFENSE_MENU_REAL_PHOTOS,
  getDefenseMenuPhotoSource,
  isManagedRealMenuPhotoPath,
  validateDefenseMenuPhotoCatalog,
} from "../../scripts/data/defenseMenuRealPhotos.js";
import {
  extensionFromBuffer,
  normalizeRasterImageUrl,
  parseRetryAfterMilliseconds,
} from "../../scripts/materializeDefenseMenuRealPhotos.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const ingredientByKey = new Map(
  INGREDIENT_DEFS.map((ingredient) => [ingredient.key, ingredient]),
);

describe("defense production menu catalog", () => {
  it("contains a complete operating menu with portion and by-weight dishes", () => {
    expect(validateDefenseMenuCatalog()).toEqual({
      dishes: 36,
      ingredients: 71,
      portionDishes: 34,
      byWeightDishes: 6,
      dualModeDishes: 4,
    });
  });

  it("stores realistic purchase costs in each ingredient base unit", () => {
    const cost = (key) => ingredientByKey.get(key)?.costPerBaseUnit;

    expect(cost("beef") * 1000).toBe(235_000);
    expect(cost("pork") * 1000).toBe(118_000);
    expect(cost("tigerPrawn") * 1000).toBe(310_000);
    expect(cost("crab") * 1000).toBe(480_000);
    expect(cost("rice") * 1000).toBe(30_000);
    expect(cost("orange")).toBe(8_000);

    for (const ingredient of INGREDIENT_DEFS) {
      expect(ingredient.costPerBaseUnit).toBeGreaterThan(0);
      expect(ingredient.minStock).toBeGreaterThan(0);
      expect(ingredient.onHand).toBeGreaterThan(ingredient.minStock);
    }
  });

  it("keeps every serving price above its recipe purchase cost", () => {
    for (const dish of DISH_DEFS) {
      for (const variant of dish.variants) {
        const cost = recipeCost(variant, ingredientByKey);
        expect(Number.isFinite(cost), `${dish.code}/${variant.key}`).toBe(true);
        expect(cost, `${dish.code}/${variant.key}`).toBeGreaterThan(0);
        expect(variant.price, `${dish.code}/${variant.key}`).toBeGreaterThan(cost);
        expect(variant.ingredients.length, `${dish.code}/${variant.key}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps baseline category illustrations available before photo materialization", () => {
    const images = new Set(DISH_DEFS.map((dish) => dish.thumbImage));
    expect(images.size).toBe(10);

    for (const image of images) {
      expect(image.startsWith("/images/menu/")).toBe(true);
      expect(fs.existsSync(path.join(repoRoot, "public", image.replace(/^\/+/, "")))).toBe(
        true,
      );
    }
  });

  it("defines a unique real photograph cache target for all 36 dishes", () => {
    const expectedCodes = DISH_DEFS.map((dish) => dish.code);
    expect(validateDefenseMenuPhotoCatalog(expectedCodes)).toEqual({
      photos: 36,
      uniqueCodes: 36,
      uniqueSlugs: 36,
    });
    expect(DEFENSE_MENU_REAL_PHOTOS).toHaveLength(36);

    for (const dish of DISH_DEFS) {
      const photo = getDefenseMenuPhotoSource(dish.code);
      expect(photo, dish.code).toBeTruthy();
      expect(photo.slug, dish.code).toMatch(/^[a-z0-9-]+$/);
      expect(photo.candidates.length, dish.code).toBeGreaterThan(0);
      expect(photo.fallback.url, dish.code).toMatch(/^https:\/\/images\.unsplash\.com\//);
    }
  });

  it("accepts only local raster photo paths after materialization", () => {
    expect(isManagedRealMenuPhotoPath("/images/menu/dishes/pho-bo.jpg")).toBe(true);
    expect(isManagedRealMenuPhotoPath("/images/menu/dishes/pho-bo.webp")).toBe(true);
    expect(isManagedRealMenuPhotoPath("/images/menu/category-breakfast.svg")).toBe(false);
    expect(isManagedRealMenuPhotoPath("https://images.unsplash.com/photo.jpg")).toBe(false);
  });

  it("forces Unsplash fallbacks to broadly supported JPEG responses", () => {
    const normalized = new URL(
      normalizeRasterImageUrl(
        "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=1400&q=88&fm=jpg",
      ),
    );

    expect(normalized.hostname).toBe("images.unsplash.com");
    expect(normalized.searchParams.get("auto")).toBeNull();
    expect(normalized.searchParams.get("fm")).toBe("jpg");
    expect(normalized.searchParams.get("fit")).toBe("crop");
  });

  it("recognizes only the supported raster signatures", () => {
    expect(extensionFromBuffer(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe("jpg");
    expect(
      extensionFromBuffer(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("png");
    expect(extensionFromBuffer(Buffer.from("RIFF0000WEBP", "ascii"))).toBe("webp");
    expect(extensionFromBuffer(Buffer.from("<!doctype html>"))).toBeNull();
  });

  it("honors Wikipedia Retry-After and caps unreasonable waits", () => {
    expect(parseRetryAfterMilliseconds("2", 0)).toBe(2_000);
    expect(parseRetryAfterMilliseconds("999", 0)).toBe(15_000);
    expect(parseRetryAfterMilliseconds(null, 1)).toBe(2_000);
  });

  it("does not expose internal fixture wording in menu display copy", () => {
    const forbidden = /\b(?:demo|defen[cs]e|seed|test|sample)\b/i;
    for (const dish of DISH_DEFS) {
      expect(forbidden.test(dish.name)).toBe(false);
      expect(forbidden.test(dish.description)).toBe(false);
    }
  });
});
