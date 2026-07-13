import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/browserStorage", () => ({
  readStorageValue: vi.fn(),
}));

import { readStorageValue } from "@/lib/browserStorage";
import {
  applySmartLayoutToItems,
  buildAutoLayoutComponentsForRequest,
  getItemZIndex,
  getFloorTableNamingPattern,
  generateSequentialCode,
  getAuthHeaders,
  isSmartLayoutGeneratedItem,
  resolveInitialFloorId,
  shouldConfirmReplaceSmartLayout,
} from "./FloorPlanDesigner";

describe("FloorPlanDesigner helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("buildAutoLayoutComponentsForRequest forces hidden table types to zero and auto wall=4 when tables exist", () => {
    const result = buildAutoLayoutComponentsForRequest({
      components: {
        tables: { standard: 3, vip: 1, group: 0, twoSeat: 5, fourSeat: 2 },
        objects: { plant: 1, door: 0, window: 0, stairs: 0, wall: 99 },
      },
    });

    expect(result.tables).toMatchObject({
      standard: 3,
      vip: 1,
      group: 0,
      twoSeat: 0,
      fourSeat: 0,
    });
    expect(result.objects.wall).toBe(4);
  });

  it("buildAutoLayoutComponentsForRequest keeps wall=0 when no tables and no doorway/window/stairs", () => {
    const result = buildAutoLayoutComponentsForRequest({
      components: {
        tables: { standard: 0, vip: 0, group: 0, twoSeat: 2, fourSeat: 2 },
        objects: { plant: 1, door: 0, window: 0, stairs: 0, wall: 9 },
      },
    });

    expect(result.tables.twoSeat).toBe(0);
    expect(result.tables.fourSeat).toBe(0);
    expect(result.objects.wall).toBe(0);
  });

  it("getAuthHeaders returns bearer token from storage", () => {
    readStorageValue.mockImplementation((key) => {
      if (key === "auth_token") return "abc123";
      return null;
    });

    expect(getAuthHeaders()).toEqual({ authorization: "Bearer abc123" });
  });

  it("buildAutoLayoutComponentsForRequest handles empty form defensively", () => {
    expect(() => buildAutoLayoutComponentsForRequest({})).not.toThrow();
    const result = buildAutoLayoutComponentsForRequest({});
    expect(result.tables.standard).toBe(0);
    expect(result.tables.vip).toBe(0);
    expect(result.tables.group).toBe(0);
    expect(result.tables.twoSeat).toBe(0);
    expect(result.tables.fourSeat).toBe(0);
    expect(result.objects.wall).toBe(0);
  });

  it("resolveInitialFloorId returns requested floor when valid", () => {
    const floors = [{ id: "1" }, { id: "2" }];
    expect(resolveInitialFloorId(floors, "2")).toBe("2");
  });

  it("resolveInitialFloorId falls back to first floor when requested floor invalid", () => {
    const floors = [{ id: "1" }, { id: "2" }];
    expect(resolveInitialFloorId(floors, "999")).toBe("1");
  });

  it("resolveInitialFloorId returns first floor when no requested floor", () => {
    const floors = [{ id: "3" }, { id: "4" }];
    expect(resolveInitialFloorId(floors, null)).toBe("3");
  });

  it("isSmartLayoutGeneratedItem detects legacy auto ids", () => {
    expect(isSmartLayoutGeneratedItem({ id: "auto_wall_1" })).toBe(true);
  });

  it("isSmartLayoutGeneratedItem detects smart_layout source", () => {
    expect(isSmartLayoutGeneratedItem({ source: "smart_layout" })).toBe(true);
  });

  it("isSmartLayoutGeneratedItem returns false for manual/normal items", () => {
    expect(isSmartLayoutGeneratedItem({ id: "d_123" })).toBe(false);
    expect(isSmartLayoutGeneratedItem({ id: "real_1", type: "table" })).toBe(false);
  });

  it("shouldConfirmReplaceSmartLayout works", () => {
    expect(shouldConfirmReplaceSmartLayout([])).toBe(false);
    expect(shouldConfirmReplaceSmartLayout([{ id: "1" }])).toBe(true);
  });

  it("replaces previous AI decor instead of appending", () => {
    const previousItems = [
      { id: "auto_wall_1", type: "wall" },
      { id: "auto_kitchen_1", type: "kitchen" },
      { id: "t1", isRealTable: true, code: "A1", x: 0, y: 0 },
      { id: "t2", isRealTable: true, code: "A2", x: 0, y: 0 },
    ];
    const { nextItems } = applySmartLayoutToItems({
      previousItems,
      generatedTables: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
      generatedDecor: [{ id: "new_wall", type: "wall" }, { id: "new_kitchen", type: "kitchen" }],
      startX: 1,
      startY: 1,
      now: 1,
    });
    expect(nextItems.filter((i) => i.type === "wall")).toHaveLength(1);
    expect(nextItems.filter((i) => i.type === "kitchen")).toHaveLength(1);
    expect(nextItems.some((i) => i.id === "auto_wall_1")).toBe(false);
  });

  it("preserves manual decor while replacing old AI decor", () => {
    const { nextItems } = applySmartLayoutToItems({
      previousItems: [
        { id: "d_manual_1", type: "plant" },
        { id: "auto_plant_1", type: "plant" },
      ],
      generatedTables: [],
      generatedDecor: [{ id: "new_plant", type: "plant" }],
      startX: 0,
      startY: 0,
      now: 2,
    });
    expect(nextItems.some((i) => i.id === "d_manual_1")).toBe(true);
    expect(nextItems.some((i) => i.id === "auto_plant_1")).toBe(false);
    expect(nextItems.find((i) => i.id === "new_plant")?.source).toBe("smart_layout");
  });

  it("remaps existing real tables without duplicating", () => {
    const previousItems = Array.from({ length: 8 }).map((_, i) => ({ id: `r${i}`, isRealTable: true, code: `A${i + 1}`, x: 0, y: 0 }));
    const generatedTables = Array.from({ length: 8 }).map((_, i) => ({ x: i * 10, y: i * 20 }));
    const { nextItems } = applySmartLayoutToItems({ previousItems, generatedTables, generatedDecor: [], startX: 0, startY: 0, now: 3 });
    expect(nextItems.filter((i) => i.isRealTable)).toHaveLength(8);
    expect(nextItems.some((i) => String(i.id).startsWith("tmp_ai_"))).toBe(false);
    expect(nextItems.find((i) => i.id === "r3")).toMatchObject({ x: 30, y: 60 });
  });

  it("creates only missing local tables", () => {
    const previousItems = Array.from({ length: 6 }).map((_, i) => ({ id: `r${i}`, isRealTable: true, code: `A${i + 1}`, x: 0, y: 0 }));
    const generatedTables = Array.from({ length: 8 }).map((_, i) => ({ x: i, y: i }));
    const { nextItems, stats } = applySmartLayoutToItems({ previousItems, generatedTables, generatedDecor: [], startX: 0, startY: 0, now: 4 });
    expect(nextItems.filter((i) => i.isRealTable)).toHaveLength(8);
    expect(nextItems.filter((i) => String(i.id).startsWith("tmp_ai_"))).toHaveLength(2);
    expect(stats.createdLocalTableCount).toBe(2);
  });

  it("uses the first available floor-local table code for generated tables", () => {
    const previousItems = [
      { id: "r2", isRealTable: true, code: "T302", x: 0, y: 0 },
      { id: "r3", isRealTable: true, code: "T303", x: 0, y: 0 },
    ];
    const { nextItems } = applySmartLayoutToItems({
      previousItems,
      generatedTables: [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }],
      generatedDecor: [],
      startX: 0,
      startY: 0,
      floorLevel: 3,
      now: 5,
    });

    expect(nextItems.find((item) => item.id === "tmp_ai_5_0")?.code).toBe("T301");
  });

  it("keeps a restaurant's custom naming pattern when the floor already uses one", () => {
    const pattern = getFloorTableNamingPattern(["VIP-01", "VIP-02"], 3);
    const usedCodes = new Set(["VIP-01", "VIP-02"]);

    expect(generateSequentialCode(usedCodes, pattern)).toBe("VIP-03");
  });

  it("does not delete real tables when generated fewer", () => {
    const previousItems = Array.from({ length: 8 }).map((_, i) => ({ id: `r${i}`, isRealTable: true, code: `A${i + 1}`, x: 0, y: 0 }));
    const generatedTables = Array.from({ length: 6 }).map((_, i) => ({ x: i, y: i }));
    const { nextItems, stats, warnings } = applySmartLayoutToItems({ previousItems, generatedTables, generatedDecor: [], startX: 0, startY: 0, now: 5 });
    expect(nextItems.filter((i) => i.isRealTable && !i.isLocalOnly)).toHaveLength(8);
    expect(stats.mappedTableCount).toBe(6);
    expect(warnings[0]).toContain("Hệ thống giữ lại các bàn thật hiện có");
  });

  it("generate twice before saving does not preserve old tmp_ai local tables", () => {
    const previousItems = [
      {
        id: "tmp_ai_111_0",
        type: "table",
        isRealTable: true,
        isLocalOnly: true,
        source: "smart_layout",
        x: 1,
        y: 1,
      },
      {
        id: "tmp_ai_111_1",
        type: "table",
        isRealTable: true,
        isLocalOnly: true,
        source: "smart_layout",
        x: 2,
        y: 2,
      },
    ];
    const { nextItems } = applySmartLayoutToItems({
      previousItems,
      generatedTables: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
      generatedDecor: [],
      startX: 0,
      startY: 0,
      now: 222,
    });
    const tableItems = nextItems.filter((item) => item.isRealTable);
    expect(tableItems).toHaveLength(2);
    expect(tableItems.some((item) => item.id === "tmp_ai_111_0")).toBe(false);
    expect(tableItems.some((item) => item.id === "tmp_ai_111_1")).toBe(false);
    expect(tableItems.every((item) => String(item.id).startsWith("tmp_ai_222_"))).toBe(true);
  });
});

describe("FloorPlanDesigner z-index", () => {
  it("keeps door/window above wall and below table", () => {
    expect(getItemZIndex({ type: "wall" }, false)).toBeLessThan(getItemZIndex({ type: "door" }, false));
    expect(getItemZIndex({ type: "wall" }, false)).toBeLessThan(getItemZIndex({ type: "window" }, false));
    expect(getItemZIndex({ type: "door" }, false)).toBeLessThan(getItemZIndex({ type: "table" }, false));
    expect(getItemZIndex({ type: "window" }, false)).toBeLessThan(getItemZIndex({ type: "table" }, false));
  });

  it("selected item has highest and rug is lowest", () => {
    expect(getItemZIndex({ type: "table" }, true)).toBe(100);
    expect(getItemZIndex({ type: "rug" }, false)).toBe(1);
  });
});
