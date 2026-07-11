import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  candidatesLean: vi.fn(),
  notifyAvailabilityWatchersForMenuItem: vi.fn(),
}));

vi.mock("../../models/index.js", () => ({
  MenuAvailabilityWatch: {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        limit: vi.fn(() => ({ lean: mocks.candidatesLean })),
      })),
    })),
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
    mocks.candidatesLean.mockResolvedValue([
      {
        restaurantId: "507f1f77bcf86cd799439011",
        menuItemId: "507f1f77bcf86cd799439012",
        servingKey: "portion",
      },
      {
        restaurantId: "507f1f77bcf86cd799439011",
        menuItemId: "507f1f77bcf86cd799439012",
        servingKey: "portion",
      },
    ]);
    mocks.notifyAvailabilityWatchersForMenuItem.mockResolvedValue({
      notified: 2,
      skipped: 0,
    });
  });

  it("groups duplicate watches and rechecks actual availability once per item variant", async () => {
    const io = {};
    const result = await notifyAvailableMenuWatchers({ io });

    expect(result).toEqual({ groupsScanned: 1, notified: 2, skipped: 0 });
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
