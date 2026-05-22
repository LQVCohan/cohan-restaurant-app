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
  "Trừ nghiệp vụ thu ngân",
  "Giao dịch thu ngân xử lý",
  "Sai bill",
  "Lỗi thanh toán",
  "Refund thu ngân",
  "Yêu cầu thanh toán chậm",
  "Giảm giá không hợp lệ",
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
    if (snapshot?.factors?.hasManagerReview === false && snapshot?.factors?.insufficientData !== true) {
      notes.push("Thiếu đánh giá quản lý");
    }
    if (Number(snapshot?.factors?.kitchenMetrics?.totalItems || 0) > 0) {
      const kitchenNote = "Có dữ liệu bếp/bar tham khảo";
      if (!notes.includes(kitchenNote)) notes.push(kitchenNote);
    }
    if (Number(snapshot?.factors?.qualityEvidence?.totalPenalty || 0) > 0) {
      const qualityNote = "Quality có điều chỉnh theo dữ liệu vai trò";
      if (!notes.includes(qualityNote)) notes.push(qualityNote);
    }
    if (Number(snapshot?.factors?.qualityEvidence?.cashierOperationalPenalty || 0) > 0) {
      const cashierQualityNote = "Quality có điều chỉnh nghiệp vụ thu ngân";
      if (!notes.includes(cashierQualityNote)) notes.push(cashierQualityNote);
    }
    const note = notes.join(" | ");
    const cashierMetrics = snapshot?.factors?.cashierMetrics || null;
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
      Number(snapshot?.factors?.qualityEvidence?.cashierOperationalPenalty || 0),
      cashierMetrics?.totalHandledPayments ?? CSV_EMPTY_VALUE,
      Number(cashierMetrics?.wrongBillIssues || 0),
      Number(cashierMetrics?.paymentErrors || 0),
      Number(cashierMetrics?.cashierRefunds || 0),
      Number(cashierMetrics?.latePaymentRequests || 0),
      Number(cashierMetrics?.unauthorizedDiscounts || 0),
      note,
    ];
  });

export const buildPerformanceOverviewCsvContent = (rows = []) => {
  const csvRows = buildPerformanceOverviewCsvRows(rows);
  return [CSV_HEADERS, ...csvRows].map((line) => line.map(escapeCsvValue).join(",")).join("\n");
};

export const buildPerformanceOverviewCsvBlobContent = (rows = []) =>
  `\uFEFF${buildPerformanceOverviewCsvContent(rows)}`;
