import { describe, expect, it } from "vitest";
import {
  formatOrderProofReadinessError,
  getOrderItemProofWaiver,
  getOrderProofReadinessIssues,
  isOrderItemProofWaived,
  normalizeOrderProofImages,
  requiresOrderItemProofImage,
} from "../../src/services/orderProofRules.service.js";

describe("orderProofRules.service", () => {
  it("requires proof only from structured by-weight data", () => {
    expect(
      requiresOrderItemProofImage({
        name: "Hải sản tươi sống",
        unit: "portion",
        servingVariant: { mode: "PORTION", sellUnit: "portion" },
      }),
    ).toBe(false);

    expect(
      requiresOrderItemProofImage({
        name: "Tôm sú",
        unit: "kg",
        servingVariant: { mode: "BY_WEIGHT", sellUnit: "kg" },
      }),
    ).toBe(true);
  });

  it("deduplicates proof URLs and reports missing proof or weight", () => {
    expect(
      normalizeOrderProofImages([" /uploads/a.jpg ", "/uploads/a.jpg", ""]),
    ).toEqual(["/uploads/a.jpg"]);

    const issues = getOrderProofReadinessIssues([
      {
        _id: "item-1",
        name: "Cua cân ký",
        status: "pending",
        servingVariant: { mode: "BY_WEIGHT", sellUnit: "kg" },
        weightGrams: null,
        proofImages: [],
      },
      {
        _id: "item-2",
        name: "Món đã hủy",
        status: "cancelled",
        servingVariant: { mode: "BY_WEIGHT", sellUnit: "kg" },
        weightGrams: null,
        proofImages: [],
      },
    ]);

    expect(issues).toEqual([
      expect.objectContaining({
        itemId: "item-1",
        itemName: "Cua cân ký",
        missingProof: true,
        missingWeight: true,
      }),
    ]);
    expect(formatOrderProofReadinessError(issues)).toContain(
      "Cua cân ký (thiếu cân nặng, thiếu ảnh minh chứng)",
    );
  });

  it("accepts an audited customer waiver for the image but still requires weight", () => {
    const item = {
      _id: "item-1",
      name: "Cua cân ký",
      status: "pending",
      servingVariant: { mode: "BY_WEIGHT", sellUnit: "kg" },
      weightGrams: 850,
      proofImages: [],
    };
    const proofWaivers = {
      "item-1": {
        waived: true,
        waivedBy: "staff-1",
        waivedAt: "2026-07-14T02:00:00.000Z",
        reason: "Khách hàng xác nhận không cần ảnh minh chứng.",
      },
    };

    expect(isOrderItemProofWaived(item, proofWaivers)).toBe(true);
    expect(getOrderItemProofWaiver(item, proofWaivers)).toEqual(
      expect.objectContaining({ waivedBy: "staff-1" }),
    );
    expect(getOrderProofReadinessIssues([item], proofWaivers)).toEqual([]);

    expect(
      getOrderProofReadinessIssues(
        [{ ...item, weightGrams: null }],
        proofWaivers,
      ),
    ).toEqual([
      expect.objectContaining({
        missingProof: false,
        missingWeight: true,
        proofWaived: true,
      }),
    ]);
  });
});
