import { print } from "graphql";
import { describe, expect, it } from "vitest";
import resolvers from "../../graphql/resolvers/index.js";
import typeDefs from "../../graphql/schema/index.js";
import {
  buildStatusCounts,
  buildTrend,
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

  it("aligns sparse revenue and orders by calendar day in both periods", () => {
    const range = getDashboardRanges("week", new Date(2026, 5, 22, 12));
    const order = (day, amount) => ({
      createdAt: new Date(2026, 5, day, 12),
      currentStatus: "completed",
      totals: { grandTotal: amount },
    });
    const data = {
      ...range,
      currentOrders: [order(18, 100), order(22, 200)],
      previousOrders: [order(9, 100), order(15, 300)],
    };
    expect(buildTrend({ ...data, mode: "revenue" })).toEqual([
      { key: "2026-06-16", current: 0, previous: 100 },
      { key: "2026-06-17", current: 0, previous: 0 },
      { key: "2026-06-18", current: 100, previous: 0 },
      { key: "2026-06-19", current: 0, previous: 0 },
      { key: "2026-06-20", current: 0, previous: 0 },
      { key: "2026-06-21", current: 0, previous: 0 },
      { key: "2026-06-22", current: 200, previous: 300 },
    ]);
    expect(buildTrend({ ...data, mode: "orders" }).at(-1)).toEqual({
      key: "2026-06-22", current: 1, previous: 1,
    });
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
