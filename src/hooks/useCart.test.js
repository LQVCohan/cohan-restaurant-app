import { describe, expect, it } from "vitest";
import { buildCartLineIdentity } from "./useCart";
import {
  formatHoldCountdown,
  hasExpiredHoldItems,
} from "@/components/Customer/Homepage_Client/components/Cart";

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

describe("cart hold helpers", () => {
  it("formatHoldCountdown định dạng mm:ss", () => {
    expect(formatHoldCountdown(272000)).toBe("04:32");
    expect(formatHoldCountdown(45000)).toBe("00:45");
  });

  it("hasExpiredHoldItems phát hiện hold hết hạn", () => {
    const now = new Date("2026-05-27T10:00:00.000Z").getTime();
    const cart = [
      { holdExpiresAt: "2026-05-27T10:00:40.000Z", holdStatus: "active" },
      { holdExpiresAt: "2026-05-27T09:58:00.000Z", holdStatus: "active" },
    ];
    expect(hasExpiredHoldItems(cart, now)).toBe(true);
  });

  it("không expired khi holdStatus active và còn thời gian", () => {
    const now = new Date("2026-05-27T10:00:00.000Z").getTime();
    const cart = [
      { holdExpiresAt: "2026-05-27T10:03:00.000Z", holdStatus: "active" },
    ];
    expect(hasExpiredHoldItems(cart, now)).toBe(false);
  });
});
