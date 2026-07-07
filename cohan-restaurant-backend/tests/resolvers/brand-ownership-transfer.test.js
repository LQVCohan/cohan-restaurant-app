import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  withTransaction: vi.fn(async (work) => work()),
  endSession: vi.fn(),
}));

const models = vi.hoisted(() => ({
  Brand: { findById: vi.fn() },
  BrandMembership: { findOne: vi.fn() },
  User: { findById: vi.fn() },
}));

vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((value) => Boolean(value)),
    Types: {
      ObjectId: function ObjectId(value) {
        this.value = String(value);
        this.toString = () => this.value;
      },
    },
    startSession: vi.fn(async () => session),
  },
}));

vi.mock("../../models/index.js", () => models);
vi.mock("../../src/services/auth/restaurantScope.service.js", () => ({
  getUserId: (user) => user?.id,
}));

const membershipDoc = (role, id) => ({
  _id: id,
  role,
  restaurantIds: [],
  status: "active",
  updatedBy: null,
  save: vi.fn(),
  toObject() {
    return {
      id: this._id,
      role: this.role,
      restaurantIds: this.restaurantIds,
      status: this.status,
    };
  },
});

const resolvedQuery = (value) => ({
  session: vi.fn().mockResolvedValue(value),
});

const userQuery = (value) => ({
  populate: vi.fn().mockReturnValue({
    session: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(value),
    }),
  }),
});

describe("transferBrandOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.withTransaction.mockImplementation(async (work) => work());
    models.User.findById.mockReturnValue(userQuery({
      status: "active",
      role: { slug: "manager" },
    }));
  });

  it("promotes the target and changes the previous owner to chain admin", async () => {
    const currentOwner = membershipDoc("owner", "membership-owner");
    const newOwner = membershipDoc("admin", "membership-target");
    const brand = {
      _id: "brand-1",
      ownerId: "owner-1",
      updatedBy: null,
      save: vi.fn(),
      toObject() {
        return { id: this._id, ownerId: this.ownerId };
      },
    };

    models.BrandMembership.findOne
      .mockReturnValueOnce(resolvedQuery(currentOwner))
      .mockReturnValueOnce(resolvedQuery(newOwner));
    models.Brand.findById.mockReturnValue(resolvedQuery(brand));

    const transferBrandOwnership = (
      await import("../../graphql/resolvers/brand/transferBrandOwnership.js")
    ).default;

    const result = await transferBrandOwnership(
      null,
      { input: { brandId: "brand-1", newOwnerUserId: "target-1" } },
      { user: { id: "owner-1" } },
    );

    expect(newOwner.role).toBe("owner");
    expect(newOwner.restaurantIds).toEqual([]);
    expect(currentOwner.role).toBe("admin");
    expect(currentOwner.restaurantIds).toEqual([]);
    expect(brand.ownerId.toString()).toBe("target-1");
    expect(newOwner.save).toHaveBeenCalledWith({ session });
    expect(currentOwner.save).toHaveBeenCalledWith({ session });
    expect(brand.save).toHaveBeenCalledWith({ session });
    expect(result.previousOwnerMembership.role).toBe("admin");
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it("rejects a caller who is not the current active owner", async () => {
    models.BrandMembership.findOne.mockReturnValueOnce(resolvedQuery(null));

    const transferBrandOwnership = (
      await import("../../graphql/resolvers/brand/transferBrandOwnership.js")
    ).default;

    await expect(
      transferBrandOwnership(
        null,
        { input: { brandId: "brand-1", newOwnerUserId: "target-1" } },
        { user: { id: "admin-1" } },
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });

    expect(models.User.findById).not.toHaveBeenCalled();
    expect(models.Brand.findById).not.toHaveBeenCalled();
  });

  it("rejects a target account without manager portal access", async () => {
    models.BrandMembership.findOne
      .mockReturnValueOnce(resolvedQuery(membershipDoc("owner", "membership-owner")))
      .mockReturnValueOnce(resolvedQuery(membershipDoc("admin", "membership-target")));
    models.User.findById.mockReturnValue(userQuery({
      status: "active",
      role: { slug: "staff" },
    }));

    const transferBrandOwnership = (
      await import("../../graphql/resolvers/brand/transferBrandOwnership.js")
    ).default;

    await expect(
      transferBrandOwnership(
        null,
        { input: { brandId: "brand-1", newOwnerUserId: "target-1" } },
        { user: { id: "owner-1" } },
      ),
    ).rejects.toMatchObject({ extensions: { code: "BAD_USER_INPUT" } });

    expect(models.Brand.findById).not.toHaveBeenCalled();
  });
});
