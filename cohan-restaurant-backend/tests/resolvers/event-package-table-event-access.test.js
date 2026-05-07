import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRestaurantAccess = vi.fn();
const EventPackage = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn(), findById: vi.fn(), findByIdAndUpdate: vi.fn() }));
const TableEvent = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn() }));
const Table = vi.hoisted(() => ({ findOne: vi.fn() }));

vi.mock("../../models/index.js", () => ({ EventPackage, TableEvent }));
vi.mock("../../models/table.model.js", () => ({ default: Table }));
vi.mock("../../graphql/guards.js", () => ({ requireRestaurantAccess }));
vi.mock("mongoose", async () => {
  const actual = await vi.importActual("mongoose");
  const valid = (v) => typeof v === "string" && v.startsWith("valid-");
  return {
    ...actual,
    default: { ...actual.default, isValidObjectId: valid, Types: { ...actual.default.Types, ObjectId: vi.fn((v) => `oid:${v}`) } },
    isValidObjectId: valid,
  };
});

describe("event package + table event access hardening", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireRestaurantAccess.mockResolvedValue(true);
    EventPackage.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) });
    EventPackage.create.mockResolvedValue({ toObject: vi.fn().mockReturnValue({ _id: "p1" }) });
    EventPackage.findById.mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ restaurantId: "valid-r1" }) }) });
    EventPackage.findByIdAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "p1" }) });
    TableEvent.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) });
    TableEvent.create.mockResolvedValue({ toObject: vi.fn().mockReturnValue({ _id: "e1" }) });
    Table.findOne.mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "t1" }) }) });
  });

  it("event package query guards", async () => {
    const { EventPackageQuery } = await import("../../graphql/resolvers/event_package/query.js");
    requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    await expect(EventPackageQuery.eventPackagesByRestaurant(null, { restaurantId: "valid-r1" }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(EventPackage.find).not.toHaveBeenCalled();

    await EventPackageQuery.eventPackagesByRestaurant(null, { restaurantId: "valid-r1", activeOnly: true }, { user: { id: "u1" } });
    expect(requireRestaurantAccess).toHaveBeenCalledWith({ user: { id: "u1" } }, "valid-r1");
    expect(EventPackage.find).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));

    await expect(EventPackageQuery.eventPackagesByRestaurant(null, { restaurantId: "bad-id" }, { user: { id: "u1" } })).rejects.toThrow("Invalid restaurantId");
  });

  it("event package mutations guard + strip restaurantId", async () => {
    const { EventPackageMutation } = await import("../../graphql/resolvers/event_package/mutation.js");

    requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    await expect(EventPackageMutation.createEventPackage(null, { input: { restaurantId: "valid-r1" } }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(EventPackage.create).not.toHaveBeenCalled();

    await EventPackageMutation.createEventPackage(null, { input: { restaurantId: "valid-r1", name: "PKG" } }, { user: { id: "u1" } });
    expect(EventPackage.create).toHaveBeenCalled();

    await expect(EventPackageMutation.updateEventPackage(null, { input: { id: "bad-id" } }, { user: { id: "u1" } })).rejects.toThrow("Invalid event package id");
    expect(EventPackage.findById).not.toHaveBeenCalled();

    requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    await expect(EventPackageMutation.updateEventPackage(null, { input: { id: "valid-package-1", name: "New" } }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(EventPackage.findByIdAndUpdate).not.toHaveBeenCalled();

    await EventPackageMutation.updateEventPackage(null, { input: { id: "valid-package-1", restaurantId: "valid-r2", name: "New" } }, { user: { id: "u1" } });
    expect(EventPackage.findByIdAndUpdate.mock.calls[0][1].restaurantId).toBeUndefined();
  });

  it("table event query guards", async () => {
    const { TableEventQuery } = await import("../../graphql/resolvers/table_event/query.js");
    requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    await expect(TableEventQuery.tableEventsByTable(null, { restaurantId: "valid-r1", tableId: "valid-t1" }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(TableEvent.find).not.toHaveBeenCalled();

    await TableEventQuery.tableEventsByTable(null, { restaurantId: "valid-r1", tableId: "valid-t1" }, { user: { id: "u1" } });
    expect(TableEvent.find).toHaveBeenCalledWith(expect.objectContaining({ restaurantId: expect.anything(), tableId: expect.anything() }));

    await expect(TableEventQuery.tableEventsByTable(null, { restaurantId: "valid-r1", tableId: "bad-id" }, { user: { id: "u1" } })).rejects.toThrow("Invalid tableId");
  });

  it("table event create enforces scope and table ownership", async () => {
    const { TableEventMutation } = await import("../../graphql/resolvers/table_event/mutation.js");
    requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    await expect(TableEventMutation.createTableEvent(null, { input: { restaurantId: "valid-r1", tableId: "valid-t1" } }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(Table.findOne).not.toHaveBeenCalled();
    expect(TableEvent.create).not.toHaveBeenCalled();

    Table.findOne.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) });
    await expect(TableEventMutation.createTableEvent(null, { input: { restaurantId: "valid-r1", tableId: "valid-t1" } }, { user: { id: "u1" } })).rejects.toThrow("Table not found");
    expect(TableEvent.create).not.toHaveBeenCalled();

    await TableEventMutation.createTableEvent(null, { input: { restaurantId: "valid-r1", tableId: "valid-t1", eventType: "seat" } }, { user: { id: "u1" } });
    expect(Table.findOne).toHaveBeenCalled();
    expect(TableEvent.create).toHaveBeenCalled();
  });
});
