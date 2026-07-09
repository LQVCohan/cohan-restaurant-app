import { afterEach, describe, expect, it } from "vitest";
import {
  assertDemoScriptAllowed,
  getDemoPassword,
  maskMongoUri,
  safeDbInfo,
} from "../../scripts/lib/scriptSafety.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("script safety helpers", () => {
  it("maskMongoUri hides username/password", () => {
    expect(maskMongoUri("mongodb+srv://user:pass@cluster/db")).toBe(
      "mongodb+srv://***:***@cluster/db",
    );
  });

  it("maskMongoUri handles plain local Mongo URI", () => {
    expect(maskMongoUri("mongodb://localhost:27017/cohan")).toBe(
      "mongodb://localhost:27017/cohan",
    );
  });

  it("assertDemoScriptAllowed allows development", () => {
    process.env.NODE_ENV = "development";
    expect(() => assertDemoScriptAllowed("demo.js")).not.toThrow();
  });

  it("assertDemoScriptAllowed blocks production by default", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_DEMO_SEED_IN_PRODUCTION;
    expect(() => assertDemoScriptAllowed("demo.js")).toThrow(
      "demo.js is blocked in production-like environments",
    );
  });

  it("assertDemoScriptAllowed allows production with explicit override", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_DEMO_SEED_IN_PRODUCTION = "true";
    process.env.DEMO_PASSWORD = "Stronger!Pass123";
    expect(() => assertDemoScriptAllowed("demo.js")).not.toThrow();
  });

  it("getDemoPassword allows fallback in development", () => {
    process.env.NODE_ENV = "development";
    delete process.env.DEMO_PASSWORD;
    expect(getDemoPassword()).toBe("Demo@123456");
  });

  it("getDemoPassword rejects Demo@123456 in production-like env", () => {
    process.env.NODE_ENV = "production";
    process.env.DEMO_PASSWORD = "Demo@123456";
    expect(() => getDemoPassword()).toThrow(
      "DEMO_PASSWORD is too weak for production-like environments",
    );
  });

  it("safeDbInfo never returns raw password", () => {
    process.env.MONGO_URI = "mongodb://alice:secretpass@example.net/cohan";
    const info = safeDbInfo();
    expect(info.mongoUri).toBe("mongodb://***:***@example.net/cohan");
    expect(info.mongoUri).not.toContain("secretpass");
  });
});
