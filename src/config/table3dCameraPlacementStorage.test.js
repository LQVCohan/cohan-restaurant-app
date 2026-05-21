import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CAMERA_PLACEMENT,
  deleteCameraPlacement,
  getCameraPlacementStorageKey,
  hasCameraPlacement,
  loadCameraPlacement,
  loadCameraPlacements,
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

  it("normalizeCameraPlacement falls back defaults", () => {
    expect(normalizeCameraPlacement(null)).toEqual(DEFAULT_CAMERA_PLACEMENT);
    expect(normalizeCameraPlacement(undefined)).toEqual(DEFAULT_CAMERA_PLACEMENT);
  });

  it("normalizeCameraPlacement clamps and normalizes values", () => {
    expect(normalizeCameraPlacement({ x: -5, y: 101, scale: 5, rotation: 370 })).toEqual({
      x: 0,
      y: 100,
      scale: 2.5,
      rotation: 10,
    });
    expect(normalizeCameraPlacement({ scale: 0.1, rotation: -15 })).toMatchObject({
      scale: 0.35,
      rotation: 345,
    });
    expect(normalizeCameraPlacement({ rotation: "bad" }).rotation).toBe(0);
  });

  it("loadCameraPlacements returns {} for empty/invalid/non-object", () => {
    expect(loadCameraPlacements("r1")).toEqual({});
    localStorage.setItem(getCameraPlacementStorageKey("r1"), "bad-json");
    expect(loadCameraPlacements("r1")).toEqual({});
    localStorage.setItem(getCameraPlacementStorageKey("r1"), JSON.stringify([1, 2]));
    expect(loadCameraPlacements("r1")).toEqual({});
  });

  it("loadCameraPlacements normalizes each entry", () => {
    localStorage.setItem(
      getCameraPlacementStorageKey("r1"),
      JSON.stringify({ a: { x: -1, y: 22, scale: 3, rotation: 720 } })
    );
    expect(loadCameraPlacements("r1")).toEqual({
      a: { x: 0, y: 22, scale: 2.5, rotation: 0 },
    });
  });

  it("loadCameraPlacement returns default for missing modelKey/missing key", () => {
    expect(loadCameraPlacement("", "r1")).toEqual(DEFAULT_CAMERA_PLACEMENT);
    expect(loadCameraPlacement("missing", "r1")).toEqual(DEFAULT_CAMERA_PLACEMENT);
  });

  it("loadCameraPlacement returns saved placement", () => {
    saveCameraPlacement("m1", { x: 10, y: 20, scale: 1.2, rotation: 25 }, "r1");
    expect(loadCameraPlacement("m1", "r1")).toEqual({ x: 10, y: 20, scale: 1.2, rotation: 25 });
  });

  it("saveCameraPlacement saves by key and does not mutate input", () => {
    const input = { x: 20, y: 60, scale: 1.1, rotation: 30 };
    const snapshot = { ...input };
    const result = saveCameraPlacement("m2", input, "r1");
    expect(result.m2).toEqual(input);
    expect(input).toEqual(snapshot);
  });

  it("saveCameraPlacement ignores invalid key without crash", () => {
    expect(saveCameraPlacement("", { x: 10 }, "r1")).toEqual({});
  });

  it("deleteCameraPlacement removes key and missing key does not crash", () => {
    saveCameraPlacement("a", { x: 1 }, "r1");
    saveCameraPlacement("b", { x: 2 }, "r1");
    expect(Object.keys(deleteCameraPlacement("a", "r1"))).toEqual(["b"]);
    expect(Object.keys(deleteCameraPlacement("missing", "r1"))).toEqual(["b"]);
  });

  it("hasCameraPlacement returns true/false correctly", () => {
    saveCameraPlacement("a", { x: 1 }, "r1");
    expect(hasCameraPlacement("a", "r1")).toBe(true);
    expect(hasCameraPlacement("b", "r1")).toBe(false);
    expect(hasCameraPlacement("", "r1")).toBe(false);
  });
});
