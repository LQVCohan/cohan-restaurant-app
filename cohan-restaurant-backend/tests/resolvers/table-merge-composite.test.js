import { beforeEach, describe, expect, it, vi } from "vitest";

const tableMocks = vi.hoisted(() => ({
  find: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  bulkWrite: vi.fn(),
  deleteOne: vi.fn(),
  findById: vi.fn(),
}));
const orderMocks = vi.hoisted(() => ({
  find: vi.fn(),
  bulkWrite: vi.fn(),
}));
const reservationMocks = vi.hoisted(() => ({
  find: vi.fn(),
  updateOne: vi.fn(),
  bulkWrite: vi.fn(),
}));
const tableCustomerMocks = vi.hoisted(() => ({ find: vi.fn() }));
const authMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({ logEvent: vi.fn() }));
const stateGuardMocks = vi.hoisted(() => ({
  hasActiveOrdersForTable: vi.fn(),
  hasActiveReservationsForTable: vi.fn(),
}));
const startSessionMock = vi.hoisted(() => vi.fn());

vi.mock("../../models/table.model.js", () => ({ default: tableMocks }));
vi.mock("../../models/order.model.js", () => ({ default: orderMocks }));
vi.mock("../../models/reservation.model.js", () => ({
  default: reservationMocks,
}));
vi.mock("../../models/tableCustomer.model.js", () => ({
  default: tableCustomerMocks,
}));
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("../../src/services/eventLog.service.js", () => eventMocks);
vi.mock("../../utils/tableStateGuards.js", () => stateGuardMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: (value) => String(value || "").startsWith("valid-"),
    startSession: startSessionMock,
    Types: {
      ObjectId: vi.fn(function ObjectId(value) {
        return value || "valid-generated-group";
      }),
    },
  },
}));

function queryResult(value) {
  const chain = {
    session: vi.fn(),
    select: vi.fn(),
    sort: vi.fn(),
    limit: vi.fn(),
    lean: vi.fn().mockResolvedValue(value),
  };
  chain.session.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

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

const context = {
  user: { id: "valid-user" },
  req: { ip: "127.0.0.1", headers: {} },
};

const mergeInput = {
  restaurantId: "valid-r1",
  tableIds: ["valid-a1", "valid-a2"],
  anchorId: "valid-a1",
  joinGroupId: "group-1",
};

describe("composite table lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireRestaurantPermission.mockResolvedValue();
    eventMocks.logEvent.mockResolvedValue();
    stateGuardMocks.hasActiveOrdersForTable.mockResolvedValue(false);
    stateGuardMocks.hasActiveReservationsForTable.mockResolvedValue(false);

    startSessionMock.mockResolvedValue({
      withTransaction: vi.fn(async (callback) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined),
    });

    tableMocks.find.mockReturnValue(queryResult(sourceTables));
    tableMocks.create.mockResolvedValue([
      { _id: "valid-merged", id: "valid-merged" },
    ]);
    tableMocks.updateMany.mockResolvedValue({ modifiedCount: 2 });
    tableMocks.bulkWrite.mockResolvedValue({ modifiedCount: 2 });
    tableMocks.deleteOne.mockResolvedValue({ deletedCount: 1 });

    reservationMocks.find.mockReturnValue(queryResult([]));
    reservationMocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
    reservationMocks.bulkWrite.mockResolvedValue({ modifiedCount: 1 });
    orderMocks.find.mockReturnValue(queryResult([]));
    orderMocks.bulkWrite.mockResolvedValue({ modifiedCount: 0 });
    tableCustomerMocks.find.mockReturnValue(queryResult([]));
  });

  it("creates a new queryable table with summed capacity and bounding geometry", async () => {
    const mutations = (
      await import("../../graphql/resolvers/table/mergeTables.js")
    ).default;

    const result = await mutations.mergeTables(
      null,
      { input: mergeInput },
      context,
    );

    expect(tableMocks.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          restaurantId: "valid-r1",
          floorId: "valid-f1",
          code: "A1+A2",
          capacity: 10,
          position: {
            x: 80,
            y: 80,
            w: 180,
            h: 80,
            rotation: 0,
            shape: "rect",
          },
          status: "available",
          joinGroupId: "group-1",
          mergedFromTableIds: ["valid-a1", "valid-a2"],
          mergeAnchorTableId: "valid-a1",
          mergedAt: expect.any(Date),
        }),
      ],
      { session: expect.any(Object) },
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
      { session: expect.any(Object) },
    );
    expect(result).toEqual({
      joinGroupId: "group-1",
      anchorId: "valid-a1",
      tableIds: ["valid-a1", "valid-a2"],
      mergedTableId: "valid-merged",
      mergedTableCode: "A1+A2",
    });
  });

  it("moves one active reservation to the composite and preserves its source", async () => {
    reservationMocks.find.mockReturnValueOnce(
      queryResult([
        {
          _id: "valid-rsv-1",
          tableId: "valid-a1",
          status: "confirmed",
          orderCode: "RSV-001",
        },
      ]),
    );

    const mutations = (
      await import("../../graphql/resolvers/table/mergeTables.js")
    ).default;
    await mutations.mergeTables(null, { input: mergeInput }, context);

    expect(tableMocks.create).toHaveBeenCalledWith(
      [expect.objectContaining({ status: "reserved" })],
      { session: expect.any(Object) },
    );
    expect(reservationMocks.updateOne).toHaveBeenCalledWith(
      { _id: "valid-rsv-1", restaurantId: "valid-r1" },
      {
        $set: {
          tableId: "valid-merged",
          sourceTableId: "valid-a1",
          sourceTableCode: "A1",
          tableMergeGroupId: "group-1",
        },
      },
      { session: expect.any(Object) },
    );
  });

  it("rejects merge when active reservations belong to two source tables", async () => {
    reservationMocks.find.mockReturnValueOnce(
      queryResult([
        { _id: "valid-rsv-1", tableId: "valid-a1", status: "confirmed" },
        { _id: "valid-rsv-2", tableId: "valid-a2", status: "seated" },
      ]),
    );

    const mutations = (
      await import("../../graphql/resolvers/table/mergeTables.js")
    ).default;

    await expect(
      mutations.mergeTables(null, { input: mergeInput }, context),
    ).rejects.toMatchObject({
      message: expect.stringContaining("hai đơn đặt bàn"),
      extensions: { code: "TABLE_MULTIPLE_ACTIVE_RESERVATIONS" },
    });
    expect(tableMocks.create).not.toHaveBeenCalled();
    expect(tableMocks.updateMany).not.toHaveBeenCalled();
  });

  it("keeps two source order sessions distinct while making the composite occupied", async () => {
    orderMocks.find.mockReturnValueOnce(
      queryResult([
        {
          _id: "valid-order-a1",
          tableId: "valid-a1",
          tableCode: "A1",
          orderKind: "order_batch",
          parentOrderId: "valid-session-a1",
          orderCode: "POS-A1-001",
          totals: { grandTotal: 100000 },
        },
        {
          _id: "valid-order-a2",
          tableId: "valid-a2",
          tableCode: "A2",
          orderKind: "order_batch",
          parentOrderId: "valid-session-a2",
          orderCode: "POS-A2-001",
          totals: { grandTotal: 150000 },
        },
      ]),
    );

    const mutations = (
      await import("../../graphql/resolvers/table/mergeTables.js")
    ).default;
    await mutations.mergeTables(null, { input: mergeInput }, context);

    expect(tableMocks.create).toHaveBeenCalledWith(
      [expect.objectContaining({ status: "occupied" })],
      { session: expect.any(Object) },
    );
    expect(orderMocks.bulkWrite).not.toHaveBeenCalled();
    expect(eventMocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          activeOrderCount: 2,
          activeOrderSessionCount: 2,
        }),
      }),
    );
  });

  it("restores reservation and source statuses when the composite is split", async () => {
    const composite = {
      _id: "valid-merged",
      restaurantId: "valid-r1",
      floorId: "valid-f1",
      code: "A1+A2",
      joinGroupId: "group-1",
      mergeAnchorTableId: "valid-a1",
      mergedFromTableIds: ["valid-a1", "valid-a2"],
    };
    const hiddenSources = sourceTables.map((table) => ({
      ...table,
      joinGroupId: "group-1",
      mergedIntoTableId: "valid-merged",
    }));

    tableMocks.find
      .mockReturnValueOnce(queryResult([composite, ...hiddenSources]))
      .mockReturnValueOnce(queryResult(hiddenSources));
    reservationMocks.find
      .mockReturnValueOnce(
        queryResult([
          {
            _id: "valid-rsv-1",
            tableId: "valid-merged",
            sourceTableId: "valid-a1",
            sourceTableCode: "A1",
            tableMergeGroupId: "group-1",
            status: "confirmed",
          },
        ]),
      )
      .mockReturnValueOnce(
        queryResult([
          {
            _id: "valid-rsv-1",
            tableId: "valid-a1",
            status: "confirmed",
          },
        ]),
      );
    orderMocks.find
      .mockReturnValueOnce(queryResult([]))
      .mockReturnValueOnce(
        queryResult([
          {
            _id: "valid-order-a1",
            tableId: "valid-a1",
            currentStatus: "served",
          },
        ]),
      );
    tableCustomerMocks.find.mockReturnValueOnce(queryResult([]));

    const mutations = (
      await import("../../graphql/resolvers/table/mergeTables.js")
    ).default;
    const result = await mutations.splitTables(
      null,
      {
        input: {
          restaurantId: "valid-r1",
          joinGroupId: "group-1",
          mode: "ALL",
        },
      },
      context,
    );

    expect(reservationMocks.bulkWrite).toHaveBeenCalledWith(
      [
        {
          updateOne: {
            filter: { _id: "valid-rsv-1", restaurantId: "valid-r1" },
            update: {
              $set: { tableId: "valid-a1" },
              $unset: {
                sourceTableId: "",
                sourceTableCode: "",
                tableMergeGroupId: "",
              },
            },
          },
        },
      ],
      { session: expect.any(Object) },
    );

    const sourceUpdates = tableMocks.bulkWrite.mock.calls[0][0];
    expect(sourceUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: expect.objectContaining({ _id: "valid-a1" }),
            update: expect.objectContaining({
              $set: expect.objectContaining({ status: "occupied" }),
            }),
          }),
        }),
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: expect.objectContaining({ _id: "valid-a2" }),
            update: expect.objectContaining({
              $set: expect.objectContaining({ status: "available" }),
            }),
          }),
        }),
      ]),
    );
    expect(tableMocks.deleteOne).toHaveBeenCalledWith(
      {
        _id: "valid-merged",
        restaurantId: "valid-r1",
        joinGroupId: "group-1",
      },
      { session: expect.any(Object) },
    );
    expect(result).toEqual({
      ok: true,
      unmergedTableIds: ["valid-a1", "valid-a2"],
    });
  });
});
