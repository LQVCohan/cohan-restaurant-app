import { GraphQLError } from 'graphql';

const modelMocks = vi.hoisted(() => ({
  User: {
    findById: vi.fn(),
    findOne: vi.fn(),
  },
  Role: {},
  Customer: {},
}));

vi.mock('../../models/index.js', () => modelMocks);
vi.mock('../../lib/recaptcha.js', () => ({ verifyRecaptcha: vi.fn(async () => ({ ok: true })) }));
vi.mock('../../graphql/resolvers/auth/emailVerification.mutation.js', () => ({
  default: {},
  issueAndSendVerificationForUser: vi.fn(),
}));

describe('User resolvers integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('me throws UNAUTHENTICATED without context user', async () => {
    const { UserQuery } = await import('../../graphql/resolvers/user/query.js');
    await expect(UserQuery.me(null, {}, { user: null })).rejects.toThrow(GraphQLError);
  });

  it('me returns populated user when authenticated', async () => {
    const userDoc = { _id: 'u1', email: 'a@a.com', role: { slug: 'customer' } };
    modelMocks.User.findById.mockReturnValue({
      populate: () => ({ lean: async () => userDoc }),
    });

    const { UserQuery } = await import('../../graphql/resolvers/user/query.js');
    const result = await UserQuery.me(null, {}, { user: { id: '67a1f8f6a2df3b17f0c12345' } });
    expect(result).toEqual(userDoc);
  });

  it('login returns token and user roleName', async () => {
    const loginUser = {
      _id: '67a1f8f6a2df3b17f0c12345',
      passwordHash: 'hash',
      status: 'active',
      role: { slug: 'manager' },
      checkPassword: vi.fn(async () => true),
    };

    modelMocks.User.findOne.mockReturnValue({ populate: async () => loginUser });
    modelMocks.User.findById.mockReturnValue({
      populate: () => ({ lean: async () => ({ _id: loginUser._id, email: 'm@x.com', role: { slug: 'manager' } }) }),
    });

    const { UserMutation } = await import('../../graphql/resolvers/user/mutation.js');
    const result = await UserMutation.login(null, { email: 'm@x.com', password: 'secret' }, {});

    expect(result.user.roleName).toBe('manager');
    expect(typeof result.token).toBe('string');
  });
});
