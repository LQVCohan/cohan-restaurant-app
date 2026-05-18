import { beforeEach, describe, expect, it, vi } from "vitest";

const tableMocks = vi.hoisted(() => ({
  updateMany: vi.fn(), find: vi.fn(), findOne: vi.fn(), create: vi.fn(),
  findById: vi.fn(), findByIdAndUpdate: vi.fn(), deleteOne: vi.fn(),
  updateOne: vi.fn(), bulkWrite: vi.fn(), findOneAndUpdate: vi.fn(),
}));
const floorMocks = vi.hoisted(() => ({ findById: vi.fn() }));
const orderMocks = vi.hoisted(() => ({ findOne: vi.fn() }));
const guardMocks = vi.hoisted(() => ({ requireRestaurantAccess: vi.fn() }));
const eventMocks = vi.hoisted(() => ({ logEvent: vi.fn() }));
const mongooseMocks = vi.hoisted(() => ({
  isValidObjectId: vi.fn((v) => String(v).startsWith("valid-") || /^[a-f\d]{24}$/i.test(String(v))),
  Types: { ObjectId: vi.fn((v) => v) },
}));

vi.mock("../../models/table.model.js", () => ({ default: tableMocks }));
vi.mock("../../models/floor.model.js", () => ({ default: floorMocks }));
vi.mock("../../models/order.model.js", () => ({ default: orderMocks }));
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../src/services/eventLog.service.js", () => eventMocks);
vi.mock("mongoose", () => ({ default: mongooseMocks }));

const leanWrap = (value) => ({ lean: vi.fn().mockResolvedValue(value) });
const selectLeanWrap = (value) => ({ select: vi.fn(() => leanWrap(value)) });

describe("table restaurant access guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue();
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
    orderMocks.findOne.mockReturnValue(leanWrap(null));
  });

  it("tables denied blocks cleanup and find", async () => {
    const q = (await import("../../graphql/resolvers/table/query.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(q.tables(null, { restaurantId: "valid-r1" }, {})).rejects.toThrow();
    expect(tableMocks.updateMany).not.toHaveBeenCalled(); expect(tableMocks.find).not.toHaveBeenCalled();
  });
  it("tableByCode denied blocks cleanup and findOne", async () => {
    const q = (await import("../../graphql/resolvers/table/query.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(q.tableByCode(null, { restaurantId: "valid-r1", floorId: "valid-f1", code: "A" }, {})).rejects.toThrow();
    expect(tableMocks.updateMany).not.toHaveBeenCalled(); expect(tableMocks.findOne).not.toHaveBeenCalled();
  });

  it("createTable denied", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.createTable(null,{input:{restaurantId:"valid-r1",floorId:"valid-f1",code:"A"}},{})).rejects.toThrow(); expect(tableMocks.find).not.toHaveBeenCalled(); expect(floorMocks.findById).not.toHaveBeenCalled(); expect(tableMocks.create).not.toHaveBeenCalled(); });
  it("mergeTables denied", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.mergeTables(null,{input:{restaurantId:"valid-r1",tableIds:["valid-a","valid-b"]}},{})).rejects.toThrow(); expect(tableMocks.find).not.toHaveBeenCalled(); expect(tableMocks.updateMany).not.toHaveBeenCalled(); expect(eventMocks.logEvent).not.toHaveBeenCalled(); });
  it("splitTables denied", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.splitTables(null,{input:{restaurantId:"valid-r1",joinGroupId:"g1",mode:"ALL"}},{})).rejects.toThrow(); expect(tableMocks.updateMany).not.toHaveBeenCalled(); expect(tableMocks.find).not.toHaveBeenCalled(); expect(eventMocks.logEvent).not.toHaveBeenCalled(); });
  it("swapTableCodes denied", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.swapTableCodes(null,{input:{restaurantId:"valid-r1",floorId:"valid-f1",aId:"valid-a",bId:"valid-b"}},{})).rejects.toThrow(); expect(tableMocks.findOne).not.toHaveBeenCalled(); expect(tableMocks.updateOne).not.toHaveBeenCalled(); expect(eventMocks.logEvent).not.toHaveBeenCalled(); });
  it("bulkUpsertTables denied", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.bulkUpsertTables(null,{input:{restaurantId:"valid-r1",floorId:"valid-f1",items:[]}},{})).rejects.toThrow(); expect(floorMocks.findById).not.toHaveBeenCalled(); expect(tableMocks.bulkWrite).not.toHaveBeenCalled(); });

  it("updateTable denied after load", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.updateTable(null,{input:{id:"valid-t1",code:"B"}},{})).rejects.toThrow(); expect(tableMocks.findByIdAndUpdate).not.toHaveBeenCalled(); });
  it("deleteTable denied after load", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; tableMocks.findById.mockReturnValueOnce(leanWrap({ _id:"valid-t1", restaurantId:"valid-r1" })); guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.deleteTable(null,{id:"valid-t1"},{})).rejects.toThrow(); expect(tableMocks.deleteOne).not.toHaveBeenCalled(); expect(eventMocks.logEvent).not.toHaveBeenCalled(); });
  it("deleteTable blocked when active table_session exists", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    tableMocks.findById.mockReturnValueOnce(
      leanWrap({ _id: "valid-t1", restaurantId: "valid-r1", code: "A1" })
    );
    orderMocks.findOne
      .mockReturnValueOnce(leanWrap({ _id: "session-1" }))
      .mockReturnValueOnce(leanWrap(null));

    await expect(m.deleteTable(null, { id: "valid-t1" }, {})).rejects.toMatchObject({
      message: "Không thể xóa bàn đang có phiên hoặc order hoạt động.",
      extensions: { code: "TABLE_HAS_ACTIVE_ORDERS" },
    });
    expect(orderMocks.findOne).toHaveBeenCalledTimes(2);
    expect(tableMocks.deleteOne).not.toHaveBeenCalled();
  });
  it("deleteTable blocked when active legacy/order_batch exists", async () => {
    const m = (await import("../../graphql/resolvers/table/mutation.js")).default;
    tableMocks.findById.mockReturnValueOnce(
      leanWrap({ _id: "valid-t1", restaurantId: "valid-r1", code: "A1" })
    );
    orderMocks.findOne
      .mockReturnValueOnce(leanWrap(null))
      .mockReturnValueOnce(leanWrap({ _id: "legacy-1" }));

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
    orderMocks.findOne.mockReturnValueOnce(leanWrap(null)).mockReturnValueOnce(leanWrap(null));
    tableMocks.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });

    await expect(m.deleteTable(null, { id: "valid-t1" }, {})).resolves.toBe(true);
    expect(orderMocks.findOne).toHaveBeenCalledTimes(2);
    expect(tableMocks.deleteOne).toHaveBeenCalledWith({ _id: "valid-t1" });
  });
  it("moveTable denied after load", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.moveTable(null,{input:{id:"valid-t1",floorId:"valid-f2"}},{user:{id:"u1",roleName:"manager"}})).rejects.toThrow(); expect(floorMocks.findById).not.toHaveBeenCalled(); expect(tableMocks.findByIdAndUpdate).not.toHaveBeenCalled(); });
  it("setTableStatus denied after load", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.setTableStatus(null,{input:{id:"valid-t1",status:"OPEN"}},{})).rejects.toThrow(); expect(tableMocks.findByIdAndUpdate).not.toHaveBeenCalled(); });
  it("acquire lock denied after load", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; tableMocks.findById.mockReturnValueOnce(leanWrap({ _id:"valid-t1", restaurantId:"valid-r1" })); const io={to:vi.fn(()=>({emit:vi.fn()}))}; guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.acquireTableViewLock(null,{input:{tableId:"valid-t1",userId:"valid-u1"}},{io})).rejects.toThrow(); expect(tableMocks.findOneAndUpdate).not.toHaveBeenCalled(); expect(io.to).not.toHaveBeenCalled(); });
  it("release lock denied after load", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; tableMocks.findById.mockReturnValueOnce(selectLeanWrap({ restaurantId:"valid-r1" })); const io={to:vi.fn(()=>({emit:vi.fn()}))}; guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE")); await expect(m.releaseTableViewLock(null,{input:{tableId:"valid-t1",userId:"valid-u1"}},{io})).rejects.toThrow(); expect(tableMocks.findOneAndUpdate).not.toHaveBeenCalled(); expect(io.to).not.toHaveBeenCalled(); });

  it("tables allowed calls guard and find", async () => { const q=(await import("../../graphql/resolvers/table/query.js")).default; await q.tables(null,{restaurantId:"valid-r1"},{user:{id:"u1",roleName:"manager"}}); expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith({user:{id:"u1",roleName:"manager"}},"valid-r1"); expect(tableMocks.find).toHaveBeenCalled(); });
  it("createTable allowed guard before create", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; await m.createTable(null,{input:{restaurantId:"valid-r1",floorId:"valid-f1",code:"A"}},{user:{id:"u1",roleName:"manager"}}); expect(guardMocks.requireRestaurantAccess.mock.invocationCallOrder[0]).toBeLessThan(tableMocks.create.mock.invocationCallOrder[0]); });
  it("setTableStatus allowed updates", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; await m.setTableStatus(null,{input:{id:"valid-t1",status:"OPEN"}},{user:{id:"u1",roleName:"manager"}}); expect(tableMocks.findByIdAndUpdate).toHaveBeenCalled(); });

  it("updateTable rejects cross-restaurant floor", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; floorMocks.findById.mockReturnValueOnce(selectLeanWrap({ restaurantId:"valid-r2", level:2 })); await expect(m.updateTable(null,{input:{id:"valid-t1",floorId:"valid-floor-2"}},{user:{id:"u1",roleName:"manager",role:{permissions:[{code:"table.read"},{code:"table.write"}],parentRole:{permissions:[]}}}})).rejects.toThrow("Floor does not belong to this restaurant"); expect(tableMocks.findByIdAndUpdate).not.toHaveBeenCalled(); });
  it("moveTable rejects cross-restaurant floor", async () => { const m=(await import("../../graphql/resolvers/table/mutation.js")).default; floorMocks.findById.mockReturnValueOnce(selectLeanWrap({ restaurantId:"valid-r2", level:2 })); await expect(m.moveTable(null,{input:{id:"valid-t1",floorId:"valid-floor-2"}},{user:{id:"u1",roleName:"manager",role:{permissions:[{code:"table.read"},{code:"table.write"}],parentRole:{permissions:[]}}}})).rejects.toThrow("Floor does not belong to this restaurant"); expect(tableMocks.findByIdAndUpdate).not.toHaveBeenCalled(); });
});
