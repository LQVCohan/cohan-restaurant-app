import { expect, test } from "@playwright/test";
import { installP1NetworkGuard } from "./networkGuard.js";

const installProbePage = async (page) => {
  await page.route("**/__p1_probe", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body><h1>P1 probe</h1></body></html>",
    });
  });
};

test.describe("P1 backend network guard", () => {
  test("records GraphQL errors when HTTP status is 200", async ({ page }) => {
    const guard = installP1NetworkGuard(page);
    await installProbePage(page);
    await page.route("**/graphql", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { createReservation: null },
          errors: [{ message: "P1 synthetic GraphQL failure" }],
        }),
      });
    });

    await page.goto("/__p1_probe");
    await page.evaluate(() =>
      fetch("/graphql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operationName: "P1SyntheticMutation", query: "mutation P1SyntheticMutation { p1Synthetic }" }),
      }),
    );

    await expect.poll(() => guard.failures.length).toBe(1);
    expect(() => guard.assertNoBackendErrors("synthetic graphql check")).toThrow(/P1SyntheticMutation/);
  });

  test("records REST/API HTTP errors", async ({ page }) => {
    const guard = installP1NetworkGuard(page);
    await installProbePage(page);
    await page.route("**/api/p1-probe", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "P1 synthetic API failure" }),
      });
    });

    await page.goto("/__p1_probe");
    await page.evaluate(() => fetch("/api/p1-probe", { method: "POST" }));

    await expect.poll(() => guard.failures.length).toBe(1);
    expect(() => guard.assertNoBackendErrors("synthetic api check")).toThrow(/status=500/);
  });
});
