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

  it("keeps sandbox OTP outside production", async () => {
    process.env.NODE_ENV = "test";
    process.env.TABLE_QR_DEMO_OTP = "123456";
    const { getPublicTableDemoOtp } = await import("../../utils/publicTableSession.js");
    expect(getPublicTableDemoOtp()).toBe("123456");

    process.env.NODE_ENV = "production";
    expect(() => getPublicTableDemoOtp()).toThrow(/production/i);
  });

  it("signs table-scoped identity challenge, candidate and confirmed identity", async () => {
    process.env.NODE_ENV = "test";
    process.env.TABLE_ACCESS_TOKEN_SECRET = "table-secret-123456789";
    const {
      signTableIdentityChallenge,
      signTableIdentityCandidate,
      signTableIdentityToken,
      verifyTableIdentityChallenge,
      verifyTableIdentityCandidate,
      verifyTableIdentityToken,
    } = await import("../../utils/publicTableSession.js");

    const challenge = signTableIdentityChallenge({
      restaurantId: "r1",
      tableId: "t1",
      phone: "+84 912 345 678",
    });
    expect(verifyTableIdentityChallenge(challenge)).toMatchObject({
      restaurantId: "r1",
      tableId: "t1",
      phone: "0912345678",
    });

    const candidate = signTableIdentityCandidate({
      restaurantId: "r1",
      tableId: "t1",
      phone: "0912345678",
      customerId: "c1",
    });
    expect(verifyTableIdentityCandidate(candidate).customerId).toBe("c1");

    const identity = signTableIdentityToken({
      restaurantId: "r1",
      tableId: "t1",
      customerId: "c1",
      isGuest: true,
    });
    expect(verifyTableIdentityToken(identity)).toMatchObject({
      restaurantId: "r1",
      tableId: "t1",
      customerId: "c1",
      isGuest: true,
    });
  });

  it("returns only active public customer requests newest first", async () => {
    const { buildPublicActiveTableSessionOrdersResult } = await import("../../utils/publicTableSession.js");
    const result = buildPublicActiveTableSessionOrdersResult({
      tableId: "t1",
      tableCode: "A1",
      tableStatus: "occupied",
      session: {
        _id: "s1",
        sessionStatus: "dining",
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

    expect(result.canOrder).toBe(true);
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

  it("exposes proof images only as public by-weight metadata", async () => {
    const { mapPublicTableOrder } = await import("../../utils/publicTableSession.js");
    const result = mapPublicTableOrder({
      _id: "o1",
      totals: { grandTotal: 100000 },
      items: [
        {
          _id: "i1",
          name: "Cá theo ký",
          quantity: 1,
          unit: "kg",
          weightGrams: 1200,
          servingVariant: { mode: "BY_WEIGHT" },
          proofImages: ["https://cdn.example/proof.jpg", ""],
        },
        {
          _id: "i2",
          name: "Cơm",
          quantity: 1,
          unit: "portion",
          servingVariant: { mode: "PORTION" },
          proofImages: [],
        },
      ],
    });

    expect(result.items[0]).toMatchObject({
      requiresProofImage: true,
      proofUploaded: true,
      proofImages: ["https://cdn.example/proof.jpg"],
    });
    expect(result.items[1]).toMatchObject({
      requiresProofImage: false,
      proofUploaded: false,
      proofImages: [],
    });
  });
});
