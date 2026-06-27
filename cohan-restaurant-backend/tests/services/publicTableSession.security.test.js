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

  it("returns only active public customer requests newest first", async () => {
    const { buildPublicActiveTableSessionOrdersResult } = await import("../../utils/publicTableSession.js");
    const result = buildPublicActiveTableSessionOrdersResult({
      tableId: "t1",
      tableCode: "A1",
      session: {
        _id: "s1",
        customerRequests: [
          {
            requestId: "old-active",
            type: "STAFF_CALL",
            status: "PENDING",
            message: "Need staff",
            createdAt: "2026-01-01T10:00:00.000Z",
            internalNote: "private",
          },
          {
            requestId: "new-active",
            type: "PAYMENT_REQUEST",
            status: "ACKNOWLEDGED",
            message: "Pay please",
            createdAt: "2026-01-01T10:05:00.000Z",
            acknowledgedAt: "2026-01-01T10:06:00.000Z",
            handledByUserId: "private-user",
          },
          {
            requestId: "resolved",
            type: "STAFF_CALL",
            status: "RESOLVED",
            message: "Done",
            createdAt: "2026-01-01T10:10:00.000Z",
            resolvedAt: "2026-01-01T10:11:00.000Z",
          },
        ],
      },
      orders: [],
    });

    expect(result.customerRequests.map((request) => request.requestId)).toEqual([
      "new-active",
      "old-active",
    ]);
    expect(result.customerRequests).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ requestId: "resolved" })]),
    );
    expect(result.customerRequests[0]).toEqual({
      requestId: "new-active",
      type: "PAYMENT_REQUEST",
      status: "ACKNOWLEDGED",
      message: "Pay please",
      createdAt: "2026-01-01T10:05:00.000Z",
      acknowledgedAt: "2026-01-01T10:06:00.000Z",
      resolvedAt: null,
    });
  });
});
