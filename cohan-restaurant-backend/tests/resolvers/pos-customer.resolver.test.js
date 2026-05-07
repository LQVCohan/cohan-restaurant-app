import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  PosCustomer: {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
  User: {
    find: vi.fn(),
  },
}));

const guardMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((value) => String(value || "").startsWith("valid-")),
    Types: {
      ObjectId: function ObjectId(value) {
        this.value = value;
      },
    },
  },
}));

function mockFindChain(value = []) {
  const chain = {
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(value),
  };
  modelMocks.PosCustomer.find.mockReturnValue(chain);
  return chain;
}

function mockUserFindChain(value = []) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(value),
  };
  modelMocks.User.find.mockReturnValue(chain);
  return chain;
}

function mockDoc(seed = {}) {
  return {
    fullName: "Old Name",
    email: "old@example.com",
    defaultAddress: "Old address",
    note: "old note",
    source: "DELIVERY",
    addressBook: [{ address: "Old address" }],
    save: vi.fn().mockResolvedValue(undefined),
    toObject: vi.fn(function toObject() {
      return { id: "pc1", ...this };
    }),
    ...seed,
  };
}

describe("PosCustomer resolvers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue(undefined);
  });

  it("lists active POS customers scoped by restaurant and search", async () => {
    mockFindChain([{ id: "pc1" }]);
    const { PosCustomerQuery } = await import("../../graphql/resolvers/posCustomer/query.js");

    const rows = await PosCustomerQuery.posCustomers(
      null,
      { restaurantId: "valid-restaurant-1", search: "0901 234 567", limit: 200 },
      { user: { id: "manager-1", roles: ["MANAGER"] } },
    );

    expect(rows).toEqual([{ id: "pc1" }]);
    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalled();
    expect(modelMocks.PosCustomer.find).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: expect.objectContaining({ value: "valid-restaurant-1" }),
        isActive: { $ne: false },
      }),
    );
  });

  it("creates a POS customer with normalized phone", async () => {
    modelMocks.PosCustomer.findOne.mockResolvedValue(null);
    modelMocks.PosCustomer.create.mockResolvedValue({
      toObject: vi.fn(() => ({ id: "pc1", phone: "0901234567" })),
    });
    const { PosCustomerMutation } = await import("../../graphql/resolvers/posCustomer/mutation.js");

    const result = await PosCustomerMutation.upsertPosCustomer(
      null,
      {
        input: {
          restaurantId: "valid-restaurant-1",
          fullName: "Anh Nam",
          phone: "0901 234 567",
          email: "NAM@EXAMPLE.COM",
          defaultAddress: "12 Nguyen Trai",
          source: "delivery",
        },
      },
      { user: { id: "manager-1", roles: ["MANAGER"] } },
    );

    expect(result.phone).toBe("0901234567");
    expect(modelMocks.PosCustomer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "0901234567",
        fullName: "Anh Nam",
        email: "nam@example.com",
        defaultAddress: "12 Nguyen Trai",
        source: "DELIVERY",
      }),
    );
  });

  it("updates an existing POS customer without overwriting meaningful fields with blanks", async () => {
    const existing = mockDoc();
    modelMocks.PosCustomer.findOne.mockResolvedValue(existing);
    const { PosCustomerMutation } = await import("../../graphql/resolvers/posCustomer/mutation.js");

    await PosCustomerMutation.upsertPosCustomer(
      null,
      {
        input: {
          restaurantId: "valid-restaurant-1",
          phone: "0901-234-567",
          fullName: "",
          email: "",
          defaultAddress: "New address",
          note: "",
        },
      },
      { user: { id: "manager-1", roles: ["MANAGER"] } },
    );

    expect(existing.fullName).toBe("Old Name");
    expect(existing.email).toBe("old@example.com");
    expect(existing.note).toBe("old note");
    expect(existing.source).toBe("DELIVERY");
    expect(existing.defaultAddress).toBe("New address");
    expect(existing.addressBook[0].address).toBe("New address");
    expect(existing.save).toHaveBeenCalled();
  });



  it("does not persist empty email string on create", async () => {
    modelMocks.PosCustomer.findOne.mockResolvedValue(null);
    modelMocks.PosCustomer.create.mockResolvedValue({
      toObject: vi.fn(() => ({ id: "pc2", phone: "0901234567" })),
    });
    const { PosCustomerMutation } = await import("../../graphql/resolvers/posCustomer/mutation.js");

    await PosCustomerMutation.upsertPosCustomer(
      null,
      {
        input: {
          restaurantId: "valid-restaurant-1",
          phone: "0901234567",
          email: "   ",
        },
      },
      { user: { id: "manager-1" } },
    );

    expect(modelMocks.PosCustomer.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ email: "" }),
    );
  });

  it("rejects missing phone", async () => {
    const { PosCustomerMutation } = await import("../../graphql/resolvers/posCustomer/mutation.js");

    await expect(
      PosCustomerMutation.upsertPosCustomer(
        null,
        { input: { restaurantId: "valid-restaurant-1", phone: "" } },
        { user: { id: "manager-1" } },
      ),
    ).rejects.toThrow("phone is required");

    expect(modelMocks.PosCustomer.findOne).not.toHaveBeenCalled();
  });
  it("rejects invalid restaurantId before querying", async () => {
    const { PosCustomerMutation } = await import("../../graphql/resolvers/posCustomer/mutation.js");

    await expect(
      PosCustomerMutation.upsertPosCustomer(
        null,
        { input: { restaurantId: "bad-id", phone: "0901234567" } },
        { user: { id: "manager-1" } },
      ),
    ).rejects.toThrow("Invalid restaurantId");

    expect(modelMocks.PosCustomer.findOne).not.toHaveBeenCalled();
  });

  it("finds customer candidates by normalized email/phone", async () => {
    mockUserFindChain([
      { _id: "u1", fullName: "A", email: "a@example.com", phone: "0901234567", address: { line1: "1 A st" } },
    ]);
    const { PosCustomerQuery } = await import("../../graphql/resolvers/posCustomer/query.js");
    const rows = await PosCustomerQuery.posCustomerCandidates(
      null,
      { restaurantId: "valid-restaurant-1", email: " A@Example.com ", phone: "+84 901 234 567" },
      { user: { id: "manager-1" } },
    );
    expect(rows[0]).toEqual(expect.objectContaining({ id: "u1", source: "USER" }));
    expect(modelMocks.User.find).toHaveBeenCalled();
  });
});
