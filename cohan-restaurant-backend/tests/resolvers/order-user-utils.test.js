import { describe, it, expect, vi, beforeEach } from 'vitest';

const modelMocks = vi.hoisted(() => ({
  Customer: { findOne: vi.fn() },
  Table: {},
}));

vi.mock('../../models/index.js', () => modelMocks);

describe('order userUtils identity helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes and compacts customer input without empty email/phone', async () => {
    const { compactCustomerInput } = await import('../../graphql/resolvers/order/helper/userUtils.js');
    const out = compactCustomerInput({ fullName: '  A  ', email: '   ', phone: '  ' });
    expect(out).toEqual({ fullName: 'A', email: undefined, phone: undefined });
  });

  it('normalizes phone +84/84 to 0', async () => {
    const { normalizePhone } = await import('../../graphql/resolvers/order/helper/userUtils.js');
    expect(normalizePhone('+84901234567')).toBe('0901234567');
    expect(normalizePhone('84901234567')).toBe('0901234567');
  });

  it('resolves same user for email + phone', async () => {
    modelMocks.Customer.findOne
      .mockReturnValueOnce({ select: () => ({ lean: async () => ({ _id: 'u1' }) }) })
      .mockReturnValueOnce({ select: () => ({ lean: async () => ({ _id: 'u1' }) }) });
    const { resolveCustomerIdentity } = await import('../../graphql/resolvers/order/helper/userUtils.js');
    const out = await resolveCustomerIdentity({ email: 'a@b.com', phone: '0901' });
    expect(out.userId).toBe('u1');
    expect(out.conflict).toBeUndefined();
  });

  it('returns conflict when email and phone map to different users', async () => {
    modelMocks.Customer.findOne
      .mockReturnValueOnce({ select: () => ({ lean: async () => ({ _id: 'u1' }) }) })
      .mockReturnValueOnce({ select: () => ({ lean: async () => ({ _id: 'u2' }) }) });
    const { resolveCustomerIdentity } = await import('../../graphql/resolvers/order/helper/userUtils.js');
    const out = await resolveCustomerIdentity({ email: 'a@b.com', phone: '0902' });
    expect(out.conflict).toBe(true);
  });
});
