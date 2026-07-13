const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";
const VIETNAM_UTC_OFFSET_HOURS = 7;
const PART_TIME_TYPES = new Set(["part_time", "seasonal"]);

export function normalizeEmploymentType(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function isPartTimeEmployment(staff) {
  return PART_TIME_TYPES.has(normalizeEmploymentType(staff?.employmentType));
}

export function toVietnamDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function toVietnamTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DEFAULT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function buildLocalShiftRange({ date, startTime, durationHours = 4 }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
    throw new Error("Ngày tạo ca không hợp lệ.");
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(startTime || ""))) {
    throw new Error("Giờ bắt đầu không hợp lệ.");
  }
  const duration = Number(durationHours);
  if (!Number.isFinite(duration) || duration < 1 || duration > 12) {
    throw new Error("Thời lượng ca phải từ 1 đến 12 giờ.");
  }
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = startTime.split(":").map(Number);
  const start = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour - VIETNAM_UTC_OFFSET_HOURS,
      minute,
      0,
      0,
    ),
  );
  const end = new Date(start.getTime() + duration * 60 * 60 * 1000);
  return { startTime: start, endTime: end };
}

export function groupPartTimeShiftRows(rows = [], staffById = new Map()) {
  const groups = new Map();
  for (const row of rows || []) {
    const employeeId = String(row?.employeeId || "");
    const person = staffById.get(employeeId);
    if (!person || !isPartTimeEmployment(person)) continue;
    const start = new Date(row.startTime);
    const end = new Date(row.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    const date = toVietnamDateKey(start);
    const key = `${date}|${start.toISOString()}|${end.toISOString()}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        date,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        startLabel: toVietnamTime(start),
        endLabel: toVietnamTime(end),
        durationHours: (end.getTime() - start.getTime()) / 3_600_000,
        shiftType: String(row.shiftType || "rotating").toLowerCase(),
        staffIds: [],
        records: [],
      });
    }
    const group = groups.get(key);
    group.staffIds.push(employeeId);
    group.records.push(row);
  }
  return Array.from(groups.values()).sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      new Date(left.startTime).getTime() - new Date(right.startTime).getTime(),
  );
}

export function getNextPartTimeStart(blocks = [], date, fallback = "08:00") {
  const dayBlocks = (blocks || []).filter((block) => block.date === date);
  if (!dayBlocks.length) return fallback;
  const latest = dayBlocks.reduce((current, block) => {
    const end = new Date(block.endTime);
    if (Number.isNaN(end.getTime())) return current;
    return !current || end > current ? end : current;
  }, null);
  if (!latest || toVietnamDateKey(latest) !== date) return null;
  return toVietnamTime(latest);
}

export function formatDurationHours(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return Number.isInteger(number)
    ? String(number)
    : String(number.toFixed(1)).replace(".", ",");
}

export function durationLabel(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  return `${formatDurationHours((end - start) / 3_600_000)} giờ`;
}
