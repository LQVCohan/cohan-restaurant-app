import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

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

  const makeUserDoc = () => ({
    _id: '507f1f77bcf86cd799439011',
    avatarUrl: null,
    save: vi.fn().mockResolvedValue(true),
  });

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

  it('updateAvatar returns BAD_USER_INPUT for invalid format', async () => {
    const m = (await import('../../graphql/resolvers/user/mutation.js')).UserMutation;
    modelMocks.User.findById.mockResolvedValue(makeUserDoc());
    await expect(m.updateAvatar(null, { input: { fileBase64: 'not-a-data-uri' } }, { user: { id: 'u1' } }))
      .rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
  });

  it('updateAvatar returns BAD_USER_INPUT for unsupported MIME', async () => {
    const m = (await import('../../graphql/resolvers/user/mutation.js')).UserMutation;
    modelMocks.User.findById.mockResolvedValue(makeUserDoc());
    await expect(m.updateAvatar(null, { input: { fileBase64: 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==' } }, { user: { id: 'u1' } }))
      .rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
  });

  it('updateAvatar returns BAD_USER_INPUT for oversized avatar', async () => {
    process.env.AVATAR_MAX_FILE_SIZE_BYTES = '4';
    vi.resetModules();
    const m = (await import('../../graphql/resolvers/user/mutation.js')).UserMutation;
    modelMocks.User.findById.mockResolvedValue(makeUserDoc());
    await expect(m.updateAvatar(null, { input: { fileBase64: 'data:image/png;base64,AAAAAA==' } }, { user: { id: 'u1' } }))
      .rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
    delete process.env.AVATAR_MAX_FILE_SIZE_BYTES;
    vi.resetModules();
  });

  it('updateAvatar returns INTERNAL_SERVER_ERROR for unexpected save error', async () => {
    process.env.AVATAR_MAX_FILE_SIZE_BYTES = `${2 * 1024 * 1024}`;
    vi.resetModules();
    const m = (await import('../../graphql/resolvers/user/mutation.js')).UserMutation;
    vi.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => { throw new Error('disk-fail'); });
    modelMocks.User.findById.mockResolvedValue(makeUserDoc());
    await expect(m.updateAvatar(null, { input: { fileBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=' } }, { user: { id: 'u1' } }))
      .rejects.toMatchObject({ extensions: { code: 'INTERNAL_SERVER_ERROR' } });
    delete process.env.AVATAR_MAX_FILE_SIZE_BYTES;
  });

  it('accepts safe relative /uploads avatar URL', async () => {
    const m = (await import('../../graphql/resolvers/user/mutation.js')).UserMutation;
    const userDoc = makeUserDoc();
    modelMocks.User.findById.mockResolvedValueOnce(userDoc).mockReturnValueOnce({ populate: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ role: { slug: 'customer' } }) }) });
    await expect(m.updateAvatar(null, { input: { fileUrl: '/uploads/avatars/a.webp' } }, { user: { id: 'u1' } })).resolves.toBeTruthy();
  });

  it.each(['//evil.com/a.webp', 'javascript:alert(1)', 'data:image/svg+xml,abc', 'https://evil.com/uploads/a.webp', 'https://cdn.example.com/uploads.evil/a.webp'])(
    'rejects unsafe avatar URL: %s',
    async (badUrl) => {
      process.env.S3_PUBLIC_BASE_URL = 'https://cdn.example.com/uploads';
      const m = (await import('../../graphql/resolvers/user/mutation.js')).UserMutation;
      modelMocks.User.findById.mockResolvedValue(makeUserDoc());
      await expect(m.updateAvatar(null, { input: { fileUrl: badUrl } }, { user: { id: 'u1' } }))
        .rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
    },
  );

  it('accepts safe S3 avatar URL under configured base path', async () => {
    process.env.S3_PUBLIC_BASE_URL = 'https://cdn.example.com/uploads';
    const m = (await import('../../graphql/resolvers/user/mutation.js')).UserMutation;
    const userDoc = makeUserDoc();
    modelMocks.User.findById.mockResolvedValueOnce(userDoc).mockReturnValueOnce({ populate: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ role: { slug: 'customer' } }) }) });
    await expect(m.updateAvatar(null, { input: { fileUrl: 'https://cdn.example.com/uploads/avatar.webp' } }, { user: { id: 'u1' } })).resolves.toBeTruthy();
    delete process.env.S3_PUBLIC_BASE_URL;
  });
});
