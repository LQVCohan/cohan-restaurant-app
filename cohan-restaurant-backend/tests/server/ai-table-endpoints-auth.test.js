import { describe, it, expect, vi, beforeEach } from 'vitest';

const authResolverMock = vi.hoisted(() => ({ resolveAuthenticatedUserFromRequest: vi.fn() }));
const authzMock = vi.hoisted(() => ({ requireRestaurantPermission: vi.fn() }));
vi.mock('../../src/server/authUserResolver.js', () => authResolverMock);
vi.mock('../../src/services/auth/authorization.service.js', () => authzMock);

import { createServer } from '../../src/server/createServer.js';

describe('AI table endpoints auth guard', () => {
  beforeEach(() => vi.resetAllMocks());

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
});
