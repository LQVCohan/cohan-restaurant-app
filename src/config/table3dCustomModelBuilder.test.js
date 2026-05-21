import { describe, expect, it } from "vitest";
import {
  buildCustomTableCatalogItem,
  DEFAULT_CUSTOM_TABLE_SPEC,
  mapCustomTableSpecToTableForm,
  normalizeCustomTableSpec,
} from "./table3dCustomModelBuilder";

describe("table3dCustomModelBuilder", () => {
  describe("normalizeCustomTableSpec", () => {
    it("applies defaults and fallbacks", () => {
      const normalized = normalizeCustomTableSpec({
        shape: "weird",
        area: "strange",
        material: "",
        color: "",
      });

      expect(normalized.shape).toBe("rect");
      expect(normalized.area).toBe("standard");
      expect(normalized.material).toBe("wood");
      expect(normalized.color).toBe("#b98962");
      expect(normalized.capacity).toBe(DEFAULT_CUSTOM_TABLE_SPEC.capacity);
    });

    it("trims text and clamps numeric values", () => {
      const normalized = normalizeCustomTableSpec({
        name: "  Bàn cửa sổ  ",
        notes: "  ưu tiên góc trái ",
        referenceImageName: "  inspo.png  ",
        capacity: 0,
        widthCm: 0,
        depthCm: -5,
        heightCm: "abc",
        diameterCm: null,
      });

      expect(normalized.name).toBe("Bàn cửa sổ");
      expect(normalized.notes).toBe("ưu tiên góc trái");
      expect(normalized.referenceImageName).toBe("inspo.png");
      expect(normalized.capacity).toBe(1);
      expect(normalized.widthCm).toBe(1);
      expect(normalized.depthCm).toBe(1);
      expect(normalized.heightCm).toBe(75);
      expect(normalized.diameterCm).toBe(1);
    });
  });

  describe("buildCustomTableCatalogItem", () => {
    it("builds parametric user-generated catalog item", () => {
      const item = buildCustomTableCatalogItem({ name: "Booth Family", capacity: 6, area: "booth" });

      expect(item.key).toMatch(/^custom-/);
      expect(item.source).toBe("user-generated");
      expect(item.fallbackKind).toBe("parametric");
      expect(item.customModelSpec).toBeTruthy();
      expect(item.capacity).toBe(6);
      expect(item.customModelSpec.area).toBe("booth");
    });
  });

  describe("mapCustomTableSpecToTableForm", () => {
    it("maps spec into table form payload", () => {
      expect(
        mapCustomTableSpecToTableForm({ name: "Round rooftop", area: "outdoor", capacity: 3 })
      ).toEqual({
        area: "outdoor",
        seats: 3,
        visualTemplate: "Round rooftop",
      });
    });
  });
});
