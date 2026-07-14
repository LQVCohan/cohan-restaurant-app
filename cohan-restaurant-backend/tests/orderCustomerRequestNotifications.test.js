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

import {
  emitOrderEvent,
  emitRestaurantEvent,
} from "../graphql/resolvers/order/helper/emitOrderEvent.js";
import { setNotificationSocketServer } from "../src/services/notification/notificationWorkflow.service.js";

describe("customer request and kitchen-ready notification fan-out", () => {
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
    expect(io.to).toHaveBeenCalledWith("user_manager-1");
    expect(io.to).toHaveBeenCalledWith("user_staff-1");
    expect(io.to).toHaveBeenCalledWith("restaurant_res-1");
    expect(emit).toHaveBeenCalledWith(
      "orderEvents",
      expect.objectContaining({
        type: "CUSTOMER_STAFF_CALL_REQUESTED",
      }),
    );
  });

  it("creates and pushes a staff bell notification when a dish becomes ready", async () => {
    await emitOrderEvent(
      { io },
      "res-1",
      "ORDER_ITEM_STATUS_CHANGED",
      {
        order: {
          _id: "order-1",
          orderCode: "QR-20260714-T101-BXDZEV",
          tableCode: "T101",
          items: [
            {
              _id: "item-1",
              name: "Phở bò đặc biệt",
              station: "kitchen",
              status: "ready",
            },
          ],
        },
        meta: {
          itemId: "item-1",
          itemName: "Phở bò đặc biệt",
          statusFrom: "preparing",
          statusTo: "ready",
        },
      },
    );

    expect(mocks.notificationCreate).toHaveBeenCalledTimes(1);
    expect(mocks.notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        toUserId: "staff-1",
        toRole: "STAFF",
        restaurantId: "res-1",
        type: "KITCHEN_ITEM_READY",
        readAt: null,
        payload: expect.objectContaining({
          title: "Món đã sẵn sàng phục vụ",
          message: "Bàn T101 • Phở bò đặc biệt đã sẵn sàng từ bếp.",
          orderId: "order-1",
          orderCode: "QR-20260714-T101-BXDZEV",
          itemId: "item-1",
          tableCode: "T101",
          actionUrl: "/staff/orders",
        }),
      }),
    );
    expect(io.to).toHaveBeenCalledWith("user_staff-1");
    expect(emit).toHaveBeenCalledWith(
      "notificationCreated",
      expect.objectContaining({
        toUserId: "staff-1",
        type: "KITCHEN_ITEM_READY",
      }),
    );
    expect(io.to).toHaveBeenCalledWith("restaurant_res-1");
  });

  it("does not create a kitchen-ready bell item for other item transitions", async () => {
    await emitOrderEvent(
      { io },
      "res-1",
      "ORDER_ITEM_STATUS_CHANGED",
      {
        order: {
          _id: "order-1",
          orderCode: "QR-20260714-T101-BXDZEV",
          tableCode: "T101",
          items: [{ _id: "item-1", name: "Phở bò đặc biệt", status: "preparing" }],
        },
        meta: {
          itemId: "item-1",
          itemName: "Phở bò đặc biệt",
          statusFrom: "pending",
          statusTo: "preparing",
        },
      },
    );

    expect(mocks.notificationCreate).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      "orderEvents",
      expect.objectContaining({ type: "ORDER_ITEM_STATUS_CHANGED" }),
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
