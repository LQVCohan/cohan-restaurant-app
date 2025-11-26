import React, { useState, useMemo } from "react";
import "./Attendance.scss";

// --- MOCK DATA: DANH SÁCH NHÂN VIÊN (Dùng cho Dropdown chọn nhanh) ---
const MOCK_EMPLOYEES_LIST = [
  { id: 1, name: "Nguyễn Văn A", code: "NV001", role: "Bếp" },
  { id: 2, name: "Trần Thị B", code: "NV002", role: "Thu ngân" },
  { id: 3, name: "Lê Văn C", code: "NV003", role: "Phục vụ" },
  { id: 4, name: "Phạm Thị D", code: "NV004", role: "Quản lý" },
  { id: 5, name: "Hoàng Văn E", code: "NV005", role: "Bếp phụ" },
];

// --- MOCK DATA: BẢNG CHẤM CÔNG HÔM NAY (Dữ liệu thực tế) ---
const MOCK_ATTENDANCE_LOGS = [
  {
    id: 1,
    name: "Nguyễn Văn A",
    role: "Bếp trưởng",
    shift: "08:00 - 17:00",
    checkIn: "07:55",
    checkOut: "17:05",
    status: "on-time",
    avatar: null,
  },
  {
    id: 2,
    name: "Trần Thị B",
    role: "Thu ngân",
    shift: "08:00 - 17:00",
    checkIn: "08:15",
    checkOut: null,
    status: "late",
    avatar: "https://i.pravatar.cc/150?u=2",
  },
  {
    id: 3,
    name: "Lê Văn C",
    role: "Phục vụ",
    shift: "14:00 - 22:00",
    checkIn: null,
    checkOut: null,
    status: "not-checked-in",
    avatar: null,
  },
  {
    id: 4,
    name: "Phạm Thị D",
    role: "Quản lý",
    shift: "08:00 - 17:00",
    checkIn: "08:00",
    checkOut: "16:30",
    status: "early-leave",
    avatar: "https://i.pravatar.cc/150?u=4",
  },
  {
    id: 5,
    name: "Hoàng Văn E",
    role: "Bếp phụ",
    shift: "08:00 - 17:00",
    checkIn: "07:50",
    checkOut: "17:00",
    status: "on-time",
    avatar: null,
  },
];

const AttendancePage = () => {
  // State quản lý chung
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // State cho chức năng Chấm Công Nhanh
  const [quickId, setQuickId] = useState("");
  const [quickNote, setQuickNote] = useState("");

  // --- 1. LOGIC THỐNG KÊ ---
  const stats = useMemo(() => {
    const total = MOCK_ATTENDANCE_LOGS.length;
    const present = MOCK_ATTENDANCE_LOGS.filter(
      (a) => a.checkIn !== null
    ).length;
    const late = MOCK_ATTENDANCE_LOGS.filter((a) => a.status === "late").length;
    const absent = MOCK_ATTENDANCE_LOGS.filter(
      (a) =>
        a.status === "absent" ||
        (a.status === "not-checked-in" && new Date().getHours() > 10)
    ).length;

    return { total, present, late, absent };
  }, []);

  // --- 2. LOGIC LỌC BẢNG ---
  const filteredData = useMemo(() => {
    return MOCK_ATTENDANCE_LOGS.filter((item) => {
      const matchStatus =
        filterStatus === "all" || item.status === filterStatus;
      const matchSearch = item.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [filterStatus, searchQuery]);

  // --- 3. HANDLER CHẤM CÔNG NHANH ---
  const handleQuickAction = (type) => {
    if (!quickId) {
      alert("⚠️ Vui lòng chọn nhân viên hoặc nhập mã NV trước!");
      return;
    }
    const actionText = type === "in" ? "VÀO CA" : "TAN CA";
    const timeNow = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Tại đây sẽ gọi API thực tế
    alert(
      `✅ Đã chấm công ${actionText} thành công!\n\n👤 Mã NV: ${quickId}\n⏰ Thời gian: ${timeNow}\n📝 Ghi chú: ${
        quickNote || "Không có"
      }`
    );

    // Reset form sau khi xong
    setQuickId("");
    setQuickNote("");
  };

  // --- HELPER: Status UI ---
  const getStatusBadge = (status) => {
    const config = {
      "on-time": { label: "Đúng giờ", class: "success", icon: "✅" },
      late: { label: "Đi muộn", class: "warning", icon: "⚠️" },
      "early-leave": { label: "Về sớm", class: "warning", icon: "🏃" },
      "not-checked-in": { label: "Chưa vào", class: "neutral", icon: "⏳" },
      absent: { label: "Vắng mặt", class: "danger", icon: "❌" },
    };
    const curr = config[status] || config["not-checked-in"];
    return (
      <span className={`status-badge ${curr.class}`}>
        {curr.icon} {curr.label}
      </span>
    );
  };

  const getAvatarColor = (name) => {
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
    return colors[name.length % colors.length];
  };

  return (
    <div className="attendance-management-page">
      {/* 1. PAGE HEADER */}
      <div className="page-header">
        <div className="header-left">
          <h2 className="page-title">Quản Lý Chấm Công</h2>
          <p className="page-subtitle">
            Theo dõi thời gian làm việc và kỷ luật của nhân sự
          </p>
        </div>
        <div className="header-controls">
          <input
            type="date"
            className="date-picker"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <button className="btn btn-primary">📥 Xuất Excel</button>
        </div>
      </div>

      {/* 2. STATS DASHBOARD */}
      <div className="stats-grid">
        <div className="stat-card total">
          <div className="icon-box">👥</div>
          <div className="info">
            <span className="label">Tổng nhân sự (Ca)</span>
            <span className="value">{stats.total}</span>
          </div>
        </div>
        <div className="stat-card present">
          <div className="icon-box">🟢</div>
          <div className="info">
            <span className="label">Đang có mặt</span>
            <span className="value">{stats.present}</span>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="icon-box">🟠</div>
          <div className="info">
            <span className="label">Đi muộn / Về sớm</span>
            <span className="value">{stats.late}</span>
          </div>
        </div>
        <div className="stat-card danger">
          <div className="icon-box">🔴</div>
          <div className="info">
            <span className="label">Vắng mặt</span>
            <span className="value">{stats.absent}</span>
          </div>
        </div>
      </div>

      {/* 🔥 3. QUICK ACTION SECTION (MỚI) */}
      <div className="quick-action-section">
        <div className="quick-header">
          <div className="icon-flash">⚡</div>
          <div className="text">
            <h4>Chấm Công Thủ Công</h4>
            <p>Dùng khi nhân viên quên thẻ hoặc máy lỗi</p>
          </div>
        </div>

        <div className="quick-form">
          <div className="input-group">
            <label>Chọn nhân viên:</label>
            <select
              value={quickId}
              onChange={(e) => setQuickId(e.target.value)}
              className="quick-select"
            >
              <option value="">-- Tìm theo tên / Mã NV --</option>
              {MOCK_EMPLOYEES_LIST.map((emp) => (
                <option key={emp.id} value={emp.code}>
                  [{emp.code}] {emp.name}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group note-group">
            <label>Ghi chú (Lý do):</label>
            <input
              type="text"
              placeholder="VD: Quên thẻ, Máy lỗi..."
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
            />
          </div>

          <div className="action-buttons">
            <button
              className="btn-quick in"
              onClick={() => handleQuickAction("in")}
            >
              🟢 VÀO CA
            </button>
            <button
              className="btn-quick out"
              onClick={() => handleQuickAction("out")}
            >
              🔴 TAN CA
            </button>
          </div>
        </div>
      </div>

      {/* 4. MAIN TABLE SECTION */}
      <div className="table-section">
        <div className="table-toolbar">
          <div className="tabs">
            {[
              { key: "all", label: "Tất cả" },
              { key: "late", label: "Đi muộn" },
              { key: "early-leave", label: "Về sớm" },
              { key: "not-checked-in", label: "Chưa vào ca" },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`tab-btn ${
                  filterStatus === tab.key ? "active" : ""
                }`}
                onClick={() => setFilterStatus(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Tìm nhân viên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="table-container">
          <table className="attendance-table">
            <thead>
              <tr>
                <th width="25%">Nhân viên</th>
                <th width="15%">Ca làm việc</th>
                <th width="15%">Giờ vào (In)</th>
                <th width="15%">Giờ ra (Out)</th>
                <th width="15%">Trạng thái</th>
                <th width="15%" className="text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="employee-cell">
                      <div
                        className="avatar"
                        style={{
                          backgroundImage: item.avatar
                            ? `url(${item.avatar})`
                            : "none",
                          backgroundColor: !item.avatar
                            ? getAvatarColor(item.name)
                            : "transparent",
                        }}
                      >
                        {!item.avatar && item.name.charAt(0)}
                      </div>
                      <div className="info">
                        <div className="name">{item.name}</div>
                        <div className="role">{item.role}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="shift-badge">{item.shift}</span>
                  </td>
                  <td>
                    <span
                      className={`time-text ${
                        item.checkIn ? "bold" : "placeholder"
                      }`}
                    >
                      {item.checkIn || "--:--"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`time-text ${
                        item.checkOut ? "bold" : "placeholder"
                      }`}
                    >
                      {item.checkOut || "--:--"}
                    </span>
                  </td>
                  <td>{getStatusBadge(item.status)}</td>
                  <td className="text-right">
                    <button className="action-btn edit" title="Chỉnh sửa">
                      ✏️
                    </button>
                    <button className="action-btn detail" title="Lịch sử">
                      📜
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;
