import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../models/index.js", () => ({
  RefreshToken: {},
  User: {},
}));

import { refreshCookieOptions } from "../../src/security/authTokens.js";

const httpsTunnelReply = () => ({
  request: {
    protocol: "http",
    headers: {
      "x-forwarded-proto": "https",
      origin: "https://mobile-app.ngrok-free.dev",
    },
    raw: { socket: { encrypted: false } },
  },
});

describe("refresh cookie policy for mobile/private browsing", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    process.env.REFRESH_TOKEN_EXPIRES_IN = "7d";
    delete process.env.REFRESH_TOKEN_COOKIE_SAMESITE;
    delete process.env.REFRESH_TOKEN_COOKIE_PARTITIONED;
  });

  it("keeps plain local HTTP development cookies compatible", () => {
    const options = refreshCookieOptions();

    expect(options.sameSite).toBe("lax");
    expect(options.secure).toBe(false);
    expect(options.partitioned).toBeUndefined();
  });

  it("uses a secure partitioned cookie behind an HTTPS mobile tunnel", () => {
    const options = refreshCookieOptions({ reply: httpsTunnelReply() });

    expect(options.sameSite).toBe("none");
    expect(options.secure).toBe(true);
    expect(options.partitioned).toBe(true);
    expect(options.path).toBe("/api/auth");
  });

  it("allows partitioned delivery to be disabled explicitly", () => {
    process.env.REFRESH_TOKEN_COOKIE_PARTITIONED = "false";

    const options = refreshCookieOptions({ reply: httpsTunnelReply() });

    expect(options.sameSite).toBe("none");
    expect(options.secure).toBe(true);
    expect(options.partitioned).toBeUndefined();
  });
});
