import { beforeEach, describe, expect, it, vi } from "vitest";

const stores = vi.hoisted(() => ({
  users: new Map(),
  lastMail: null,
  lastSms: null,
  auditEvents: [],
}));

class MockUserDoc {
  constructor(payload) {
    Object.assign(this, payload);
    this._id = payload._id || payload.id;
  }

  async save() {
    stores.users.set(String(this._id), this);
    return this;
  }

  populate() {
    return this;
  }

  async lean() {
    return { ...this, id: String(this._id) };
  }
}

const modelMocks = vi.hoisted(() => ({
  User: {
    findById: vi.fn((id) => stores.users.get(String(id)) || null),
    findOne: vi.fn((query) => ({
      lean: async () => {
        const [field] = Object.keys(query).filter((key) => key !== "_id");
        const value = query[field];
        const excluded = String(query._id?.$ne || "");
        return [...stores.users.values()].find((user) => String(user._id) !== excluded && user[field] === value) || null;
      },
    })),
    findByIdAndUpdate: vi.fn(),
  },
  Role: {},
  Customer: {},
  CustomerRankSetting: {},
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../lib/mailer.js", async () => {
  const actual = await vi.importActual("../../lib/mailer.js");
  return {
    ...actual,
    mailer: {
      sendMail: vi.fn(async (message) => {
        stores.lastMail = message;
        return { accepted: [message.to], rejected: [], messageId: "mail-1" };
      }),
    },
  };
});
vi.mock("../../src/services/notifications/sms.service.js", async () => {
  const actual = await vi.importActual("../../src/services/notifications/sms.service.js");
  return {
    ...actual,
    sendSms: vi.fn(async (message) => {
      stores.lastSms = message;
      return { provider: "mock", sent: true, skipped: false, messageId: "sms-1" };
    }),
  };
});
vi.mock("../../src/services/eventLog.service.js", () => ({
  logEvent: vi.fn(async (event) => {
    stores.auditEvents.push(event);
  }),
}));
vi.mock("../../lib/recaptcha.js", () => ({ verifyRecaptcha: vi.fn(async () => ({ ok: true })) }));
function addUser(payload) {
  const doc = new MockUserDoc({
    _id: payload._id,
    id: payload._id,
    fullName: payload.fullName || "Test User",
    email: payload.email || "old@example.com",
    phone: payload.phone || "0900000000",
    emailVerified: Boolean(payload.emailVerified),
    phoneVerified: Boolean(payload.phoneVerified),
    contactChangeOtp: payload.contactChangeOtp,
    role: { slug: "customer" },
  });
  stores.users.set(String(doc._id), doc);
  return doc;
}

function latestOtpFrom(text) {
  return String(text || "").match(/\b\d{6}\b/)?.[0] || "";
}

describe("contact change OTP", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    stores.users.clear();
    stores.lastMail = null;
    stores.lastSms = null;
    stores.auditEvents = [];
    process.env.CONTACT_CHANGE_OTP_TTL_MINUTES = "10";
    process.env.CONTACT_CHANGE_OTP_COOLDOWN_SECONDS = "60";
    process.env.CONTACT_CHANGE_OTP_MAX_ATTEMPTS = "5";
    process.env.CONTACT_CHANGE_OTP_LENGTH = "6";
    process.env.CONTACT_CHANGE_OTP_PEPPER = "test-pepper";
  });

  it("requests email OTP without storing or returning plaintext OTP", async () => {
    const user = addUser({ _id: "u1", email: "old@example.com" });
    const { requestContactChangeOtp } = await import("../../src/services/auth/contactChangeOtp.service.js");

    const result = await requestContactChangeOtp({ user, target: "EMAIL", value: "New@Example.com", ctx: { user } });
    const otp = latestOtpFrom(stores.lastMail?.text);

    expect(result).toMatchObject({ ok: true, target: "EMAIL", status: "SENT", maskedDestination: "n***@example.com" });
    expect(JSON.stringify(result)).not.toContain(otp);
    expect(user.contactChangeOtp.value).toBe("new@example.com");
    expect(user.contactChangeOtp.otpHash).toBeTruthy();
    expect(user.contactChangeOtp.otpHash).not.toBe(otp);
    expect(JSON.stringify(user.contactChangeOtp)).not.toContain(otp);
    expect(stores.auditEvents.at(-1).verb).toBe("account.contact_change_otp.request");
    expect(JSON.stringify(stores.auditEvents.at(-1))).not.toContain(otp);
  });

  it("confirms email OTP and clears pending state", async () => {
    const user = addUser({ _id: "u1", email: "old@example.com" });
    const { requestContactChangeOtp, confirmContactChangeOtp } = await import("../../src/services/auth/contactChangeOtp.service.js");

    await requestContactChangeOtp({ user, target: "EMAIL", value: "new@example.com", ctx: { user } });
    const otp = latestOtpFrom(stores.lastMail?.text);
    const saved = await confirmContactChangeOtp({ user, target: "EMAIL", otp, ctx: { user } });

    expect(saved.email).toBe("new@example.com");
    expect(user.emailVerified).toBe(true);
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(user.contactChangeOtp).toBeUndefined();
    expect(stores.auditEvents.at(-1).verb).toBe("account.contact_change.email_confirmed");
  });

  it("increments attempts for invalid email OTP without changing email", async () => {
    const user = addUser({ _id: "u1", email: "old@example.com" });
    const { requestContactChangeOtp, confirmContactChangeOtp } = await import("../../src/services/auth/contactChangeOtp.service.js");

    await requestContactChangeOtp({ user, target: "EMAIL", value: "new@example.com", ctx: { user } });
    await expect(confirmContactChangeOtp({ user, target: "EMAIL", otp: "000000", ctx: { user } })).rejects.toMatchObject({ extensions: { code: "INVALID_OTP" } });

    expect(user.email).toBe("old@example.com");
    expect(user.contactChangeOtp.attempts).toBe(1);
  });

  it("rejects expired OTP and clears pending state", async () => {
    const user = addUser({ _id: "u1", email: "old@example.com" });
    const { requestContactChangeOtp, confirmContactChangeOtp } = await import("../../src/services/auth/contactChangeOtp.service.js");

    await requestContactChangeOtp({ user, target: "EMAIL", value: "new@example.com", ctx: { user } });
    const otp = latestOtpFrom(stores.lastMail?.text);
    user.contactChangeOtp.expiresAt = new Date(Date.now() - 1000);

    await expect(confirmContactChangeOtp({ user, target: "EMAIL", otp, ctx: { user } })).rejects.toMatchObject({ extensions: { code: "CONTACT_CHANGE_OTP_EXPIRED" } });
    expect(user.contactChangeOtp).toBeUndefined();
  });

  it("locks after max invalid attempts", async () => {
    process.env.CONTACT_CHANGE_OTP_MAX_ATTEMPTS = "2";
    const user = addUser({ _id: "u1", email: "old@example.com" });
    const { requestContactChangeOtp, confirmContactChangeOtp } = await import("../../src/services/auth/contactChangeOtp.service.js");

    await requestContactChangeOtp({ user, target: "EMAIL", value: "new@example.com", ctx: { user } });
    await expect(confirmContactChangeOtp({ user, target: "EMAIL", otp: "000000", ctx: { user } })).rejects.toMatchObject({ extensions: { code: "INVALID_OTP" } });
    await expect(confirmContactChangeOtp({ user, target: "EMAIL", otp: "111111", ctx: { user } })).rejects.toMatchObject({ extensions: { code: "CONTACT_CHANGE_OTP_MAX_ATTEMPTS" } });
    expect(user.contactChangeOtp).toBeUndefined();
  });

  it("rejects duplicate email on request", async () => {
    const user = addUser({ _id: "u1", email: "old@example.com" });
    addUser({ _id: "u2", email: "used@example.com" });
    const { requestContactChangeOtp } = await import("../../src/services/auth/contactChangeOtp.service.js");

    await expect(requestContactChangeOtp({ user, target: "EMAIL", value: "used@example.com", ctx: { user } })).rejects.toMatchObject({ extensions: { code: "EMAIL_ALREADY_IN_USE" } });
  });

  it("requests and confirms phone OTP", async () => {
    const user = addUser({ _id: "u1", phone: "0900000000" });
    const { requestContactChangeOtp, confirmContactChangeOtp } = await import("../../src/services/auth/contactChangeOtp.service.js");

    const result = await requestContactChangeOtp({ user, target: "PHONE", value: "0912345678", ctx: { user } });
    const otp = latestOtpFrom(stores.lastSms?.text);
    await confirmContactChangeOtp({ user, target: "PHONE", otp, ctx: { user } });

    expect(result).toMatchObject({ ok: true, target: "PHONE", status: "SENT", maskedDestination: "******5678" });
    expect(user.phone).toBe("0912345678");
    expect(user.phoneVerified).toBe(true);
    expect(user.contactChangeOtp).toBeUndefined();
  });

  it("rejects duplicate phone on request", async () => {
    const user = addUser({ _id: "u1", phone: "0900000000" });
    addUser({ _id: "u2", phone: "0912345678" });
    const { requestContactChangeOtp } = await import("../../src/services/auth/contactChangeOtp.service.js");

    await expect(requestContactChangeOtp({ user, target: "PHONE", value: "0912345678", ctx: { user } })).rejects.toMatchObject({ extensions: { code: "PHONE_ALREADY_IN_USE" } });
  });

  it("returns COOLDOWN for repeated requests inside cooldown window", async () => {
    const user = addUser({ _id: "u1", email: "old@example.com" });
    const { requestContactChangeOtp } = await import("../../src/services/auth/contactChangeOtp.service.js");

    await requestContactChangeOtp({ user, target: "EMAIL", value: "new@example.com", ctx: { user } });
    const result = await requestContactChangeOtp({ user, target: "EMAIL", value: "another@example.com", ctx: { user } });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("COOLDOWN");
    expect(result.cooldownUntil).toBeInstanceOf(Date);
  });

  it("cancels pending contact change OTP", async () => {
    const user = addUser({ _id: "u1", email: "old@example.com" });
    const { requestContactChangeOtp, cancelContactChangeOtp } = await import("../../src/services/auth/contactChangeOtp.service.js");

    await requestContactChangeOtp({ user, target: "EMAIL", value: "new@example.com", ctx: { user } });
    await expect(cancelContactChangeOtp({ user, target: "EMAIL", ctx: { user } })).resolves.toBe(true);

    expect(user.contactChangeOtp).toBeUndefined();
    expect(stores.auditEvents.at(-1).verb).toBe("account.contact_change_otp.cancel");
  });

  it("requires authentication in resolver", async () => {
    const resolver = (await import("../../graphql/resolvers/auth/emailVerification.mutation.js")).default;
    await expect(resolver.requestContactChangeOtp(null, { input: { target: "EMAIL", value: "new@example.com" } }, { user: null })).rejects.toThrow("UNAUTHENTICATED");
  });

  it("blocks direct self-service phone updates through updateUser", async () => {
    const user = addUser({ _id: "u1", phone: "0900000000" });
    const { UserMutation } = await import("../../graphql/resolvers/user/mutation.js");

    await expect(UserMutation.updateUser(null, { input: { phone: "0912345678" } }, { user: { id: user._id } })).rejects.toMatchObject({ extensions: { code: "PHONE_CHANGE_REQUIRES_OTP" } });
  });
});
