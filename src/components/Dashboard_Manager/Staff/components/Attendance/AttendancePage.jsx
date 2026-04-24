import React, { useContext, useMemo, useState } from "react";
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

const CORRECTION_STATUS_TABS = [
  { key: "all", label: "Tất cả" },
  { key: "pending", label: "Chờ duyệt" },
  { key: "applied", label: "Đã áp dụng" },
  { key: "rejected", label: "Từ chối" },
  { key: "cancelled", label: "Đã hủy" },
];

const CORRECTION_TYPES = [
  { value: "missing_check_in", label: "Quên check-in" },
  { value: "missing_check_out", label: "Quên check-out" },
  { value: "wrong_check_in", label: "Sai giờ check-in" },
  { value: "wrong_check_out", label: "Sai giờ check-out" },
  { value: "wrong_check_in_out", label: "Sai cả check-in/out" },
  { value: "off_schedule_work", label: "Làm ngoài lịch" },
  { value: "other", label: "Khác" },
];

const REVIEW_ROLES = new Set(["admin", "manager", "hr"]);
const STAFF_ROLE = "staff";

const normalizeRole = (value) => String(value || "").toLowerCase();

const getUserId = (user) => user?.id || user?._id || user?.userId || null;

const getRoleName = (user) =>
  normalizeRole(
    user?.roleName || user?.role?.slug || user?.userType || user?.role,
  );

const canReviewCorrection = (user) => REVIEW_ROLES.has(getRoleName(user));

const canCancelCorrection = (user, request) => {
  if (!request || request.status !== "pending") return false;
  if (canReviewCorrection(user)) return true;

  const userId = getUserId(user);
  const roleName = getRoleName(user);

  return (
    roleName === STAFF_ROLE &&
    userId &&
    (String(request.requestedBy || "") === String(userId) ||
      String(request.employeeId || "") === String(userId))
  );
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const toDatetimeLocalValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
};

const fromDatetimeLocalToIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN");
};

const formatTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getCorrectionTypeLabel = (value) =>
  CORRECTION_TYPES.find((item) => item.value === value)?.label || value || "--";

const getAvatarColor = (name = "?") => {
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  return colors[name.length % colors.length];
};

const getDefaultCorrectionType = (record) => {
  if (!record?.actualCheckInAt) return "missing_check_in";
  if (!record?.actualCheckOutAt) return "missing_check_out";
  return "wrong_check_in_out";
};

const hasValidObjectIdLike = (value) =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

const buildCorrectionInitialForm = (record, selectedDate) => ({
  correctionType: getDefaultCorrectionType(record),
  requestedCheckInAt: toDatetimeLocalValue(record?.actualCheckInAt),
  requestedCheckOutAt: toDatetimeLocalValue(record?.actualCheckOutAt),
  reason: "",
  evidenceNote: "",
  evidenceUrlsText: "",
  workDate: toDateInputValue(record?.workDate) || selectedDate,
});

const getStatusBadge = (status) => {
  const config = {
    completed: { label: "Đúng ca", class: "success", icon: "✅" },
    checked_in: { label: "Đang làm", class: "neutral", icon: "🟢" },
    late: { label: "Đi muộn", class: "warning", icon: "⚠️" },
    early_leave: { label: "Về sớm", class: "warning", icon: "🏃" },
    late_early_leave: {
      label: "Muộn & về sớm",
      class: "warning",
      icon: "⏱️",
    },
    scheduled_absent: {
      label: "Vắng theo lịch",
      class: "danger",
      icon: "❌",
    },
    unscheduled_checkin: {
      label: "Vào ca ngoài lịch",
      class: "neutral",
      icon: "🧭",
    },
    unscheduled_completed: {
      label: "Hoàn tất ngoài lịch",
      class: "neutral",
      icon: "🧭",
    },
  };
  const curr = config[status] || {
    label: status || "--",
    class: "neutral",
    icon: "⏳",
  };

  return (
    <span className={`status-badge ${curr.class}`}>
      {curr.icon} {curr.label}
    </span>
  );
};

const getCorrectionStatusBadge = (status) => {
  const config = {
    pending: { label: "Chờ duyệt", class: "warning", icon: "⏳" },
    approved: { label: "Đã duyệt", class: "info", icon: "✅" },
    applied: { label: "Đã áp dụng", class: "success", icon: "✅" },
    rejected: { label: "Từ chối", class: "danger", icon: "⛔" },
    cancelled: { label: "Đã hủy", class: "neutral", icon: "🚫" },
  };

  const curr = config[status] || {
    label: status || "--",
    class: "neutral",
    icon: "•",
  };

  return (
    <span className={`status-badge ${curr.class}`}>
      {curr.icon} {curr.label}
    </span>
  );
};

const AttendancePage = () => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [filterStatus, setFilterStatus] = useState("all");
  const [correctionStatus, setCorrectionStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [quickId, setQuickId] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [activeView, setActiveView] = useState("attendance");
  const [selectedCorrectionRecord, setSelectedCorrectionRecord] =
    useState(null);
  const [correctionForm, setCorrectionForm] = useState(null);

  const { user } = useContext(AuthContext);

  const userRestaurantId =
    user?.restaurantForStaff ||
    user?.primaryRestaurantId ||
    user?.primaryRestaurant?.id ||
    user?.refRestaurants?.[0]?.id ||
    null;

  const {
    employees,
    records,
    correctionRequests,
    stats,
    correctionStats,
    loading,
    error,
    correctionsLoading,
    correctionsError,
    refetch,
    mutateQuickAttendance,
    mutationState,
    createAttendanceCorrectionRequest,
    approveAttendanceCorrectionRequest,
    rejectAttendanceCorrectionRequest,
    cancelAttendanceCorrectionRequest,
    createCorrectionState,
    approveCorrectionState,
    rejectCorrectionState,
    cancelCorrectionState,
  } = useAttendanceManagement({
    selectedDate,
    status: filterStatus,
    correctionStatus,
    search: searchQuery,
    restaurantId: userRestaurantId,
  });

  const selectedEmployee = useMemo(
    () => employees.find((emp) => emp.id === quickId),
    [employees, quickId],
  );

  const effectiveRestaurantId =
    selectedEmployee?.primaryRestaurant?.id ||
    userRestaurantId ||
    records[0]?.restaurantId ||
    null;

  const isReviewer = canReviewCorrection(user);
  const isSubmittingCorrection = createCorrectionState.loading;
  const isReviewingCorrection =
    approveCorrectionState.loading ||
    rejectCorrectionState.loading ||
    cancelCorrectionState.loading;

  const shiftLabel = (item) => {
    if (item.plannedStartTime && item.plannedEndTime) {
      return `${formatTime(item.plannedStartTime)} - ${formatTime(
        item.plannedEndTime,
      )}`;
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
      alert(`✅ Đã lưu chấm công ${actionText} thành công.`);
      setQuickId("");
      setQuickNote("");
    } catch (err) {
      const message = err?.message || "Không thể lưu chấm công";
      alert(`❌ Lưu chấm công thất bại: ${message}`);
    }
  };

  const openCorrectionModal = (record) => {
    setSelectedCorrectionRecord(record);
    setCorrectionForm(buildCorrectionInitialForm(record, selectedDate));
  };

  const closeCorrectionModal = () => {
    setSelectedCorrectionRecord(null);
    setCorrectionForm(null);
  };

  const updateCorrectionForm = (field, value) => {
    setCorrectionForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmitCorrection = async (event) => {
    event.preventDefault();

    if (!selectedCorrectionRecord || !correctionForm) return;

    const restaurantId =
      selectedCorrectionRecord.restaurantId || effectiveRestaurantId || null;

    if (!restaurantId) {
      alert("❌ Không xác định được nhà hàng để tạo yêu cầu chỉnh công.");
      return;
    }

    if (
      !correctionForm.reason?.trim() ||
      correctionForm.reason.trim().length < 5
    ) {
      alert("⚠️ Vui lòng nhập lý do chỉnh công tối thiểu 5 ký tự.");
      return;
    }

    if (
      !correctionForm.requestedCheckInAt &&
      !correctionForm.requestedCheckOutAt
    ) {
      alert("⚠️ Cần nhập ít nhất một giờ check-in hoặc check-out đề xuất.");
      return;
    }

    const requestedCheckInAt = fromDatetimeLocalToIso(
      correctionForm.requestedCheckInAt,
    );
    const requestedCheckOutAt = fromDatetimeLocalToIso(
      correctionForm.requestedCheckOutAt,
    );

    if (
      requestedCheckInAt &&
      requestedCheckOutAt &&
      new Date(requestedCheckOutAt) <= new Date(requestedCheckInAt)
    ) {
      alert("⚠️ Giờ check-out đề xuất phải lớn hơn giờ check-in đề xuất.");
      return;
    }

    const evidenceUrls = correctionForm.evidenceUrlsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    try {
      await createAttendanceCorrectionRequest({
        variables: {
          input: {
            employeeId: selectedCorrectionRecord.employeeId,
            restaurantId,
            timesheetId: hasValidObjectIdLike(selectedCorrectionRecord.id)
              ? selectedCorrectionRecord.id
              : undefined,
            shiftId: selectedCorrectionRecord.shiftId || undefined,
            workDate: toAttendanceIsoStartOfDay(correctionForm.workDate),
            correctionType: correctionForm.correctionType,
            requestedCheckInAt: requestedCheckInAt || undefined,
            requestedCheckOutAt: requestedCheckOutAt || undefined,
            reason: correctionForm.reason.trim(),
            evidenceNote: correctionForm.evidenceNote?.trim() || undefined,
            evidenceUrls,
          },
        },
      });

      alert("✅ Đã gửi yêu cầu chỉnh công.");
      closeCorrectionModal();
      setActiveView("corrections");
      setCorrectionStatus("pending");
    } catch (err) {
      alert(`❌ Không thể tạo yêu cầu chỉnh công: ${err.message}`);
    }
  };

  const handleApproveCorrection = async (request) => {
    const note = window.prompt(
      `Duyệt yêu cầu chỉnh công của ${request.employeeName || "nhân viên"}?`,
      "Đã kiểm tra và xác nhận.",
    );

    if (note === null) return;

    try {
      await approveAttendanceCorrectionRequest({
        variables: {
          input: {
            requestId: request.id,
            note: note || undefined,
          },
        },
      });
      alert("✅ Đã duyệt và áp dụng chỉnh công.");
    } catch (err) {
      alert(`❌ Duyệt chỉnh công thất bại: ${err.message}`);
    }
  };

  const handleRejectCorrection = async (request) => {
    const reason = window.prompt(
      `Nhập lý do từ chối yêu cầu của ${request.employeeName || "nhân viên"}:`,
    );

    if (reason === null) return;
    if (!reason.trim()) {
      alert("⚠️ Lý do từ chối là bắt buộc.");
      return;
    }

    try {
      await rejectAttendanceCorrectionRequest({
        variables: {
          input: {
            requestId: request.id,
            reason: reason.trim(),
          },
        },
      });
      alert("✅ Đã từ chối yêu cầu chỉnh công.");
    } catch (err) {
      alert(`❌ Từ chối yêu cầu thất bại: ${err.message}`);
    }
  };

  const handleCancelCorrection = async (request) => {
    const confirmed = window.confirm(
      "Bạn có chắc muốn hủy yêu cầu chỉnh công này?",
    );
    if (!confirmed) return;

    try {
      await cancelAttendanceCorrectionRequest({
        variables: {
          requestId: request.id,
        },
      });
      alert("✅ Đã hủy yêu cầu chỉnh công.");
    } catch (err) {
      alert(`❌ Hủy yêu cầu thất bại: ${err.message}`);
    }
  };

  return (
    <div className="attendance-management-page">
      <div className="page-header">
        <div className="header-left">
          <h2 className="page-title">Quản Lý Chấm Công</h2>
          <p className="page-subtitle">
            Theo dõi công thực tế, xử lý chỉnh công có kiểm soát và đối chiếu
            trước kỳ lương.
          </p>
        </div>
        <div className="header-controls">
          <input
            type="date"
            className="date-picker"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
          <button className="btn btn-primary" type="button">
            📥 Xuất Excel
          </button>
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
        <div className="stat-card correction">
          <div className="icon-box">📝</div>
          <div className="info">
            <span className="label">Yêu cầu chỉnh công</span>
            <span className="value">{correctionStats.pending}</span>
          </div>
        </div>
      </div>

      <div className="quick-action-section">
        <div className="quick-header">
          <div className="icon-flash">⚡</div>
          <div className="text">
            <h4>Chấm Công Nhanh</h4>
            <p>
              Lưu check-in/check-out trực tiếp. Nếu cần sửa giờ quá khứ, dùng
              yêu cầu chỉnh công.
            </p>
          </div>
        </div>

        <div className="quick-form">
          <div className="input-group">
            <label>Chọn nhân viên:</label>
            <select
              value={quickId}
              onChange={(event) => setQuickId(event.target.value)}
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
            <label>Ghi chú:</label>
            <input
              type="text"
              placeholder="VD: Quên thẻ, máy lỗi..."
              value={quickNote}
              onChange={(event) => setQuickNote(event.target.value)}
            />
          </div>

          <div className="action-buttons">
            <button
              className="btn-quick in"
              type="button"
              onClick={() => handleQuickAction("in")}
              disabled={mutationState.loading}
            >
              🟢 VÀO CA
            </button>
            <button
              className="btn-quick out"
              type="button"
              onClick={() => handleQuickAction("out")}
              disabled={mutationState.loading}
            >
              🔴 TAN CA
            </button>
          </div>
        </div>
      </div>

      <div className="attendance-view-switch">
        <button
          type="button"
          className={activeView === "attendance" ? "active" : ""}
          onClick={() => setActiveView("attendance")}
        >
          Bảng công
        </button>
        <button
          type="button"
          className={activeView === "corrections" ? "active" : ""}
          onClick={() => setActiveView("corrections")}
        >
          Yêu cầu chỉnh công
          {correctionStats.pending > 0 && (
            <span className="count-badge">{correctionStats.pending}</span>
          )}
        </button>
      </div>

      {activeView === "attendance" ? (
        <div className="table-section">
          <div className="table-toolbar">
            <div className="tabs">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={`tab-btn ${
                    filterStatus === tab.key ? "active" : ""
                  }`}
                  onClick={() => setFilterStatus(tab.key)}
                  type="button"
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
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="empty-state">
              ❌ Không tải được dữ liệu chấm công: {error.message}
            </div>
          )}

          <div className="table-container">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th width="24%">Nhân viên</th>
                  <th width="14%">Ca làm việc</th>
                  <th width="12%">Giờ vào</th>
                  <th width="12%">Giờ ra</th>
                  <th width="14%">Trạng thái</th>
                  <th width="10%">Nguồn</th>
                  <th width="14%" className="text-right">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {!loading && records.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center">
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
                            <div className="role">
                              {item.employeeCode || "--"} •{" "}
                              {item.employeeRole || "--"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="shift-badge">{shiftLabel(item)}</span>
                      </td>
                      <td>
                        <span
                          className={`time-text ${
                            checkInText ? "bold" : "placeholder"
                          }`}
                        >
                          {checkInText || "--:--"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`time-text ${
                            checkOutText ? "bold" : "placeholder"
                          }`}
                        >
                          {checkOutText || "--:--"}
                        </span>
                      </td>
                      <td>{getStatusBadge(item.status)}</td>
                      <td>
                        <span className="source-badge">
                          {item.source === "manual_correction"
                            ? "Chỉnh công"
                            : item.source || "--"}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          className="action-btn correction"
                          title="Tạo yêu cầu chỉnh công"
                          type="button"
                          onClick={() => openCorrectionModal(item)}
                        >
                          📝
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="table-section correction-section">
          <div className="table-toolbar">
            <div className="tabs">
              {CORRECTION_STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={`tab-btn ${
                    correctionStatus === tab.key ? "active" : ""
                  }`}
                  type="button"
                  onClick={() => setCorrectionStatus(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="search-box">
              <input
                type="text"
                placeholder="🔍 Tìm nhân viên / lý do..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>

          {correctionsError && (
            <div className="empty-state">
              ❌ Không tải được yêu cầu chỉnh công: {correctionsError.message}
            </div>
          )}

          <div className="table-container">
            <table className="attendance-table correction-table">
              <thead>
                <tr>
                  <th width="18%">Nhân viên</th>
                  <th width="12%">Ngày</th>
                  <th width="15%">Loại</th>
                  <th width="18%">Giờ cũ</th>
                  <th width="18%">Giờ đề xuất</th>
                  <th width="11%">Trạng thái</th>
                  <th width="8%" className="text-right">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {!correctionsLoading && correctionRequests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center">
                      Không có yêu cầu chỉnh công trong ngày đã chọn.
                    </td>
                  </tr>
                )}

                {correctionRequests.map((request) => {
                  return (
                    <tr key={request.id}>
                      <td>
                        <div className="employee-cell">
                          <div
                            className="avatar"
                            style={{
                              backgroundImage: request.employeeAvatar
                                ? `url(${request.employeeAvatar})`
                                : "none",
                              backgroundColor: !request.employeeAvatar
                                ? getAvatarColor(request.employeeName || "?")
                                : "transparent",
                            }}
                          >
                            {!request.employeeAvatar &&
                              (request.employeeName || "?").charAt(0)}
                          </div>
                          <div className="info">
                            <div className="name">
                              {request.employeeName || "--"}
                            </div>
                            <div className="role">
                              {request.employeeCode || "--"} •{" "}
                              {request.employeeRole || "--"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{formatDate(request.workDate)}</td>
                      <td>
                        <span className="shift-badge">
                          {getCorrectionTypeLabel(request.correctionType)}
                        </span>
                        <div className="correction-reason">
                          {request.reason}
                        </div>
                      </td>
                      <td>
                        <div className="time-diff">
                          <span>
                            Vào:{" "}
                            {formatTime(request.originalCheckInAt) || "--:--"}
                          </span>
                          <span>
                            Ra:{" "}
                            {formatTime(request.originalCheckOutAt) || "--:--"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="time-diff proposed">
                          <span>
                            Vào:{" "}
                            {formatTime(request.requestedCheckInAt) || "--:--"}
                          </span>
                          <span>
                            Ra:{" "}
                            {formatTime(request.requestedCheckOutAt) || "--:--"}
                          </span>
                        </div>
                      </td>
                      <td>
                        {getCorrectionStatusBadge(request.status)}
                        <div className="small-muted">
                          {request.requestedByName
                            ? `Gửi bởi ${request.requestedByName}`
                            : formatDateTime(request.requestedAt)}
                        </div>
                      </td>
                      <td className="text-right">
                        {request.status === "pending" && isReviewer && (
                          <>
                            <button
                              type="button"
                              className="action-btn approve"
                              title="Duyệt và áp dụng"
                              disabled={isReviewingCorrection}
                              onClick={() => handleApproveCorrection(request)}
                            >
                              ✅
                            </button>
                            <button
                              type="button"
                              className="action-btn reject"
                              title="Từ chối"
                              disabled={isReviewingCorrection}
                              onClick={() => handleRejectCorrection(request)}
                            >
                              ⛔
                            </button>
                          </>
                        )}

                        {canCancelCorrection(user, request) && (
                          <button
                            type="button"
                            className="action-btn cancel"
                            title="Hủy yêu cầu"
                            disabled={isReviewingCorrection}
                            onClick={() => handleCancelCorrection(request)}
                          >
                            🚫
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedCorrectionRecord && correctionForm && (
        <div
          className="attendance-modal-overlay"
          onMouseDown={closeCorrectionModal}
        >
          <div
            className="attendance-correction-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>Tạo yêu cầu chỉnh công</h3>
                <p>
                  {selectedCorrectionRecord.employeeName || "Nhân viên"} •{" "}
                  {formatDate(selectedCorrectionRecord.workDate)}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeCorrectionModal}
              >
                ×
              </button>
            </div>

            <form className="correction-form" onSubmit={handleSubmitCorrection}>
              <div className="current-record-box">
                <div>
                  <span className="label">Ca làm</span>
                  <strong>{shiftLabel(selectedCorrectionRecord)}</strong>
                </div>
                <div>
                  <span className="label">Check-in hiện tại</span>
                  <strong>
                    {formatTime(selectedCorrectionRecord.actualCheckInAt) ||
                      "--:--"}
                  </strong>
                </div>
                <div>
                  <span className="label">Check-out hiện tại</span>
                  <strong>
                    {formatTime(selectedCorrectionRecord.actualCheckOutAt) ||
                      "--:--"}
                  </strong>
                </div>
                <div>
                  <span className="label">Trạng thái</span>
                  {getStatusBadge(selectedCorrectionRecord.status)}
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Ngày công</label>
                  <input
                    type="date"
                    value={correctionForm.workDate}
                    onChange={(event) =>
                      updateCorrectionForm("workDate", event.target.value)
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Loại chỉnh công</label>
                  <select
                    value={correctionForm.correctionType}
                    onChange={(event) =>
                      updateCorrectionForm("correctionType", event.target.value)
                    }
                    required
                  >
                    {CORRECTION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Check-in đề xuất</label>
                  <input
                    type="datetime-local"
                    value={correctionForm.requestedCheckInAt}
                    onChange={(event) =>
                      updateCorrectionForm(
                        "requestedCheckInAt",
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Check-out đề xuất</label>
                  <input
                    type="datetime-local"
                    value={correctionForm.requestedCheckOutAt}
                    onChange={(event) =>
                      updateCorrectionForm(
                        "requestedCheckOutAt",
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="form-group full-width">
                  <label>Lý do chỉnh công</label>
                  <textarea
                    value={correctionForm.reason}
                    onChange={(event) =>
                      updateCorrectionForm("reason", event.target.value)
                    }
                    placeholder="VD: Nhân viên quên check-out, quản lý đã xác nhận qua camera..."
                    required
                    minLength={5}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Ghi chú bằng chứng</label>
                  <input
                    type="text"
                    value={correctionForm.evidenceNote}
                    onChange={(event) =>
                      updateCorrectionForm("evidenceNote", event.target.value)
                    }
                    placeholder="VD: Camera khu vực bếp, xác nhận từ trưởng ca..."
                  />
                </div>

                <div className="form-group full-width">
                  <label>Link bằng chứng, mỗi dòng một link</label>
                  <textarea
                    value={correctionForm.evidenceUrlsText}
                    onChange={(event) =>
                      updateCorrectionForm(
                        "evidenceUrlsText",
                        event.target.value,
                      )
                    }
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={closeCorrectionModal}
                  disabled={isSubmittingCorrection}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingCorrection}
                >
                  {isSubmittingCorrection
                    ? "Đang gửi..."
                    : "Gửi yêu cầu chỉnh công"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
