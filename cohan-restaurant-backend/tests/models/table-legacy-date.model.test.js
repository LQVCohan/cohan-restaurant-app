import { describe, expect, it } from "vitest";
import Table from "../../models/table.model.js";

const RESTAURANT_ID = "507f1f77bcf86cd799439001";
const FLOOR_ID = "507f1f77bcf86cd799439002";

const tableInput = (dates = {}) => ({
  restaurantId: RESTAURANT_ID,
  floorId: FLOOR_ID,
  code: "A1",
  capacity: 4,
  position: { x: 0, y: 0 },
  ...dates,
});

describe("Table legacy backup dates", () => {
  it("normalizes empty-object date placeholders before Mongoose casts them", () => {
    const table = new Table(tableInput({
      tableQrGeneratedAt: {},
      tableQrExpiresAt: {},
      mergedAt: {},
      viewLock: { expiresAt: {}, sessionId: "legacy-lock" },
    }));

    expect(table.tableQrGeneratedAt).toBeNull();
    expect(table.tableQrExpiresAt).toBeNull();
    expect(table.mergedAt).toBeNull();
    expect(table.viewLock.expiresAt).toBeNull();
    expect(table.validateSync()).toBeUndefined();
  });

  it("keeps valid ISO date values", () => {
    const generatedAt = "2026-07-11T01:00:00.000Z";
    const expiresAt = "2026-07-11T03:00:00.000Z";
    const table = new Table(tableInput({
      tableQrGeneratedAt: generatedAt,
      tableQrExpiresAt: expiresAt,
      mergedAt: generatedAt,
      viewLock: { expiresAt },
    }));

    expect(table.tableQrGeneratedAt).toEqual(new Date(generatedAt));
    expect(table.tableQrExpiresAt).toEqual(new Date(expiresAt));
    expect(table.mergedAt).toEqual(new Date(generatedAt));
    expect(table.viewLock.expiresAt).toEqual(new Date(expiresAt));
    expect(table.validateSync()).toBeUndefined();
  });
});
