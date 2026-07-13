import { describe, expect, it } from "vitest";
import {
  STAFF_SCHEDULE_BLUEPRINTS,
  buildWeekShiftPlans,
  startOfWeekVietnam,
  weekRangeVietnam,
} from "../../scripts/seedScheduleCurrentAndPreviousWeek.js";

const reference = new Date("2026-07-14T02:00:00.000Z");
const staffByEmail = new Map(
  STAFF_SCHEDULE_BLUEPRINTS.map((item, index) => [
    item.email,
    { _id: `employee-${index + 1}`, email: item.email },
  ]),
);

describe("weekly work schedule seed", () => {
  it("uses Vietnam Monday-to-Sunday week boundaries", () => {
    const current = weekRangeVietnam(reference, 0);
    const previous = weekRangeVietnam(reference, -1);
    expect(startOfWeekVietnam(reference).toISOString()).toBe("2026-07-12T17:00:00.000Z");
    expect(current.periodEnd.toISOString()).toBe("2026-07-19T16:59:59.999Z");
    expect(previous.periodStart.toISOString()).toBe("2026-07-05T17:00:00.000Z");
  });

  it("creates 62 shifts covering all 14 employees", () => {
    const plans = buildWeekShiftPlans({
      staffByEmail,
      restaurantId: "restaurant-1",
      periodStart: weekRangeVietnam(reference, 0).periodStart,
      reference,
    });
    expect(plans).toHaveLength(62);
    expect(new Set(plans.map((item) => item.employeeId)).size).toBe(14);
    expect(plans.some((item) => item.shiftType === "morning")).toBe(true);
    expect(plans.some((item) => item.shiftType === "evening")).toBe(true);
    expect(plans.some((item) => item.status === "completed")).toBe(true);
    expect(plans.some((item) => item.status === "scheduled")).toBe(true);
  });

  it("marks all previous-week shifts completed", () => {
    const plans = buildWeekShiftPlans({
      staffByEmail,
      restaurantId: "restaurant-1",
      periodStart: weekRangeVietnam(reference, -1).periodStart,
      reference,
      previousWeek: true,
    });
    expect(plans).toHaveLength(62);
    expect(plans.every((item) => item.status === "completed")).toBe(true);
  });
});
