import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ staff: [], shifts: [], orders: [], forecast: null, perf: [] }));
const q = (rows) => ({ select: vi.fn(() => ({ lean: vi.fn(async () => rows) })) });
vi.mock("../../models/index.js", () => ({ Staff: { find: vi.fn(() => q(mocks.staff)) }, Shift: { find: vi.fn(() => q(mocks.shifts)) }, Order: { find: vi.fn(() => q(mocks.orders)) } }));
vi.mock("../../src/services/ai/demandForecast.service.js", () => ({ buildDemandForecast: vi.fn(async () => mocks.forecast) }));
vi.mock("../../src/services/performance/staffPerformanceReporting.service.js", () => ({ listStaffPerformanceSummaries: vi.fn(async () => mocks.perf) }));
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => ({ getSchedulingPolicy: vi.fn(async () => ({})) }));
vi.mock("../../src/services/scheduling/staffAvailabilityContext.service.js", () => ({ resolveStaffAvailabilityForShift: vi.fn(async ({ employeeId }) => ({ issues: String(employeeId).endsWith("2") ? [{ severity: "high", hardBlock: true, message: "hard block" }] : [] })) }));
const { buildStaffSchedulingAssistant } = await import("../../src/services/ai/staffSchedulingAssistant.service.js");
const rid = "64b7f987f987f987f987f987";
const sid = (n) => `64b7f987f987f987f987f00${n}`;

describe("staff scheduling assistant", () => {
  beforeEach(() => { mocks.staff = []; mocks.shifts = []; mocks.orders = []; mocks.forecast = { hourlyForecast: [{ date: "2026-03-28", hourLabel: "18:00", expectedOrders: 40, expectedGuests: 100, confidence: 0.9 }] }; mocks.perf = []; vi.useFakeTimers(); vi.setSystemTime(new Date("2026-03-28T00:00:00Z")); });

  it("detects under/balanced/over staffed, suggests non-overlapping candidates and uses fallback performance", async () => {
    mocks.staff = [
      { _id: sid(1), fullName: "A", department: "service", employmentStatus: "working" },
      { _id: sid(2), fullName: "B", department: "service", employmentStatus: "working" },
      { _id: sid(3), fullName: "C", department: "service", employmentStatus: "working" },
    ];
    mocks.shifts = [{ employeeId: sid(3), shiftType: "evening", startTime: "2026-03-28T18:00:00Z", endTime: "2026-03-28T23:00:00Z", status: "scheduled" }];
    const result = await buildStaffSchedulingAssistant({ restaurantId: rid, timezone: "UTC", actor: { id: "m" }, periodStart: "2026-03-28", periodEnd: "2026-03-28" });
    expect(result.shifts.some((s) => ["understaffed", "balanced", "overstaffed"].includes(s.status))).toBe(true);
    const suggested = result.shifts.flatMap((s) => s.suggestedCandidates || []);
    expect(suggested.some((c) => c.staffId === sid(3))).toBe(false);
    expect(suggested[0]?.reason || result.summary.notes.join(" ")).toContain("75/100");
    expect(result.meta.basedOnForecast).toBe(true);
    expect(result.meta.fallbackUsed).toBe(false);
    vi.useRealTimers();
  });
});
