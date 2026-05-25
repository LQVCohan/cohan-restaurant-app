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

  it("does not disable returning occupied table to available", () => {
    const reason = getTableActionDisabledReason(
      { status: "occupied" },
      "set_status",
      "available"
    );
    expect(reason).toBe("");
  });

  it("does not disable returning payment_pending table to available", () => {
    const reason = getTableActionDisabledReason(
      { status: "payment_pending" },
      "set_status",
      "available"
    );
    expect(reason).toBe("");
  });

  it("does not disable returning reserved table to available", () => {
    const reason = getTableActionDisabledReason(
      { status: "reserved" },
      "set_status",
      "available"
    );
    expect(reason).toBe("");
  });

  it("does not disable occupied -> cleaning status change in UI", () => {
    const reason = getTableActionDisabledReason(
      { status: "occupied" },
      "set_status",
      "cleaning"
    );
    expect(reason).toBe("");
  });

  it("does not disable occupied -> available status change in UI", () => {
    const reason = getTableActionDisabledReason(
      { status: "occupied" },
      "set_status",
      "available"
    );
    expect(reason).toBe("");
  });

  it("does not disable available -> occupied status change in UI", () => {
    const reason = getTableActionDisabledReason(
      { status: "available" },
      "set_status",
      "occupied"
    );
    expect(reason).toBe("");
  });

  it("disables delete when guard exists", () => {
    const reason = getTableActionDisabledReason({ status: "occupied" }, "delete");
    expect(reason).not.toBe("");
  });

  it("keeps guard state for occupied table", () => {
    const guard = getTableGuardState({ status: "occupied" });
    expect(guard.hasGuard).toBe(true);
  });
});
