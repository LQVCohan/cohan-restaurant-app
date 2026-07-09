import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSmsConfigured, sendSms } from "../../src/services/notifications/sms.service.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalSmsProvider = process.env.SMS_PROVIDER;

describe("sms.service", () => {
  beforeEach(() => {
    process.env.SMS_PROVIDER = "mock";
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalSmsProvider === undefined) delete process.env.SMS_PROVIDER;
    else process.env.SMS_PROVIDER = originalSmsProvider;
    vi.restoreAllMocks();
  });

  it("does not report mock SMS as delivered outside tests", async () => {
    process.env.NODE_ENV = "development";
    const log = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await sendSms({ to: "0364821047", text: "Cohan test" });

    expect(isSmsConfigured()).toBe(false);
    expect(result).toMatchObject({
      provider: "mock",
      sent: false,
      skipped: true,
      error: "SMS_PROVIDER_MOCK_ONLY",
    });
    expect(log).toHaveBeenCalledWith("[SMS mock] to=******1047 message=Cohan test");
  });

  it("keeps mock SMS usable as a fake provider in tests", async () => {
    process.env.NODE_ENV = "test";
    const log = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await sendSms({ to: "0364821047", text: "Cohan test" });

    expect(isSmsConfigured()).toBe(true);
    expect(result).toMatchObject({ provider: "mock", sent: true, skipped: false });
    expect(result.messageId).toMatch(/^mock-/);
    expect(log).toHaveBeenCalledWith("[SMS mock] to=******1047 message=Cohan test");
  });
});
