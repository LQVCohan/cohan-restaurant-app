import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import {
  CheckCircle2,
  AlertTriangle,
  CalendarCheck2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Info,
  Loader2,
  LockKeyhole,
  Moon,
  Send,
  Sparkles,
  Sun,
  Sunrise,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import "./StaffSchedulePage.scss";

const GET_AVAILABILITY_WINDOWS = gql`
  query StaffAvailabilityWindows(
    $restaurantId: ID!
    $from: DateTime
    $to: DateTime
  ) {
    availabilityWindows(restaurantId: $restaurantId, from: $from, to: $to) {
      id
      periodStart
      periodEnd
      openAt
      closeAt
      status
      effectiveStatus
      registrationMode
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
      slots {
        date
        shiftType
        status
        note
      }
    }
  }
`;

const SUBMIT = gql`
  mutation SubmitStaffAvailability($input: SubmitStaffAvailabilityInput!) {
    submitStaffAvailability(input: $input) {
      id
      status
    }
  }
`;

const GET_MY_SCHEDULE_ACK = gql`
  query MyScheduleAck($restaurantId: ID!, $periodStart: DateTime!, $periodEnd: DateTime!) {
    myScheduleAcknowledgement(restaurantId: $restaurantId, periodStart: $periodStart, periodEnd: $periodEnd) {
      id
      status
      acknowledgedAt
      changedAfterAcknowledgement
    }
  }
`;

const ACK_MY_SCHEDULE = gql`
  mutation AckMySchedule($restaurantId: ID!, $periodStart: DateTime!, $periodEnd: DateTime!) {
    acknowledgeMySchedule(restaurantId: $restaurantId, periodStart: $periodStart, periodEnd: $periodEnd) {
      id
      status
      acknowledgedAt
      changedAfterAcknowledgement
    }
  }
`;

const GET_STAFF_SHIFTS = gql`
  query StaffMyShifts(
    $restaurantId: ID
    $employeeId: ID
    $startDate: DateTime
    $endDate: DateTime
  ) {
    staffShifts(
      restaurantId: $restaurantId
      employeeId: $employeeId
      startDate: $startDate
      endDate: $endDate
      limit: 1000
    ) {
      id
      employeeId
      shiftType
      startTime
      endTime
      status
      notes
      restaurantId
    }
  }
`;

const SHIFT_TYPES = ["morning", "afternoon", "evening"];

const SHIFT_META = {
  morning: {
    label: "Ca sáng",
    shortLabel: "Sáng",
    timeHint: "06:00 - 12:00",
    icon: Sunrise,
  },
  afternoon: {
    label: "Ca chiều",
    shortLabel: "Chiều",
    timeHint: "12:00 - 18:00",
    icon: Sun,
  },
  evening: {
    label: "Ca tối",
    shortLabel: "Tối",
    timeHint: "18:00 - 23:00",
    icon: Moon,
  },
  full_day: {
    label: "Cả ngày",
    shortLabel: "Cả ngày",
    timeHint: "Theo lịch",
    icon: CalendarDays,
  },
  all_day: {
    label: "Cả ngày",
    shortLabel: "Cả ngày",
    timeHint: "Theo lịch",
    icon: CalendarDays,
  },
};

const WINDOW_STATUS_LABELS = {
  draft: "Bản nháp",
  open: "Đang mở",
  closed: "Đã đóng",
  cancelled: "Đã hủy",
};

const SUBMISSION_STATUS_LABELS = {
  not_submitted: "Chưa gửi",
  submitted: "Đã gửi",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
  locked: "Đã khóa",
  late_change_requested: "Chờ duyệt thay đổi muộn",
  used_for_schedule: "Đã dùng để xếp lịch",
};

const EMPLOYMENT_TYPE_LABELS = {
  full_time: "Toàn thời gian",
  part_time: "Bán thời gian",
  seasonal: "Thời vụ",
  contract: "Hợp đồng",
  probation: "Thử việc",
};

const PART_TIME_TYPES = new Set(["part_time", "seasonal"]);

const pad2 = (value) => String(value).padStart(2, "0");

const toLocalDateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join("-");
};
const toDateKey = toLocalDateKey;

const fmtDate = (value, options) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(
    "vi-VN",
    options || {
      day: "2-digit",
      month: "2-digit",
    },
  );
};

const fmtFullDate = (value) =>
  fmtDate(value, {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

const fmtTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";

  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getWeekRangeLabel = (start, end) =>
  `${fmtDate(start, { day: "2-digit", month: "2-digit" })} - ${fmtDate(end, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })}`;

const getGraphQLErrorMessage = (error, fallback = "Đã xảy ra lỗi.") => {
  const graphQLError =
    error?.graphQLErrors?.[0]?.message ||
    error?.networkError?.result?.errors?.[0]?.message ||
    error?.cause?.message ||
    "";
  return graphQLError || error?.message || fallback;
};

const addDaysLocal = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const resolveId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.id || value._id || "";
};

const buildWeekRange = (weekOffset) => {
  const now = new Date();

  // Project scheduling uses Monday -> Sunday weeks.
  // JS getDay(): Sunday = 0, Monday = 1, ..., Saturday = 6.
  const dayIndex = now.getDay();
  const daysFromMonday = dayIndex === 0 ? 6 : dayIndex - 1;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysFromMonday + weekOffset * 7);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
};

const getWindowTone = (status) => {
  if (status === "open") return "good";
  if (status === "closed") return "warning";
  if (status === "cancelled") return "danger";
  return "muted";
};

const getSubmissionTone = (status) => {
  if (["submitted", "approved"].includes(status)) return "good";
  if (status === "late_change_requested") return "warning";
  if (status === "rejected") return "danger";
  if (["locked", "used_for_schedule"].includes(status)) return "locked";
  return "muted";
};

export default function StaffSchedulePage() {
  const { user, restaurants } = useContext(AuthContext) || {};

  const restaurantId =
    resolveId(user?.restaurantForStaff) ||
    resolveId(user?.primaryRestaurant) ||
    resolveId(restaurants?.[0]);

  const employeeId = user?.id;
  const employmentType = String(user?.employmentType || "").toLowerCase();
  const employmentTypeLabel =
    EMPLOYMENT_TYPE_LABELS[employmentType] || "Nhân viên";

  const isPartTime = PART_TIME_TYPES.has(employmentType);

  const [weekOffset, setWeekOffset] = useState(0);
  const [slotsState, setSlotsState] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const lastAvailabilityQueryKeyRef = useRef("");
  const lastShiftsQueryKeyRef = useRef("");

  const { weekStart, weekEnd, availabilityTargetStart, availabilityTargetEnd } =
    useMemo(() => {
      const range = buildWeekRange(weekOffset);

      return {
        ...range,
        // Staff availability follows manager-side "nextWeek" registration mode.
        availabilityTargetStart: addDaysLocal(range.weekStart, 7),
        availabilityTargetEnd: addDaysLocal(range.weekEnd, 7),
      };
    }, [weekOffset]);

  const weekStartIso = weekStart.toISOString();
  const weekEndIso = weekEnd.toISOString();

  const availabilityTargetStartIso = availabilityTargetStart.toISOString();
  const availabilityTargetEndIso = availabilityTargetEnd.toISOString();
  const availabilityQueryFromIso = addDaysLocal(
    availabilityTargetStart,
    -1,
  ).toISOString();
  const availabilityQueryToIso = addDaysLocal(
    availabilityTargetEnd,
    1,
  ).toISOString();
  const availabilityQueryKey = [
    restaurantId || "",
    availabilityQueryFromIso || "",
    availabilityQueryToIso || "",
  ].join("|");
  const shiftsQueryKey = [
    restaurantId || "",
    employeeId || "",
    weekStartIso || "",
    weekEndIso || "",
  ].join("|");
  const availabilityTargetStartKey = toLocalDateKey(availabilityTargetStart);
  const availabilityTargetEndKey = toLocalDateKey(availabilityTargetEnd);

  const availabilityTargetRangeLabel = getWeekRangeLabel(
    availabilityTargetStart,
    availabilityTargetEnd,
  );
  const [
    loadAvailabilityWindows,
    { data: windowsData, loading: loadingWindows, error: windowsError },
  ] = useLazyQuery(GET_AVAILABILITY_WINDOWS, {
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  const selectedWindow = useMemo(() => {
    const windows = windowsData?.availabilityWindows || [];

    return (
      windows.find((window) => {
        return (
          toLocalDateKey(window.periodStart) === availabilityTargetStartKey &&
          toLocalDateKey(window.periodEnd) === availabilityTargetEndKey
        );
      }) || null
    );
  }, [windowsData, availabilityTargetStartKey, availabilityTargetEndKey]);
  const {
    data: submissionData,
    loading: loadingSubmission,
    refetch: refetchSubmission,
  } = useQuery(GET_SUBMISSION, {
    variables: {
      windowId: selectedWindow?.id,
      employeeId,
    },
    skip: !selectedWindow?.id || !employeeId,
    fetchPolicy: "network-only",
  });

  const [
    loadStaffShifts,
    { data: shiftsData, loading: loadingShifts, error: shiftsError },
  ] = useLazyQuery(GET_STAFF_SHIFTS, {
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  const [submit, { loading: submitting }] = useMutation(SUBMIT);
  const { data: myAckData, loading: ackLoading, refetch: refetchAck } = useQuery(GET_MY_SCHEDULE_ACK, {
    variables: { restaurantId, periodStart: weekStartIso, periodEnd: weekEndIso },
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });
  const [ackMySchedule, { loading: acking }] = useMutation(ACK_MY_SCHEDULE);

  useEffect(() => {
    if (!restaurantId || !availabilityQueryFromIso || !availabilityQueryToIso) {
      lastAvailabilityQueryKeyRef.current = "";
      return;
    }

    if (lastAvailabilityQueryKeyRef.current === availabilityQueryKey) {
      return;
    }

    lastAvailabilityQueryKeyRef.current = availabilityQueryKey;

    loadAvailabilityWindows({
      variables: {
        restaurantId,
        from: availabilityQueryFromIso,
        to: availabilityQueryToIso,
      },
    }).catch(() => {
      lastAvailabilityQueryKeyRef.current = "";
    });
  }, [
    restaurantId,
    availabilityQueryFromIso,
    availabilityQueryToIso,
    availabilityQueryKey,
    loadAvailabilityWindows,
  ]);

  useEffect(() => {
    if (!restaurantId || !employeeId || !weekStartIso || !weekEndIso) {
      lastShiftsQueryKeyRef.current = "";
      return;
    }

    if (lastShiftsQueryKeyRef.current === shiftsQueryKey) {
      return;
    }

    lastShiftsQueryKeyRef.current = shiftsQueryKey;

    loadStaffShifts({
      variables: {
        restaurantId,
        employeeId,
        startDate: weekStartIso,
        endDate: weekEndIso,
      },
    }).catch(() => {
      lastShiftsQueryKeyRef.current = "";
    });
  }, [
    restaurantId,
    employeeId,
    weekStartIso,
    weekEndIso,
    shiftsQueryKey,
    loadStaffShifts,
  ]);

  useEffect(() => {
    setSlotsState({});
    setError("");
    setSuccess("");
  }, [availabilityTargetStartIso, availabilityTargetEndIso]);

  const submission = submissionData?.staffAvailabilitySubmission;

  const submissionMap = useMemo(() => {
    const map = new Map();

    (submission?.slots || []).forEach((slot) => {
      map.set(`${toDateKey(slot.date)}|${slot.shiftType}`, slot);
    });

    return map;
  }, [submission]);

  const windowStatus = String(selectedWindow?.status || "").toLowerCase();
  const submissionStatus = String(
    submission?.status || "not_submitted",
  ).toLowerCase();

  const canSubmit = windowStatus === "open";
  const isLocked =
    ["locked", "used_for_schedule"].includes(windowStatus) ||
    ["locked", "used_for_schedule"].includes(submissionStatus);

  const canShowAvailabilityForm =
    Boolean(selectedWindow) &&
    (isPartTime || selectedWindow?.allowFullTimeUnavailableException);

  const canInteract =
    Boolean(selectedWindow) &&
    canShowAvailabilityForm &&
    !isLocked &&
    windowStatus !== "draft" &&
    windowStatus !== "cancelled" &&
    (windowStatus === "open" || windowStatus === "closed");

  const days = useMemo(() => {
    const result = [];

    for (let index = 0; index < 7; index += 1) {
      const day = new Date(availabilityTargetStart);
      day.setDate(availabilityTargetStart.getDate() + index);
      result.push(day);
    }

    return result;
  }, [availabilityTargetStartIso]);

  const checked = (date, shiftType) => {
    const key = `${date}|${shiftType}`;

    if (key in slotsState) {
      return Boolean(slotsState[key]);
    }

    const existing = submissionMap.get(key);
    if (!existing) return false;

    return isPartTime
      ? existing.status === "available"
      : existing.status === "unavailable";
  };

  const selectedSlotCount = useMemo(() => {
    let count = 0;

    days.forEach((day) => {
      const dateKey = toDateKey(day);
      SHIFT_TYPES.forEach((shiftType) => {
        if (checked(dateKey, shiftType)) count += 1;
      });
    });

    return count;
  }, [days, slotsState, submissionMap, isPartTime]);

  const submitLabel = isPartTime
    ? "Gửi đăng ký ca khả dụng"
    : "Gửi ca không khả dụng";

  const formTitle = isPartTime
    ? "Đăng ký ca có thể làm"
    : "Báo ca không khả dụng";

  const formDescription = isPartTime
    ? "Chọn các ca bạn có thể làm trong tuần để quản lý xếp lịch chính xác hơn."
    : "Bạn là nhân viên toàn thời gian, chỉ cần đánh dấu các ca không thể làm nếu có ngoại lệ.";

  const onSubmit = async () => {
    setError("");
    setSuccess("");

    if (!selectedWindow?.id) {
      setError("Không tìm thấy kỳ đăng ký lịch.");
      return;
    }

    try {
      const slots = [];

      days.forEach((day) => {
        const dateIso = day.toISOString();
        const dateKey = toDateKey(day);

        SHIFT_TYPES.forEach((shiftType) => {
          if (checked(dateKey, shiftType)) {
            slots.push({
              date: dateIso,
              shiftType,
              status: isPartTime ? "available" : "unavailable",
            });
          }
        });
      });

      const res = await submit({
        variables: {
          input: {
            availabilityWindowId: selectedWindow.id,
            employeeId,
            employmentType,
            submissionType: isPartTime
              ? "weekly_availability"
              : "unavailable_exception",
            slots,
          },
        },
      });

      const resultStatus = res?.data?.submitStaffAvailability?.status;

      if (resultStatus === "late_change_requested") {
        setSuccess("Yêu cầu thay đổi muộn đã được gửi và chờ quản lý duyệt.");
      } else {
        setSuccess(
          isPartTime
            ? "Đã gửi đăng ký ca khả dụng thành công."
            : "Đã gửi thông tin ca không khả dụng.",
        );
      }

      setSlotsState({});
      refetchSubmission?.();
    } catch (submitError) {
      setError(getGraphQLErrorMessage(submitError, "Không thể gửi đăng ký."));
    }
  };

  const scheduleAck = myAckData?.myScheduleAcknowledgement || null;

  const shifts = useMemo(() => {
    return (shiftsData?.staffShifts || [])
      .filter((shift) =>
        ["published", "active"].includes(
          String(shift.status || "").toLowerCase(),
        ),
      )
      .sort(
        (left, right) =>
          new Date(left.startTime).getTime() -
          new Date(right.startTime).getTime(),
      );
  }, [shiftsData]);

  const shiftCountText =
    shifts.length > 0 ? `${shifts.length} ca đã công bố` : "Chưa có ca công bố";

  return (
    <main className="staff-schedule-page">
      <section className="staff-schedule-hero">
        <div className="staff-schedule-hero__glow" />

        <div className="staff-schedule-hero__content">
          <div className="staff-schedule-eyebrow">
            <Sparkles size={16} />
            <span>Lịch làm việc cá nhân</span>
          </div>

          <h1>Lịch làm việc của tôi</h1>

          <p>
            Theo dõi lịch đã công bố, gửi availability và báo ca không khả dụng
            trong cùng một nơi.
          </p>

          <div className="staff-schedule-hero__meta">
            <span>{employmentTypeLabel}</span>
            <span>{getWeekRangeLabel(weekStart, weekEnd)}</span>
            <span>{shiftCountText}</span>
          </div>
        </div>

        <div className="staff-week-switcher">
          <button
            type="button"
            className="staff-week-switcher__button"
            onClick={() => setWeekOffset((value) => value - 1)}
            aria-label="Xem tuần trước"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="staff-week-switcher__current">
            <span>Tuần đang xem</span>
            <strong>{getWeekRangeLabel(weekStart, weekEnd)}</strong>
          </div>

          <button
            type="button"
            className="staff-week-switcher__button"
            onClick={() => setWeekOffset((value) => value + 1)}
            aria-label="Xem tuần sau"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
      <section className="staff-flow-steps">
        <div
          className={`staff-flow-step ${
            selectedWindow ? "is-done" : "is-current"
          }`}
        >
          <span className="staff-flow-step__icon">
            <CalendarCheck2 size={17} />
          </span>
          <div>
            <strong>Mở đăng ký</strong>
            <small>
              {selectedWindow
                ? WINDOW_STATUS_LABELS[windowStatus] || "Đã có kỳ"
                : "Chờ quản lý"}
            </small>
          </div>
        </div>

        <div
          className={`staff-flow-step ${
            submission?.id ? "is-done" : selectedWindow ? "is-current" : ""
          }`}
        >
          <span className="staff-flow-step__icon">
            <Send size={17} />
          </span>
          <div>
            <strong>Gửi availability</strong>
            <small>
              {SUBMISSION_STATUS_LABELS[submissionStatus] || "Chưa gửi"}
            </small>
          </div>
        </div>

        <div
          className={`staff-flow-step ${submission?.id ? "is-current" : ""}`}
        >
          <span className="staff-flow-step__icon">
            <Clock3 size={17} />
          </span>
          <div>
            <strong>Quản lý xếp lịch</strong>
            <small>Chờ lịch được công bố</small>
          </div>
        </div>

        <div className={`staff-flow-step ${shifts.length ? "is-done" : ""}`}>
          <span className="staff-flow-step__icon">
            <CheckCircle2 size={17} />
          </span>
          <div>
            <strong>Lịch công bố</strong>
            <small>
              {shifts.length ? `${shifts.length} ca` : "Chưa có ca"}
            </small>
          </div>
        </div>
      </section>
      <section className="staff-schedule-layout">
        <div className="staff-schedule-main">
          <section className="staff-card staff-card--availability">
            <div className="staff-card__header">
              <div>
                <div className="staff-card__kicker">
                  <CalendarCheck2 size={16} />
                  <span>Đăng ký lịch</span>
                </div>

                <h2>{formTitle}</h2>

                <p>{formDescription}</p>
                <p className="staff-card__subnote">
                  Kỳ đăng ký áp dụng cho tuần {availabilityTargetRangeLabel}.
                </p>
              </div>

              <div className="staff-card__badges">
                <span
                  className={`staff-pill staff-pill--${getWindowTone(windowStatus)}`}
                >
                  {WINDOW_STATUS_LABELS[windowStatus] || "Chưa có kỳ"}
                </span>

                <span
                  className={`staff-pill staff-pill--${getSubmissionTone(
                    submissionStatus,
                  )}`}
                >
                  {SUBMISSION_STATUS_LABELS[submissionStatus] ||
                    submissionStatus ||
                    "Chưa gửi"}
                </span>
              </div>
            </div>

            {loadingWindows || loadingSubmission ? (
              <div className="staff-loading-state">
                <Loader2 size={22} className="staff-spin" />
                <span>Đang tải thông tin đăng ký...</span>
              </div>
            ) : windowsError ? (
              <div className="staff-empty-state staff-empty-state--error">
                <AlertTriangle size={34} />
                <h3>Không tải được kỳ đăng ký lịch</h3>
                <p>
                  {getGraphQLErrorMessage(
                    windowsError,
                    "Không thể tải kỳ đăng ký lịch.",
                  )}
                </p>
              </div>
            ) : !selectedWindow ? (
              <div className="staff-empty-state">
                <CalendarDays size={34} />
                <h3>Chưa có kỳ đăng ký lịch</h3>
                <p>
                  Chưa tìm thấy kỳ đăng ký cho tuần{" "}
                  {availabilityTargetRangeLabel}. Khi quản lý mở đúng kỳ này,
                  form availability sẽ xuất hiện tại đây.
                </p>
              </div>
            ) : (
              <>
                <div className="staff-window-summary">
                  <div>
                    <span>Kỳ áp dụng</span>
                    <strong>
                      {fmtDate(selectedWindow.periodStart, {
                        day: "2-digit",
                        month: "2-digit",
                      })}{" "}
                      -{" "}
                      {fmtDate(selectedWindow.periodEnd, {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </strong>
                  </div>

                  <div>
                    <span>Hạn đăng ký</span>
                    <strong>
                      {selectedWindow.closeAt
                        ? fmtDate(selectedWindow.closeAt)
                        : "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Đã chọn</span>
                    <strong>{selectedSlotCount} ca</strong>
                  </div>
                </div>

                {!isPartTime &&
                selectedWindow.allowFullTimeUnavailableException === false ? (
                  <div className="staff-info-box staff-info-box--locked">
                    <LockKeyhole size={18} />
                    <div>
                      <strong>Không cần đăng ký availability tuần</strong>
                      <p>
                        Quản lý hiện chưa bật luồng báo ca không khả dụng cho
                        nhân viên toàn thời gian.
                      </p>
                    </div>
                  </div>
                ) : null}

                {windowStatus === "draft" ? (
                  <div className="staff-info-box">
                    <Info size={18} />
                    <div>
                      <strong>Kỳ đăng ký chưa mở</strong>
                      <p>Bạn sẽ gửi được đăng ký sau khi quản lý mở kỳ này.</p>
                    </div>
                  </div>
                ) : null}

                {windowStatus === "closed" ? (
                  <div className="staff-info-box staff-info-box--warning">
                    <AlertTriangle size={18} />
                    <div>
                      <strong>Kỳ đăng ký đã đóng</strong>
                      <p>
                        Nếu hệ thống cho phép, thay đổi của bạn sẽ được gửi như
                        yêu cầu thay đổi muộn và chờ quản lý duyệt.
                      </p>
                    </div>
                  </div>
                ) : null}

                {windowStatus === "cancelled" ? (
                  <div className="staff-info-box staff-info-box--danger">
                    <AlertTriangle size={18} />
                    <div>
                      <strong>Kỳ đăng ký đã bị hủy</strong>
                      <p>Bạn không thể gửi hoặc cập nhật đăng ký cho kỳ này.</p>
                    </div>
                  </div>
                ) : null}

                {canShowAvailabilityForm ? (
                  <div className="staff-availability-matrix">
                    <div className="staff-availability-matrix__scroll">
                      <div className="staff-availability-matrix__grid">
                        <div className="staff-availability-matrix__corner">
                          Ca / Ngày
                        </div>

                        {days.map((day) => {
                          const dateKey = toDateKey(day);
                          const isToday = dateKey === toDateKey(new Date());
                          const dayName = day.toLocaleDateString("vi-VN", {
                            weekday: "short",
                          });

                          return (
                            <div
                              key={`head-${dateKey}`}
                              className={`staff-availability-matrix__day ${
                                isToday ? "is-today" : ""
                              }`}
                            >
                              <strong>{dayName}</strong>
                              <span>{fmtDate(day)}</span>
                            </div>
                          );
                        })}

                        {SHIFT_TYPES.map((shiftType) => {
                          const meta = SHIFT_META[shiftType] || {};
                          const Icon = meta.icon || Clock3;

                          return (
                            <React.Fragment key={shiftType}>
                              <div className="staff-availability-matrix__shift">
                                <span className="staff-availability-matrix__shiftIcon">
                                  <Icon size={16} />
                                </span>
                                <div>
                                  <strong>{meta.label || shiftType}</strong>
                                  <small>{meta.timeHint || "Theo lịch"}</small>
                                </div>
                              </div>

                              {days.map((day) => {
                                const dateKey = toDateKey(day);
                                const inputId = `${dateKey}-${shiftType}`;
                                const isChecked = checked(dateKey, shiftType);

                                return (
                                  <label
                                    key={`${dateKey}|${shiftType}`}
                                    htmlFor={inputId}
                                    className={`staff-matrix-slot ${
                                      isChecked ? "is-selected" : ""
                                    } ${
                                      !canInteract || submitting
                                        ? "is-disabled"
                                        : ""
                                    }`}
                                  >
                                    <input
                                      id={inputId}
                                      type="checkbox"
                                      disabled={!canInteract || submitting}
                                      checked={isChecked}
                                      onChange={() =>
                                        setSlotsState((prev) => ({
                                          ...prev,
                                          [`${dateKey}|${shiftType}`]: !checked(
                                            dateKey,
                                            shiftType,
                                          ),
                                        }))
                                      }
                                    />

                                    <span className="staff-matrix-slot__check">
                                      {isChecked ? "✓" : ""}
                                    </span>

                                    <span className="staff-matrix-slot__label">
                                      {isChecked ? "Đã chọn" : "Chọn"}
                                    </span>
                                  </label>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="staff-action-bar">
                  <div className="staff-action-bar__copy">
                    <strong>
                      {isPartTime
                        ? "Gửi các ca bạn có thể làm"
                        : "Gửi các ca bạn không thể làm"}
                    </strong>
                    <span>
                      Dữ liệu này giúp quản lý xếp lịch công bằng và tránh trùng
                      lịch cá nhân.
                    </span>
                  </div>

                  <button
                    type="button"
                    className="staff-primary-button"
                    disabled={
                      submitting ||
                      isLocked ||
                      windowStatus === "draft" ||
                      windowStatus === "cancelled" ||
                      (!isPartTime &&
                        !selectedWindow.allowFullTimeUnavailableException)
                    }
                    onClick={onSubmit}
                  >
                    {submitting ? (
                      <Loader2 size={18} className="staff-spin" />
                    ) : (
                      <Send size={18} />
                    )}
                    <span>
                      {submission?.id ? "Cập nhật đăng ký" : submitLabel}
                    </span>
                  </button>
                </div>

                {success ? (
                  <div className="staff-feedback staff-feedback--success">
                    {success}
                  </div>
                ) : null}

                {error ? (
                  <div className="staff-feedback staff-feedback--error">
                    {error}
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>

        <aside className="staff-schedule-side">
          <section className="staff-card staff-card--overview">
            <div className="staff-card__kicker">
              <Sparkles size={16} />
              <span>Tổng quan tuần</span>
            </div>

            <div className="staff-overview-list">
              <div className="staff-overview-item">
                <span>Tuần xem lịch</span>
                <strong>{getWeekRangeLabel(weekStart, weekEnd)}</strong>
              </div>

              <div className="staff-overview-item">
                <span>Tuần đăng ký</span>
                <strong>{availabilityTargetRangeLabel}</strong>
              </div>

              <div className="staff-overview-item">
                <span>Trạng thái</span>
                <strong>
                  {WINDOW_STATUS_LABELS[windowStatus] || "Chưa có kỳ"}
                </strong>
              </div>

              <div className="staff-overview-item staff-overview-item--highlight">
                <span>Ca đã chọn</span>
                <strong>{selectedSlotCount}</strong>
              </div>

              <div className="staff-overview-item staff-overview-item--highlight">
                <span>Ca công bố</span>
                <strong>{shifts.length}</strong>
              </div>
            </div>
          </section>
          <section className="staff-card staff-card--shifts">
            <div className="staff-card__header staff-card__header--compact">
              <div>
                <div className="staff-card__kicker">
                  <Clock3 size={16} />
                  <span>Ca đã công bố</span>
                </div>

                <h2>Lịch tuần này</h2>
              </div>

              <span className="staff-count-badge">{shifts.length}</span>
            </div>



            {shifts.length > 0 ? (
              <div className="staff-feedback" style={{ marginBottom: 12 }}>
                {scheduleAck?.changedAfterAcknowledgement || scheduleAck?.status === "needs_review" ? (
                  <>
                    <p>Lịch đã có thay đổi sau lần xác nhận trước. Vui lòng xem lại và xác nhận lại.</p>
                    <button className="staff-primary-btn" disabled={acking || ackLoading} onClick={async () => { await ackMySchedule({ variables: { restaurantId, periodStart: weekStartIso, periodEnd: weekEndIso } }); await refetchAck(); }}>Xác nhận lại lịch</button>
                  </>
                ) : scheduleAck?.status === "acknowledged" ? (
                  <p>Bạn đã xác nhận lịch này lúc {new Date(scheduleAck.acknowledgedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} {new Date(scheduleAck.acknowledgedAt).toLocaleDateString("vi-VN")}.</p>
                ) : (
                  <>
                    <p>Lịch tuần này đã được công bố. Vui lòng xác nhận đã nhận lịch.</p>
                    <button className="staff-primary-btn" disabled={acking || ackLoading} onClick={async () => { await ackMySchedule({ variables: { restaurantId, periodStart: weekStartIso, periodEnd: weekEndIso } }); await refetchAck(); }}>Xác nhận đã nhận lịch</button>
                  </>
                )}
              </div>
            ) : null}
            {loadingShifts ? (
              <div className="staff-loading-state staff-loading-state--small">
                <Loader2 size={20} className="staff-spin" />
                <span>Đang tải lịch...</span>
              </div>
            ) : shiftsError ? (
              <div className="staff-empty-state staff-empty-state--small staff-empty-state--error">
                <AlertTriangle size={30} />
                <h3>Không tải được lịch làm việc</h3>
                <p>
                  {getGraphQLErrorMessage(
                    shiftsError,
                    "Không thể tải lịch làm việc.",
                  )}
                </p>
              </div>
            ) : shifts.length === 0 ? (
              <div className="staff-empty-state staff-empty-state--small">
                <CalendarDays size={30} />
                <h3>Lịch chưa được công bố</h3>
                <p>
                  Khi quản lý công bố lịch, các ca của bạn sẽ xuất hiện ở đây.
                </p>
              </div>
            ) : (
              <div className="staff-shift-list">
                {shifts.map((shift) => {
                  const shiftMeta = SHIFT_META[shift.shiftType] || {};
                  const Icon = shiftMeta.icon || Clock3;

                  return (
                    <article key={shift.id} className="staff-my-shift-card">
                      <div className="staff-my-shift-card__icon">
                        <Icon size={20} />
                      </div>

                      <div className="staff-my-shift-card__body">
                        <div className="staff-my-shift-card__top">
                          <strong>{shiftMeta.label || shift.shiftType}</strong>
                          <span>{fmtDate(shift.startTime)}</span>
                        </div>

                        <div className="staff-my-shift-card__time">
                          {fmtTime(shift.startTime)} - {fmtTime(shift.endTime)}
                        </div>

                        {shift.notes ? (
                          <p className="staff-my-shift-card__note">
                            {shift.notes}
                          </p>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="staff-card staff-card--guide">
            <div className="staff-guide-icon">
              <Info size={18} />
            </div>

            <h3>Gợi ý sử dụng</h3>

            <p>
              Nếu bạn là part-time hoặc thời vụ, hãy đăng ký các ca có thể làm.
              Nếu bạn là full-time, chỉ báo ca không khả dụng khi có ngoại lệ.
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}
