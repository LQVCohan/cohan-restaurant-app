import { describe, expect, it } from "vitest";
import {
  isKitchenPayable,
  isOrderBatch,
  isPaymentClosed,
  isSessionActive,
  isTableSession,
} from "../../utils/orderLifecycle.js";

describe("orderLifecycle helpers", () => {
  it("isTableSession returns true for orderKind='table_session'", () => {
    expect(isTableSession({ orderKind: "table_session" })).toBe(true);
  });

  it("isOrderBatch returns true for missing orderKind for legacy orders", () => {
    expect(isOrderBatch({})).toBe(true);
  });

  it("isSessionActive returns true for open/dining/ready_to_pay table_session", () => {
    expect(
      isSessionActive({ orderKind: "table_session", sessionStatus: "open" }),
    ).toBe(true);
    expect(
      isSessionActive({ orderKind: "table_session", sessionStatus: "dining" }),
    ).toBe(true);
    expect(
      isSessionActive({
        orderKind: "table_session",
        sessionStatus: "ready_to_pay",
      }),
    ).toBe(true);
  });

  it("isPaymentClosed returns true for orderPaymentStatus='paid'", () => {
    expect(isPaymentClosed({ orderPaymentStatus: "paid" })).toBe(true);
  });

  it("isKitchenPayable returns true for kitchenStatus='served'", () => {
    expect(isKitchenPayable({ kitchenStatus: "served" })).toBe(true);
  });

  it("isKitchenPayable falls back to currentStatus='served' for legacy orders", () => {
    expect(isKitchenPayable({ currentStatus: "served" })).toBe(true);
  });
});
