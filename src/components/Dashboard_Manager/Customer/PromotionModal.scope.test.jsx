import { describe, expect, it } from "vitest";
import { __testables } from "./PromotionModal";

describe("PromotionModal offer scope", () => {
  it("keeps only current offers from the selected restaurant", () => {
    const rows = __testables.buildOfferOptions(
      [
        { id: "p1", name: "Đang chạy", restaurantId: "r1", status: "active" },
        { id: "p2", name: "Hết hạn", restaurantId: "r1", status: "expired" },
      ],
      [
        { id: "c1", name: "Mã đúng", restaurantId: "r1", isActive: true },
        { id: "c2", name: "Sai nhà hàng", restaurantId: "r2", isActive: true },
      ],
      [],
      "r1",
    );
    expect(rows.map((row) => row.sourceId)).toEqual(["p1", "c1"]);
  });
});
