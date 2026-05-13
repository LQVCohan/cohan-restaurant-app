import {
  PayrollPeriod,
  SchedulePublication,
  Shift,
  Timesheet,
} from "../../../models/index.js";
import { syncAttendancePerformanceIncidents } from "../performance/attendancePerformanceIntegration.service.js";

export const ATTENDANCE_EXCEPTION_TIMEZONE = "Asia/Ho_Chi_Minh";
export const DEFAULT_NO_SHOW_GRACE_MINUTES = 15;
export const DEFAULT_MISSED_CHECKOUT_GRACE_MINUTES = 30;

const OFFICIAL_PUBLICATION_STATUSES = new Set(["published", "active"]);
const IGNORED_SHIFT_STATUSES = new Set(["cancelled", "deleted"]);
const MANUAL_CORRECTION_SOURCE = "manual_correction";

const addMinutes = (value, minutes) =>
  new Date(new Date(value).getTime() + minutes * 60 * 1000);

const toDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date supplied to attendance exception detection.");
  }
  return date;
};

const toUtcOffsetStartOfDay = (value, offsetMinutes = 7 * 60) => {
  const date = toDate(value);
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - offsetMinutes * 60 * 1000);
};

const toUtcOffsetEndOfDay = (value, offsetMinutes = 7 * 60) => {
  const start = toUtcOffsetStartOfDay(value, offsetMinutes);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
};

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const overlapsRange = (rangeStart, rangeEnd, start, end) =>
  toDate(start) <= toDate(rangeEnd) && toDate(end) >= toDate(rangeStart);

const mapByShiftId = (rows = []) =>
  new Map(
    rows
      .filter((row) => row?.shiftId)
      .map((row) => [String(row.shiftId?._id || row.shiftId), row]),
  );

const shouldSkipMissedCheckoutUpdate = (timesheet) =>
  normalizeStatus(timesheet?.status) === "missed_checkout" ||
  (normalizeStatus(timesheet?.source) === MANUAL_CORRECTION_SOURCE &&
    !timesheet?.actualCheckOutAt);

const isPublishedOrActivePublication = (publication) =>
  OFFICIAL_PUBLICATION_STATUSES.has(normalizeStatus(publication?.status));

const isOfficialShiftStatus = (shift) =>
  !IGNORED_SHIFT_STATUSES.has(normalizeStatus(shift?.status));

async function loadLockedPayrollPeriods({ restaurantId, startDate, endDate }) {
  if (!restaurantId || !startDate || !endDate) return [];

  return PayrollPeriod.find({
    restaurantId,
    status: { $in: ["finalized", "locked", "paid"] },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  }).lean();
}

const shiftOverlapsLockedPayroll = (shift, lockedPayrollPeriods = []) =>
  lockedPayrollPeriods.some((period) =>
    overlapsRange(
      period.startDate,
      period.endDate,
      shift.startTime,
      shift.endTime,
    ),
  );

const buildNoShowPayload = (shift) => ({
  employeeId: shift.employeeId,
  restaurantId: shift.restaurantId,
  shiftId: shift._id,
  workDate: toUtcOffsetStartOfDay(shift.startTime),
  plannedStartTime: shift.startTime,
  plannedEndTime: shift.endTime,
  actualCheckInAt: null,
  actualCheckOutAt: null,
  workedMinutes: 0,
  hours: 0,
  latenessMinutes: 0,
  earlyLeaveMinutes: 0,
  overtimeMinutes: 0,
  source: "system",
  status: "scheduled_absent",
  isOffSchedule: false,
  offScheduleApprovalStatus: "not_required",
  approved: false,
});

async function loadEligibleSchedulePublications({
  restaurantId,
  startDate,
  endDate,
}) {
  const rows = await SchedulePublication.find({
    restaurantId,
    status: { $in: [...OFFICIAL_PUBLICATION_STATUSES] },
    periodStart: { $lte: endDate },
    periodEnd: { $gte: startDate },
  }).lean();

  return rows.filter(isPublishedOrActivePublication);
}

function filterShiftsInsideOfficialPublications(shifts, publications) {
  if (!publications.length) return [];

  return shifts.filter((shift) =>
    publications.some((publication) =>
      overlapsRange(
        publication.periodStart,
        publication.periodEnd,
        shift.startTime,
        shift.endTime,
      ),
    ),
  );
}

async function loadEligibleShifts({ restaurantId, startDate, endDate }) {
  const publications = await loadEligibleSchedulePublications({
    restaurantId,
    startDate,
    endDate,
  });

  if (!publications.length) return [];

  const shifts = await Shift.find({
    restaurantId,
    employeeId: { $ne: null },
    status: { $nin: [...IGNORED_SHIFT_STATUSES] },
    startTime: { $lte: endDate },
    endTime: { $gte: startDate },
  }).lean();

  return filterShiftsInsideOfficialPublications(
    shifts.filter(isOfficialShiftStatus),
    publications,
  );
}

async function loadTimesheetsForEligibleShifts({ restaurantId, shiftIds }) {
  if (!shiftIds.length) return [];

  const query = Timesheet.find({
    restaurantId,
    shiftId: { $in: shiftIds },
  });

  if (typeof query.setOptions === "function") {
    query.setOptions({ skipAttendanceExceptionDetection: true });
  }

  return query;
}

async function syncPerformanceForTimesheet(timesheet) {
  try {
    await syncAttendancePerformanceIncidents(timesheet, {
      actorRole: "system",
    });
  } catch (error) {
    console.warn("Failed to sync attendance performance incidents:", error.message);
  }
}

async function createNoShowTimesheet(shift) {
  const record = new Timesheet(buildNoShowPayload(shift));
  await record.save();
  await syncPerformanceForTimesheet(record);
  return record;
}

async function ensureNoShowForShift({
  shift,
  timesheet,
  now,
  noShowGraceMinutes,
}) {
  if (now < addMinutes(shift.startTime, noShowGraceMinutes)) {
    return { created: false, updated: false };
  }

  if (timesheet?.actualCheckInAt) {
    return { created: false, updated: false };
  }

  if (!timesheet) {
    await createNoShowTimesheet(shift);
    return { created: true, updated: false };
  }

  let changed = false;
  if (normalizeStatus(timesheet.status) !== "scheduled_absent") {
    timesheet.status = "scheduled_absent";
    changed = true;
  }
  if (timesheet.isOffSchedule) {
    timesheet.isOffSchedule = false;
    changed = true;
  }
  if (!timesheet.plannedStartTime) {
    timesheet.plannedStartTime = shift.startTime;
    changed = true;
  }
  if (!timesheet.plannedEndTime) {
    timesheet.plannedEndTime = shift.endTime;
    changed = true;
  }

  if (!changed) {
    return { created: false, updated: false };
  }

  await timesheet.save();
  await syncPerformanceForTimesheet(timesheet);
  return { created: false, updated: true };
}

async function ensureMissedCheckoutForTimesheet({
  shift,
  timesheet,
  now,
  missedCheckoutGraceMinutes,
}) {
  if (!timesheet?.actualCheckInAt || timesheet?.actualCheckOutAt) {
    return false;
  }

  const plannedEndTime = timesheet.plannedEndTime || shift?.endTime || null;
  if (!plannedEndTime) return false;

  if (now < addMinutes(plannedEndTime, missedCheckoutGraceMinutes)) {
    return false;
  }

  if (shouldSkipMissedCheckoutUpdate(timesheet)) {
    return false;
  }

  timesheet.status = "missed_checkout";
  if (!timesheet.plannedStartTime && shift?.startTime) {
    timesheet.plannedStartTime = shift.startTime;
  }
  if (!timesheet.plannedEndTime) {
    timesheet.plannedEndTime = plannedEndTime;
  }
  await timesheet.save();
  await syncPerformanceForTimesheet(timesheet);
  return true;
}

export async function detectAttendanceExceptionsForRange({
  restaurantId,
  startDate,
  endDate,
  now = new Date(),
  noShowGraceMinutes = DEFAULT_NO_SHOW_GRACE_MINUTES,
  missedCheckoutGraceMinutes = DEFAULT_MISSED_CHECKOUT_GRACE_MINUTES,
}) {
  const rangeStart = toUtcOffsetStartOfDay(startDate);
  const rangeEnd = toUtcOffsetEndOfDay(endDate);
  const evaluationTime = toDate(now);

  const shifts = await loadEligibleShifts({
    restaurantId,
    startDate: rangeStart,
    endDate: rangeEnd,
  });

  const timesheets = await loadTimesheetsForEligibleShifts({
    restaurantId,
    shiftIds: shifts.map((shift) => shift._id),
  });
  const timesheetByShiftId = mapByShiftId(timesheets);
  const lockedPayrollPeriods = await loadLockedPayrollPeriods({
    restaurantId,
    startDate: rangeStart,
    endDate: rangeEnd,
  });

  const summary = {
    scannedShifts: shifts.length,
    noShowCreated: 0,
    noShowUpdated: 0,
    missedCheckoutUpdated: 0,
    skippedLockedPayroll: 0,
  };

  for (const shift of shifts) {
    if (shiftOverlapsLockedPayroll(shift, lockedPayrollPeriods)) {
      summary.skippedLockedPayroll += 1;
      continue;
    }
    const timesheet = timesheetByShiftId.get(String(shift._id)) || null;
    const noShowResult = await ensureNoShowForShift({
      shift,
      timesheet,
      now: evaluationTime,
      noShowGraceMinutes,
    });

    if (noShowResult.created) {
      summary.noShowCreated += 1;
      continue;
    }

    if (noShowResult.updated) {
      summary.noShowUpdated += 1;
    }

    if (
      await ensureMissedCheckoutForTimesheet({
        shift,
        timesheet,
        now: evaluationTime,
        missedCheckoutGraceMinutes,
      })
    ) {
      summary.missedCheckoutUpdated += 1;
    }
  }

  return summary;
}

export const __testables__ = {
  addMinutes,
  buildNoShowPayload,
  filterShiftsInsideOfficialPublications,
  isPublishedOrActivePublication,
  loadLockedPayrollPeriods,
  shiftOverlapsLockedPayroll,
  shouldSkipMissedCheckoutUpdate,
  toUtcOffsetEndOfDay,
  toUtcOffsetStartOfDay,
};
