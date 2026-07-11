import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import {
  buildCashflowFilter,
  resolveBoundary,
} from "../../graphql/resolvers/payment/transactionManagementQuery.js";

const restaurantId = "64b000000000000000000001";
const referenceId = "64b000000000000000000002";

describe("transaction management query contracts", () => {
  it("preserves explicit ISO timestamps instead of normalizing them again", () => {
    const dateFrom = "2026-05-30T17:00:00.000Z";
    const dateTo = "2026-06-29T16:59:59.999Z";

    expect(resolveBoundary(dateFrom).toISOString()).toBe(dateFrom);
    expect(resolveBoundary(dateTo, { endOfDay: true }).toISOString()).toBe(
      dateTo,
    );

    const { filter } = buildCashflowFilter({
      restaurantId,
      dateFrom,
      dateTo,
    });
    expect(filter.occurredAt.$gte.toISOString()).toBe(dateFrom);
    expect(filter.occurredAt.$lte.toISOString()).toBe(dateTo);
  });

  it("still supports legacy date-only callers with local day boundaries", () => {
    expect(resolveBoundary("2026-06-01").toISOString()).toBe(
      new Date(2026, 5, 1, 0, 0, 0, 0).toISOString(),
    );
    expect(
      resolveBoundary("2026-06-01", { endOfDay: true }).toISOString(),
    ).toBe(new Date(2026, 5, 1, 23, 59, 59, 999).toISOString());
  });

  it("rejects malformed date boundaries", () => {
    expect(() => resolveBoundary("not-a-date")).toThrow(
      /Invalid transaction date boundary/,
    );
  });

  it("matches reference ids across every cashflow reference field", () => {
    const { filter } = buildCashflowFilter({ restaurantId, referenceId });
    const expectedId = new mongoose.Types.ObjectId(referenceId);
    const referenceCondition = filter.$and[0].$or;

    expect(referenceCondition).toEqual(
      expect.arrayContaining([
        { "ref.id": expectedId },
        { "ref.orderId": expectedId },
        { "ref.orderIds": expectedId },
        { "ref.invoiceId": expectedId },
        { "ref.paymentTransactionId": expectedId },
        { "ref.refundId": expectedId },
      ]),
    );
  });

  it("keeps reference and text search conditions together", () => {
    const { filter } = buildCashflowFilter({
      restaurantId,
      referenceId,
      search: "PAYREF(123)",
    });

    expect(filter.$and).toHaveLength(2);
    expect(filter.$and[0].$or).toBeDefined();
    expect(filter.$and[1].$or[0].note).toBeInstanceOf(RegExp);
    expect(filter.$and[1].$or[0].note.test("PAYREF(123)")).toBe(true);
  });

  it("treats MoMo and VNPAY as wallet methods in the shared filter", () => {
    const { filter } = buildCashflowFilter({
      restaurantId,
      method: "e_wallet",
    });

    expect(filter.method).toEqual({ $in: ["e_wallet", "momo", "vnpay"] });
  });
});
