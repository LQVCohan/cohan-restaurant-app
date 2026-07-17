const VIETNAM_UTC_OFFSET_HOURS = 7;

export function normalizeRotatingShiftType(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function isRotatingStaff(staff) {
  return normalizeRotatingShiftType(staff?.shiftType) === "rotating";
}

export function buildVietnamShiftRange({ date, startTime, endTime }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
    throw new Error("Ngày tạo ca không hợp lệ.");
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(startTime || ""))) {
    throw new Error("Giờ bắt đầu không hợp lệ.");
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(endTime || ""))) {
    throw new Error("Giờ kết thúc không hợp lệ.");
  }
  if (startTime === endTime) {
    throw new Error("Giờ kết thúc phải khác giờ bắt đầu.");
  }

  const [year, month, day] = date.split("-").map(Number);
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  const start = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      startHour - VIETNAM_UTC_OFFSET_HOURS,
      startMinute,
      0,
      0,
    ),
  );
  const end = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      endHour - VIETNAM_UTC_OFFSET_HOURS,
      endMinute,
      0,
      0,
    ),
  );

  if (end <= start) end.setUTCDate(end.getUTCDate() + 1);
  return { startTime: start, endTime: end };
}

export function hasRotatingShiftOverlap(
  rows = [],
  employeeId,
  startTime,
  endTime,
) {
  const targetEmployeeId = String(employeeId || "");
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (!targetEmployeeId || !Number.isFinite(start) || !Number.isFinite(end)) {
    return false;
  }

  return (rows || []).some((row) => {
    if (String(row?.employeeId || "") !== targetEmployeeId) return false;
    const rowStart = new Date(row?.startTime).getTime();
    const rowEnd = new Date(row?.endTime).getTime();
    if (!Number.isFinite(rowStart) || !Number.isFinite(rowEnd)) return false;
    return start < rowEnd && rowStart < end;
  });
}

export function groupRotatingShiftRows(rows = [], staffById = new Map()) {
  const groups = new Map();

  (rows || []).forEach((row) => {
    const employeeId = String(row?.employeeId || "");
    const staff = staffById.get(employeeId);
    if (!staff || !isRotatingStaff(staff)) return;

    const start = new Date(row?.startTime);
    const end = new Date(row?.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(start);
    const key = `${date}|${start.toISOString()}|${end.toISOString()}`;

    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        date,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        staffIds: [],
        records: [],
      });
    }

    const group = groups.get(key);
    group.staffIds.push(employeeId);
    group.records.push(row);
  });

  return Array.from(groups.values()).sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      new Date(left.startTime).getTime() - new Date(right.startTime).getTime(),
  );
}
