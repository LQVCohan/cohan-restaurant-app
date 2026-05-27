import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

const mocks = vi.hoisted(() => ({
  RefreshToken: {
    create: vi.fn(),
    findOne: vi.fn(),
    updateOne: vi.fn(),
  },
  User: { findById: vi.fn() },
}));

vi.mock("../../models/index.js", () => mocks);

import { RefreshToken, User } from "../../models/index.js";
import {
  getRefreshCookieMaxAgeSeconds,
  getRefreshTokenTtlMs,
  handleRefreshTokenReuse,
  hashRefreshToken,
  issueRefreshToken,
  parseDurationMs,
  refreshCookieOptions,
  revokeRefreshToken,
  revokeRefreshTokenFamilyFromHash,
  rotateRefreshToken,
} from "../../src/security/authTokens.js";

describe("auth tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REFRESH_TOKEN_EXPIRES_IN = "7d";
    process.env.NODE_ENV = "development";
    process.env.JWT_SECRET = "secret";
    process.env.ACCESS_TOKEN_EXPIRES_IN = "15m";
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
    expect(getRefreshCookieMaxAgeSeconds()).toBe(604800);
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

  it("valid refresh rotates token and revokes old token with replacedByTokenHash", async () => {
    const old = { userId: "u1", tokenHash: hashRefreshToken("old"), revokedAt: null, expiresAt: new Date(Date.now() + 5000), save: vi.fn() };
    RefreshToken.findOne.mockResolvedValue(old);
    User.findById.mockReturnValue({ populate: () => ({ lean: async () => ({ _id: "u1", email: "a@b.com", status: "active", role: { slug: "manager" } }) }) });
    RefreshToken.create.mockResolvedValue({});

    const result = await rotateRefreshToken({ currentRawToken: "old", reply: { setCookie: vi.fn() }, logger: { warn: vi.fn() } });
    expect(result?.token).toBeTruthy();
    expect(old.revokedAt).toBeTruthy();
    expect(old.replacedByTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.user.passwordHash).toBeUndefined();
  });

  it("reusing old revoked refresh token returns null and revokes descendant chain", async () => {
    const logger = { warn: vi.fn() };
    const existing = { userId: "u1", tokenHash: hashRefreshToken("old"), revokedAt: new Date(), replacedByTokenHash: "h2", expiresAt: new Date(Date.now() + 10000) };
    const token2 = { tokenHash: "h2", revokedAt: null, replacedByTokenHash: "h3", save: vi.fn() };
    const token3 = { tokenHash: "h3", revokedAt: null, replacedByTokenHash: null, save: vi.fn() };
    RefreshToken.findOne.mockImplementation(async ({ tokenHash }) => {
      if (tokenHash === existing.tokenHash) return existing;
      if (tokenHash === "h2") return token2;
      if (tokenHash === "h3") return token3;
      return null;
    });

    const result = await rotateRefreshToken({ currentRawToken: "old", reply: { setCookie: vi.fn() }, logger });
    expect(result).toBeNull();
    expect(token2.revokedAt).toBeTruthy();
    expect(token3.revokedAt).toBeTruthy();
    expect(logger.warn).toHaveBeenCalled();
    expect(JSON.stringify(logger.warn.mock.calls[0][0])).not.toContain("old");
  });

  it("family revoke does not throw if replacement token is missing", async () => {
    RefreshToken.findOne.mockResolvedValueOnce(null);
    await expect(revokeRefreshTokenFamilyFromHash("missing")).resolves.toBeUndefined();
  });

  it("handleRefreshTokenReuse logs only safe metadata", async () => {
    const logger = { warn: vi.fn() };
    const existing = { userId: "u1", tokenHash: crypto.randomBytes(32).toString("hex"), replacedByTokenHash: crypto.randomBytes(32).toString("hex") };
    RefreshToken.findOne.mockResolvedValue(null);
    await handleRefreshTokenReuse(existing, logger);
    const logPayload = logger.warn.mock.calls[0][0];
    expect(logPayload.userId).toBe("u1");
    expect(logPayload.tokenHashPrefix.length).toBe(12);
    expect(logPayload.replacedByTokenHashPrefix.length).toBe(12);
    expect(Object.values(logPayload).join(" ")).not.toContain("raw");
  });
});
