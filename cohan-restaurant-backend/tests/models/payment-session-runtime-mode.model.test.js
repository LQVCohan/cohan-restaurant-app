import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { resolvePaymentRuntimeMode } from "../../models/payment-session.model.js";

describe("payment session runtime mode", () => {
  it("forces sandbox outside production even when restaurant config requests production", () => {
    expect(
      resolvePaymentRuntimeMode("production", {
        NODE_ENV: "development",
      }),
    ).toBe("sandbox");
  });

  it("allows production only in production or with an explicit development opt-in", () => {
    expect(
      resolvePaymentRuntimeMode("production", {
        NODE_ENV: "production",
      }),
    ).toBe("production");
    expect(
      resolvePaymentRuntimeMode("production", {
        NODE_ENV: "development",
        PAYMENT_ALLOW_PRODUCTION_IN_DEVELOPMENT: "true",
      }),
    ).toBe("production");
  });

  it("keeps sandbox unchanged", () => {
    expect(resolvePaymentRuntimeMode("sandbox", { NODE_ENV: "production" })).toBe(
      "sandbox",
    );
  });

  it("binds sessions without a restaurant to the declared platform credential mode", () => {
    const source = fs.readFileSync(
      new URL("../../models/payment-session.model.js", import.meta.url),
      "utf8",
    );
    expect(source).toContain("getPlatformPaymentCredentialMode");
    expect(source).toContain("this.restaurantId");
    expect(source).toContain(": getPlatformPaymentCredentialMode(this.provider)");
  });
});
