import { describe, expect, it } from "vitest";
import { buildCustomerMigrationUpdate } from "../../scripts/migration/normalizeRefRestaurantsRecentHistory.js";

const ids = Array.from({ length: 16 }, (_, index) => `507f1f77bcf86cd7994390${String(index).padStart(2, "0")}`);
const existing = new Set(ids.slice(0, 15));

describe("normalizeRefRestaurantsRecentHistory migration helpers", () => {
  it("cuts raw 15-item recent history to 12", () => {
    const stats = { removedDuplicate: 0, removedMissing: 0, removedArchived: 0, rebuiltRecent: 0, fallbackRecent: 0 };
    const update = buildCustomerMigrationUpdate({ _id: ids[0], refRestaurants: ids.slice(0, 15), customerRestaurants: [], archivedRestaurants: [] }, existing, new Map(), stats);
    expect(update.changed).toBe(true);
    expect(update.nextRefs).toHaveLength(12);
  });

  it("detects duplicate and missing IDs even when first 12 look plausible", () => {
    const stats = { removedDuplicate: 0, removedMissing: 0, removedArchived: 0, rebuiltRecent: 0, fallbackRecent: 0 };
    const dirty = [...ids.slice(0, 12), ids[1], ids[15]];
    const update = buildCustomerMigrationUpdate({ _id: ids[0], refRestaurants: dirty, customerRestaurants: dirty, archivedRestaurants: [] }, existing, new Map(), stats);
    expect(update.changed).toBe(true);
    expect(stats.removedDuplicate).toBeGreaterThan(0);
    expect(stats.removedMissing).toBeGreaterThan(0);
  });

  it("removes archived restaurants from membership but keeps fallback recent", () => {
    const stats = { removedDuplicate: 0, removedMissing: 0, removedArchived: 0, rebuiltRecent: 0, fallbackRecent: 0 };
    const update = buildCustomerMigrationUpdate({ _id: ids[0], refRestaurants: [ids[1], ids[2]], customerRestaurants: [ids[1], ids[2]], archivedRestaurants: [{ restaurantId: ids[2] }] }, existing, new Map(), stats);
    expect(update.customerRestaurants).toEqual([ids[1]]);
    expect(update.nextRefs).toEqual([ids[1], ids[2]]);
    expect(stats.removedArchived).toBe(1);
    expect(stats.fallbackRecent).toBe(1);
  });

  it("uses transactions newest first when present", () => {
    const transactionMap = new Map([[ids[0], [ids[3], ids[1]]]]);
    const stats = { removedDuplicate: 0, removedMissing: 0, removedArchived: 0, rebuiltRecent: 0, fallbackRecent: 0 };
    const update = buildCustomerMigrationUpdate({ _id: ids[0], refRestaurants: [ids[1]], customerRestaurants: [], archivedRestaurants: [] }, existing, transactionMap, stats);
    expect(update.nextRefs).toEqual([ids[3], ids[1]]);
    expect(stats.rebuiltRecent).toBe(1);
  });
});

import mongoose from "mongoose";
import { Customer, Order, Reservation, Restaurant, User } from "../../models/index.js";
import { isMainModulePath, run } from "../../scripts/migration/normalizeRefRestaurantsRecentHistory.js";

describe("normalizeRefRestaurantsRecentHistory migration runtime", () => {
  it("does not treat imported module as the main entrypoint and handles Windows paths", () => {
    expect(isMainModulePath("C:\\repo\\other.js", "file:///C:/repo/normalizeRefRestaurantsRecentHistory.js")).toBe(false);
    expect(isMainModulePath("C:\\repo\\normalizeRefRestaurantsRecentHistory.js", "file:///C:/repo/normalizeRefRestaurantsRecentHistory.js")).toBe(true);
  });

  it("does not write in dry-run mode", async () => {
    const oldMongoUri = process.env.MONGO_URI;
    process.env.MONGO_URI = "mongodb://example.test/cohan_test";
    const connect = vi.spyOn(mongoose, "connect").mockImplementation(async () => {
      mongoose.connection.db = { databaseName: "cohan_test" };
      mongoose.connection.name = "cohan_test";
      return mongoose;
    });
    const disconnect = vi.spyOn(mongoose, "disconnect").mockResolvedValue();
    vi.spyOn(Restaurant, "find").mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: ids[1] }]) }) });
    vi.spyOn(Customer, "find").mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: ids[0], refRestaurants: [ids[1]], customerRestaurants: [], archivedRestaurants: [] }]) }) });
    vi.spyOn(User, "find").mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: "admin-1" }]) }) });
    const userUpdate = vi.spyOn(User, "updateMany").mockResolvedValue({ modifiedCount: 0 });
    const customerUpdate = vi.spyOn(Customer, "updateOne").mockResolvedValue({ modifiedCount: 0 });
    vi.spyOn(Order, "aggregate").mockResolvedValue([]);
    vi.spyOn(Reservation, "aggregate").mockResolvedValue([]);

    await run();

    expect(connect).toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
    expect(customerUpdate).not.toHaveBeenCalled();
    await disconnect.mock.results[0]?.value;
    if (oldMongoUri === undefined) delete process.env.MONGO_URI;
    else process.env.MONGO_URI = oldMongoUri;
    vi.restoreAllMocks();
  });
});
