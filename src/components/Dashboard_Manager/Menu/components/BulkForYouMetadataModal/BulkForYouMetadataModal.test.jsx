import { describe, expect, it } from "vitest";
import { buildBulkForYouPatch } from "./BulkForYouMetadataModal";

describe("buildBulkForYouPatch", () => {
  it("keeps unchecked FOR YOU metadata fields unchanged", () => {
    const patch = buildBulkForYouPatch(
      {
        tasteProfile: {
          containsOnion: true,
          containsCilantro: true,
          sugar: 70,
          spice: "Nồng",
        },
      },
      {
        dietTags: ["vegan"],
        allergenTags: ["peanut"],
        tasteProfile: {
          containsOnion: false,
          containsCilantro: false,
          sugar: 30,
          spice: "Không",
        },
      },
      {
        dietTags: true,
        allergenTags: false,
        containsOnion: false,
        containsCilantro: false,
        sugar: true,
        spice: false,
      },
    );

    expect(patch).toEqual({
      dietTags: ["vegan"],
      tasteProfile: {
        containsOnion: true,
        containsCilantro: true,
        sugar: 30,
        spice: "Nồng",
      },
    });
    expect(patch).not.toHaveProperty("allergenTags");
  });

  it("returns an empty patch when no fields are enabled", () => {
    expect(buildBulkForYouPatch({}, { dietTags: ["keto"], tasteProfile: {} }, {})).toEqual({});
  });
});
