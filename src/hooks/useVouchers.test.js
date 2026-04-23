import { describe, expect, it } from "vitest";

import { __testables } from "./useVouchers";

describe("useVouchers input builders", () => {
  it("normalizes voucher datetime-local values to ISO in Vietnam timezone", () => {
    const input = __testables.buildCouponInput(
      {
        name: "Voucher food",
        code: "FOOD10",
        category: "food",
        discountType: "percent",
        discountValue: 10,
        publishAt: "2026-05-01T09:00",
        startDate: "2026-05-01T10:00",
        endDate: "2026-05-05T22:00",
        status: "active",
        conditions: ["Ap dung mon chinh"],
      },
      "restaurant-1",
    );

    expect(input).toEqual(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        publishAt: "2026-05-01T02:00:00.000Z",
        startAt: "2026-05-01T03:00:00.000Z",
        endAt: "2026-05-05T15:00:00.000Z",
      }),
    );
  });

  it("keeps voucher package ids and normalizes datetime-local values for package mutations", () => {
    const input = __testables.buildPackageInput(
      {
        name: "Goi VIP",
        code: "VIP-01",
        voucherIds: ["voucher-1", "voucher-2"],
        publishAt: "2026-05-01T09:00",
        startDate: "2026-05-01T10:00",
        endDate: "2026-05-05T22:00",
        status: "active",
      },
      "restaurant-1",
    );

    expect(input).toEqual(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        voucherIds: ["voucher-1", "voucher-2"],
        publishAt: "2026-05-01T02:00:00.000Z",
        startAt: "2026-05-01T03:00:00.000Z",
        endAt: "2026-05-05T15:00:00.000Z",
      }),
    );
  });
});
