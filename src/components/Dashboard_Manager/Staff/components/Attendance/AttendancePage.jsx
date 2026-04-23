import React, { useMemo, useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import useAttendanceManagement, {
  toAttendanceIsoStartOfDay,
} from "@/hooks/useAttendanceManagement";
import "./Attendance.scss";

const STATUS_TABS = [
  { key: "all", label: "Tất cả" },
  { key: "late", label: "Đi muộn" },
  { key: "early_leave", label: "Về sớm" },
  { key: "scheduled_absent", label: "Vắng theo lịch" },
  { key: "checked_in", label: "Đang trong ca" },
  { key: "unscheduled_checkin", label: "Ngoài lịch" },
];

const AttendancePage = () => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [quickId, setQuickId] = useState("");
  const [quickNote, setQuickNote] = useState("");

  const { user } = useContext(AuthContext);

  const {
    employees,
    records,
    stats,
    loading,
    error,
    refetch,
    mutateQuickAttendance,
    mutationState,
  } = useAttendanceManagement({
    selectedDate,
    status: filterStatus,
    search: searchQuery,
  });

  const selectedEmployee = useMemo(
    () => employees.find((emp) => emp.id === quickId),
    [employees, quickId]
  );

  const effectiveRestaurantId =
    selectedEmployee?.primaryRestaurant?.id ||
    user?.restaurantForStaff ||
    user?.primaryRestaurantId ||
    user?.primaryRestaurant?.id ||
    null;

  const getStatusBadge = (status) => {
    const config = {
      completed: { label: "Đúng ca", class: "success", icon: "✅" },
      checked_in: { label: "Đang làm", class: "neutral", icon: "🟢" },
      late: { label: "Đi muộn", class: "warning", icon: "⚠️" },
      early_leave: { label: "Về sớm", class: "warning", icon: "🏃" },
      late_early_leave: { label: "Muộn & về sớm", class: "warning", icon: "⏱️" },
      scheduled_absent: { label: "Vắng theo lịch", class: "danger", icon: "❌" },
      unscheduled_checkin: { label: "Vào ca ngoài lịch", class: "neutral", icon: "🧭" },
      unscheduled_completed: { label: "Hoàn tất ngoài lịch", class: "neutral", icon: "🧭" },
    };
    const curr = config[status] || { label: status || "--", class: "neutral", icon: "⏳" };
    return (
      <span className={`status-badge ${curr.class}`}>
        {curr.icon} {curr.label}
      </span>
    );
  };

  const getAvatarColor = (name = "?") => {
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
    return colors[name.length % colors.length];
  };

  const formatTime = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  };

  const shiftLabel = (item) => {
    if (item.plannedStartTime && item.plannedEndTime) {
      return `${formatTime(item.plannedStartTime)} - ${formatTime(item.plannedEndTime)}`;
    }
    return item.isOffSchedule ? "Ngoài lịch" : "Chưa phân ca";
  };

  const handleQuickAction = async (type) => {
    if (!quickId) {
      alert("⚠️ Vui lòng chọn nhân viên!");
      return;
    }
    if (!effectiveRestaurantId) {
      alert("❌ Không xác định được nhà hàng để lưu chấm công.");
      return;
    }

    try {
      await mutateQuickAttendance({
        variables: {
          input: {
            employeeId: quickId,
            restaurantId: effectiveRestaurantId,
            action: type === "in" ? "check_in" : "check_out",
            workDate: toAttendanceIsoStartOfDay(selectedDate),
            note: quickNote || undefined,
            source: "quick",
          },
        },
      });
      await refetch();

      const actionText = type === "in" ? "VÀO CA" : "TAN CA";
      alert(`✅ Đã lưu chấm công ${actionText} vào database thành công.`);
      setQuickId("");
      setQuickNote("");
    } catch (err) {
      const message = err?.message || "Không thể lưu chấm công";
      alert(`❌ Lưu chấm công thất bại: ${message}`);
    }
  };

  return (
    <div className="attendance-management-page">
      <div className="page-header">
        <div className="header-left">
          <h2 className="page-title">Quản Lý Chấm Công</h2>
          <p className="page-subtitle">
            Theo dõi thời gian làm việc thực tế và đối chiếu theo lịch phân ca
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

      <div className="stats-grid">
        <div className="stat-card total">
          <div className="icon-box">👥</div>
          <div className="info">
            <span className="label">Tổng nhân sự (ca/ngày)</span>
            <span className="value">{stats.total}</span>
          </div>
        </div>
        <div className="stat-card present">
          <div className="icon-box">🟢</div>
          <div className="info">
            <span className="label">Đang/đã đi làm</span>
            <span className="value">{stats.present}</span>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="icon-box">🟠</div>
          <div className="info">
            <span className="label">Đi muộn / Về sớm</span>
            <span className="value">{stats.lateOrEarly}</span>
          </div>
        </div>
        <div className="stat-card danger">
          <div className="icon-box">🔴</div>
          <div className="info">
            <span className="label">Vắng theo lịch</span>
            <span className="value">{stats.absent}</span>
          </div>
        </div>
      </div>

      <div className="quick-action-section">
        <div className="quick-header">
          <div className="icon-flash">⚡</div>
          <div className="text">
            <h4>Chấm Công Nhanh</h4>
            <p>Lưu trực tiếp vào database và cập nhật đối chiếu lịch làm việc</p>
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
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  [{emp.employeeCode || "--"}] {emp.fullName}
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
              disabled={mutationState.loading}
            >
              🟢 VÀO CA
            </button>
            <button
              className="btn-quick out"
              onClick={() => handleQuickAction("out")}
              disabled={mutationState.loading}
            >
              🔴 TAN CA
            </button>
          </div>
        </div>
      </div>

      <div className="table-section">
        <div className="table-toolbar">
          <div className="tabs">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`tab-btn ${filterStatus === tab.key ? "active" : ""}`}
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

        {error && <div className="empty-state">❌ Không tải được dữ liệu chấm công: {error.message}</div>}

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
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center">
                    Không có bản ghi chấm công cho ngày đã chọn.
                  </td>
                </tr>
              )}

              {records.map((item) => {
                const displayName = item.employeeName || "Chưa có tên";
                const checkInText = formatTime(item.actualCheckInAt);
                const checkOutText = formatTime(item.actualCheckOutAt);
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="employee-cell">
                        <div
                          className="avatar"
                          style={{
                            backgroundImage: item.employeeAvatar
                              ? `url(${item.employeeAvatar})`
                              : "none",
                            backgroundColor: !item.employeeAvatar
                              ? getAvatarColor(displayName)
                              : "transparent",
                          }}
                        >
                          {!item.employeeAvatar && displayName.charAt(0)}
                        </div>
                        <div className="info">
                          <div className="name">{displayName}</div>
                          <div className="role">{item.employeeRole || "--"}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="shift-badge">{shiftLabel(item)}</span>
                    </td>
                    <td>
                      <span className={`time-text ${checkInText ? "bold" : "placeholder"}`}>
                        {checkInText || "--:--"}
                      </span>
                    </td>
                    <td>
                      <span className={`time-text ${checkOutText ? "bold" : "placeholder"}`}>
                        {checkOutText || "--:--"}
                      </span>
                    </td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td className="text-right">
                      <button className="action-btn edit" title="Chỉnh sửa" disabled>
                        ✏️
                      </button>
                      <button className="action-btn detail" title="Lịch sử" disabled>
                        📜
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;
