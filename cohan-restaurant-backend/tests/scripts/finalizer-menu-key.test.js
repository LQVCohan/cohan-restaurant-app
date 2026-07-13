import { describe, expect, it } from "vitest";
import { MENU_SEED_KEY } from "../../scripts/finalizeDefenseDemoDataset.js";
import { SEED_KEY } from "../../scripts/seedDefenseMenuCatalog.js";

describe("menu catalog key", () => {
  it("matches between seed and finalizer", () => {
    expect(MENU_SEED_KEY).toBe(SEED_KEY);
  });
});
