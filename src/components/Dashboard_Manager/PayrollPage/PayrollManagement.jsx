import React, { useMemo, useState } from "react";
import usePayroll from "@/hooks/usePayroll";
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

const PayrollManagement = () => {
  const [dateRange, setDateRange] = useState(getDefaultRange);
  const [activeTab, setActiveTab] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [sortBy, setSortBy] = useState("net_desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [showPayslip, setShowPayslip] = useState(null);

  const { payrollItems, payrollStats, loading, error, refetch } = usePayroll({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(Number(amount || 0));

  const calculateNet = (emp) => Number(emp.netSalary || 0);

  const getStatusBadge = (status) => {
    const map = {
      draft: { label: "Bản nháp", class: "draft" },
      pending: { label: "Chờ duyệt", class: "warning" },
      approved: { label: "Chờ chi", class: "info" },
      paid: { label: "Đã chi", class: "success" },
    };
    const s = map[status] || map.draft;
    return <span className={`status-dot ${s.class}`}>{s.label}</span>;
  };

  const getAvatarColor = (name) => {
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
    return colors[String(name || "").length % colors.length];
  };

  const departmentOptions = useMemo(() => {
    const set = new Set(payrollItems.map((item) => item.department).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [payrollItems]);

  const filteredData = useMemo(() => {
    const list = payrollItems.filter((item) => {
      const matchTab = activeTab === "all" || item.status === activeTab;
      const matchDept = deptFilter === "all" || item.department === deptFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        String(item.name || "").toLowerCase().includes(q) ||
        String(item.code || "").toLowerCase().includes(q);
      return matchTab && matchDept && matchSearch;
    });
    if (sortBy === "name_asc") list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    else if (sortBy === "name_desc") list.sort((a, b) => String(b.name).localeCompare(String(a.name)));
    else if (sortBy === "net_asc") list.sort((a, b) => Number(a.netSalary || 0) - Number(b.netSalary || 0));
    else list.sort((a, b) => Number(b.netSalary || 0) - Number(a.netSalary || 0));
    return list;
  }, [payrollItems, activeTab, deptFilter, searchQuery, sortBy]);

  const stats = useMemo(() => {
    if (payrollStats) {
      return {
        totalPayroll: Number(payrollStats.totalPayroll || 0),
        paidAmount: Number(payrollStats.paidAmount || 0),
        remaining: Number(payrollStats.remaining || 0),
        progress: Number(payrollStats.progress || 0),
      };
    }

    let totalPayroll = 0;
    let paidAmount = 0;
    for (const emp of payrollItems) {
      const net = Number(emp.netSalary || 0);
      totalPayroll += net;
      if (emp.status === "paid") paidAmount += net;
    }
    const progress = totalPayroll > 0 ? Math.round((paidAmount / totalPayroll) * 100) : 0;

    return {
      totalPayroll,
      paidAmount,
      remaining: totalPayroll - paidAmount,
      progress,
    };
  }, [payrollStats, payrollItems]);

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedIds(filteredData.map((i) => i.id));
    else setSelectedIds([]);
  };

  const handleSelectRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange((prev) => ({ ...prev, [name]: value }));
    setSelectedIds([]);
  };

  const handleExportCsv = () => {
    const header = [
      "ID",
      "Tên",
      "Mã NV",
      "Phòng ban",
      "Lương cơ bản",
      "Hệ số",
      "Tổng thu nhập",
      "Tổng khấu trừ",
      "Thực lĩnh",
      "Trạng thái",
    ].join(",");
    const rows = filteredData.map((item) =>
      [
        item.id,
        `"${item.name || ""}"`,
        item.code || "",
        item.department || "",
        Number(item.baseSalary || 0),
        Number(item.coefficient || 0),
        Number(item.totalIncome || 0),
        Number(item.totalDeduction || 0),
        Number(item.netSalary || 0),
        item.status || "",
      ].join(","),
    );
    const blob = new Blob([[header, ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "payroll_export.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="payroll-page-compact">
      <div className="header-toolbar">
        <div className="left-section">
          <h2 className="page-title">Bảng Lương</h2>

          <div className="cycle-picker-compact">
            <div className="input-group">
              <span className="label">Từ:</span>
              <input
                type="date"
                name="start"
                value={dateRange.start}
                onChange={handleDateChange}
              />
            </div>
            <span className="arrow">➝</span>
            <div className="input-group">
              <span className="label">Đến:</span>
              <input
                type="date"
                name="end"
                value={dateRange.end}
                onChange={handleDateChange}
              />
            </div>
          </div>
        </div>

        <div className="right-actions">
          <button className="btn btn-white" onClick={handleExportCsv}>
            📥 Xuất CSV
          </button>
          <button className="btn btn-primary" onClick={() => refetch?.()}>
            🔄 Tính Lương
          </button>
        </div>
      </div>

      <div className="metrics-strip">
        <div className="metric-group">
          <div className="metric-item">
            <span className="label">Tổng quỹ lương</span>
            <span className="value highlight">{formatCurrency(stats.totalPayroll)}</span>
          </div>
          <div className="separator"></div>
          <div className="metric-item">
            <span className="label">Đã chi trả</span>
            <span className="value success">{formatCurrency(stats.paidAmount)}</span>
          </div>
          <div className="separator"></div>
          <div className="metric-item">
            <span className="label">Còn lại</span>
            <span className="value danger">{formatCurrency(stats.remaining)}</span>
          </div>
        </div>

        <div className="progress-section">
          <div className="progress-info">
            <span>Tiến độ giải ngân</span>
            <strong>{stats.progress}%</strong>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${stats.progress}%` }}></div>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-controls">
          <div className="left-controls">
            <div className="workflow-tabs">
              {[
                { id: "all", label: "Tất cả" },
                { id: "draft", label: "Nháp" },
                { id: "pending", label: "Chờ duyệt" },
                { id: "approved", label: "Chờ chi" },
                { id: "paid", label: "Đã chi" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="right-controls">
            <select
              className="filter-select"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              {departmentOptions.map((dep) => (
                <option key={dep} value={dep}>
                  {dep === "all" ? "🏢 Tất cả phòng ban" : dep}
                </option>
              ))}
            </select>
            <select
              className="filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="net_desc">💰 Thực lĩnh giảm dần</option>
              <option value="net_asc">💰 Thực lĩnh tăng dần</option>
              <option value="name_asc">🔤 Tên A→Z</option>
              <option value="name_desc">🔤 Tên Z→A</option>
            </select>

            <div className="search-box">
              <span className="icon">🔍</span>
              <input
                type="text"
                placeholder="Tìm tên, mã NV..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="bulk-actions">
              <span className="count">Đã chọn {selectedIds.length} nhân viên</span>
              <div className="actions">
                <button className="btn-xs btn-white" onClick={() => setSelectedIds([])}>
                  Bỏ chọn
                </button>
              </div>
            </div>
          )}
        </div>

        {error && <div className="table-empty">Không tải được dữ liệu bảng lương.</div>}

        <div className="table-responsive">
          <table className="payroll-table">
            <thead>
              <tr>
                <th style={{ width: "50px" }} className="center">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={selectedIds.length === filteredData.length && filteredData.length > 0}
                  />
                </th>
                <th style={{ width: "250px" }} className="sticky-left">
                  Nhân viên
                </th>
                <th style={{ width: "130px" }}>Lương CB</th>
                <th style={{ width: "80px" }} className="center">
                  Công
                </th>
                <th style={{ width: "130px" }} className="text-right">
                  Thu Nhập (+)
                </th>
                <th style={{ width: "130px" }} className="text-right">
                  Khấu Trừ (-)
                </th>
                <th style={{ width: "150px" }} className="text-right">
                  Thực Lĩnh
                </th>
                <th style={{ width: "120px" }} className="center">
                  Trạng thái
                </th>
                <th style={{ width: "80px" }} className="text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="table-empty">
                    Đang tải dữ liệu bảng lương...
                  </td>
                </tr>
              )}

              {!loading && filteredData.length === 0 && (
                <tr>
                  <td colSpan={9} className="table-empty">
                    Không có dữ liệu phù hợp.
                  </td>
                </tr>
              )}

              {!loading &&
                filteredData.map((item) => {
                  const net = calculateNet(item);
                  const totalIncome = Number(item.totalIncome || 0);
                  const totalDeduct = Number(item.totalDeduction || 0);
                  const isSelected = selectedIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={isSelected ? "selected" : ""}
                      onClick={() =>
                        setShowPayslip({ ...item, net, totalIncome, totalDeduct })
                      }
                    >
                      <td className="center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(item.id)}
                        />
                      </td>

                      <td className="sticky-left">
                        <div className="emp-cell">
                          <div
                            className="avatar"
                            style={{
                              backgroundColor: !item.avatar
                                ? getAvatarColor(item.name)
                                : "transparent",
                              backgroundImage: item.avatar ? `url(${item.avatar})` : "none",
                            }}
                          >
                            {!item.avatar && item.name.charAt(0)}
                          </div>
                          <div>
                            <div className="name">{item.name}</div>
                            <div className="sub">
                              {item.code || "—"} • {item.department}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>{formatCurrency(item.baseSalary)}</td>

                      <td className="center">
                        <span className="work-tag">
                          {item.actualWorkDays}/{item.workDays}
                        </span>
                      </td>

                      <td className="text-right text-success">+{formatCurrency(totalIncome)}</td>
                      <td className="text-right text-danger">-{formatCurrency(totalDeduct)}</td>

                      <td className="text-right net-cell">
                        <strong>{formatCurrency(net)}</strong>
                      </td>

                      <td className="center">
                        <div className="status-badge-wrapper">{getStatusBadge(item.status)}</div>
                      </td>

                      <td className="text-right action-cell">
                        <button className="btn-icon" title="Xem phiếu lương">
                          📄
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {showPayslip && (
        <PayslipModal
          data={showPayslip}
          dateRange={dateRange}
          onClose={() => setShowPayslip(null)}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
};

const PayslipModal = ({ data, dateRange, onClose, formatCurrency }) => {
  const formatDate = (d) =>
    new Date(d).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="payslip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="brand">
            <h3>PHIẾU LƯƠNG (PAYSLIP)</h3>
            <span>
              Kỳ lương: {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
            </span>
          </div>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="emp-summary">
            <div className="left">
              <h4>{data.name}</h4>
              <p>
                {data.code} - {data.role}
              </p>
              <p>{data.department}</p>
              <p>Hệ số lương: {Number(data.coefficient || 0).toFixed(2)}</p>
            </div>
            <div className="right">
              <div className="net-total-box">
                <span>Thực Lĩnh:</span>
                <h2>{formatCurrency(data.net)}</h2>
              </div>
            </div>
          </div>

          <div className="details-grid">
            <div className="section">
              <h5 className="section-title income">Các Khoản Thu Nhập</h5>
              <div className="row">
                <span>Lương cơ bản</span>
                <span>{formatCurrency(data.baseSalary)}</span>
              </div>
              <div className="row">
                <span>Lương theo công ({data.actualWorkDays} ngày)</span>
                <span>
                  {formatCurrency((data.workDays > 0 ? data.baseSalary / data.workDays : 0) * data.actualWorkDays)}
                </span>
              </div>
              <div className="row">
                <span>Phụ cấp trách nhiệm</span>
                <span>{formatCurrency(data.allowance)}</span>
              </div>
              <div className="row">
                <span>Thưởng hiệu suất & KPI</span>
                <span>{formatCurrency(data.bonus)}</span>
              </div>
              <div className="row">
                <span>Làm thêm giờ (OT)</span>
                <span>{formatCurrency(data.overtime)}</span>
              </div>
              <div className="row total text-success">
                <strong>Tổng thu nhập</strong>
                <strong>{formatCurrency(data.totalIncome)}</strong>
              </div>
            </div>

            <div className="section">
              <h5 className="section-title deduction">Các Khoản Khấu Trừ</h5>
              <div className="row">
                <span>BHXH, BHYT, Thuế TNCN</span>
                <span>{formatCurrency(data.deduction)}</span>
              </div>
              <div className="row">
                <span>Tạm ứng lương</span>
                <span>{formatCurrency(data.advance)}</span>
              </div>
              <div className="row">
                <span>Phạt vi phạm</span>
                <span>{formatCurrency(Math.max(0, Number(data.deduction || 0) - Number(data.advance || 0)))}</span>
              </div>
              <div className="row total text-danger">
                <strong>Tổng khấu trừ</strong>
                <strong>{formatCurrency(data.totalDeduct)}</strong>
              </div>
            </div>
          </div>
          <div className="formula-note">
            Công thức: <strong>Thực lĩnh = Tổng thu nhập - Tổng khấu trừ</strong> (hệ số công kỳ này:{" "}
            <strong>{Number(data.coefficient || 0).toFixed(2)}</strong>).
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Đóng
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            🖨️ In Phiếu
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayrollManagement;
