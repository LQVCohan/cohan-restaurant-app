import { describe, expect, it } from "vitest";
import { buildAvailabilityRegistrationSchedule } from "./availabilityRegistrationSchedule";

describe("availabilityRegistrationSchedule", () => {
  it("uses the policy timezone for week and deadline timestamps", () => {
    const result = buildAvailabilityRegistrationSchedule({
      targetWeekStart: "2026-07-12T17:00:00.000Z",
      targetWeekEnd: "2026-07-19T16:59:59.999Z",
      policy: {
        availabilityRegistrationMode: "manual",
        availabilityOpenDayOffset: -7,
        availabilityOpenTime: "00:00",
        availabilityCloseDayOffset: -5,
        availabilityCloseTime: "23:59",
        timezone: "Asia/Ho_Chi_Minh",
      },
    });

    expect(result.periodStart.toISOString()).toBe("2026-07-12T17:00:00.000Z");
    expect(result.periodEnd.toISOString()).toBe("2026-07-19T16:59:59.999Z");
    expect(result.openAt.toISOString()).toBe("2026-07-05T17:00:00.000Z");
    expect(result.closeAt.toISOString()).toBe("2026-07-08T16:59:00.000Z");
  });
});
