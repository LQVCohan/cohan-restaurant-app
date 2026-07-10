import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  withTransaction: vi.fn(async (work) => work()),
  endSession: vi.fn(async () => {}),
}));
const mongooseMocks = vi.hoisted(() => ({
  startSession: vi.fn(async () => sessionMocks),
  isValidObjectId: vi.fn(() => true),
  Types: {
    ObjectId: class ObjectId {
      constructor(value) {
        this.value = String(value);
      }
      toString() {
        return this.value;
      }
    },
  },
}));
const modelMocks = vi.hoisted(() => ({
  Order: {
    findOne: vi.fn(),
    exists: vi.fn(),
  },
  Table: {
    findOne: vi.fn(),
  },
}));
const lifecycleMocks = vi.hoisted(() => ({
  ensureActiveTableSessionForDineInOrder: vi.fn(),
  activeTableSessionLookupFilter: vi.fn((input) => input),
  ACTIVE_TABLE_SESSION_SORT: { openedAt: -1 },
}));
const qrMocks = vi.hoisted(() => ({
  verifyTableAccessToken: vi.fn(),
  normalizePublicTableCode: vi.fn((value) =>
    String(value || "").trim().toUpperCase(),
  ),
  TABLE_ACCESS_TOKEN_ERROR: "Invalid table access token",
}));

vi.mock("mongoose", () => ({ default: mongooseMocks }));
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../utils/orderLifecycle.js", () => lifecycleMocks);
vi.mock("../../utils/publicTableSession.js", () => qrMocks);

const restaurantId = "64b000000000000000000001";
const tableId = "64b000000000000000000002";
const token = "printed-table-token";

function tableQuery(table) {
  return {
    select: vi.fn(() => ({
      lean: vi.fn(async () => table),
      session: vi.fn(() => ({ lean: vi.fn(async () => table) })),
    })),
  };
}

function activeSessionQuery(result) {
  return {
    sort: vi.fn(() => ({
      lean: vi.fn(async () => result),
      session: vi.fn(() => ({ lean: vi.fn(async () => result) })),
    })),
  };
}

describe("ensurePublicTableSessionForAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMocks.withTransaction.mockImplementation(async (work) => work());
    qrMocks.verifyTableAccessToken.mockReturnValue({
      restaurantId,
      tableId,
      tableCode: "A01",
    });
    modelMocks.Table.findOne.mockReturnValue(
      tableQuery({
        _id: tableId,
        restaurantId,
        code: "A01",
        status: "reserved",
        tableAccessToken: token,
      }),
    );
    modelMocks.Order.exists.mockReturnValue({
      session: vi.fn(),
      then: (resolve) => resolve(false),
    });
  });

  it("reuses an active session without creating an empty replacement", async () => {
    const activeSession = { _id: "64b000000000000000000003" };
    modelMocks.Order.findOne.mockReturnValue(activeSessionQuery(activeSession));

    const { ensurePublicTableSessionForAccess } = await import(
      "../../src/services/publicTableSessionBootstrap.service.js"
    );
    const result = await ensurePublicTableSessionForAccess({
      restaurantId,
      tableId,
      token,
    });

    expect(result).toBe(activeSession);
    expect(
      lifecycleMocks.ensureActiveTableSessionForDineInOrder,
    ).not.toHaveBeenCalled();
    expect(mongooseMocks.startSession).not.toHaveBeenCalled();
  });

  it("creates only the active table-session row for a reserved walk-in table", async () => {
    modelMocks.Order.findOne.mockReturnValue(activeSessionQuery(null));
    const createdSession = { _id: "64b000000000000000000003" };
    lifecycleMocks.ensureActiveTableSessionForDineInOrder.mockResolvedValue({
      sessionOrder: createdSession,
      created: true,
    });

    const { ensurePublicTableSessionForAccess } = await import(
      "../../src/services/publicTableSessionBootstrap.service.js"
    );
    const result = await ensurePublicTableSessionForAccess({
      restaurantId,
      tableId,
      token,
    });

    expect(result).toBe(createdSession);
    expect(
      lifecycleMocks.ensureActiveTableSessionForDineInOrder,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        OrderModel: modelMocks.Order,
        restaurantId: expect.anything(),
        tableId: expect.anything(),
        tableCode: "A01",
        session: sessionMocks,
      }),
    );
    expect(sessionMocks.endSession).toHaveBeenCalledOnce();
  });

  it("does not let a static QR open an available table", async () => {
    modelMocks.Order.findOne.mockReturnValue(activeSessionQuery(null));
    modelMocks.Table.findOne.mockReturnValue(
      tableQuery({
        _id: tableId,
        restaurantId,
        code: "A01",
        status: "available",
        tableAccessToken: token,
      }),
    );

    const { ensurePublicTableSessionForAccess } = await import(
      "../../src/services/publicTableSessionBootstrap.service.js"
    );

    await expect(
      ensurePublicTableSessionForAccess({ restaurantId, tableId, token }),
    ).rejects.toThrow(/mở bàn phục vụ/i);
    expect(
      lifecycleMocks.ensureActiveTableSessionForDineInOrder,
    ).not.toHaveBeenCalled();
  });
});
