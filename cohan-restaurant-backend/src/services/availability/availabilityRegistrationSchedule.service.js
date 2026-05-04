const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const DEFAULT_AVAILABILITY_REGISTRATION_SETTINGS = {
  mode: "manual",
  openDayOffset: -7,
  openTime: "00:00",
  closeDayOffset: -5,
  closeTime: "23:59",
  timezone: "Asia/Ho_Chi_Minh",
};

function parseTimeParts(value, fallback) {
  const raw = String(value || fallback || "");
  if (!TIME_REGEX.test(raw)) return parseTimeParts(fallback, "00:00");
  const [hours, minutes] = raw.split(":").map(Number);
  return { hours, minutes, raw };
}

function atLocalTime(baseDate, hhmm) {
  const next = new Date(baseDate);
  const { hours, minutes } = parseTimeParts(hhmm, "00:00");
  next.setHours(hours, minutes, 0, 0);
  return next;
}

export function buildAvailabilityRegistrationSchedule({ targetWeekStart, targetWeekEnd, policy }) {
  const settings = policy?.availabilityRegistrationPolicy || {};
  const mode = String(settings.availabilityRegistrationMode || DEFAULT_AVAILABILITY_REGISTRATION_SETTINGS.mode).toLowerCase();
  const openDayOffset = Number.isFinite(Number(settings.availabilityOpenDayOffset)) ? Number(settings.availabilityOpenDayOffset) : DEFAULT_AVAILABILITY_REGISTRATION_SETTINGS.openDayOffset;
  const closeDayOffset = Number.isFinite(Number(settings.availabilityCloseDayOffset)) ? Number(settings.availabilityCloseDayOffset) : DEFAULT_AVAILABILITY_REGISTRATION_SETTINGS.closeDayOffset;
  const openTime = TIME_REGEX.test(String(settings.availabilityOpenTime || "")) ? String(settings.availabilityOpenTime) : DEFAULT_AVAILABILITY_REGISTRATION_SETTINGS.openTime;
  const closeTime = TIME_REGEX.test(String(settings.availabilityCloseTime || "")) ? String(settings.availabilityCloseTime) : DEFAULT_AVAILABILITY_REGISTRATION_SETTINGS.closeTime;

  const periodStart = atLocalTime(targetWeekStart, "00:00");
  const periodEnd = atLocalTime(targetWeekEnd, "23:59");
  const openAt = atLocalTime(new Date(periodStart.getTime() + openDayOffset * 86400000), openTime);
  const closeAt = atLocalTime(new Date(periodStart.getTime() + closeDayOffset * 86400000), closeTime);
  if (closeAt <= openAt) throw new Error("availabilityCloseTime phải sau availabilityOpenTime.");

  return {
    periodStart,
    periodEnd,
    openAt,
    closeAt,
    mode: mode === "auto" ? "auto" : "manual",
    recommendedOpenAt: openAt,
    recommendedCloseAt: closeAt,
  };
}

export function resolveAvailabilityWindowEffectiveStatus(windowDoc, now = new Date()) {
  const status = String(windowDoc?.status || "draft").toLowerCase();
  if (["cancelled", "used_for_schedule", "locked"].includes(status)) return status;
  const mode = String(windowDoc?.registrationModeSnapshot || windowDoc?.registrationMode || "manual").toLowerCase();
  if (mode !== "auto") return status;
  const openAt = new Date(windowDoc?.openAt);
  const closeAt = new Date(windowDoc?.closeAt);
  if (now < openAt) return "draft";
  if (now > closeAt) return "closed";
  return "open";
}
