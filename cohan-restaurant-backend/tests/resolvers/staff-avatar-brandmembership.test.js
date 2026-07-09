import { beforeEach, describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireRoles: vi.fn(),
  requireRestaurantAccess: vi.fn(async () => true),
}));

const scopeMocks = vi.hoisted(() => ({
  getStaffRestaurantIds: vi.fn(),
}));

const mediaMocks = vi.hoisted(() => ({
  deleteLocalAvatar: vi.fn(),
  resolveAvatarUpdate: vi.fn(async () => "/uploads/new.png"),
}));

const modelMocks = vi.hoisted(() => ({
  EventLog: { log: vi.fn(async () => ({})) },
  Staff: { findById: vi.fn() },
}));

vi.mock("../../graphql/guards.js", () => guards);
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", () => scopeMocks);
vi.mock("../../src/services/media/avatarStorage.service.js", () => mediaMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
  },
}));

function staffDoc(overrides = {}) {
  return {
    _id: "staff-1",
    userType: "STAFF",
    deletedAt: null,
    avatarUrl: "/uploads/old.png",
    employeeCode: "S001",
    save: vi.fn(async function save() { return this; }),
    populate: vi.fn(async function populate() { return this; }),
    ...overrides,
  };
}

describe("updateStaffAvatar BrandMembership scope", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guards.requireRestaurantAccess.mockResolvedValue(true);
    scopeMocks.getStaffRestaurantIds.mockResolvedValue(["restaurant-1"]);
    mediaMocks.resolveAvatarUpdate.mockResolvedValue("/uploads/new.png");
    modelMocks.Staff.findById.mockResolvedValue(staffDoc());
  });

  it("uses the BrandMembership restaurant for authorization and audit log", async () => {
    const { default: mutation } = await import("../../graphql/resolvers/staff/staffAvatar.mutation.js");

    await mutation.updateStaffAvatar(null, { userId: "staff-1", input: { fileUrl: "/uploads/new.png" } }, { user: { id: "manager-1" } });

    expect(scopeMocks.getStaffRestaurantIds).toHaveBeenCalledWith("staff-1");
    expect(guards.requireRestaurantAccess).toHaveBeenCalledWith({ user: { id: "manager-1" } }, "restaurant-1");
    expect(modelMocks.EventLog.log).toHaveBeenCalledWith(expect.objectContaining({ restaurantId: "restaurant-1" }));
  });

  it("tries the next assigned restaurant when the actor cannot access the first", async () => {
    guards.requireRestaurantAccess
      .mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"))
      .mockResolvedValueOnce(true);
    scopeMocks.getStaffRestaurantIds.mockResolvedValue(["restaurant-1", "restaurant-2"]);
    const { default: mutation } = await import("../../graphql/resolvers/staff/staffAvatar.mutation.js");

    await mutation.updateStaffAvatar(null, { userId: "staff-1", input: { fileUrl: "/uploads/new.png" } }, { user: { id: "manager-1" } });

    expect(modelMocks.EventLog.log).toHaveBeenCalledWith(expect.objectContaining({ restaurantId: "restaurant-2" }));
  });

  it("rejects staff without BrandMembership restaurant assignment", async () => {
    scopeMocks.getStaffRestaurantIds.mockResolvedValue([]);
    const { default: mutation } = await import("../../graphql/resolvers/staff/staffAvatar.mutation.js");

    await expect(
      mutation.updateStaffAvatar(null, { userId: "staff-1", input: {} }, { user: { id: "manager-1" } }),
    ).rejects.toThrow("Nhân viên chưa được gán nhà hàng.");
  });
});
