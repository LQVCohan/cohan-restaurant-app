import { beforeEach, describe, expect, it, vi } from "vitest";

const tableMocks = vi.hoisted(() => ({
  find: vi.fn(),
  create: vi.fn(),
  updateOne: vi.fn(),
  updateMany: vi.fn(),
}));
const floorMocks = vi.hoisted(() => ({ findOne: vi.fn() }));
const authMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
  requireAnyRestaurantPermission: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({ logEvent: vi.fn() }));
const stateGuardMocks = vi.hoisted(() => ({
  hasActiveOrdersForTable: vi.fn(),
  hasActiveReservationsForTable: vi.fn(),
  getTableAvailabilityBlockReason: vi.fn(),
}));
const sessionMocks = vi.hoisted(() => ({
  withTransaction: vi.fn(),
  endSession: vi.fn(),
}));
const startSessionMock = vi.hoisted(() => vi.fn());

vi.mock("../../models/table.model.js", () => ({ default: tableMocks }));
vi.mock("../../models/floor.model.js", () => ({ default: floorMocks }));
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("../../src/services/eventLog.service.js", () => eventMocks);
vi.mock("../../utils/tableStateGuards.js", () => stateGuardMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: (value) => String(value || "").startsWith("valid-"),
    startSession: startSessionMock,
    Types: {
      ObjectId: vi.fn(function ObjectId() {
        return "valid-temp-code";
      }),
    },
  },
}));

const queryResult = (value) => {
  const chain = {
    select: vi.fn(),
    session: vi.fn(),
    lean: vi.fn().mockResolvedValue(value),
  };
  chain.select.mockReturnValue(chain);
  chain.session.mockReturnValue(chain);
  return chain;
};

const context = {
  user: { id: "valid-user" },
  req: { ip: "127.0.0.1", headers: { "user-agent": "vitest" } },
};

const swapInput = {
  restaurantId: "valid-r1",
  floorId: "valid-f1",
  aId: "valid-a1",
  bId: "valid-a2",
};

describe("table management integrity boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireRestaurantPermission.mockResolvedValue();
    authMocks.requireAnyRestaurantPermission.mockResolvedValue();
    eventMocks.logEvent.mockResolvedValue();
    sessionMocks.withTransaction.mockImplementation(async (callback) => callback());
    sessionMocks.endSession.mockResolvedValue();
    startSessionMock.mockResolvedValue(sessionMocks);
    tableMocks.find.mockReturnValue(queryResult([]));
    tableMocks.updateMany.mockResolvedValue({ modifiedCount: 0 });
    floorMocks.findOne.mockReturnValue(queryResult(null));
  });

  it("rejects table creation when the floor is outside the restaurant scope", async () => {
    const mutations = (
      await import("../../graphql/resolvers/table/integrityMutations.js")
    ).default;

    await expect(
      mutations.createTable(
        null,
        {
          input: {
            restaurantId: "valid-r1",
            floorId: "valid-f2",
            code: "A1",
            capacity: 4,
            position: { x: 10, y: 10 },
          },
        },
        context,
      ),
    ).rejects.toMatchObject({
      extensions: {
        code: "TABLE_FLOOR_SCOPE_MISMATCH",
        field: "floorId",
      },
    });

    expect(floorMocks.findOne).toHaveBeenCalledWith({
      _id: "valid-f2",
      restaurantId: "valid-r1",
    });
    expect(tableMocks.create).not.toHaveBeenCalled();
  });

  it("creates a scoped table with normalized code and the floor level", async () => {
    floorMocks.findOne.mockReturnValueOnce(queryResult({ level: 3 }));
    tableMocks.find.mockReturnValueOnce(queryResult([]));
    tableMocks.create.mockResolvedValueOnce({
      toObject: () => ({ id: "valid-t1", code: "A 1", floorLevel: 3 }),
    });
    const mutations = (
      await import("../../graphql/resolvers/table/integrityMutations.js")
    ).default;

    await expect(
      mutations.createTable(
        null,
        {
          input: {
            restaurantId: "valid-r1",
            floorId: "valid-f1",
            code: "  A   1  ",
            capacity: 4,
            position: { x: 10, y: 10 },
          },
        },
        context,
      ),
    ).resolves.toMatchObject({ code: "A 1", floorLevel: 3 });

    expect(tableMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: "A 1", floorLevel: 3 }),
    );
  });

  it("rejects swapping a table with itself before opening a transaction", async () => {
    const mutations = (
      await import("../../graphql/resolvers/table/integrityMutations.js")
    ).default;

    await expect(
      mutations.swapTableCodes(
        null,
        { input: { ...swapInput, bId: swapInput.aId } },
        context,
      ),
    ).rejects.toMatchObject({
      extensions: { code: "TABLE_SWAP_SAME_TABLE" },
    });
    expect(startSessionMock).not.toHaveBeenCalled();
    expect(tableMocks.updateOne).not.toHaveBeenCalled();
  });

  it("swaps both codes in one transaction and logs the real before/after values", async () => {
    tableMocks.find.mockReturnValueOnce(
      queryResult([
        { _id: "valid-a1", code: "A1" },
        { _id: "valid-a2", code: "A2" },
      ]),
    );
    tableMocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
    const mutations = (
      await import("../../graphql/resolvers/table/integrityMutations.js")
    ).default;

    await expect(
      mutations.swapTableCodes(null, { input: swapInput }, context),
    ).resolves.toBe(true);

    expect(sessionMocks.withTransaction).toHaveBeenCalledTimes(1);
    expect(tableMocks.updateOne).toHaveBeenCalledTimes(3);
    expect(tableMocks.updateOne.mock.calls[0][1]).toEqual({
      $set: { code: "__SWAP__valid-temp-code" },
    });
    expect(tableMocks.updateOne.mock.calls[1][1].$set).toMatchObject({
      code: "A1",
      tableAccessToken: null,
      tableAccessUrl: null,
    });
    expect(tableMocks.updateOne.mock.calls[2][1].$set).toMatchObject({
      code: "A2",
      tableAccessToken: null,
      tableAccessUrl: null,
    });
    expect(eventMocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: {
          beforeA: "A1",
          beforeB: "A2",
          afterA: "A2",
          afterB: "A1",
        },
      }),
    );
    expect(sessionMocks.endSession).toHaveBeenCalledTimes(1);
  });

  it("fails the transaction when any guarded swap write changes no row", async () => {
    tableMocks.find.mockReturnValueOnce(
      queryResult([
        { _id: "valid-a1", code: "A1" },
        { _id: "valid-a2", code: "A2" },
      ]),
    );
    tableMocks.updateOne
      .mockResolvedValueOnce({ modifiedCount: 1 })
      .mockResolvedValueOnce({ modifiedCount: 0 });
    const mutations = (
      await import("../../graphql/resolvers/table/integrityMutations.js")
    ).default;

    await expect(
      mutations.swapTableCodes(null, { input: swapInput }, context),
    ).rejects.toMatchObject({
      extensions: { code: "TABLE_SWAP_WRITE_CONFLICT" },
    });
    expect(eventMocks.logEvent).not.toHaveBeenCalled();
    expect(sessionMocks.endSession).toHaveBeenCalledTimes(1);
  });

  it("treats search punctuation literally and keeps limits in range", async () => {
    const { buildTableFilter, normalizeTableLimit } = await import(
      "../../graphql/resolvers/table/query.js"
    );
    const filter = buildTableFilter({
      restaurantId: "valid-r1",
      search: "A[1] (VIP)?",
    });

    expect(filter.$or).toHaveLength(3);
    expect(filter.$or[0].code).toBeInstanceOf(RegExp);
    expect(filter.$or[0].code.test("Bàn A[1] (VIP)?")).toBe(true);
    expect(filter.$or[0].code.test("A1 VIP")).toBe(false);
    expect(normalizeTableLimit(-4)).toBe(1);
    expect(normalizeTableLimit(999)).toBe(500);
    expect(normalizeTableLimit("bad")).toBe(200);
  });
});
