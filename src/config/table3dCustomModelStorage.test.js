import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteCustomTableModel,
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
    expect(isCustomTableModel({ customModelSpec: { name: "x" } })).toBe(true);
    expect(isCustomTableModel({ source: "public", key: "round-oak-4" })).toBe(false);
  });
});
