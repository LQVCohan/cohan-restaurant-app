import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../models/index.js', () => ({
  RefreshToken: {
    create: vi.fn(async (doc) => doc),
  },
  User: {
    findById: vi.fn(() => ({ populate: () => ({ lean: async () => ({ _id: 'u1', email: 'a@b.com', status: 'active', role: { slug: 'manager' } }) }) })),
  },
}));

describe('authTokens helpers', () => {
  beforeEach(() => {
    process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';
    process.env.REFRESH_TOKEN_COOKIE_SAMESITE = 'lax';
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'this-is-a-strong-jwt-secret-with-32-characters-min';
  });

  it('uses /api/auth cookie path and maxAge in seconds', async () => {
    const { refreshCookieOptions } = await import('../../src/security/authTokens.js');
    const options = refreshCookieOptions();
    expect(options.path).toBe('/api/auth');
    expect(options.maxAge).toBe(604800);
  });

  it('stores hashed refresh token and not raw token', async () => {
    const { issueRefreshToken } = await import('../../src/security/authTokens.js');
    const { RefreshToken } = await import('../../models/index.js');
    const reply = { setCookie: vi.fn() };
    const issued = await issueRefreshToken({ userId: 'u1', reply });
    const createArg = RefreshToken.create.mock.calls[0][0];
    expect(createArg.tokenHash).toBeTruthy();
    expect(createArg.tokenHash).not.toBe(issued.raw);
  });
});
