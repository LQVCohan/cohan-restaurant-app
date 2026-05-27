import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

vi.mock('../../models/index.js', () => ({
  RefreshToken: {
    create: vi.fn(),
    findOne: vi.fn(),
    updateOne: vi.fn(),
  },
  User: { findById: vi.fn() },
}));

import { RefreshToken } from '../../models/index.js';
import { getRefreshCookieMaxAgeSeconds, getRefreshTokenTtlMs, issueRefreshToken, parseDurationMs, refreshCookieOptions, revokeRefreshToken } from '../../src/security/authTokens.js';

describe('auth tokens', () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.REFRESH_TOKEN_EXPIRES_IN = '7d'; process.env.NODE_ENV='development'; });

  it('parses duration helpers', () => {
    expect(parseDurationMs('15m')).toBe(900000);
    expect(() => parseDurationMs('0s')).toThrow();
    expect(() => parseDurationMs('abc')).toThrow();
    expect(getRefreshTokenTtlMs()).toBe(604800000);
    expect(getRefreshCookieMaxAgeSeconds()).toBe(604800);
  });

  it('uses /api/auth cookie path and seconds maxAge', () => {
    const opts = refreshCookieOptions();
    expect(opts.path).toBe('/api/auth');
    expect(opts.maxAge).toBe(604800);
  });

  it('stores hashed token and ms ttl expiry in db', async () => {
    const reply = { setCookie: vi.fn() };
    await issueRefreshToken({ userId: 'u1', reply });
    const call = RefreshToken.create.mock.calls[0][0];
    expect(call.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(call.expiresAt.getTime()).toBeGreaterThan(Date.now() + 604799000);
    expect(call.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 604801000);
    expect(reply.setCookie).toHaveBeenCalled();
  });

  it('revokes token by hash', async () => {
    await revokeRefreshToken('raw123');
    const expected = crypto.createHash('sha256').update('raw123').digest('hex');
    expect(RefreshToken.updateOne).toHaveBeenCalledWith({ tokenHash: expected, revokedAt: null }, expect.any(Object));
  });
});
