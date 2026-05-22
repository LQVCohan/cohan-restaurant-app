import { describe, expect, it } from "vitest";
import {
  isPosManagedStatusTransition,
  isBackendValidatedStatusTransition,
  normalizeTableStatus,
  POS_MANAGED_STATUS_TRANSITION_MESSAGE,
  POS_MANAGED_STATUS_TRANSITION_TITLE,
} from "./tableStatusTransitionGuard";

describe("tableStatusTransitionGuard", () => {
  it("chặn các transition do POS quản lý", () => {
    expect(isPosManagedStatusTransition("available", "occupied")).toBe(true);
    expect(isPosManagedStatusTransition("reserved", "occupied")).toBe(true);
    expect(isPosManagedStatusTransition("occupied", "payment_pending")).toBe(true);
    expect(isPosManagedStatusTransition("payment_pending", "cleaning")).toBe(true);
    expect(isPosManagedStatusTransition("occupied", "cleaning")).toBe(true);
    expect(isPosManagedStatusTransition("reserved", "cleaning")).toBe(true);
  });

  it("không chặn các transition quản trị an toàn", () => {
    expect(isPosManagedStatusTransition("available", "cleaning")).toBe(false);
    expect(isPosManagedStatusTransition("available", "offline")).toBe(false);
    expect(isPosManagedStatusTransition("occupied", "available")).toBe(false);
    expect(isPosManagedStatusTransition("payment_pending", "available")).toBe(false);
    expect(isPosManagedStatusTransition("cleaning", "available")).toBe(false);
    expect(isPosManagedStatusTransition("offline", "available")).toBe(false);
    expect(isPosManagedStatusTransition("available", "reserved")).toBe(false);
  });

  it("đánh dấu transition cần backend validate", () => {
    expect(isBackendValidatedStatusTransition("occupied", "available")).toBe(true);
    expect(isBackendValidatedStatusTransition("payment_pending", "available")).toBe(true);
    expect(isBackendValidatedStatusTransition("cleaning", "available")).toBe(true);
    expect(isBackendValidatedStatusTransition("available", "occupied")).toBe(false);
  });

  it("normalize status đúng định dạng", () => {
    expect(normalizeTableStatus(" Available ")).toBe("available");
    expect(normalizeTableStatus("PAYMENT_PENDING")).toBe("payment_pending");
    expect(normalizeTableStatus(null)).toBe("");
    expect(normalizeTableStatus(undefined)).toBe("");
  });

  it("message constants không rỗng và có chứa POS", () => {
    expect(POS_MANAGED_STATUS_TRANSITION_MESSAGE).toContain("POS");
    expect(POS_MANAGED_STATUS_TRANSITION_TITLE).toContain("POS");
  });
});
