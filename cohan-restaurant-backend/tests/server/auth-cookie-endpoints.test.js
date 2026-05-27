import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/security/authTokens.js', async () => {
  const actual = await vi.importActual('../../src/security/authTokens.js');
  return {
    ...actual,
    rotateRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
    clearRefreshCookie: vi.fn((reply) => reply.clearCookie('refresh_token', { path: '/api/auth' })),
  };
});

import { createServer, shouldAllowAuthCookieRequestOrigin } from '../../src/server/createServer.js';
import * as authTokens from '../../src/security/authTokens.js';
import RefreshToken from '../../models/refresh-token.model.js';

describe('auth cookie endpoints', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'x';
    process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/test';
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_AUTH_COOKIE_NO_ORIGIN = 'true';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('refresh missing cookie returns 401 and clears cookie', async () => {
    const app = await createServer();
    const res = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { origin: 'http://localhost:5173' } });
    expect(res.statusCode).toBe(401);
    expect(authTokens.clearRefreshCookie).toHaveBeenCalled();
    await app.close();
  });

  it('refresh invalid cookie returns 401 and clears cookie', async () => {
    authTokens.rotateRefreshToken.mockResolvedValue(null);
    const app = await createServer();
    const res = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: 'refresh_token=bad', origin: 'http://localhost:5173' } });
    expect(res.statusCode).toBe(401);
    expect(authTokens.clearRefreshCookie).toHaveBeenCalled();
    await app.close();
  });

  it('refresh valid cookie rotates token and sets cookie', async () => {
    authTokens.rotateRefreshToken.mockResolvedValue({ token: 'access', user: { id: 'u1' } });
    const app = await createServer();
    const res = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: 'refresh_token=ok', origin: 'http://localhost:5173' } });
    expect(res.statusCode).toBe(200);
    expect(authTokens.rotateRefreshToken).toHaveBeenCalledWith(expect.objectContaining({ currentRawToken: 'ok' }));
    await app.close();
  });

  it('logout receives cookie and revokes token then clears cookie', async () => {
    const app = await createServer();
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: 'refresh_token=ok', origin: 'http://localhost:5173' } });
    expect(res.statusCode).toBe(200);
    expect(authTokens.revokeRefreshToken).toHaveBeenCalledWith('ok');
    expect(authTokens.clearRefreshCookie).toHaveBeenCalled();
    await app.close();
  });

  it('blocks disallowed Origin for refresh/logout with 403', async () => {
    const app = await createServer();
    const a = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { origin: 'http://evil.com' } });
    const b = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { origin: 'http://evil.com' } });
    expect(a.statusCode).toBe(403);
    expect(b.statusCode).toBe(403);
    await app.close();
  });

  it('allows no Origin when enabled', async () => {
    authTokens.rotateRefreshToken.mockResolvedValue({ token: 'access', user: { id: 'u1' } });
    const app = await createServer();
    const res = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: 'refresh_token=ok' } });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('rejects no Origin in production by default', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_AUTH_COOKIE_NO_ORIGIN = '';
    const app = await createServer();
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('allows no Origin in production when explicitly enabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_AUTH_COOKIE_NO_ORIGIN = 'true';
    const app = await createServer();
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('refresh token model has TTL index on expiresAt', () => {
    const indexes = RefreshToken.schema.indexes();
    expect(indexes).toEqual(expect.arrayContaining([
      [{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })],
    ]));
  });

  it('origin helper enforces production no-origin default deny', () => {
    expect(shouldAllowAuthCookieRequestOrigin({
      origin: undefined,
      allowedOrigins: ['http://localhost:5173'],
      nodeEnv: 'production',
      allowNoOriginValue: undefined,
    })).toBe(false);
    expect(shouldAllowAuthCookieRequestOrigin({
      origin: undefined,
      allowedOrigins: ['http://localhost:5173'],
      nodeEnv: 'production',
      allowNoOriginValue: 'true',
    })).toBe(true);
  });
});
