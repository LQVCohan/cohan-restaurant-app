import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

const mocks = vi.hoisted(() => ({
  RefreshToken: {
    create: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
  },
  User: { findById: vi.fn() },
}));

vi.mock("../../models/index.js", () => mocks);

import { RefreshToken, User } from "../../models/index.js";
import {
  getRefreshCookieMaxAgeSeconds,
  getRefreshTokenReuseGraceMs,
  getRefreshTokenTtlMs,
  handleRefreshTokenReuse,
  hashRefreshToken,
  isRefreshTokenWithinReuseGrace,
  issueRefreshToken,
  parseDurationMs,
  refreshCookieOptions,
  revokeRefreshToken,
  revokeRefreshTokenFamilyFromHash,
  rotateRefreshToken,
} from "../../src/security/authTokens.js";

function mockActiveUser(userId = "u1") {
  User.findById.mockReturnValue({
    populate: () => ({
      lean: async () => ({
        _id: userId,
        email: "a@b.com",
        status: "active",
        role: { slug: "manager" },
      }),
    }),
  });
}

describe("auth tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REFRESH_TOKEN_EXPIRES_IN = "7d";
    process.env.NODE_ENV = "development";
    process.env.JWT_SECRET = "secret";
    process.env.ACCESS_TOKEN_EXPIRES_IN = "15m";
    delete process.env.REFRESH_TOKEN_COOKIE_SAMESITE;
    delete process.env.REFRESH_TOKEN_REUSE_GRACE_MS;
    delete process.env.AUTH_REFRESH_TOKEN_ROTATION_ENABLED;
  });

  it("parseDurationMs still works", () => {
    expect(parseDurationMs("15m")).toBe(900000);
    expect(() => parseDurationMs("0s")).toThrow();
    expect(() => parseDurationMs("abc")).toThrow();
    expect(getRefreshTokenTtlMs()).toBe(604800000);
  });

  it("refresh cookie path is /api/auth and maxAge is seconds", () => {
    const opts = refreshCookieOptions();
    expect(opts.path).toBe("/api/auth");
    expect(opts.maxAge).toBe(604800);
    expect(opts.sameSite).toBe("lax");
    expect(opts.secure).toBe(false);
    expect(getRefreshCookieMaxAgeSeconds()).toBe(604800);
  });

  it("defaults production refresh cookies to cross-site safe delivery", () => {
    process.env.NODE_ENV = "production";
    const opts = refreshCookieOptions();
    expect(opts.sameSite).toBe("none");
    expect(opts.secure).toBe(true);
  });

  it("honors an explicit production same-site policy", () => {
    process.env.NODE_ENV = "production";
    process.env.REFRESH_TOKEN_COOKIE_SAMESITE = "strict";
    const opts = refreshCookieOptions();
    expect(opts.sameSite).toBe("strict");
    expect(opts.secure).toBe(true);
  });

  it("DB expiresAt uses milliseconds", async () => {
    const reply = { setCookie: vi.fn() };
    await issueRefreshToken({ userId: "u1", reply });
    const call = RefreshToken.create.mock.calls[0][0];
    expect(call.expiresAt.getTime()).toBeGreaterThan(Date.now() + 604799000);
  });

  it("revokeRefreshToken hashes raw token before DB update", async () => {
    await revokeRefreshToken("raw123");
    expect(RefreshToken.updateOne).toHaveBeenCalledWith(
      { tokenHash: hashRefreshToken("raw123"), revokedAt: null },
      expect.any(Object),
    );
  });

  it("valid refresh atomically claims and rotates the token", async () => {
    const old = {
      userId: "u1",
      tokenHash: hashRefreshToken("old"),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 5000),
      persistent: true,
      save: vi.fn(),
    };
    RefreshToken.findOne.mockResolvedValue(old);
    RefreshToken.findOneAndUpdate.mockImplementation(async (_filter, update) => {
      old.revokedAt = update.$set.revokedAt;
      return old;
    });
    mockActiveUser();
    RefreshToken.create.mockResolvedValue({});

    const result = await rotateRefreshToken({
      currentRawToken: "old",
      reply: { setCookie: vi.fn() },
      logger: { warn: vi.fn(), debug: vi.fn() },
    });

    expect(result?.token).toBeTruthy();
    expect(RefreshToken.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: old.tokenHash,
        revokedAt: null,
        expiresAt: { $gt: expect.any(Date) },
      }),
      { $set: { revokedAt: expect.any(Date) } },
      { new: true },
    );
    expect(old.revokedAt).toBeTruthy();
    expect(old.replacedByTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.user.passwordHash).toBeUndefined();
  });

  it("preserves the active session for a recent duplicate refresh", async () => {
    process.env.REFRESH_TOKEN_REUSE_GRACE_MS = "5000";
    const logger = { warn: vi.fn(), debug: vi.fn() };
    const existing = {
      userId: "u1",
      tokenHash: hashRefreshToken("old"),
      revokedAt: new Date(Date.now() - 100),
      replacedByTokenHash: "h2",
      expiresAt: new Date(Date.now() + 10000),
    };
    RefreshToken.findOne.mockResolvedValue(existing);
    mockActiveUser();

    const result = await rotateRefreshToken({
      currentRawToken: "old",
      reply: { setCookie: vi.fn() },
      logger,
    });

    expect(result?.token).toBeTruthy();
    expect(logger.debug).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(RefreshToken.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("recovers when another request wins the atomic rotation claim", async () => {
    const old = {
      userId: "u1",
      tokenHash: hashRefreshToken("old"),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 10000),
    };
    const claimedByOtherRequest = {
      ...old,
      revokedAt: new Date(),
      replacedByTokenHash: null,
    };
    RefreshToken.findOne
      .mockResolvedValueOnce(old)
      .mockResolvedValueOnce(claimedByOtherRequest);
    RefreshToken.findOneAndUpdate.mockResolvedValue(null);
    mockActiveUser();

    const result = await rotateRefreshToken({
      currentRawToken: "old",
      reply: { setCookie: vi.fn() },
      logger: { warn: vi.fn(), debug: vi.fn() },
    });

    expect(result?.token).toBeTruthy();
    expect(RefreshToken.create).not.toHaveBeenCalled();
  });

  it("reusing an old token after the grace period revokes the descendant chain", async () => {
    process.env.REFRESH_TOKEN_REUSE_GRACE_MS = "1000";
    const logger = { warn: vi.fn(), debug: vi.fn() };
    const existing = {
      userId: "u1",
      tokenHash: hashRefreshToken("old"),
      revokedAt: new Date(Date.now() - 5000),
      replacedByTokenHash: "h2",
      expiresAt: new Date(Date.now() + 10000),
    };
    const token2 = {
      tokenHash: "h2",
      revokedAt: null,
      replacedByTokenHash: "h3",
      save: vi.fn(),
    };
    const token3 = {
      tokenHash: "h3",
      revokedAt: null,
      replacedByTokenHash: null,
      save: vi.fn(),
    };
    RefreshToken.findOne.mockImplementation(async ({ tokenHash }) => {
      if (tokenHash === existing.tokenHash) return existing;
      if (tokenHash === "h2") return token2;
      if (tokenHash === "h3") return token3;
      return null;
    });

    const result = await rotateRefreshToken({
      currentRawToken: "old",
      reply: { setCookie: vi.fn() },
      logger,
    });

    expect(result).toBeNull();
    expect(token2.revokedAt).toBeTruthy();
    expect(token3.revokedAt).toBeTruthy();
    expect(logger.warn).toHaveBeenCalled();
    expect(JSON.stringify(logger.warn.mock.calls[0][0])).not.toContain("old");
  });

  it("clamps and validates the refresh collision grace window", () => {
    process.env.REFRESH_TOKEN_REUSE_GRACE_MS = "999999";
    expect(getRefreshTokenReuseGraceMs()).toBe(30000);

    process.env.REFRESH_TOKEN_REUSE_GRACE_MS = "invalid";
    expect(getRefreshTokenReuseGraceMs()).toBe(5000);

    process.env.REFRESH_TOKEN_REUSE_GRACE_MS = "2000";
    expect(
      isRefreshTokenWithinReuseGrace({ revokedAt: new Date(Date.now() - 1000) }),
    ).toBe(true);
    expect(
      isRefreshTokenWithinReuseGrace({ revokedAt: new Date(Date.now() - 3000) }),
    ).toBe(false);
  });

  it("family revoke does not throw if replacement token is missing", async () => {
    RefreshToken.findOne.mockResolvedValueOnce(null);
    await expect(revokeRefreshTokenFamilyFromHash("missing")).resolves.toBeUndefined();
  });

  it("handleRefreshTokenReuse logs only safe metadata", async () => {
    const logger = { warn: vi.fn() };
    const existing = {
      userId: "u1",
      tokenHash: crypto.randomBytes(32).toString("hex"),
      replacedByTokenHash: crypto.randomBytes(32).toString("hex"),
    };
    RefreshToken.findOne.mockResolvedValue(null);
    await handleRefreshTokenReuse(existing, logger);
    const logPayload = logger.warn.mock.calls[0][0];
    expect(logPayload.userId).toBe("u1");
    expect(logPayload.tokenHashPrefix.length).toBe(12);
    expect(logPayload.replacedByTokenHashPrefix.length).toBe(12);
    expect(Object.values(logPayload).join(" ")).not.toContain("raw");
  });
});
