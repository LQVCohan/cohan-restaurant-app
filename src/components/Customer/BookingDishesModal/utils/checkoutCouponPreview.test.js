import { describe, expect, it } from "vitest";
import {
  buildRestaurantCartGroups,
  calculateCouponDiscount,
  calculateCouponEligibleSubtotalFrontend,
  getCouponIneligibilityReason,
  getItemCategoryNames,
  normalizeList,
  pickBestCouponForGroup,
} from "./checkoutCouponPreview";

const money = (value) => `${value}đ`;

const items = [
  { id: "food-1", price: 100000, quantity: 1, categoryId: "cat-food", categoryName: "Food", restaurantId: "res-1" },
  { id: "drink-1", price: 50000, quantity: 1, categoryId: "cat-drink", category: { name: "Drink" }, restaurantId: "res-1" },
  { id: "dessert-1", price: 25000, quantity: 1, categoryId: "cat-dessert", category: { id: "cat-dessert", name: "Dessert" }, restaurantId: "res-1" },
];

describe("checkout coupon preview category constraints", () => {
  it("normalizes arrays and comma-separated strings", () => {
    expect(normalizeList([" food ", "drink", "food", ""])).toEqual(["food", "drink"]);
    expect(normalizeList("food, drink,food,,")).toEqual(["food", "drink"]);
  });

  it("calculates eligible subtotal for categories arrays", () => {
    const scope = calculateCouponEligibleSubtotalFrontend({
      coupon: { constraints: { categories: ["food", "drink"] } },
      items,
      fallbackSubtotal: 175000,
    });

    expect(scope).toEqual({ hasConstraints: true, eligibleSubtotal: 150000 });
  });

  it("calculates eligible subtotal for comma-separated categories", () => {
    const scope = calculateCouponEligibleSubtotalFrontend({
      coupon: { constraints: { categories: "food,drink" } },
      items,
      fallbackSubtotal: 175000,
    });

    expect(scope.eligibleSubtotal).toBe(150000);
  });

  it("calculates eligible subtotal for comma-separated categoryIds", () => {
    const scope = calculateCouponEligibleSubtotalFrontend({
      coupon: { constraints: { categoryIds: "cat-food,cat-dessert" } },
      items,
      fallbackSubtotal: 175000,
    });

    expect(scope.eligibleSubtotal).toBe(125000);
  });

  it("does not turn object item.category into [object Object]", () => {
    expect(getItemCategoryNames({ category: { id: "cat-1", name: "Food" } })).toEqual(["food"]);
    expect(getItemCategoryNames({ category: { id: "cat-1" } })).toEqual([]);
  });

  it("does not recommend a string-constrained coupon without matching items", () => {
    const group = buildRestaurantCartGroups(items)[0];
    const reason = getCouponIneligibilityReason({
      coupon: { isActive: true, discountType: "PERCENT", discountValue: 10, constraints: { categories: "noodle" } },
      group,
      orderType: "delivery",
      paymentMethod: "cash",
      formatCurrency: money,
    });

    expect(reason).toBe("Không có món thuộc danh mục áp dụng.");
  });

  it("uses string category constraints for estimated discount", () => {
    const group = buildRestaurantCartGroups(items)[0];
    const best = pickBestCouponForGroup({
      coupons: [{ code: "FOOD20", isActive: true, discountType: "PERCENT", discountValue: 20, constraints: { categories: "food" } }],
      group,
      orderType: "delivery",
      paymentMethod: "cash",
      formatCurrency: money,
    });

    expect(best.eligibleSubtotal).toBe(100000);
    expect(best.estimatedDiscount).toBe(calculateCouponDiscount(best.coupon, 100000));
  });
});
