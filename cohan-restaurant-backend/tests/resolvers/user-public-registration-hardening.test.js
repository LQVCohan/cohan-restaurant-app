import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  User: { find: vi.fn(), findOne: vi.fn(), findById: vi.fn() },
  Role: { findOne: vi.fn() },
  Customer: vi.fn(),
  CustomerRankSetting: {},
  WalletTransaction: {},
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../lib/passwordPolicy.js", () => ({ validatePasswordStrong: vi.fn(() => ({ ok: true })) }));
vi.mock("../../lib/recaptcha.js", () => ({ verifyRecaptcha: vi.fn(async () => ({ ok: true })) }));
vi.mock("../../graphql/resolvers/auth/emailVerification.mutation.js", () => ({ default: {}, issueAndSendVerificationForUser: vi.fn(async () => true) }));

function chain(res) { return { select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(res), populate: vi.fn().mockReturnThis() }; }

describe("public createUser hardening", () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    process.env.ENABLE_RECAPTCHA = "false";
    process.env.ENABLE_EMAIL_VERIFICATION = "false";
    modelMocks.Role.findOne.mockReturnValue(chain({ _id: "role-customer" }));
    modelMocks.User.find.mockReturnValue(chain([]));
    modelMocks.User.findOne.mockReturnValue(chain(null));
    modelMocks.User.findById.mockReturnValue(chain({ _id: "u1", email: "a@b.com", role: { slug: "customer" } }));
    modelMocks.Customer.mockImplementation(function Customer(payload){ Object.assign(this,payload); this._id="u1"; this.setPassword=vi.fn(async()=>true); this.save=vi.fn(async()=>true);});
  });

  it("ignores privileged role input and enforces customer role", async () => {
    const { UserMutation } = await import("../../graphql/resolvers/user/mutation.js");
    await UserMutation.createUser(null, { input: { fullName: "Test", email: "a@b.com", password: "StrongP@ssw0rd", roleId: "admin-role", status: "inactive", provider: "oauth" } }, {});
    expect(modelMocks.Customer).toHaveBeenCalledWith(expect.objectContaining({ role: "role-customer", provider: "local", status: "active", userType: "CUSTOMER" }));
  });
});
