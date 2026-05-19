import { beforeEach, describe, expect, it, vi } from "vitest";

const tableFindByIdMock = vi.fn();
const tableDeleteOneMock = vi.fn();
const tableFindByIdAndUpdateMock = vi.fn();

const tableModelMock = {
  findById: tableFindByIdMock,
  deleteOne: tableDeleteOneMock,
  findByIdAndUpdate: tableFindByIdAndUpdateMock,
};

vi.mock("../../models/table.model.js", () => ({ default: tableModelMock }));
vi.mock("../../models/floor.model.js", () => ({ default: {} }));
vi.mock("../../src/services/eventLog.service.js", () => ({ logEvent: vi.fn() }));

const permissionMock = vi.fn();
vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requireRestaurantPermission: permissionMock,
}));

const tableStateGuardMocks = vi.hoisted(() => ({
  hasActiveOrdersForTable: vi.fn(),
  hasActiveReservationsForTable: vi.fn(),
}));

vi.mock("../../utils/tableStateGuards.js", () => tableStateGuardMocks);

vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: {
      ObjectId: function ObjectId(value) {
        this.value = value;
      },
    },
  },
}));

describe("table mutation reservation guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionMock.mockResolvedValue(undefined);
  });

  it("blocks deleteTable when table has active reservation", async () => {
    tableFindByIdMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: "table-1",
        restaurantId: "restaurant-1",
        code: "A1",
      }),
    });
    tableStateGuardMocks.hasActiveOrdersForTable.mockResolvedValue(false);
    tableStateGuardMocks.hasActiveReservationsForTable.mockResolvedValue(true);

    const mutation = (await import("../../graphql/resolvers/table/mutation.js")).default;

    await expect(mutation.deleteTable(null, { id: "table-1" }, { user: { id: "u1" } })).rejects.toMatchObject({
      extensions: { code: "TABLE_HAS_ACTIVE_RESERVATION" },
    });
    expect(tableDeleteOneMock).not.toHaveBeenCalled();
  });

  it("blocks setTableStatus available when table has active reservation", async () => {
    tableFindByIdMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: "table-1",
          restaurantId: "restaurant-1",
          code: "A1",
        }),
      }),
    });
    tableStateGuardMocks.hasActiveOrdersForTable.mockResolvedValue(false);
    tableStateGuardMocks.hasActiveReservationsForTable.mockResolvedValue(true);

    const mutation = (await import("../../graphql/resolvers/table/mutation.js")).default;

    await expect(
      mutation.setTableStatus(null, { input: { id: "table-1", status: "available" } }, { user: { id: "u1" } }),
    ).rejects.toMatchObject({
      extensions: { code: "TABLE_HAS_ACTIVE_RESERVATION" },
    });
    expect(tableFindByIdAndUpdateMock).not.toHaveBeenCalled();
  });
});
