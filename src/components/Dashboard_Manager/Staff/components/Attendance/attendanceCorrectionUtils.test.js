import { describe, expect, it } from "vitest";
import {
  buildCreateCorrectionInput,
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

  it("prefers explicit record.timesheetId when building correction input", () => {
    expect(
      buildCreateCorrectionInput({
        record: {
          id: "507f1f77bcf86cd799439012",
          timesheetId: "507f1f77bcf86cd799439011",
          employeeId: "emp-1",
        },
        form: {
          correctionType: "wrong_check_in_out",
          reason: "  Camera confirmed  ",
          evidenceNote: "  lobby cam  ",
          evidenceUrlsText: "https://a.test\n",
        },
        restaurantId: "rest-1",
        workDate: "2026-05-11T00:00:00.000Z",
      }).timesheetId,
    ).toBe("507f1f77bcf86cd799439011");
  });

  it("falls back to record.id when timesheetId is absent", () => {
    expect(
      buildCreateCorrectionInput({
        record: {
          id: "507f1f77bcf86cd799439012",
          employeeId: "emp-1",
        },
        form: {
          correctionType: "wrong_check_in_out",
          reason: "Camera confirmed",
          evidenceUrlsText: "",
        },
        restaurantId: "rest-1",
        workDate: "2026-05-11T00:00:00.000Z",
      }).timesheetId,
    ).toBe("507f1f77bcf86cd799439012");
  });

  it("omits timesheetId when neither record.timesheetId nor id is ObjectId-like", () => {
    expect(
      buildCreateCorrectionInput({
        record: {
          id: "not-an-object-id",
          timesheetId: "invalid",
          employeeId: "emp-1",
        },
        form: {
          correctionType: "wrong_check_in_out",
          reason: "Camera confirmed",
          evidenceUrlsText: "",
        },
        restaurantId: "rest-1",
        workDate: "2026-05-11T00:00:00.000Z",
      }).timesheetId,
    ).toBeUndefined();
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