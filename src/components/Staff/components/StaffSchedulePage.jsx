import React, { useContext, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import "./StaffSchedulePage.scss";

const GET_AVAILABILITY_WINDOWS = gql`
  query StaffAvailabilityWindows($restaurantId: ID!, $from: DateTime, $to: DateTime) {
    availabilityWindows(restaurantId: $restaurantId, from: $from, to: $to) {
      id
      periodStart
      periodEnd
      closeAt
      status
      targetEmploymentTypes
      allowFullTimeUnavailableException
      lateChangeRequiresApproval
    }
  }
`;

const GET_SUBMISSION = gql`
  query StaffAvailabilitySubmission($windowId: ID!, $employeeId: ID!) {
    staffAvailabilitySubmission(windowId: $windowId, employeeId: $employeeId) {
      id
      status
      submissionType
      slots { date shiftType status note }
    }
  }
`;

const SUBMIT = gql`
  mutation SubmitStaffAvailability($input: SubmitStaffAvailabilityInput!) {
    submitStaffAvailability(input: $input) { id status }
  }
`;

const GET_STAFF_SHIFTS = gql`
  query StaffMyShifts($restaurantId: ID, $employeeId: ID, $startDate: DateTime, $endDate: DateTime) {
    staffShifts(restaurantId: $restaurantId, employeeId: $employeeId, startDate: $startDate, endDate: $endDate, limit: 1000) {
      id employeeId shiftType startTime endTime status notes restaurantId
    }
  }
`;

const SHIFT_TYPES = ["morning", "afternoon", "evening", "all_day"];
const SHIFT_LABELS = { morning: "Ca sáng", afternoon: "Ca chiều", evening: "Ca tối", all_day: "Cả ngày" };
const PART_TIME_TYPES = new Set(["part_time", "seasonal"]);

const toDateKey = (value) => new Date(value).toISOString().slice(0, 10);
const fmtDate = (value) => new Date(value).toLocaleDateString("vi-VN");

export default function StaffSchedulePage() {
  const { user, restaurants } = useContext(AuthContext) || {};
  const restaurantId = user?.restaurantForStaff || user?.primaryRestaurant?.id || restaurants?.[0]?.id;
  const employeeId = user?.id;
  const employmentType = String(user?.employmentType || "").toLowerCase();
  const isPartTime = PART_TIME_TYPES.has(employmentType);

  const [weekOffset, setWeekOffset] = useState(0);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + weekOffset * 7);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const { data: windowsData, loading: loadingWindows } = useQuery(GET_AVAILABILITY_WINDOWS, {
    variables: { restaurantId, from: weekStart.toISOString(), to: weekEnd.toISOString() },
    skip: !restaurantId,
  });

  const selectedWindow = useMemo(() => (windowsData?.availabilityWindows || [])[0] || null, [windowsData]);

  const { data: submissionData, refetch: refetchSubmission } = useQuery(GET_SUBMISSION, {
    variables: { windowId: selectedWindow?.id, employeeId },
    skip: !selectedWindow?.id || !employeeId,
  });

  const { data: shiftsData, loading: loadingShifts } = useQuery(GET_STAFF_SHIFTS, {
    variables: { restaurantId, employeeId, startDate: weekStart.toISOString(), endDate: weekEnd.toISOString() },
    skip: !restaurantId || !employeeId,
  });

  const [submit, { loading: submitting }] = useMutation(SUBMIT);
  const [slotsState, setSlotsState] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submission = submissionData?.staffAvailabilitySubmission;
  const submissionMap = useMemo(() => {
    const map = new Map();
    (submission?.slots || []).forEach((slot) => map.set(`${toDateKey(slot.date)}|${slot.shiftType}`, slot));
    return map;
  }, [submission]);

  const windowStatus = String(selectedWindow?.status || "").toLowerCase();
  const canSubmit = windowStatus === "open";
  const isLocked = ["locked", "used_for_schedule"].includes(windowStatus) || ["locked", "used_for_schedule"].includes(String(submission?.status || ""));

  const days = useMemo(() => {
    const result = [];
    for (let i = 0; i < 7; i += 1) { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); result.push(d); }
    return result;
  }, [weekStart.toISOString()]);

  const checked = (date, shiftType) => {
    const key = `${date}|${shiftType}`;
    if (key in slotsState) return slotsState[key];
    const existing = submissionMap.get(key);
    if (!existing) return false;
    return isPartTime ? existing.status === "available" : existing.status === "unavailable";
  };

  const onSubmit = async () => {
    setError(""); setSuccess("");
    try {
      const slots = [];
      days.forEach((d) => {
        const dateIso = d.toISOString();
        const dateKey = toDateKey(d);
        SHIFT_TYPES.forEach((shiftType) => {
          if (checked(dateKey, shiftType)) {
            slots.push({ date: dateIso, shiftType, status: isPartTime ? "available" : "unavailable" });
          }
        });
      });

      const res = await submit({ variables: { input: { availabilityWindowId: selectedWindow.id, employeeId, employmentType, submissionType: isPartTime ? "weekly_availability" : "unavailable_exception", slots } } });
      const resultStatus = res?.data?.submitStaffAvailability?.status;
      if (resultStatus === "late_change_requested") {
        setSuccess("Yêu cầu thay đổi muộn đã được gửi và chờ quản lý duyệt.");
      } else {
        setSuccess("Đã gửi đăng ký availability thành công.");
      }
      refetchSubmission();
    } catch (e) {
      setError(e?.message || "Không thể gửi đăng ký.");
    }
  };

  const shifts = (shiftsData?.staffShifts || []).filter((s) => ["published", "active"].includes(String(s.status || "").toLowerCase()));

  return <div className="staff-schedule-page">
    <h2>Lịch làm việc của tôi</h2>
    <div className="week-nav"><button onClick={() => setWeekOffset((v) => v - 1)}>Tuần trước</button><span>{fmtDate(weekStart)} - {fmtDate(weekEnd)}</span><button onClick={() => setWeekOffset((v) => v + 1)}>Tuần sau</button></div>

    <section className="panel">
      <h3>Đăng ký availability</h3>
      {loadingWindows ? <p>Đang tải kỳ đăng ký...</p> : !selectedWindow ? <p>Chưa có kỳ đăng ký availability cho tuần này.</p> : <>
        <p>Trạng thái: <strong>{windowStatus || "—"}</strong></p>
        {!isPartTime && selectedWindow.allowFullTimeUnavailableException === false && <p>Nhân viên toàn thời gian không cần đăng ký availability tuần. Quản lý hiện không bật báo ca không khả dụng.</p>}
        {(isPartTime || selectedWindow.allowFullTimeUnavailableException) && <div className="slots-grid">
          {days.map((d) => { const dateKey = toDateKey(d); return <div key={dateKey} className="day-card"><h4>{fmtDate(d)}</h4>{SHIFT_TYPES.map((st) => <label key={`${dateKey}|${st}`}><input type="checkbox" disabled={isLocked || submitting || (!canSubmit && windowStatus !== "closed")} checked={checked(dateKey, st)} onChange={() => setSlotsState((prev) => ({ ...prev, [`${dateKey}|${st}`]: !checked(dateKey, st) }))} /> {SHIFT_LABELS[st]}</label>)}</div>; })}
        </div>}
        <p>Trạng thái nộp: <strong>{submission?.status || "not_submitted"}</strong></p>
        {windowStatus === "draft" && <p>Cửa đăng ký đang ở bản nháp, chưa thể gửi.</p>}
        {windowStatus === "cancelled" && <p>Cửa đăng ký đã bị hủy.</p>}
        {windowStatus === "closed" && <p>Kỳ đăng ký đã đóng. Nếu hệ thống cho phép, yêu cầu của bạn sẽ chuyển sang luồng thay đổi muộn.</p>}
        <button disabled={submitting || isLocked || windowStatus === "draft" || windowStatus === "cancelled" || (!isPartTime && !selectedWindow.allowFullTimeUnavailableException)} onClick={onSubmit}>{submission?.id ? "Cập nhật" : "Gửi đăng ký"}</button>
        {success && <p className="success-msg">{success}</p>}
        {error && <p className="error-msg">{error}</p>}
      </>}
    </section>

    <section className="panel">
      <h3>Ca đã được phân công</h3>
      {loadingShifts ? <p>Đang tải lịch...</p> : shifts.length === 0 ? <p>Lịch làm việc tuần này chưa được công bố.</p> : shifts.map((s) => <article key={s.id} className="shift-card"><div>{fmtDate(s.startTime)} • {SHIFT_LABELS[s.shiftType] || s.shiftType}</div><div>{new Date(s.startTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} - {new Date(s.endTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</div><div>Trạng thái: {s.status}</div>{s.notes && <div>Ghi chú: {s.notes}</div>}</article>)}
    </section>
  </div>;
}
