import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteCustomTableModel,
  doesCustomModelMatchTableType,
  getCustomModelCatalogTableType,
  getCustomTableModelStorageKey,
  isCustomTableModel,
  loadCustomTableModels,
  mergeCatalogWithCustomModels,
  saveCustomTableModels,
  upsertCustomTableModel,
} from "./table3dCustomModelStorage";

const buildCustom = (overrides = {}) => ({
  key: "custom-1",
  label: "Bàn custom",
  tableType: "round-table",
  capacity: 4,
  defaultScale: 1,
  modelUrl: "",
  thumbnailUrl: "",
  source: "user-generated",
  fallbackKind: "parametric",
  customModelSpec: { name: "Bàn custom", widthCm: 100, depthCm: 80, heightCm: 75, capacity: 4 },
  ...overrides,
});

describe("table3dCustomModelStorage", () => {
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

  it("loadCustomTableModels returns [] when empty", () => {
    expect(loadCustomTableModels("r1")).toEqual([]);
  });

  it("loadCustomTableModels returns [] for invalid JSON", () => {
    localStorage.setItem(getCustomTableModelStorageKey("r1"), "invalid");
    expect(loadCustomTableModels("r1")).toEqual([]);
  });

  it("loadCustomTableModels normalizes and filters invalid items", () => {
    localStorage.setItem(
      getCustomTableModelStorageKey("r1"),
      JSON.stringify([{ key: "x" }, buildCustom({ key: "c2" })])
    );
    expect(loadCustomTableModels("r1").map((item) => item.key)).toEqual(["c2"]);
  });

  it("saveCustomTableModels saves and loads, dedupes by latest key, no input mutation", () => {
    const input = [buildCustom({ key: "dup", label: "cũ" }), buildCustom({ key: "dup", label: "mới" })];
    const snapshot = JSON.parse(JSON.stringify(input));
    const saved = saveCustomTableModels(input, "r1");
    expect(saved).toHaveLength(1);
    expect(saved[0].label).toBe("mới");
    expect(loadCustomTableModels("r1")[0].label).toBe("mới");
    expect(input).toEqual(snapshot);
  });

  it("upsertCustomTableModel prepends new and updates old item", () => {
    saveCustomTableModels([buildCustom({ key: "a" })], "r1");
    const added = upsertCustomTableModel(buildCustom({ key: "b" }), "r1");
    expect(added.map((item) => item.key)).toEqual(["b", "a"]);

    const updated = upsertCustomTableModel(buildCustom({ key: "a", customModelSpec: { capacity: 9 } }), "r1");
    const target = updated.find((item) => item.key === "a");
    expect(target.customModelSpec.capacity).toBe(9);
  });

  it("deleteCustomTableModel removes key and ignores missing key", () => {
    saveCustomTableModels([buildCustom({ key: "a" }), buildCustom({ key: "b" })], "r1");
    expect(deleteCustomTableModel("a", "r1").map((item) => item.key)).toEqual(["b"]);
    expect(deleteCustomTableModel("none", "r1").map((item) => item.key)).toEqual(["b"]);
  });

  it("mergeCatalogWithCustomModels keeps custom first and filters conflicting keys without mutation", () => {
    const catalog = [{ key: "a" }, { key: "b" }];
    const custom = [{ key: "x" }, { key: "a" }];
    const c1 = JSON.parse(JSON.stringify(catalog));
    const c2 = JSON.parse(JSON.stringify(custom));
    expect(mergeCatalogWithCustomModels(catalog, custom).map((item) => item.key)).toEqual(["x", "a", "b"]);
    expect(catalog).toEqual(c1);
    expect(custom).toEqual(c2);
  });

  it("isCustomTableModel detects correct types", () => {
    expect(isCustomTableModel({ source: "user-generated" })).toBe(true);
    expect(isCustomTableModel({ source: "user-upload" })).toBe(true);
    expect(isCustomTableModel({ customModelKind: "upload" })).toBe(true);
    expect(isCustomTableModel({ source: "ai-generated" })).toBe(true);
    expect(isCustomTableModel({ customModelKind: "ai-generated" })).toBe(true);
    expect(isCustomTableModel({ customModelSpec: { name: "x" } })).toBe(true);
    expect(isCustomTableModel({ source: "public", key: "round-oak-4" })).toBe(false);
  });

  it("preserves uploaded model metadata", () => {
    const saved = saveCustomTableModels([
      buildCustom({
        key: "upload-1",
        source: "user-upload",
        customModelKind: "upload",
        modelUrl: "https://cdn.example.com/table.glb",
        thumbnailUrl: "https://cdn.example.com/table.webp",
        uploadedFileName: "table.glb",
        uploadedSizeBytes: 4096,
        customModelSpec: null,
      }),
    ], "r1");

    expect(saved[0]).toMatchObject({
      customModelKind: "upload",
      uploadedFileName: "table.glb",
      uploadedSizeBytes: 4096,
      modelUrl: "https://cdn.example.com/table.glb",
      thumbnailUrl: "https://cdn.example.com/table.webp",
    });
  });


  it("preserves AI generated model metadata", () => {
    const saved = saveCustomTableModels([
      buildCustom({
        key: "ai-1",
        source: "ai-generated",
        sourceType: "ai-generated",
        customModelKind: "ai-generated",
        modelUrl: "https://cdn.example.com/ai-table.glb",
        aiJobId: "job-123",
        aiProvider: "configured-provider",
        generationStatus: "completed",
        customModelSpec: null,
      }),
    ], "r1");

    expect(saved[0]).toMatchObject({
      source: "ai-generated",
      customModelKind: "ai-generated",
      aiJobId: "job-123",
      aiProvider: "configured-provider",
      generationStatus: "completed",
      modelUrl: "https://cdn.example.com/ai-table.glb",
    });
  });

  it("maps custom shapes to catalog table types and matches correctly", () => {
    const round = buildCustom({ tableType: "custom-parametric", customModelSpec: { shape: "round" } });
    const booth = buildCustom({ tableType: "custom-parametric", customModelSpec: { shape: "booth" } });
    const square = buildCustom({ tableType: "custom-parametric", customModelSpec: { shape: "square" } });
    const rect = buildCustom({ tableType: "custom-parametric", customModelSpec: { shape: "rect" } });
    const bar = buildCustom({ tableType: "custom-parametric", customModelSpec: { shape: "bar" } });

    expect(getCustomModelCatalogTableType(round)).toBe("round-table");
    expect(getCustomModelCatalogTableType(booth)).toBe("booth-sofa");
    expect(getCustomModelCatalogTableType(square)).toBe("rect-4-seat");
    expect(getCustomModelCatalogTableType(rect)).toBe("rect-4-seat");
    expect(getCustomModelCatalogTableType(bar)).toBe("bar-table");

    expect(doesCustomModelMatchTableType(round, "round-table")).toBe(true);
    expect(doesCustomModelMatchTableType(booth, "booth-sofa")).toBe(true);
    expect(doesCustomModelMatchTableType(square, "rect-4-seat")).toBe(true);
    expect(doesCustomModelMatchTableType(rect, "rect-4-seat")).toBe(true);
    expect(doesCustomModelMatchTableType(bar, "bar-table")).toBe(true);
  });

  it("doesCustomModelMatchTableType returns false for non-custom catalog model", () => {
    expect(doesCustomModelMatchTableType({ key: "round-oak-4", source: "public" }, "round-table")).toBe(false);
  });

  it("doesCustomModelMatchTableType returns false when type mismatches", () => {
    const custom = buildCustom({ customModelSpec: { shape: "round" } });
    expect(doesCustomModelMatchTableType(custom, "booth-sofa")).toBe(false);
  });

  it("legacy custom model with missing shape falls back safely to rect-4-seat", () => {
    const legacy = buildCustom({ tableType: "custom-parametric", customModelSpec: { name: "legacy" } });
    expect(getCustomModelCatalogTableType(legacy)).toBe("rect-4-seat");
    expect(doesCustomModelMatchTableType(legacy, "rect-4-seat")).toBe(true);
  });

  it("loadCustomTableModels does not crash with non-array JSON payload", () => {
    localStorage.setItem(getCustomTableModelStorageKey("r1"), JSON.stringify({ bad: true }));
    expect(loadCustomTableModels("r1")).toEqual([]);
  });

});
