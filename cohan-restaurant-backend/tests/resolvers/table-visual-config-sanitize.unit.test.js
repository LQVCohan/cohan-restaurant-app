import { describe, expect, it } from "vitest";
import { GraphQLError } from "graphql";
import { sanitizeVisualConfig } from "../../graphql/resolvers/table/mutation.js";

describe("sanitizeVisualConfig", () => {
  it("returns null for null", () => {
    expect(sanitizeVisualConfig(null)).toBeNull();
  });

  it("throws BAD_USER_INPUT when input is array", () => {
    try {
      sanitizeVisualConfig([]);
      throw new Error("Expected sanitizeVisualConfig to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(GraphQLError);
      expect(error.extensions?.code).toBe("BAD_USER_INPUT");
      expect(error.extensions?.field).toBe("visualConfig");
    }
  });

  it("clamps placement values", () => {
    const result = sanitizeVisualConfig({
      modelKey: "table-x",
      modelLabel: "Table X",
      tableType: "standard",
      capacity: 4,
      placement: { x: 1000, y: -10, scale: 20, rotation: "15", opacity: 2 },
      defaultScale: 1.1,
      modelUrl: "https://cdn.example.com/table.glb",
      thumbnailUrl: "javascript:alert(1)",
      source: "polyhaven",
      sourceLabel: " Poly Haven ",
      licenseLabel: "CC0",
      dimensions: { widthCm: 120, depthCm: 80, heightCm: 75, note: "ignored" },
      tags: ["round", "round", "vip"],
      fallbackKind: "model",
      customModelKind: "url",
      sourceType: "custom-url",
    });

    expect(result.modelKey).toBe("table-x");
    expect(result.source).toBe("polyhaven");
    expect(result.sourceType).toBe("custom-url");
    expect(result.modelUrl).toBe("https://cdn.example.com/table.glb");
    expect(result.thumbnailUrl).toBeNull();
    expect(result.defaultScale).toBe(1.1);
    expect(result.dimensions).toEqual({
      widthCm: 120,
      depthCm: 80,
      heightCm: 75,
      diameterCm: null,
    });
    expect(result.tags).toEqual(["round", "vip"]);
    expect(result.placement).toEqual({ x: 95, y: 5, scale: 2, rotation: 15, opacity: 1 });
    expect(result.savedAt).toBeTruthy();
  });

  it("keeps savedAt if input already has savedAt", () => {
    const existingSavedAt = "2026-05-20T10:30:00.000Z";
    const result = sanitizeVisualConfig({
      modelKey: "table-y",
      placement: { x: 45, y: 55, scale: 1.2, rotation: 0, opacity: 0.1 },
      savedAt: existingSavedAt,
    });

    expect(result.savedAt).toBe(existingSavedAt);
    expect(result.placement.opacity).toBe(0.35);
  });

  it("drops unsafe visualConfig URLs and limits tags", () => {
    const result = sanitizeVisualConfig({
      modelKey: "unsafe",
      modelUrl: "data:model/gltf+json;base64,AAA",
      thumbnailUrl: "blob:https://example.com/id",
      tags: Array.from({ length: 30 }, (_, index) => `tag-${index}`),
    });

    expect(result.modelUrl).toBeNull();
    expect(result.thumbnailUrl).toBeNull();
    expect(result.tags).toHaveLength(20);
    expect(result.fallbackKind).toBe("placeholder");
  });

  it("keeps diameterCm and normalizes diameter alias in dimensions", () => {
    const withDiameterCm = sanitizeVisualConfig({
      modelKey: "round-diameter-cm",
      dimensions: { diameterCm: 110, heightCm: 76, diameter: 120 },
    });
    const withDiameterAlias = sanitizeVisualConfig({
      modelKey: "round-diameter-alias",
      dimensions: { diameter: 95, heightCm: 72 },
    });

    expect(withDiameterCm.dimensions).toEqual({
      widthCm: null,
      depthCm: null,
      heightCm: 76,
      diameterCm: 110,
    });
    expect(withDiameterAlias.dimensions).toEqual({
      widthCm: null,
      depthCm: null,
      heightCm: 72,
      diameterCm: 95,
    });
  });
});
