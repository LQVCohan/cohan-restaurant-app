import { describe, expect, it } from "vitest";
import { DEFAULT_CAMERA_PLACEMENT, normalizeCameraPlacement } from "@/config/table3dCameraPlacementStorage";
import {
  buildPreviewModelItemFromVisualConfig,
  formatVisualConfigSavedAt,
} from "./tableVisualConfigHelpers";

describe("buildPreviewModelItemFromVisualConfig", () => {
  it("maps complete visualConfig to modelItem", () => {
    const visualConfig = {
      modelKey: "table.round.6",
      modelLabel: "Bàn tròn 6",
      tableType: "round",
      capacity: 6,
      defaultScale: 1.15,
      modelUrl: "https://cdn.example.com/round.glb",
      thumbnailUrl: "https://cdn.example.com/round.png",
      source: "catalog-test",
      sourceLabel: "Catalog Test",
      licenseLabel: "CC0",
      dimensions: { widthCm: 140, depthCm: 140, heightCm: 75 },
      tags: ["round", "vip"],
      fallbackKind: "model",
      customModelKind: "url",
      tableArea: "vip",
      shape: "round",
    };

    const result = buildPreviewModelItemFromVisualConfig(visualConfig);

    expect(result).toMatchObject({
      key: "table.round.6",
      label: "Bàn tròn 6",
      tableType: "round",
      capacity: 6,
      defaultScale: 1.15,
      modelUrl: "https://cdn.example.com/round.glb",
      thumbnailUrl: "https://cdn.example.com/round.png",
      source: "catalog-test",
      sourceLabel: "Catalog Test",
      licenseLabel: "CC0",
      dimensionsCm: { widthCm: 140, depthCm: 140, heightCm: 75 },
      tags: ["round", "vip"],
      fallbackKind: "model",
      customModelKind: "url",
      customModelSpec: {
        name: "Bàn tròn 6",
        capacity: 6,
        widthCm: 140,
        depthCm: 140,
        heightCm: 75,
        area: "vip",
        shape: "round",
      },
    });
  });

  it("uses fallback when modelKey/modelLabel is missing", () => {
    const result = buildPreviewModelItemFromVisualConfig({ capacity: 4 });

    expect(result.key).toBe("saved-model");
    expect(result.label).toBe("Mẫu bàn đã lưu");
    expect(result.capacity).toBe(4);
  });

  it("handles visualConfig dimensions missing without crash", () => {
    const result = buildPreviewModelItemFromVisualConfig({
      modelLabel: "Bàn test",
      dimensions: {},
      capacity: 2,
    });

    expect(result.customModelSpec).toBeNull();
    expect(result.capacity).toBe(2);
  });

  it("normalizes missing placement with default placement", () => {
    expect(normalizeCameraPlacement(undefined)).toEqual(DEFAULT_CAMERA_PLACEMENT);
  });
});

describe("formatVisualConfigSavedAt", () => {
  it("falls back when savedAt is invalid", () => {
    expect(formatVisualConfigSavedAt("invalid-date-value")).toBe("Không rõ thời gian lưu");
  });
});
