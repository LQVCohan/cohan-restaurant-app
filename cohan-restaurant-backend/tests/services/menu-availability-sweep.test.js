import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  notifyAvailabilityWatchersForMenuItem: vi.fn(),
}));

vi.mock("../../models/index.js", () => ({
  MenuAvailabilityWatch: {
    aggregate: mocks.aggregate,
  },
}));

vi.mock("../../src/services/menuAvailabilityWatch.service.js", () => ({
  notifyAvailabilityWatchersForMenuItem: mocks.notifyAvailabilityWatchersForMenuItem,
}));

const { notifyAvailableMenuWatchers } = await import(
  "../../src/services/menuAvailabilitySweep.service.js"
);

describe("menu availability sweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.aggregate.mockResolvedValue([
      {
        _id: {
          restaurantId: "507f1f77bcf86cd799439011",
          menuItemId: "507f1f77bcf86cd799439012",
          servingKey: "portion",
        },
      },
    ]);
    mocks.notifyAvailabilityWatchersForMenuItem.mockResolvedValue({
      notified: 2,
      skipped: 0,
    });
  });

  it("rechecks each distinct item variant without one popular item starving others", async () => {
    const io = {};
    const result = await notifyAvailableMenuWatchers({ io });

    expect(result).toEqual({ groupsScanned: 1, notified: 2, skipped: 0 });
    expect(mocks.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ $group: expect.any(Object) }),
        { $limit: 100 },
      ]),
    );
    expect(mocks.notifyAvailabilityWatchersForMenuItem).toHaveBeenCalledTimes(1);
    expect(mocks.notifyAvailabilityWatchersForMenuItem).toHaveBeenCalledWith({
      io,
      restaurantId: "507f1f77bcf86cd799439011",
      menuItemId: "507f1f77bcf86cd799439012",
      servingKey: "portion",
      source: "availability_sweep",
      maxWatchers: 50,
    });
  });
});
