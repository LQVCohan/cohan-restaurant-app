import { print } from "graphql";
import { describe, expect, it } from "vitest";
import resolvers from "../../graphql/resolvers/index.js";
import typeDefs from "../../graphql/schema/index.js";
import {
  buildStatusCounts,
  getDashboardRanges,
} from "../../graphql/resolvers/dashboard/index.js";

describe("manager dashboard GraphQL contract", () => {
  it("registers the managerDashboard query and analytics field resolvers", () => {
    const schemaSource = print(typeDefs);

    expect(schemaSource).toContain(
      "managerDashboard(restaurantId: ID!, range: String): ManagerDashboard",
    );
    expect(typeof resolvers.Query.managerDashboard).toBe("function");
    expect(resolvers.ManagerDashboard).toEqual(
      expect.objectContaining({
        feedbackSummary: expect.any(Function),
        feedbackItems: expect.any(Function),
        occupancyHeatmap: expect.any(Function),
        staffPerformance: expect.any(Function),
      }),
    );
  });

  it("creates complete seven-day and thirty-day ranges", () => {
    const now = new Date("2026-06-22T10:00:00.000Z");
    const week = getDashboardRanges("week", now);
    const month = getDashboardRanges("month", now);

    expect(week.days).toBe(7);
    expect(month.days).toBe(30);
    expect(week.currentEnd.getTime()).toBeGreaterThan(
      week.currentStart.getTime(),
    );
    expect(week.previousEnd.getTime()).toBeLessThan(
      week.currentStart.getTime(),
    );
  });

  it("groups order statuses into dashboard categories", () => {
    expect(
      buildStatusCounts([
        { currentStatus: "pending" },
        { currentStatus: "confirmed" },
        { currentStatus: "preparing" },
        { currentStatus: "ready" },
        { currentStatus: "completed" },
        { currentStatus: "cancelled" },
      ]),
    ).toEqual({
      pending: 2,
      preparing: 2,
      completed: 1,
      cancelled: 1,
    });
  });
});
