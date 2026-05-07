import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
const requireRestaurantAccess = vi.fn();

const PrintSetting = vi.hoisted(() => ({
  findOne: vi.fn(),
  create: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
}));

const Restaurant = vi.hoisted(() => ({
  findById: vi.fn(),
}));

vi.mock("../../models/index.js", () => ({ PrintSetting, Restaurant }));
vi.mock("../../utils/authz.js", () => ({ requireRole }));
vi.mock("../../graphql/guards.js", () => ({ requireRestaurantAccess }));
vi.mock("mongoose", async () => {
  const actual = await vi.importActual("mongoose");
  const fn = (v) => typeof v === "string" && v.startsWith("valid-");
  return {
    ...actual,
    default: { ...actual.default, isValidObjectId: fn },
    isValidObjectId: fn,
  };
});

describe("printSetting restaurant access hardening", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireRole.mockReturnValue(true);
    requireRestaurantAccess.mockResolvedValue(true);
    Restaurant.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "valid-r1" }) });
    PrintSetting.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "ps1", restaurantId: "valid-r1", printers: [], stations: {}, templates: [], jobs: [] }) });
    PrintSetting.create.mockResolvedValue({ toObject: vi.fn().mockReturnValue({ _id: "ps1", restaurantId: "valid-r1", printers: [], stations: {}, templates: [], jobs: [] }) });
    PrintSetting.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "ps1", restaurantId: "valid-r1", printers: [{ id: "p1", name: "A" }], stations: { kitchen: ["p1"] }, templates: [], jobs: [] }) });
    PrintSetting.updateOne.mockResolvedValue({ acknowledged: true });
  });

  it("printSettings denied by restaurant access before Restaurant.findById and PrintSetting.findOne", async () => {
    requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    const resolver = await import("../../graphql/resolvers/printSetting/index.js");

    await expect(resolver.Query.printSettings(null, { restaurantId: "valid-r1" }, { user: { id: "m1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(Restaurant.findById).not.toHaveBeenCalled();
    expect(PrintSetting.findOne).not.toHaveBeenCalled();
  });

  it("printSettings invalid restaurantId does not call requireRestaurantAccess or DB", async () => {
    const resolver = await import("../../graphql/resolvers/printSetting/index.js");
    await expect(resolver.Query.printSettings(null, { restaurantId: "bad-id" }, { user: { id: "m1" } })).rejects.toThrow("Invalid restaurantId");
    expect(requireRestaurantAccess).not.toHaveBeenCalled();
    expect(Restaurant.findById).not.toHaveBeenCalled();
    expect(PrintSetting.findOne).not.toHaveBeenCalled();
  });

  it("printSettings allowed calls role + scoped access and returns normalized payload", async () => {
    const resolver = await import("../../graphql/resolvers/printSetting/index.js");
    const result = await resolver.Query.printSettings(null, { restaurantId: "valid-r1" }, { user: { id: "m1", roleName: "manager" } });
    expect(requireRole).toHaveBeenCalled();
    expect(requireRestaurantAccess).toHaveBeenCalledWith({ user: { id: "m1", roleName: "manager" } }, "valid-r1");
    expect(Restaurant.findById).toHaveBeenCalledWith("valid-r1");
    expect(PrintSetting.findOne).toHaveBeenCalledWith({ restaurantId: "valid-r1" });
    expect(result).toEqual(expect.objectContaining({ restaurantId: "valid-r1", printers: expect.any(Array), templates: expect.any(Array), jobs: expect.any(Array) }));
  });

  it("mutation denied paths block DB writes after scope guard", async () => {
    requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const resolver = await import("../../graphql/resolvers/printSetting/index.js");
    const ctx = { user: { id: "m1", roleName: "manager" } };

    await expect(resolver.Mutation.upsertPrintSettings(null, { input: { restaurantId: "valid-r1" } }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(resolver.Mutation.enqueuePrintJob(null, { input: { restaurantId: "valid-r1", printType: "kitchen" } }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(resolver.Mutation.retryPrintJob(null, { input: { restaurantId: "valid-r1", jobId: "j1" } }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(resolver.Mutation.updatePrintJobStatus(null, { input: { restaurantId: "valid-r1", jobId: "j1", status: "completed" } }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(resolver.Mutation.testPrint(null, { input: { restaurantId: "valid-r1", printerId: "p1" } }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(PrintSetting.findOne).not.toHaveBeenCalled();
    expect(PrintSetting.findOneAndUpdate).not.toHaveBeenCalled();
    expect(PrintSetting.updateOne).not.toHaveBeenCalled();
  });

  it("upsertPrintSettings allowed preserves normalization", async () => {
    PrintSetting.findOne.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue({ _id: "ps1", restaurantId: "valid-r1", printers: [{ id: "p1", name: "A" }], stations: { kitchen: ["p1"] }, templates: [], jobs: [] }) });
    const resolver = await import("../../graphql/resolvers/printSetting/index.js");
    await resolver.Mutation.upsertPrintSettings(null, { input: { restaurantId: "valid-r1", printers: [{ id: "p1", name: "A" }, { id: "", name: "x" }], stations: { kitchen: ["p1", "p2"] }, templates: [{ key: "kitchen", name: "K", enabled: true, content: "x" }] } }, { user: { id: "m1", roleName: "manager" } });
    const payload = PrintSetting.findOneAndUpdate.mock.calls[0][1].$set;
    expect(payload.stations.kitchen).toEqual(["p1"]);
  });

  it("role check still required", async () => {
    requireRole.mockImplementationOnce(() => { throw new Error("FORBIDDEN_ROLE"); });
    const resolver = await import("../../graphql/resolvers/printSetting/index.js");
    await expect(resolver.Query.printSettings(null, { restaurantId: "valid-r1" }, { user: { id: "m1" } })).rejects.toThrow("FORBIDDEN_ROLE");
    expect(requireRestaurantAccess).not.toHaveBeenCalled();
    expect(Restaurant.findById).not.toHaveBeenCalled();
  });

  it("restaurant not found after scoped access keeps NOT_FOUND behavior", async () => {
    Restaurant.findById.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(null) });
    const resolver = await import("../../graphql/resolvers/printSetting/index.js");
    await expect(resolver.Query.printSettings(null, { restaurantId: "valid-r1" }, { user: { id: "m1" } })).rejects.toThrow("Restaurant not found");
    expect(requireRestaurantAccess).toHaveBeenCalled();
    expect(PrintSetting.findOne).not.toHaveBeenCalled();
  });
});
