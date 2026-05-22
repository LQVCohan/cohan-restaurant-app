import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/browserStorage", () => ({
  readStorageValue: vi.fn(),
}));

import { readStorageValue } from "@/lib/browserStorage";
import { buildAutoLayoutComponentsForRequest, getAuthHeaders } from "./FloorPlanDesigner";

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
});
