import { expect, test as base } from "@playwright/test";
import { installP1NetworkGuard } from "./networkGuard.js";

export const test = base.extend({
  backendGuard: async ({ page }, use) => {
    const guard = installP1NetworkGuard(page);
    await use(guard);
    guard.assertNoBackendErrors();
  },
});

export { expect };
