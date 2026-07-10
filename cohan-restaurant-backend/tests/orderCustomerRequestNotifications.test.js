import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  restaurantFindById: vi.fn(),
  brandMembershipFind: vi.fn(),
  roleFind: vi.fn(),
  userFind: vi.fn(),
  notificationFindOne: vi.fn(),
  notificationCreate: vi.fn(),
}));

const selectLean = (value) => ({
  select: vi.fn(() => ({
    lean: vi.fn(async () => value),
  })),
});

vi.mock("../models/index.js", () => ({
  Restaurant: {
    findById: mocks.restaurantFindById,
  },
  BrandMembership: {
    find: mocks.brandMembershipFind,
  },
  Role: {
    find: mocks.roleFind,
  },
  User: {
    find: mocks.userFind,
  },
  Notification: {
    findOne: mocks.notificationFindOne,
    create: mocks.notificationCreate,
  },
}));

import { emitRestaurantEvent } from "../graphql/resolvers/order/helper/emitOrderEvent.js";
import { setNotificationSocketServer } from "../src/services/notification/notificationWorkflow.service.js";

describe("customer request notification fan-out", () => {
  let emit;
  let io;

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
    io = { to: vi.fn(() => ({ emit })) };
    setNotificationSocketServer(io);

    mocks.restaurantFindById.mockReturnValue(
      selectLean({ _id: "res-1", brandId: "brand-1" }),
    );
    mocks.brandMembershipFind.mockReturnValue(
      selectLean([{ userId: "manager-1" }]),
    );
    mocks.roleFind.mockReturnValue(selectLean([]));
    mocks.userFind.mockImplementation((filter) => {
      if (filter?.userType === "STAFF") {
        return selectLean([{ _id: "staff-1" }]);
      }
      return selectLean([{ _id: "manager-1" }]);
    });
    mocks.notificationFindOne.mockResolvedValue(null);
    mocks.notificationCreate.mockImplementation(async (input) => ({
      ...input,
      _id: `notification-${input.toUserId}`,
      createdAt: new Date("2026-07-11T08:00:00.000Z"),
    }));
  });

  it("creates unread manager and staff notifications before broadcasting the POS event", async () => {
    await emitRestaurantEvent(
      { io },
      "res-1",
      "CUSTOMER_STAFF_CALL_REQUESTED",
      {
        request: {
          requestId: "request-1",
          type: "STAFF_CALL",
          status: "PENDING",
          orderCode: "POS-101",
          tableCode: "T101",
          message: "Khách cần hỗ trợ tại bàn.",
        },
        tableCode: "T101",
        message: "Khách cần hỗ trợ tại bàn.",
      },
    );

    expect(mocks.notificationCreate).toHaveBeenCalledTimes(2);
    expect(mocks.notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        toUserId: "manager-1",
        toRole: "MANAGER",
        type: "CUSTOMER_STAFF_CALL_REQUESTED",
        readAt: null,
        payload: expect.objectContaining({
          actionUrl: "/manager/dashboard/POS?restaurantId=res-1",
          requestId: "request-1",
          tableCode: "T101",
        }),
      }),
    );
    expect(mocks.notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        toUserId: "staff-1",
        toRole: "STAFF",
        payload: expect.objectContaining({
          actionUrl: "/staff/orders",
          requestId: "request-1",
        }),
      }),
    );
    expect(io.to).toHaveBeenCalledWith("restaurant_res-1");
    expect(emit).toHaveBeenCalledWith(
      "orderEvents",
      expect.objectContaining({
        type: "CUSTOMER_STAFF_CALL_REQUESTED",
      }),
    );
  });

  it("does not create a second bell item for acknowledgement events", async () => {
    await emitRestaurantEvent(
      { io },
      "res-1",
      "CUSTOMER_REQUEST_ACKNOWLEDGED",
      {
        request: {
          requestId: "request-1",
          type: "STAFF_CALL",
          status: "ACKNOWLEDGED",
        },
      },
    );

    expect(mocks.notificationCreate).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      "orderEvents",
      expect.objectContaining({
        type: "CUSTOMER_REQUEST_ACKNOWLEDGED",
      }),
    );
  });
});
