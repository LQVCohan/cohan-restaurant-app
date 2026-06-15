import React, { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import usePayroll, { QUERY_STAFF_PAYROLL_OVERVIEW } from "@/hooks/usePayroll";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import "./PayrollManagement.scss";

const getDefaultRange = () => {
  const today = new Date();
  const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 26);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 25);
  return {
    start: prevMonth.toISOString().split("T")[0],
    end: thisMonth.toISOString().split("T")[0],
  };
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

const PayrollManagement = () => {
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [range, setRange] = useState(defaultRange);
  const [activeStatus, setActiveStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const {
    restaurantOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    restaurantsLoading,
  } = useManagerRestaurantSelection();

  const payroll = usePayroll({
    periodId: selectedPeriodId || undefined,
    restaurantId: selectedRestaurantId || undefined,
    startDate: range.start,
    endDate: range.end,
  });

  const runtimeOverviewQuery = useQuery(QUERY_STAFF_PAYROLL_OVERVIEW, {
    variables: {
      startDate: range.start,
      endDate: range.end,
      restaurantId: selectedRestaurantId || undefined,
      periodId: undefined,
    },
    skip: !selectedRestaurantId || !range.start || !range.end,
    fetchPolicy: "cache-and-network",
  }) || {};

  const periods = payroll.periods || [];
  const currentPeriod = payroll.periodDetail?.period || periods.find((period) => period.id === (selectedPeriodId || payroll.currentPeriodId)) || null;
  const snapshotItems = payroll.payrollItems || [];
  const runtimeItems = runtimeOverviewQuery.data?.staffPayrollOverview?.items || [];
  const hasSnapshotItems = snapshotItems.length > 0;
  const items = hasSnapshotItems ? snapshotItems : runtimeItems;
  const stats = hasSnapshotItems
    ? payroll.payrollStats || currentPeriod?.stats || {}
    : runtimeOverviewQuery.data?.staffPayrollOverview?.stats || payroll.payrollStats || currentPeriod?.stats || {};
  const readiness = payroll.payrollReadiness || null;

  const effectivePeriodId = selectedPeriodId || currentPeriod?.id || payroll.currentPeriodId || periods[0]?.id || "";
  const actionDisabled = !effectivePeriodId;
  const tableLoading = payroll.loading || runtimeOverviewQuery.loading;

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = activeStatus === "all" || item.status === activeStatus;
      const haystack = [item.name, item.code, item.department, item.role].join(" ").toLowerCase();
      const matchesSearch = !keyword || haystack.includes(keyword);
      return matchesStatus && matchesSearch;
    });
  }, [activeStatus, items, search]);

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
  };

  const handlePeriodChange = (event) => {
    const nextPeriodId = event.target.value;
    setSelectedPeriodId(nextPeriodId);
  };

  const handleExportCsv = () => {
    const rows = filteredItems.map((item) => ({
      ...item,
      status: statusLabel(item.status),
    }));
    downloadCsv(`payroll-${range.start}-${range.end}.csv`, rows, EXPORT_COLUMNS);
  };

  const refreshPayrollData = async () => {
    await Promise.allSettled([
      payroll.refetchPeriods?.(),
      effectivePeriodId ? payroll.refetchDetail?.({ periodId: effectivePeriodId }) : null,
      effectivePeriodId ? payroll.refetchPayrollReadiness?.({ periodId: effectivePeriodId }) : null,
      runtimeOverviewQuery.refetch?.({
        startDate: range.start,
        endDate: range.end,
        restaurantId: selectedRestaurantId || undefined,
        periodId: undefined,
      }),
    ]);
  };

  const runAction = async (label, action) => {
    if (!effectivePeriodId || typeof action !== "function") {
      setActionMessage("Chưa có kỳ lương để thao tác.");
      return;
    }
    try {
      setActionMessage(`Đang ${label.toLowerCase()}...`);
      await action({ variables: { periodId: effectivePeriodId } });
      await refreshPayrollData();
      setActionMessage(`${label} thành công.`);
    } catch (error) {
      setActionMessage(error?.message || `${label} không thành công.`);
    }
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
            <span className="payroll-date-range">
              {formatDate(currentPeriod?.startDate || range.start)} - {formatDate(currentPeriod?.endDate || range.end)}
            </span>
            <span className="payroll-employee-count">{filteredItems.length}/{items.length} nhân viên</span>
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
            <button className="btn btn-primary" type="button" onClick={handleExportCsv} disabled={!filteredItems.length}>
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
            {actionMessage || (actionDisabled ? "Chưa có kỳ lương để thao tác" : hasSnapshotItems ? "Sẵn sàng xử lý kỳ lương" : "Đang xem dữ liệu lương tạm tính từ nhân viên")}
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
              ) : filteredItems.length ? (
                filteredItems.map((item) => (
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
      </section>
    </div>
  );
};

export default PayrollManagement;
