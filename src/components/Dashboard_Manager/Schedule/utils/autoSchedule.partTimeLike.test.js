import { describe, expect, it } from "vitest";

import { buildAutoSchedulePreview } from "./autoSchedule";

const buildAssistant = (staffId, shiftType = "morning") => ({
  shifts: [
    {
      shiftKey: `2026-05-25|${shiftType}`,
      date: "2026-05-25",
      shiftType,
      recommendedTotalStaff: 1,
      currentAssignedStaff: 0,
      status: "understaffed",
      recommendedRoles: [{ role: "server", required: 1, assigned: 0, delta: -1 }],
      suggestedCandidates: [{ staffId, fullName: "Candidate", role: "server" }],
    },
  ],
});

const availabilityWindow = {
  id: "window-1",
  periodStart: "2026-05-25T00:00:00.000Z",
  periodEnd: "2026-05-31T23:59:59.999Z",
  status: "closed",
};

const buildStaff = (id, employmentType) => ({
  id,
  fullName: "Candidate",
  department: "service",
  employmentStatus: "working",
  employmentType,
  workingDays: ["TUE"],
});

const buildSubmission = (employeeId, shiftType = "morning") => ({
  availabilityWindowId: "window-1",
  employeeId,
  status: "approved",
  slots: [
    {
      date: "2026-05-25T00:00:00.000Z",
      shiftType,
      status: "available",
    },
  ],
});

describe("auto schedule part-time-like availability types", () => {
  it.each(["probation", "contract"])(
    "uses official availability slots and ignores Staff.workingDays for %s staff",
    (employmentType) => {
      const staffId = `${employmentType}-staff`;
      const preview = buildAutoSchedulePreview({
        assistant: buildAssistant(staffId),
        staffList: [buildStaff(staffId, employmentType)],
        availabilityWindows: [availabilityWindow],
        availabilitySubmissions: [buildSubmission(staffId)],
        now: new Date("2026-05-25T00:00:00.000Z"),
      });

      expect(preview.items[0].plannedAssignments.map((a) => a.staffId)).toContain(staffId);
      expect(preview.items[0].blockedCandidates).toHaveLength(0);
    },
  );

  it.each(["probation", "contract"])(
    "blocks %s staff outside official availability slots",
    (employmentType) => {
      const staffId = `${employmentType}-staff`;
      const preview = buildAutoSchedulePreview({
        assistant: buildAssistant(staffId),
        staffList: [buildStaff(staffId, employmentType)],
        availabilityWindows: [availabilityWindow],
        availabilitySubmissions: [buildSubmission(staffId, "afternoon")],
        now: new Date("2026-05-25T00:00:00.000Z"),
      });

      expect(preview.items[0].plannedAssignments).toHaveLength(0);
      expect(preview.items[0].blockedCandidates.map((c) => c.staffId)).toContain(staffId);
    },
  );
});
