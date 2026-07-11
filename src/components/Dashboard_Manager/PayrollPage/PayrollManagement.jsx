import React, { useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import usePayroll from "@/hooks/usePayroll";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import PayrollReadinessPanel from "./components/PayrollReadinessPanel";
import "./PayrollManagement.scss";
import "../../../styles/PayrollPagination.css";

const PAYROLL_PAGE_SIZE = 8;

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
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
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
  ) {
    return "info";
  }
  return "warning";
};
const getEmployeeInitials = (name = "") => {
  const parts = String(name || "NV")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
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
  grossIncome: row.grossIncome || 0,
  totalDeduction:
    Number(row.deduction || 0) +
    Number(row.insuranceTotal || 0) +
    Number(row.personalIncomeTax || 0),
  netSalary: row.netSalary || 0,
  paidAmount: row.paidAmount || 0,
  remainingAmount: row.remainingAmount || 0,
  status: statusLabel(row.status),
});

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

  const apiRange = useMemo(
    () => ({
      startDate: toPayrollDateTime(range.start, "start"),
      endDate: toPayrollDateTime(range.end, "end"),
    }),
    [range.end, range.start],
  );

  const payroll = usePayroll({
    periodId: selectedPeriodId || undefined,
    restaurantId: selectedRestaurantId,
    startDate: apiRange.startDate,
    endDate: apiRange.endDate,
  });
  const periods = payroll.periods || [];
  const requestedPeriodId =
    selectedPeriodId || payroll.currentPeriodId || periods[0]?.id || "";
  const detailPeriod = payroll.periodDetail?.period || null;
  const detailMatches = Boolean(
    detailPeriod?.id &&
      String(detailPeriod.restaurantId || "") ===
        String(selectedRestaurantId || "") &&
      (!requestedPeriodId || String(detailPeriod.id) === String(requestedPeriodId)),
  );
  const currentPeriod =
    (detailMatches ? detailPeriod : null) ||
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
    skip:
      !selectedRestaurantId || !apiRange.startDate || !apiRange.endDate,
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
  const stats = overview?.stats || payroll.payrollStats || currentPeriod?.stats || {};
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
    selectedRestaurantId &&
      apiRange.startDate &&
      apiRange.endDate &&
      !tableLoading,
  );
  const canEditDraft = hasOfficialPeriod && periodStatus === "draft";
  const canLockPeriod = hasOfficialPeriod && periodStatus === "paid";

  const totals = useMemo(() => {
    const totalPayroll = Number(
      stats.totalPayroll ??
        items.reduce((sum, item) => sum + Number(item.netSalary || 0), 0),
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
        (totalPayroll > 0
          ? Math.round((paidAmount / totalPayroll) * 100)
          : 0),
    );
    return { totalPayroll, paidAmount, remaining, progress };
  }, [items, stats]);

  const refreshPayrollData = async (periodIdOverride) => {
    const targetPeriodId =
      typeof periodIdOverride === "string" && periodIdOverride
        ? periodIdOverride
        : effectivePeriodId;
    await Promise.allSettled([
      payroll.refetchPeriods?.(),
      targetPeriodId
        ? payroll.refetchDetail?.({ periodId: targetPeriodId })
        : null,
      targetPeriodId
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
      const result = await action({
        variables: { periodId: effectivePeriodId },
      });
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
            Theo dõi kỳ lương, tổng chi phí, trạng thái chi trả và bảng lương nhân viên theo từng nhà hàng.
          </p>
          <div className="quick-stats payroll-summary-line">
            <span className="status-dot info">{statusLabel(periodStatus)}</span>
            <span
              className={`payroll-data-mode ${hasOfficialPeriod ? "is-official" : "is-runtime"}`}
            >
              {hasOfficialPeriod ? "Kỳ lương chính thức" : "Dữ liệu tạm tính"}
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
            <span className="label">Kỳ lương</span>
            <select
              className="filter-select"
              value={selectedPeriodId}
              onChange={(event) => setSelectedPeriodId(event.target.value)}
            >
              <option value="">Kỳ hiện tại / gần nhất</option>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name || `${formatDate(period.startDate)} - ${formatDate(period.endDate)}`}
                </option>
              ))}
            </select>
          </label>
          <div className="actions-row">
            <button
              className="btn btn-white"
              type="button"
              onClick={() => refreshPayrollData()}
            >
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
            <small>Chi phí lương trong kỳ</small>
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
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${Math.max(0, Math.min(100, totals.progress))}%` }}
            />
          </div>
          <small>
            {payroll.payrollReadiness?.readyToFinalize
              ? "Kỳ lương sẵn sàng chốt"
              : "Kiểm tra dữ liệu trước khi chốt"}
          </small>
        </aside>
      </section>

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

      <section className="table-card payroll-table-card">
        <div className="table-controls payroll-filter-row">
          <div className="workflow-tabs" role="tablist" aria-label="Trạng thái bảng lương">
            {STATUS_TABS.map((status) => (
              <button
                key={status}
                type="button"
                className={`tab-btn ${activeStatus === status ? "active" : ""}`}
                onClick={() => setActiveStatus(status)}
              >
                {status === "all" ? "Tất cả" : statusLabel(status)}
              </button>
            ))}
          </div>
          <div className="right-controls payroll-search-controls">
            <input
              className="filter-select payroll-search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm nhân viên, mã, bộ phận..."
            />
            <input
              className="filter-select payroll-date-input"
              type="date"
              value={range.start}
              onChange={(event) =>
                setRange((current) => ({ ...current, start: event.target.value }))
              }
            />
            <input
              className="filter-select payroll-date-input"
              type="date"
              value={range.end}
              onChange={(event) =>
                setRange((current) => ({ ...current, end: event.target.value }))
              }
            />
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
          <span className={`payroll-inline-message ${!hasOfficialPeriod ? "is-muted" : ""}`}>
            {actionMessage ||
              (!hasOfficialPeriod
                ? "Tạo kỳ lương để tính lại, chốt hoặc khóa kỳ."
                : periodStatus === "draft"
                  ? "Kỳ lương nháp đang sẵn sàng kiểm tra và chốt."
                  : `Kỳ lương hiện ở trạng thái ${statusLabel(periodStatus)}.`)}
          </span>
        </div>

        <div className="table-responsive">
          <table className="payroll-table">
            <thead>
              <tr>
                <th className="sticky-left">Nhân viên</th>
                <th>Bộ phận</th>
                <th className="numeric-col">Ngày công</th>
                <th className="numeric-col">Giờ công</th>
                <th className="money-col">Thu nhập</th>
                <th className="money-col">Khấu trừ</th>
                <th className="money-col is-strong">Thực nhận</th>
                <th className="money-col">Đã chi</th>
                <th className="money-col">Còn lại</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {tableLoading && !items.length ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`loading-${index}`}>
                    <td className="sticky-left" colSpan={10}>
                      Đang tải dữ liệu lương...
                    </td>
                  </tr>
                ))
              ) : items.length ? (
                items.map((item) => (
                  <tr key={item.payrollItemId || item.id || item.code || item.name}>
                    <td className="sticky-left">
                      <div className="emp-cell">
                        <span className="avatar">{getEmployeeInitials(item.name)}</span>
                        <span>
                          <strong className="name">{item.name || "Nhân viên"}</strong>
                          <small className="sub">{item.code || item.payrollItemId || "--"}</small>
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
                    <td className="money-cell">{formatMoney(item.grossIncome ?? item.totalIncome)}</td>
                    <td className="money-cell text-danger">{formatMoney(item.totalDeduction ?? item.deduction)}</td>
                    <td className="money-cell net-cell">{formatMoney(item.netSalary)}</td>
                    <td className="money-cell text-success">{formatMoney(item.paidAmount)}</td>
                    <td className="money-cell">{formatMoney(item.remainingAmount)}</td>
                    <td>
                      <span className={`status-dot ${statusClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10}>
                    <div className="table-empty table-empty--rich payroll-empty-state">
                      <div className="table-empty__content">
                        <span className="payroll-empty-icon" aria-hidden="true">₫</span>
                        <strong>Chưa có dữ liệu lương phù hợp</strong>
                        <span>Chọn kỳ lương, nhà hàng hoặc khoảng thời gian khác để xem bảng lương.</span>
                        <div className="payroll-empty-actions">
                          <button className="btn btn-white" type="button" onClick={resetFilters}>
                            Bỏ lọc
                          </button>
                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={() => refreshPayrollData()}
                          >
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
            <button className="btn btn-white" type="button" onClick={() => goToPage(1)} disabled={currentPage <= 1 || tableLoading}>
              Đầu
            </button>
            <button className="btn btn-white" type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1 || tableLoading}>
              Trước
            </button>
            <span className="payroll-page-pill">{currentPage}</span>
            <button className="btn btn-white" type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages || tableLoading}>
              Sau
            </button>
            <button className="btn btn-white" type="button" onClick={() => goToPage(totalPages)} disabled={currentPage >= totalPages || tableLoading}>
              Cuối
            </button>
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
