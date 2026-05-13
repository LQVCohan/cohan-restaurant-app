import { EventLog, Restaurant } from "../../models/index.js";
import {
  DEFAULT_MISSED_CHECKOUT_GRACE_MINUTES,
  DEFAULT_NO_SHOW_GRACE_MINUTES,
  detectAttendanceExceptionsForRange,
} from "../services/attendance/attendanceExceptionDetection.service.js";

export const ATTENDANCE_EXCEPTION_JOB_NAME = "attendance_exception_detection";

const DEFAULT_TZ_OFFSET_MINUTES = 7 * 60;

const toDate = (value, fallback = new Date()) => {
  const date = value ? new Date(value) : new Date(fallback);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date supplied to attendance exception job.");
  }
  return date;
};

const toUtcOffsetStartOfDay = (value, offsetMinutes = DEFAULT_TZ_OFFSET_MINUTES) => {
  const date = toDate(value);
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - offsetMinutes * 60 * 1000);
};

const toUtcOffsetEndOfDay = (value, offsetMinutes = DEFAULT_TZ_OFFSET_MINUTES) => {
  const start = toUtcOffsetStartOfDay(value, offsetMinutes);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
};

const addDays = (value, days) =>
  new Date(toDate(value).getTime() + days * 24 * 60 * 60 * 1000);

const addHours = (value, hours) =>
  new Date(toDate(value).getTime() + hours * 60 * 60 * 1000);

const normalizeSummary = (summary = {}) => ({
  scannedShifts: Number(summary.scannedShifts || 0),
  noShowCreated: Number(summary.noShowCreated || 0),
  noShowUpdated: Number(summary.noShowUpdated || 0),
  missedCheckoutUpdated: Number(summary.missedCheckoutUpdated || 0),
  skippedLockedPayroll: Number(summary.skippedLockedPayroll || 0),
});

const addSummaries = (left = {}, right = {}) => {
  const a = normalizeSummary(left);
  const b = normalizeSummary(right);
  return {
    scannedShifts: a.scannedShifts + b.scannedShifts,
    noShowCreated: a.noShowCreated + b.noShowCreated,
    noShowUpdated: a.noShowUpdated + b.noShowUpdated,
    missedCheckoutUpdated: a.missedCheckoutUpdated + b.missedCheckoutUpdated,
    skippedLockedPayroll: a.skippedLockedPayroll + b.skippedLockedPayroll,
  };
};

export function resolveAttendanceExceptionJobWindow({
  startDate,
  endDate,
  now = new Date(),
  lookbackDays = 2,
  lookaheadHours = 0,
} = {}) {
  const evaluationTime = toDate(now);
  const defaultStart = toUtcOffsetStartOfDay(
    addDays(evaluationTime, -Math.max(1, Number(lookbackDays || 2)) + 1),
  );
  const defaultEndBase = lookaheadHours
    ? addHours(evaluationTime, Number(lookaheadHours || 0))
    : evaluationTime;

  return {
    startDate: startDate ? toDate(startDate) : defaultStart,
    endDate: endDate ? toDate(endDate) : toUtcOffsetEndOfDay(defaultEndBase),
    now: evaluationTime,
  };
}

async function writeAttendanceExceptionJobLog({
  restaurantId,
  actorId,
  triggeredBy,
  startDate,
  endDate,
  now,
  summary,
  status,
  error,
}) {
  if (typeof EventLog?.log !== "function") return null;

  return EventLog.log({
    restaurantId: restaurantId || undefined,
    actorUserId: actorId || undefined,
    verb: `job.${ATTENDANCE_EXCEPTION_JOB_NAME}`,
    source: "cron",
    status: status === "success" ? "success" : "failed",
    object: restaurantId
      ? { kind: "Restaurant", id: restaurantId }
      : { kind: "Job", code: ATTENDANCE_EXCEPTION_JOB_NAME },
    meta: {
      jobName: ATTENDANCE_EXCEPTION_JOB_NAME,
      triggeredBy,
      startDate,
      endDate,
      now,
      summary: normalizeSummary(summary),
      status,
      error: error ? String(error?.message || error) : undefined,
    },
  });
}

export async function runAttendanceExceptionDetectionJob({
  restaurantId,
  startDate,
  endDate,
  now,
  noShowGraceMinutes = DEFAULT_NO_SHOW_GRACE_MINUTES,
  missedCheckoutGraceMinutes = DEFAULT_MISSED_CHECKOUT_GRACE_MINUTES,
  actorId,
  triggeredBy = "system",
} = {}) {
  if (!restaurantId) {
    return runAttendanceExceptionDetectionForAllRestaurants({
      startDate,
      endDate,
      now,
      noShowGraceMinutes,
      missedCheckoutGraceMinutes,
      actorId,
      triggeredBy,
    });
  }

  const window = resolveAttendanceExceptionJobWindow({ startDate, endDate, now });

  try {
    const summary = normalizeSummary(
      await detectAttendanceExceptionsForRange({
        restaurantId,
        startDate: window.startDate,
        endDate: window.endDate,
        now: window.now,
        noShowGraceMinutes,
        missedCheckoutGraceMinutes,
      }),
    );

    await writeAttendanceExceptionJobLog({
      restaurantId,
      actorId,
      triggeredBy,
      startDate: window.startDate,
      endDate: window.endDate,
      now: window.now,
      summary,
      status: "success",
    });

    return summary;
  } catch (error) {
    await writeAttendanceExceptionJobLog({
      restaurantId,
      actorId,
      triggeredBy,
      startDate: window.startDate,
      endDate: window.endDate,
      now: window.now,
      summary: {},
      status: "failed",
      error,
    });
    throw error;
  }
}

async function loadActiveRestaurantIds() {
  const query = Restaurant.find({ status: "active" });
  if (typeof query.select === "function") query.select("_id");
  if (typeof query.lean === "function") {
    return (await query.lean()).map((row) => row._id);
  }
  const rows = await query;
  return rows.map((row) => row._id);
}

export async function runAttendanceExceptionDetectionForAllRestaurants({
  now,
  startDate,
  endDate,
  lookbackDays = 2,
  lookaheadHours = 0,
  noShowGraceMinutes = DEFAULT_NO_SHOW_GRACE_MINUTES,
  missedCheckoutGraceMinutes = DEFAULT_MISSED_CHECKOUT_GRACE_MINUTES,
  actorId,
  triggeredBy = "system",
} = {}) {
  const window = resolveAttendanceExceptionJobWindow({
    startDate,
    endDate,
    now,
    lookbackDays,
    lookaheadHours,
  });
  const restaurantIds = await loadActiveRestaurantIds();
  const failures = [];
  let summary = normalizeSummary();

  for (const restaurantId of restaurantIds) {
    try {
      const restaurantSummary = await runAttendanceExceptionDetectionJob({
        restaurantId,
        startDate: window.startDate,
        endDate: window.endDate,
        now: window.now,
        noShowGraceMinutes,
        missedCheckoutGraceMinutes,
        actorId,
        triggeredBy,
      });
      summary = addSummaries(summary, restaurantSummary);
    } catch (error) {
      failures.push({ restaurantId, error: String(error?.message || error) });
    }
  }

  const status = failures.length
    ? failures.length === restaurantIds.length
      ? "failed"
      : "partial_failed"
    : "success";

  await writeAttendanceExceptionJobLog({
    actorId,
    triggeredBy,
    startDate: window.startDate,
    endDate: window.endDate,
    now: window.now,
    summary,
    status,
    error: failures.length ? JSON.stringify(failures) : undefined,
  });

  return {
    status,
    summary,
    restaurantCount: restaurantIds.length,
    failedCount: failures.length,
    failures,
  };
}
