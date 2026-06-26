import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const baseEnv = process.env;

describe("public table session security", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...baseEnv };
  });

  afterEach(() => {
    process.env = baseEnv;
  });

  it("signs/verifies with table secret separate from JWT secret", async () => {
    process.env.JWT_SECRET = "jwt-secret-123456789";
    process.env.TABLE_ACCESS_TOKEN_SECRET = "table-secret-123456789";
    const { signTableAccessToken, verifyTableAccessToken } = await import("../../utils/publicTableSession.js");
    const token = signTableAccessToken({ restaurantId: "r1", tableId: "t1" });
    const payload = verifyTableAccessToken(token);
    expect(payload.restaurantId).toBe("r1");
  });

  it("uses custom ttl for printed table QR tokens", async () => {
    process.env.JWT_SECRET = "jwt-secret-123456789";
    process.env.TABLE_ACCESS_TOKEN_SECRET = "table-secret-123456789";
    process.env.TABLE_ACCESS_TOKEN_EXPIRES_IN = "1ms";
    const { signTableAccessToken, verifyTableAccessToken } = await import("../../utils/publicTableSession.js");
    const token = signTableAccessToken({ restaurantId: "r1", tableId: "t1", expiresIn: "1h" });
    const payload = verifyTableAccessToken(token);
    expect(payload.restaurantId).toBe("r1");
  });

  it("rejects expired token", async () => {
    process.env.JWT_SECRET = "jwt-secret-123456789";
    process.env.TABLE_ACCESS_TOKEN_SECRET = "table-secret-123456789";
    process.env.TABLE_ACCESS_TOKEN_EXPIRES_IN = "1ms";
    const { signTableAccessToken, verifyTableAccessToken, TABLE_ACCESS_TOKEN_ERROR } = await import("../../utils/publicTableSession.js");
    const token = signTableAccessToken({ restaurantId: "r1", tableId: "t1" });
    await new Promise((r) => setTimeout(r, 10));
    expect(() => verifyTableAccessToken(token)).toThrow(TABLE_ACCESS_TOKEN_ERROR);
  });
});