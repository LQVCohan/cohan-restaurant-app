const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function toZonedDate(now, timezone = DEFAULT_TIMEZONE) {
  return new Date(now.toLocaleString("en-US", { timeZone: timezone }));
}

function getZonedParts(date, timezone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function getTimezoneOffsetMs(date, timezone = DEFAULT_TIMEZONE) {
  const parts = getZonedParts(date, timezone);
  const asUTC = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUTC - date.getTime();
}

function zonedLocalToUtcDate(localDateTime, timezone = DEFAULT_TIMEZONE) {
  const {
    year, month, day, hour, minute, second = 0,
  } = localDateTime;
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  let offset = getTimezoneOffsetMs(new Date(utcGuess), timezone);
  let result = utcGuess - offset;
  offset = getTimezoneOffsetMs(new Date(result), timezone);
  result = utcGuess - offset;
  return new Date(result);
}

export function resolveMenuTimeSlotAt(value, timezone = DEFAULT_TIMEZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const { hour } = getZonedParts(date, timezone);
  if (hour >= 5 && hour < 10) return "breakfast";
  if (hour >= 10 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 22) return "dinner";
  return "late_night";
}

function parseTimeToMinutes(timeText) {
  const [h, m] = String(timeText || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return (h * 60) + m;
}

function normalizeSlot(slot) {
  if (!slot?.open || !slot?.close) return null;
  const open = parseTimeToMinutes(slot.open);
  const close = parseTimeToMinutes(slot.close);
  if (open == null || close == null) return null;
  return { open: slot.open, close: slot.close, openMin: open, closeMin: close };
}

export function normalizeWeeklyOpeningHours(restaurant = {}) {
  const normalized = Object.fromEntries(DAY_KEYS.map((d) => [d, []]));
  const weekly = restaurant.weeklyOpeningHours || {};

  for (const day of DAY_KEYS) {
    normalized[day] = (Array.isArray(weekly[day]) ? weekly[day] : [])
      .map(normalizeSlot)
      .filter(Boolean);
  }

  const hasAny = DAY_KEYS.some((d) => normalized[d].length > 0);
  if (!hasAny && restaurant.openingHours && restaurant.closingHours) {
    const fallback = normalizeSlot({ open: restaurant.openingHours, close: restaurant.closingHours });
    if (fallback) {
      for (const day of DAY_KEYS) normalized[day] = [fallback];
    }
  }

  return normalized;
}

export function isWithinOpeningSlots(slots = [], now = new Date(), timezone = DEFAULT_TIMEZONE) {
  const local = toZonedDate(now, timezone);
  const currentMin = local.getHours() * 60 + local.getMinutes();

  return slots.some((slot) => {
    const normalized = normalizeSlot(slot);
    if (!normalized) return false;
    const { openMin, closeMin } = normalized;
    if (openMin === closeMin) return true;
    if (openMin < closeMin) return currentMin >= openMin && currentMin < closeMin;
    return currentMin >= openMin || currentMin < closeMin;
  });
}

function getDateKey(localDate) {
  return localDate.toISOString().slice(0, 10);
}

function resolveTodaySlots(restaurant, now, timezone) {
  const local = toZonedDate(now, timezone);
  const todayKey = getDateKey(local);
  const specials = Array.isArray(restaurant.specialHours) ? restaurant.specialHours : [];
  const special = specials.find((s) => s?.date === todayKey);

  if (special) {
    return {
      source: "special",
      reason: special.reason || null,
      isClosed: !!special.isClosed,
      slots: (Array.isArray(special.slots) ? special.slots : []).map(normalizeSlot).filter(Boolean),
      local,
    };
  }

  const weekly = normalizeWeeklyOpeningHours(restaurant);
  const todayName = DAY_KEYS[local.getDay()];
  return {
    source: "weekly",
    reason: null,
    isClosed: false,
    slots: weekly[todayName] || [],
    local,
  };
}

export function getNextOpeningTime(restaurant = {}, now = new Date()) {
  const timezone = restaurant.timezone || DEFAULT_TIMEZONE;
  const weekly = normalizeWeeklyOpeningHours(restaurant);
  const localNowParts = getZonedParts(now, timezone);
  const nowMin = localNowParts.hour * 60 + localNowParts.minute;
  const specials = Array.isArray(restaurant.specialHours) ? restaurant.specialHours : [];

  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const candidateBase = new Date(Date.UTC(
      localNowParts.year,
      localNowParts.month - 1,
      localNowParts.day + dayOffset,
    ));
    const candidateParts = {
      year: candidateBase.getUTCFullYear(),
      month: candidateBase.getUTCMonth() + 1,
      day: candidateBase.getUTCDate(),
    };

    const dateKey = [
      String(candidateParts.year).padStart(4, "0"),
      String(candidateParts.month).padStart(2, "0"),
      String(candidateParts.day).padStart(2, "0"),
    ].join("-");
    const special = specials.find((entry) => entry?.date === dateKey);
    const candidateDayOfWeek = zonedLocalToUtcDate({
      ...candidateParts,
      hour: 12,
      minute: 0,
    }, timezone).getUTCDay();
    const dayName = DAY_KEYS[candidateDayOfWeek];

    if (special?.isClosed) continue;

    const slots = special
      ? (Array.isArray(special.slots) ? special.slots : []).map(normalizeSlot).filter(Boolean)
      : (weekly[dayName] || []);

    if (!slots.length) continue;

    const sortedSlots = [...slots].sort((a, b) => a.openMin - b.openMin);

    for (const slot of sortedSlots) {
      const { openMin, closeMin } = slot;
      const isTwentyFourHours = openMin === closeMin;
      const isSameDaySlot = openMin < closeMin;
      const isOvernightSlot = openMin > closeMin;

      if (dayOffset === 0) {
        if (isTwentyFourHours) {
          return zonedLocalToUtcDate({
            ...candidateParts,
            hour: Math.floor(openMin / 60),
            minute: openMin % 60,
          }, timezone).toISOString();
        }

        if (isSameDaySlot && openMin > nowMin) {
          return zonedLocalToUtcDate({
            ...candidateParts,
            hour: Math.floor(openMin / 60),
            minute: openMin % 60,
          }, timezone).toISOString();
        }

        if (isOvernightSlot && nowMin < openMin) {
          return zonedLocalToUtcDate({
            ...candidateParts,
            hour: Math.floor(openMin / 60),
            minute: openMin % 60,
          }, timezone).toISOString();
        }
      } else {
        return zonedLocalToUtcDate({
          ...candidateParts,
          hour: Math.floor(openMin / 60),
          minute: openMin % 60,
        }, timezone).toISOString();
      }
    }
  }

  return null;
}

export function computeRestaurantAvailability(restaurant = {}, options = {}) {
  const now = options.now || new Date();
  const timezone = restaurant.timezone || DEFAULT_TIMEZONE;
  const businessStatus = restaurant.businessStatus || (restaurant.status === "inactive" ? "inactive" : "active");
  const publicationStatus = restaurant.publicationStatus || (restaurant.status === "inactive" ? "hidden" : "published");
  const operationalStatus = restaurant.operationalStatus || "normal";

  const capabilities = {
    acceptsReservations: true,
    acceptsOrders: true,
    acceptsTableOrders: true,
    acceptsDelivery: false,
    acceptsPickup: false,
    ...(restaurant.capabilities || {}),
  };
  const reservationPolicy = { allowWhenClosed: true, ...(restaurant.reservationPolicy || {}) };
  const orderPolicy = { allowWhenClosed: false, ...(restaurant.orderPolicy || {}) };

  let openingStatus = "closed";
  let openingStatusReason = null;

  if (["archived", "inactive", "suspended"].includes(businessStatus)) {
    openingStatus = businessStatus;
  } else if (publicationStatus !== "published") {
    openingStatus = publicationStatus === "draft" ? "draft" : "hidden";
  } else if (["paused", "maintenance", "holiday"].includes(operationalStatus)) {
    openingStatus = operationalStatus;
  } else {
    const today = resolveTodaySlots(restaurant, now, timezone);
    if (today.isClosed) {
      openingStatus = "holiday";
      openingStatusReason = today.reason;
    } else if (isWithinOpeningSlots(today.slots, now, timezone)) {
      openingStatus = "open";
    } else {
      openingStatus = "closed";
      openingStatusReason = today.reason;
    }
  }

  const canView = businessStatus === "active" && publicationStatus === "published";
  const canReserve = canView
    && operationalStatus === "normal"
    && capabilities.acceptsReservations
    && (openingStatus === "open" || (openingStatus === "closed" && reservationPolicy.allowWhenClosed));

  const canOrder = canView
    && operationalStatus === "normal"
    && capabilities.acceptsOrders
    && (openingStatus === "open" || (openingStatus === "closed" && orderPolicy.allowWhenClosed));

  return {
    businessStatus,
    publicationStatus,
    operationalStatus,
    openingStatus,
    openingStatusReason,
    nextOpeningTime: openingStatus === "closed" ? getNextOpeningTime(restaurant, now) : null,
    canView,
    canReserve,
    canOrder,
    canTableOrder: canOrder && capabilities.acceptsTableOrders,
    canDelivery: canOrder && capabilities.acceptsDelivery,
    canPickup: canOrder && capabilities.acceptsPickup,
  };
}
