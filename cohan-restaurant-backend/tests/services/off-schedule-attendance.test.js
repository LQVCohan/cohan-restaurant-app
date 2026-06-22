import { beforeEach, describe, expect, it, vi } from "vitest";

const RESTAURANT_ID = "507f1f77bcf86cd799439011";
const STAFF_ID = "507f1f77bcf86cd799439012";
const OTHER_STAFF_ID = "507f1f77bcf86cd799439013";
const MANAGER_ID = "507f1f77bcf86cd799439014";
const ACCOUNTANT_ID = "507f1f77bcf86cd799439015";
const TIMESHEET_ID = "507f1f77bcf86cd799439016";

const modelMocks = vi.hoisted(() => ({
  Staff: { find: vi.fn(), findById: vi.fn() },
  Timesheet: { find: vi.fn(), findById: vi.fn() },
  PayrollPeriod: { findOne: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);

function findChain(rows = []) {
  return {
    populate: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(rows),
  };
}

function unlockedPayroll() {
  modelMocks.PayrollPeriod.findOne.mockReturnValue({
    sort: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(null),
  });
}

function ctx(id, userType, restaurantId = RESTAURANT_ID) {
  const normalizedRole = String(userType || "").toUpperCase();
  if (normalizedRole === "ADMIN") return { user: { id, userType } };
  if (normalizedRole === "MANAGER") return { user: { id, userType, restaurantId } };
  return { user: { id, userType, restaurantForStaff: restaurantId } };
}

describe("off-schedule attendance service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unlockedPayroll();
    modelMocks.Staff.find.mockReturnValue(
      findChain([{ _id: STAFF_ID, fullName: "Staff One", employeeCode: "S001" }]),
    );
    modelMocks.Staff.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue({ _id: STAFF_ID, fullName: "Staff One" }),
    });
  });

  it("staff only sees their own off-schedule records", async () => {
    modelMocks.Timesheet.find.mockReturnValue(
      findChain([
        {
          _id: TIMESHEET_ID,
          employeeId: STAFF_ID,
          restaurantId: RESTAURANT_ID,
          workDate: new Date("2026-04-10"),
          isOffSchedule: true,
          approved: false,
          offScheduleApprovalStatus: "pending",
        },
      ]),
    );

    const { listOffScheduleAttendances } = await import(
      "../../src/services/attendance/offScheduleAttendance.service.js"
    );
    const rows = await listOffScheduleAttendances({
      filter: { restaurantId: RESTAURANT_ID, employeeId: OTHER_STAFF_ID, onlyPending: true },
      ctx: ctx(STAFF_ID, "STAFF"),
    });

    expect(modelMocks.Timesheet.find).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: expect.any(Object), isOffSchedule: true }),
    );
    expect(String(modelMocks.Timesheet.find.mock.calls[0][0].employeeId)).toBe(STAFF_ID);
    expect(rows).toHaveLength(1);
  });

  it("manager, admin, and HR can read the restaurant queue", async () => {
    modelMocks.Timesheet.find.mockReturnValue(findChain([]));
    const { listOffScheduleAttendances } = await import(
      "../../src/services/attendance/offScheduleAttendance.service.js"
    );

    await listOffScheduleAttendances({ filter: { restaurantId: RESTAURANT_ID }, ctx: ctx(MANAGER_ID, "MANAGER") });
    await listOffScheduleAttendances({ filter: { restaurantId: RESTAURANT_ID }, ctx: { user: { id: MANAGER_ID, userType: "ADMIN" } } });
    await listOffScheduleAttendances({ filter: { restaurantId: RESTAURANT_ID }, ctx: ctx(MANAGER_ID, "HR") });

    expect(modelMocks.Timesheet.find).toHaveBeenCalledTimes(3);
  });

  it("rejects users outside the restaurant scope", async () => {
    const { listOffScheduleAttendances } = await import(
      "../../src/services/attendance/offScheduleAttendance.service.js"
    );

    await expect(
      listOffScheduleAttendances({
        filter: { restaurantId: RESTAURANT_ID },
        ctx: ctx(STAFF_ID, "STAFF", "507f1f77bcf86cd799439099"),
      }),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("accountant has read-only access and cannot approve", async () => {
    modelMocks.Timesheet.find.mockReturnValue(findChain([]));
    const { listOffScheduleAttendances, approveOffScheduleAttendance } = await import(
      "../../src/services/attendance/offScheduleAttendance.service.js"
    );

    await expect(
      listOffScheduleAttendances({ filter: { restaurantId: RESTAURANT_ID }, ctx: ctx(ACCOUNTANT_ID, "ACCOUNTANT") }),
    ).resolves.toEqual([]);
    await expect(
      approveOffScheduleAttendance({ timesheetId: TIMESHEET_ID, note: "ok", ctx: ctx(ACCOUNTANT_ID, "ACCOUNTANT") }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("approve sets approved status, reviewer, time, and note", async () => {
    const save = vi.fn();
    const record = {
      _id: TIMESHEET_ID,
      employeeId: STAFF_ID,
      restaurantId: RESTAURANT_ID,
      workDate: new Date("2026-04-10"),
      isOffSchedule: true,
      approved: false,
      offScheduleApprovalStatus: "pending",
      save,
      toObject() {
        return { ...this };
      },
    };
    modelMocks.Timesheet.findById.mockResolvedValue(record);

    const { approveOffScheduleAttendance } = await import(
      "../../src/services/attendance/offScheduleAttendance.service.js"
    );
    const result = await approveOffScheduleAttendance({
      timesheetId: TIMESHEET_ID,
      note: "approved by manager",
      ctx: ctx(MANAGER_ID, "MANAGER"),
    });

    expect(record.approved).toBe(true);
    expect(record.offScheduleApprovalStatus).toBe("approved");
    expect(String(record.offScheduleReviewedBy)).toBe(MANAGER_ID);
    expect(record.offScheduleReviewedAt).toBeInstanceOf(Date);
    expect(record.offScheduleReviewNote).toBe("approved by manager");
    expect(save).toHaveBeenCalled();
    expect(result.record.offScheduleApprovalStatus).toBe("approved");
  });

  it("reject sets rejected status, reviewer, time, and note", async () => {
    const save = vi.fn();
    const record = {
      _id: TIMESHEET_ID,
      employeeId: STAFF_ID,
      restaurantId: RESTAURANT_ID,
      workDate: new Date("2026-04-10"),
      isOffSchedule: true,
      approved: false,
      offScheduleApprovalStatus: "pending",
      save,
      toObject() {
        return { ...this };
      },
    };
    modelMocks.Timesheet.findById.mockResolvedValue(record);

    const { rejectOffScheduleAttendance } = await import(
      "../../src/services/attendance/offScheduleAttendance.service.js"
    );
    await rejectOffScheduleAttendance({
      timesheetId: TIMESHEET_ID,
      note: "not authorized",
      ctx: ctx(MANAGER_ID, "MANAGER"),
    });

    expect(record.approved).toBe(false);
    expect(record.offScheduleApprovalStatus).toBe("rejected");
    expect(String(record.offScheduleReviewedBy)).toBe(MANAGER_ID);
    expect(record.offScheduleReviewedAt).toBeInstanceOf(Date);
    expect(record.offScheduleReviewNote).toBe("not authorized");
    expect(save).toHaveBeenCalled();
  });


  it("does not reject an already rejected off-schedule attendance", async () => {
    const save = vi.fn();
    const record = {
      _id: TIMESHEET_ID,
      employeeId: STAFF_ID,
      restaurantId: RESTAURANT_ID,
      workDate: new Date("2026-04-10"),
      isOffSchedule: true,
      approved: false,
      offScheduleApprovalStatus: "rejected",
      offScheduleReviewedBy: STAFF_ID,
      offScheduleReviewedAt: new Date("2026-04-11"),
      offScheduleReviewNote: "already rejected",
      save,
      toObject() {
        return { ...this };
      },
    };
    modelMocks.Timesheet.findById.mockResolvedValue(record);

    const { rejectOffScheduleAttendance } = await import(
      "../../src/services/attendance/offScheduleAttendance.service.js"
    );

    await expect(
      rejectOffScheduleAttendance({
        timesheetId: TIMESHEET_ID,
        note: "try overwrite",
        ctx: ctx(MANAGER_ID, "MANAGER"),
      }),
    ).rejects.toThrow("OFF_SCHEDULE_ATTENDANCE_ALREADY_REJECTED");

    expect(save).not.toHaveBeenCalled();
    expect(record.offScheduleReviewNote).toBe("already rejected");
  });

  it.each(["finalized", "locked", "paid"])(
    "does not approve or reject attendance inside a %s payroll period",
    async (status) => {
      modelMocks.PayrollPeriod.findOne.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue({ _id: "p1", status }),
      });
      modelMocks.Timesheet.findById.mockResolvedValue({
        _id: TIMESHEET_ID,
        employeeId: STAFF_ID,
        restaurantId: RESTAURANT_ID,
        workDate: new Date("2026-04-10"),
        isOffSchedule: true,
        approved: false,
        offScheduleApprovalStatus: "pending",
      });

      const { approveOffScheduleAttendance, rejectOffScheduleAttendance } = await import(
        "../../src/services/attendance/offScheduleAttendance.service.js"
      );

      await expect(
        approveOffScheduleAttendance({ timesheetId: TIMESHEET_ID, note: "ok", ctx: ctx(MANAGER_ID, "MANAGER") }),
      ).rejects.toThrow("kỳ lương");
      await expect(
        rejectOffScheduleAttendance({ timesheetId: TIMESHEET_ID, note: "no", ctx: ctx(MANAGER_ID, "MANAGER") }),
      ).rejects.toThrow("kỳ lương");
    },
  );
});
