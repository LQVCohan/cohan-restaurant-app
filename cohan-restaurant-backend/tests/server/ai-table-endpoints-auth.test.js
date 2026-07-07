import { describe, it, expect, vi, beforeEach } from 'vitest';

const authResolverMock = vi.hoisted(() => ({ resolveAuthenticatedUserFromRequest: vi.fn() }));
const authzMock = vi.hoisted(() => ({ requireRestaurantPermission: vi.fn() }));
vi.mock('../../src/server/authUserResolver.js', () => authResolverMock);
vi.mock('../../src/services/auth/authorization.service.js', () => authzMock);

import { createServer } from '../../src/server/createServer.js';

describe('AI table endpoints auth guard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.GEMINI_API_KEY;
  });

  it('rejects unauthenticated with 401', async () => {
    const app = await createServer();
    authResolverMock.resolveAuthenticatedUserFromRequest.mockResolvedValue(null);
    const res = await app.inject({ method: 'POST', url: '/api/ai/table/promo-suggestion', payload: { restaurantId: '507f1f77bcf86cd799439011' } });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects forbidden restaurant with 403', async () => {
    const app = await createServer();
    authResolverMock.resolveAuthenticatedUserFromRequest.mockResolvedValue({ id: 'u1' });
    authzMock.requireRestaurantPermission.mockRejectedValue(new Error('forbidden'));
    const res = await app.inject({ method: 'POST', url: '/api/ai/table/turnover-prediction', payload: { restaurantId: '507f1f77bcf86cd799439011' } });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('returns a suggestion for an authorized restaurant', async () => {
    const app = await createServer();
    authResolverMock.resolveAuthenticatedUserFromRequest.mockResolvedValue({ id: 'u1' });
    authzMock.requireRestaurantPermission.mockResolvedValue(true);

    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/table/merge-suggestion',
      payload: {
        restaurantId: '507f1f77bcf86cd799439011',
        table: { id: 'a1', code: 'A1', capacity: 4, position: { x: 0, y: 0 } },
        tables: [{ id: 'a2', code: 'A2', position: { x: 10, y: 0 } }],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(expect.objectContaining({ ok: true }));
    expect(res.json().suggestion).toContain('A2');
    expect(authzMock.requireRestaurantPermission).toHaveBeenCalled();
    await app.close();
  });
});
