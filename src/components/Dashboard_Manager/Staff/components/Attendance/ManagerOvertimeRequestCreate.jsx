import React, { useEffect, useMemo, useState } from "react";
import useAttendanceManagement from "@/hooks/useAttendanceManagement";
import useOvertimeManagement from "@/hooks/useOvertimeManagement";

const CREATE_ROLES = new Set(["admin", "manager", "hr"]);
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

const normalizeRole = (value) => String(value || "").trim().toLowerCase();
const normalizeId = (value) => {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value.id ?? value._id ?? value.restaurantId ?? "").trim();
  }
  return String(value).trim();
};
const getRoleName = (user) =>
  normalizeRole(user?.roleName || user?.role?.slug || user?.userType || user?.role);
const canCreateForEmployee = (user) => CREATE_ROLES.has(getRoleName(user));
const toTimeValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  });
};
const addMinutes = (time, minutes) => {
  if (!/^\d{2}:\d{2}$/.test(time)) return "";
  const [hours, mins] = time.split(":").map(Number);
  const total = (hours * 60 + mins + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
const toLocalDateTime = (dateKey, time) =>
  dateKey && time ? `${dateKey}T${time}:00.000+07:00` : null;
const isVirtualId = (value) => !value || String(value).includes("virtual");

export default function ManagerOvertimeRequestCreate({
  user,
  selectedDate,
  restaurantId,
}) {
  const [open, setOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [overtimeType, setOvertimeType] = useState("weekday");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState(null);

  const effectiveRestaurantId = useMemo(() => {
    const candidate = normalizeId(
      restaurantId || user?.restaurantForStaff || user?.restaurantId,
    );
    return OBJECT_ID_PATTERN.test(candidate) ? candidate : "";
  }, [restaurantId, user?.restaurantForStaff, user?.restaurantId]);

  const { records = [] } = useAttendanceManagement({
    selectedDate,
    status: "all",
    restaurantId: effectiveRestaurantId || undefined,
  });
  const {
    createOvertimeRequest,
    createState = { loading: false },
  } = useOvertimeManagement({
    selectedDate,
    status: "all",
    restaurantId: effectiveRestaurantId || undefined,
  });

  const selectableRecords = useMemo(
    () => records.filter((record) => normalizeId(record?.employeeId)),
    [records],
  );
  const selectedRecord = useMemo(
    () =>
      selectableRecords.find(
        (record) => String(record.id) === String(selectedRecordId),
      ) || selectableRecords[0] || null,
    [selectableRecords, selectedRecordId],
  );

  useEffect(() => {
    if (!selectedRecord) return;
    if (String(selectedRecord.id) !== String(selectedRecordId)) {
      setSelectedRecordId(String(selectedRecord.id));
    }
    const plannedEnd = toTimeValue(selectedRecord.plannedEndTime);
    setStartTime(plannedEnd);
    setEndTime(addMinutes(plannedEnd, 60));
  }, [selectedRecord?.id, selectedRecord?.plannedEndTime]);

  if (!canCreateForEmployee(user)) return null;

  const submit = async (event) => {
    event.preventDefault();
    setFeedback(null);
    if (!selectedRecord || !effectiveRestaurantId) {
      setFeedback({ type: "error", message: "Không có ca nhân viên hợp lệ để tạo đề nghị tăng ca." });
      return;
    }

    try {
      await createOvertimeRequest({
        employeeId: normalizeId(selectedRecord.employeeId),
        restaurantId: effectiveRestaurantId,
        workDate: selectedRecord.workDate || `${selectedDate}T00:00:00.000+07:00`,
        shiftId: normalizeId(selectedRecord.shiftId) || undefined,
        timesheetId: isVirtualId(selectedRecord.id) ? undefined : String(selectedRecord.id),
        plannedStartTime: toLocalDateTime(selectedDate, startTime),
        plannedEndTime: toLocalDateTime(selectedDate, endTime),
        overtimeType,
        reason: reason.trim(),
        employeeConfirmationRequired: true,
      });
      setReason("");
      setOpen(false);
      setFeedback({
        type: "success",
        message: "Đã tạo đề nghị tăng ca. Đang chờ nhân viên xác nhận.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error?.graphQLErrors?.[0]?.message || error?.message || "Không thể tạo đề nghị tăng ca.",
      });
    }
  };

  return (
    <div className="table-section overtime-section manager-overtime-create">
      <div className="section-heading">
        <div>
          <h3>Tạo đề nghị tăng ca cho nhân viên</h3>
          <small>Nhân viên phải xác nhận trước khi quản lý duyệt.</small>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setOpen((value) => !value)}
          disabled={!selectableRecords.length}
        >
          {open ? "Đóng" : "Tạo yêu cầu tăng ca"}
        </button>
      </div>

      {feedback && (
        <div className={`empty-state ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
          {feedback.message}
        </div>
      )}

      {open && (
        <form className="correction-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="form-group full-width">
              <label htmlFor="manager-overtime-employee">Nhân viên / ca làm</label>
              <select
                id="manager-overtime-employee"
                value={selectedRecord?.id || ""}
                onChange={(event) => setSelectedRecordId(event.target.value)}
                required
              >
                {selectableRecords.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.employeeName || "Nhân viên"} · {record.employeeCode || "Chưa có mã"} · {toTimeValue(record.plannedStartTime)}–{toTimeValue(record.plannedEndTime)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="manager-overtime-start">Bắt đầu tăng ca</label>
              <input id="manager-overtime-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="manager-overtime-end">Kết thúc tăng ca</label>
              <input id="manager-overtime-end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="manager-overtime-type">Loại tăng ca</label>
              <select id="manager-overtime-type" value={overtimeType} onChange={(event) => setOvertimeType(event.target.value)}>
                <option value="weekday">Ngày thường</option>
                <option value="weekend">Cuối tuần</option>
                <option value="holiday">Ngày lễ</option>
                <option value="night">Ca đêm</option>
                <option value="other">Khác</option>
              </select>
            </div>
            <div className="form-group full-width">
              <label htmlFor="manager-overtime-reason">Lý do</label>
              <textarea
                id="manager-overtime-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={5}
                required
                placeholder="Nêu lý do cần nhân viên tăng ca..."
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={createState.loading}>
              {createState.loading ? "Đang tạo..." : "Gửi cho nhân viên xác nhận"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
