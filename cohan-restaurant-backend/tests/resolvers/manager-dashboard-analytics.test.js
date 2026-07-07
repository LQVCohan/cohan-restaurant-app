import { describe, expect, it } from "vitest";
import {
  buildOccupancyHeatmap,
  buildStaffPerformance,
} from "../../graphql/resolvers/analytics/index.js";

describe("manager dashboard analytics", () => {
  it("averages dine-in occupancy by weekday and hour against active capacity", () => {
    const points = buildOccupancyHeatmap({
      periodStart: new Date("2026-04-06T00:00:00+07:00"),
      periodEnd: new Date("2026-04-19T23:59:59+07:00"),
      tables: [
        { capacity: 6, status: "available" },
        { capacity: 4, status: "occupied" },
        { capacity: 100, status: "offline" },
      ],
      orders: [
        {
          createdAt: "2026-04-06T18:00:00+07:00",
          guestCount: 5,
          orderType: "dine_in",
          currentStatus: "completed",
        },
        {
          createdAt: "2026-04-13T18:00:00+07:00",
          guestCount: 15,
          orderType: "dine_in",
          currentStatus: "served",
        },
        {
          createdAt: "2026-04-06T19:00:00+07:00",
          guestCount: 20,
          orderType: "dine_in",
          currentStatus: "cancelled",
        },
        {
          createdAt: "2026-04-07T18:00:00+07:00",
          guestCount: 20,
          orderType: "delivery",
          currentStatus: "completed",
        },
      ],
    });

    expect(points).toHaveLength(7);
    expect(points.find((point) => point.dayLabel === "T2")).toEqual({
      dayLabel: "T2",
      hourLabel: "18:00",
      occupancyRate: 1,
      staffRequired: 2,
    });
    expect(points.find((point) => point.dayLabel === "T3")).toEqual(
      expect.objectContaining({ occupancyRate: 0, staffRequired: 0 }),
    );
  });

  it("maps only the latest snapshot for each active employee", () => {
    const employee = {
      _id: "64b7f987f987f987f987f001",
      fullName: "Nguyễn An",
      positionTitle: "Phục vụ",
      employmentStatus: "working",
    };
    const rows = buildStaffPerformance([
      {
        employeeId: employee,
        finalPerformanceScore: 88,
        factors: { orderCount: 12 },
      },
      {
        employeeId: employee,
        finalPerformanceScore: 70,
        factors: { orderCount: 4 },
      },
      {
        employeeId: {
          _id: "64b7f987f987f987f987f002",
          fullName: "Trần Bình",
          department: "kitchen",
          employmentStatus: "on_leave",
        },
        finalPerformanceScore: 75,
        factors: { orderCount: 3 },
      },
      {
        employeeId: null,
        finalPerformanceScore: 99,
        factors: { orderCount: 99 },
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      staffId: "64b7f987f987f987f987f001",
      fullName: "Nguyễn An",
      role: "Phục vụ",
      status: "working",
      ordersHandled: 12,
      efficiency: 88,
    });
    expect(rows[1]).toEqual(
      expect.objectContaining({
        staffId: "64b7f987f987f987f987f002",
        status: "on_leave",
        ordersHandled: 3,
        efficiency: 75,
      }),
    );
  });
});
