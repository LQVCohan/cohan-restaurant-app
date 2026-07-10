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

function resolveTimezone(value) {
  const timezone = String(
    value || DEFAULT_AVAILABILITY_REGISTRATION_SETTINGS.timezone,
  );
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return DEFAULT_AVAILABILITY_REGISTRATION_SETTINGS.timezone;
  }
}

function getZonedParts(value, timezone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Tuần đăng ký lịch không hợp lệ.");
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type) => Number(parts.find((part) => part.type === type)?.value);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hours: read("hour"),
    minutes: read("minute"),
    seconds: read("second"),
  };
}

function addCalendarDays({ year, month, day }, offset) {
  const date = new Date(Date.UTC(year, month - 1, day + Number(offset || 0)));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function zonedDateTimeToUtc(parts, timezone) {
  const desiredAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hours,
    parts.minutes,
    parts.seconds || 0,
    parts.milliseconds || 0,
  );
  let timestamp = desiredAsUtc;

  // Intl gives the rendered wall-clock time for an instant. Correct the instant
  // until that wall-clock time equals the requested time in the policy timezone.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rendered = getZonedParts(new Date(timestamp), timezone);
    const renderedAsUtc = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hours,
      rendered.minutes,
      rendered.seconds,
      parts.milliseconds || 0,
    );
    const correction = desiredAsUtc - renderedAsUtc;
    if (correction === 0) break;
    timestamp += correction;
  }

  return new Date(timestamp);
}

function atPolicyTime(baseDate, dayOffset, hhmm, timezone, endOfMinute = false) {
  const base = getZonedParts(baseDate, timezone);
  const calendarDate = addCalendarDays(base, dayOffset);
  const { hours, minutes } = parseTimeParts(hhmm, "00:00");
  return zonedDateTimeToUtc(
    {
      ...calendarDate,
      hours,
      minutes,
      seconds: endOfMinute ? 59 : 0,
      milliseconds: endOfMinute ? 999 : 0,
    },
    timezone,
  );
}

export function buildAvailabilityRegistrationSchedule({
  targetWeekStart,
  targetWeekEnd,
  policy,
}) {
  const settings = policy?.availabilityRegistrationPolicy || {};
  const mode = String(
    settings.availabilityRegistrationMode ||
      DEFAULT_AVAILABILITY_REGISTRATION_SETTINGS.mode,
  ).toLowerCase();
  const openDayOffset = Number.isFinite(
    Number(settings.availabilityOpenDayOffset),
  )
    ? Number(settings.availabilityOpenDayOffset)
    : DEFAULT_AVAILABILITY_REGISTRATION_SETTINGS.openDayOffset;
  const closeDayOffset = Number.isFinite(
    Number(settings.availabilityCloseDayOffset),
  )
    ? Number(settings.availabilityCloseDayOffset)
    : DEFAULT_AVAILABILITY_REGISTRATION_SETTINGS.closeDayOffset;
  const openTime = TIME_REGEX.test(
    String(settings.availabilityOpenTime || ""),
  )
    ? String(settings.availabilityOpenTime)
    : DEFAULT_AVAILABILITY_REGISTRATION_SETTINGS.openTime;
  const closeTime = TIME_REGEX.test(
    String(settings.availabilityCloseTime || ""),
  )
    ? String(settings.availabilityCloseTime)
    : DEFAULT_AVAILABILITY_REGISTRATION_SETTINGS.closeTime;
  const timezone = resolveTimezone(settings.timezone);

  const periodStart = atPolicyTime(
    targetWeekStart,
    0,
    "00:00",
    timezone,
  );
  const periodEnd = atPolicyTime(
    targetWeekEnd,
    0,
    "23:59",
    timezone,
    true,
  );
  const openAt = atPolicyTime(
    targetWeekStart,
    openDayOffset,
    openTime,
    timezone,
  );
  const closeAt = atPolicyTime(
    targetWeekStart,
    closeDayOffset,
    closeTime,
    timezone,
  );
  if (closeAt <= openAt) {
    throw new Error("Thời hạn đóng đăng ký phải sau thời gian mở đăng ký.");
  }

  return {
    periodStart,
    periodEnd,
    openAt,
    closeAt,
    mode: mode === "auto" ? "auto" : "manual",
    timezone,
    recommendedOpenAt: openAt,
    recommendedCloseAt: closeAt,
  };
}

export function resolveAvailabilityWindowEffectiveStatus(
  windowDoc,
  now = new Date(),
) {
  const status = String(windowDoc?.status || "draft").toLowerCase();
  if (["cancelled", "used_for_schedule", "locked"].includes(status)) {
    return status;
  }
  const mode = String(
    windowDoc?.registrationModeSnapshot ||
      windowDoc?.registrationMode ||
      "manual",
  ).toLowerCase();
  if (mode !== "auto") return status;
  const openAt = new Date(windowDoc?.openAt);
  const closeAt = new Date(windowDoc?.closeAt);
  if (now < openAt) return "draft";
  if (now > closeAt) return "closed";
  return "open";
}
