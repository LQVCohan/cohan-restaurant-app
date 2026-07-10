const DEFAULT_POLICY = {
  availabilityRegistrationMode: "manual",
  availabilityOpenDayOffset: -7,
  availabilityOpenTime: "00:00",
  availabilityCloseDayOffset: -5,
  availabilityCloseTime: "23:59",
  timezone: "Asia/Ho_Chi_Minh",
};

const isValidTime = (value) =>
  /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ""));

const parseTime = (value, fallback) => {
  const source = isValidTime(value) ? value : fallback;
  const [hours, minutes] = source.split(":").map(Number);
  return { hours, minutes };
};

const resolveTimezone = (value) => {
  const timezone = String(value || DEFAULT_POLICY.timezone);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return DEFAULT_POLICY.timezone;
  }
};

const getZonedParts = (value, timezone) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Tuần đăng ký lịch không hợp lệ.");
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
};

const addCalendarDays = ({ year, month, day }, offset) => {
  const date = new Date(Date.UTC(year, month - 1, day + Number(offset || 0)));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
};

const zonedDateTimeToUtc = (parts, timezone) => {
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
};

const atPolicyTime = (value, dayOffset, timeValue, timezone, endOfMinute = false) => {
  const calendarDate = addCalendarDays(getZonedParts(value, timezone), dayOffset);
  const { hours, minutes } = parseTime(timeValue, "00:00");
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
};

export function normalizeAvailabilityRegistrationPolicy(policy = {}) {
  return {
    ...DEFAULT_POLICY,
    ...policy,
    availabilityRegistrationMode:
      String(
        policy?.availabilityRegistrationMode ||
          DEFAULT_POLICY.availabilityRegistrationMode,
      ).toLowerCase() === "auto"
        ? "auto"
        : "manual",
  };
}

export function buildAvailabilityRegistrationSchedule({
  targetWeekStart,
  targetWeekEnd,
  policy,
} = {}) {
  const normalizedPolicy = normalizeAvailabilityRegistrationPolicy(policy);
  const timezone = resolveTimezone(normalizedPolicy.timezone);
  const periodStart = atPolicyTime(targetWeekStart, 0, "00:00", timezone);
  const periodEnd = atPolicyTime(targetWeekEnd, 0, "23:59", timezone, true);
  const openAt = atPolicyTime(
    targetWeekStart,
    normalizedPolicy.availabilityOpenDayOffset,
    normalizedPolicy.availabilityOpenTime,
    timezone,
  );
  const closeAt = atPolicyTime(
    targetWeekStart,
    normalizedPolicy.availabilityCloseDayOffset,
    normalizedPolicy.availabilityCloseTime,
    timezone,
  );

  return {
    periodStart,
    periodEnd,
    openAt,
    closeAt,
    mode: normalizedPolicy.availabilityRegistrationMode,
    recommendedOpenAt: openAt,
    recommendedCloseAt: closeAt,
    timezone,
  };
}

export function resolveAvailabilityWindowEffectiveStatus(window, now = new Date()) {
  const storedStatus = String(window?.status || "draft").toLowerCase();
  if (["cancelled", "used_for_schedule", "locked"].includes(storedStatus)) {
    return storedStatus;
  }

  const mode = String(
    window?.registrationMode || window?.registrationModeSnapshot || "manual",
  ).toLowerCase();
  if (mode !== "auto") return storedStatus;

  const currentTime = new Date(now);
  const openAt = window?.openAt ? new Date(window.openAt) : null;
  const closeAt = window?.closeAt ? new Date(window.closeAt) : null;

  if (openAt && currentTime < openAt) return "draft";
  if (openAt && closeAt && currentTime >= openAt && currentTime <= closeAt) {
    return "open";
  }
  if (closeAt && currentTime > closeAt) return "closed";

  return storedStatus;
}
