// src/utils/date.ts
export function combineLocalDateTimeISO(
  dateStr?: string,
  timeStr?: string
): string {
  if (!dateStr || !timeStr) throw new Error("Missing date/time");
  // Expect: dateStr "YYYY-MM-DD", timeStr "HH:mm"
  const [y, m, d] = dateStr.split("-").map((s) => parseInt(s, 10));
  const [hh, mm] = timeStr.split(":").map((s) => parseInt(s, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  if (isNaN(dt.getTime())) throw new Error("Invalid date/time");
  return dt.toISOString(); // lưu ISO chuẩn cho BE
}
