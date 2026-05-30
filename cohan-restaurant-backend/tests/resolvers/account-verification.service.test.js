import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("../../models/index.js", () => ({ User: MockUser }));
vi.mock("../../lib/mailer.js", () => ({
  mailer: { sendMail: mailerSendMail },
  buildVerifyMail: (args) => ({ to: args.to, subject: "verify", text: args.link, html: args.link }),
}));
vi.mock("../../models/event-log.model.js", () => ({ default: { create: eventLogCreate } }));

const servicePromise = import("../../src/services/auth/accountVerification.service.js");

describe("accountVerification.service", () => {
  beforeEach(() => {
    store.clear();
    mailerSendMail.mockReset();
    eventLogCreate.mockReset();
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

    expect(result.status).toBe("COOLDOWN");
    expect(result.email.cooldownUntil).toBeInstanceOf(Date);
    expect(mailerSendMail).not.toHaveBeenCalled();
  });

  it("verifies a legacy raw email token and activates a pending account", async () => {
    const service = await servicePromise;
    store.set("u1", {
      _id: "u1",
      email: "a@test.com",
      emailVerified: false,
      emailVerifyToken: "raw-token",
      emailVerifyTokenExp: new Date(Date.now() + 60_000),
      status: "pending",
    });

    await expect(service.verifyEmailToken("raw-token")).resolves.toBe(true);
    const saved = store.get("u1");
    expect(saved.emailVerified).toBe(true);
    expect(saved.emailVerifiedAt).toBeInstanceOf(Date);
    expect(saved.status).toBe("active");
    expect(saved.emailVerifyToken).toBeNull();
    expect(saved.emailVerifyTokenExp).toBeNull();
  });

  it("issues and verifies phone tokens with SMS mock provider", async () => {
    const service = await servicePromise;
    process.env.ACCOUNT_ACTIVATION_REQUIRE = "any";
    store.set("u2", { _id: "u2", phone: "0901234567", phoneVerified: false, status: "pending" });

    const result = await service.issueVerificationForUser({ user: { _id: "u2" }, channels: "SMS" });
    expect(result.status).toBe("SENT");
    const savedAfterIssue = store.get("u2");
    expect(savedAfterIssue.phoneVerifyTokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
