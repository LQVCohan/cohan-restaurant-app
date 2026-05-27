import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const authTokenMocks = vi.hoisted(() => ({
  clearRefreshCookie: vi.fn(),
  revokeRefreshToken: vi.fn(),
  rotateRefreshToken: vi.fn(),
}));

vi.mock("../../src/security/authTokens.js", async () => {
  const actual = await vi.importActual("../../src/security/authTokens.js");
  return { ...actual, ...authTokenMocks };
});

import RefreshToken from "../../models/refresh-token.model.js";
import { createServer, shouldAllowAuthCookieRequestOrigin } from "../../src/server/createServer.js";

const originalEnv = process.env;

describe("auth cookie endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: "test", CORS_ORIGINS: "http://allowed.test", JWT_SECRET: "secret", MONGO_URI: "mongodb://127.0.0.1:27017/t" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("origin guard behavior helper", () => {
    expect(shouldAllowAuthCookieRequestOrigin({ origin: "http://allowed.test", allowedOrigins: ["http://allowed.test"], nodeEnv: "production" })).toBe(true);
    expect(shouldAllowAuthCookieRequestOrigin({ origin: "http://evil.test", allowedOrigins: ["http://allowed.test"], nodeEnv: "production" })).toBe(false);
    expect(shouldAllowAuthCookieRequestOrigin({ origin: undefined, allowedOrigins: [], nodeEnv: "test" })).toBe(true);
    expect(shouldAllowAuthCookieRequestOrigin({ origin: undefined, allowedOrigins: [], nodeEnv: "production" })).toBe(false);
    expect(shouldAllowAuthCookieRequestOrigin({ origin: undefined, allowedOrigins: [], nodeEnv: "production", allowNoOriginValue: "true" })).toBe(true);
  });

  it("refresh and logout route behavior", async () => {
    const app = await createServer();
    authTokenMocks.rotateRefreshToken.mockResolvedValueOnce(null).mockResolvedValueOnce({ token: "at", user: { id: "u1" } });

    let res = await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { origin: "http://allowed.test" } });
    expect(res.statusCode).toBe(401);
    expect(authTokenMocks.clearRefreshCookie).toHaveBeenCalled();

    res = await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { origin: "http://allowed.test", cookie: "refresh_token=abc" } });
    expect(res.statusCode).toBe(401);

    res = await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { origin: "http://allowed.test", cookie: "refresh_token=good" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().token).toBe("at");

    res = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { origin: "http://allowed.test", cookie: "refresh_token=good" } });
    expect(res.statusCode).toBe(200);
    expect(authTokenMocks.revokeRefreshToken).toHaveBeenCalledWith("good");
    expect(authTokenMocks.clearRefreshCookie).toHaveBeenCalled();

    res = await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { origin: "http://evil.test", cookie: "refresh_token=good" } });
    expect(res.statusCode).toBe(403);

    res = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { origin: "http://evil.test", cookie: "refresh_token=good" } });
    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it("no Origin production default reject unless ALLOW_AUTH_COOKIE_NO_ORIGIN=true", async () => {
    process.env.NODE_ENV = "production";
    let app = await createServer();
    let res = await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { cookie: "refresh_token=t" } });
    expect(res.statusCode).toBe(403);
    await app.close();

    process.env.ALLOW_AUTH_COOKIE_NO_ORIGIN = "true";
    app = await createServer();
    authTokenMocks.rotateRefreshToken.mockResolvedValueOnce({ token: "at", user: { id: "u1" } });
    res = await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { cookie: "refresh_token=t" } });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("RefreshToken schema contains TTL index on expiresAt", () => {
    const hasTtl = RefreshToken.schema.indexes().some(([spec, opts]) => spec.expiresAt === 1 && opts?.expireAfterSeconds === 0);
    expect(hasTtl).toBe(true);
  });
});
