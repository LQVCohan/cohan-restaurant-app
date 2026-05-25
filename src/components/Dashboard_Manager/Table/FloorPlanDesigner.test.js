import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/browserStorage", () => ({
  readStorageValue: vi.fn(),
}));

import { readStorageValue } from "@/lib/browserStorage";
import {
  buildAutoLayoutComponentsForRequest,
  getAuthHeaders,
  isSmartLayoutGeneratedItem,
  resolveInitialFloorId,
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
});
