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

  it("prioritizes staff with submitted availability over part-time staff without the slot", () => {
    const assistant = {
      shifts: [
        {
          shiftKey: "2026-04-23|morning",
          date: "2026-04-23",
          shiftType: "morning",
          recommendedTotalStaff: 1,
          currentAssignedStaff: 0,
          status: "understaffed",
          severity: "high",
          confidence: 0.9,
          recommendedRoles: [
            { role: "server", required: 1, assigned: 0, delta: -1 },
          ],
          suggestedCandidates: [
            {
              staffId: "part-time-no-slot",
              fullName: "Part Time No Slot",
              role: "server",
              reason: "assistant recommendation",
            },
            {
              staffId: "full-time-available",
              fullName: "Full Time Available",
              role: "server",
              reason: "assistant recommendation",
            },
          ],
        },
      ],
    };

    const staffList = [
      {
        id: "part-time-no-slot",
        fullName: "Part Time No Slot",
        department: "service",
        employmentStatus: "working",
        employmentType: "part_time",
        workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
      },
      {
        id: "full-time-available",
        fullName: "Full Time Available",
        department: "service",
        employmentStatus: "working",
        employmentType: "full_time",
        workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
      },
    ];

    const preview = buildAutoSchedulePreview({
      assistant,
      staffList,
      availabilityWindows: [
        {
          id: "window-1",
          periodStart: "2026-04-20T00:00:00.000Z",
          periodEnd: "2026-04-26T23:59:59.999Z",
          closeAt: "2026-04-22T23:59:59.999Z",
          status: "closed",
        },
      ],
      availabilitySubmissions: [
        {
          availabilityWindowId: "window-1",
          employeeId: "part-time-no-slot",
          employmentType: "part_time",
          submissionType: "weekly_availability",
          status: "locked",
          slots: [
            {
              date: "2026-04-23T00:00:00.000Z",
              shiftType: "afternoon",
              status: "available",
            },
          ],
        },
      ],
      weeklyHoursCap: 40,
      respectAvailability: true,
      avoidOvertime: true,
      now: new Date("2026-04-23T00:00:00.000Z"),
    });

    const [shiftItem] = preview.items;
    expect(shiftItem.plannedAssignments).toHaveLength(1);
    expect(shiftItem.plannedAssignments[0].staffId).toBe(
      "full-time-available",
    );
  });
});

it("blocks part-time staff without approved availability slot when no fallback exists", () => {
  const assistant = {
    shifts: [
      {
        shiftKey: "2026-04-24|morning",
        date: "2026-04-24",
        shiftType: "morning",
        recommendedTotalStaff: 1,
        currentAssignedStaff: 0,
        status: "understaffed",
        recommendedRoles: [{ role: "server", required: 1, assigned: 0, delta: -1 }],
        suggestedCandidates: [
          {
            staffId: "pt-only",
            fullName: "Part Time Only",
            role: "server",
          },
        ],
      },
    ],
  };

  const preview = buildAutoSchedulePreview({
    assistant,
    staffList: [
      {
        id: "pt-only",
        fullName: "Part Time Only",
        department: "service",
        employmentStatus: "working",
        employmentType: "part_time",
        workingDays: ["THU"],
      },
    ],
    availabilityWindows: [
      {
        id: "window-pt",
        periodStart: "2026-04-20T00:00:00.000Z",
        periodEnd: "2026-04-26T23:59:59.999Z",
        status: "closed",
      },
    ],
    availabilitySubmissions: [
      {
        availabilityWindowId: "window-pt",
        employeeId: "pt-only",
        status: "locked",
        slots: [
          {
            date: "2026-04-24T00:00:00.000Z",
            shiftType: "afternoon",
            status: "available",
          },
        ],
      },
    ],
    now: new Date("2026-04-24T00:00:00.000Z"),
  });

  const [shiftItem] = preview.items;
  expect(shiftItem.plannedAssignments).toHaveLength(0);
  expect(shiftItem.unfilledRoles[0].unresolved).toBeGreaterThan(0);
  expect(shiftItem.blockedCandidates.map((c) => c.staffId)).toContain("pt-only");
  expect(shiftItem.blockedCandidates[0].reason).toContain("part-time");
});

it("does not block part-time staff by Staff.workingDays when official availability slot exists", () => {
  const assistant = {
    shifts: [
      {
        shiftKey: "2026-04-23|morning",
        date: "2026-04-23",
        shiftType: "morning",
        recommendedTotalStaff: 1,
        currentAssignedStaff: 0,
        status: "understaffed",
        recommendedRoles: [{ role: "server", required: 1, assigned: 0, delta: -1 }],
        suggestedCandidates: [{ staffId: "pt-thu", fullName: "PT Thu", role: "server" }],
      },
    ],
  };

  const preview = buildAutoSchedulePreview({
    assistant,
    staffList: [
      {
        id: "pt-thu",
        fullName: "PT Thu",
        department: "service",
        employmentStatus: "working",
        employmentType: "part_time",
        workingDays: ["MON"],
      },
    ],
    availabilityWindows: [
      {
        id: "window-thu",
        periodStart: "2026-04-20T00:00:00.000Z",
        periodEnd: "2026-04-26T23:59:59.999Z",
        status: "closed",
      },
    ],
    availabilitySubmissions: [
      {
        availabilityWindowId: "window-thu",
        employeeId: "pt-thu",
        status: "approved",
        slots: [{ date: "2026-04-23T00:00:00.000Z", shiftType: "morning", status: "available" }],
      },
    ],
  });

  const [shiftItem] = preview.items;
  expect(shiftItem.plannedAssignments.map((a) => a.staffId)).toContain("pt-thu");
  expect(
    shiftItem.blockedCandidates.some((c) => c.reason.includes("workingDays")),
  ).toBe(false);
});

it("uses official slots for late_change_requested but ignores pendingSlots", () => {
  const baseAssistant = {
    shifts: [
      {
        shiftKey: "2026-04-25|morning",
        date: "2026-04-25",
        shiftType: "morning",
        recommendedTotalStaff: 1,
        currentAssignedStaff: 0,
        status: "understaffed",
        recommendedRoles: [{ role: "server", required: 1, assigned: 0, delta: -1 }],
        suggestedCandidates: [{ staffId: "pt-late", fullName: "PT Late", role: "server" }],
      },
    ],
  };

  const common = {
    assistant: baseAssistant,
    staffList: [
      {
        id: "pt-late",
        fullName: "PT Late",
        department: "service",
        employmentStatus: "working",
        employmentType: "part_time",
      },
    ],
    availabilityWindows: [
      {
        id: "window-late",
        periodStart: "2026-04-20T00:00:00.000Z",
        periodEnd: "2026-04-26T23:59:59.999Z",
        status: "closed",
      },
    ],
  };

  const partA = buildAutoSchedulePreview({
    ...common,
    availabilitySubmissions: [
      {
        availabilityWindowId: "window-late",
        employeeId: "pt-late",
        status: "late_change_requested",
        slots: [{ date: "2026-04-25T00:00:00.000Z", shiftType: "morning", status: "available" }],
        pendingSlots: [{ date: "2026-04-25T00:00:00.000Z", shiftType: "afternoon", status: "available" }],
      },
    ],
  });
  expect(partA.items[0].plannedAssignments).toHaveLength(1);
  expect(partA.items[0].plannedAssignments[0].validationWarnings[0].code).toBe(
    "LATE_AVAILABILITY_CHANGE_PENDING",
  );

  const partB = buildAutoSchedulePreview({
    ...common,
    availabilitySubmissions: [
      {
        availabilityWindowId: "window-late",
        employeeId: "pt-late",
        status: "late_change_requested",
        slots: [{ date: "2026-04-25T00:00:00.000Z", shiftType: "afternoon", status: "available" }],
        pendingSlots: [{ date: "2026-04-25T00:00:00.000Z", shiftType: "morning", status: "available" }],
      },
    ],
  });
  expect(partB.items[0].plannedAssignments).toHaveLength(0);
  expect(partB.items[0].blockedCandidates.map((c) => c.staffId)).toContain("pt-late");
});

it("blocks full-time unavailable exception", () => {
  const preview = buildAutoSchedulePreview({
    assistant: {
      shifts: [
        {
          shiftKey: "2026-04-26|morning",
          date: "2026-04-26",
          shiftType: "morning",
          recommendedTotalStaff: 1,
          currentAssignedStaff: 0,
          status: "understaffed",
          recommendedRoles: [{ role: "server", required: 1, assigned: 0, delta: -1 }],
          suggestedCandidates: [{ staffId: "ft-block", fullName: "FT Block", role: "server" }],
        },
      ],
    },
    staffList: [
      {
        id: "ft-block",
        fullName: "FT Block",
        department: "service",
        employmentStatus: "working",
        employmentType: "full_time",
      },
    ],
    availabilityWindows: [
      {
        id: "window-ft",
        periodStart: "2026-04-20T00:00:00.000Z",
        periodEnd: "2026-04-26T23:59:59.999Z",
        status: "closed",
      },
    ],
    availabilitySubmissions: [
      {
        availabilityWindowId: "window-ft",
        employeeId: "ft-block",
        status: "approved",
        submissionType: "unavailable_exception",
        slots: [{ date: "2026-04-26T00:00:00.000Z", shiftType: "morning", status: "unavailable" }],
      },
    ],
  });

  expect(preview.items[0].plannedAssignments).toHaveLength(0);
  expect(preview.items[0].blockedCandidates.map((c) => c.staffId)).toContain("ft-block");
});
