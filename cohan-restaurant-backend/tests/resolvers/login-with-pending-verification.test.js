import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  User: {
    findOne: vi.fn(),
    findById: vi.fn(),
  },
  verifyRecaptcha: vi.fn(),
  getLoginAttemptState: vi.fn(),
  recordFailedLoginAttempt: vi.fn(),
  resetLoginAttempts: vi.fn(),
  logAuthAuditEvent: vi.fn(),
  issueRefreshToken: vi.fn(),
  signAccessToken: vi.fn(),
  sanitizeUserForClient: vi.fn(),
}));

vi.mock("../../models/index.js", () => ({ User: mocks.User }));
vi.mock("../../lib/recaptcha.js", () => ({ verifyRecaptcha: mocks.verifyRecaptcha }));
vi.mock("../../src/security/loginSecurity.js", () => ({
  getLoginAttemptState: mocks.getLoginAttemptState,
  recordFailedLoginAttempt: mocks.recordFailedLoginAttempt,
  resetLoginAttempts: mocks.resetLoginAttempts,
  logAuthAuditEvent: mocks.logAuthAuditEvent,
}));
vi.mock("../../src/security/authTokens.js", () => ({
  issueRefreshToken: mocks.issueRefreshToken,
  signAccessToken: mocks.signAccessToken,
}));
vi.mock("../../src/security/sanitizeUserForClient.js", () => ({
  sanitizeUserForClient: mocks.sanitizeUserForClient,
}));

import { loginWithPendingVerification } from "../../graphql/resolvers/user/loginWithPendingVerification.mutation.js";

function userDocument(overrides = {}) {
  return {
    _id: "user-1",
    email: "pal@cohan.local",
    status: "pending",
    emailVerified: false,
    phoneVerified: false,
    verifiedAt: null,
    passwordHash: "hash",
    role: { slug: "manager" },
    checkPassword: vi.fn().mockResolvedValue(true),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockUserLookup(user) {
  mocks.User.findOne.mockReturnValue({
    populate: vi.fn().mockResolvedValue(user),
  });
  mocks.User.findById.mockReturnValue({
    populate: vi.fn().mockReturnValue({
      lean: vi.fn().mockImplementation(async () => ({
        ...user,
        role: { slug: "manager" },
      })),
    }),
  });
}

describe("loginWithPendingVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_RECAPTCHA = "false";
    process.env.ACCOUNT_ACTIVATION_REQUIRE = "email";
    mocks.getLoginAttemptState.mockReturnValue({ blocked: false });
    mocks.recordFailedLoginAttempt.mockReturnValue({ attempts: 1 });
    mocks.signAccessToken.mockReturnValue("access-token");
    mocks.sanitizeUserForClient.mockImplementation((user) => ({
      id: String(user._id),
      email: user.email,
      status: user.status,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      roleName: user.roleName,
    }));
  });

  it("activates a verified pending account before issuing the login payload", async () => {
    const user = userDocument({ emailVerified: true });
    mockUserLookup(user);

    const result = await loginWithPendingVerification(
      null,
      { email: user.email, password: "correct-password" },
      { request: { ip: "127.0.0.1", headers: {} } },
    );

    expect(user.save).toHaveBeenCalledOnce();
    expect(user.status).toBe("active");
    expect(user.verifiedAt).toBeInstanceOf(Date);
    expect(result).toMatchObject({
      token: "access-token",
      user: { status: "active", emailVerified: true },
    });
    expect(mocks.logAuthAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      "login_success",
      expect.objectContaining({ status: "active" }),
    );
  });

  it("keeps an unverified pending account on the verification-session path", async () => {
    const user = userDocument();
    mockUserLookup(user);

    const result = await loginWithPendingVerification(
      null,
      { email: user.email, password: "correct-password" },
      { request: { ip: "127.0.0.1", headers: {} } },
    );

    expect(user.save).not.toHaveBeenCalled();
    expect(result.user.status).toBe("pending");
    expect(mocks.logAuthAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      "login_pending_verification",
      expect.objectContaining({ status: "pending" }),
    );
  });

  it("still rejects blocked accounts even when their email is verified", async () => {
    const user = userDocument({ status: "blocked", emailVerified: true });
    mockUserLookup(user);

    await expect(
      loginWithPendingVerification(
        null,
        { email: user.email, password: "correct-password" },
        { request: { ip: "127.0.0.1", headers: {} } },
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });

    expect(user.save).not.toHaveBeenCalled();
  });
});
