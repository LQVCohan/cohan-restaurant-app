import { describe, it, expect, vi, beforeEach } from 'vitest';

const modelMocks = vi.hoisted(() => ({
  User: { findById: vi.fn() },
  Customer: { findById: vi.fn(), findByIdAndUpdate: vi.fn() },
  Role: {},
  CustomerRankSetting: {},
  WalletTransaction: {},
}));
const authMocks = vi.hoisted(() => ({ requirePermission: vi.fn() }));
vi.mock('../../models/index.js', () => modelMocks);
vi.mock('../../src/services/auth/authorization.service.js', () => ({ requirePermission: authMocks.requirePermission }));

describe('user mutation security hardening', () => {
  beforeEach(() => vi.resetAllMocks());

  it('topUpMyWallet rejects direct topup', async () => {
    const m = (await import('../../graphql/resolvers/user/mutation.js')).UserMutation;
    await expect(m.topUpMyWallet(null, { input: { amount: 100000 } }, { user: { id: 'u1' } })).rejects.toThrow(/temporarily disabled/i);
  });

  it('updateCustomerMetrics enforces restaurant scope', async () => {
    const m = (await import('../../graphql/resolvers/user/mutation.js')).UserMutation;
    authMocks.requirePermission.mockResolvedValue(true);
    modelMocks.Customer.findById.mockResolvedValue({ _id: '507f1f77bcf86cd799439011', refRestaurants: ['507f1f77bcf86cd799439012'] });
    await expect(m.updateCustomerMetrics(null, {
      id: '507f1f77bcf86cd799439011',
      restaurantId: '507f1f77bcf86cd799439099',
      loyaltyPoints: 10,
      customerType: 'NEW',
    }, { user: { id: 'm1', roleName: 'manager' } })).rejects.toThrow(/scope/i);
  });
});
