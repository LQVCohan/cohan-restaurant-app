import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AuthContext } from "@/context/AuthContext";
import useAttendanceManagement, {
  toAttendanceIsoStartOfDay,
} from "@/hooks/useAttendanceManagement";
import "./Attendance.scss";
import OvertimePanel from "./OvertimePanel";
import {
  buildCreateCorrectionInput,
  canCancelCorrection,
  canReviewCorrection,
  validateCorrectionRequestForm,
} from "./attendanceCorrectionUtils";
import {
  isForbiddenError,
  isUnauthenticatedError,
} from "@/utils/graphqlErrorUtils";
import { buildAttendanceReconciliationSummary } from "./attendanceReconciliationUtils";


const getRestaurantIdFromUrl = () => {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search || "").get("restaurantId") || "";
};

const MISSED_CHECKOUT_GRACE_MINUTES = 30;

const STATUS_TABS = [
  { key: "all", label: "Tất cả" },
  { key: "late", label: "Đi muộn" },
  { key: "early_leave", label: "Về sớm" },
  { key: "scheduled_absent", label: "No-show / Vắng lịch" },
  { key: "missed_checkout", label: "Thiếu check-out" },
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

export const getAttendanceActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) {
    return "Bạn không có quyền thực hiện thao tác chấm công/chỉnh công này.";
  }
  if (isUnauthenticatedError(error)) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.";
  }
  return fallback;
};

const getAvatarColor = (name = "?") => {
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  return colors[name.length % colors.length];
};

const resolveAttendanceDisplayStatus = (
  record,
  now = new Date(),
  graceMinutes = MISSED_CHECKOUT_GRACE_MINUTES,
) => {
  const storedStatus = String(record?.status || "").toLowerCase();
  if (storedStatus === "missed_checkout") return storedStatus;
  if (
    storedStatus === "checked_in" &&
    record?.actualCheckInAt &&
    !record?.actualCheckOutAt &&
    record?.plannedEndTime &&
    !record?.isOffSchedule
  ) {
    const overdueAt =
      new Date(record.plannedEndTime).getTime() + graceMinutes * 60 * 1000;
    if (Number.isFinite(overdueAt) && overdueAt <= now.getTime()) {
      return "missed_checkout";
    }
  }
  return storedStatus || "--";
};

const getDefaultCorrectionType = (record) => {
  if (!record?.actualCheckInAt) return "missing_check_in";
  if (!record?.actualCheckOutAt) return "missing_check_out";
  return "wrong_check_in_out";
};

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
    completed: { label: "Đúng ca", className: "success", icon: "✅" },
    checked_in: { label: "Đang làm", className: "neutral", icon: "🟢" },
    missed_checkout: {
      label: "Thiếu check-out",
      className: "warning",
      icon: "🟠",
    },
    late: { label: "Đi muộn", className: "warning", icon: "⚠️" },
    early_leave: { label: "Về sớm", className: "warning", icon: "🏃" },
    late_early_leave: {
      label: "Muộn & về sớm",
      className: "warning",
      icon: "⏱️",
    },
    scheduled_absent: {
      label: "No-show / Vắng lịch",
      className: "danger",
      icon: "❌",
    },
    unscheduled_checkin: {
      label: "Vào ca ngoài lịch",
      className: "info",
      icon: "🧭",
    },
    unscheduled_completed: {
      label: "Hoàn tất ngoài lịch",
      className: "info",
      icon: "🧭",
    },
  };
  const current = config[status] || {
    label: status || "--",
    className: "neutral",
    icon: "⏳",
  };

  return (
    <span className={`status-badge ${current.className}`}>
      {current.icon} {current.label}
    </span>
  );
};

const getCorrectionStatusBadge = (status) => {
  const config = {
    pending: { label: "Chờ duyệt", className: "warning", icon: "⏳" },
    approved: { label: "Đã duyệt", className: "info", icon: "✅" },
    applied: { label: "Đã áp dụng", className: "success", icon: "✅" },
    rejected: { label: "Từ chối", className: "danger", icon: "⛔" },
    cancelled: { label: "Đã hủy", className: "neutral", icon: "🚫" },
  };

  const current = config[status] || {
    label: status || "--",
    className: "neutral",
    icon: "•",
  };

  return (
    <span className={`status-badge ${current.className}`}>
      {current.icon} {current.label}
    </span>
  );
};

const formatMinutesValue = (value) => {
  if (value === null || value === undefined || value === "") return "--";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric} phút` : "--";
};

const getOvertimeStatusBadge = (record) => {
  const rawStatus = String(
    record?.overtimeApprovalStatus || "not_required",
  ).toLowerCase();
  const overtimeMinutes = Number(record?.overtimeMinutes || 0);
  const approvedMinutes = Number(record?.approvedOvertimeMinutes || 0);
  const config = {
    pending: {
      label: `Chờ duyệt • ${formatMinutesValue(overtimeMinutes)}`,
      className: "warning",
      icon: "⏳",
    },
    approved: {
      label: `Đã duyệt • ${formatMinutesValue(approvedMinutes)}`,
      className: "success",
      icon: "✅",
    },
    rejected: {
      label: `Từ chối • ${formatMinutesValue(overtimeMinutes)}`,
      className: "danger",
      icon: "⛔",
    },
    not_required: {
      label:
        overtimeMinutes > 0
          ? `Chưa cần duyệt • ${formatMinutesValue(overtimeMinutes)}`
          : "Không tăng ca",
      className: "neutral",
      icon: "•",
    },
  };
  const current = config[rawStatus] || config.not_required;

  return (
    <div className="compact-stack overtime-inline-status">
      <span className={`status-badge ${current.className}`}>
        {current.icon} {current.label}
      </span>
      {record?.overtimeReviewNote && (
        <span className="small-muted">{record.overtimeReviewNote}</span>
      )}
    </div>
  );
};

const renderMetricGroup = (title, values, compareValues = []) => (
  <div className="detail-card metric-card">
    <h4>{title}</h4>
    <dl className="metric-grid">
      {values.map((item, index) => {
        const compareValue = compareValues[index]?.value;
        const isChanged =
          compareValue !== undefined &&
          item.value !== "--" &&
          compareValue !== "--" &&
          item.value !== compareValue;

        return (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd className={isChanged ? "changed-value" : ""}>{item.value}</dd>
          </div>
        );
      })}
    </dl>
  </div>
);

const renderRequestDetails = (request) => {
  const currentMetrics = [
    { label: "Check-in", value: formatDateTime(request.originalCheckInAt) },
    { label: "Check-out", value: formatDateTime(request.originalCheckOutAt) },
    {
      label: "Giờ công",
      value: formatMinutesValue(request.originalWorkedMinutes),
    },
    {
      label: "Đi muộn",
      value: formatMinutesValue(request.originalLatenessMinutes),
    },
    {
      label: "Về sớm",
      value: formatMinutesValue(request.originalEarlyLeaveMinutes),
    },
    {
      label: "Tăng ca",
      value: formatMinutesValue(request.originalOvertimeMinutes),
    },
  ];

  const requestedMetrics = [
    { label: "Check-in", value: formatDateTime(request.requestedCheckInAt) },
    { label: "Check-out", value: formatDateTime(request.requestedCheckOutAt) },
    {
      label: "Giờ công",
      value: formatMinutesValue(request.requestedWorkedMinutes),
    },
    {
      label: "Đi muộn",
      value: formatMinutesValue(request.requestedLatenessMinutes),
    },
    {
      label: "Về sớm",
      value: formatMinutesValue(request.requestedEarlyLeaveMinutes),
    },
    {
      label: "Tăng ca",
      value: formatMinutesValue(request.requestedOvertimeMinutes),
    },
  ];

  return (
    <div className="correction-detail-panel">
      <div className="detail-header">
        <div>
          <strong>{request.employeeName || "--"}</strong>
          <span>{formatDate(request.workDate)}</span>
        </div>
        <div>
          <span>{getCorrectionTypeLabel(request.correctionType)}</span>
          {getCorrectionStatusBadge(request.status)}
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <h4>Thông tin yêu cầu</h4>
          <dl className="detail-list">
            <div>
              <dt>Nhân viên</dt>
              <dd>
                {request.employeeName || "--"}
                {request.employeeCode ? ` • ${request.employeeCode}` : ""}
                {request.employeeRole ? ` • ${request.employeeRole}` : ""}
              </dd>
            </div>
            <div>
              <dt>Người gửi</dt>
              <dd>
                {request.requestedByName || "--"}
                {request.requestedByRole ? ` • ${request.requestedByRole}` : ""}
              </dd>
            </div>
            <div>
              <dt>Ngày công</dt>
              <dd>{formatDate(request.workDate)}</dd>
            </div>
            <div>
              <dt>Gửi lúc</dt>
              <dd>
                {formatDateTime(request.requestedAt || request.createdAt)}
              </dd>
            </div>
            <div>
              <dt>Loại chỉnh công</dt>
              <dd>{getCorrectionTypeLabel(request.correctionType)}</dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>{getCorrectionStatusBadge(request.status)}</dd>
            </div>
          </dl>
        </div>

        <div className="detail-card">
          <h4>Nội dung yêu cầu</h4>
          <div className="detail-copy">
            <div>
              <span className="detail-label">Lý do</span>
              <p>{request.reason || "--"}</p>
            </div>
            <div>
              <span className="detail-label">Ghi chú bằng chứng</span>
              <p>{request.evidenceNote || "--"}</p>
            </div>
            <div>
              <span className="detail-label">Link bằng chứng</span>
              {request.evidenceUrls?.length ? (
                <ul className="evidence-list">
                  {request.evidenceUrls.map((url) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noreferrer">
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>--</p>
              )}
            </div>
          </div>
        </div>

        <div className="comparison-grid detail-card-wide">
          {renderMetricGroup("Giờ hiện tại", currentMetrics, requestedMetrics)}
          {renderMetricGroup("Giờ đề xuất", requestedMetrics, currentMetrics)}
        </div>

        <div className="detail-card detail-card-wide">
          <h4>Trạng thái duyệt</h4>
          <dl className="detail-list detail-list-wide">
            <div>
              <dt>Người review</dt>
              <dd>{request.reviewedByName || "--"}</dd>
            </div>
            <div>
              <dt>Review lúc</dt>
              <dd>{formatDateTime(request.reviewedAt)}</dd>
            </div>
            <div>
              <dt>Ghi chú review</dt>
              <dd>{request.reviewNote || "--"}</dd>
            </div>
            <div>
              <dt>Lý do từ chối</dt>
              <dd>{request.rejectionReason || "--"}</dd>
            </div>
            <div>
              <dt>Người áp dụng</dt>
              <dd>{request.appliedByName || "--"}</dd>
            </div>
            <div>
              <dt>Áp dụng lúc</dt>
              <dd>{formatDateTime(request.appliedAt)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};

const AttendancePage = ({ restaurantId: scopedRestaurantId = "" } = {}) => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [filterStatus, setFilterStatus] = useState("all");
  const [correctionStatus, setCorrectionStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [queryRestaurantId, setQueryRestaurantId] = useState("");
  const [quickId, setQuickId] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [quickFeedback, setQuickFeedback] = useState(null);
  const [activeView, setActiveView] = useState("attendance");
  const [readinessFocus, setReadinessFocus] = useState(null);
  const [scheduleAttendanceFocus, setScheduleAttendanceFocus] = useState(null);
  const [selectedCorrectionRecord, setSelectedCorrectionRecord] =
    useState(null);
  const [correctionForm, setCorrectionForm] = useState(null);
  const [correctionFormErrors, setCorrectionFormErrors] = useState({});
  const [correctionSubmitError, setCorrectionSubmitError] = useState("");
  const [reviewDialog, setReviewDialog] = useState(null);
  const [expandedCorrectionId, setExpandedCorrectionId] = useState(null);

  const { user } = useContext(AuthContext);

  const applyReadinessFocusFromQuery = useCallback(() => {
    const params = new URLSearchParams(window.location.search || "");
    const attendanceTab = params.get("attendanceTab");
    const status = params.get("status");
    const employeeId = params.get("employeeId");
    const restaurantId = params.get("restaurantId");
    const date = params.get("date") || params.get("workDate");
    const search = params.get("search");

    if (attendanceTab || status || employeeId) {
      setReadinessFocus({
        attendanceTab,
        status,
        employeeId,
        correctionStatus: params.get("correctionStatus"),
        offScheduleStatus: params.get("offScheduleStatus"),
        overtimeStatus: params.get("overtimeStatus"),
      });

      if (attendanceTab === "corrections") {
        setActiveView("corrections");
      } else if (attendanceTab === "off_schedule") {
        setActiveView("attendance");
        setFilterStatus("unscheduled_checkin");
      } else if (attendanceTab === "overtime") {
        setActiveView("overtime");
      } else {
        setActiveView("attendance");
      }

      if (status) setFilterStatus(status);
      if (params.get("correctionStatus")) {
        setCorrectionStatus(params.get("correctionStatus"));
      }
    }

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setSelectedDate(date);
    }
    if (search) {
      setSearchQuery(search);
    } else if (employeeId) {
      setSearchQuery(employeeId);
    }
    if (restaurantId) {
      setQueryRestaurantId(restaurantId);
    }

    if (date || employeeId || restaurantId) {
      setScheduleAttendanceFocus({
        date: date || "",
        employeeId: employeeId || "",
        restaurantId: restaurantId || "",
        search: search || "",
      });
    }
  }, []);

  useEffect(() => {
    applyReadinessFocusFromQuery();

    const handleNavigationQuery = (event) => {
      if (event?.detail?.page !== "staff") return;
      if (event?.detail?.query?.staffPage !== "attendance") return;
      applyReadinessFocusFromQuery();
    };

    window.addEventListener("manager:navigation-query", handleNavigationQuery);
    return () =>
      window.removeEventListener(
        "manager:navigation-query",
        handleNavigationQuery,
      );
  }, [applyReadinessFocusFromQuery]);

  const hasScheduleAttendanceFocus = useMemo(
    () =>
      Boolean(
        scheduleAttendanceFocus?.date ||
        scheduleAttendanceFocus?.employeeId ||
        scheduleAttendanceFocus?.restaurantId,
      ),
    [scheduleAttendanceFocus],
  );

  const focusedDate = scheduleAttendanceFocus?.date || "";
  const focusedEmployeeId = scheduleAttendanceFocus?.employeeId || "";
  const focusedRestaurantId = scheduleAttendanceFocus?.restaurantId || "";
  const focusScrollKeyRef = useRef("");

  const clearScheduleAttendanceFocus = useCallback(() => {
    setScheduleAttendanceFocus(null);
    setSearchQuery("");
    setQueryRestaurantId("");

    const params = new URLSearchParams(window.location.search || "");
    params.delete("date");
    params.delete("workDate");
    params.delete("employeeId");
    params.delete("restaurantId");
    params.delete("search");
    params.set("staffPage", "attendance");

    const nextQuery = params.toString();
    const nextUrl = `/manager${nextQuery ? `?${nextQuery}` : ""}#staff`;
    window.history.replaceState(null, "", nextUrl);
  }, []);

  const userRestaurantId = scopedRestaurantId || getRestaurantIdFromUrl() || null;

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
    refreshAttendanceViews,
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
    restaurantId: queryRestaurantId || userRestaurantId,
  });

  const selectedEmployee = useMemo(
    () => employees.find((emp) => emp.id === quickId),
    [employees, quickId],
  );

  const reconciliationSummary = useMemo(
    () => buildAttendanceReconciliationSummary(records),
    [records],
  );
  const focusedAttendanceRecords = useMemo(() => {
    if (!focusedEmployeeId) return [];
    return records.filter(
      (record) => String(record.employeeId) === String(focusedEmployeeId),
    );
  }, [focusedEmployeeId, records]);
  const focusedCorrectionRequests = useMemo(() => {
    if (!focusedEmployeeId) return [];
    return correctionRequests.filter(
      (request) => String(request.employeeId) === String(focusedEmployeeId),
    );
  }, [focusedEmployeeId, correctionRequests]);
  const pendingFocusedCorrections = useMemo(
    () =>
      focusedCorrectionRequests.filter(
        (request) => String(request.status || "").toLowerCase() === "pending",
      ),
    [focusedCorrectionRequests],
  );

  const reconciliationMetrics = [
    { key: "onTime", label: "Đúng lịch", value: reconciliationSummary.onTime },
    { key: "late", label: "Đi muộn", value: reconciliationSummary.late },
    {
      key: "earlyLeave",
      label: "Về sớm",
      value: reconciliationSummary.earlyLeave,
    },
    {
      key: "missedCheckout",
      label: "Thiếu check-out",
      value: reconciliationSummary.missedCheckout,
    },
    { key: "noShow", label: "Vắng lịch", value: reconciliationSummary.noShow },
    {
      key: "offSchedule",
      label: "Ngoài lịch",
      value: reconciliationSummary.offSchedule,
    },
  ];

  const handleReviewFilter = (item) => {
    if (item?.primaryFilter) setFilterStatus(item.primaryFilter);
    setActiveView("attendance");
  };
  const handleFocusAttendanceTable = () => {
    setActiveView("attendance");
    setFilterStatus("all");
    if (focusedEmployeeId) setSearchQuery(focusedEmployeeId);
  };

  const handleFocusCorrections = () => {
    setActiveView("corrections");
    setCorrectionStatus("all");
    if (focusedEmployeeId) setSearchQuery(focusedEmployeeId);
  };

  const handleCreateFocusedCorrection = () => {
    if (focusedAttendanceRecords.length === 1) {
      openCorrectionModal(focusedAttendanceRecords[0]);
    }
  };

  const effectiveRestaurantId =
    queryRestaurantId ||
    userRestaurantId ||
    records[0]?.restaurantId ||
    null;

  const isReviewer = canReviewCorrection(user);
  const isSubmittingCorrection = createCorrectionState.loading;
  const isApproveSubmitting =
    reviewDialog?.mode === "approve" && approveCorrectionState.loading;
  const isRejectSubmitting =
    reviewDialog?.mode === "reject" && rejectCorrectionState.loading;
  const isCancelSubmitting =
    reviewDialog?.mode === "cancel" && cancelCorrectionState.loading;
  const isReviewingCorrection =
    isApproveSubmitting || isRejectSubmitting || isCancelSubmitting;

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
      setQuickFeedback({
        type: "warning",
        message: "Vui lòng chọn nhân viên trước khi chấm công.",
      });
      return;
    }
    if (!effectiveRestaurantId) {
      setQuickFeedback({
        type: "error",
        message: "Không xác định được nhà hàng để lưu chấm công.",
      });
      return;
    }

    setQuickFeedback(null);

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
      setQuickFeedback({
        type: "success",
        message: `Đã lưu chấm công ${actionText} thành công.`,
      });
      setQuickId("");
      setQuickNote("");
    } catch (err) {
      const message = getAttendanceActionErrorMessage(
        err,
        err?.message || "Không thể lưu chấm công",
      );
      setQuickFeedback({
        type: "error",
        message: `Lưu chấm công thất bại: ${message}`,
      });
    }
  };

  const openCorrectionModal = (record) => {
    setSelectedCorrectionRecord(record);
    setCorrectionForm(buildCorrectionInitialForm(record, selectedDate));
    setCorrectionFormErrors({});
    setCorrectionSubmitError("");
  };

  const closeCorrectionModal = () => {
    if (isSubmittingCorrection) return;
    setSelectedCorrectionRecord(null);
    setCorrectionForm(null);
    setCorrectionFormErrors({});
    setCorrectionSubmitError("");
  };

  const updateCorrectionForm = (field, value) => {
    setCorrectionForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    setCorrectionFormErrors((prev) => ({
      ...prev,
      [field]: undefined,
      requestedTime: undefined,
    }));
    setCorrectionSubmitError("");
  };

  const handleSubmitCorrection = async (event) => {
    event.preventDefault();

    if (!selectedCorrectionRecord || !correctionForm) return;

    const restaurantId =
      selectedCorrectionRecord.restaurantId || effectiveRestaurantId || null;

    if (!restaurantId) {
      setCorrectionSubmitError(
        "Không xác định được nhà hàng để tạo yêu cầu chỉnh công.",
      );
      return;
    }

    const requestedCheckInAt = fromDatetimeLocalToIso(
      correctionForm.requestedCheckInAt,
    );
    const requestedCheckOutAt = fromDatetimeLocalToIso(
      correctionForm.requestedCheckOutAt,
    );

    const validationErrors = validateCorrectionRequestForm({
      ...correctionForm,
      requestedCheckInAt,
      requestedCheckOutAt,
    });

    if (Object.keys(validationErrors).length > 0) {
      setCorrectionFormErrors(validationErrors);
      return;
    }

    const input = buildCreateCorrectionInput({
      record: selectedCorrectionRecord,
      form: correctionForm,
      restaurantId,
      workDate: toAttendanceIsoStartOfDay(correctionForm.workDate),
      requestedCheckInAt,
      requestedCheckOutAt,
    });

    try {
      await createAttendanceCorrectionRequest({
        variables: { input },
      });
      await refreshAttendanceViews();

      closeCorrectionModal();
      setActiveView("corrections");
      setCorrectionStatus("pending");
    } catch (err) {
      setCorrectionSubmitError(
        getAttendanceActionErrorMessage(
          err,
          err?.message || "Không thể tạo yêu cầu chỉnh công.",
        ),
      );
    }
  };

  const openReviewDialog = (mode, request) => {
    setReviewDialog({
      mode,
      request,
      note: mode === "approve" ? "Đã kiểm tra và xác nhận." : "",
      reason: "",
      error: "",
    });
  };

  const closeReviewDialog = () => {
    if (isReviewingCorrection) return;
    setReviewDialog(null);
  };

  const updateReviewDialog = (field, value) => {
    setReviewDialog((prev) =>
      prev
        ? {
            ...prev,
            [field]: value,
            error: "",
          }
        : prev,
    );
  };

  const handleSubmitReviewDialog = async (event) => {
    event.preventDefault();

    if (!reviewDialog?.request) return;

    if (reviewDialog.mode === "reject" && !reviewDialog.reason?.trim()) {
      setReviewDialog((prev) => ({
        ...prev,
        error: "Lý do từ chối là bắt buộc.",
      }));
      return;
    }

    try {
      if (reviewDialog.mode === "approve") {
        await approveAttendanceCorrectionRequest({
          variables: {
            input: {
              requestId: reviewDialog.request.id,
              note: reviewDialog.note?.trim() || undefined,
            },
          },
        });
      }

      if (reviewDialog.mode === "reject") {
        await rejectAttendanceCorrectionRequest({
          variables: {
            input: {
              requestId: reviewDialog.request.id,
              reason: reviewDialog.reason.trim(),
            },
          },
        });
      }

      if (reviewDialog.mode === "cancel") {
        await cancelAttendanceCorrectionRequest({
          variables: {
            requestId: reviewDialog.request.id,
          },
        });
      }

      await refreshAttendanceViews();
      closeReviewDialog();
    } catch (err) {
      setReviewDialog((prev) => ({
        ...prev,
        error: getAttendanceActionErrorMessage(
          err,
          err?.message || "Không thể xử lý yêu cầu chỉnh công.",
        ),
      }));
    }
  };

  useEffect(() => {
    if (
      !hasScheduleAttendanceFocus ||
      !focusedEmployeeId ||
      activeView !== "attendance" ||
      records.length === 0
    ) {
      return;
    }

    const scrollKey = `${focusedDate}:${focusedEmployeeId}`;
    if (focusScrollKeyRef.current === scrollKey) return;

    const row = document.querySelector('[data-focused-attendance-row="true"]');
    if (!row) return;

    focusScrollKeyRef.current = scrollKey;
    const runScroll =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (callback) => window.setTimeout(callback, 0);
    runScroll(() => {
      if (typeof row.scrollIntoView === "function") {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }, [
    activeView,
    focusedDate,
    focusedEmployeeId,
    hasScheduleAttendanceFocus,
    records.length,
  ]);

  return (
    <div className="attendance-management-page">
      <div className="page-header">
        <div className="header-left">
          <h2 className="page-title">Quản lý chấm công</h2>
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

      {hasScheduleAttendanceFocus && (
        <div className="attendance-readiness-focus-banner" role="status">
          <strong>Đang xử lý bất thường từ lịch làm việc</strong>
          <div className="focus-meta-grid">
            {focusedDate ? <span>Ngày: {focusedDate}</span> : null}
            <span>Nhân viên: {focusedEmployeeId || searchQuery || "--"}</span>
            {focusedRestaurantId ? (
              <span>Nhà hàng: {focusedRestaurantId}</span>
            ) : null}
            {focusedEmployeeId ? (
              <span>Số bản ghi khớp: {focusedAttendanceRecords.length}</span>
            ) : null}
          </div>
          {focusedEmployeeId && focusedAttendanceRecords.length === 0 && (
            <>
              <p className="focus-hint">
                Chưa tìm thấy bản ghi chấm công khớp nhân viên này trong ngày đã
                chọn.
              </p>
              <p className="focus-hint">
                Có thể nhân viên chưa check-in hoặc bộ lọc nhà hàng/ngày chưa
                đúng.
              </p>
            </>
          )}
          {focusedEmployeeId && focusedAttendanceRecords.length > 1 && (
            <p className="focus-hint">
              Có nhiều bản ghi khớp. Hãy chọn dòng cụ thể trong bảng công.
            </p>
          )}
          {focusedEmployeeId && pendingFocusedCorrections.length > 0 && (
            <span className="focus-pending-badge">
              Đã có {pendingFocusedCorrections.length} yêu cầu chỉnh công chờ
              duyệt
            </span>
          )}
          <div className="focus-actions">
            <button
              type="button"
              className="staff-secondary-btn"
              onClick={handleFocusAttendanceTable}
            >
              Lọc bảng công
            </button>
            <button
              type="button"
              className="staff-secondary-btn"
              onClick={handleCreateFocusedCorrection}
              disabled={focusedAttendanceRecords.length !== 1}
            >
              Tạo yêu cầu chỉnh công
            </button>
            <button
              type="button"
              className={`staff-secondary-btn ${pendingFocusedCorrections.length > 0 ? "focus-corrections-btn" : ""}`}
              onClick={handleFocusCorrections}
            >
              Xem yêu cầu chỉnh công
            </button>
            <button
              type="button"
              className="staff-secondary-btn"
              onClick={clearScheduleAttendanceFocus}
            >
              Xoá bộ lọc từ lịch
            </button>
          </div>
          {focusedEmployeeId && focusedAttendanceRecords.length > 1 && (
            <p className="focus-hint">
              Có nhiều bản ghi khớp, chọn dòng bên dưới để tạo chỉnh công.
            </p>
          )}
          {focusedEmployeeId && focusedAttendanceRecords.length === 0 && (
            <p className="focus-hint">
              Chưa có bản ghi chấm công để tạo chỉnh công.
            </p>
          )}
          {!focusedEmployeeId && (
            <p className="focus-hint">
              Đang hiển thị ngữ cảnh chung theo ngày/nhà hàng từ lịch làm việc.
            </p>
          )}
        </div>
      )}

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
            <span className="label">Chờ duyệt chỉnh công</span>
            <span className="value">{correctionStats.pending}</span>
          </div>
        </div>
      </div>

      <div className="quick-action-section">
        <div className="quick-header">
          <div className="icon-flash">⚡</div>
          <div className="text">
            <h4>Ghi nhận vào ca / tan ca</h4>
            <p>
              Dùng cho thao tác tại quầy quản lý ca. Trường hợp sai giờ, quên
              thẻ hoặc máy lỗi thì tạo yêu cầu chỉnh công để duyệt sau.
            </p>
          </div>
        </div>

        <div className="quick-form">
          <div className="input-group">
            <label>Chọn nhân viên:</label>
            <select
              value={quickId}
              onChange={(event) => {
                setQuickId(event.target.value);
                setQuickFeedback(null);
              }}
              className="quick-select"
            >
              <option value="">Chọn nhân viên đang có mặt tại ca...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  [{emp.employeeCode || "--"}] {emp.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group note-group">
            <label>Lý do / ghi chú ca trực:</label>
            <input
              type="text"
              placeholder="VD: Quên thẻ, đổi ca, máy vân tay lỗi..."
              value={quickNote}
              onChange={(event) => {
                setQuickNote(event.target.value);
                if (quickFeedback?.type !== "success") {
                  setQuickFeedback(null);
                }
              }}
            />
          </div>

          <div className="action-buttons">
            <button
              className="btn-quick in"
              type="button"
              onClick={() => handleQuickAction("in")}
              disabled={mutationState.loading}
              aria-label="Chấm công vào ca cho nhân viên đã chọn"
            >
              🟢 {mutationState.loading ? "Đang lưu..." : "VÀO CA"}
            </button>
            <button
              className="btn-quick out"
              type="button"
              onClick={() => handleQuickAction("out")}
              disabled={mutationState.loading}
              aria-label="Chấm công tan ca cho nhân viên đã chọn"
            >
              🔴 {mutationState.loading ? "Đang lưu..." : "TAN CA"}
            </button>
          </div>

          {quickFeedback && (
            <div
              className={`quick-feedback ${quickFeedback.type}`}
              role={
                quickFeedback.type === "success" ||
                quickFeedback.type === "info"
                  ? "status"
                  : "alert"
              }
            >
              {quickFeedback.message}
            </div>
          )}
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
          Chờ duyệt chỉnh công
          {correctionStats.pending > 0 && (
            <span className="count-badge">{correctionStats.pending}</span>
          )}
        </button>

        <button
          type="button"
          className={activeView === "overtime" ? "active" : ""}
          onClick={() => setActiveView("overtime")}
        >
          Tăng ca
        </button>
      </div>

      {activeView === "attendance" ? (
        <div className="table-section">
          <section
            className={`attendance-reconciliation-panel card tone-${reconciliationSummary.tone}`}
            aria-label="Đối chiếu lịch và công thực tế"
          >
            <header className="attendance-reconciliation-header">
              <div>
                <h3>Đối chiếu lịch & công thực tế</h3>
                <p>
                  So sánh ca dự kiến với giờ vào/ra thực tế trong ngày đã chọn.
                </p>
              </div>
              <span
                className={`reconciliation-score-badge tone-${reconciliationSummary.tone}`}
              >
                {reconciliationSummary.score === null
                  ? "--"
                  : `${reconciliationSummary.score}/100`}{" "}
                • {reconciliationSummary.headline}
              </span>
            </header>
            {reconciliationSummary.total === 0 ? (
              <p className="attendance-reconciliation-empty">
                Chưa có dữ liệu đối chiếu trong ngày này.
              </p>
            ) : (
              <>
                <div className="attendance-reconciliation-metrics">
                  {reconciliationMetrics.map((metric) => (
                    <span key={metric.key} className="reconciliation-chip">
                      <strong>{metric.value}</strong>
                      <span>{metric.label}</span>
                    </span>
                  ))}
                </div>
                {reconciliationSummary.reviewItems.length > 0 && (
                  <div className="attendance-reconciliation-issues">
                    <h4>Điểm cần rà soát nhanh</h4>
                    <ul>
                      {reconciliationSummary.reviewItems.map((item) => (
                        <li
                          key={item.id || `${item.employeeCode}-${item.status}`}
                        >
                          <div>
                            <p className="issue-employee">
                              {item.employeeName}{" "}
                              <span>({item.employeeCode})</span>
                            </p>
                            <p className="issue-meta">
                              {item.reasonLabels.join(" • ")}
                            </p>
                            <p className="issue-meta">
                              Ca dự kiến: {item.plannedTimeLabel} • Thực tế:{" "}
                              {item.actualTimeLabel}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="issue-filter-btn"
                            onClick={() => handleReviewFilter(item)}
                            aria-label={`Lọc bảng công để xem ${item.reasonLabels.join(", ")} của ${item.employeeName}`}
                          >
                            Lọc để xem
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>

          <div className="table-toolbar">
            <div className="tabs">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={`tab-btn ${filterStatus === tab.key ? "active" : ""}`}
                  type="button"
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
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="inline-state error" role="alert">
              ❌ Không tải được dữ liệu chấm công. Vui lòng thử lại.
            </div>
          )}

          {loading && !error && (
            <div className="inline-state loading" aria-live="polite">
              Đang tải dữ liệu chấm công...
            </div>
          )}

          <div className="table-container">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th width="22%">Nhân viên</th>
                  <th width="13%">Ca làm việc</th>
                  <th width="10%">Giờ vào</th>
                  <th width="10%">Giờ ra</th>
                  <th width="13%">Trạng thái</th>
                  <th width="16%">Tăng ca</th>
                  <th width="8%">Nguồn</th>
                  <th width="8%" className="text-right">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {!loading && !error && records.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center">
                      Không có bản ghi chấm công cho ngày đã chọn.
                    </td>
                  </tr>
                )}

                {records.map((item) => {
                  const displayName = item.employeeName || "Chưa có tên";
                  const isFocusedRow =
                    focusedEmployeeId &&
                    String(item.employeeId) === String(focusedEmployeeId);
                  const checkInText = formatTime(item.actualCheckInAt);
                  const checkOutText = formatTime(item.actualCheckOutAt);
                  const displayStatus = resolveAttendanceDisplayStatus(item);

                  return (
                    <tr
                      key={item.id}
                      className={isFocusedRow ? "focused-attendance-row" : ""}
                      data-focused-attendance-row={
                        isFocusedRow ? "true" : undefined
                      }
                    >
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
                            <div className="name">
                              {displayName}
                              {isFocusedRow ? (
                                <span className="focus-source-badge">
                                  Từ lịch
                                </span>
                              ) : null}
                            </div>
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
                          className={`time-text ${checkInText ? "bold" : "placeholder"}`}
                        >
                          {checkInText || "--:--"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`time-text ${checkOutText ? "bold" : "placeholder"}`}
                        >
                          {checkOutText || "--:--"}
                        </span>
                      </td>
                      <td>{getStatusBadge(displayStatus)}</td>
                      <td>{getOvertimeStatusBadge(item)}</td>
                      <td>
                        <span className="source-badge">
                          {item.source === "manual_correction"
                            ? "Chỉnh công"
                            : item.source === "system"
                              ? "Hệ thống"
                              : item.source || "--"}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          className="action-btn correction"
                          aria-label={`Tạo yêu cầu chỉnh công cho ${displayName}`}
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
      ) : activeView === "corrections" ? (
        <div className="table-section correction-section">
          <div className="table-toolbar">
            <div className="tabs">
              {CORRECTION_STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={`tab-btn ${correctionStatus === tab.key ? "active" : ""}`}
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

          <div className="correction-summary-strip">
            <div className="summary-pill warning">
              <span>Chờ duyệt</span>
              <strong>{correctionStats.pending}</strong>
            </div>
            <div className="summary-pill">
              <span>Tổng yêu cầu</span>
              <strong>{correctionStats.total}</strong>
            </div>
            <div className="summary-pill success">
              <span>Đã áp dụng</span>
              <strong>{correctionStats.applied}</strong>
            </div>
            <div className="summary-pill danger">
              <span>Từ chối / Hủy</span>
              <strong>
                {correctionStats.rejected + correctionStats.cancelled}
              </strong>
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
                  <th width="10%">Ngày công</th>
                  <th width="14%">Loại</th>
                  <th width="14%">Người gửi</th>
                  <th width="12%">Gửi lúc</th>
                  <th width="12%">Trạng thái</th>
                  <th width="12%">Tóm tắt</th>
                  <th width="8%" className="text-right">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {!correctionsLoading && correctionRequests.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center">
                      Không có yêu cầu chỉnh công trong ngày đã chọn.
                    </td>
                  </tr>
                )}

                {correctionRequests.map((request) => {
                  const isExpanded = expandedCorrectionId === request.id;
                  const canCancel = canCancelCorrection(user, request);

                  return (
                    <React.Fragment key={request.id}>
                      <tr className={isExpanded ? "expanded-row" : ""}>
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
                        </td>
                        <td>
                          <div className="compact-stack">
                            <strong>{request.requestedByName || "--"}</strong>
                            <span>{request.requestedByRole || "--"}</span>
                          </div>
                        </td>
                        <td>
                          {formatDateTime(
                            request.requestedAt || request.createdAt,
                          )}
                        </td>
                        <td>{getCorrectionStatusBadge(request.status)}</td>
                        <td>
                          <div className="compact-stack">
                            <strong>
                              {formatTime(request.originalCheckInAt) || "--:--"}{" "}
                              →{" "}
                              {formatTime(request.requestedCheckInAt) ||
                                "--:--"}
                            </strong>
                            <span>{request.reason || "--"}</span>
                          </div>
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="action-btn detail"
                            title={isExpanded ? "Ẩn chi tiết" : "Xem chi tiết"}
                            aria-label={`${isExpanded ? "Ẩn" : "Xem"} chi tiết yêu cầu chỉnh công của ${request.employeeName || "nhân viên"}`}
                            onClick={() =>
                              setExpandedCorrectionId((prev) =>
                                prev === request.id ? null : request.id,
                              )
                            }
                          >
                            {isExpanded ? "▴" : "▾"}
                          </button>

                          {request.status === "pending" && isReviewer && (
                            <>
                              <button
                                type="button"
                                className="action-btn approve"
                                title="Duyệt và áp dụng"
                                aria-label={`Duyệt yêu cầu chỉnh công của ${request.employeeName || "nhân viên"}`}
                                disabled={isReviewingCorrection}
                                onClick={() =>
                                  openReviewDialog("approve", request)
                                }
                              >
                                ✅
                              </button>
                              <button
                                type="button"
                                className="action-btn reject"
                                title="Từ chối"
                                aria-label={`Từ chối yêu cầu chỉnh công của ${request.employeeName || "nhân viên"}`}
                                disabled={isReviewingCorrection}
                                onClick={() =>
                                  openReviewDialog("reject", request)
                                }
                              >
                                ⛔
                              </button>
                            </>
                          )}

                          {canCancel && (
                            <button
                              type="button"
                              className="action-btn cancel"
                              title="Hủy yêu cầu"
                              aria-label={`Hủy yêu cầu chỉnh công của ${request.employeeName || "nhân viên"}`}
                              disabled={isReviewingCorrection}
                              onClick={() =>
                                openReviewDialog("cancel", request)
                              }
                            >
                              🚫
                            </button>
                          )}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="correction-detail-row">
                          <td colSpan={8}>{renderRequestDetails(request)}</td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <OvertimePanel
          user={user}
          employees={employees}
          selectedDate={selectedDate}
          searchQuery={searchQuery}
          restaurantId={userRestaurantId}
        />
      )}

      {selectedCorrectionRecord && correctionForm && (
        <div
          className="attendance-modal-overlay"
          onMouseDown={closeCorrectionModal}
        >
          <div
            className="attendance-correction-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendance-correction-title"
            aria-describedby="attendance-correction-desc"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 id="attendance-correction-title">Tạo yêu cầu chỉnh công</h3>
                <p id="attendance-correction-desc">
                  Kiểm tra lại giờ vào/ra trước khi gửi yêu cầu chỉnh công.
                </p>
                <p>
                  Yêu cầu này cần được duyệt trước khi ảnh hưởng đến dữ liệu
                  công.
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Đóng hộp thoại tạo yêu cầu chỉnh công"
                onClick={closeCorrectionModal}
                disabled={isSubmittingCorrection}
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
                  {getStatusBadge(
                    resolveAttendanceDisplayStatus(selectedCorrectionRecord),
                  )}
                </div>
              </div>

              {correctionSubmitError && (
                <div className="form-alert error" role="alert">
                  {correctionSubmitError}
                </div>
              )}

              <div className="form-grid">
                <div className="form-section-heading full-width">
                  Thông tin ca
                </div>
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

                <div className="form-section-heading full-width">
                  Giờ thực tế đề xuất
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
                  {correctionFormErrors.requestedCheckOutAt && (
                    <div className="field-error">
                      {correctionFormErrors.requestedCheckOutAt}
                    </div>
                  )}
                </div>

                {correctionFormErrors.requestedTime && (
                  <div className="form-group full-width">
                    <div className="field-error">
                      {correctionFormErrors.requestedTime}
                    </div>
                  </div>
                )}

                <div className="form-section-heading full-width">
                  Lý do & bằng chứng
                </div>
                <div className="form-group full-width">
                  <label htmlFor="correction-reason">Lý do chỉnh công</label>
                  <textarea
                    id="correction-reason"
                    aria-invalid={Boolean(correctionFormErrors.reason)}
                    aria-describedby="correction-reason-helper correction-reason-error"
                    value={correctionForm.reason}
                    onChange={(event) =>
                      updateCorrectionForm("reason", event.target.value)
                    }
                    placeholder="VD: Nhân viên quên check-out, quản lý đã xác nhận qua camera..."
                    required
                    minLength={5}
                  />
                  <div id="correction-reason-helper" className="field-helper">
                    Nhập lý do đủ rõ để người duyệt có thể đối chiếu.
                  </div>
                  {correctionFormErrors.reason && (
                    <div id="correction-reason-error" className="field-error">
                      {correctionFormErrors.reason}
                    </div>
                  )}
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

      {reviewDialog?.request && (
        <div
          className="attendance-modal-overlay"
          onMouseDown={closeReviewDialog}
        >
          <div
            className="attendance-correction-modal review-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendance-review-title"
            aria-describedby="attendance-review-desc"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 id="attendance-review-title">
                  {reviewDialog.mode === "approve" &&
                    "Duyệt yêu cầu chỉnh công"}
                  {reviewDialog.mode === "reject" &&
                    "Từ chối yêu cầu chỉnh công"}
                  {reviewDialog.mode === "cancel" && "Hủy yêu cầu chỉnh công"}
                </h3>
                <p id="attendance-review-desc">
                  {reviewDialog.request.employeeName || "Nhân viên"} •{" "}
                  {formatDate(reviewDialog.request.workDate)}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Đóng hộp thoại duyệt chỉnh công"
                onClick={closeReviewDialog}
                disabled={isReviewingCorrection}
              >
                ×
              </button>
            </div>

            <form
              className="correction-form"
              onSubmit={handleSubmitReviewDialog}
            >
              <div className="review-summary">
                {renderRequestDetails(reviewDialog.request)}
              </div>

              {reviewDialog.error && (
                <div className="form-alert error" role="alert">
                  {reviewDialog.error}
                </div>
              )}

              <div className={`form-alert review-mode-${reviewDialog.mode}`}>
                {reviewDialog.mode === "approve" &&
                  "Sau khi duyệt, yêu cầu có thể ảnh hưởng đến dữ liệu công thực tế."}
                {reviewDialog.mode === "reject" &&
                  "Yêu cầu sẽ không được áp dụng. Vui lòng nhập lý do từ chối rõ ràng."}
                {reviewDialog.mode === "cancel" &&
                  "Yêu cầu này sẽ bị hủy và không còn khả dụng để duyệt."}
              </div>

              {reviewDialog.mode === "approve" && (
                <div className="form-group full-width">
                  <label>Ghi chú quản lý (không bắt buộc)</label>
                  <textarea
                    value={reviewDialog.note}
                    onChange={(event) =>
                      updateReviewDialog("note", event.target.value)
                    }
                    placeholder="Ghi chú xác nhận hoặc bối cảnh review..."
                  />
                </div>
              )}

              {reviewDialog.mode === "reject" && (
                <div className="form-group full-width">
                  <label>Lý do từ chối</label>
                  <textarea
                    value={reviewDialog.reason}
                    onChange={(event) =>
                      updateReviewDialog("reason", event.target.value)
                    }
                    placeholder="Nêu rõ vì sao yêu cầu chưa thể áp dụng..."
                    aria-invalid={Boolean(
                      reviewDialog.error && !reviewDialog.reason.trim(),
                    )}
                    required
                  />
                </div>
              )}

              {reviewDialog.mode === "cancel" && (
                <div className="form-alert warning">
                  Yêu cầu này sẽ bị hủy và không còn khả dụng để duyệt.
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={closeReviewDialog}
                  disabled={isReviewingCorrection}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className={`btn ${reviewDialog.mode === "reject" ? "btn-danger" : reviewDialog.mode === "cancel" ? "btn-warning" : "btn-primary"}`}
                  disabled={isReviewingCorrection}
                >
                  {reviewDialog.mode === "approve" &&
                    (isApproveSubmitting ? "Đang duyệt..." : "Xác nhận duyệt")}
                  {reviewDialog.mode === "reject" &&
                    (isRejectSubmitting
                      ? "Đang từ chối..."
                      : "Xác nhận từ chối")}
                  {reviewDialog.mode === "cancel" &&
                    (isCancelSubmitting ? "Đang hủy..." : "Xác nhận hủy")}
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
