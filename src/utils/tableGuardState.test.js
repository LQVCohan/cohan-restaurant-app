import { describe, expect, it } from "vitest";
import {
  getTableActionDisabledReason,
  getTableGuardState,
} from "./tableGuardState";

describe("tableGuardState", () => {
  it("returns reservation guard for reserved status", () => {
    const guard = getTableGuardState({ status: "reserved" });
    expect(guard.hasGuard).toBe(true);
    expect(guard.guardType).toBe("reservation");
  });

  it("returns active order guard for occupied status", () => {
    const guard = getTableGuardState({ status: "occupied" });
    expect(guard.hasGuard).toBe(true);
    expect(guard.guardType).toBe("active_order");
  });

  it("returns no guard for available status", () => {
    const guard = getTableGuardState({ status: "available" });
    expect(guard.hasGuard).toBe(false);
  });

  it("disables dangerous target status when guard exists", () => {
    const reason = getTableActionDisabledReason(
      { status: "occupied" },
      "set_status",
      "cleaning"
    );
    expect(reason).toContain("Không thể thao tác");
  });
});
