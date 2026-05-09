import { describe, expect, it } from "vitest";
import {
  buildActiveTableSessionKey,
  isKitchenPayable,
  isOrderBatch,
  isPaymentClosed,
  isSessionActive,
  isTableSession,
  orderBatchOrLegacyFilter,
  withOrderBatchOrLegacyFilter,
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

  it("isPaymentClosed falls back when orderPaymentStatus is 'unpaid' and payment.status is 'paid'", () => {
    expect(
      isPaymentClosed({ orderPaymentStatus: "unpaid", payment: { status: "paid" } }),
    ).toBe(true);
  });

  it("isPaymentClosed falls back when orderPaymentStatus is missing and payment.status is 'paid'", () => {
    expect(isPaymentClosed({ payment: { status: "paid" } })).toBe(true);
  });

  it("isPaymentClosed returns false when orderPaymentStatus is 'unpaid' and payment.status is 'failed'", () => {
    expect(
      isPaymentClosed({ orderPaymentStatus: "unpaid", payment: { status: "failed" } }),
    ).toBe(false);
  });

  it("isPaymentClosed returns true for orderPaymentStatus='refunded'", () => {
    expect(isPaymentClosed({ orderPaymentStatus: "refunded" })).toBe(true);
  });

  it("isPaymentClosed returns true for orderPaymentStatus='partially_refunded'", () => {
    expect(isPaymentClosed({ orderPaymentStatus: "partially_refunded" })).toBe(
      true,
    );
  });

  it("isKitchenPayable returns true for kitchenStatus='served'", () => {
    expect(isKitchenPayable({ kitchenStatus: "served" })).toBe(true);
  });

  it("isKitchenPayable falls back to currentStatus='served' for legacy orders", () => {
    expect(isKitchenPayable({ currentStatus: "served" })).toBe(true);
  });

  it("isKitchenPayable falls back when kitchenStatus is 'pending' and currentStatus is 'served'", () => {
    expect(
      isKitchenPayable({ kitchenStatus: "pending", currentStatus: "served" }),
    ).toBe(true);
  });

  it("isKitchenPayable falls back when kitchenStatus is missing and currentStatus is 'served'", () => {
    expect(isKitchenPayable({ currentStatus: "served" })).toBe(true);
  });

  it("isKitchenPayable returns false for table_session even if served", () => {
    expect(
      isKitchenPayable({
        orderKind: "table_session",
        kitchenStatus: "served",
        currentStatus: "served",
      }),
    ).toBe(false);
  });

  it("isKitchenPayable returns false for split_bill even if served", () => {
    expect(
      isKitchenPayable({
        orderKind: "split_bill",
        kitchenStatus: "served",
        currentStatus: "served",
      }),
    ).toBe(false);
  });

  it("isKitchenPayable returns false when kitchenStatus is 'pending' and currentStatus is 'ready'", () => {
    expect(
      isKitchenPayable({ kitchenStatus: "pending", currentStatus: "ready" }),
    ).toBe(false);
  });

  it("orderBatchOrLegacyFilter includes legacy and order_batch only", () => {
    const filter = orderBatchOrLegacyFilter();
    expect(filter).toEqual({
      $or: [
        { orderKind: "order_batch" },
        { orderKind: { $exists: false } },
        { orderKind: null },
      ],
    });
  });

  it("withOrderBatchOrLegacyFilter preserves keyword $or by wrapping in $and", () => {
    const baseFilter = {
      restaurantId: "r1",
      $or: [{ orderCode: /abc/i }, { tableCode: /abc/i }],
    };

    expect(withOrderBatchOrLegacyFilter(baseFilter)).toEqual({
      $and: [baseFilter, orderBatchOrLegacyFilter()],
    });
  });

  it("buildActiveTableSessionKey returns deterministic key", () => {
    expect(
      buildActiveTableSessionKey({
        restaurantId: "rest-1",
        tableId: "table-9",
      }),
    ).toBe("rest-1:table-9:active");
  });

  it("buildActiveTableSessionKey returns null when restaurantId or tableId missing", () => {
    expect(buildActiveTableSessionKey({ restaurantId: null, tableId: "t1" })).toBeNull();
    expect(buildActiveTableSessionKey({ restaurantId: "r1", tableId: null })).toBeNull();
  });

});
