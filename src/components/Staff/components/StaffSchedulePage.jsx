import React, { useContext, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
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

const toDateKey = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

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

const isSameAvailabilityPeriod = (window, targetStart, targetEnd) => {
  if (!window || !targetStart || !targetEnd) return false;

  return (
    toDateKey(window.periodStart) === toDateKey(targetStart) &&
    toDateKey(window.periodEnd) === toDateKey(targetEnd)
  );
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
    user?.restaurantForStaff ||
    user?.primaryRestaurant?.id ||
    restaurants?.[0]?.id;

  const employeeId = user?.id;
  const employmentType = String(user?.employmentType || "").toLowerCase();
  const employmentTypeLabel =
    EMPLOYMENT_TYPE_LABELS[employmentType] || "Nhân viên";

  const isPartTime = PART_TIME_TYPES.has(employmentType);

  const [weekOffset, setWeekOffset] = useState(0);
  const [slotsState, setSlotsState] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  const availabilityTargetRangeLabel = getWeekRangeLabel(
    availabilityTargetStart,
    availabilityTargetEnd,
  );
  const { data: windowsData, loading: loadingWindows } = useQuery(
    GET_AVAILABILITY_WINDOWS,
    {
      variables: {
        restaurantId,
        from: availabilityTargetStartIso,
        to: availabilityTargetEndIso,
      },
      skip: !restaurantId,
      fetchPolicy: "cache-and-network",
    },
  );

  const selectedWindow = useMemo(() => {
    const windows = windowsData?.availabilityWindows || [];

    return (
      windows.find((window) =>
        isSameAvailabilityPeriod(
          window,
          availabilityTargetStart,
          availabilityTargetEnd,
        ),
      ) || null
    );
  }, [windowsData, availabilityTargetStartIso, availabilityTargetEndIso]);
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
    fetchPolicy: "cache-and-network",
  });

  const { data: shiftsData, loading: loadingShifts } = useQuery(
    GET_STAFF_SHIFTS,
    {
      variables: {
        restaurantId,
        employeeId,
        startDate: weekStartIso,
        endDate: weekEndIso,
      },
      skip: !restaurantId || !employeeId,
      fetchPolicy: "cache-and-network",
    },
  );

  const [submit, { loading: submitting }] = useMutation(SUBMIT);

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
                  <div className="staff-slots-grid">
                    {days.map((day) => {
                      const dateKey = toDateKey(day);
                      const isToday = dateKey === toDateKey(new Date());

                      return (
                        <article
                          key={dateKey}
                          className={`staff-day-card ${
                            isToday ? "staff-day-card--today" : ""
                          }`}
                        >
                          <div className="staff-day-card__header">
                            <span>{fmtFullDate(day)}</span>
                            {isToday ? <strong>Hôm nay</strong> : null}
                          </div>

                          <div className="staff-shift-options">
                            {SHIFT_TYPES.map((shiftType) => {
                              const meta = SHIFT_META[shiftType] || {};
                              const Icon = meta.icon || Clock3;
                              const inputId = `${dateKey}-${shiftType}`;
                              const isChecked = checked(dateKey, shiftType);

                              return (
                                <label
                                  key={`${dateKey}|${shiftType}`}
                                  htmlFor={inputId}
                                  className={`staff-shift-toggle ${
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

                                  <span className="staff-shift-toggle__icon">
                                    <Icon size={17} />
                                  </span>

                                  <span className="staff-shift-toggle__text">
                                    <strong>{meta.label || shiftType}</strong>
                                    <small>
                                      {meta.timeHint || "Theo lịch"}
                                    </small>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </article>
                      );
                    })}
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

            {loadingShifts ? (
              <div className="staff-loading-state staff-loading-state--small">
                <Loader2 size={20} className="staff-spin" />
                <span>Đang tải lịch...</span>
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
