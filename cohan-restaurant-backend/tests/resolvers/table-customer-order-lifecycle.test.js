import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  TableCustomer: {
    findOne: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/resolvers/order/helper/orderUtils.js", () => ({
  toId: (value) => (value ? `id:${String(value)}` : null),
}));

const makeFindOneResult = (row) => ({
  sort: vi.fn(() => ({
    lean: vi.fn().mockResolvedValue(row),
  })),
});

const tableCustomerRow = {
  _id: "table-customer-1",
  customerName: "Nguyễn An",
  customerPhone: "0901000001",
  customerEmail: "an@example.com",
  customerUserId: null,
};

describe("withTableCustomerOrderLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.TableCustomer.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it("hydrates a dine-in order from TableCustomer and writes the guest id back", async () => {
    modelMocks.TableCustomer.findOne.mockReturnValue(
      makeFindOneResult(tableCustomerRow),
    );
    const createOrderForTable = vi.fn().mockResolvedValue({
      order: { userId: "guest-1" },
    });
    const { withTableCustomerOrderLifecycle } = await import(
      "../../graphql/resolvers/order/tableCustomerOrderLifecycle.js"
    );
    const wrapped = withTableCustomerOrderLifecycle({ createOrderForTable });

    const result = await wrapped.createOrderForTable(
      null,
      {
        input: {
          restaurantId: "restaurant-1",
          tableCode: "A1",
          items: [{ name: "Món A" }],
        },
      },
      { user: { id: "staff-1" } },
    );

    expect(result.order.userId).toBe("guest-1");
    expect(createOrderForTable).toHaveBeenCalledWith(
      null,
      {
        input: expect.objectContaining({
          restaurantId: "restaurant-1",
          tableCode: "A1",
          customer: {
            fullName: "Nguyễn An",
            phone: "0901000001",
            email: "an@example.com",
          },
        }),
      },
      { user: { id: "staff-1" } },
      undefined,
    );
    expect(modelMocks.TableCustomer.updateOne).toHaveBeenCalledWith(
      {
        _id: "table-customer-1",
        restaurantId: "id:restaurant-1",
      },
      {
        $set: expect.objectContaining({
          customerUserId: "id:guest-1",
        }),
      },
    );
  });

  it("does not replace an explicit customer supplied by the caller", async () => {
    const createOrderForTable = vi.fn().mockResolvedValue({
      order: { userId: "customer-1" },
    });
    const { withTableCustomerOrderLifecycle } = await import(
      "../../graphql/resolvers/order/tableCustomerOrderLifecycle.js"
    );
    const wrapped = withTableCustomerOrderLifecycle({ createOrderForTable });
    const input = {
      restaurantId: "restaurant-1",
      tableCode: "A1",
      customer: { fullName: "Khách đã chọn", phone: "0909000009" },
      items: [{ name: "Món A" }],
    };

    await wrapped.createOrderForTable(null, { input }, {});

    expect(modelMocks.TableCustomer.findOne).not.toHaveBeenCalled();
    expect(createOrderForTable).toHaveBeenCalledWith(
      null,
      { input },
      {},
      undefined,
    );
  });

  it("keeps the created order successful when snapshot writeback fails", async () => {
    modelMocks.TableCustomer.findOne.mockReturnValue(
      makeFindOneResult(tableCustomerRow),
    );
    modelMocks.TableCustomer.updateOne.mockRejectedValue(
      new Error("temporary writeback failure"),
    );
    const createOrderForTable = vi.fn().mockResolvedValue({
      order: { userId: "guest-1" },
    });
    const { withTableCustomerOrderLifecycle } = await import(
      "../../graphql/resolvers/order/tableCustomerOrderLifecycle.js"
    );
    const wrapped = withTableCustomerOrderLifecycle({ createOrderForTable });

    await expect(
      wrapped.createOrderForTable(null, {
        input: { restaurantId: "restaurant-1", tableCode: "A1", items: [{}] },
      }),
    ).resolves.toEqual({ order: { userId: "guest-1" } });
  });
});
