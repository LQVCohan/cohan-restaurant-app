import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildDemandForecast: vi.fn(),
}));

const query = (rows) => ({
  select: vi.fn(() => ({ lean: vi.fn(async () => rows) })),
});

vi.mock("../../models/index.js", () => ({
  Staff: { find: vi.fn(() => query([])) },
  Shift: { find: vi.fn(() => query([])) },
  Order: { find: vi.fn(() => query([])) },
}));
vi.mock("../../src/services/ai/demandForecast.service.js", () => ({
  buildDemandForecast: mocks.buildDemandForecast,
}));
vi.mock("../../src/services/performance/staffPerformanceReporting.service.js", () => ({
  listStaffPerformanceSummaries: vi.fn(async () => []),
}));
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => ({
  getSchedulingPolicy: vi.fn(async () => ({})),
}));
vi.mock("../../src/services/scheduling/staffAvailabilityContext.service.js", () => ({
  resolveStaffAvailabilityForShift: vi.fn(async () => ({ issues: [] })),
}));

const { buildStaffSchedulingAssistant } = await import(
  "../../src/services/ai/staffSchedulingAssistant.service.js"
);

const restaurantId = "64b7f987f987f987f987f987";

describe("staff scheduling selected period", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildDemandForecast.mockResolvedValue({
      hourlyForecast: [
        {
          date: "2026-04-06",
          hourLabel: "18:00",
          expectedOrders: 18,
          expectedGuests: 42,
          confidence: 0.8,
        },
      ],
    });
  });

  it("forwards the selected period start to demand forecasting", async () => {
    const result = await buildStaffSchedulingAssistant({
      restaurantId,
      timezone: "Asia/Ho_Chi_Minh",
      horizonDays: 2,
      periodStart: "2026-04-06T00:00:00+07:00",
      periodEnd: "2026-04-07T23:59:59+07:00",
    });

    expect(mocks.buildDemandForecast).toHaveBeenCalledWith(
      expect.objectContaining({
        timezone: "Asia/Ho_Chi_Minh",
        forecastStart: new Date("2026-04-06T00:00:00+07:00"),
      }),
    );
    expect(result.meta.basedOnForecast).toBe(true);
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.shifts.map((shift) => shift.date)).toContain("2026-04-06");
  });
});
