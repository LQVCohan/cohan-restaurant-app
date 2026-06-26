import React, { useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import usePayroll from "@/hooks/usePayroll";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
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
  const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 25);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 24);
  return {
    start: toDateInput(prevMonth),
    end: toDateInput(thisMonth),
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
    .map((row) => columns.map((column) => escapeCsvValue(row[column.key])).join(","))
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
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(value || 0));

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
  if (["paid"].includes(status)) return "success";
  if (["payment_failed"].includes(status)) return "danger";
  if (["locked"].includes(status)) return "locked";
  if (["finalized", "paying", "pending_payment", "processing_payment"].includes(status)) return "info";
  return "warning";
};

const getEmployeeInitials = (name = "") => {
  const parts = String(name || "NV").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NV";
  return parts.slice(-2).map((part) => part[0]).join("").toUpperCase();
};

const getPayrollErrorMessage = (error, fallback = "Thao tác bảng lương không thành công.") =>
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

const PayrollManagement = () => {
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

  const {
    restaurantOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    restaurantsLoading,
  } = useManagerRestaurantSelection();

  const payroll = usePayroll({
    periodId: selectedPeriodId || undefined,
    restaurantId: selectedRestaurantId || undefined,
    startDate: apiRange.startDate,
    endDate: apiRange.endDate,
  });

  const periods = payroll.periods || [];
  const currentPeriod = payroll.periodDetail?.period || periods.find((period) => period.id === (selectedPeriodId || payroll.currentPeriodId)) || null;
  const effectivePeriodId = selectedPeriodId || currentPeriod?.id || payroll.currentPeriodId || periods[0]?.id || "";
  const actionDisabled = !effectivePeriodId;
  const overviewOffset = Math.max(0, (page - 1) * PAYROLL_PAGE_SIZE);
  const overviewStatus = activeStatus === "all" ? undefined : activeStatus;
  const overviewSearch = search.trim() || undefined;

  useEffect(() => {
    setPage(1);
  }, [activeStatus, range.end, range.start, search, selectedPeriodId, selectedRestaurantId]);

  const overviewQuery = useQuery(PAYROLL_OVERVIEW_PAGE_QUERY, {
    variables: {
      startDate: apiRange.startDate,
      endDate: apiRange.endDate,
      restaurantId: selectedRestaurantId || undefined,
      periodId: effectivePeriodId || undefined,
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
  const stats = overview?.stats || payroll.payrollStats || currentPeriod?.stats || {};
  const readiness = payroll.payrollReadiness || null;
  const hasSnapshotItems = items.some((item) => item.periodId || item.payrollItemId);
  const tableLoading = payroll.loading || overviewQuery.loading;
  const totalPages = Math.max(1, Number(pageInfo.totalPages || 1));
  const totalCount = Number(pageInfo.totalCount || 0);
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const firstRow = totalCount > 0 ? Number(pageInfo.offset || 0) + 1 : 0;
  const lastRow = totalCount > 0 ? Math.min(Number(pageInfo.offset || 0) + items.length, totalCount) : 0;
  const payrollModeLabel = hasSnapshotItems ? "Kỳ lương chính thức" : "Dữ liệu tạm tính";
  const canCreatePeriod = Boolean(selectedRestaurantId && apiRange.startDate && apiRange.endDate && !tableLoading);

  const totals = useMemo(() => {
    const totalPayroll = Number(stats.totalPayroll ?? items.reduce((sum, item) => sum + Number(item.netSalary || 0), 0));
    const paidAmount = Number(stats.paidAmount ?? items.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0));
    const remaining = Number(stats.remaining ?? Math.max(totalPayroll - paidAmount, 0));
    const progress = Number(stats.progress ?? (totalPayroll > 0 ? Math.round((paidAmount / totalPayroll) * 100) : 0));
    return { totalPayroll, paidAmount, remaining, progress };
  }, [items, stats]);

  const resetFilters = () => {
    setSearch("");
    setActiveStatus("all");
    setRange(defaultRange);
    setPage(1);
  };

  const handlePeriodChange = (event) => {
    const nextPeriodId = event.target.value;
    setSelectedPeriodId(nextPeriodId);
  };

  const handleExportCsv = () => {
    const rows = items.map((item) => ({
      ...item,
      status: statusLabel(item.status),
    }));
    downloadCsv(`payroll-page-${currentPage}-${range.start}-${range.end}.csv`, rows, EXPORT_COLUMNS);
  };

  const refreshPayrollData = async (periodIdOverride = effectivePeriodId) => {
    await Promise.allSettled([
      payroll.refetchPeriods?.(),
      periodIdOverride ? payroll.refetchDetail?.({ periodId: periodIdOverride }) : null,
      periodIdOverride ? payroll.refetchPayrollReadiness?.({ periodId: periodIdOverride }) : null,
      overviewQuery.refetch?.({
        startDate: apiRange.startDate,
        endDate: apiRange.endDate,
        restaurantId: selectedRestaurantId || undefined,
        periodId: periodIdOverride || undefined,
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
        throw new Error("Tạo kỳ lương không thành công. Vui lòng kiểm tra quyền quản lý bảng lương.");
      }

      setSelectedPeriodId(newPeriodId);
      await refreshPayrollData(newPeriodId);
      setActionMessage("Đã tạo kỳ lương chính thức.");
    } catch (error) {
      setActionMessage(getPayrollErrorMessage(error, "Tạo kỳ lương không thành công."));
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
      await refreshPayrollData();
      setActionMessage(`${label} thành công.`);
    } catch (error) {
      setActionMessage(getPayrollErrorMessage(error, `${label} không thành công.`));
    }
  };

  const goToPage = (nextPage) => {
    setPage(Math.min(Math.max(1, nextPage), totalPages));
  };

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
            <span className="status-dot info">{statusLabel(hasSnapshotItems ? currentPeriod?.status || "draft" : "draft")}</span>
            <span className={`payroll-data-mode ${hasSnapshotItems ? "is-official" : "is-runtime"}`}>{payrollModeLabel}</span>
            <span className="payroll-date-range">
              {formatDate(currentPeriod?.startDate || range.start)} - {formatDate(currentPeriod?.endDate || range.end)}
            </span>
            <span className="payroll-employee-count">{totalCount} nhân viên phù hợp</span>
          </div>
        </div>

        <div className="right-actions payroll-control-card">
          <label className="cycle-picker-compact">
            <span className="label">Nhà hàng</span>
            <select
              className="filter-select"
              value={selectedRestaurantId || ""}
              onChange={(event) => setSelectedRestaurantId(event.target.value)}
              disabled={restaurantsLoading}
            >
              {!restaurantOptions.length && <option value="">Chưa có nhà hàng</option>}
              {restaurantOptions.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
              ))}
            </select>
          </label>

          <label className="cycle-picker-compact">
            <span className="label">Kỳ lương</span>
            <select className="filter-select" value={selectedPeriodId} onChange={handlePeriodChange}>
              <option value="">Kỳ hiện tại / gần nhất</option>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>{period.name || `${formatDate(period.startDate)} - ${formatDate(period.endDate)}`}</option>
              ))}
            </select>
          </label>

          <div className="actions-row">
            <button className="btn btn-white" type="button" onClick={refreshPayrollData}>
              Làm mới
            </button>
            <button className="btn btn-primary" type="button" onClick={handleExportCsv} disabled={!items.length}>
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
            <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, totals.progress))}%` }} />
          </div>
          <small>{readiness?.readyToFinalize ? "Kỳ lương sẵn sàng chốt" : "Kiểm tra dữ liệu trước khi chốt"}</small>
        </aside>
      </section>

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
              onChange={(event) => setRange((current) => ({ ...current, start: event.target.value }))}
            />
            <input
              className="filter-select payroll-date-input"
              type="date"
              value={range.end}
              onChange={(event) => setRange((current) => ({ ...current, end: event.target.value }))}
            />
          </div>
        </div>

        <div className="table-controls table-controls--secondary payroll-action-row">
          <div className="right-controls payroll-action-buttons">
            <button className="btn btn-create-period" type="button" onClick={handleCreatePeriod} disabled={!canCreatePeriod}>
              + Tạo kỳ lương
            </button>
            <button className="btn btn-white" type="button" onClick={() => runAction("Tính lại lương", payroll.recalculatePeriod)} disabled={actionDisabled}>
              Tính lại
            </button>
            <button className="btn btn-success" type="button" onClick={() => runAction("Chốt kỳ lương", payroll.finalizePeriod)} disabled={actionDisabled}>
              Chốt kỳ
            </button>
            <button className="btn btn-primary" type="button" onClick={() => runAction("Khóa kỳ lương", payroll.lockPeriod)} disabled={actionDisabled}>
              Khóa kỳ
            </button>
          </div>
          <span className={`payroll-inline-message ${actionDisabled ? "is-muted" : ""}`}>
            {actionMessage || (actionDisabled ? "Tạo kỳ lương để tính lại, chốt hoặc khóa kỳ." : hasSnapshotItems ? "Kỳ lương chính thức đã sẵn sàng xử lý." : "Đang xem dữ liệu lương tạm tính từ nhân viên.")}
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
                    <td className="sticky-left" colSpan={10}>Đang tải dữ liệu lương...</td>
                  </tr>
                ))
              ) : items.length ? (
                items.map((item) => (
                  <tr key={item.id || item.payrollItemId || item.code || item.name}>
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
                    <td className="numeric-cell"><span className="work-tag">{formatNumber(item.actualWorkDays ?? item.workDays)} ngày</span></td>
                    <td className="numeric-cell">{formatNumber(item.totalHours)} giờ</td>
                    <td className="money-cell">{formatMoney(item.grossIncome ?? item.totalIncome)}</td>
                    <td className="money-cell text-danger">{formatMoney(item.totalDeduction ?? item.deduction)}</td>
                    <td className="money-cell net-cell">{formatMoney(item.netSalary)}</td>
                    <td className="money-cell text-success">{formatMoney(item.paidAmount)}</td>
                    <td className="money-cell">{formatMoney(item.remainingAmount)}</td>
                    <td><span className={`status-dot ${statusClass(item.status)}`}>{statusLabel(item.status)}</span></td>
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
                          <button className="btn btn-white" type="button" onClick={resetFilters}>Bỏ lọc</button>
                          <button className="btn btn-primary" type="button" onClick={refreshPayrollData}>Làm mới dữ liệu</button>
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
};

export default PayrollManagement;
