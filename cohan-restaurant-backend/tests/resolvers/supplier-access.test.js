import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
const Supplier = vi.hoisted(() => ({
  find: vi.fn(),
  countDocuments: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  deleteOne: vi.fn(),
}));

vi.mock("../../models/supplier.model.js", () => ({ default: Supplier }));
vi.mock("../../utils/authz.js", () => ({ requireRole }));
vi.mock("mongoose", async () => {
  const actual = await vi.importActual("mongoose");
  const fn = (v) => typeof v === "string" && v.startsWith("valid-");
  return {
    ...actual,
    default: { ...actual.default, isValidObjectId: fn, Types: { ...actual.default.Types, ObjectId: vi.fn((v) => v) } },
    isValidObjectId: fn,
  };
});

describe("supplier global access", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireRole.mockReturnValue(true);
    Supplier.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) }) });
    Supplier.countDocuments.mockResolvedValue(0);
    Supplier.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "valid-s1" }) });
    Supplier.create.mockResolvedValue({ toObject: vi.fn().mockReturnValue({ _id: "valid-s1" }) });
    Supplier.findByIdAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "valid-s1", name: "New", reliabilityScore: 3 }) });
    Supplier.deleteOne.mockResolvedValue({ deletedCount: 1 });
  });

  it("suppliers denied before find/count", async () => {
    requireRole.mockImplementationOnce(() => { throw new Error("FORBIDDEN"); });
    const resolver = (await import("../../graphql/resolvers/supplier/query.js")).default;
    await expect(resolver.suppliers(null, {}, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN");
    expect(Supplier.find).not.toHaveBeenCalled();
    expect(Supplier.countDocuments).not.toHaveBeenCalled();
  });

  it("suppliers allowed with search/tag/cursor", async () => {
    const resolver = (await import("../../graphql/resolvers/supplier/query.js")).default;
    const result = await resolver.suppliers(null, { filter: { search: "abc", tag: "fresh" }, cursor: "valid-c1" }, { user: { id: "u1" } });
    expect(requireRole).toHaveBeenCalledWith({ id: "u1" }, ["admin", "manager", "staff"]);
    expect(Supplier.find).toHaveBeenCalled();
    expect(result.edges).toEqual([]);
    expect(result.pageInfo).toEqual({ endCursor: null, hasNextPage: false });
  });

  it("supplier invalid id returns null without role/db", async () => {
    const resolver = (await import("../../graphql/resolvers/supplier/query.js")).default;
    await expect(resolver.supplier(null, { id: "bad-id" }, { user: { id: "u1" } })).resolves.toBeNull();
    expect(requireRole).not.toHaveBeenCalled();
    expect(Supplier.findById).not.toHaveBeenCalled();
  });

  it("supplier denied valid id before findById", async () => {
    requireRole.mockImplementationOnce(() => { throw new Error("FORBIDDEN"); });
    const resolver = (await import("../../graphql/resolvers/supplier/query.js")).default;
    await expect(resolver.supplier(null, { id: "valid-s1" }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN");
    expect(Supplier.findById).not.toHaveBeenCalled();
  });

  it("supplier allowed valid id calls findById", async () => {
    const resolver = (await import("../../graphql/resolvers/supplier/query.js")).default;
    await resolver.supplier(null, { id: "valid-s1" }, { user: { id: "u1" } });
    expect(Supplier.findById).toHaveBeenCalledWith("valid-s1");
  });

  it("mutation access + invalid id behaviors", async () => {
    const resolver = (await import("../../graphql/resolvers/supplier/mutation.js")).default;

    requireRole.mockImplementationOnce(() => { throw new Error("FORBIDDEN"); });
    await expect(resolver.createSupplier(null, { input: { name: "A" } }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN");
    expect(Supplier.create).not.toHaveBeenCalled();

    await resolver.createSupplier(null, { input: { name: "A" } }, { user: { id: "u1" } });
    expect(requireRole).toHaveBeenCalledWith({ id: "u1" }, ["admin"]);
    expect(Supplier.create).toHaveBeenCalled();

    await expect(resolver.updateSupplier(null, { input: { id: "bad-id", name: "N" } }, { user: { id: "u1" } })).rejects.toThrow("Invalid id");
    expect(Supplier.findByIdAndUpdate).not.toHaveBeenCalled();

    requireRole.mockImplementationOnce(() => { throw new Error("FORBIDDEN"); });
    await expect(resolver.updateSupplier(null, { input: { id: "valid-s1", name: "N" } }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN");
    expect(Supplier.findByIdAndUpdate).not.toHaveBeenCalled();

    await resolver.updateSupplier(null, { input: { id: "valid-s1", name: "New" } }, { user: { id: "u1" } });
    expect(Supplier.findByIdAndUpdate).toHaveBeenCalledWith("valid-s1", { $set: { name: "New" } }, { new: true, runValidators: true });

    await expect(resolver.deleteSupplier(null, { id: "bad-id" }, { user: { id: "u1" } })).resolves.toBe(false);
    expect(Supplier.deleteOne).not.toHaveBeenCalled();

    requireRole.mockImplementationOnce(() => { throw new Error("FORBIDDEN"); });
    await expect(resolver.deleteSupplier(null, { id: "valid-s1" }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN");
    expect(Supplier.deleteOne).not.toHaveBeenCalled();

    await expect(resolver.deleteSupplier(null, { id: "valid-s1" }, { user: { id: "u1" } })).resolves.toBe(true);

    await expect(resolver.bumpSupplierReliability(null, { id: "bad-id" }, { user: { id: "u1" } })).rejects.toThrow("Invalid id");
    requireRole.mockImplementationOnce(() => { throw new Error("FORBIDDEN"); });
    await expect(resolver.bumpSupplierReliability(null, { id: "valid-s1" }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN");
    await resolver.bumpSupplierReliability(null, { id: "valid-s1", delta: 3 }, { user: { id: "u1" } });
    expect(Supplier.findByIdAndUpdate).toHaveBeenCalledWith("valid-s1", { $inc: { reliabilityScore: 3 } }, { new: true });
  });
});
