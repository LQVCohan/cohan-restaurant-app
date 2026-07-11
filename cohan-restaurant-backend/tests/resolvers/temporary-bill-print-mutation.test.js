import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Order: { findById: vi.fn() },
  PrintSetting: { findOne: vi.fn(), updateOne: vi.fn() },
}));
const authMocks = vi.hoisted(() => ({ requireRestaurantPermission: vi.fn() }));
const eventMocks = vi.hoisted(() => ({ emitOrderEvent: vi.fn() }));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => eventMocks);
vi.mock("../../graphql/resolvers/order/helper/orderUtils.js", () => ({
  toId: vi.fn((value) => value ? String(value) : null),
}));

const queryResult = (value) => ({ lean: vi.fn().mockResolvedValue(value) });
const order = {
  _id: "order-1",
  restaurantId: "restaurant-1",
  orderCode: "ORD-001",
  tableCode: "T01",
  currentStatus: "confirmed",
};

const printSetting = (overrides = {}) => ({
  _id: "print-setting-1",
  restaurantId: "restaurant-1",
  printers: [
    { id: "cashier-a", name: "Thu ngân A", status: "configured" },
    { id: "cashier-b", name: "Thu ngân B", status: "online" },
  ],
  stations: { cashier: ["cashier-a", "cashier-b", "cashier-a"] },
  templates: [{ key: "receipt", enabled: true }],
  jobs: [],
  ...overrides,
});

describe("temporary bill print mutation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.Order.findById.mockReturnValue(queryResult(order));
    modelMocks.PrintSetting.findOne.mockReturnValue(queryResult(printSetting()));
    modelMocks.PrintSetting.updateOne.mockResolvedValue({ modifiedCount: 1 });
    authMocks.requireRestaurantPermission.mockResolvedValue(true);
    eventMocks.emitOrderEvent.mockResolvedValue(undefined);
  });

  it("creates one atomic temporary-bill job per unique cashier printer", async () => {
    const { createTemporaryBillPrintJob } = await import(
      "../../graphql/resolvers/order/temporaryBillPrintMutation.js"
    );
    const ctx = { user: { id: "manager-1" } };

    const result = await createTemporaryBillPrintJob(
      null,
      { input: { orderId: "order-1", restaurantId: "restaurant-1" } },
      ctx,
    );

    expect(authMocks.requireRestaurantPermission).toHaveBeenCalledWith(
      ctx,
      "restaurant-1",
      "order.update",
    );
    expect(result).toEqual({ ok: true, message: "Đã tạo 2 lệnh in tạm tính." });
    const jobs = modelMocks.PrintSetting.updateOne.mock.calls[0][1].$push.jobs.$each;
    expect(jobs).toHaveLength(2);
    expect(jobs.map((job) => job.printerId).sort()).toEqual(["cashier-a", "cashier-b"]);
    expect(jobs.every((job) => job.templateKey === "receipt")).toBe(true);
    expect(jobs.every((job) => job.status === "pending")).toBe(true);
    expect(modelMocks.PrintSetting.updateOne.mock.calls[0][1].$push.jobs).toEqual(
      expect.objectContaining({ $position: 0, $slice: 300 }),
    );
    expect(eventMocks.emitOrderEvent).toHaveBeenCalledWith(
      ctx,
      "restaurant-1",
      "ORDER_PRINT_JOBS_CREATED",
      expect.objectContaining({ printJobs: jobs }),
    );
  });

  it("does not enqueue when the receipt template is disabled", async () => {
    modelMocks.PrintSetting.findOne.mockReturnValue(queryResult(printSetting({
      templates: [{ key: "receipt", enabled: false }],
    })));
    const { createTemporaryBillPrintJob } = await import(
      "../../graphql/resolvers/order/temporaryBillPrintMutation.js"
    );

    const result = await createTemporaryBillPrintJob(
      null,
      { input: { orderId: "order-1", restaurantId: "restaurant-1" } },
      { user: { id: "manager-1" } },
    );

    expect(result).toEqual({ ok: false, message: "Mẫu hóa đơn đang tắt." });
    expect(modelMocks.PrintSetting.updateOne).not.toHaveBeenCalled();
  });

  it("marks only an explicitly offline cashier printer as failed", async () => {
    modelMocks.PrintSetting.findOne.mockReturnValue(queryResult(printSetting({
      printers: [
        { id: "cashier-a", name: "Thu ngân A", status: "offline" },
        { id: "cashier-b", name: "Thu ngân B", status: "configured" },
      ],
    })));
    const { createTemporaryBillPrintJob } = await import(
      "../../graphql/resolvers/order/temporaryBillPrintMutation.js"
    );

    await createTemporaryBillPrintJob(
      null,
      { input: { orderId: "order-1", restaurantId: "restaurant-1" } },
      { user: { id: "manager-1" } },
    );

    const jobs = modelMocks.PrintSetting.updateOne.mock.calls[0][1].$push.jobs.$each;
    expect(jobs.find((job) => job.printerId === "cashier-a")).toEqual(
      expect.objectContaining({ status: "failed", error: expect.any(String) }),
    );
    expect(jobs.find((job) => job.printerId === "cashier-b")).toEqual(
      expect.objectContaining({ status: "pending", error: null }),
    );
  });

  it("rejects an order from another restaurant before queue mutation", async () => {
    modelMocks.Order.findById.mockReturnValue(queryResult({ ...order, restaurantId: "other" }));
    const { createTemporaryBillPrintJob } = await import(
      "../../graphql/resolvers/order/temporaryBillPrintMutation.js"
    );

    await expect(
      createTemporaryBillPrintJob(
        null,
        { input: { orderId: "order-1", restaurantId: "restaurant-1" } },
        { user: { id: "manager-1" } },
      ),
    ).rejects.toThrow("Order not found");

    expect(authMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(modelMocks.PrintSetting.updateOne).not.toHaveBeenCalled();
  });
});
