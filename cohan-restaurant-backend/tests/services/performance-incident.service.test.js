import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findOneAndUpdate: vi.fn(),
}));

vi.mock("../../models/index.js", () => ({
  PerformanceIncident: {
    create: mocks.create,
    findOneAndUpdate: mocks.findOneAndUpdate,
    find: vi.fn(() => ({ sort: vi.fn() })),
  },
}));

import {
  buildIncidentUniqueKey,
  createPerformanceIncident,
  createPerformanceIncidentOnce,
} from "../../src/services/performance/performanceIncident.service.js";

describe("performanceIncident.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates incident with scoreDelta=0 by default", async () => {
    mocks.create.mockResolvedValue({ _id: "1" });
    await createPerformanceIncident({ sourceType: "timesheet", sourceId: "ts1", eventType: "ATTENDANCE_LATE" });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ scoreDelta: 0 }));
  });

  it("does not duplicate on create once", async () => {
    mocks.findOneAndUpdate.mockResolvedValue({ _id: "1" });
    await createPerformanceIncidentOnce({ sourceType: "timesheet", sourceId: "ts1", eventType: "ATTENDANCE_LATE" });
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { uniqueKey: "timesheet:ts1:ATTENDANCE_LATE" },
      expect.any(Object),
      expect.objectContaining({ upsert: true }),
    );
  });

  it("builds unique key", () => {
    expect(buildIncidentUniqueKey("a", "b", "c")).toBe("a:b:c");
  });
});
