import { describe, expect, it } from "vitest";
import {
  buildProofState,
  getProofImageWaiver,
  isProofImageWaived,
  normalizeProofImages,
  requiresProofImage,
} from "./orderProofRules";

describe("orderProofRules", () => {
  it("does not infer proof requirements from item wording", () => {
    expect(
      requiresProofImage({
        name: "Hải sản tươi sống",
        note: "Cân ký tại bàn",
        unit: "portion",
        servingVariant: { mode: "PORTION", sellUnit: "portion" },
      }),
    ).toBe(false);
  });

  it("requires and normalizes proof for structured by-weight items", () => {
    const item = {
      _id: "item-1",
      unit: "kg",
      weightGrams: 900,
      servingVariant: { mode: "BY_WEIGHT", sellUnit: "kg" },
      proofImages: [" /uploads/a.jpg ", "/uploads/a.jpg", ""],
    };

    expect(requiresProofImage(item)).toBe(true);
    expect(normalizeProofImages(item.proofImages)).toEqual(["/uploads/a.jpg"]);
    expect(buildProofState(item)).toEqual(
      expect.objectContaining({
        requiresProof: true,
        hasPhoto: true,
        proofImages: ["/uploads/a.jpg"],
        waived: false,
        ready: true,
      }),
    );
  });

  it("treats an audited customer waiver as ready without changing the proof rule", () => {
    const item = {
      _id: "item-1",
      unit: "kg",
      weightGrams: 900,
      servingVariant: { mode: "BY_WEIGHT", sellUnit: "kg" },
      proofImages: [],
    };
    const proofWaivers = {
      "item-1": {
        waived: true,
        waivedBy: "staff-1",
        reason: "Khách hàng xác nhận không cần ảnh minh chứng.",
      },
    };

    expect(requiresProofImage(item)).toBe(true);
    expect(isProofImageWaived(item, proofWaivers)).toBe(true);
    expect(getProofImageWaiver(item, proofWaivers)).toEqual(
      expect.objectContaining({ waivedBy: "staff-1" }),
    );
    expect(buildProofState(item, proofWaivers)).toEqual(
      expect.objectContaining({
        requiresProof: true,
        hasPhoto: false,
        waived: true,
        ready: true,
      }),
    );
  });
});
