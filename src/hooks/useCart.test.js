import { describe, expect, it } from "vitest";
import { buildCartLineIdentity } from "./useCart";

describe("buildCartLineIdentity", () => {
  it("tách dòng khi khác note", () => {
    const base = { id: "m1", restaurantId: "r1", servingVariantKey: "size-l", modifiers: [] };
    expect(buildCartLineIdentity({ ...base, note: "ít cay" })).not.toBe(
      buildCartLineIdentity({ ...base, note: "không hành" }),
    );
  });

  it("tách dòng khi khác modifiers", () => {
    const base = { id: "m1", restaurantId: "r1", servingVariantKey: "size-l", note: "" };
    expect(
      buildCartLineIdentity({ ...base, modifiers: [{ groupId: "g1", optionId: "o1" }] }),
    ).not.toBe(
      buildCartLineIdentity({ ...base, modifiers: [{ groupId: "g1", optionId: "o2" }] }),
    );
  });
});
