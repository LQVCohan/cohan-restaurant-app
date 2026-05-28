import { describe, expect, it } from "vitest";
import { getFoodPreferenceDisplayReasons } from "./foodPreferenceDisplay";

describe("getFoodPreferenceDisplayReasons", () => {
  it("returns an empty list for null meta", () => {
    expect(getFoodPreferenceDisplayReasons(null)).toEqual([]);
  });

  it("keeps allergy warning before behavior reason", () => {
    expect(getFoodPreferenceDisplayReasons({
      hasAllergyWarning: true,
      behaviorReasons: ["Bạn hay xem món từ nhà hàng này"],
    })).toEqual([
      "Cần kiểm tra dị ứng trước khi đặt",
      "Bạn hay xem món từ nhà hàng này",
    ]);
  });

  it("deduplicates and caps display reasons at two", () => {
    expect(getFoodPreferenceDisplayReasons({
      isRecommended: true,
      reasons: ["Phù hợp khẩu vị bạn chọn", "taste", "Phù hợp chế độ ăn của bạn"],
      behaviorReasons: ["Dựa trên món bạn đã xem gần đây"],
    })).toEqual([
      "Dựa trên món bạn đã xem gần đây",
      "Phù hợp khẩu vị bạn chọn",
    ]);
  });

  it("shows behavior reason before fallback popular reason", () => {
    expect(getFoodPreferenceDisplayReasons({
      isRecommended: false,
      hasAllergyWarning: false,
      reasons: ["Món phổ biến được nhiều khách chọn"],
      behaviorReasons: ["Bạn đã quan tâm món tương tự gần đây"],
    })).toEqual([
      "Bạn đã quan tâm món tương tự gần đây",
      "Món phổ biến được nhiều khách chọn",
    ]);
  });
});
