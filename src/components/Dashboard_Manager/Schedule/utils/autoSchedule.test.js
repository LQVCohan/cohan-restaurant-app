import { describe, expect, it } from "vitest";

import { buildAutoSchedulePreview } from "./autoSchedule";

describe("buildAutoSchedulePreview", () => {
  it("filters overlapping shifts, leave/day-off conflicts, and weekly cap breaches before planning", () => {
    const assistant = {
      shifts: [
        {
          shiftKey: "2026-04-23|morning",
          date: "2026-04-23",
          shiftType: "morning",
          recommendedTotalStaff: 2,
          currentAssignedStaff: 0,
          status: "understaffed",
          severity: "high",
          confidence: 0.88,
          recommendedRoles: [
            { role: "server", required: 1, assigned: 0, delta: -1 },
            { role: "cook", required: 1, assigned: 0, delta: -1 },
          ],
          suggestedCandidates: [
            {
              staffId: "staff-overlap",
              fullName: "Server Overlap",
              role: "server",
              reason: "assistant recommendation",
            },
            {
              staffId: "staff-ok",
              fullName: "Server Available",
              role: "server",
              reason: "assistant recommendation",
            },
            {
              staffId: "staff-leave",
              fullName: "Cook On Leave",
              role: "cook",
              reason: "assistant recommendation",
            },
            {
              staffId: "staff-cap",
              fullName: "Cook Over Cap",
              role: "cook",
              reason: "assistant recommendation",
            },
            {
              staffId: "staff-offday",
              fullName: "Cook Off Day",
              role: "cook",
              reason: "assistant recommendation",
            },
          ],
        },
      ],
    };

    const staffList = [
      {
        id: "staff-overlap",
        fullName: "Server Overlap",
        department: "service",
        employmentStatus: "working",
        workingDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      },
      {
        id: "staff-ok",
        fullName: "Server Available",
        department: "service",
        employmentStatus: "working",
        workingDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      },
      {
        id: "staff-leave",
        fullName: "Cook On Leave",
        department: "kitchen",
        employmentStatus: "working",
        workingDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      },
      {
        id: "staff-cap",
        fullName: "Cook Over Cap",
        department: "kitchen",
        employmentStatus: "working",
        workingDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      },
      {
        id: "staff-offday",
        fullName: "Cook Off Day",
        department: "kitchen",
        employmentStatus: "working",
        workingDays: ["MON", "TUE", "WED"],
      },
    ];

    const existingShiftRows = [
      {
        id: "existing-1",
        employeeId: "staff-overlap",
        shiftType: "morning",
        startTime: "2026-04-23T06:00:00.000Z",
        endTime: "2026-04-23T14:00:00.000Z",
      },
      {
        id: "existing-2",
        employeeId: "staff-cap",
        shiftType: "afternoon",
        startTime: "2026-04-21T14:00:00.000Z",
        endTime: "2026-04-21T22:00:00.000Z",
      },
      {
        id: "existing-3",
        employeeId: "staff-cap",
        shiftType: "morning",
        startTime: "2026-04-22T06:00:00.000Z",
        endTime: "2026-04-22T14:00:00.000Z",
      },
      {
        id: "existing-4",
        employeeId: "staff-cap",
        shiftType: "evening",
        startTime: "2026-04-24T18:00:00.000Z",
        endTime: "2026-04-24T23:00:00.000Z",
      },
      {
        id: "existing-5",
        employeeId: "staff-cap",
        shiftType: "morning",
        startTime: "2026-04-25T06:00:00.000Z",
        endTime: "2026-04-25T14:00:00.000Z",
      },
      {
        id: "existing-6",
        employeeId: "staff-cap",
        shiftType: "afternoon",
        startTime: "2026-04-26T14:00:00.000Z",
        endTime: "2026-04-26T22:00:00.000Z",
      },
    ];

    const leaveRequests = [
      {
        id: "leave-1",
        employeeId: "staff-leave",
        startDate: "2026-04-23T00:00:00.000Z",
        endDate: "2026-04-23T00:00:00.000Z",
        startSession: "FULL",
        endSession: "FULL",
        status: "APPROVED",
      },
    ];

    const preview = buildAutoSchedulePreview({
      assistant,
      staffList,
      existingShiftRows,
      leaveRequests,
      weeklyHoursCap: 40,
      respectAvailability: true,
      avoidOvertime: true,
    });

    expect(preview.summary.recommendedAssignments).toBe(1);
    expect(preview.summary.blockedAssignments).toBe(3);

    const [shiftItem] = preview.items;
    expect(shiftItem.plannedAssignments).toHaveLength(1);
    expect(shiftItem.plannedAssignments[0].staffId).toBe("staff-ok");
    expect(shiftItem.unresolvedCount).toBe(1);
    expect(shiftItem.blockedCandidates.map((candidate) => candidate.staffId)).toEqual(
      expect.arrayContaining(["staff-leave", "staff-cap", "staff-offday"])
    );
  });
});
