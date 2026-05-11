import { describe, expect, it } from "vitest";
import {
  buildEvidenceUrls,
  canCancelCorrection,
  canReviewCorrection,
  validateCorrectionRequestForm,
} from "./attendanceCorrectionUtils";

describe("attendanceCorrectionUtils", () => {
  it("allows reviewer roles to review corrections", () => {
    expect(canReviewCorrection({ roleName: "manager" })).toBe(true);
    expect(canReviewCorrection({ roleName: "hr" })).toBe(true);
    expect(canReviewCorrection({ roleName: "staff" })).toBe(false);
  });

  it("allows request owner to cancel only pending correction", () => {
    const user = { id: "user-1", roleName: "staff" };
    const pendingRequest = { status: "pending", requestedBy: "user-1" };
    const rejectedRequest = { status: "rejected", requestedBy: "user-1" };

    expect(canCancelCorrection(user, pendingRequest)).toBe(true);
    expect(canCancelCorrection(user, rejectedRequest)).toBe(false);
  });

  it("requires reason and at least one requested time", () => {
    expect(
      validateCorrectionRequestForm({
        reason: "",
        requestedCheckInAt: "",
        requestedCheckOutAt: "",
      }),
    ).toMatchObject({
      reason: expect.any(String),
      requestedTime: expect.any(String),
    });
  });

  it("blocks requested check-out earlier than check-in", () => {
    expect(
      validateCorrectionRequestForm({
        reason: "Quên check-out",
        requestedCheckInAt: "2026-05-11T09:00",
        requestedCheckOutAt: "2026-05-11T08:30",
      }),
    ).toMatchObject({
      requestedCheckOutAt: expect.any(String),
    });
  });

  it("splits evidence urls and removes blank lines", () => {
    expect(buildEvidenceUrls("https://a.test\n\n https://b.test ")).toEqual([
      "https://a.test",
      "https://b.test",
    ]);
  });
});