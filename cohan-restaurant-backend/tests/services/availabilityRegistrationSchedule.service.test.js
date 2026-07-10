import { describe, expect, it } from "vitest";
import { buildAvailabilityRegistrationSchedule } from "../../src/services/availability/availabilityRegistrationSchedule.service.js";

describe("availability registration schedule", () => {
  it("keeps Monday-Sunday boundaries in Asia/Ho_Chi_Minh on a UTC server", () => {
    const result = buildAvailabilityRegistrationSchedule({
      targetWeekStart: "2026-07-12T17:00:00.000Z",
      targetWeekEnd: "2026-07-19T16:59:59.999Z",
      policy: {
        availabilityRegistrationPolicy: {
          availabilityRegistrationMode: "manual",
          availabilityOpenDayOffset: -7,
          availabilityOpenTime: "00:00",
          availabilityCloseDayOffset: -5,
          availabilityCloseTime: "23:59",
          timezone: "Asia/Ho_Chi_Minh",
        },
      },
    });

    expect(result.periodStart.toISOString()).toBe("2026-07-12T17:00:00.000Z");
    expect(result.periodEnd.toISOString()).toBe("2026-07-19T16:59:59.999Z");
    expect(result.openAt.toISOString()).toBe("2026-07-05T17:00:00.000Z");
    expect(result.closeAt.toISOString()).toBe("2026-07-08T16:59:00.000Z");
    expect(result.timezone).toBe("Asia/Ho_Chi_Minh");
  });

  it("uses the configured IANA timezone instead of the process timezone", () => {
    const result = buildAvailabilityRegistrationSchedule({
      targetWeekStart: "2026-07-13T00:00:00.000Z",
      targetWeekEnd: "2026-07-19T23:59:59.999Z",
      policy: {
        availabilityRegistrationPolicy: {
          availabilityRegistrationMode: "auto",
          availabilityOpenDayOffset: -1,
          availabilityOpenTime: "08:30",
          availabilityCloseDayOffset: 0,
          availabilityCloseTime: "09:00",
          timezone: "UTC",
        },
      },
    });

    expect(result.periodStart.toISOString()).toBe("2026-07-13T00:00:00.000Z");
    expect(result.periodEnd.toISOString()).toBe("2026-07-19T23:59:59.999Z");
    expect(result.openAt.toISOString()).toBe("2026-07-12T08:30:00.000Z");
    expect(result.closeAt.toISOString()).toBe("2026-07-13T09:00:00.000Z");
    expect(result.mode).toBe("auto");
  });

  it("rejects a close deadline that is not after opening", () => {
    expect(() =>
      buildAvailabilityRegistrationSchedule({
        targetWeekStart: "2026-07-13T00:00:00.000Z",
        targetWeekEnd: "2026-07-19T23:59:59.999Z",
        policy: {
          availabilityRegistrationPolicy: {
            availabilityOpenDayOffset: -1,
            availabilityOpenTime: "10:00",
            availabilityCloseDayOffset: -1,
            availabilityCloseTime: "09:00",
            timezone: "UTC",
          },
        },
      }),
    ).toThrow("Thời hạn đóng đăng ký phải sau thời gian mở đăng ký");
  });
});
