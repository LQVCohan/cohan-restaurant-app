import { beforeEach, describe, expect, it, vi } from "vitest";

const tableMocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(),
}));
const reservationMocks = vi.hoisted(() => ({ findOne: vi.fn() }));
const orderMocks = vi.hoisted(() => ({ find: vi.fn() }));

vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: (value) => String(value || "").startsWith("valid-"),
  },
}));
vi.mock("../../models/table.model.js", () => ({ default: tableMocks }));
vi.mock("../../models/reservation.model.js", () => ({
  default: reservationMocks,
}));
vi.mock("../../models/order.model.js", () => ({ default: orderMocks }));
vi.mock("../../utils/orderLifecycle.js", () => ({
  orderBatchOrLegacyFilter: () => ({
    orderKind: { $in: ["order_batch", null] },
  }),
}));

function queryResult(value) {
  const chain = {
    select: vi.fn(),
    sort: vi.fn(),
    lean: vi.fn().mockResolvedValue(value),
  };
  chain.select.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);
  return chain;
}

describe("merged table order lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tableMocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
    reservationMocks.findOne.mockReturnValue(queryResult(null));
    orderMocks.find.mockReturnValue(queryResult([]));
  });

  it("routes a new composite order to the selected physical source", async () => {
    tableMocks.findOne
      .mockReturnValueOnce(
        queryResult({
          _id: "valid-merged",
          code: "A1+A2",
          restaurantId: "valid-r1",
          joinGroupId: "group-1",
          mergedFromTableIds: ["valid-a1", "valid-a2"],
          mergeAnchorTableId: "valid-a1",
        }),
      )
      .mockReturnValueOnce(
        queryResult({ _id: "valid-a2", code: "A2" }),
      );

    const baseMutation = {
      createOrderForTable: vi.fn().mockResolvedValue({
        isNewOrder: true,
        order: { _id: "valid-order-a2", tableId: "valid-a2" },
      }),
      requestPaymentForTable: vi.fn(),
      requestPaymentForOrder: vi.fn(),
    };
    const { withMergedTableOrderLifecycle } = await import(
      "../../graphql/resolvers/order/mergedTableLifecycle.js"
    );
    const wrapped = withMergedTableOrderLifecycle(baseMutation);

    const result = await wrapped.createOrderForTable(
      null,
      {
        input: {
          restaurantId: "valid-r1",
          tableCode: "A1+A2",
          items: [{ name: "Phở", quantity: 1 }],
          clientMeta: {
            source: "pos",
            tableMerge: { sourceTableId: "valid-a2" },
          },
        },
      },
      { user: { id: "valid-staff" } },
    );

    expect(baseMutation.createOrderForTable).toHaveBeenCalledWith(
      null,
      {
        input: expect.objectContaining({
          restaurantId: "valid-r1",
          tableId: "valid-a2",
          tableCode: "A2",
          clientMeta: expect.objectContaining({
            source: "pos",
            tableMerge: {
              sourceTableId: "valid-a2",
              sourceTableCode: "A2",
              joinGroupId: "group-1",
              mergedTableId: "valid-merged",
              mergedTableCode: "A1+A2",
            },
          }),
        }),
      },
      expect.any(Object),
      undefined,
    );
    expect(tableMocks.updateOne).toHaveBeenCalledWith(
      { _id: "valid-merged", restaurantId: "valid-r1" },
      { $set: { status: "occupied" } },
    );
    expect(result.order.tableId).toBe("valid-a2");
  });
});
