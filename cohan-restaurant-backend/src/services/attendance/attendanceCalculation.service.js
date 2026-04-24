function toValidDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function minutesBetween(start, end) {
  const s = toValidDate(start);
  const e = toValidDate(end);
  if (!s || !e) return 0;
  return Math.max(Math.round((e.getTime() - s.getTime()) / 60000), 0);
}

export function calculateAttendanceMetrics({
  plannedStartTime,
  plannedEndTime,
  actualCheckInAt,
  actualCheckOutAt,
}) {
  const plannedStart = toValidDate(plannedStartTime);
  const plannedEnd = toValidDate(plannedEndTime);
  const actualIn = toValidDate(actualCheckInAt);
  const actualOut = toValidDate(actualCheckOutAt);

  if (actualIn && actualOut && actualOut <= actualIn) {
    throw new Error("Giờ check-out phải lớn hơn giờ check-in.");
  }

  const hasFullActualTime = Boolean(actualIn && actualOut);
  const workedMinutes = hasFullActualTime
    ? minutesBetween(actualIn, actualOut)
    : 0;

  if (workedMinutes > 24 * 60) {
    throw new Error("Tổng thời gian làm việc không được vượt quá 24 giờ.");
  }

  const latenessMinutes =
    plannedStart && actualIn
      ? Math.max(minutesBetween(plannedStart, actualIn), 0)
      : 0;

  const earlyLeaveMinutes =
    plannedEnd && actualOut && actualOut < plannedEnd
      ? Math.max(minutesBetween(actualOut, plannedEnd), 0)
      : 0;

  const overtimeMinutes =
    plannedEnd && actualOut && actualOut > plannedEnd
      ? Math.max(minutesBetween(plannedEnd, actualOut), 0)
      : 0;

  return {
    workedMinutes,
    hours: Number((workedMinutes / 60).toFixed(2)),
    latenessMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
  };
}

export function deriveAttendanceStatus({
  actualCheckInAt,
  actualCheckOutAt,
  isOffSchedule,
  latenessMinutes,
  earlyLeaveMinutes,
}) {
  if (!actualCheckInAt) {
    return isOffSchedule ? "unscheduled_absent" : "scheduled_absent";
  }

  if (!actualCheckOutAt) {
    return isOffSchedule ? "unscheduled_checkin" : "checked_in";
  }

  if (isOffSchedule) {
    return "unscheduled_completed";
  }

  const hasLate = Number(latenessMinutes || 0) > 0;
  const hasEarly = Number(earlyLeaveMinutes || 0) > 0;

  if (hasLate && hasEarly) return "late_early_leave";
  if (hasLate) return "late";
  if (hasEarly) return "early_leave";
  return "completed";
}
