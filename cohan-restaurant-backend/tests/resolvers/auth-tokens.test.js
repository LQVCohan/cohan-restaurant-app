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
import { getRefreshCookieMaxAgeSeconds, getRefreshTokenTtlMs, handleRefreshTokenReuse, issueRefreshToken, parseDurationMs, refreshCookieOptions, revokeRefreshToken, revokeRefreshTokenFamilyFromHash, rotateRefreshToken } from '../../src/security/authTokens.js';


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

  it('rotates valid refresh token and revokes old token', async () => {
    const reply = { setCookie: vi.fn() };
    const save = vi.fn();
    RefreshToken.findOne.mockResolvedValue({
      userId: 'u1',
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 60000),
      revokedAt: null,
      save,
    });
    const chain = { populate: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue({ _id: 'u1', email: 'a@b.c', status: 'active', role: { slug: 'staff' } }) };
    const { User } = await import('../../models/index.js');
    User.findById.mockReturnValue(chain);
    const res = await rotateRefreshToken({ currentRawToken: 'raw', reply });
    expect(res?.token).toBeTruthy();
    expect(save).toHaveBeenCalled();
    expect(reply.setCookie).toHaveBeenCalled();
  });

  it('reusing old revoked refresh token returns null and revokes replacement chain', async () => {
    const logger = { warn: vi.fn() };
    const childSave = vi.fn();
    RefreshToken.findOne
      .mockResolvedValueOnce({
        userId: 'u1', tokenHash: 'oldhash', revokedAt: new Date(), replacedByTokenHash: 'newhash', expiresAt: new Date(Date.now() + 60000),
      })
      .mockResolvedValueOnce({
        tokenHash: 'newhash', revokedAt: null, replacedByTokenHash: null, save: childSave,
      });
    const res = await rotateRefreshToken({ currentRawToken: 'old-raw', reply: { setCookie: vi.fn() }, logger });
    expect(res).toBeNull();
    expect(childSave).toHaveBeenCalled();
    const logged = JSON.stringify(logger.warn.mock.calls[0][0]);
    expect(logged).not.toContain('old-raw');
  });

  it('token-family revoke does not throw when replacement is missing', async () => {
    RefreshToken.findOne.mockResolvedValueOnce(null);
    await expect(revokeRefreshTokenFamilyFromHash('missing')).resolves.toBeUndefined();
  });

  it('handleRefreshTokenReuse logs only safe metadata', async () => {
    const logger = { warn: vi.fn() };
    await handleRefreshTokenReuse({
      userId: 'u1',
      revokedAt: new Date(),
      tokenHash: 'a'.repeat(64),
      replacedByTokenHash: null,
    }, logger);
    const payload = logger.warn.mock.calls[0][0];
    expect(payload.tokenHashPrefix.length).toBeLessThan(64);
  });
});
