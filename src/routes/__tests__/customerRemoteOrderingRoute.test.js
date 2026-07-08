import { describe, expect, it } from "vitest";
import fs from "node:fs";

const APP_ROUTER_PATH = "src/routes/AppRouter.jsx";
const ORDER_SUMMARY_MODAL_PATH =
  "src/components/Customer/BookingDishesModal/OrderSummaryModal.jsx";

const checkoutRoutePattern =
  /<Route\s+path="\/checkout"\s+element=\{withPrivateRoute\(\s*<CheckoutPage\s*\/>,\s*\["customer"\]\s*\)\}\s*\/>/;
const checkoutExpandedRolePattern =
  /<Route\s+path="\/checkout"\s+element=\{withPrivateRoute\(\s*<CheckoutPage\s*\/>,\s*\[\s*"customer"\s*,\s*"manager"\s*,\s*"admin"\s*\]\s*\)\}\s*\/>/;

describe("customer remote ordering route and checkout role contract", () => {
  it("keeps menu/detail public while protecting /checkout for customers only", () => {
    const src = fs.readFileSync(APP_ROUTER_PATH, "utf8");

    expect(src).toMatch(
      /<Route path="\/cus-menu" element=\{<RestaurantMenu \/>\} \/>/,
    );
    expect(src).toMatch(
      /const FoodDetail = lazy\(\(\) =>\s*import\("@\/components\/Customer\/Food\/FoodDetailV2"\),\s*\);/,
    );
    expect(src).toMatch(
      /<Route\s+path="\/food\/:foodId"\s+element=\{withLazyRoute\(<FoodDetail \/>\)\}\s+\/>/,
    );
    expect(src).toMatch(checkoutRoutePattern);
    expect(src).not.toMatch(checkoutExpandedRolePattern);
  });

  it("keeps OrderSummaryModal customer-only and does not whitelist manager/admin", () => {
    const src = fs.readFileSync(ORDER_SUMMARY_MODAL_PATH, "utf8");

    expect(src).toMatch(/const isCustomer\s*=\s*normalizedRole === "customer"/);
    expect(src).toMatch(
      /const canUseRemoteCheckout\s*=\s*isAuthenticated && isCustomer && !!user\?\.id/,
    );
    expect(src).not.toMatch(/\["customer",\s*"manager",\s*"admin"\]/);
    expect(src).toMatch(
      /Vui lòng đăng nhập bằng tài khoản khách hàng để đặt món\./,
    );
  });
});
