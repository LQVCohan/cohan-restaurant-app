import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  KitchenShiftRosterSnapshot: {
    updateMany: vi.fn(),
    insertMany: vi.fn(),
  },
  Shift: { find: vi.fn() },
  Staff: { find: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);

const basePublication = { _id: "pub-1" };
const baseShift = {
  _id: "shift-1",
  employeeId: "staff-1",
  shiftType: "morning",
  startTime: new Date("2026-05-10T06:00:00.000Z"),
  endTime: new Date("2026-05-10T14:00:00.000Z"),
};

function staffQueryResult(rows) {
  return {
    select: vi.fn(() => ({
      populate: vi.fn(() => ({
        lean: vi.fn(async () => rows),
      })),
    })),
  };
}

describe("syncKitchenShiftRosterSnapshotsForPublication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.KitchenShiftRosterSnapshot.updateMany.mockResolvedValue({ modifiedCount: 0 });
    modelMocks.KitchenShiftRosterSnapshot.insertMany.mockImplementation(async (docs) => docs);
  });

  it("creates kitchen snapshot", async () => {
    modelMocks.Staff.find.mockReturnValue(
      staffQueryResult([{ _id: "staff-1", department: "kitchen", fullName: "Chef A" }]),
    );

    const { syncKitchenShiftRosterSnapshotsForPublication } = await import(
      "../../src/services/kitchen/kitchenShiftRosterSnapshot.service.js"
    );

    const result = await syncKitchenShiftRosterSnapshotsForPublication({
      restaurantId: "rest-1",
      publication: basePublication,
      shifts: [baseShift],
      actorUserId: "actor-1",
      source: "schedule_publish",
    });

    expect(result.createdCount).toBe(1);
    expect(modelMocks.KitchenShiftRosterSnapshot.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          station: "kitchen",
          shiftId: "shift-1",
          schedulePublicationId: "pub-1",
          employeeId: "staff-1",
        }),
      ]),
    );
  });

  it("creates bar snapshot", async () => {
    modelMocks.Staff.find.mockReturnValue(
      staffQueryResult([{ _id: "staff-1", department: "bar", fullName: "Bar A" }]),
    );
    const { syncKitchenShiftRosterSnapshotsForPublication } = await import(
      "../../src/services/kitchen/kitchenShiftRosterSnapshot.service.js"
    );

    await syncKitchenShiftRosterSnapshotsForPublication({
      restaurantId: "rest-1",
      publication: basePublication,
      shifts: [baseShift],
      actorUserId: "actor-1",
      source: "schedule_publish",
    });

    expect(modelMocks.KitchenShiftRosterSnapshot.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ station: "bar" })]),
    );
  });

  it("skips non kitchen bar departments", async () => {
    modelMocks.Staff.find.mockReturnValue(
      staffQueryResult([{ _id: "staff-1", department: "service", fullName: "Service A" }]),
    );
    const { syncKitchenShiftRosterSnapshotsForPublication } = await import(
      "../../src/services/kitchen/kitchenShiftRosterSnapshot.service.js"
    );

    const result = await syncKitchenShiftRosterSnapshotsForPublication({
      restaurantId: "rest-1",
      publication: basePublication,
      shifts: [baseShift],
      actorUserId: "actor-1",
      source: "schedule_publish",
    });

    expect(result.createdCount).toBe(0);
    expect(modelMocks.KitchenShiftRosterSnapshot.insertMany).not.toHaveBeenCalled();
  });

  it("maps chef role to head_chef", async () => {
    modelMocks.Staff.find.mockReturnValue(
      staffQueryResult([{ _id: "staff-1", positionTitle: "Bếp trưởng", fullName: "Chef A" }]),
    );
    const { syncKitchenShiftRosterSnapshotsForPublication } = await import(
      "../../src/services/kitchen/kitchenShiftRosterSnapshot.service.js"
    );

    await syncKitchenShiftRosterSnapshotsForPublication({
      restaurantId: "rest-1",
      publication: basePublication,
      shifts: [baseShift],
      actorUserId: "actor-1",
      source: "schedule_publish",
    });

    expect(modelMocks.KitchenShiftRosterSnapshot.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ kitchenDutyRole: "head_chef" })]),
    );
  });

  it("maps kitchen_helper to assistant_chef", async () => {
    modelMocks.Staff.find.mockReturnValue(
      staffQueryResult([{ _id: "staff-1", roleName: "kitchen_helper", fullName: "Helper A" }]),
    );
    const { syncKitchenShiftRosterSnapshotsForPublication } = await import(
      "../../src/services/kitchen/kitchenShiftRosterSnapshot.service.js"
    );

    await syncKitchenShiftRosterSnapshotsForPublication({
      restaurantId: "rest-1",
      publication: basePublication,
      shifts: [baseShift],
      actorUserId: "actor-1",
      source: "schedule_publish",
    });

    expect(modelMocks.KitchenShiftRosterSnapshot.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ kitchenDutyRole: "assistant_chef" })]),
    );
  });

  it("supersedes active snapshots on repeated sync", async () => {
    modelMocks.KitchenShiftRosterSnapshot.updateMany.mockResolvedValue({ modifiedCount: 2 });
    modelMocks.Staff.find.mockReturnValue(
      staffQueryResult([{ _id: "staff-1", department: "kitchen", fullName: "Chef A" }]),
    );
    const { syncKitchenShiftRosterSnapshotsForPublication } = await import(
      "../../src/services/kitchen/kitchenShiftRosterSnapshot.service.js"
    );

    const result = await syncKitchenShiftRosterSnapshotsForPublication({
      restaurantId: "rest-1",
      publication: basePublication,
      shifts: [baseShift],
      actorUserId: "actor-1",
      source: "schedule_republish",
    });

    expect(result.supersededCount).toBe(2);
    expect(modelMocks.KitchenShiftRosterSnapshot.updateMany).toHaveBeenCalledTimes(1);
    expect(result.createdCount).toBe(1);
  });

  it("is null-safe with missing staff profile fields", async () => {
    modelMocks.Staff.find.mockReturnValue(staffQueryResult([{ _id: "staff-1" }]));
    const { syncKitchenShiftRosterSnapshotsForPublication } = await import(
      "../../src/services/kitchen/kitchenShiftRosterSnapshot.service.js"
    );

    await expect(
      syncKitchenShiftRosterSnapshotsForPublication({
        restaurantId: "rest-1",
        publication: basePublication,
        shifts: [baseShift],
        actorUserId: "actor-1",
        source: "schedule_publish",
      }),
    ).resolves.toEqual({ createdCount: 0, supersededCount: 0 });
  });
});
