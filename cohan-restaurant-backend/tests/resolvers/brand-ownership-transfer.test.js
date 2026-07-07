import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  withTransaction: vi.fn(async (work) => work()),
  endSession: vi.fn(),
}));

const modelMocks = vi.hoisted(() => ({
  Brand: {
    findById: vi.fn(),
  },
  BrandMembership: {
    findOne: vi.fn(),
  },
}));

const scopeMocks = vi.hoisted(() => ({
  ensureBrandRestaurants: vi.fn(),
  getUserId: vi.fn((user) => user?.id),
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

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", () => scopeMocks);

const ownerDoc = () => ({
  _id: "membership-owner",
  role: "owner",
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

const targetDoc = () => ({
  _id: "membership-target",
  role: "admin",
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

const brandDoc = () => ({
  _id: "brand-1",
  ownerId: "owner-1",
  updatedBy: null,
  save: vi.fn(),
  toObject() {
    return { id: this._id, ownerId: this.ownerId };
  },
});

const resolvedQuery = (value) => ({
  session: vi.fn().mockResolvedValue(value),
});

const conflictQuery = (value) => ({
  session: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(value),
    }),
  }),
});

describe("transferBrandOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.withTransaction.mockImplementation(async (work) => work());
    scopeMocks.ensureBrandRestaurants.mockResolvedValue([{ toString: () => "restaurant-2" }]);
  });

  it("atomically promotes the target, demotes the current owner and updates Brand.ownerId", async () => {
    const currentOwner = ownerDoc();
    const newOwner = targetDoc();
    const brand = brandDoc();

    modelMocks.BrandMembership.findOne.mockImplementation((filter) => {
      if (filter.role === "owner") return resolvedQuery(currentOwner);
      if (filter.role === "manager") return conflictQuery(null);
      return resolvedQuery(newOwner);
    });
    modelMocks.Brand.findById.mockReturnValue(resolvedQuery(brand));

    const transferBrandOwnership = (
      await import("../../graphql/resolvers/brand/transferBrandOwnership.js")
    ).default;

    const result = await transferBrandOwnership(
      null,
      {
        input: {
          brandId: "brand-1",
          newOwnerUserId: "target-1",
          previousOwnerRestaurantId: "restaurant-2",
        },
      },
      { user: { id: "owner-1" } },
    );

    expect(scopeMocks.ensureBrandRestaurants).toHaveBeenCalledWith(
      "brand-1",
      ["restaurant-2"],
    );
    expect(newOwner.role).toBe("owner");
    expect(newOwner.restaurantIds).toEqual([]);
    expect(currentOwner.role).toBe("manager");
    expect(currentOwner.restaurantIds).toHaveLength(1);
    expect(brand.ownerId.toString()).toBe("target-1");
    expect(newOwner.save).toHaveBeenCalledWith({ session });
    expect(currentOwner.save).toHaveBeenCalledWith({ session });
    expect(brand.save).toHaveBeenCalledWith({ session });
    expect(result.newOwnerMembership.role).toBe("owner");
    expect(result.previousOwnerMembership.role).toBe("manager");
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it("rejects callers who are not the current active owner", async () => {
    modelMocks.BrandMembership.findOne.mockReturnValueOnce(resolvedQuery(null));

    const transferBrandOwnership = (
      await import("../../graphql/resolvers/brand/transferBrandOwnership.js")
    ).default;

    await expect(
      transferBrandOwnership(
        null,
        {
          input: {
            brandId: "brand-1",
            newOwnerUserId: "target-1",
            previousOwnerRestaurantId: "restaurant-2",
          },
        },
        { user: { id: "admin-1" } },
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });

    expect(modelMocks.Brand.findById).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });
});
