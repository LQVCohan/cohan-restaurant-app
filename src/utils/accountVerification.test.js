import { describe, expect, it } from "vitest";
import { verificationLabel, verificationStatus } from "./accountVerification";

describe("accountVerification helpers", () => {
  it("returns a canonical verified status for email verified accounts", () => {
    expect(verificationStatus({ email: "a@test.com", emailVerified: true })).toBe("verified");
    expect(verificationLabel({ email: "a@test.com", emailVerified: true })).toBe("Đã xác minh email");
  });

  it("keeps channel-specific labels while status remains canonical", () => {
    expect(verificationStatus({ phone: "0901234567", phoneVerified: true })).toBe("verified");
    expect(verificationLabel({ phone: "0901234567", phoneVerified: true })).toBe("Đã xác minh SĐT");
  });

  it("reports missing contact separately from unverified", () => {
    expect(verificationStatus({ status: "active" })).toBe("missing_contact");
    expect(verificationLabel({ status: "active" })).toBe("Thiếu email/SĐT");
  });
});
