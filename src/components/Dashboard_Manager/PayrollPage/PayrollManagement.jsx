import React, { useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { AlertTriangle, CheckCircle2, ChevronDown, Info } from "lucide-react";
import usePayroll from "@/hooks/usePayroll";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import PayrollReadinessPanel from "./components/PayrollReadinessPanel";
import "./PayrollManagement.scss";
import "../../../styles/PayrollPagination.css";

const PAYROLL_PAGE_SIZE = 8;
const RANGE_PREVIEW_ID = "__range_preview__";

const PAYROLL_OVERVIEW_PAGE_QUERY = gql`
  query PayrollOverviewPage(
    $startDate: DateTime!
    $endDate: DateTime!
    $restaurantId: ID
    $periodId: ID
    $search: String
    $status: String
    $limit: Int
    $offset: Int
  ) {
    staffPayrollOverview: staffPayrollOverviewPage(
      startDate: $startDate
      endDate: $endDate
      restaurantId: $restaurantId
      periodId: $periodId
      search: $search
      status: $status
      limit: $limit
      offset: $offset
    ) {
      stats { totalPayroll paidAmount remaining progress }
      pageInfo { totalCount limit offset page pageSize totalPages hasMore }
      items {
        id payrollItemId name code role department avatar baseSalary workDays actualWorkDays totalHours hourlyRate allowance bonus otherAddition overtime overtimeNormal overtimeWeekend overtimeHoliday nightShiftExtra overtimeHours overtimeNormalHours overtimeWeekendHours overtimeHolidayHours nightHours overtimeNightHours deduction otherDeduction advance insuranceSocial insuranceHealth insuranceUnemployment insuranceTotal personalIncomeTax grossIncome coefficient totalIncome totalDeduction netSalary policyCode policyEffectiveFrom regionCode minimumWageMonthly minimumWageHourly minimumWageViolation insuranceEligible warningMessages status paidAmount remainingAmount paidAt lateMinutes earlyLeaveMinutes unpaidLeaveDays paidLeaveDays scheduleShiftCount manualAdjustmentTotal periodId
      }
    }
  }
`;

const toDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toStoredDateInput = (value) => {
  const datePart = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : "";
};

const getDefaultRange = () => {
  const today = new Date();
  return {
    start: toDateInput(
      new Date(today.getFullYear(), today.getMonth() - 1, 25),
    ),
    end: toDateInput(new Date(today.getFullYear(), today.getMonth(), 24)),
  };
};

const toPayrollDateTime = (dateValue, boundary = "start") => {
  if (!dateValue) return null;
  if (String(dateValue).includes("T")) return dateValue;
  const time = boundary === "end" ? "23:59:59.999" : "00:00:00.000";
  return `${dateValue}T${time}Z`;
};

export function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function downloadCsv(filename, rows, columns) {
  const header = columns.map((column) => escapeCsvValue(column.label)).join(",");
  const body = rows
    .map((row) =>
      columns.map((column) => escapeCsvValue(row[column.key])).join(","),
    )
    .join("\n");
  const blob = new Blob([`\uFEFF${header}\n${body}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const STATUS_LABELS = {
  draft: "Nháp",
  finalized: "Đã chốt",
  paying: "Đang chi",
  pending_payment: "Chờ chi",
  processing_payment: "Đang xử lý",
  payment_failed: "Lỗi chi",
  paid: "Đã trả",
  locked: "Đã khóa",
};
const STATUS_TABS = ["all", ...Object.keys(STATUS_LABELS)];
const EXPORT_COLUMNS = [
  { key: "code", label: "Mã NV" },
  { key: "name", label: "Nhân viên" },
  { key: "department", label: "Bộ phận" },
  { key: "role", label: "Vai trò" },
  { key: "actualWorkDays", label: "Ngày công" },
  { key: "totalHours", label: "Giờ công" },
  { key: "grossIncome", label: "Thu nhập gộp" },
  { key: "totalDeduction", label: "Khấu trừ" },
  { key: "netSalary", label: "Thực nhận" },
  { key: "paidAmount", label: "Đã chi" },
  { key: "remainingAmount", label: "Còn lại" },
  { key: "status", label: "Trạng thái" },
];

const formatMoney = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
const formatNumber = (value) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(
    Number(value || 0),
  );
const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};
const statusLabel = (status) => STATUS_LABELS[status] || status || "Nháp";
const statusClass = (status) => {
  if (status === "paid") return "success";
  if (status === "payment_failed") return "danger";
  if (status === "locked") return "locked";
  if (
    ["finalized", "paying", "pending_payment", "processing_payment"].includes(
      status,
    )
  ) return "info";
  return "warning";
};
const getEmployeeInitials = (name = "") => {
  const parts = String(name || "NV").trim().split(/\s+/).filter(Boolean);
  return (parts.length ? parts.slice(-2) : ["N", "V"])
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};
const getPayrollErrorMessage = (
  error,
  fallback = "Thao tác bảng lương không thành công.",
) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.networkError?.message ||
  error?.message ||
  fallback;
const getMutationResultError = (result) =>
  result?.errors?.[0]?.message ||
  result?.error?.message ||
  result?.data?.errors?.[0]?.message ||
  null;
const hasMutationPayload = (result) =>
  Boolean(
    result?.data &&
      Object.values(result.data).some((value) => value !== null && value !== false),
  );

const mapOfficialExportRow = (row) => ({
  code: row.employeeCode || "",
  name: row.employeeName || "Nhân viên",
  department: row.department || "",
  role: row.role || "",
  actualWorkDays: row.actualWorkDays || 0,
  totalHours: row.totalHours || 0,
  grossIncome: row.totalIncome ?? row.grossIncome ?? 0,
  totalDeduction:
    row.totalDeduction ??
    Number(row.deduction || 0) +
      Number(row.otherDeduction || 0) +
      Number(row.advance || 0) +
      Number(row.insuranceTotal || 0) +
      Number(row.personalIncomeTax || 0),
  netSalary: row.netSalary || 0,
  paidAmount: row.paidAmount || 0,
  remainingAmount: row.remainingAmount || 0,
  status: statusLabel(row.status),
});

const getRowKey = (item) =>
  String(item.payrollItemId || item.id || item.code || item.name || "payroll-row");

const getRowWarnings = (item) => {
  const warnings = [...(item.warningMessages || [])];
  const totalIncome = Number(item.totalIncome ?? item.grossIncome ?? 0);
  const insuranceTotal = Number(item.insuranceTotal || 0);
  const totalDeduction = Number(item.totalDeduction ?? item.deduction ?? 0);
  const netSalary = Number(item.netSalary || 0);

  if (item.insuranceEligible && totalIncome <= 0 && insuranceTotal <= 0) {
    warnings.unshift(
      "Chưa phát sinh thu nhập; khoản BH chưa được khấu trừ trong bản tính này.",
    );
  }
  if (totalDeduction > totalIncome && totalDeduction > 0) {
    warnings.unshift("Tổng khấu trừ đang lớn hơn tổng thu nhập.");
  }
  if (netSalary < 0) {
    warnings.unshift("Thực nhận âm; cần rà soát trước khi chốt kỳ.");
  }
  return [...new Set(warnings.filter(Boolean))];
};

function PayrollWorkspace({
  restaurantOptions,
  selectedRestaurantId,
  setSelectedRestaurantId,
}) {
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [range, setRange] = useState(defaultRange);
  const [activeStatus, setActiveStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [page, setPage] = useState(1);
  const [expandedRowId, setExpandedRowId] = useState("");
  const isRangePreview = selectedPeriodId === RANGE_PREVIEW_ID;

  const apiRange = useMemo(
    () => ({
      startDate: toPayrollDateTime(range.start, "start"),
      endDate: toPayrollDateTime(range.end, "end"),
    }),
    [range.end, range.start],
  );

  const payroll = usePayroll({
    periodId: isRangePreview ? undefined : selectedPeriodId || undefined,
    restaurantId: selectedRestaurantId,
    startDate: apiRange.startDate,
    endDate: apiRange.endDate,
  });
  const periods = payroll.periods || [];
  const requestedPeriodId = isRangePreview
    ? ""
    : selectedPeriodId || payroll.currentPeriodId || periods[0]?.id || "";
  const detailPeriod = payroll.periodDetail?.period || null;
  const detailMatches = Boolean(
    !isRangePreview &&
      detailPeriod?.id &&
      String(detailPeriod.restaurantId || "") ===
        String(selectedRestaurantId || "") &&
      (!requestedPeriodId || String(detailPeriod.id) === String(requestedPeriodId)),
  );
  const currentPeriod = isRangePreview
    ? null
    : (detailMatches ? detailPeriod : null) ||
      periods.find(
        (period) =>
          String(period.id) === String(requestedPeriodId) &&
          String(period.restaurantId || "") === String(selectedRestaurantId || ""),
      ) ||
      null;
  const effectivePeriodId = currentPeriod?.id || requestedPeriodId;
  const hasOfficialPeriod = Boolean(currentPeriod?.id);
  const periodStatus = hasOfficialPeriod ? currentPeriod.status || "draft" : "draft";
  const overviewStatus = activeStatus === "all" ? undefined : activeStatus;
  const overviewSearch = search.trim() || undefined;
  const overviewOffset = Math.max(0, (page - 1) * PAYROLL_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
    setExpandedRowId("");
  }, [activeStatus, range.end, range.start, search, selectedPeriodId]);

  const overviewQuery = useQuery(PAYROLL_OVERVIEW_PAGE_QUERY, {
    variables: {
      startDate: apiRange.startDate,
      endDate: apiRange.endDate,
      restaurantId: selectedRestaurantId,
      periodId: hasOfficialPeriod ? effectivePeriodId : undefined,
      search: overviewSearch,
      status: overviewStatus,
      limit: PAYROLL_PAGE_SIZE,
      offset: overviewOffset,
    },
    skip: !selectedRestaurantId || !apiRange.startDate || !apiRange.endDate,
    fetchPolicy: "cache-and-network",
  }) || {};

  const overview = overviewQuery.data?.staffPayrollOverview || null;
  const items = overview?.items || [];
  const pageInfo = overview?.pageInfo || {
    totalCount: items.length,
    limit: PAYROLL_PAGE_SIZE,
    offset: overviewOffset,
    page,
    pageSize: items.length,
    totalPages: Math.max(1, page),
    hasMore: false,
  };
  const stats =
    overview?.stats ||
    (hasOfficialPeriod ? payroll.payrollStats || currentPeriod?.stats : null) ||
    {};
  const tableLoading = Boolean(payroll.loading || overviewQuery.loading);
  const totalPages = Math.max(1, Number(pageInfo.totalPages || 1));
  const totalCount = Number(pageInfo.totalCount || 0);
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const firstRow = totalCount > 0 ? Number(pageInfo.offset || 0) + 1 : 0;
  const lastRow =
    totalCount > 0
      ? Math.min(Number(pageInfo.offset || 0) + items.length, totalCount)
      : 0;
  const canCreatePeriod = Boolean(
    selectedRestaurantId && apiRange.startDate && apiRange.endDate && !tableLoading,
  );
  const canEditDraft = hasOfficialPeriod && periodStatus === "draft";
  const canLockPeriod = hasOfficialPeriod && periodStatus === "paid";

  const totals = useMemo(() => {
    const totalPayroll = Math.max(
      Number(
        stats.totalPayroll ??
          items.reduce(
            (sum, item) => sum + Math.max(Number(item.netSalary || 0), 0),
            0,
          ),
      ),
      0,
    );
    const paidAmount = Number(
      stats.paidAmount ??
        items.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0),
    );
    const remaining = Number(
      stats.remaining ?? Math.max(totalPayroll - paidAmount, 0),
    );
    const progress = Number(
      stats.progress ??
        (totalPayroll > 0 ? Math.round((paidAmount / totalPayroll) * 100) : 0),
    );
    return { totalPayroll, paidAmount, remaining, progress };
  }, [items, stats]);

  const pageHealth = useMemo(() => {
    let zeroActivityCount = 0;
    let negativeNetCount = 0;
    let deductionOverIncomeCount = 0;
    let warningCount = 0;
    items.forEach((item) => {
      const workDays = Number(item.actualWorkDays ?? item.workDays ?? 0);
      const hours = Number(item.totalHours || 0);
      const income = Number(item.totalIncome ?? item.grossIncome ?? 0);
      const deduction = Number(item.totalDeduction ?? item.deduction ?? 0);
      const net = Number(item.netSalary || 0);
      if (workDays <= 0 && hours <= 0 && income <= 0) zeroActivityCount += 1;
      if (net < 0) negativeNetCount += 1;
      if (deduction > income && deduction > 0) deductionOverIncomeCount += 1;
      warningCount += getRowWarnings(item).length;
    });
    return {
      zeroActivityCount,
      negativeNetCount,
      deductionOverIncomeCount,
      warningCount,
      hasBlockingAnomaly: negativeNetCount > 0 || deductionOverIncomeCount > 0,
    };
  }, [items]);

  const refreshPayrollData = async (periodIdOverride) => {
    const targetPeriodId =
      typeof periodIdOverride === "string" && periodIdOverride
        ? periodIdOverride
        : effectivePeriodId;
    const shouldRefreshPeriod = Boolean(
      targetPeriodId && (hasOfficialPeriod || periodIdOverride),
    );
    await Promise.allSettled([
      payroll.refetchPeriods?.(),
      shouldRefreshPeriod
        ? payroll.refetchDetail?.({ periodId: targetPeriodId })
        : null,
      shouldRefreshPeriod
        ? payroll.refetchPayrollReadiness?.({ periodId: targetPeriodId })
        : null,
      overviewQuery.refetch?.({
        startDate: apiRange.startDate,
        endDate: apiRange.endDate,
        restaurantId: selectedRestaurantId,
        periodId: hasOfficialPeriod ? targetPeriodId : undefined,
        search: overviewSearch,
        status: overviewStatus,
        limit: PAYROLL_PAGE_SIZE,
        offset: overviewOffset,
      }),
    ]);
  };

  const handlePeriodChange = (event) => {
    const nextPeriodId = event.target.value;
    setSelectedPeriodId(nextPeriodId);
    setActionMessage("");
    if (!nextPeriodId || nextPeriodId === RANGE_PREVIEW_ID) return;
    const selectedPeriod = periods.find(
      (period) => String(period.id) === String(nextPeriodId),
    );
    const start = toStoredDateInput(selectedPeriod?.startDate);
    const end = toStoredDateInput(selectedPeriod?.endDate);
    if (start && end) setRange({ start, end });
  };

  const handleRangeChange = (field, value) => {
    setSelectedPeriodId(RANGE_PREVIEW_ID);
    setRange((current) => ({ ...current, [field]: value }));
    setActionMessage("Đã chuyển sang tạm tính theo khoảng ngày.");
  };

  const handleCreatePeriod = async () => {
    if (!selectedRestaurantId || !apiRange.startDate || !apiRange.endDate) {
      setActionMessage("Chọn nhà hàng và khoảng ngày trước khi tạo kỳ lương.");
      return;
    }
    try {
      setActionMessage("Đang tạo kỳ lương chính thức...");
      const result = await payroll.createPeriod?.({
        variables: {
          input: {
            restaurantId: selectedRestaurantId,
            name: `Kỳ lương ${formatDate(range.start)} - ${formatDate(range.end)}`,
            startDate: apiRange.startDate,
            endDate: apiRange.endDate,
          },
        },
      });
      const resultError = getMutationResultError(result);
      if (resultError) throw new Error(resultError);
      const newPeriodId = result?.data?.createPayrollPeriod?.id;
      if (!newPeriodId) {
        throw new Error(
          "Tạo kỳ lương không thành công. Vui lòng kiểm tra quyền quản lý bảng lương.",
        );
      }
      setSelectedPeriodId(newPeriodId);
      await refreshPayrollData(newPeriodId);
      setActionMessage("Đã tạo kỳ lương chính thức.");
    } catch (error) {
      setActionMessage(
        getPayrollErrorMessage(error, "Tạo kỳ lương không thành công."),
      );
    }
  };

  const runAction = async (label, action) => {
    if (!effectivePeriodId || typeof action !== "function") {
      setActionMessage("Chưa có kỳ lương để thao tác.");
      return;
    }
    try {
      setActionMessage(`Đang ${label.toLowerCase()}...`);
      const result = await action({ variables: { periodId: effectivePeriodId } });
      const resultError = getMutationResultError(result);
      if (resultError) throw new Error(resultError);
      if (!hasMutationPayload(result)) {
        throw new Error(`${label} không trả về kết quả hợp lệ.`);
      }
      await refreshPayrollData(effectivePeriodId);
      setActionMessage(`${label} thành công.`);
    } catch (error) {
      setActionMessage(
        getPayrollErrorMessage(error, `${label} không thành công.`),
      );
    }
  };

  const handleExportCsv = async () => {
    try {
      setActionMessage("Đang chuẩn bị dữ liệu xuất...");
      let rows;
      if (hasOfficialPeriod && effectivePeriodId) {
        const result = await payroll.refetchPayrollExportRows?.({
          periodId: effectivePeriodId,
        });
        const officialRows =
          result?.data?.payrollExportRows || payroll.payrollExportRows || [];
        rows = officialRows.map(mapOfficialExportRow);
      } else {
        rows = items.map((item) => ({
          ...item,
          grossIncome: item.totalIncome ?? item.grossIncome ?? 0,
          status: statusLabel(item.status),
        }));
      }
      if (!rows.length) {
        setActionMessage("Không có dữ liệu phù hợp để xuất CSV.");
        return;
      }
      const prefix = hasOfficialPeriod ? "payroll-period" : "payroll-preview";
      downloadCsv(
        `${prefix}-${effectivePeriodId || currentPage}-${range.start}-${range.end}.csv`,
        rows,
        EXPORT_COLUMNS,
      );
      setActionMessage(`Đã xuất ${rows.length} dòng dữ liệu lương.`);
    } catch (error) {
      setActionMessage(
        getPayrollErrorMessage(error, "Không thể xuất dữ liệu bảng lương."),
      );
    }
  };

  const resetFilters = () => {
    setSearch("");
    setActiveStatus("all");
    setSelectedPeriodId(RANGE_PREVIEW_ID);
    setRange(defaultRange);
    setPage(1);
  };
  const goToPage = (nextPage) =>
    setPage(Math.min(Math.max(1, nextPage), totalPages));

  return (
    <div className="payroll-page-compact">
      <section className="header-toolbar">
        <div className="title-zone">
          <span className="eyebrow">Trung tâm lương thưởng</span>
          <h1 className="page-title">Quản lý lương</h1>
          <p className="page-subtitle">
            Kiểm tra nguồn dữ liệu, thu nhập, khấu trừ và tiến độ chi trả theo từng nhà hàng.
          </p>
          <div className="quick-stats payroll-summary-line">
            <span className="status-dot info">{statusLabel(periodStatus)}</span>
            <span
              className={`payroll-data-mode ${hasOfficialPeriod ? "is-official" : "is-runtime"}`}
            >
              {hasOfficialPeriod ? "Kỳ lương chính thức" : "Tạm tính theo khoảng ngày"}
            </span>
            <span className="payroll-date-range">
              {formatDate(currentPeriod?.startDate || range.start)} - {formatDate(currentPeriod?.endDate || range.end)}
            </span>
            <span className="payroll-employee-count">
              {totalCount} nhân viên phù hợp
            </span>
          </div>
        </div>

        <div className="right-actions payroll-control-card">
          <label className="cycle-picker-compact">
            <span className="label">Nhà hàng</span>
            <select
              className="filter-select"
              value={selectedRestaurantId}
              onChange={(event) => setSelectedRestaurantId(event.target.value)}
            >
              {restaurantOptions.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </label>
          <label className="cycle-picker-compact">
            <span className="label">Nguồn dữ liệu</span>
            <select
              className="filter-select"
              value={isRangePreview ? RANGE_PREVIEW_ID : selectedPeriodId}
              onChange={handlePeriodChange}
            >
              <option value="">Kỳ hiện tại / gần nhất</option>
              <option value={RANGE_PREVIEW_ID}>Tạm tính theo khoảng ngày</option>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name || `${formatDate(period.startDate)} - ${formatDate(period.endDate)}`}
                </option>
              ))}
            </select>
          </label>
          <div className="actions-row">
            <button className="btn btn-white" type="button" onClick={() => refreshPayrollData()}>
              Làm mới
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleExportCsv}
              disabled={!hasOfficialPeriod && !items.length}
            >
              Xuất CSV
            </button>
          </div>
        </div>
      </section>

      <section className="metrics-strip metrics-strip--period">
        <div className="metric-group">
          <article className="metric-item">
            <span className="label">Tổng bảng lương</span>
            <strong className="value highlight">{formatMoney(totals.totalPayroll)}</strong>
            <small>Toàn bộ nguồn dữ liệu đang chọn</small>
          </article>
          <article className="metric-item">
            <span className="label">Đã chi</span>
            <strong className="value success">{formatMoney(totals.paidAmount)}</strong>
            <small>Khoản đã thanh toán</small>
          </article>
          <article className="metric-item">
            <span className="label">Còn lại</span>
            <strong className="value danger">{formatMoney(totals.remaining)}</strong>
            <small>Cần tiếp tục xử lý</small>
          </article>
        </div>
        <aside className="progress-section">
          <div className="progress-info">
            <span>Tiến độ chi trả</span>
            <strong>{formatNumber(totals.progress)}%</strong>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Tiến độ chi trả"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={Math.max(0, Math.min(100, totals.progress))}
          >
            <div
              className="progress-fill"
              style={{ width: `${Math.max(0, Math.min(100, totals.progress))}%` }}
            />
          </div>
          <small>
            {hasOfficialPeriod
              ? payroll.payrollReadiness?.readyToFinalize
                ? "Kỳ lương sẵn sàng chốt"
                : "Kiểm tra dữ liệu trước khi chốt"
              : "Bản tạm tính chưa thể chốt hoặc thanh toán"}
          </small>
        </aside>
      </section>

      {hasOfficialPeriod ? (
        <PayrollReadinessPanel
          readiness={payroll.payrollReadiness}
          loading={payroll.readinessLoading}
          error={payroll.readinessError}
          onRefresh={() =>
            effectivePeriodId
              ? payroll.refetchPayrollReadiness?.({ periodId: effectivePeriodId })
              : undefined
          }
        />
      ) : (
        <section className="payroll-preview-note" aria-label="Nguồn dữ liệu tạm tính">
          <Info size={18} aria-hidden="true" />
          <div>
            <strong>Đang xem dữ liệu tạm tính</strong>
            <span>
              Bảng được tính trực tiếp từ lịch, chấm công, nghỉ phép và điều chỉnh trong khoảng ngày; chưa phải snapshot để chốt lương.
            </span>
          </div>
        </section>
      )}

      <section className="table-card payroll-table-card">
        <div className="table-controls payroll-filter-row">
          <div className="workflow-tabs" role="group" aria-label="Lọc trạng thái bảng lương">
            {STATUS_TABS.map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={activeStatus === status}
                className={`tab-btn ${activeStatus === status ? "active" : ""}`}
                onClick={() => setActiveStatus(status)}
              >
                {status === "all" ? "Tất cả" : statusLabel(status)}
              </button>
            ))}
          </div>
          <div className="right-controls payroll-search-controls">
            <label className="payroll-control-field payroll-control-field--search">
              <span>Tìm nhân viên</span>
              <input
                className="filter-select payroll-search-input"
                name="payroll-search"
                autoComplete="off"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm nhân viên, mã, bộ phận..."
              />
            </label>
            <label className="payroll-control-field">
              <span>Từ ngày</span>
              <input
                className="filter-select payroll-date-input"
                name="payroll-start-date"
                type="date"
                value={range.start}
                onChange={(event) => handleRangeChange("start", event.target.value)}
              />
            </label>
            <label className="payroll-control-field">
              <span>Đến ngày</span>
              <input
                className="filter-select payroll-date-input"
                name="payroll-end-date"
                type="date"
                value={range.end}
                onChange={(event) => handleRangeChange("end", event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="table-controls table-controls--secondary payroll-action-row">
          <div className="right-controls payroll-action-buttons">
            <button
              className="btn btn-create-period"
              type="button"
              onClick={handleCreatePeriod}
              disabled={!canCreatePeriod}
            >
              + Tạo kỳ lương
            </button>
            <button
              className="btn btn-white"
              type="button"
              onClick={() => runAction("Tính lại lương", payroll.recalculatePeriod)}
              disabled={!canEditDraft}
              title={!canEditDraft ? "Chỉ kỳ lương nháp mới được tính lại." : ""}
            >
              Tính lại
            </button>
            <button
              className="btn btn-success"
              type="button"
              onClick={() => runAction("Chốt kỳ lương", payroll.finalizePeriod)}
              disabled={!canEditDraft}
              title={!canEditDraft ? "Chỉ kỳ lương nháp mới được chốt." : ""}
            >
              Chốt kỳ
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => runAction("Khóa kỳ lương", payroll.lockPeriod)}
              disabled={!canLockPeriod}
              title={!canLockPeriod ? "Chỉ khóa sau khi kỳ lương đã chi trả đầy đủ." : ""}
            >
              Khóa kỳ
            </button>
          </div>
          <span
            className={`payroll-inline-message ${!hasOfficialPeriod ? "is-muted" : ""}`}
            role="status"
            aria-live="polite"
          >
            {actionMessage ||
              (!hasOfficialPeriod
                ? "Tạo kỳ lương để tính lại, chốt hoặc khóa kỳ."
                : periodStatus === "draft"
                  ? "Kỳ lương nháp đang sẵn sàng kiểm tra và chốt."
                  : `Kỳ lương hiện ở trạng thái ${statusLabel(periodStatus)}.`)}
          </span>
        </div>

        {items.length ? (
          <div
            className={`payroll-data-health ${pageHealth.hasBlockingAnomaly ? "is-warning" : pageHealth.zeroActivityCount ? "is-info" : "is-good"}`}
            role={pageHealth.hasBlockingAnomaly ? "alert" : "status"}
          >
            <span className="payroll-data-health__icon" aria-hidden="true">
              {pageHealth.hasBlockingAnomaly ? (
                <AlertTriangle size={19} />
              ) : pageHealth.zeroActivityCount ? (
                <Info size={19} />
              ) : (
                <CheckCircle2 size={19} />
              )}
            </span>
            <div>
              <strong>
                {pageHealth.hasBlockingAnomaly
                  ? "Có phiếu lương cần rà soát"
                  : pageHealth.zeroActivityCount
                    ? `${pageHealth.zeroActivityCount} nhân viên chưa phát sinh công hoặc thu nhập trên trang này`
                    : "Các số liệu trên trang đang cân đối"}
              </strong>
              <span>
                {pageHealth.hasBlockingAnomaly
                  ? `${pageHealth.negativeNetCount} phiếu thực nhận âm, ${pageHealth.deductionOverIncomeCount} phiếu có khấu trừ lớn hơn thu nhập. Mở chi tiết từng dòng trước khi chốt.`
                  : pageHealth.zeroActivityCount
                    ? "Phiếu chưa có thu nhập được giữ ở mức 0; mở chi tiết để xem cảnh báo và trạng thái BH."
                    : pageHealth.warningCount
                      ? `${pageHealth.warningCount} cảnh báo nghiệp vụ vẫn cần kiểm tra trong chi tiết dòng.`
                      : "Không phát hiện thực nhận âm hoặc khấu trừ vượt thu nhập trong trang hiện tại."}
              </span>
            </div>
          </div>
        ) : null}

        <div className="table-responsive">
          <table className="payroll-table">
            <caption className="payroll-sr-only">
              Bảng thu nhập, khấu trừ và trạng thái chi trả của nhân viên
            </caption>
            <thead>
              <tr>
                <th className="sticky-left" scope="col">Nhân viên</th>
                <th scope="col">Bộ phận</th>
                <th className="numeric-col" scope="col">Ngày công</th>
                <th className="numeric-col" scope="col">Giờ công</th>
                <th className="money-col" scope="col">Thu nhập</th>
                <th className="money-col" scope="col">Khấu trừ</th>
                <th className="money-col is-strong" scope="col">Thực nhận</th>
                <th className="money-col" scope="col">Đã chi</th>
                <th className="money-col" scope="col">Còn lại</th>
                <th scope="col">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {tableLoading && !items.length ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`loading-${index}`}>
                    <td className="sticky-left" colSpan={10}>Đang tải dữ liệu lương...</td>
                  </tr>
                ))
              ) : items.length ? (
                items.map((item) => {
                  const rowKey = getRowKey(item);
                  const detailId = `payroll-detail-${rowKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                  const expanded = expandedRowId === rowKey;
                  const warnings = getRowWarnings(item);
                  const totalIncome = Number(item.totalIncome ?? item.grossIncome ?? 0);
                  const totalDeduction = Number(item.totalDeduction ?? item.deduction ?? 0);
                  const netSalary = Number(item.netSalary || 0);
                  const rowNeedsReview = netSalary < 0 || totalDeduction > totalIncome;

                  return (
                    <React.Fragment key={rowKey}>
                      <tr className={rowNeedsReview ? "payroll-row-needs-review" : ""}>
                        <td className="sticky-left">
                          <div className="emp-cell">
                            <span className="avatar">{getEmployeeInitials(item.name)}</span>
                            <span className="emp-cell__identity">
                              <strong className="name">{item.name || "Nhân viên"}</strong>
                              <small className="sub">{item.code || item.payrollItemId || "--"}</small>
                              <button
                                className="payroll-detail-toggle"
                                type="button"
                                aria-expanded={expanded}
                                aria-controls={detailId}
                                onClick={() =>
                                  setExpandedRowId((current) =>
                                    current === rowKey ? "" : rowKey,
                                  )
                                }
                              >
                                {expanded ? "Thu gọn" : "Xem chi tiết"}
                                <ChevronDown size={14} aria-hidden="true" />
                              </button>
                            </span>
                          </div>
                        </td>
                        <td>{item.department || item.role || "--"}</td>
                        <td className="numeric-cell">
                          <span className="work-tag">
                            {formatNumber(item.actualWorkDays ?? item.workDays)} ngày
                          </span>
                        </td>
                        <td className="numeric-cell">{formatNumber(item.totalHours)} giờ</td>
                        <td className="money-cell">{formatMoney(totalIncome)}</td>
                        <td className={`money-cell ${totalDeduction > 0 ? "text-danger" : ""}`}>
                          {formatMoney(totalDeduction)}
                        </td>
                        <td className={`money-cell net-cell ${netSalary < 0 ? "is-negative" : ""}`}>
                          {formatMoney(netSalary)}
                        </td>
                        <td className="money-cell text-success">{formatMoney(item.paidAmount)}</td>
                        <td className="money-cell">{formatMoney(item.remainingAmount)}</td>
                        <td>
                          <span className={`status-dot ${statusClass(item.status)}`}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="payroll-detail-row">
                          <td colSpan={10} id={detailId}>
                            <div className="payroll-row-detail">
                              <section className="payroll-detail-section">
                                <h3>Nguồn thu nhập</h3>
                                <dl>
                                  <div><dt>Lương/công</dt><dd>{formatMoney(item.grossIncome)}</dd></div>
                                  <div><dt>Phụ cấp</dt><dd>{formatMoney(item.allowance)}</dd></div>
                                  <div><dt>Thưởng</dt><dd>{formatMoney(item.bonus)}</dd></div>
                                  <div><dt>Tăng ca & ca đêm</dt><dd>{formatMoney(item.overtime)}</dd></div>
                                  <div className="is-total"><dt>Tổng thu nhập</dt><dd>{formatMoney(totalIncome)}</dd></div>
                                </dl>
                              </section>
                              <section className="payroll-detail-section payroll-detail-section--deduction">
                                <h3>Khấu trừ</h3>
                                <dl>
                                  <div><dt>BH bắt buộc</dt><dd>{formatMoney(item.insuranceTotal)}</dd></div>
                                  <div><dt>Thuế TNCN</dt><dd>{formatMoney(item.personalIncomeTax)}</dd></div>
                                  <div><dt>Tạm ứng</dt><dd>{formatMoney(item.advance)}</dd></div>
                                  <div><dt>Điều chỉnh khác</dt><dd>{formatMoney(Number(item.deduction || 0) + Number(item.otherDeduction || 0))}</dd></div>
                                  <div className="is-total"><dt>Tổng khấu trừ</dt><dd>{formatMoney(totalDeduction)}</dd></div>
                                </dl>
                              </section>
                              <section className="payroll-detail-section payroll-detail-section--audit">
                                <h3>Kiểm tra dữ liệu</h3>
                                <div className="payroll-audit-metrics">
                                  <span><b>{formatNumber(item.scheduleShiftCount)}</b> ca theo lịch</span>
                                  <span><b>{formatNumber(item.lateMinutes)}</b> phút đi muộn</span>
                                  <span><b>{formatNumber(item.unpaidLeaveDays)}</b> ngày nghỉ không lương</span>
                                </div>
                                {warnings.length ? (
                                  <ul className="payroll-warning-list">
                                    {warnings.map((warning) => <li key={warning}>{warning}</li>)}
                                  </ul>
                                ) : (
                                  <p className="payroll-audit-ok">
                                    <CheckCircle2 size={16} aria-hidden="true" /> Không có cảnh báo bổ sung.
                                  </p>
                                )}
                              </section>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10}>
                    <div className="table-empty table-empty--rich payroll-empty-state">
                      <div className="table-empty__content">
                        <span className="payroll-empty-icon" aria-hidden="true">₫</span>
                        <strong>Chưa có dữ liệu lương phù hợp</strong>
                        <span>Chọn kỳ lương, nhà hàng hoặc khoảng thời gian khác để xem bảng lương.</span>
                        <div className="payroll-empty-actions">
                          <button className="btn btn-white" type="button" onClick={resetFilters}>Bỏ lọc</button>
                          <button className="btn btn-primary" type="button" onClick={() => refreshPayrollData()}>
                            Làm mới dữ liệu
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="payroll-pagination-bar" aria-label="Phân trang bảng lương">
          <div className="payroll-pagination-info">
            <strong>{totalCount}</strong> nhân viên • Hiển thị {firstRow}-{lastRow} • Trang {currentPage}/{totalPages}
          </div>
          <div className="payroll-pagination-actions">
            <button className="btn btn-white" type="button" onClick={() => goToPage(1)} disabled={currentPage <= 1 || tableLoading}>Đầu</button>
            <button className="btn btn-white" type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1 || tableLoading}>Trước</button>
            <span className="payroll-page-pill">{currentPage}</span>
            <button className="btn btn-white" type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages || tableLoading}>Sau</button>
            <button className="btn btn-white" type="button" onClick={() => goToPage(totalPages)} disabled={currentPage >= totalPages || tableLoading}>Cuối</button>
          </div>
        </div>
      </section>
    </div>
  );
}

const PayrollManagement = () => {
  const {
    restaurantOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    restaurantsLoading,
  } = useManagerRestaurantSelection();

  if (!selectedRestaurantId) {
    return (
      <div className="payroll-page-compact">
        <section className="header-toolbar">
          <div className="title-zone">
            <span className="eyebrow">Trung tâm lương thưởng</span>
            <h1 className="page-title">Quản lý lương</h1>
            <p className="page-subtitle">
              {restaurantsLoading
                ? "Đang tải phạm vi nhà hàng..."
                : "Chưa có nhà hàng phù hợp để quản lý bảng lương."}
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <PayrollWorkspace
      key={selectedRestaurantId}
      restaurantOptions={restaurantOptions}
      selectedRestaurantId={selectedRestaurantId}
      setSelectedRestaurantId={setSelectedRestaurantId}
    />
  );
};

export default PayrollManagement;
