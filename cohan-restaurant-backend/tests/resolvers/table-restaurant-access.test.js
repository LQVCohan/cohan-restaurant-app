import { beforeEach, describe, expect, it, vi } from "vitest";

const tableMocks = vi.hoisted(() => ({
  updateMany: vi.fn(), find: vi.fn(), findOne: vi.fn(), create: vi.fn(),
  findById: vi.fn(), findByIdAndUpdate: vi.fn(), deleteOne: vi.fn(),
  updateOne: vi.fn(), bulkWrite: vi.fn(), findOneAndUpdate: vi.fn(),
}));
const floorMocks = vi.hoisted(() => ({ findById: vi.fn() }));
const orderMocks = vi.hoisted(() => ({ findOne: vi.fn(), find: vi.fn() }));
const reservationMocks = vi.hoisted(() => ({ findOne: vi.fn() }));
const guardMocks = vi.hoisted(() => ({ requireRestaurantAccess: vi.fn() }));
const authMocks = vi.hoisted(() => ({ requireRestaurantPermission: vi.fn() }));
const eventMocks = vi.hoisted(() => ({ logEvent: vi.fn() }));
const mongooseMocks = vi.hoisted(() => {
  const Schema = vi.fn(function Schema(definition, options) {
    this.definition = definition;
    this.options = options;
    this.index = vi.fn();
    this.virtual = vi.fn(() => ({ get: vi.fn() }));
    this.pre = vi.fn();
    this.plugin = vi.fn();
    this.methods = {};
    this.statics = {};
  });
  Schema.Types = { ObjectId: "ObjectId" };

  return {
    Schema,
    isValidObjectId: vi.fn((v) => String(v).startsWith("valid-") || /^[a-f\d]{24}$/i.test(String(v))),
    Types: { ObjectId: vi.fn((v) => v) },
    model: vi.fn(),
  };
});

vi.mock("../../models/table.model.js", () => ({ default: tableMocks }));
vi.mock("../../models/floor.model.js", () => ({ default: floorMocks }));
vi.mock("../../models/order.model.js", () => ({ default: orderMocks }));
vi.mock("../../models/reservation.model.js", () => ({ default: reservationMocks }));
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("../../src/services/eventLog.service.js", () => eventMocks);
vi.mock("mongoose", () => ({
  default: mongooseMocks,
  Schema: mongooseMocks.Schema,
  Types: mongooseMocks.Types,
  model: mongooseMocks.model,
  isValidObjectId: mongooseMocks.isValidObjectId,
}));

const leanWrap = (value) => ({ lean: vi.fn().mockResolvedValue(value) });
const selectLeanWrap = (value) => ({ select: vi.fn(() => leanWrap(value)) });
const mockFindOneChain = (value) => ({
  sort: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value),
});

describe("table restaurant access guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue();
    authMocks.requireRestaurantPermission.mockResolvedValue();
    tableMocks.updateMany.mockResolvedValue({});
    tableMocks.find.mockImplementation(() => ({
      select: vi.fn(() => ({
        lean: vi.fn().mockResolvedValue([]),
        sort: vi.fn(() => ({ limit: vi.fn(() => leanWrap([])) })),
      })),
      sort: vi.fn(() => ({ limit: vi.fn(() => leanWrap([])) })),
    }));
    tableMocks.findOne.mockReturnValue(leanWrap(null));
    tableMocks.create.mockResolvedValue({ toObject: () => ({ _id: "valid-t1" }) });
    tableMocks.findById.mockReturnValue(selectLeanWrap({ _id: "valid-t1", restaurantId: "valid-r1", floorId: "valid-f1", code: "A1" }));
    tableMocks.findByIdAndUpdate.mockReturnValue(leanWrap({ _id: "valid-t1", restaurantId: "valid-r1", status: "OPEN" }));
    tableMocks.deleteOne.mockResolvedValue({ deletedCount: 1 });
    tableMocks.updateOne.mockResolvedValue({});
    tableMocks.bulkWrite.mockResolvedValue({ upsertedCount: 1, modifiedCount: 1 });
    tableMocks.findOneAndUpdate.mockReturnValue(leanWrap({ _id: "valid-t1", restaurantId: "valid-r1" }));
    floorMocks.findById.mockReturnValue(selectLeanWrap({ restaurantId: "valid-r1", level: 1 }));
    orderMocks.findOne.mockReturnValue(mockFindOneChain(null));
    orderMocks.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });
    reservationMocks.findOne.mockReturnValue(mockFindOneChain(null));
  });

  it("tables denied blocks cleanup and find", async () => {
    const q = (await import("../../graphql/resolvers/table/query.js")).default;
    authMocks.requireRestaurantPermission.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(q.tables(null, { restaurantId: "valid-r1" }, {})).rejects.toThrow();
    expect(tableMocks.updateMany).not.toHaveBeenCalled(); expect(tableMocks.find).not.toHaveBeenCalled();
  });
  it("tableByCode denied blocks cleanup and findOne", async () => {
    const q = (await import("../../graphql/resolvers/table/query.js")).default;
    authMocks.requireRestaurantPermission.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(q.tableByCode(null, { restaurantId: "valid-r1", floorId: "valid-f1", code: "A" }, {})).rejects.toThrow();
    expect(tableMocks.updateMany).not.toHaveBeenCalled(); expect(tableMocks.findOne).not.toHaveBeenCalled();
  });

  it("createTable denied", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; authMocks.requireRestaurantPermission.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.createTable(null,{input:{restaurantId:"valid-r1",floorId:"valid-f1",code:"A"}},{})).rejects.toThrow(); expect(tableMocks.find).not.toHaveBeenCalled(); expect(floorMocks.findById).not.toHaveBeenCalled(); expect(tableMocks.create).not.toHaveBeenCalled(); });
  it("mergeTables denied", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; authMocks.requireRestaurantPermission.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.mergeTables(null,{input:{restaurantId:"valid-r1",tableIds:["valid-a","valid-b"]}},{})).rejects.toThrow(); expect(tableMocks.find).not.toHaveBeenCalled(); expect(tableMocks.updateMany).not.toHaveBeenCalled(); expect(eventMocks.logEvent).not.toHaveBeenCalled(); });
  it("mergeTables rejects an anchor outside tableIds", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    tableMocks.find.mockReturnValueOnce(
      selectLeanWrap([
        { _id: "valid-a", restaurantId: "valid-r1", floorId: "valid-f1", code: "A1" },
        { _id: "valid-b", restaurantId: "valid-r1", floorId: "valid-f1", code: "B1" },
      ])
    );

    await expect(
      m.mergeTables(
        null,
        {
          input: {
            restaurantId: "valid-r1",
            tableIds: ["valid-a", "valid-b"],
            anchorId: "valid-outside",
          },
        },
        {}
      )
    ).rejects.toThrow("anchorId must belong to tableIds");
    expect(tableMocks.updateMany).not.toHaveBeenCalled();
  });
  it("mergeTables requires existing groups to be split first", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    tableMocks.find.mockReturnValueOnce(
      selectLeanWrap([
        {
          _id: "valid-a",
          restaurantId: "valid-r1",
          floorId: "valid-f1",
          code: "A1",
          joinGroupId: "existing-group",
        },
        { _id: "valid-b", restaurantId: "valid-r1", floorId: "valid-f1", code: "B1" },
      ])
    );

    await expect(
      m.mergeTables(
        null,
        {
          input: {
            restaurantId: "valid-r1",
            tableIds: ["valid-a", "valid-b"],
            anchorId: "valid-a",
          },
        },
        {}
      )
    ).rejects.toThrow("đang thuộc nhóm khác");
    expect(tableMocks.updateMany).not.toHaveBeenCalled();
  });
  it("mergeTables rejects tables from different floors", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    tableMocks.find.mockReturnValueOnce(
      selectLeanWrap([
        { _id: "valid-a", restaurantId: "valid-r1", floorId: "valid-f1", code: "A1" },
        { _id: "valid-b", restaurantId: "valid-r1", floorId: "valid-f2", code: "B1" },
      ])
    );

    await expect(
      m.mergeTables(null, { input: { restaurantId: "valid-r1", tableIds: ["valid-a", "valid-b"] } }, {})
    ).rejects.toThrow("Cannot merge tables from different floors");
    expect(tableMocks.updateMany).not.toHaveBeenCalled();
    expect(eventMocks.logEvent).not.toHaveBeenCalled();
  });
  it("splitTables denied", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; authMocks.requireRestaurantPermission.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.splitTables(null,{input:{restaurantId:"valid-r1",joinGroupId:"g1",mode:"ALL"}},{})).rejects.toThrow(); expect(tableMocks.updateMany).not.toHaveBeenCalled(); expect(tableMocks.find).not.toHaveBeenCalled(); expect(eventMocks.logEvent).not.toHaveBeenCalled(); });
  it("splitTables ALL returns only tables from the requested group", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    tableMocks.find.mockReturnValueOnce(
      selectLeanWrap([{ _id: "valid-a" }, { _id: "valid-b" }])
    );
    tableMocks.updateMany.mockResolvedValueOnce({ modifiedCount: 2 });

    const result = await m.splitTables(
      null,
      { input: { restaurantId: "valid-r1", joinGroupId: "g1", mode: "ALL" } },
      {}
    );

    expect(result.unmergedTableIds).toEqual(["valid-a", "valid-b"]);
    expect(tableMocks.updateMany).toHaveBeenCalledWith(
      {
        restaurantId: "valid-r1",
        joinGroupId: "g1",
        _id: { $in: ["valid-a", "valid-b"] },
      },
      {
        $set: { isJoinable: false },
        $unset: { joinGroupId: "" },
      }
    );
  });
  it("splitTables PARTIAL ignores ids outside the requested group", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    tableMocks.find.mockReturnValueOnce(
      selectLeanWrap([{ _id: "valid-a" }, { _id: "valid-b" }, { _id: "valid-c" }])
    );
    tableMocks.updateMany.mockResolvedValueOnce({ modifiedCount: 1 });

    const result = await m.splitTables(
      null,
      {
        input: {
          restaurantId: "valid-r1",
          joinGroupId: "g1",
          mode: "PARTIAL",
          tableIds: ["valid-a", "valid-outside"],
        },
      },
      {}
    );

    expect(result.unmergedTableIds).toEqual(["valid-a"]);
  });
  it("splitTables PARTIAL dissolves a one-table remainder", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    tableMocks.find.mockReturnValueOnce(
      selectLeanWrap([{ _id: "valid-a" }, { _id: "valid-b" }])
    );
    tableMocks.updateMany.mockResolvedValueOnce({ modifiedCount: 2 });

    const result = await m.splitTables(
      null,
      {
        input: {
          restaurantId: "valid-r1",
          joinGroupId: "g1",
          mode: "PARTIAL",
          tableIds: ["valid-a"],
        },
      },
      {}
    );

    expect(result.unmergedTableIds).toEqual(["valid-a", "valid-b"]);
  });
  it("swapTableCodes denied", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; authMocks.requireRestaurantPermission.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.swapTableCodes(null,{input:{restaurantId:"valid-r1",floorId:"valid-f1",aId:"valid-a",bId:"valid-b"}},{})).rejects.toThrow(); expect(tableMocks.findOne).not.toHaveBeenCalled(); expect(tableMocks.updateOne).not.toHaveBeenCalled(); expect(eventMocks.logEvent).not.toHaveBeenCalled(); });
  it("bulkUpsertTables denied", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; authMocks.requireRestaurantPermission.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.bulkUpsertTables(null,{input:{restaurantId:"valid-r1",floorId:"valid-f1",items:[]}},{})).rejects.toThrow(); expect(floorMocks.findById).not.toHaveBeenCalled(); expect(tableMocks.bulkWrite).not.toHaveBeenCalled(); });

  it("updateTable denied after load", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; authMocks.requireRestaurantPermission.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.updateTable(null,{input:{id:"valid-t1",code:"B"}},{})).rejects.toThrow(); expect(tableMocks.findByIdAndUpdate).not.toHaveBeenCalled(); });
  it("deleteTable denied after load", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; tableMocks.findById.mockReturnValueOnce(leanWrap({ _id:"valid-t1", restaurantId:"valid-r1" })); authMocks.requireRestaurantPermission.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.deleteTable(null,{id:"valid-t1"},{})).rejects.toThrow(); expect(tableMocks.deleteOne).not.toHaveBeenCalled(); expect(eventMocks.logEvent).not.toHaveBeenCalled(); });
  it("deleteTable blocked when active table_session exists", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    tableMocks.findById.mockReturnValueOnce(
      leanWrap({ _id: "valid-t1", restaurantId: "valid-r1", code: "A1" })
    );
    orderMocks.findOne
      .mockReturnValueOnce(mockFindOneChain({ _id: "session-1" }));

    await expect(m.deleteTable(null, { id: "valid-t1" }, {})).rejects.toMatchObject({
      message: "Không thể xóa bàn đang có phiên hoặc order hoạt động.",
      extensions: { code: "TABLE_HAS_ACTIVE_ORDERS" },
    });
    expect(orderMocks.findOne).toHaveBeenCalledTimes(1);
    expect(tableMocks.deleteOne).not.toHaveBeenCalled();
  });
  it("deleteTable blocked when active legacy/order_batch exists", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    tableMocks.findById.mockReturnValueOnce(
      leanWrap({ _id: "valid-t1", restaurantId: "valid-r1", code: "A1" })
    );
    orderMocks.findOne
      .mockReturnValueOnce(mockFindOneChain(null))
      .mockReturnValueOnce(mockFindOneChain({ _id: "legacy-1" }));

    await expect(m.deleteTable(null, { id: "valid-t1" }, {})).rejects.toMatchObject({
      message: "Không thể xóa bàn đang có phiên hoặc order hoạt động.",
      extensions: { code: "TABLE_HAS_ACTIVE_ORDERS" },
    });
    expect(orderMocks.findOne).toHaveBeenCalledTimes(2);
    expect(tableMocks.deleteOne).not.toHaveBeenCalled();
  });
  it("deleteTable succeeds when no active session/order", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    tableMocks.findById.mockReturnValueOnce(
      leanWrap({ _id: "valid-t1", restaurantId: "valid-r1", floorId: "valid-f1", code: "A1", name: "A1", status: "available" })
    );
    orderMocks.findOne.mockReturnValueOnce(mockFindOneChain(null)).mockReturnValueOnce(mockFindOneChain(null));
    tableMocks.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });

    await expect(m.deleteTable(null, { id: "valid-t1" }, {})).resolves.toBe(true);
    expect(orderMocks.findOne).toHaveBeenCalledTimes(2);
    expect(tableMocks.deleteOne).toHaveBeenCalledWith({ _id: "valid-t1" });
  });
  it("deleteTable succeeds when reservation exists but inactive", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    tableMocks.findById.mockReturnValueOnce(
      leanWrap({ _id: "valid-t1", restaurantId: "valid-r1", floorId: "valid-f1", code: "A1", name: "A1", status: "reserved" })
    );
    orderMocks.findOne.mockReturnValueOnce(mockFindOneChain(null)).mockReturnValueOnce(mockFindOneChain(null));
    reservationMocks.findOne.mockReturnValueOnce(mockFindOneChain(null));
    tableMocks.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });

    await expect(m.deleteTable(null, { id: "valid-t1" }, {})).resolves.toBe(true);
    expect(tableMocks.deleteOne).toHaveBeenCalledWith({ _id: "valid-t1" });
  });
  it("moveTable denied after load", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; authMocks.requireRestaurantPermission.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.moveTable(null,{input:{id:"valid-t1",floorId:"valid-f2"}},{user:{id:"u1",roleName:"manager"}})).rejects.toThrow(); expect(floorMocks.findById).not.toHaveBeenCalled(); expect(tableMocks.findByIdAndUpdate).not.toHaveBeenCalled(); });
  it("setTableStatus denied after load", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; authMocks.requireRestaurantPermission.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.setTableStatus(null,{input:{id:"valid-t1",status:"OPEN"}},{})).rejects.toThrow(); expect(tableMocks.findByIdAndUpdate).not.toHaveBeenCalled(); });
  it("setTableStatus blocked when active table_session exists and target is available", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    orderMocks.findOne.mockReturnValueOnce(
      mockFindOneChain({ _id: "session-1", items: [{ status: "preparing" }] })
    );
    await expect(
      m.setTableStatus(null, { input: { id: "valid-t1", status: "available" } }, {})
    ).rejects.toMatchObject({
      message: "Không thể trả bàn về trống vì còn món chưa phục vụ.",
      extensions: { code: "TABLE_HAS_UNSERVED_ITEMS" },
    });
    expect(orderMocks.findOne).toHaveBeenCalledTimes(1);
    expect(tableMocks.findByIdAndUpdate).not.toHaveBeenCalled();
  });
  it("setTableStatus blocked when active legacy/order_batch exists and target is available", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    orderMocks.findOne
      .mockReturnValueOnce(mockFindOneChain(null))
      .mockReturnValueOnce(mockFindOneChain(null));
    orderMocks.find.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          _id: "legacy-1",
          orderPaymentStatus: "unpaid",
          totals: { grandTotal: 200 },
          items: [{ status: "served" }],
          currentStatus: "open",
        },
      ]),
    });
    await expect(
      m.setTableStatus(null, { input: { id: "valid-t1", status: "available" } }, {})
    ).rejects.toMatchObject({
      message: "Không thể trả bàn về trống vì còn hóa đơn chưa thanh toán.",
      extensions: { code: "TABLE_HAS_UNPAID_ORDERS" },
    });
    expect(orderMocks.findOne).toHaveBeenCalledTimes(1);
    expect(tableMocks.findByIdAndUpdate).not.toHaveBeenCalled();
  });
  it("setTableStatus blocked when active table_session exists and target is cleaning", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    orderMocks.findOne.mockReturnValueOnce(mockFindOneChain({ _id: "session-1" }));
    await expect(
      m.setTableStatus(null, { input: { id: "valid-t1", status: "cleaning" } }, {})
    ).rejects.toMatchObject({
      message: "Không thể chuyển trạng thái bàn khi còn phiên hoặc order hoạt động.",
      extensions: { code: "TABLE_HAS_ACTIVE_ORDERS" },
    });
    expect(orderMocks.findOne).toHaveBeenCalledTimes(2);
    expect(tableMocks.findByIdAndUpdate).not.toHaveBeenCalled();
  });
  it("setTableStatus blocked when active reservation exists and target is cleaning", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    orderMocks.findOne.mockReturnValueOnce(mockFindOneChain(null)).mockReturnValueOnce(mockFindOneChain(null));
    orderMocks.find.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });
    reservationMocks.findOne.mockReturnValueOnce(mockFindOneChain({ _id: "rsv-1" }));
    await expect(
      m.setTableStatus(null, { input: { id: "valid-t1", status: "cleaning" } }, {})
    ).rejects.toMatchObject({
      message: "Không thể chuyển trạng thái bàn khi còn đặt chỗ hoạt động.",
      extensions: { code: "TABLE_HAS_ACTIVE_RESERVATION" },
    });
    expect(tableMocks.findByIdAndUpdate).not.toHaveBeenCalled();
  });
  it("setTableStatus non-guarded status still updates when active session exists", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    await expect(
      m.setTableStatus(null, { input: { id: "valid-t1", status: "OPEN" } }, {})
    ).resolves.toMatchObject({ _id: "valid-t1" });
    expect(orderMocks.findOne).toHaveBeenCalledTimes(0);
    expect(tableMocks.findByIdAndUpdate).toHaveBeenCalled();
  });
  it("setTableStatus available succeeds when no active session/order exists", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    orderMocks.findOne
      .mockReturnValueOnce(mockFindOneChain(null))
      .mockReturnValueOnce(mockFindOneChain(null));
    orderMocks.find.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });
    reservationMocks.findOne.mockReturnValueOnce(mockFindOneChain(null));
    await expect(
      m.setTableStatus(null, { input: { id: "valid-t1", status: "available" } }, {})
    ).resolves.toMatchObject({ _id: "valid-t1" });
    expect(orderMocks.findOne).toHaveBeenCalledTimes(1);
    expect(tableMocks.findByIdAndUpdate).toHaveBeenCalled();
  });
  it("acquire lock denied after load", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; tableMocks.findById.mockReturnValueOnce(leanWrap({ _id:"valid-t1", restaurantId:"valid-r1" })); const io={to:vi.fn(()=>({emit:vi.fn()}))}; authMocks.requireRestaurantPermission.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.acquireTableViewLock(null,{input:{tableId:"valid-t1",userId:"valid-u1"}},{io})).rejects.toThrow(); expect(tableMocks.findOneAndUpdate).not.toHaveBeenCalled(); expect(io.to).not.toHaveBeenCalled(); });
  it("release lock denied after load", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; tableMocks.findById.mockReturnValueOnce(selectLeanWrap({ restaurantId:"valid-r1" })); const io={to:vi.fn(()=>({emit:vi.fn()}))}; authMocks.requireRestaurantPermission.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.releaseTableViewLock(null,{input:{tableId:"valid-t1",userId:"valid-u1"}},{io})).rejects.toThrow(); expect(tableMocks.findOneAndUpdate).not.toHaveBeenCalled(); expect(io.to).not.toHaveBeenCalled(); });

  it("tables allowed calls guard and find", async () => { const q=(await import("../../graphql/resolvers/table/query.js")).default; await q.tables(null,{restaurantId:"valid-r1"},{user:{id:"u1",roleName:"manager"}}); expect(authMocks.requireRestaurantPermission).toHaveBeenCalledWith({user:{id:"u1",roleName:"manager"}},"valid-r1", expect.any(String)); expect(tableMocks.find).toHaveBeenCalled(); });
  it("createTable allowed guard before create", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; await m.createTable(null,{input:{restaurantId:"valid-r1",floorId:"valid-f1",code:"A"}},{user:{id:"u1",roleName:"manager"}}); expect(authMocks.requireRestaurantPermission.mock.invocationCallOrder[0]).toBeLessThan(tableMocks.create.mock.invocationCallOrder[0]); });
  it("setTableStatus allowed updates", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; await m.setTableStatus(null,{input:{id:"valid-t1",status:"OPEN"}},{user:{id:"u1",roleName:"manager"}}); expect(tableMocks.findByIdAndUpdate).toHaveBeenCalled(); });

  it("updateTable rejects cross-restaurant floor", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; floorMocks.findById.mockReturnValueOnce(selectLeanWrap({ restaurantId:"valid-r2", level:2 })); await expect(m.updateTable(null,{input:{id:"valid-t1",floorId:"valid-floor-2"}},{user:{id:"u1",roleName:"manager",role:{permissions:[{code:"table.read"},{code:"table.write"}],parentRole:{permissions:[]}}}})).rejects.toThrow("Floor does not belong to this restaurant"); expect(tableMocks.findByIdAndUpdate).not.toHaveBeenCalled(); });
  it("moveTable rejects cross-restaurant floor", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; floorMocks.findById.mockReturnValueOnce(selectLeanWrap({ restaurantId:"valid-r2", level:2 })); await expect(m.moveTable(null,{input:{id:"valid-t1",floorId:"valid-floor-2"}},{user:{id:"u1",roleName:"manager",role:{permissions:[{code:"table.read"},{code:"table.write"}],parentRole:{permissions:[]}}}})).rejects.toThrow("Floor does not belong to this restaurant"); expect(tableMocks.findByIdAndUpdate).not.toHaveBeenCalled(); });
});
