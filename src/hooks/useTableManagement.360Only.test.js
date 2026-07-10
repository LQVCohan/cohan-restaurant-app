import { describe, expect, it } from "vitest";
import { stripLegacyTableVisualFields } from "./useTableManagement";

describe("stripLegacyTableVisualFields", () => {
  it("keeps the normal create-table floor position but removes model metadata", () => {
    const input = {
      restaurantId: "restaurant-1",
      floorId: "floor-1",
      code: "A1",
      position: { x: 50, y: 50, w: 80, h: 80 },
      visualConfig: { modelKey: "legacy-model" },
    };

    expect(stripLegacyTableVisualFields(input)).toEqual({
      restaurantId: "restaurant-1",
      floorId: "floor-1",
      code: "A1",
      position: { x: 50, y: 50, w: 80, h: 80 },
    });
  });

  it("drops AR-derived position when it arrives with legacy visual config", () => {
    const input = {
      id: "table-1",
      position: { x: 720, y: 430, w: 80, h: 80 },
      visualConfig: {
        modelKey: "legacy-model",
        arPlacement: { arPoint: { x: 1, y: 0, z: 2 } },
      },
    };

    expect(
      stripLegacyTableVisualFields(input, {
        dropPositionWithVisualConfig: true,
      }),
    ).toEqual({ id: "table-1" });
  });

  it("keeps a manual position update that has no legacy model payload", () => {
    const input = {
      id: "table-1",
      position: { x: 120, y: 160, w: 80, h: 80 },
    };

    expect(
      stripLegacyTableVisualFields(input, {
        dropPositionWithVisualConfig: true,
      }),
    ).toEqual(input);
  });
});
