import { describe, expect, it } from "vitest";

import { getPublicTableOrderCapability } from "../../utils/publicTableSession.js";

describe("getPublicTableOrderCapability", () => {
  it("allows a payment-pending table after the payment request state was cleared", () => {
    expect(
      getPublicTableOrderCapability({
        tableStatus: "payment_pending",
        session: {
          sessionStatus: "dining",
          orderPaymentStatus: "unpaid",
          payment: { status: "pending" },
        },
      }),
    ).toEqual({ canOrder: true, reason: null });
  });

  it("still blocks a payment-pending table while payment is requested", () => {
    expect(
      getPublicTableOrderCapability({
        tableStatus: "payment_pending",
        session: {
          sessionStatus: "ready_to_pay",
          orderPaymentStatus: "payment_requested",
        },
      }).canOrder,
    ).toBe(false);
  });

  it("allows a verified QR device to submit while the table is still available", () => {
    expect(
      getPublicTableOrderCapability({
        tableStatus: "available",
        session: null,
      }),
    ).toEqual({ canOrder: true, reason: null });
  });
});
