import { beforeEach, describe, expect, it, vi } from "vitest";

const restaurantScopeMocks = vi.hoisted(() => ({
  canAccessRestaurant: vi.fn(async () => true),
  getStaffRestaurantIds: vi.fn(async () => []),
}));
const { store, mailerSendMail, eventLogCreate } = vi.hoisted(() => ({
  store: new Map(),
  mailerSendMail: vi.fn(),
  eventLogCreate: vi.fn(),
}));

class MockUser {
  constructor(doc) {
    Object.assign(this, doc);
    this._id = doc._id || doc.id;
  }
  async save() {
    store.set(String(this._id), { ...this });
    return this;
  }
  static async findById(id) {
    const doc = store.get(String(id));
    return doc ? new MockUser({ ...doc }) : null;
  }
  static async findOne(query) {
    for (const doc of store.values()) {
      const expField = Object.keys(query).find((key) => key.endsWith("TokenExp"));
      if (expField && !(doc[expField] > query[expField].$gt)) continue;
      const matched = query.$or?.some((part) => {
        const [key, value] = Object.entries(part)[0];
        return doc[key] === value;
      });
      if (matched) return new MockUser({ ...doc });
    }
    return null;
  }
  static async updateOne(filter, update) {
    const doc = store.get(String(filter._id));
    if (!doc) return { matchedCount: 0 };
    Object.assign(doc, update.$set || {});
    for (const key of Object.keys(update.$unset || {})) doc[key] = null;
    store.set(String(filter._id), doc);
    return { matchedCount: 1 };
  }
}

vi.mock("../../models/index.js", () => ({ User: MockUser, Restaurant: { exists: vi.fn() } }));
vi.mock("../../src/services/auth/restaurantScope.service.js", async (importOriginal) => ({
  ...(await importOriginal()),
  canAccessRestaurant: restaurantScopeMocks.canAccessRestaurant,
  getStaffRestaurantIds: restaurantScopeMocks.getStaffRestaurantIds,
}));
vi.mock("../../lib/mailer.js", () => ({
  mailer: { sendMail: mailerSendMail },
  buildVerifyMail: (args) => ({ to: args.to, subject: "verify", text: args.link, html: args.link }),
}));
vi.mock("../../models/event-log.model.js", () => ({ default: { create: eventLogCreate } }));

const servicePromise = import("../../src/services/auth/accountVerification.service.js");
const emailVerificationResolverPromise = import("../../graphql/resolvers/auth/emailVerification.mutation.js");

describe("accountVerification.service", () => {
  beforeEach(async () => {
    store.clear();
    mailerSendMail.mockReset();
    eventLogCreate.mockReset();
    restaurantScopeMocks.canAccessRestaurant.mockClear();
    restaurantScopeMocks.getStaffRestaurantIds.mockReset();
    restaurantScopeMocks.getStaffRestaurantIds.mockResolvedValue([]);
    const { Restaurant } = await import("../../models/index.js");
    Restaurant.exists.mockReset();
    Restaurant.exists.mockResolvedValue(true);
    process.env.ENABLE_EMAIL_VERIFICATION = "true";
    process.env.ENABLE_PHONE_VERIFICATION = "true";
    process.env.ENABLE_SMS_VERIFICATION = "true";
    process.env.SMS_PROVIDER = "mock";
    process.env.NODE_ENV = "test";
    process.env.VERIFICATION_RESEND_COOLDOWN_SECONDS = "60";
    process.env.ACCOUNT_ACTIVATION_REQUIRE = "email";
  });

  it("issues an email hash token and records last sent time", async () => {
    const service = await servicePromise;
    mailerSendMail.mockResolvedValue({ accepted: ["a@test.com"], rejected: [], messageId: "m1" });
    store.set("u1", { _id: "u1", email: "a@test.com", emailVerified: false, status: "pending" });

    const result = await service.issueVerificationForUser({ user: { _id: "u1" }, channels: "EMAIL" });
    const saved = store.get("u1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe("SENT");
    expect(saved.emailVerifyTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(saved.emailVerifyToken).toBeNull();
    expect(saved.emailVerifyTokenExp).toBeInstanceOf(Date);
    expect(saved.emailVerifyLastSentAt).toBeInstanceOf(Date);
  });

  it("returns cooldown without sending repeatedly", async () => {
    const service = await servicePromise;
    store.set("u1", {
      _id: "u1",
      email: "a@test.com",
      emailVerified: false,
      emailVerifyLastSentAt: new Date(),
    });

    const result = await service.issueVerificationForUser({ user: { _id: "u1" }, channels: "EMAIL" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("COOLDOWN");
    expect(result.email.cooldownUntil).toBeInstanceOf(Date);
    expect(mailerSendMail).not.toHaveBeenCalled();
  });

  it("returns NOT_CONFIGURED and ok=false when mailer skips delivery", async () => {
    const service = await servicePromise;
    mailerSendMail.mockResolvedValue({ accepted: [], rejected: ["a@test.com"], skipped: true, messageId: null });
    store.set("u1", { _id: "u1", email: "a@test.com", emailVerified: false });

    const result = await service.issueVerificationForUser({ user: { _id: "u1" }, channels: "EMAIL" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("NOT_CONFIGURED");
    expect(result.email.error).toBe("EMAIL_PROVIDER_NOT_CONFIGURED");
  });

  it("returns SKIPPED and ok=true only for disabled verification", async () => {
    const service = await servicePromise;
    process.env.ENABLE_EMAIL_VERIFICATION = "false";
    store.set("u1", { _id: "u1", email: "a@test.com", emailVerified: false });

    const result = await service.issueVerificationForUser({ user: { _id: "u1" }, channels: "EMAIL" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("SKIPPED");
    expect(result.email.error).toBe("EMAIL_VERIFICATION_DISABLED");
  });

  it("verifies a legacy raw email token, marks status verified, and activates pending account", async () => {
    const service = await servicePromise;
    store.set("u1", {
      _id: "u1",
      email: "a@test.com",
      emailVerified: false,
      emailVerifyToken: "raw-token",
      emailVerifyTokenExp: new Date(Date.now() + 60_000),
      verificationLastStatus: "sent",
      status: "pending",
    });

    await expect(service.verifyEmailToken("raw-token")).resolves.toBe(true);
    const saved = store.get("u1");
    expect(saved.emailVerified).toBe(true);
    expect(saved.emailVerifiedAt).toBeInstanceOf(Date);
    expect(saved.verificationLastStatus).toBe("verified");
    expect(saved.status).toBe("active");
    expect(eventLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      verb: "account.verification.email_verified",
      status: "success",
    }));
    expect(saved.emailVerifyToken).toBeNull();
    expect(saved.emailVerifyTokenExp).toBeNull();
  });

  it("does not auto-activate blocked accounts when token verifies", async () => {
    const service = await servicePromise;
    store.set("u1", {
      _id: "u1",
      email: "a@test.com",
      emailVerified: false,
      emailVerifyToken: "raw-token",
      emailVerifyTokenExp: new Date(Date.now() + 60_000),
      status: "blocked",
    });

    await expect(service.verifyEmailToken("raw-token")).resolves.toBe(true);

    expect(store.get("u1").emailVerified).toBe(true);
    expect(store.get("u1").verificationLastStatus).toBe("verified");
    expect(store.get("u1").status).toBe("blocked");
  });

  it("verifies a legacy raw phone token, marks status verified, and activates with any policy", async () => {
    const service = await servicePromise;
    process.env.ACCOUNT_ACTIVATION_REQUIRE = "any";
    store.set("u2", {
      _id: "u2",
      phone: "0901234567",
      phoneVerified: false,
      phoneVerifyToken: "phone-token",
      phoneVerifyTokenExp: new Date(Date.now() + 60_000),
      verificationLastStatus: "sent",
      status: "pending",
    });

    await expect(service.verifyPhoneToken("phone-token")).resolves.toBe(true);

    expect(store.get("u2").phoneVerified).toBe(true);
    expect(store.get("u2").verificationLastStatus).toBe("verified");
    expect(store.get("u2").status).toBe("active");
    expect(eventLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      verb: "account.verification.phone_verified",
      status: "success",
    }));
  });

  it("issues phone tokens with SMS mock provider", async () => {
    const service = await servicePromise;
    process.env.ACCOUNT_ACTIVATION_REQUIRE = "any";
    store.set("u2", { _id: "u2", phone: "0901234567", phoneVerified: false, status: "pending" });

    const result = await service.issueVerificationForUser({ user: { _id: "u2" }, channels: "SMS" });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("SENT");
    const savedAfterIssue = store.get("u2");
    expect(savedAfterIssue.phoneVerifyTokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns NOT_CONFIGURED for twilio placeholder without crashing", async () => {
    const service = await servicePromise;
    process.env.SMS_PROVIDER = "twilio";
    store.set("u2", { _id: "u2", phone: "0901234567", phoneVerified: false });

    const result = await service.issueVerificationForUser({ user: { _id: "u2" }, channels: "SMS" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("NOT_CONFIGURED");
    expect(result.sms.error).toBe("SMS_PROVIDER_NOT_CONFIGURED");
  });
});

describe("emailVerification resend scope", () => {
  it("allows manager for assigned staff from BrandMembership scope", async () => {
    restaurantScopeMocks.getStaffRestaurantIds.mockResolvedValue(["restaurant-b"]);
    const { assertCanResendForTarget } = await emailVerificationResolverPromise;
    await expect(assertCanResendForTarget(
      { user: { id: "manager-1", roleName: "manager" } },
      { _id: "staff-1", userType: "STAFF" },
    )).resolves.toBe(true);
    expect(restaurantScopeMocks.getStaffRestaurantIds).toHaveBeenCalledWith("staff-1");
    expect(restaurantScopeMocks.canAccessRestaurant).toHaveBeenCalledWith(
      expect.objectContaining({ id: "manager-1" }),
      "restaurant-b",
    );
  });

  it("does not use customer history as privileged scope", async () => {
    const { assertCanResendForTarget } = await emailVerificationResolverPromise;
    await expect(assertCanResendForTarget(
      { user: { id: "manager-1", roleName: "manager" } },
      { _id: "customer-1", userType: "CUSTOMER", refRestaurants: ["restaurant-b"] },
    )).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
  });

  it("denies non-admin manager from resending admin verification", async () => {
    const { assertCanResendForTarget } = await emailVerificationResolverPromise;
    await expect(assertCanResendForTarget(
      { user: { id: "manager-1", roleName: "manager" } },
      { _id: "admin-1", userType: "ADMIN", refRestaurants: ["restaurant-a"] },
    )).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
  });

  it("allows admin for users without restaurant scope", async () => {
    const { assertCanResendForTarget } = await emailVerificationResolverPromise;
    await expect(assertCanResendForTarget(
      { user: { id: "admin-1", roleName: "admin" } },
      { _id: "customer-1", userType: "CUSTOMER", refRestaurants: [] },
    )).resolves.toBe(true);
  });
});
