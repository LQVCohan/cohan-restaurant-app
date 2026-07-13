import { describe, expect, it } from "vitest";
import {
  buildProofState,
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
      }),
    );
  });
});
