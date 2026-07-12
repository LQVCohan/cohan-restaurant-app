import { describe, expect, it } from "vitest";
import Timesheet from "../../models/timesheet.model.js";

describe("Timesheet attendance invariants", () => {
  it("accepts the off-schedule absent status produced by the shared calculator", () => {
    const statusPath = Timesheet.schema.path("status");

    expect(statusPath.enumValues).toContain("unscheduled_absent");
  });

  it("maps the legacy overtime completion note to the persisted review note", () => {
    const row = new Timesheet({
      employeeId: "507f1f77bcf86cd799439011",
      restaurantId: "507f1f77bcf86cd799439012",
      workDate: new Date("2026-07-12T00:00:00.000Z"),
    });

    row.overtimeApprovalNote = "Duyệt theo yêu cầu tăng ca";

    expect(row.overtimeReviewNote).toBe("Duyệt theo yêu cầu tăng ca");
    expect(row.overtimeApprovalNote).toBe("Duyệt theo yêu cầu tăng ca");
  });
});
