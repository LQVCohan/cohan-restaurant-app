import { expect, test } from "@playwright/test";
import { installSmokeApiMocks, expectNoPageCrash } from "./graphqlMocks.js";
import { TEST_MENU_ITEMS } from "./fixtures.js";

test.describe("customer smoke: cart and checkout", () => {
  test("customer can open a dish, add it to cart, and reach protected checkout", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await installSmokeApiMocks(page, { authRole: "customer" });

    await page.goto(
      `/food/${TEST_MENU_ITEMS[0].id}?restaurantId=${TEST_MENU_ITEMS[0].restaurantId}`,
    );
    await expectNoPageCrash(page);
    await expect(page.getByText(TEST_MENU_ITEMS[0].name).first()).toBeVisible({
      timeout: 12_000,
    });

    const addButton = page.getByRole("button", { name: /Thêm vào giỏ/i });
    await expect(addButton).toBeVisible({ timeout: 12_000 });
    await addButton.click();
    await expect(
      page.getByText(/giỏ|cart|đã thêm|Smoke Test Phở/i).first(),
    ).toBeVisible({ timeout: 12_000 });

    await page.goto("/checkout");
    await expectNoPageCrash(page);
    await expect(page).not.toHaveURL(/\/login|\/403/);
    await expect(page.locator("body")).toContainText(
      /checkout|thanh toán|giao hàng|đơn hàng/i,
    );

    expect(pageErrors).toEqual([]);
  });
});
