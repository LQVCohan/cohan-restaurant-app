import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  watchersLean: vi.fn(),
  claimedLean: vi.fn(),
  menuItemLean: vi.fn(),
  warehouseLean: vi.fn(),
  userLean: vi.fn(),
  watchUpdateOne: vi.fn(),
  menuItemUpdateOne: vi.fn(),
  checkAvailabilityForLinesTx: vi.fn(),
  createNotificationOnce: vi.fn(),
  sendAvailabilityEmail: vi.fn(),
}));

vi.mock("../../models/index.js", () => ({
  MenuAvailabilityWatch: {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        limit: vi.fn(() => ({ lean: mocks.watchersLean })),
      })),
    })),
    findOneAndUpdate: vi.fn(() => ({ lean: mocks.claimedLean })),
    updateOne: mocks.watchUpdateOne,
    updateMany: vi.fn(),
  },
  MenuItem: {
    findOne: vi.fn(() => ({
      select: vi.fn(() => ({ lean: mocks.menuItemLean })),
    })),
    updateOne: mocks.menuItemUpdateOne,
  },
  User: {
    findById: vi.fn(() => ({
      select: vi.fn(() => ({ lean: mocks.userLean })),
    })),
  },
  Warehouse: {
    findOne: vi.fn(() => ({
      sort: vi.fn(() => ({ lean: mocks.warehouseLean })),
    })),
  },
}));

vi.mock("../../src/services/inventory.service.js", () => ({
  checkAvailabilityForLinesTx: mocks.checkAvailabilityForLinesTx,
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
  notifyAvailabilityWatchersForMenuItem,
  registerMenuAvailabilityWatch,
} = await import("../../src/services/menuAvailabilityWatch.service.js");

const restaurantId = "507f1f77bcf86cd799439011";
const menuItemId = "507f1f77bcf86cd799439012";
const watchId = "507f1f77bcf86cd799439013";
const userId = "507f1f77bcf86cd799439014";
const otherUserId = "507f1f77bcf86cd799439015";
const warehouseId = "507f1f77bcf86cd799439016";
const contactEmail = "customer@example.com";

function makeWatch() {
  return {
    _id: watchId,
    restaurantId,
    menuItemId,
    servingKey: "portion",
    desiredQuantity: 1,
    userId,
    contactEmail,
    status: "notified",
  };
}

describe("menu availability notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.watchersLean.mockResolvedValue([makeWatch()]);
    mocks.claimedLean.mockResolvedValue(makeWatch());
    mocks.menuItemLean.mockResolvedValue({
      _id: menuItemId,
      name: "Phở bò tái",
      thumbImage: "/pho-bo.jpg",
    });
    mocks.warehouseLean.mockResolvedValue({ _id: warehouseId });
    mocks.userLean.mockResolvedValue({ email: contactEmail });
    mocks.checkAvailabilityForLinesTx.mockResolvedValue({ isAvailable: true });
    mocks.createNotificationOnce.mockResolvedValue({
      _id: "507f1f77bcf86cd799439017",
    });
    mocks.sendAvailabilityEmail.mockResolvedValue({
      delivered: true,
      accepted: [contactEmail],
    });
    mocks.watchUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.menuItemUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it("creates the bell notification and emails the registered account", async () => {
    const emit = vi.fn();
    const io = { to: vi.fn(() => ({ emit })) };

    const result = await notifyAvailabilityWatchersForMenuItem({
      io,
      restaurantId,
      menuItemId,
      servingKey: "portion",
    });

    expect(result).toEqual({ notified: 1, skipped: 0 });
    expect(mocks.createNotificationOnce).toHaveBeenCalledTimes(1);
    expect(mocks.createNotificationOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        toUserId: userId,
        toRole: "CUSTOMER",
        restaurantId: expect.anything(),
        type: "menu_availability",
        sourceType: "menu_availability_watch",
        sourceId: watchId,
        io,
        payload: expect.objectContaining({
          messagePreview: "Phở bò tái hiện đã có thể đặt lại.",
          restaurantId,
          menuItemId,
          servingVariantKey: "portion",
          actionUrl: `/food/${menuItemId}?restaurantId=${restaurantId}`,
        }),
      }),
    );
    expect(mocks.sendAvailabilityEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: contactEmail,
        actionLabel: "Đặt món ngay",
        actionPath: `/food/${menuItemId}?restaurantId=${restaurantId}`,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      "menuAvailabilityNotifications",
      expect.objectContaining({ type: "MENU_ITEM_AVAILABLE_AGAIN" }),
    );
  });

  it("returns the watch to waiting when persistent delivery fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.createNotificationOnce.mockRejectedValueOnce(new Error("write failed"));

    const result = await notifyAvailabilityWatchersForMenuItem({
      io: null,
      restaurantId,
      menuItemId,
      servingKey: "portion",
    });

    expect(result).toEqual({ notified: 0, skipped: 1 });
    expect(mocks.watchUpdateOne).toHaveBeenCalledWith(
      { _id: watchId, status: "notified" },
      { $set: { status: "watching", notifiedAt: null } },
    );
  });

  it("returns the watch to waiting when SMTP does not accept the email", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.sendAvailabilityEmail.mockResolvedValueOnce({
      delivered: false,
      skipped: true,
      error: "SMTP_NOT_CONFIGURED",
    });

    const result = await notifyAvailabilityWatchersForMenuItem({
      io: null,
      restaurantId,
      menuItemId,
      servingKey: "portion",
    });

    expect(result).toEqual({ notified: 0, skipped: 1 });
    expect(mocks.watchUpdateOne).toHaveBeenCalledWith(
      { _id: watchId, status: "notified" },
      { $set: { status: "watching", notifiedAt: null } },
    );
  });

  it("rejects registering a watch for another user", async () => {
    await expect(
      registerMenuAvailabilityWatch(
        {
          restaurantId,
          menuItemId,
          userId: otherUserId,
          servingKey: "portion",
        },
        { user: { id: userId, email: contactEmail } },
      ),
    ).rejects.toThrow("Không thể đăng ký nhắc món cho tài khoản khác.");

    expect(mocks.checkAvailabilityForLinesTx).not.toHaveBeenCalled();
  });
});
