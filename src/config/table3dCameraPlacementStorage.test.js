import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CAMERA_PLACEMENT_STORAGE_KEY,
  DEFAULT_CAMERA_PLACEMENT,
  buildCameraPlacementKey,
  deleteCameraPlacement,
  hasCameraPlacement,
  loadCameraPlacement,
  normalizeCameraPlacement,
  saveCameraPlacement,
} from "./table3dCameraPlacementStorage";

describe("table3dCameraPlacementStorage", () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key) => store.get(key) ?? null),
      setItem: vi.fn((key, value) => store.set(key, String(value))),
      removeItem: vi.fn((key) => store.delete(key)),
      clear: vi.fn(() => store.clear()),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("buildCameraPlacementKey is stable", () => {
    expect(buildCameraPlacementKey("m1", "r1")).toBe("r1::m1");
    expect(buildCameraPlacementKey("m1", "r1")).toBe(buildCameraPlacementKey("m1", "r1"));
  });

  it("normalizeCameraPlacement clamps values", () => {
    expect(normalizeCameraPlacement({ x: -5, y: 101, scale: 5, rotation: "abc" })).toEqual({
      x: 5,
      y: 95,
      scale: 2,
      rotation: 0,
    });
    expect(normalizeCameraPlacement({ x: 90, y: 20, scale: 0.1, rotation: -15 })).toEqual({
      x: 90,
      y: 20,
      scale: 0.5,
      rotation: -15,
    });
    expect(normalizeCameraPlacement(null)).toEqual(DEFAULT_CAMERA_PLACEMENT);
  });

  it("loadCameraPlacement fallback default when JSON corrupted", () => {
    localStorage.setItem(CAMERA_PLACEMENT_STORAGE_KEY, "bad-json");
    expect(loadCameraPlacement("m1", "r1")).toEqual(DEFAULT_CAMERA_PLACEMENT);
  });

  it("save/delete respects scoped key", () => {
    saveCameraPlacement("m1", { x: 10, y: 20, scale: 1, rotation: 30 }, "r1");
    saveCameraPlacement("m1", { x: 40, y: 50, scale: 1.5, rotation: 10 }, "r2");

    expect(loadCameraPlacement("m1", "r1")).toEqual({ x: 10, y: 20, scale: 1, rotation: 30 });
    expect(loadCameraPlacement("m1", "r2")).toEqual({ x: 40, y: 50, scale: 1.5, rotation: 10 });
    expect(hasCameraPlacement("m1", "r1")).toBe(true);

    deleteCameraPlacement("m1", "r1");
    expect(loadCameraPlacement("m1", "r1")).toEqual(DEFAULT_CAMERA_PLACEMENT);
    expect(loadCameraPlacement("m1", "r2")).toEqual({ x: 40, y: 50, scale: 1.5, rotation: 10 });
  });
});
