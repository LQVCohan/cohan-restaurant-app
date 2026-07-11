import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tableLean: vi.fn(),
  availableTablesLean: vi.fn(),
  watchesLean: vi.fn(),
  upsertLean: vi.fn(),
  claimedLean: vi.fn(),
  watchFindOneAndUpdate: vi.fn(),
  watchUpdateOne: vi.fn(),
  userLean: vi.fn(),
  createNotificationOnce: vi.fn(),
  sendAvailabilityEmail: vi.fn(),
}));

vi.mock("../../models/index.js", () => ({
  Table: {
    findOne: vi.fn(() => ({
      select: vi.fn(() => ({ lean: mocks.tableLean })),
    })),
    find: vi.fn(() => ({
      select: vi.fn(() => ({ lean: mocks.availableTablesLean })),
    })),
  },
  User: {
    findById: vi.fn(() => ({
      select: vi.fn(() => ({ lean: mocks.userLean })),
    })),
  },
}));

vi.mock("../../models/table-availability-watch.model.js", () => ({
  default: {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        limit: vi.fn(() => ({ lean: mocks.watchesLean })),
      })),
    })),
    findOneAndUpdate: mocks.watchFindOneAndUpdate,
    updateOne: mocks.watchUpdateOne,
  },
}));

vi.mock("../../src/services/notification/notificationWorkflow.service.js", () => ({
  createNotificationOnce: mocks.createNotificationOnce,
}));

vi.mock("../../src/services/availabilityEmail.service.js", () => ({
  normalizeAvailabilityEmail: (value) => {
    const email = String(value || "").trim().toLowerCase();
    return email.includes("@") ? email : null;
  },
  sendAvailabilityEmail: mocks.sendAvailabilityEmail,
}));

const {
  notifyAvailableTableWatchers,
  registerTableAvailabilityWatch,
} = await import("../../src/services/tableAvailabilityWatch.service.js");

const restaurantId = "507f1f77bcf86cd799439011";
const tableId = "507f1f77bcf86cd799439012";
const watchId = "507f1f77bcf86cd799439013";
const userId = "507f1f77bcf86cd799439014";
const contactEmail = "customer@example.com";

function makeWatch(status = "watching") {
  return {
    _id: watchId,
    restaurantId,
    tableId,
    tableCode: "A01",
    userId,
    contactEmail,
    status,
    expiresAt: new Date(Date.now() + 60_000),
  };
}

describe("table availability watches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tableLean.mockResolvedValue({ _id: tableId, code: "A01", status: "occupied" });
    mocks.availableTablesLean.mockResolvedValue([{ _id: tableId }]);
    mocks.watchesLean.mockResolvedValue([makeWatch()]);
    mocks.upsertLean.mockResolvedValue(makeWatch());
    mocks.claimedLean.mockResolvedValue(makeWatch("notified"));
    mocks.watchFindOneAndUpdate.mockImplementation((filter) => ({
      lean: filter?._id ? mocks.claimedLean : mocks.upsertLean,
    }));
    mocks.watchUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.userLean.mockResolvedValue({ email: contactEmail });
    mocks.createNotificationOnce.mockResolvedValue({ _id: "507f1f77bcf86cd799439015" });
    mocks.sendAvailabilityEmail.mockResolvedValue({
      delivered: true,
      accepted: [contactEmail],
    });
  });

  it("persists a real watch instead of returning a client-only success", async () => {
    const result = await registerTableAvailabilityWatch(
      { restaurantId, tableId, contactEmail },
      { user: { id: userId, email: contactEmail } },
    );

    expect(result.alreadyAvailable).toBe(false);
    expect(result.watch).toEqual(expect.objectContaining({ tableId, contactEmail }));
    expect(mocks.watchFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: expect.anything(), tableId: expect.anything(), userId: expect.anything() }),
      expect.objectContaining({
        $set: expect.objectContaining({ tableCode: "A01", contactEmail }),
      }),
      expect.objectContaining({ new: true, upsert: true }),
    );
  });

  it("emails the watcher only after the table is actually available", async () => {
    const emit = vi.fn();
    const io = { to: vi.fn(() => ({ emit })) };

    const result = await notifyAvailableTableWatchers({ io });

    expect(result).toEqual({ notified: 1, skipped: 0 });
    expect(mocks.sendAvailabilityEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: contactEmail,
        actionLabel: "Đặt bàn ngay",
        actionPath: `/restaurant/${restaurantId}/layout`,
      }),
    );
    expect(mocks.createNotificationOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        toUserId: userId,
        type: "table_availability",
        sourceType: "table_availability_watch",
        sourceId: watchId,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      "tableAvailabilityNotifications",
      expect.objectContaining({ type: "TABLE_AVAILABLE_AGAIN", tableId }),
    );
  });

  it("retries later when SMTP does not accept the table email", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.sendAvailabilityEmail.mockResolvedValueOnce({
      delivered: false,
      skipped: true,
      error: "SMTP_NOT_CONFIGURED",
    });

    const result = await notifyAvailableTableWatchers();

    expect(result).toEqual({ notified: 0, skipped: 1 });
    expect(mocks.watchUpdateOne).toHaveBeenCalledWith(
      { _id: watchId, status: "notified" },
      { $set: { status: "watching", notifiedAt: null } },
    );
  });
});
