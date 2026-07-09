import { describe, expect, it, vi, beforeEach } from "vitest";

const modelMocks = vi.hoisted(() => ({
  User: {
    findOne: vi.fn(),
    findById: vi.fn(),
  },
}));

const serviceMocks = vi.hoisted(() => ({
  issueVerificationForUser: vi.fn(),
  resendAccountVerification: vi.fn(),
  verifyEmailToken: vi.fn(),
  verifyPhoneToken: vi.fn(),
  verifyAnyToken: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(),
}));
vi.mock("../../utils/authz.js", () => ({ hasRole: vi.fn(() => false) }));
vi.mock("../../src/services/auth/accountVerification.service.js", () => serviceMocks);
vi.mock("../../src/services/auth/contactChangeOtp.service.js", () => ({
  requestContactChangeOtp: vi.fn(),
  confirmContactChangeOtp: vi.fn(),
  cancelContactChangeOtp: vi.fn(),
}));

describe("email verification resend resolver", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("resendSmsVerification sends SMS verification by normalized phone", async () => {
    const user = { _id: "u1", phone: "0912345678", phoneVerified: false };
    modelMocks.User.findOne.mockResolvedValue(user);
    serviceMocks.issueVerificationForUser.mockResolvedValue({
      status: "SENT",
      sms: { status: "SENT" },
    });

    const { default: resolver } = await import("../../graphql/resolvers/auth/emailVerification.mutation.js");
    const result = await resolver.resendSmsVerification(null, { phone: "+84912345678" }, { requestId: "req-1" });

    expect(result).toBe(true);
    expect(modelMocks.User.findOne).toHaveBeenCalledWith({ phone: "0912345678" });
    expect(serviceMocks.issueVerificationForUser).toHaveBeenCalledWith({
      user,
      channels: "SMS",
      reason: "resend",
      ctx: { requestId: "req-1" },
    });
  });

  it("resendSmsVerification returns public success when phone is unknown", async () => {
    modelMocks.User.findOne.mockResolvedValue(null);

    const { default: resolver } = await import("../../graphql/resolvers/auth/emailVerification.mutation.js");
    const result = await resolver.resendSmsVerification(null, { phone: "0900000000" }, {});

    expect(result).toBe(true);
    expect(serviceMocks.issueVerificationForUser).not.toHaveBeenCalled();
  });

  it("resendSmsVerification surfaces SMS provider configuration errors", async () => {
    modelMocks.User.findOne.mockResolvedValue({ _id: "u1", phone: "0900000000", phoneVerified: false });
    serviceMocks.issueVerificationForUser.mockResolvedValue({
      status: "NOT_CONFIGURED",
      sms: { status: "NOT_CONFIGURED", provider: "mock", error: "SMS_PROVIDER_NOT_CONFIGURED" },
    });

    const { default: resolver } = await import("../../graphql/resolvers/auth/emailVerification.mutation.js");
    await expect(resolver.resendSmsVerification(null, { phone: "0900000000" }, {})).rejects.toMatchObject({
      extensions: { code: "SMS_PROVIDER_NOT_CONFIGURED" },
    });
  });
});