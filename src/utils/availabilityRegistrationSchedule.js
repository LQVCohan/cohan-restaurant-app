const DEFAULT_POLICY = {
  availabilityRegistrationMode: "manual",
  availabilityOpenDayOffset: -7,
  availabilityOpenTime: "00:00",
  availabilityCloseDayOffset: -5,
  availabilityCloseTime: "23:59",
};

const TZ = "Asia/Ho_Chi_Minh";

const isValidTime = (value) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ""));

const parseTime = (value, fallback) => {
  const source = isValidTime(value) ? value : fallback;
  const [hours, minutes] = source.split(":").map(Number);
  return { hours, minutes };
};

const applyOffsetAndTime = (dateValue, dayOffset, timeValue) => {
  const date = new Date(dateValue);
  const { hours, minutes } = parseTime(timeValue, "00:00");
  date.setDate(date.getDate() + Number(dayOffset || 0));
  date.setHours(hours, minutes, 0, 0);
  return date;
};

export function normalizeAvailabilityRegistrationPolicy(policy = {}) {
  return {
    ...DEFAULT_POLICY,
    ...policy,
    availabilityRegistrationMode:
      String(policy?.availabilityRegistrationMode || DEFAULT_POLICY.availabilityRegistrationMode).toLowerCase() === "auto"
        ? "auto"
        : "manual",
  };
}

export function buildAvailabilityRegistrationSchedule({ targetWeekStart, targetWeekEnd, policy } = {}) {
  const normalizedPolicy = normalizeAvailabilityRegistrationPolicy(policy);
  const periodStart = new Date(targetWeekStart);
  periodStart.setHours(0, 0, 0, 0);

  const periodEnd = new Date(targetWeekEnd);
  periodEnd.setHours(23, 59, 59, 999);

  const openAt = applyOffsetAndTime(
    periodStart,
    normalizedPolicy.availabilityOpenDayOffset,
    normalizedPolicy.availabilityOpenTime,
  );
  const closeAt = applyOffsetAndTime(
    periodStart,
    normalizedPolicy.availabilityCloseDayOffset,
    normalizedPolicy.availabilityCloseTime,
  );

  return {
    periodStart,
    periodEnd,
    openAt,
    closeAt,
    mode: normalizedPolicy.availabilityRegistrationMode,
    recommendedOpenAt: openAt,
    recommendedCloseAt: closeAt,
    timezone: TZ,
  };
}

export function resolveAvailabilityWindowEffectiveStatus(window, now = new Date()) {
  const storedStatus = String(window?.status || "draft").toLowerCase();
  if (["cancelled", "used_for_schedule", "locked"].includes(storedStatus)) {
    return storedStatus;
  }

  const mode = String(window?.registrationMode || window?.registrationModeSnapshot || "manual").toLowerCase();
  if (mode !== "auto") return storedStatus;

  const currentTime = new Date(now);
  const openAt = window?.openAt ? new Date(window.openAt) : null;
  const closeAt = window?.closeAt ? new Date(window.closeAt) : null;

  if (openAt && currentTime < openAt) return "draft";
  if (openAt && closeAt && currentTime >= openAt && currentTime <= closeAt) return "open";
  if (closeAt && currentTime > closeAt) return "closed";

  return storedStatus;
}
