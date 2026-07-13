import { describe, expect, it } from "vitest";
import { isImmersiveVrRoute } from "./immersiveRouteScope";

describe("isImmersiveVrRoute", () => {
  it("identifies table VR routes where global AI must be disabled", () => {
    expect(isImmersiveVrRoute("/vr/table/table-a1")).toBe(true);
    expect(isImmersiveVrRoute("/vr/restaurant/restaurant-a1")).toBe(true);
  });

  it("does not hide AI on regular customer and manager routes", () => {
    expect(isImmersiveVrRoute("/restaurants/restaurant-a1")).toBe(false);
    expect(isImmersiveVrRoute("/manager#tables")).toBe(false);
  });
});
