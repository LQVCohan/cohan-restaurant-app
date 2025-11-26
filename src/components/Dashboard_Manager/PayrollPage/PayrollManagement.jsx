import React, { useState, useMemo } from "react";
import "./PayrollManagement.scss";

// --- MOCK DATA: DỮ LIỆU LƯƠNG GIẢ LẬP ---
const MOCK_PAYROLL = [
  {
    id: 1,
    name: "Nguyễn Nhật Minh",
    code: "NV001",
    role: "Cửa hàng trưởng",
    department: "Management",
    avatar: "https://i.pravatar.cc/150?img=11",
    baseSalary: 15000000,
    workDays: 26,
    actualWorkDays: 26,
    allowance: 2000000,
    bonus: 1500000,
    overtime: 0,
    deduction: 1050000,
    advance: 0,
    status: "paid",
  },
  {
    id: 2,
    name: "Trần Thị Thu Hà",
    code: "NV002",
    role: "Bếp chính",
    department: "Kitchen",
    avatar: "https://i.pravatar.cc/150?img=5",
    baseSalary: 12000000,
    workDays: 26,
    actualWorkDays: 25,
    allowance: 1000000,
    bonus: 500000,
    overtime: 1200000,
    deduction: 800000,
    advance: 2000000,
    status: "approved",
  },
  {
    id: 3,
    name: "Lê Văn Cường",
    code: "NV003",
    role: "Phục vụ",
    department: "Service",
    avatar: null,
    baseSalary: 7000000,
    workDays: 26,
    actualWorkDays: 26,
    allowance: 500000,
    bonus: 200000,
    overtime: 0,
    deduction: 0,
    advance: 0,
    status: "draft",
  },
  {
    id: 4,
    name: "Phạm Hoàng Yến",
    code: "NV004",
    role: "Thu ngân",
    department: "Cashier",
    avatar: "https://i.pravatar.cc/150?img=9",
    baseSalary: 8500000,
    workDays: 26,
    actualWorkDays: 26,
    allowance: 500000,
    bonus: 300000,
    overtime: 0,
    deduction: 600000,
    advance: 0,
    status: "paid",
  },
  {
    id: 5,
    name: "Đỗ Minh Tuấn",
    code: "NV005",
    role: "Phụ bếp",
    department: "Kitchen",
    avatar: null,
    baseSalary: 6000000,
    workDays: 26,
    actualWorkDays: 23,
    allowance: 300000,
    bonus: 0,
    overtime: 500000,
    deduction: 0,
    advance: 1000000,
    status: "pending",
  },
  {
    id: 6,
    name: "Vũ Thị Mai",
    code: "NV006",
    role: "Tạp vụ",
    department: "Cleaning",
    avatar: "https://i.pravatar.cc/150?img=24",
    baseSalary: 6500000,
    workDays: 26,
    actualWorkDays: 26,
    allowance: 200000,
    bonus: 100000,
    overtime: 0,
    deduction: 0,
    advance: 500000,
    status: "draft",
  },
  {
    id: 7,
    name: "Hoàng Văn Em",
    code: "NV007",
    role: "Pha chế",
    department: "Kitchen",
    avatar: "https://i.pravatar.cc/150?img=32",
    baseSalary: 9000000,
    workDays: 26,
    actualWorkDays: 26,
    allowance: 500000,
    bonus: 500000,
    overtime: 200000,
    deduction: 500000,
    advance: 0,
    status: "approved",
  },
];

const PayrollManagement = () => {
  // --- STATES ---
  // Kỳ lương mặc định: 26 tháng trước -> 25 tháng này
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 26);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 25);
    return {
      start: prevMonth.toISOString().split("T")[0],
      end: thisMonth.toISOString().split("T")[0],
    };
  });

  const [activeTab, setActiveTab] = useState("all"); // Filter trạng thái
  const [deptFilter, setDeptFilter] = useState("all"); // Filter phòng ban
  const [searchQuery, setSearchQuery] = useState(""); // Tìm kiếm
  const [selectedIds, setSelectedIds] = useState([]); // Checkbox chọn nhiều
  const [showPayslip, setShowPayslip] = useState(null); // Modal chi tiết

  // --- HELPERS ---
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);

  const calculateNet = (emp) => {
    const dailyWage = emp.baseSalary / emp.workDays;
    const income =
      dailyWage * emp.actualWorkDays + emp.allowance + emp.bonus + emp.overtime;
    const deduction = emp.deduction + emp.advance;
    return income - deduction;
  };

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
    return colors[name.length % colors.length];
  };

  // --- FILTERING LOGIC ---
  const filteredData = useMemo(() => {
    return MOCK_PAYROLL.filter((item) => {
      const matchTab = activeTab === "all" || item.status === activeTab;
      const matchDept = deptFilter === "all" || item.department === deptFilter;
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchTab && matchDept && matchSearch;
    });
  }, [activeTab, deptFilter, searchQuery]);

  // --- STATISTICS LOGIC ---
  const stats = useMemo(() => {
    let totalPayroll = 0;
    let paidAmount = 0;

    MOCK_PAYROLL.forEach((emp) => {
      const net = calculateNet(emp);
      totalPayroll += net;
      if (emp.status === "paid") paidAmount += net;
    });

    const progress =
      totalPayroll > 0 ? Math.round((paidAmount / totalPayroll) * 100) : 0;

    return {
      totalPayroll,
      paidAmount,
      remaining: totalPayroll - paidAmount,
      progress,
    };
  }, []);

  // --- HANDLERS ---
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
  };

  return (
    <div className="payroll-page-compact">
      {/* 1. HEADER & CYCLE PICKER */}
      <div className="header-toolbar">
        <div className="left-section">
          <h2 className="page-title">Bảng Lương</h2>

          {/* Chọn chu kỳ lương */}
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
          <button
            className="btn btn-white"
            onClick={() => alert("Xuất file Excel thành công!")}
          >
            📥 Xuất Excel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => alert("Đang tính toán lại lương...")}
          >
            🔄 Tính Lương
          </button>
        </div>
      </div>

      {/* 2. METRICS STRIP (Thống kê) */}
      <div className="metrics-strip">
        <div className="metric-group">
          <div className="metric-item">
            <span className="label">Tổng quỹ lương</span>
            <span className="value highlight">
              {formatCurrency(stats.totalPayroll)}
            </span>
          </div>
          <div className="separator"></div>
          <div className="metric-item">
            <span className="label">Đã chi trả</span>
            <span className="value success">
              {formatCurrency(stats.paidAmount)}
            </span>
          </div>
          <div className="separator"></div>
          <div className="metric-item">
            <span className="label">Còn lại</span>
            <span className="value danger">
              {formatCurrency(stats.remaining)}
            </span>
          </div>
        </div>

        <div className="progress-section">
          <div className="progress-info">
            <span>Tiến độ giải ngân</span>
            <strong>{stats.progress}%</strong>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${stats.progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* 3. MAIN DATA TABLE */}
      <div className="table-card">
        {/* Table Controls: Tabs, Filter, Search */}
        <div className="table-controls">
          {/* Left: Tabs */}
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

          {/* Right: Filter & Search */}
          <div className="right-controls">
            <select
              className="filter-select"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="all">🏢 Tất cả phòng ban</option>
              <option value="Management">👔 Quản lý</option>
              <option value="Kitchen">👨‍🍳 Bếp</option>
              <option value="Service">🍽️ Phục vụ</option>
              <option value="Cashier">💰 Thu ngân</option>
              <option value="Cleaning">🧹 Vệ sinh</option>
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

          {/* Bulk Actions Overlay (Hiện khi chọn dòng) */}
          {selectedIds.length > 0 && (
            <div className="bulk-actions">
              <span className="count">
                Đã chọn {selectedIds.length} nhân viên
              </span>
              <div className="actions">
                <button
                  className="btn-xs btn-white"
                  onClick={() => setSelectedIds([])}
                >
                  Bỏ chọn
                </button>
                <button
                  className="btn-xs btn-primary"
                  onClick={() => alert("Đã gửi phiếu lương qua Email!")}
                >
                  📧 Gửi Email
                </button>
                <button
                  className="btn-xs btn-success"
                  onClick={() => alert("Đã xác nhận thanh toán!")}
                >
                  💰 Thanh toán
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Table Responsive Wrapper */}
        <div className="table-responsive">
          <table className="payroll-table">
            <thead>
              <tr>
                {/* Set width cứng cho th để fix layout */}
                <th style={{ width: "50px" }} className="center">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={
                      selectedIds.length === filteredData.length &&
                      filteredData.length > 0
                    }
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
              {filteredData.map((item) => {
                const net = calculateNet(item);
                const totalIncome =
                  (item.baseSalary / item.workDays) * item.actualWorkDays +
                  item.allowance +
                  item.bonus +
                  item.overtime;
                const totalDeduct = item.deduction + item.advance;
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
                            backgroundImage: item.avatar
                              ? `url(${item.avatar})`
                              : "none",
                          }}
                        >
                          {!item.avatar && item.name.charAt(0)}
                        </div>
                        <div>
                          <div className="name">{item.name}</div>
                          <div className="sub">
                            {item.code} • {item.department}
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

                    <td className="text-right text-success">
                      +{formatCurrency(totalIncome)}
                    </td>
                    <td className="text-right text-danger">
                      -{formatCurrency(totalDeduct)}
                    </td>

                    <td className="text-right net-cell">
                      <strong>{formatCurrency(net)}</strong>
                    </td>

                    <td className="center">
                      <div className="status-badge-wrapper">
                        {getStatusBadge(item.status)}
                      </div>
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

      {/* 4. PAYSLIP MODAL */}
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

// --- SUB-COMPONENT: PAYSLIP MODAL ---
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
              Kỳ lương: {formatDate(dateRange.start)} -{" "}
              {formatDate(dateRange.end)}
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
            </div>
            <div className="right">
              <div className="net-total-box">
                <span>Thực Lĩnh:</span>
                <h2>{formatCurrency(data.net)}</h2>
              </div>
            </div>
          </div>

          <div className="details-grid">
            {/* Section Thu Nhập */}
            <div className="section">
              <h5 className="section-title income">Các Khoản Thu Nhập</h5>
              <div className="row">
                <span>Lương cơ bản</span>
                <span>{formatCurrency(data.baseSalary)}</span>
              </div>
              <div className="row">
                <span>Lương theo công ({data.actualWorkDays} ngày)</span>
                <span>
                  {formatCurrency(
                    (data.baseSalary / data.workDays) * data.actualWorkDays
                  )}
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

            {/* Section Khấu Trừ */}
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
                <span>0 ₫</span>
              </div>
              <div className="row total text-danger">
                <strong>Tổng khấu trừ</strong>
                <strong>{formatCurrency(data.totalDeduct)}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Đóng
          </button>
          <button
            className="btn btn-primary"
            onClick={() => alert("Đã gửi email!")}
          >
            📧 Gửi qua Email
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
