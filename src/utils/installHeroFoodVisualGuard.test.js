import { describe, expect, it } from "vitest";
import { getHeroFoodVisual } from "./installHeroFoodVisualGuard";

describe("getHeroFoodVisual", () => {
  it("returns food-only visuals instead of restaurant cover assets", () => {
    const visuals = [0, 1, 2].map(getHeroFoodVisual);

    expect(visuals).toHaveLength(3);
    expect(visuals.every((visual) => visual.src.includes("images.unsplash.com"))).toBe(true);
    expect(visuals.every((visual) => /món|pizza/i.test(visual.alt))).toBe(true);
  });

  it("wraps carousel indexes safely", () => {
    expect(getHeroFoodVisual(3)).toEqual(getHeroFoodVisual(0));
    expect(getHeroFoodVisual(4)).toEqual(getHeroFoodVisual(1));
    expect(getHeroFoodVisual(Number.NaN)).toEqual(getHeroFoodVisual(0));
  });
});
