import { formatCustomerRating } from "./performanceCustomerRating";

export const CSV_EMPTY_VALUE = "--";

export const CSV_HEADERS = [
  "Mã nhân viên",
  "Tên nhân viên",
  "Vai trò",
  "Điểm kỳ này",
  "Mức kỳ này",
  "Điểm kỳ trước",
  "Chênh lệch",
  "Có dữ liệu kỳ trước",
  "Đánh giá khách hàng",
  "Số lượt đánh giá khách hàng",
  "Ghi chú",
];

export const escapeCsvValue = (value) => {
  const normalizedValue = value === null || value === undefined ? "" : String(value);
  const shouldPrefixFormulaGuard =
    typeof value === "string" && /^[=+\-@]/.test(normalizedValue.trimStart());
  const safeValue = shouldPrefixFormulaGuard ? `'${normalizedValue}` : normalizedValue;
  if (!/[",\n\r]/.test(safeValue)) return safeValue;
  return `"${safeValue.replaceAll('"', '""')}"`;
};

export const buildPerformanceOverviewCsvRows = (rows = []) =>
  rows.map((row) => {
    const employee = row?.employee || {};
    const snapshot = row?.snapshot || {};
    const previousSnapshot = row?.previousSnapshot || null;
    const customerRating = formatCustomerRating(snapshot?.factors);
    const customerRatingCount = Number(snapshot?.factors?.staffRateCount);
    const notes = [];
    if (customerRating?.hasRating) notes.push("Rating khách hàng chỉ tham khảo");
    if (snapshot?.factors?.insufficientData === true) {
      notes.push("Không đủ dữ liệu hiệu suất");
    }
    const note = notes.join(" | ");
    return [
      employee.code || snapshot.employeeCode || CSV_EMPTY_VALUE,
      employee.name || snapshot.employeeName || CSV_EMPTY_VALUE,
      employee.role || snapshot.employeeRole || CSV_EMPTY_VALUE,
      row?.score ?? snapshot.finalPerformanceScore ?? CSV_EMPTY_VALUE,
      row?.level?.label || snapshot.performanceLevel || CSV_EMPTY_VALUE,
      previousSnapshot?.finalPerformanceScore ?? CSV_EMPTY_VALUE,
      row?.trendDelta ?? CSV_EMPTY_VALUE,
      previousSnapshot ? "Có" : "Không",
      customerRating?.hasRating ? customerRating.label : CSV_EMPTY_VALUE,
      Number.isFinite(customerRatingCount) ? customerRatingCount : CSV_EMPTY_VALUE,
      note,
    ];
  });

export const buildPerformanceOverviewCsvContent = (rows = []) => {
  const csvRows = buildPerformanceOverviewCsvRows(rows);
  return [CSV_HEADERS, ...csvRows].map((line) => line.map(escapeCsvValue).join(",")).join("\n");
};

export const buildPerformanceOverviewCsvBlobContent = (rows = []) =>
  `\uFEFF${buildPerformanceOverviewCsvContent(rows)}`;
