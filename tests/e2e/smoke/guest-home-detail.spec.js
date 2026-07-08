import { expect, test } from "@playwright/test";
import { installSmokeApiMocks, expectNoPageCrash } from "./graphqlMocks.js";
import { TEST_MENU_ITEMS } from "./fixtures.js";

test.describe("guest smoke: home and food detail", () => {
  test("guest can browse a dish and receives clear login guidance before ordering", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await installSmokeApiMocks(page);

    await page.goto("/");
    await expectNoPageCrash(page);
    await expect(
      page.getByRole("link", { name: "Nhà hàng", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(TEST_MENU_ITEMS[0].name)).toBeVisible({
      timeout: 12_000,
    });

    await page.goto(
      `/food/${TEST_MENU_ITEMS[0].id}?restaurantId=${TEST_MENU_ITEMS[0].restaurantId}`,
    );
    await expectNoPageCrash(page);
    await expect(page.getByText(TEST_MENU_ITEMS[0].name).first()).toBeVisible({
      timeout: 12_000,
    });
    await expect(
      page.getByRole("button", { name: /Đăng nhập để thêm vào giỏ/i }),
    ).toBeVisible({ timeout: 12_000 });
    await expect(page.getByRole("link", { name: /Hồ sơ|Đăng xuất/i })).toHaveCount(
      0,
    );

    expect(pageErrors).toEqual([]);
  });
});
