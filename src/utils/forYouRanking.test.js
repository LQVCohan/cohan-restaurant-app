import { describe, expect, it } from "vitest";
import { getForYouRankScore, getForYouReasonType, sortForYouItems } from "./forYouRanking";

const item = (overrides) => ({ name: "Món", rate: 4, orderCounter: 10, foodPreferenceMeta: { score: 0 }, ...overrides });

describe("forYouRanking", () => {
  it("keeps allergy warnings behind safe recommended items", () => {
    const warning = item({ name: "A", foodPreferenceMeta: { score: 99, isRecommended: false, hasAllergyWarning: true } });
    const safe = item({ name: "B", foodPreferenceMeta: { score: 2, isRecommended: true, hasAllergyWarning: false } });

    expect(sortForYouItems([warning, safe])[0]).toBe(safe);
    expect(getForYouRankScore(warning)).toBe(Number.NEGATIVE_INFINITY);
  });

  it("sorts by preference, order history, behavior, popularity, then name", () => {
    const low = item({ name: "A", foodPreferenceMeta: { score: 1 }, orderHistoryScore: 4, behaviorScore: 3, rate: 5 });
    const orderHistory = item({ name: "B", foodPreferenceMeta: { score: 2 }, orderHistoryScore: 4, behaviorScore: 0 });
    const behavior = item({ name: "C", foodPreferenceMeta: { score: 2 }, orderHistoryScore: 1, behaviorScore: 3 });

    expect(sortForYouItems([behavior, low, orderHistory]).map((entry) => entry.name)).toEqual(["B", "C", "A"]);
  });

  it("returns stable reason types", () => {
    expect(getForYouReasonType(item({ foodPreferenceMeta: { hasAllergyWarning: true } }))).toBe("allergy_warning");
    expect(getForYouReasonType(item({ foodPreferenceMeta: { isRecommended: true, score: 2 } }))).toBe("preference");
    expect(getForYouReasonType(item({ behaviorScore: 1 }))).toBe("behavior");
    expect(getForYouReasonType(item({}))).toBe("popular");
  });
});
