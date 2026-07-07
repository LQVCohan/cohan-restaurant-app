import { beforeEach, describe, expect, it, vi } from "vitest";

const tableMocks = vi.hoisted(() => ({
  find: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  deleteOne: vi.fn(),
  findById: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({ logEvent: vi.fn() }));
const stateGuardMocks = vi.hoisted(() => ({
  hasActiveOrdersForTable: vi.fn(),
  hasActiveReservationsForTable: vi.fn(),
}));

vi.mock("../../models/table.model.js", () => ({ default: tableMocks }));
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("../../src/services/eventLog.service.js", () => eventMocks);
vi.mock("../../utils/tableStateGuards.js", () => stateGuardMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: (value) => String(value || "").startsWith("valid-"),
    Types: { ObjectId: vi.fn() },
  },
}));

const leanWrap = (value) => ({ lean: vi.fn().mockResolvedValue(value) });
const tableListWrap = (value) => ({
  select: vi.fn().mockReturnThis(),
  sort: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value),
});

const sourceTables = [
  {
    _id: "valid-a1",
    restaurantId: "valid-r1",
    floorId: "valid-f1",
    floorLevel: 1,
    code: "A1",
    type: "standard",
    capacity: 4,
    position: { x: 80, y: 80, w: 80, h: 80, shape: "rect" },
    status: "available",
    tags: ["sảnh chính"],
    deposit: 0,
  },
  {
    _id: "valid-a2",
    restaurantId: "valid-r1",
    floorId: "valid-f1",
    floorLevel: 1,
    code: "A2",
    type: "standard",
    capacity: 6,
    position: { x: 180, y: 80, w: 80, h: 80, shape: "rect" },
    status: "available",
    tags: ["sảnh chính"],
    deposit: 0,
  },
];

describe("composite table merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireRestaurantPermission.mockResolvedValue();
    eventMocks.logEvent.mockResolvedValue();
    stateGuardMocks.hasActiveOrdersForTable.mockResolvedValue(false);
    stateGuardMocks.hasActiveReservationsForTable.mockResolvedValue(false);
    tableMocks.updateMany.mockResolvedValue({ modifiedCount: 2 });
    tableMocks.deleteOne.mockResolvedValue({ deletedCount: 1 });
  });

  it("creates one merged table with summed capacity and hides its source tables", async () => {
    tableMocks.find.mockReturnValueOnce(leanWrap(sourceTables));
    tableMocks.create.mockResolvedValue({
      _id: "valid-merged",
      id: "valid-merged",
    });

    const mutations = (
      await import("../../graphql/resolvers/table/mergeTables.js")
    ).default;
    const result = await mutations.mergeTables(
      null,
      {
        input: {
          restaurantId: "valid-r1",
          tableIds: ["valid-a1", "valid-a2"],
          anchorId: "valid-a1",
          joinGroupId: "group-1",
        },
      },
      { user: { id: "valid-user" }, req: { headers: {} } },
    );

    expect(tableMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "valid-r1",
        floorId: "valid-f1",
        code: "A1+A2",
        capacity: 10,
        position: sourceTables[0].position,
        joinGroupId: "group-1",
        mergedFromTableIds: ["valid-a1", "valid-a2"],
      }),
    );
    expect(tableMocks.updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: ["valid-a1", "valid-a2"] },
        restaurantId: "valid-r1",
        joinGroupId: null,
        mergedIntoTableId: null,
      },
      {
        $set: {
          isJoinable: true,
          joinGroupId: "group-1",
          mergedIntoTableId: "valid-merged",
        },
      },
    );
    expect(result).toEqual({
      joinGroupId: "group-1",
      anchorId: "valid-a1",
      tableIds: ["valid-a1", "valid-a2"],
    });
  });

  it("deletes the composite and restores all source tables when split", async () => {
    tableMocks.find.mockReturnValueOnce(
      leanWrap([
        {
          _id: "valid-merged",
          restaurantId: "valid-r1",
          floorId: "valid-f1",
          code: "A1+A2",
          joinGroupId: "group-1",
          mergedFromTableIds: ["valid-a1", "valid-a2"],
        },
        {
          _id: "valid-a1",
          joinGroupId: "group-1",
          mergedIntoTableId: "valid-merged",
        },
        {
          _id: "valid-a2",
          joinGroupId: "group-1",
          mergedIntoTableId: "valid-merged",
        },
      ]),
    );

    const mutations = (
      await import("../../graphql/resolvers/table/mergeTables.js")
    ).default;
    const result = await mutations.splitTables(
      null,
      {
        input: {
          restaurantId: "valid-r1",
          joinGroupId: "group-1",
          mode: "PARTIAL",
          tableIds: ["valid-merged"],
        },
      },
      { user: { id: "valid-user" }, req: { headers: {} } },
    );

    expect(tableMocks.updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: ["valid-a1", "valid-a2"] },
        restaurantId: "valid-r1",
        mergedIntoTableId: "valid-merged",
      },
      {
        $set: { isJoinable: false },
        $unset: { joinGroupId: "", mergedIntoTableId: "" },
      },
    );
    expect(tableMocks.deleteOne).toHaveBeenCalledWith({
      _id: "valid-merged",
      restaurantId: "valid-r1",
      joinGroupId: "group-1",
    });
    expect(result).toEqual({
      ok: true,
      unmergedTableIds: ["valid-a1", "valid-a2"],
    });
  });

  it("filters source tables from the regular table list", async () => {
    tableMocks.updateMany.mockResolvedValue({ modifiedCount: 0 });
    tableMocks.find.mockReturnValueOnce(tableListWrap([]));

    const queries = (await import("../../graphql/resolvers/table/query.js")).default;
    await queries.tables(
      null,
      { restaurantId: "valid-r1", limit: 200 },
      {},
    );

    expect(tableMocks.find).toHaveBeenCalledWith({
      restaurantId: "valid-r1",
      mergedIntoTableId: null,
    });
  });
});
