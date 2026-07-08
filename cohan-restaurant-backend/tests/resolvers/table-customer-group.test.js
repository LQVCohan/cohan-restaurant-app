import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Table: {
    findOne: vi.fn(),
    find: vi.fn(),
    updateOne: vi.fn(),
  },
  TableCustomer: {
    findOne: vi.fn(),
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
  },
}));
const guardMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("mongoose", () => {
  function ObjectId(value) {
    this.value = String(value);
  }
  ObjectId.prototype.toString = function toString() {
    return this.value;
  };
  return {
    default: {
      isValidObjectId: (value) => String(value || "").startsWith("valid-"),
      Types: { ObjectId },
    },
  };
});

const leanWrap = (value) => ({ lean: vi.fn().mockResolvedValue(value) });
const selectLeanWrap = (value) => ({
  select: vi.fn(() => leanWrap(value)),
});
const sortLeanWrap = (value) => ({
  sort: vi.fn(() => leanWrap(value)),
});

const mergedTable = {
  _id: "valid-merged",
  code: "A1+A2",
  mergedFromTableIds: ["valid-a1", "valid-a2"],
};
const sourceTables = [
  { _id: "valid-a2", code: "A2" },
  { _id: "valid-a1", code: "A1" },
];
const customerRows = [
  {
    _id: "valid-customer-2",
    tableId: "valid-a2",
    tableCode: "A2",
    customerName: "Trần Bình",
    customerPhone: "0902000002",
    partySize: 3,
  },
  {
    _id: "valid-customer-1",
    tableId: "valid-a1",
    tableCode: "A1",
    customerName: "Nguyễn An",
    customerPhone: "0901000001",
    partySize: 2,
  },
];

const arrangeMergedGroup = (rows = customerRows) => {
  modelMocks.Table.findOne.mockReturnValue(selectLeanWrap(mergedTable));
  modelMocks.Table.find.mockReturnValue(selectLeanWrap(sourceTables));
  modelMocks.TableCustomer.find.mockReturnValue(sortLeanWrap(rows));
};

describe("tableCustomerGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue();
    modelMocks.Table.updateOne.mockResolvedValue({ modifiedCount: 1 });
    modelMocks.TableCustomer.findOne.mockReturnValue(leanWrap(null));
  });

  it("returns every source-table customer and sums party size", async () => {
    arrangeMergedGroup();
    const { TableCustomerQuery } = await import(
      "../../graphql/resolvers/table/tableCustomer.js"
    );

    const result = await TableCustomerQuery.tableCustomerGroup(
      null,
      { restaurantId: "valid-r1", tableId: "valid-merged" },
      { user: { id: "valid-manager" } },
    );

    expect(result).toEqual({
      tableId: "valid-merged",
      tableCode: "A1+A2",
      isMerged: true,
      customerCount: 2,
      totalPartySize: 5,
      profiles: [
        {
          sourceTableId: "valid-a1",
          sourceTableCode: "A1",
          customer: expect.objectContaining({
            id: "valid-customer-1",
            customerName: "Nguyễn An",
            partySize: 2,
          }),
        },
        {
          sourceTableId: "valid-a2",
          sourceTableCode: "A2",
          customer: expect.objectContaining({
            id: "valid-customer-2",
            customerName: "Trần Bình",
            partySize: 3,
          }),
        },
      ],
    });
    expect(modelMocks.TableCustomer.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [
          { tableId: { $in: ["valid-a1", "valid-a2"] } },
          { tableCode: { $in: ["A2", "A1"] } },
        ],
      }),
    );
  });

  it("keeps an empty profile slot for a source table without customer data", async () => {
    arrangeMergedGroup([customerRows[1]]);
    const { TableCustomerQuery } = await import(
      "../../graphql/resolvers/table/tableCustomer.js"
    );

    const result = await TableCustomerQuery.tableCustomerGroup(
      null,
      { restaurantId: "valid-r1", tableId: "valid-merged" },
      { user: { id: "valid-manager" } },
    );

    expect(result.customerCount).toBe(1);
    expect(result.totalPartySize).toBe(2);
    expect(result.profiles[1]).toEqual({
      sourceTableId: "valid-a2",
      sourceTableCode: "A2",
      customer: null,
    });
  });

  it("returns the first source profile to legacy singular clients", async () => {
    arrangeMergedGroup();
    const { TableCustomerQuery } = await import(
      "../../graphql/resolvers/table/tableCustomer.js"
    );

    const result = await TableCustomerQuery.tableCustomer(
      null,
      { restaurantId: "valid-r1", tableId: "valid-merged" },
      { user: { id: "valid-manager" } },
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: "valid-customer-1",
        tableId: "valid-a1",
        customerName: "Nguyễn An",
      }),
    );
  });

  it("updates a legacy code-only row and reserves only an available table", async () => {
    modelMocks.TableCustomer.findOneAndUpdate.mockReturnValue(
      leanWrap({
        _id: "valid-customer-1",
        tableId: "valid-a1",
        tableCode: "A1",
        customerName: "Nguyễn An mới",
      }),
    );
    const { TableCustomerMutation } = await import(
      "../../graphql/resolvers/table/tableCustomer.js"
    );

    await TableCustomerMutation.upsertTableCustomer(
      null,
      {
        input: {
          restaurantId: "valid-r1",
          tableId: "valid-a1",
          tableCode: "A1",
          customerName: "Nguyễn An mới",
        },
      },
      { user: { id: "valid-manager" } },
    );

    const [condition, update] =
      modelMocks.TableCustomer.findOneAndUpdate.mock.calls[0];
    expect(String(condition.restaurantId)).toBe("valid-r1");
    expect(String(condition.$or[0].tableId)).toBe("valid-a1");
    expect(condition.$or[1]).toEqual({ tableCode: "A1" });
    expect(update.$set).toEqual(
      expect.objectContaining({
        tableCode: "A1",
        customerName: "Nguyễn An mới",
      }),
    );
    expect(modelMocks.Table.updateOne).toHaveBeenCalledWith(
      {
        restaurantId: expect.anything(),
        _id: expect.anything(),
        status: "available",
      },
      { $set: { status: "reserved" } },
    );
  });
});
