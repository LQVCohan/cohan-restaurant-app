import { beforeEach, describe, expect, it, vi } from "vitest";

const tableMocks = vi.hoisted(() => ({
  findById: vi.fn(),
  findByIdAndUpdate: vi.fn(),
}));
const floorMocks = vi.hoisted(() => ({ findById: vi.fn() }));
const authMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({ logEvent: vi.fn() }));

vi.mock("../../models/table.model.js", () => ({ default: tableMocks }));
vi.mock("../../models/floor.model.js", () => ({ default: floorMocks }));
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("../../src/services/eventLog.service.js", () => eventMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((value) => String(value).startsWith("valid-")),
  },
}));

const selectLean = (value) => ({
  select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(value) })),
});
const updateLean = (value) => ({
  lean: vi.fn().mockResolvedValue(value),
});

describe("moveTable joined-group guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireRestaurantPermission.mockResolvedValue();
    eventMocks.logEvent.mockResolvedValue();
    floorMocks.findById.mockReturnValue(
      selectLean({ restaurantId: "valid-r1", level: 2 }),
    );
    tableMocks.findByIdAndUpdate.mockReturnValue(
      updateLean({
        id: "valid-t1",
        restaurantId: "valid-r1",
        floorId: "valid-f2",
        code: "A1",
      }),
    );
  });

  it("rejects moving a joined table to another floor", async () => {
    tableMocks.findById.mockReturnValue(
      selectLean({
        restaurantId: "valid-r1",
        floorId: "valid-f1",
        joinGroupId: "group-1",
      }),
    );
    const moveTable = (
      await import("../../graphql/resolvers/table/moveTable.js")
    ).default;

    await expect(
      moveTable(
        null,
        { input: { id: "valid-t1", floorId: "valid-f2" } },
        { user: { id: "valid-u1" }, req: { headers: {} } },
      ),
    ).rejects.toMatchObject({
      message: "Vui lòng tách bàn khỏi nhóm trước khi chuyển tầng.",
      extensions: { code: "TABLE_JOIN_GROUP_FLOOR_MOVE" },
    });

    expect(authMocks.requireRestaurantPermission).toHaveBeenCalled();
    expect(floorMocks.findById).not.toHaveBeenCalled();
    expect(tableMocks.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(eventMocks.logEvent).not.toHaveBeenCalled();
  });

  it("allows changing position on the current floor", async () => {
    tableMocks.findById.mockReturnValue(
      selectLean({
        restaurantId: "valid-r1",
        floorId: "valid-f1",
        joinGroupId: "group-1",
      }),
    );
    tableMocks.findByIdAndUpdate.mockReturnValue(
      updateLean({
        id: "valid-t1",
        restaurantId: "valid-r1",
        floorId: "valid-f1",
        code: "A1",
      }),
    );
    const moveTable = (
      await import("../../graphql/resolvers/table/moveTable.js")
    ).default;

    await expect(
      moveTable(
        null,
        {
          input: {
            id: "valid-t1",
            floorId: "valid-f1",
            position: { x: 120, y: 160 },
          },
        },
        { user: { id: "valid-u1" }, req: { headers: {} } },
      ),
    ).resolves.toMatchObject({ floorId: "valid-f1" });

    expect(tableMocks.findByIdAndUpdate).toHaveBeenCalledWith(
      "valid-t1",
      {
        $set: {
          floorId: "valid-f1",
          floorLevel: 2,
          position: { x: 120, y: 160 },
        },
      },
      { new: true, runValidators: true },
    );
    expect(eventMocks.logEvent).toHaveBeenCalledOnce();
  });
});
