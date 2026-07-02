import { GraphQLError } from 'graphql';

const modelMocks = vi.hoisted(() => ({
  User: {
    findById: vi.fn(),
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
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

  it('me returns sanitized populated user when authenticated', async () => {
    const userDoc = {
      _id: 'u1',
      email: 'a@a.com',
      role: { slug: 'customer' },
      passwordHash: 'hash',
      nationalId: 'secret-id',
      bankAccountNumber: 'secret-bank',
      noteInternal: 'hidden',
      lastLoginIp: '127.0.0.1',
      forcePasswordChange: true,
    };
    modelMocks.User.findById.mockReturnValue({
      populate: () => ({ lean: async () => userDoc }),
    });

    const { UserQuery } = await import('../../graphql/resolvers/user/query.js');
    const result = await UserQuery.me(null, {}, { user: { id: '67a1f8f6a2df3b17f0c12345' } });
    expect(result).toMatchObject({ id: 'u1', email: 'a@a.com', roleName: 'customer' });
    expect(result.passwordHash).toBeUndefined();
    expect(result.nationalId).toBeUndefined();
    expect(result.bankAccountNumber).toBeUndefined();
    expect(result.noteInternal).toBeUndefined();
    expect(result.lastLoginIp).toBeUndefined();
    expect(result.forcePasswordChange).toBeUndefined();
  });

  it('login normalizes username to lowercase before querying', async () => {
    const loginUser = {
      _id: '67a1f8f6a2df3b17f0c12345',
      passwordHash: 'hash',
      status: 'active',
      role: { slug: 'manager' },
      checkPassword: vi.fn(async () => true),
    };

    modelMocks.User.findOne.mockReturnValue({ populate: async () => loginUser });
    modelMocks.User.findById.mockReturnValue({
      populate: () => ({ lean: async () => ({ _id: loginUser._id, username: 'manager01', role: { slug: 'manager' } }) }),
    });

    const { UserMutation } = await import('../../graphql/resolvers/user/mutation.js');
    await UserMutation.login(null, { username: 'Manager01', password: 'secret' }, {});

    const queryArg = modelMocks.User.findOne.mock.calls[0][0];
    const usernameConditions = queryArg.$or.map((condition) => condition.username);

    expect(usernameConditions).toContain('manager01');

    const regexLikeCondition = usernameConditions.find((value) => {
      if (value instanceof RegExp) {
        return value.source.includes('manager01') && value.flags.includes('i');
      }
      if (value?.$regex instanceof RegExp) {
        return value.$regex.source.includes('manager01') && value.$regex.flags.includes('i');
      }
      if (typeof value?.$regex === 'string') {
        return value.$regex.includes('manager01') && String(value.$options || '').includes('i');
      }
      return false;
    });

    if (regexLikeCondition) {
      const usernameRegex =
        regexLikeCondition instanceof RegExp
          ? regexLikeCondition
          : regexLikeCondition.$regex;

      if (usernameRegex instanceof RegExp) {
        expect(usernameRegex.source).toContain('manager01');
        expect(usernameRegex.flags).toContain('i');
      } else {
        expect(String(usernameRegex)).toContain('manager01');
        expect(String(regexLikeCondition.$options || '')).toContain('i');
      }
    }
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


  it('users returns sanitized admin list items', async () => {
    const rawUsers = [{
      _id: '67a1f8f6a2df3b17f0c12345',
      email: 'admin-list@example.com',
      role: { slug: 'staff' },
      passwordHash: 'hash',
      emailVerifyToken: 'token',
      nationalId: 'identity',
      bankAccountNumber: 'bank',
      noteInternal: 'private',
      lastLoginIp: '10.0.0.1',
    }];
    modelMocks.User.find = vi.fn(() => ({
      populate: () => ({
        sort: () => ({ lean: async () => rawUsers }),
      }),
    }));

    const { UserQuery } = await import('../../graphql/resolvers/user/query.js');
    const result = await UserQuery.users(null, {}, { user: { id: 'admin', roleName: 'admin' } });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: '67a1f8f6a2df3b17f0c12345', email: 'ad***@example.com' });
    expect(result[0].passwordHash).toBeUndefined();
    expect(result[0].emailVerifyToken).toBeUndefined();
    expect(result[0].nationalId).toBeUndefined();
    expect(result[0].bankAccountNumber).toBeUndefined();
    expect(result[0].noteInternal).toBeUndefined();
    expect(result[0].lastLoginIp).toBeUndefined();
  });

  it('setUserStatus reloads the updated user with populated staff relations', async () => {
    const updatedUser = {
      _id: '67a1f8f6a2df3b17f0c12345',
      status: 'blocked',
    };
    const hydratedUser = {
      _id: updatedUser._id,
      status: 'blocked',
      role: { slug: 'staff' },
      refRestaurants: [{ id: 'r1', name: 'Main branch' }],
      primaryRestaurant: { id: 'r1', name: 'Main branch' },
    };

    modelMocks.User.findByIdAndUpdate.mockReturnValue({
      lean: async () => updatedUser,
    });
    modelMocks.User.findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: async () => hydratedUser,
    });

    const { UserMutation } = await import('../../graphql/resolvers/user/mutation.js');
    const result = await UserMutation.setUserStatus(
      null,
      { userId: updatedUser._id, status: 'blocked' },
      { user: { roleName: 'admin' } },
    );

    expect(modelMocks.User.findByIdAndUpdate).toHaveBeenCalledWith(
      updatedUser._id,
      { status: 'blocked' },
      { new: true },
    );
    expect(modelMocks.User.findById).toHaveBeenCalledWith(updatedUser._id);
    expect(result).toMatchObject({
      _id: updatedUser._id,
      id: updatedUser._id,
      status: "blocked",
      role: { slug: "staff" },
      roleName: "staff",
      refRestaurants: [{ id: "r1", name: "Main branch" }],
    });
    expect(result.primaryRestaurant).toBeUndefined();
  });
});
