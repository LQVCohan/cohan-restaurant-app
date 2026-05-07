import { describe, it, expect } from "vitest";
import { deriveCandidateMatches, detectIdentityConflict } from "../posCustomerIdentity";

describe("posCustomerIdentity", () => {
  const candidates = [
    { id: "1", email: "a@test.com", phone: "0909 111 222" },
    { id: "2", email: "b@test.com", phone: "0909333444" },
  ];

  it("detects same candidate for email+phone", () => {
    const m = deriveCandidateMatches(candidates, { email: "A@test.com", phone: "0909111222" });
    expect(m.sameCandidate?.id).toBe("1");
    expect(detectIdentityConflict(m.byEmail[0], m.byPhone[0])).toBe(false);
  });

  it("detects conflict for different email/phone owner", () => {
    const m = deriveCandidateMatches(candidates, { email: "a@test.com", phone: "0909333444" });
    expect(detectIdentityConflict(m.byEmail[0], m.byPhone[0])).toBe(true);
  });
});
