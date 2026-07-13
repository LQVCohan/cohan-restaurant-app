import { describe, expect, it } from "vitest";
import {
  formatOrderProofReadinessError,
  getOrderProofReadinessIssues,
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
});
