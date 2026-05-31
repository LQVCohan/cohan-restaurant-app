import { describe, expect, it } from "vitest";
import fs from "node:fs";

const APP_ROUTER_PATH = "src/routes/AppRouter.jsx";

describe("customer remote ordering routes", () => {
  it("keeps menu and food detail public while protecting checkout for customers", () => {
    const src = fs.readFileSync(APP_ROUTER_PATH, "utf8");

    expect(src).toMatch(/<Route path="\/cus-menu" element=\{<RestaurantMenu \/>\} \/>/);
    expect(src).toMatch(/<Route path="\/food\/:foodId" element=\{<FoodDetail \/>\} \/>/);
    expect(src).toMatch(
      /<Route path="\/checkout" element=\{withPrivateRoute\(<CheckoutPage \/>, \["customer"\]\)\} \/>/,
    );
  });
});
