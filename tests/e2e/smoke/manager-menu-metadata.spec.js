import { expect, test } from "@playwright/test";
import { installSmokeApiMocks, expectNoPageCrash } from "./graphqlMocks.js";

test.describe("manager smoke: menu metadata", () => {
  test("manager can open manager surface and menu metadata panels do not crash", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await installSmokeApiMocks(page, { authRole: "manager" });

    await page.goto("/manager");
    await expectNoPageCrash(page);
    await expect(page).not.toHaveURL(/\/login|\/403/);
    await expect(page.locator("body")).toContainText(/dashboard|tổng quan|menu|thực đơn|FOR YOU|metadata/i);

    const menuLinks = page.getByRole("link", { name: /menu|thực đơn/i });
    if ((await menuLinks.count()) > 0) {
      await menuLinks.first().click();
      await expectNoPageCrash(page);
    }

    await expect(page.locator("body")).toContainText(/menu|thực đơn|món|metadata|FOR YOU/i);
    expect(pageErrors).toEqual([]);
  });
});
