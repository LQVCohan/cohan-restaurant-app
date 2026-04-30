import React, { useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";

const GET_AVAILABILITY_WINDOWS = gql`
  query StaffAvailabilityWindows($restaurantId: ID!, $from: DateTime, $to: DateTime) {
    availabilityWindows(restaurantId: $restaurantId, from: $from, to: $to) {
      id
      periodStart
      periodEnd
      openAt
      closeAt
      status
      lateChangeRequiresApproval
    }
  }
`;

const GET_STAFF_AVAILABILITY_SUBMISSION = gql`
  query StaffAvailabilitySubmission($windowId: ID!, $employeeId: ID!) {
    staffAvailabilitySubmission(windowId: $windowId, employeeId: $employeeId) {
      id
      availabilityWindowId
      employeeId
      employmentType
      submissionType
      status
      submittedAt
      reviewedAt
      reviewNote
      slots {
        date
        shiftType
        status
        note
      }
    }
  }
`;

const SUBMIT_STAFF_AVAILABILITY = gql`
  mutation SubmitStaffAvailability($input: SubmitStaffAvailabilityInput!) {
    submitStaffAvailability(input: $input) {
      id
      status
      submittedAt
      submissionType
      slots {
        date
        shiftType
        status
        note
      }
    }
  }
`;

const SHIFT_TYPES = ["morning", "afternoon", "evening"];
const PART_TIME_TYPES = new Set(["part_time", "seasonal"]);
const FULL_TIME_TYPES = new Set(["full_time", "probation", "contract"]);

const toDateKey = (value) => new Date(value).toISOString().slice(0, 10);
const formatDate = (value) => new Date(value).toLocaleDateString("vi-VN");
const formatDateTime = (value) => new Date(value).toLocaleString("vi-VN");

const getStatusLabel = (status) => {
  const map = {
    draft: "Chưa nộp",
    submitted: "Đã nộp",
    locked: "Đã khóa",
    late_change_requested: "Chờ duyệt thay đổi muộn",
    approved: "Đã duyệt",
    rejected: "Từ chối",
  };
  return map[status] || "Chưa nộp";
};

export default function StaffAvailabilityRegistration({ user, employmentType, restaurantId }) {
  const normalizedType = String(employmentType || "").toLowerCase();
  const isPartTime = PART_TIME_TYPES.has(normalizedType);
  const isFullTime = FULL_TIME_TYPES.has(normalizedType);

  const now = new Date();
  const to = new Date(now);
  to.setDate(to.getDate() + 28);

  const { data: windowsData, loading: loadingWindows } = useQuery(GET_AVAILABILITY_WINDOWS, {
    variables: { restaurantId, from: now.toISOString(), to: to.toISOString() },
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });

  const selectedWindow = useMemo(() => {
    const rows = windowsData?.availabilityWindows || [];
    return rows
      .slice()
      .sort((a, b) => new Date(a.periodStart) - new Date(b.periodStart))
      .find((row) => new Date(row.periodEnd) >= now) || null;
  }, [now, windowsData?.availabilityWindows]);

  const { data: submissionData, loading: loadingSubmission, refetch } = useQuery(
    GET_STAFF_AVAILABILITY_SUBMISSION,
    {
      variables: { windowId: selectedWindow?.id, employeeId: user?.id },
      skip: !selectedWindow?.id || !user?.id,
      fetchPolicy: "network-only",
    },
  );

  const [submitAvailability, { loading: submitting }] = useMutation(SUBMIT_STAFF_AVAILABILITY);
  const existingSubmission = submissionData?.staffAvailabilitySubmission || null;

  const days = useMemo(() => {
    if (!selectedWindow) return [];
    const start = new Date(selectedWindow.periodStart);
    const end = new Date(selectedWindow.periodEnd);
    const result = [];
    for (const dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      result.push(new Date(dt));
    }
    return result;
  }, [selectedWindow]);

  const defaultMap = useMemo(() => {
    const map = new Map();
    (existingSubmission?.slots || []).forEach((slot) => {
      map.set(`${toDateKey(slot.date)}|${slot.shiftType}`, slot);
    });
    return map;
  }, [existingSubmission?.slots]);

  const [slotState, setSlotState] = useState({});
  const [reasonState, setReasonState] = useState({});

  const isClosed = ["closed", "used_for_schedule"].includes(selectedWindow?.status);
  const canDirectUpdate = selectedWindow?.status === "open" && now <= new Date(selectedWindow.closeAt);

  const toggleSlot = (dateKey, shiftType) => {
    const key = `${dateKey}|${shiftType}`;
    setSlotState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getChecked = (dateKey, shiftType) => {
    const key = `${dateKey}|${shiftType}`;
    if (key in slotState) return slotState[key];
    const server = defaultMap.get(key);
    if (!server) return false;
    return isPartTime ? server.status === "available" : server.status === "unavailable";
  };

  const buildSlotsPayload = () => {
    const payload = [];
    days.forEach((day) => {
      const dateKey = toDateKey(day);
      SHIFT_TYPES.forEach((shiftType) => {
        const checked = getChecked(dateKey, shiftType);
        if (isPartTime && checked) {
          payload.push({ date: day.toISOString(), shiftType, status: "available" });
        }
        if (isFullTime && checked) {
          payload.push({ date: day.toISOString(), shiftType, status: "unavailable", note: reasonState[`${dateKey}|${shiftType}`] || "" });
        }
      });
    });
    return payload;
  };

  const handleSubmit = async (lateChange = false) => {
    const slots = buildSlotsPayload();
    if (isPartTime && slots.length === 0) {
      const confirmed = window.confirm("Bạn chưa tick ca nào. Hệ thống sẽ xem toàn bộ ca là unavailable sau deadline. Tiếp tục nộp?");
      if (!confirmed) return;
    }
    await submitAvailability({
      variables: {
        input: {
          availabilityWindowId: selectedWindow.id,
          employeeId: user.id,
          employmentType: normalizedType,
          submissionType: isPartTime ? "weekly_availability" : "unavailable_exception",
          status: lateChange ? "late_change_requested" : undefined,
          slots,
        },
      },
    });
    await refetch();
  };

  if (!restaurantId) return <div>Không tìm thấy nhà hàng để đăng ký availability.</div>;
  if (loadingWindows || loadingSubmission) return <div>Đang tải kỳ đăng ký availability...</div>;
  if (!selectedWindow) return <div>Chưa có kỳ đăng ký availability cho tuần tới.</div>;

  return (
    <div className="availability-registration-card">
      <h3>Đăng ký lịch làm tuần sau</h3>
      <p>Kỳ đăng ký: {formatDate(selectedWindow.periodStart)} - {formatDate(selectedWindow.periodEnd)}</p>
      <p>Trạng thái cửa đăng ký: <strong>{selectedWindow.status}</strong></p>
      <p>Deadline: {formatDateTime(selectedWindow.closeAt)}</p>
      <p>Employment type: <strong>{normalizedType || "unknown"}</strong></p>
      <p>Trạng thái nộp: <strong>{getStatusLabel(existingSubmission?.status)}</strong></p>

      {isPartTime && <p>Part-time/seasonal: tick các ca bạn có thể làm. Ca không tick sau deadline sẽ tính unavailable.</p>}
      {isFullTime && <p>Full-time/probation/contract: chỉ tick ca/ngày bạn không thể làm và ghi lý do.</p>}

      <div className="availability-grid">
        {days.map((day) => {
          const dateKey = toDateKey(day);
          return (
            <div className="availability-day" key={dateKey}>
              <h4>{formatDate(day)}</h4>
              {SHIFT_TYPES.map((shiftType) => {
                const key = `${dateKey}|${shiftType}`;
                const checked = getChecked(dateKey, shiftType);
                return (
                  <label key={key} className="availability-slot">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isClosed || submitting || (!canDirectUpdate && existingSubmission?.id)}
                      onChange={() => toggleSlot(dateKey, shiftType)}
                    />
                    <span>{shiftType}</span>
                    {isFullTime && checked && (
                      <input
                        type="text"
                        placeholder="Lý do unavailable"
                        value={reasonState[key] || defaultMap.get(key)?.note || ""}
                        disabled={isClosed || submitting || (!canDirectUpdate && existingSubmission?.id)}
                        onChange={(e) => setReasonState((prev) => ({ ...prev, [key]: e.target.value }))}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          );
        })}
      </div>

      {canDirectUpdate ? (
        <button type="button" onClick={() => handleSubmit(false)} disabled={submitting}>
          {existingSubmission?.id ? "Cập nhật đăng ký" : "Nộp đăng ký"}
        </button>
      ) : (
        <button type="button" onClick={() => handleSubmit(true)} disabled={submitting || isClosed}>
          Yêu cầu thay đổi muộn
        </button>
      )}

      {selectedWindow.status === "used_for_schedule" && (
        <p>Kỳ này đã dùng để xếp lịch. Vui lòng dùng leave request hoặc decline shift.</p>
      )}
    </div>
  );
}
