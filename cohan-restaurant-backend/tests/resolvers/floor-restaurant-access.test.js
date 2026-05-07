import { beforeEach, describe, expect, it, vi } from "vitest";

const floorMocks = vi.hoisted(() => ({
  find: vi.fn(),
  findOne: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  deleteOne: vi.fn(),
}));
const tableMocks = vi.hoisted(() => ({ countDocuments: vi.fn() }));
const guardMocks = vi.hoisted(() => ({ requireRestaurantAccess: vi.fn() }));
const mongooseMocks = vi.hoisted(() => ({
  isValidObjectId: vi.fn((v) => String(v).startsWith("valid-") || /^[a-f\d]{24}$/i.test(String(v))),
}));

vi.mock("../../models/floor.model.js", () => ({ default: floorMocks }));
vi.mock("../../models/table.model.js", () => ({ default: tableMocks }));
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("mongoose", () => ({ default: mongooseMocks }));

const leanWrap = (value) => ({ lean: vi.fn().mockResolvedValue(value) });
const selectLeanWrap = (value) => ({ select: vi.fn(() => leanWrap(value)) });

describe("floor restaurant access guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue();
    floorMocks.find.mockImplementation(() => ({
      sort: vi.fn(() => leanWrap([])),
    }));
    floorMocks.findOne.mockReturnValue(leanWrap(null));
    floorMocks.findById.mockReturnValue(selectLeanWrap({ restaurantId: "valid-r1" }));
    floorMocks.create.mockResolvedValue({ toObject: () => ({ _id: "valid-f1" }) });
    floorMocks.findByIdAndUpdate.mockReturnValue(leanWrap({ _id: "valid-f1", restaurantId: "valid-r1" }));
    floorMocks.deleteOne.mockResolvedValue({ deletedCount: 1 });
    tableMocks.countDocuments.mockResolvedValue(0);
  });

  it("floors denied does not call Floor.find", async () => {
    const q = (await import("../../graphql/resolvers/floor/query.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));

    await expect(q.floors(null, { restaurantId: "valid-r1" }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(floorMocks.find).not.toHaveBeenCalled();
  });

  it("floors allowed calls requireRestaurantAccess before Floor.find", async () => {
    const q = (await import("../../graphql/resolvers/floor/query.js")).default;

    await q.floors(null, { restaurantId: "valid-r1" }, {});

    expect(floorMocks.find).toHaveBeenCalled();
    expect(guardMocks.requireRestaurantAccess.mock.invocationCallOrder[0]).toBeLessThan(
      floorMocks.find.mock.invocationCallOrder[0]
    );
  });

  it("floorByLevel denied does not call Floor.findOne", async () => {
    const q = (await import("../../graphql/resolvers/floor/query.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));

    await expect(q.floorByLevel(null, { restaurantId: "valid-r1", level: 2 }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(floorMocks.findOne).not.toHaveBeenCalled();
  });

  it("floor(id) denied after loading existing does not call full Floor.findById again", async () => {
    const q = (await import("../../graphql/resolvers/floor/query.js")).default;
    floorMocks.findById.mockReturnValueOnce(selectLeanWrap({ restaurantId: "valid-r1" }));
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));

    await expect(q.floor(null, { id: "valid-f1" }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(floorMocks.findById).toHaveBeenCalledTimes(1);
  });

  it("createFloor denied does not call Floor.create", async () => {
    const m = (await import("../../graphql/resolvers/floor/mutation.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));

    await expect(m.createFloor(null, { input: { restaurantId: "valid-r1", name: "L1" } }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(floorMocks.create).not.toHaveBeenCalled();
  });

  it("createFloor allowed calls requireRestaurantAccess and Floor.create", async () => {
    const m = (await import("../../graphql/resolvers/floor/mutation.js")).default;

    await m.createFloor(null, { input: { restaurantId: "valid-r1", name: "L1" } }, {});

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith({}, "valid-r1");
    expect(floorMocks.create).toHaveBeenCalled();
  });

  it("updateFloor denied after loading existing does not call Floor.findByIdAndUpdate", async () => {
    const m = (await import("../../graphql/resolvers/floor/mutation.js")).default;
    floorMocks.findById.mockReturnValueOnce(selectLeanWrap({ restaurantId: "valid-r1" }));
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));

    await expect(m.updateFloor(null, { input: { id: "valid-f1", name: "new" } }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(floorMocks.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("updateFloor strips restaurantId from patch", async () => {
    const m = (await import("../../graphql/resolvers/floor/mutation.js")).default;

    await m.updateFloor(null, { input: { id: "valid-f1", restaurantId: "valid-r2", name: "new" } }, {});

    const updateArg = floorMocks.findByIdAndUpdate.mock.calls[0][1];
    expect(updateArg.$set.restaurantId).toBeUndefined();
    expect(updateArg.$set.name).toBe("new");
  });

  it("deleteFloor denied after loading existing does not call Table.countDocuments or Floor.deleteOne", async () => {
    const m = (await import("../../graphql/resolvers/floor/mutation.js")).default;
    floorMocks.findById.mockReturnValueOnce(selectLeanWrap({ restaurantId: "valid-r1" }));
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));

    await expect(m.deleteFloor(null, { id: "valid-f1" }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(tableMocks.countDocuments).not.toHaveBeenCalled();
    expect(floorMocks.deleteOne).not.toHaveBeenCalled();
  });

  it("deleteFloor allowed with existing tables preserves business rule", async () => {
    const m = (await import("../../graphql/resolvers/floor/mutation.js")).default;
    tableMocks.countDocuments.mockResolvedValue(2);

    await expect(m.deleteFloor(null, { id: "valid-f1" }, {})).rejects.toThrow("Cannot delete floor with existing tables");
    expect(floorMocks.deleteOne).not.toHaveBeenCalled();
  });

  it("deleteFloor allowed with no tables deletes", async () => {
    const m = (await import("../../graphql/resolvers/floor/mutation.js")).default;
    tableMocks.countDocuments.mockResolvedValue(0);
    floorMocks.deleteOne.mockResolvedValue({ deletedCount: 1 });

    await expect(m.deleteFloor(null, { id: "valid-f1" }, {})).resolves.toBe(true);
  });
});
