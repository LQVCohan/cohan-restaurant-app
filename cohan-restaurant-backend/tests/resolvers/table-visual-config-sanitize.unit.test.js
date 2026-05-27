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
      placement: { x: 1000, y: -10, scale: 20, rotation: "15" },
      dimensions: { widthCm: 120, depthCm: 80, heightCm: 75 },
    });

    expect(result.modelKey).toBe("table-x");
    expect(result.source).toBe("camera-preview");
    expect(result.placement).toEqual({ x: 95, y: 5, scale: 2, rotation: 15 });
    expect(result.savedAt).toBeTruthy();
  });

  it("keeps savedAt if input already has savedAt", () => {
    const existingSavedAt = "2026-05-20T10:30:00.000Z";
    const result = sanitizeVisualConfig({
      modelKey: "table-y",
      placement: { x: 45, y: 55, scale: 1.2, rotation: 0 },
      savedAt: existingSavedAt,
    });

    expect(result.savedAt).toBe(existingSavedAt);
  });
});
