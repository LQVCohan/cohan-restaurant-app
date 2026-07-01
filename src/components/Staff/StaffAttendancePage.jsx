import React, { useContext, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import "./StaffAttendancePage.scss";

export const STAFF_ATTENDANCE_SELF_SERVICE = gql`
  query StaffAttendanceSelfService(
    $restaurantId: ID!
    $employeeId: ID!
    $startDate: DateTime!
    $endDate: DateTime!
  ) {
    staffAttendanceRecords(
      restaurantId: $restaurantId
      employeeId: $employeeId
      startDate: $startDate
      endDate: $endDate
    ) {
      id
      employeeId
      restaurantId
      workDate
      shiftId
      shiftType
      plannedStartTime
      plannedEndTime
      actualCheckInAt
      actualCheckOutAt
      workedMinutes
      status
      note
    }
    attendanceCorrectionRequests(
      filter: {
        restaurantId: $restaurantId
        employeeId: $employeeId
        startDate: $startDate
        endDate: $endDate
      }
    ) {
      id
      employeeId
      restaurantId
      timesheetId
      shiftId
      workDate
      correctionType
      status
      requestedCheckInAt
      requestedCheckOutAt
      reason
      requestedAt
      createdAt
    }
    overtimeRequests(
      filter: {
        restaurantId: $restaurantId
        employeeId: $employeeId
        startDate: $startDate
        endDate: $endDate
      }
    ) {
      id
      employeeId
      restaurantId
      shiftId
      timesheetId
      workDate
      plannedStartTime
      plannedEndTime
      plannedOvertimeMinutes
      overtimeType
      status
      reason
      requestedAt
      createdAt
    }
  }
`;

export const CREATE_ATTENDANCE_CORRECTION = gql`
  mutation StaffCreateAttendanceCorrection($input: CreateAttendanceCorrectionRequestInput!) {
    createAttendanceCorrectionRequest(input: $input) {
      id
      status
      workDate
      correctionType
      requestedCheckInAt
      requestedCheckOutAt
      reason
      requestedAt
    }
  }
`;

export const CREATE_OVERTIME_REQUEST = gql`
  mutation StaffCreateOvertimeRequest($input: JSON) {
    createOvertimeRequest(input: $input) {
      id
      status
      workDate
      plannedStartTime
      plannedEndTime
      plannedOvertimeMinutes
      overtimeType
      reason
      requestedAt
    }
  }
`;


export const CANCEL_ATTENDANCE_CORRECTION = gql`
  mutation StaffCancelAttendanceCorrection($id: ID!) {
    cancelAttendanceCorrectionRequest(id: $id) {
      id
      status
    }
  }
`;

export const CANCEL_OVERTIME_REQUEST = gql`
  mutation StaffCancelOvertimeRequest($id: ID!) {
    cancelOvertimeRequest(id: $id) {
      id
      status
    }
  }
`;

const correctionTypeOptions = [
  ["missing_check_in", "Thiếu check-in"],
  ["missing_check_out", "Thiếu check-out"],
  ["wrong_check_in", "Sai giờ check-in"],
  ["wrong_check_out", "Sai giờ check-out"],
  ["wrong_check_in_out", "Sai cả vào/ra"],
  ["other", "Khác"],
];

const cancellableStatuses = new Set(["pending", "pending_approval", "pending_employee_confirmation"]);

const overtimeTypeOptions = [
  ["weekday", "Ngày thường"],
  ["weekend", "Cuối tuần"],
  ["holiday", "Ngày lễ"],
  ["night", "Ca đêm"],
  ["other", "Khác"],
];

const pad2 = (value) => String(value).padStart(2, "0");
const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};
const toDayStart = (dateKey) => `${dateKey}T00:00:00.000+07:00`;
const toDayEnd = (dateKey) => `${dateKey}T23:59:59.999+07:00`;
const toLocalDateTime = (dateKey, time) => (dateKey && time ? `${dateKey}T${time}:00.000+07:00` : null);
const toMinutes = (value) => Math.max(0, Math.round(Number(value || 0)));
const resolveId = (value) => {
  if (!value) return "";
  if (typeof value === "object") return String(value.id || value._id || value.restaurantId || "");
  return String(value);
};
const resolveEmployeeId = (user) => String(user?.id || user?._id || user?.userId || "");
const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const getGraphQLErrorMessage = (error, fallback) => error?.graphQLErrors?.[0]?.message || error?.message || fallback;

function StatusPill({ status }) {
  const normalized = String(status || "unknown").toLowerCase();
  return <span className={`staff-attendance-pill staff-attendance-pill--${normalized}`}>{normalized.replaceAll("_", " ")}</span>;
}

export default function StaffAttendancePage() {
  const { user, restaurants } = useContext(AuthContext) || {};
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [correctionType, setCorrectionType] = useState("missing_check_out");
  const [requestedCheckIn, setRequestedCheckIn] = useState("");
  const [requestedCheckOut, setRequestedCheckOut] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [overtimeStart, setOvertimeStart] = useState("");
  const [overtimeEnd, setOvertimeEnd] = useState("");
  const [overtimeType, setOvertimeType] = useState("weekday");
  const [overtimeReason, setOvertimeReason] = useState("");
  const [feedback, setFeedback] = useState(null);

  const restaurantId = resolveId(user?.restaurantForStaff) || resolveId(user?.restaurant) || resolveId(restaurants?.[0]);
  const employeeId = resolveEmployeeId(user);
  const variables = useMemo(
    () => ({ restaurantId, employeeId, startDate: toDayStart(selectedDate), endDate: toDayEnd(selectedDate) }),
    [employeeId, restaurantId, selectedDate],
  );

  const { data, loading, error, refetch } = useQuery(STAFF_ATTENDANCE_SELF_SERVICE, {
    variables,
    fetchPolicy: "cache-and-network",
    skip: !restaurantId || !employeeId || !selectedDate,
  });

  const [createCorrection, correctionState] = useMutation(CREATE_ATTENDANCE_CORRECTION);
  const [createOvertime, overtimeState] = useMutation(CREATE_OVERTIME_REQUEST);
  const [cancelCorrection, cancelCorrectionState] = useMutation(CANCEL_ATTENDANCE_CORRECTION);
  const [cancelOvertime, cancelOvertimeState] = useMutation(CANCEL_OVERTIME_REQUEST);

  const records = data?.staffAttendanceRecords || [];
  const corrections = data?.attendanceCorrectionRequests || [];
  const overtimeRequests = data?.overtimeRequests || [];
  const selectedRecord = records.find((record) => String(record.id) === String(selectedRecordId)) || records[0] || null;

  const stats = useMemo(() => {
    const workedMinutes = records.reduce((sum, record) => sum + toMinutes(record.workedMinutes), 0);
    return {
      shifts: records.length,
      workedHours: Number((workedMinutes / 60).toFixed(2)),
      pendingCorrections: corrections.filter((item) => item.status === "pending").length,
      pendingOvertime: overtimeRequests.filter((item) => ["pending_approval", "pending_employee_confirmation"].includes(item.status)).length,
    };
  }, [corrections, overtimeRequests, records]);

  const submitCorrection = async (event) => {
    event.preventDefault();
    setFeedback(null);
    if (!selectedRecord) {
      setFeedback({ type: "error", message: "Vui lòng chọn ca cần chỉnh công." });
      return;
    }
    try {
      const recordId = String(selectedRecord.id || "");
      const payload = {
        employeeId,
        restaurantId,
        workDate: selectedRecord.workDate || toDayStart(selectedDate),
        shiftId: selectedRecord.shiftId || undefined,
        timesheetId: recordId && !recordId.includes("virtual") ? recordId : undefined,
        correctionType,
        requestedCheckInAt: toLocalDateTime(selectedDate, requestedCheckIn),
        requestedCheckOutAt: toLocalDateTime(selectedDate, requestedCheckOut),
        reason: correctionReason,
      };
      await createCorrection({ variables: { input: payload } });
      setCorrectionReason("");
      setRequestedCheckIn("");
      setRequestedCheckOut("");
      await refetch?.();
      setFeedback({ type: "success", message: "Đã gửi yêu cầu chỉnh công." });
    } catch (submitError) {
      setFeedback({ type: "error", message: getGraphQLErrorMessage(submitError, "Không thể gửi yêu cầu chỉnh công.") });
    }
  };

  const cancelRequest = async (kind, id) => {
    setFeedback(null);
    try {
      if (kind === "correction") {
        await cancelCorrection({ variables: { id } });
      } else {
        await cancelOvertime({ variables: { id } });
      }
      await refetch?.();
      setFeedback({ type: "success", message: "Đã hủy yêu cầu." });
    } catch (cancelError) {
      setFeedback({ type: "error", message: getGraphQLErrorMessage(cancelError, "Không thể hủy yêu cầu.") });
    }
  };

  const submitOvertime = async (event) => {
    event.preventDefault();
    setFeedback(null);
    try {
      const payload = {
        employeeId,
        restaurantId,
        workDate: toDayStart(selectedDate),
        shiftId: selectedRecord?.shiftId || undefined,
        timesheetId: selectedRecord?.id && !String(selectedRecord.id).includes("virtual") ? selectedRecord.id : undefined,
        plannedStartTime: toLocalDateTime(selectedDate, overtimeStart),
        plannedEndTime: toLocalDateTime(selectedDate, overtimeEnd),
        overtimeType,
        reason: overtimeReason,
      };
      await createOvertime({ variables: { input: payload } });
      setOvertimeStart("");
      setOvertimeEnd("");
      setOvertimeReason("");
      await refetch?.();
      setFeedback({ type: "success", message: "Đã gửi yêu cầu tăng ca." });
    } catch (submitError) {
      setFeedback({ type: "error", message: getGraphQLErrorMessage(submitError, "Không thể gửi yêu cầu tăng ca.") });
    }
  };

  if (!restaurantId || !employeeId) {
    return (
      <div className="staff-attendance-page staff-page">
        <div className="staff-attendance-empty" role="status">Không xác định được tài khoản nhân viên hoặc nhà hàng.</div>
      </div>
    );
  }

  return (
    <div className="staff-attendance-page staff-page" aria-labelledby="staff-attendance-title">
      <section className="staff-attendance-hero">
        <div>
          <span className="staff-attendance-badge">Chỉnh công & tăng ca</span>
          <h1 id="staff-attendance-title">Theo dõi công trong ngày</h1>
          <p>Kiểm tra ca đã chấm công, gửi yêu cầu chỉnh công hoặc tăng ca cho quản lý xử lý.</p>
        </div>
        <label className="staff-attendance-date-picker">
          <span>Ngày làm việc</span>
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </label>
      </section>

      <section className="staff-attendance-stats" aria-label="Tóm tắt công trong ngày">
        <article><span>Ca trong ngày</span><strong>{stats.shifts}</strong></article>
        <article><span>Giờ đã ghi nhận</span><strong>{stats.workedHours}</strong></article>
        <article><span>Chỉnh công chờ duyệt</span><strong>{stats.pendingCorrections}</strong></article>
        <article><span>Tăng ca chờ duyệt</span><strong>{stats.pendingOvertime}</strong></article>
      </section>

      {feedback && <div className={`staff-attendance-feedback staff-attendance-feedback--${feedback.type}`} role="status">{feedback.message}</div>}
      {error && <div className="staff-attendance-feedback staff-attendance-feedback--error" role="alert">{getGraphQLErrorMessage(error, "Không tải được dữ liệu công.")}</div>}

      <section className="staff-attendance-grid">
        <article className="staff-attendance-card staff-attendance-card--records">
          <div className="staff-attendance-card__header">
            <div><span>01</span><h2>Ca và công đã ghi nhận</h2></div>
            {loading && <small>Đang tải...</small>}
          </div>
          <div className="staff-attendance-record-list">
            {records.length ? records.map((record) => (
              <button
                type="button"
                className={`staff-attendance-record ${String(selectedRecord?.id) === String(record.id) ? "is-selected" : ""}`}
                key={record.id}
                onClick={() => setSelectedRecordId(record.id)}
              >
                <span>{formatDateTime(record.plannedStartTime)} - {formatDateTime(record.plannedEndTime)}</span>
                <strong>{record.shiftType || "Ca làm"}</strong>
                <small>Vào: {formatDateTime(record.actualCheckInAt)} · Ra: {formatDateTime(record.actualCheckOutAt)}</small>
                <StatusPill status={record.status} />
              </button>
            )) : <div className="staff-attendance-empty" role="status">Chưa có ca/công trong ngày này.</div>}
          </div>
        </article>

        <article className="staff-attendance-card">
          <div className="staff-attendance-card__header"><div><span>02</span><h2>Gửi yêu cầu chỉnh công</h2></div></div>
          <form className="staff-attendance-form" onSubmit={submitCorrection}>
            <label>
              <span>Ca cần chỉnh</span>
              <select value={selectedRecord?.id || ""} onChange={(event) => setSelectedRecordId(event.target.value)} required>
                {records.map((record) => <option value={record.id} key={record.id}>{record.shiftType || "Ca"} · {formatDateTime(record.plannedStartTime)}</option>)}
              </select>
            </label>
            <label>
              <span>Loại chỉnh công</span>
              <select value={correctionType} onChange={(event) => setCorrectionType(event.target.value)}>
                {correctionTypeOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <div className="staff-attendance-form__split">
              <label><span>Giờ vào đề xuất</span><input type="time" value={requestedCheckIn} onChange={(event) => setRequestedCheckIn(event.target.value)} /></label>
              <label><span>Giờ ra đề xuất</span><input type="time" value={requestedCheckOut} onChange={(event) => setRequestedCheckOut(event.target.value)} /></label>
            </div>
            <label>
              <span>Lý do</span>
              <textarea value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Ví dụ: Quên bấm check-out sau ca." required minLength={5} />
            </label>
            <button type="submit" disabled={correctionState.loading || !records.length}>Gửi chỉnh công</button>
          </form>
        </article>

        <article className="staff-attendance-card">
          <div className="staff-attendance-card__header"><div><span>03</span><h2>Gửi yêu cầu tăng ca</h2></div></div>
          <form className="staff-attendance-form" onSubmit={submitOvertime}>
            <div className="staff-attendance-form__split">
              <label><span>Bắt đầu tăng ca</span><input type="time" value={overtimeStart} onChange={(event) => setOvertimeStart(event.target.value)} required /></label>
              <label><span>Kết thúc tăng ca</span><input type="time" value={overtimeEnd} onChange={(event) => setOvertimeEnd(event.target.value)} required /></label>
            </div>
            <label>
              <span>Loại tăng ca</span>
              <select value={overtimeType} onChange={(event) => setOvertimeType(event.target.value)}>
                {overtimeTypeOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>Lý do</span>
              <textarea value={overtimeReason} onChange={(event) => setOvertimeReason(event.target.value)} placeholder="Ví dụ: Hoàn tất dọn ca sau giờ đóng cửa." required minLength={5} />
            </label>
            <button type="submit" disabled={overtimeState.loading}>Gửi tăng ca</button>
          </form>
        </article>
      </section>

      <section className="staff-attendance-history" aria-label="Lịch sử yêu cầu">
        <article className="staff-attendance-card">
          <h2>Lịch sử chỉnh công</h2>
          <div className="staff-attendance-history-list">
            {corrections.length ? corrections.map((item) => (
              <div className="staff-attendance-history-item" key={item.id}>
                <div><strong>{item.correctionType?.replaceAll("_", " ") || "Chỉnh công"}</strong><span>{item.reason}</span></div>
                <div className="staff-attendance-history-actions">
                  <StatusPill status={item.status} />
                  {cancellableStatuses.has(String(item.status || "").toLowerCase()) && (
                    <button type="button" onClick={() => cancelRequest("correction", item.id)} disabled={cancelCorrectionState.loading}>Hủy</button>
                  )}
                </div>
              </div>
            )) : <div className="staff-attendance-empty" role="status">Chưa có yêu cầu chỉnh công.</div>}
          </div>
        </article>
        <article className="staff-attendance-card">
          <h2>Lịch sử tăng ca</h2>
          <div className="staff-attendance-history-list">
            {overtimeRequests.length ? overtimeRequests.map((item) => (
              <div className="staff-attendance-history-item" key={item.id}>
                <div><strong>{item.overtimeType || "Tăng ca"}</strong><span>{item.reason}</span></div>
                <div className="staff-attendance-history-actions">
                  <StatusPill status={item.status} />
                  {cancellableStatuses.has(String(item.status || "").toLowerCase()) && (
                    <button type="button" onClick={() => cancelRequest("overtime", item.id)} disabled={cancelOvertimeState.loading}>Hủy</button>
                  )}
                </div>
              </div>
            )) : <div className="staff-attendance-empty" role="status">Chưa có yêu cầu tăng ca.</div>}
          </div>
        </article>
      </section>
    </div>
  );
}
