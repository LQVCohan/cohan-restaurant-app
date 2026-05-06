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
import { resolveAvailabilityWindowEffectiveStatus } from "@/utils/availabilityRegistrationSchedule";
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
      reviewNote
      pendingSubmittedAt
      pendingSlots {
        date
        shiftType
        status
        note
      }
      slots {
        date
        shiftType
        status
        note
      }
    }
  }
`;
const GET_SCHEDULING_POLICY = gql`
  query StaffSchedulingPolicy($restaurantId: ID!) {
    schedulingPolicy(restaurantId: $restaurantId) {
      shiftTemplates {
        key
        label
        startTime
        endTime
        enabled
        allowCrossDay
      }
      employmentTypePolicy {
        part_time {
          minWeeklyHours
          weeklyHoursTarget
          weeklyHoursCap
          maxShiftsPerWeek
          requireAvailability
        }
        seasonal {
          minWeeklyHours
          weeklyHoursTarget
          weeklyHoursCap
          maxShiftsPerWeek
          requireAvailability
        }
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
  query MyScheduleAck(
    $restaurantId: ID!
    $periodStart: DateTime!
    $periodEnd: DateTime!
  ) {
    myScheduleAcknowledgement(
      restaurantId: $restaurantId
      periodStart: $periodStart
      periodEnd: $periodEnd
    ) {
      id
      status
      acknowledgedAt
      changedAfterAcknowledgement
    }
  }
`;

const ACK_MY_SCHEDULE = gql`
  mutation AckMySchedule(
    $restaurantId: ID!
    $periodStart: DateTime!
    $periodEnd: DateTime!
  ) {
    acknowledgeMySchedule(
      restaurantId: $restaurantId
      periodStart: $periodStart
      periodEnd: $periodEnd
    ) {
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
const GET_MY_SHIFT_ACKS = gql`
  query MyShiftAcknowledgements($periodStart: DateTime, $periodEnd: DateTime) {
    myShiftAcknowledgements(periodStart: $periodStart, periodEnd: $periodEnd) {
      id
      shiftId
      status
      declineClassification
    }
  }
`;
const RESPOND_SHIFT_ACK = gql`
  mutation RespondShiftAcknowledgement(
    $input: RespondShiftAcknowledgementInput!
  ) {
    respondShiftAcknowledgement(input: $input) {
      id
      status
      declineClassification
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
const FALLBACK_SHIFT_DURATIONS = { morning: 6, afternoon: 6, evening: 5 };
const FALLBACK_EMPLOYMENT_POLICY = {
  part_time: {
    minWeeklyHours: 8,
    weeklyHoursTarget: 20,
    weeklyHoursCap: 28,
    maxShiftsPerWeek: 4,
  },
  seasonal: {
    minWeeklyHours: 0,
    weeklyHoursTarget: 24,
    weeklyHoursCap: 40,
    maxShiftsPerWeek: 5,
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
  locked: "Đã khóa để xếp lịch",
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
const parseTimeToMinutes = (value) => {
  if (typeof value !== "string") return null;
  const [h, m] = value.split(":").map((p) => Number(p));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};
const getShiftTemplateDurationHours = (template) => {
  const key = String(template?.key || "").toLowerCase();
  const start = parseTimeToMinutes(template?.startTime);
  const end = parseTimeToMinutes(template?.endTime);
  if (start === null || end === null) return FALLBACK_SHIFT_DURATIONS[key] || 0;
  let duration = end - start;
  if (template?.allowCrossDay || end <= start) duration += 24 * 60;
  if (!Number.isFinite(duration) || duration <= 0)
    return FALLBACK_SHIFT_DURATIONS[key] || 0;
  return duration / 60;
};
const buildShiftDurationMap = (shiftTemplates = []) => {
  const map = { ...FALLBACK_SHIFT_DURATIONS };
  shiftTemplates.forEach((template) => {
    const key = String(template?.key || "").toLowerCase();
    if (!key) return;
    map[key] = getShiftTemplateDurationHours(template);
  });
  return map;
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
  const { data: schedulingPolicyData, error: schedulingPolicyError } = useQuery(
    GET_SCHEDULING_POLICY,
    {
      variables: { restaurantId },
      skip: !restaurantId,
      fetchPolicy: "cache-first",
    },
  );
  const {
    data: myAckData,
    loading: ackLoading,
    refetch: refetchAck,
  } = useQuery(GET_MY_SCHEDULE_ACK, {
    variables: {
      restaurantId,
      periodStart: weekStartIso,
      periodEnd: weekEndIso,
    },
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });
  const [ackMySchedule, { loading: acking }] = useMutation(ACK_MY_SCHEDULE);
  const [respondShiftAck] = useMutation(RESPOND_SHIFT_ACK);
  const [respondingShiftId, setRespondingShiftId] = useState("");
  const [declineDraft, setDeclineDraft] = useState({});

  const { data: myShiftAcksData, refetch: refetchShiftAcks } = useQuery(
    GET_MY_SHIFT_ACKS,
    {
      variables: { periodStart: weekStartIso, periodEnd: weekEndIso },
      skip: !employeeId,
      fetchPolicy: "network-only",
    },
  );

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

  const windowStatus = String(
    resolveAvailabilityWindowEffectiveStatus(selectedWindow) ||
      selectedWindow?.status ||
      "",
  ).toLowerCase();
  const registrationMode = String(
    selectedWindow?.registrationMode || "manual",
  ).toLowerCase();
  const submissionStatus = String(
    submission?.status || "not_submitted",
  ).toLowerCase();

  const isLocked =
    ["locked", "used_for_schedule"].includes(windowStatus) ||
    ["locked", "used_for_schedule"].includes(submissionStatus);

  const canShowAvailabilityForm =
    Boolean(selectedWindow) &&
    (isPartTime || selectedWindow?.allowFullTimeUnavailableException);

  const allowsLateChange = selectedWindow?.lateChangeRequiresApproval !== false;

  const canInteract =
    Boolean(selectedWindow) &&
    canShowAvailabilityForm &&
    !isLocked &&
    windowStatus !== "draft" &&
    windowStatus !== "cancelled" &&
    (windowStatus === "open" ||
      (windowStatus === "closed" && allowsLateChange));

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
  const schedulingPolicy = schedulingPolicyData?.schedulingPolicy || null;
  const shiftDurationMap = useMemo(
    () => buildShiftDurationMap(schedulingPolicy?.shiftTemplates || []),
    [schedulingPolicy],
  );
  const employmentPolicy =
    schedulingPolicy?.employmentTypePolicy?.[employmentType] ||
    FALLBACK_EMPLOYMENT_POLICY[employmentType] ||
    {};
  const minAvailabilityHours = Number(employmentPolicy?.minWeeklyHours || 0);
  const targetAvailabilityHours = Number(
    employmentPolicy?.weeklyHoursTarget || 0,
  );
  const capHours = Number(employmentPolicy?.weeklyHoursCap || 0);
  const maxShiftsPerWeek = Number(employmentPolicy?.maxShiftsPerWeek || 0);
  const selectedAvailabilityHours = useMemo(() => {
    let total = 0;
    days.forEach((day) => {
      const dateKey = toDateKey(day);
      SHIFT_TYPES.forEach((shiftType) => {
        if (checked(dateKey, shiftType))
          total += Number(shiftDurationMap[shiftType] || 0);
      });
    });
    return total;
  }, [days, slotsState, submissionMap, shiftDurationMap, isPartTime]);
  const remainingMinimumHours = Math.max(
    0,
    minAvailabilityHours - selectedAvailabilityHours,
  );
  const meetsMinimumAvailability =
    !isPartTime ||
    minAvailabilityHours <= 0 ||
    selectedAvailabilityHours >= minAvailabilityHours;
  const selectedShiftCountExceedsPolicy =
    maxShiftsPerWeek > 0 && selectedSlotCount > maxShiftsPerWeek;
  const requirementProgress =
    minAvailabilityHours > 0
      ? Math.min(100, (selectedAvailabilityHours / minAvailabilityHours) * 100)
      : 100;
  const officialAvailabilityHours = useMemo(
    () =>
      (submission?.slots || []).reduce(
        (total, slot) =>
          slot?.status === "available"
            ? total + Number(shiftDurationMap[slot.shiftType] || 0)
            : total,
        0,
      ),
    [submission, shiftDurationMap],
  );
  const pendingAvailabilityHours = useMemo(
    () =>
      (submission?.pendingSlots || []).reduce(
        (total, slot) =>
          slot?.status === "available"
            ? total + Number(shiftDurationMap[slot.shiftType] || 0)
            : total,
        0,
      ),
    [submission, shiftDurationMap],
  );

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
    if (
      canShowAvailabilityForm &&
      isPartTime &&
      minAvailabilityHours > 0 &&
      selectedAvailabilityHours < minAvailabilityHours
    ) {
      setError(
        `Bạn cần đăng ký ít nhất ${minAvailabilityHours} giờ khả dụng/tuần. Hiện tại bạn mới chọn ${selectedAvailabilityHours} giờ.`,
      );
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
      .filter(
        (shift) => String(shift.status || "").toLowerCase() !== "cancelled",
      )
      .sort(
        (left, right) =>
          new Date(left.startTime).getTime() -
          new Date(right.startTime).getTime(),
      );
  }, [shiftsData]);
  const shiftAckMap = useMemo(
    () =>
      new Map(
        (myShiftAcksData?.myShiftAcknowledgements || []).map((ack) => [
          String(ack.shiftId),
          ack,
        ]),
      ),
    [myShiftAcksData],
  );

  const shiftCountText =
    shifts.length > 0 ? `${shifts.length} ca đã công bố` : "Chưa có ca công bố";
  const closeDeclinePanelForShift = (shiftId) => {
    setDeclineDraft((prev) => {
      const next = { ...prev };
      delete next[shiftId];
      return next;
    });
  };
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
                    <span>Chế độ đăng ký</span>
                    <strong>
                      {registrationMode === "auto" ? "Tự động" : "Thủ công"}
                    </strong>
                  </div>

                  <div>
                    <span>Mở đăng ký</span>
                    <strong>
                      {selectedWindow.openAt
                        ? fmtDate(selectedWindow.openAt)
                        : "—"}
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
                {canShowAvailabilityForm && isPartTime ? (
                  <div
                    className={`staff-availability-requirement ${
                      meetsMinimumAvailability
                        ? "staff-availability-requirement--ok"
                        : "staff-availability-requirement--warning"
                    }`}
                  >
                    <div className="staff-availability-requirement__header">
                      Yêu cầu giờ khả dụng
                    </div>
                    <div className="staff-availability-requirement__stats">
                      <span>
                        Đã chọn: {selectedAvailabilityHours} giờ / tối thiểu{" "}
                        {minAvailabilityHours} giờ
                      </span>
                      {targetAvailabilityHours > 0 ? (
                        <span>
                          Mục tiêu tham khảo: {targetAvailabilityHours} giờ/tuần
                        </span>
                      ) : null}
                      {capHours > 0 || maxShiftsPerWeek > 0 ? (
                        <span>
                          Giới hạn xếp lịch:{" "}
                          {capHours > 0 ? `tối đa ${capHours} giờ` : ""}
                          {capHours > 0 && maxShiftsPerWeek > 0 ? " hoặc " : ""}
                          {maxShiftsPerWeek > 0
                            ? `${maxShiftsPerWeek} ca/tuần`
                            : ""}
                        </span>
                      ) : null}
                      {!meetsMinimumAvailability ? (
                        <span>
                          Bạn cần đăng ký thêm {remainingMinimumHours} giờ khả
                          dụng để đạt yêu cầu tối thiểu.
                        </span>
                      ) : (
                        <span>
                          Đã đạt yêu cầu tối thiểu để quản lý xếp lịch.
                        </span>
                      )}
                      {selectedShiftCountExceedsPolicy ? (
                        <span>
                          Bạn đã chọn vượt quá số ca khuyến nghị (
                          {maxShiftsPerWeek} ca/tuần).
                        </span>
                      ) : null}
                      {schedulingPolicyError ? (
                        <span>
                          Đang dùng chính sách mặc định do chưa tải được cấu
                          hình.
                        </span>
                      ) : null}
                    </div>
                    <div className="staff-availability-progress">
                      <div
                        className="staff-availability-progress__bar"
                        style={{ width: `${requirementProgress}%` }}
                      />
                    </div>
                  </div>
                ) : null}

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
                      <strong>Kỳ đăng ký chưa mở.</strong>
                      <p>
                        {registrationMode === "auto"
                          ? "Kỳ đăng ký tự động chưa đến thời gian mở."
                          : "Bạn sẽ gửi được đăng ký sau khi quản lý mở kỳ này."}
                      </p>
                    </div>
                  </div>
                ) : null}

                {windowStatus === "closed" ? (
                  <div className="staff-info-box staff-info-box--warning">
                    <AlertTriangle size={18} />
                    <div>
                      <strong>
                        {registrationMode === "auto"
                          ? "Kỳ đăng ký đã hết hạn."
                          : "Kỳ đăng ký đã đóng"}
                      </strong>
                      <p>
                        {allowsLateChange
                          ? "Kỳ đăng ký đã đóng. Thay đổi của bạn sẽ được gửi như yêu cầu thay đổi muộn và chờ quản lý duyệt."
                          : "Kỳ đăng ký đã đóng. Doanh nghiệp hiện không cho phép gửi thay đổi sau khi đóng."}
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

                {submission &&
                [
                  "submitted",
                  "approved",
                  "late_change_requested",
                  "rejected",
                ].includes(submissionStatus) ? (
                  <div className="staff-info-box">
                    {submissionStatus === "submitted" ||
                    submissionStatus === "approved" ? (
                      <div>
                        <strong>Các ca đã đăng ký</strong>
                        {submissionStatus === "approved" ? (
                          <p>Đã được quản lý duyệt</p>
                        ) : null}
                        <ul>
                          {(submission.slots || []).map((slot, idx) => (
                            <li key={`official-${idx}`}>
                              {fmtFullDate(slot.date)} -{" "}
                              {SHIFT_META[slot.shiftType]?.label ||
                                slot.shiftType}{" "}
                              -{" "}
                              {slot.status === "available"
                                ? "Có thể làm"
                                : "Không khả dụng"}
                            </li>
                          ))}
                        </ul>
                        <p>
                          Tổng giờ đã đăng ký: {officialAvailabilityHours} giờ
                        </p>
                      </div>
                    ) : null}

                    {submissionStatus === "late_change_requested" ? (
                      <div>
                        <strong>Yêu cầu thay đổi muộn đang chờ duyệt</strong>
                        <ul>
                          {(submission.pendingSlots || []).map((slot, idx) => (
                            <li key={`pending-${idx}`}>
                              {fmtFullDate(slot.date)} -{" "}
                              {SHIFT_META[slot.shiftType]?.label ||
                                slot.shiftType}{" "}
                              -{" "}
                              {slot.status === "available"
                                ? "Có thể làm"
                                : "Không khả dụng"}
                            </li>
                          ))}
                        </ul>
                        <p>
                          Tổng giờ trong yêu cầu thay đổi:{" "}
                          {pendingAvailabilityHours} giờ
                        </p>
                        <p>
                          Các thay đổi này chỉ được dùng để xếp lịch sau khi
                          quản lý duyệt.
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {submissionStatus === "rejected" ? (
                  <div className="staff-info-box staff-info-box--danger">
                    <AlertTriangle size={18} />
                    <div>
                      <strong>Yêu cầu thay đổi muộn đã bị từ chối.</strong>
                      {submission?.reviewNote ? (
                        <p>Ghi chú quản lý: {submission.reviewNote}</p>
                      ) : null}
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
                      (windowStatus === "closed" && !allowsLateChange) ||
                      (canShowAvailabilityForm &&
                        isPartTime &&
                        minAvailabilityHours > 0 &&
                        selectedAvailabilityHours < minAvailabilityHours) ||
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
                  {canShowAvailabilityForm &&
                  isPartTime &&
                  minAvailabilityHours > 0 &&
                  selectedAvailabilityHours < minAvailabilityHours ? (
                    <small>
                      Chọn thêm ca để đạt tối thiểu {minAvailabilityHours} giờ
                      khả dụng.
                    </small>
                  ) : null}
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
                {scheduleAck?.changedAfterAcknowledgement ||
                scheduleAck?.status === "needs_review" ? (
                  <>
                    <p>
                      Lịch đã có thay đổi sau lần xác nhận trước. Vui lòng xem
                      lại và xác nhận lại.
                    </p>
                    <button
                      className="staff-primary-btn"
                      disabled={acking || ackLoading}
                      onClick={async () => {
                        await ackMySchedule({
                          variables: {
                            restaurantId,
                            periodStart: weekStartIso,
                            periodEnd: weekEndIso,
                          },
                        });
                        await refetchAck();
                      }}
                    >
                      Xác nhận lại lịch
                    </button>
                  </>
                ) : scheduleAck?.status === "acknowledged" ? (
                  <p>
                    Bạn đã xác nhận lịch này lúc{" "}
                    {new Date(scheduleAck.acknowledgedAt).toLocaleTimeString(
                      "vi-VN",
                      { hour: "2-digit", minute: "2-digit" },
                    )}{" "}
                    {new Date(scheduleAck.acknowledgedAt).toLocaleDateString(
                      "vi-VN",
                    )}
                    .
                  </p>
                ) : (
                  <>
                    <p>
                      Lịch tuần này đã được công bố. Vui lòng xác nhận đã nhận
                      lịch.
                    </p>
                    <p>
                      Xác nhận toàn bộ lịch chỉ xác nhận bạn đã xem lịch. Từng
                      ca vẫn cần phản hồi nếu có yêu cầu nhận/từ chối ca.
                    </p>
                    <button
                      className="staff-primary-btn"
                      disabled={acking || ackLoading}
                      onClick={async () => {
                        await ackMySchedule({
                          variables: {
                            restaurantId,
                            periodStart: weekStartIso,
                            periodEnd: weekEndIso,
                          },
                        });
                        await refetchAck();
                      }}
                    >
                      Xác nhận đã nhận lịch
                    </button>
                  </>
                )}
              </div>
            ) : null}
            {success ? (
              <div className="staff-feedback staff-feedback--success">
                {success}
              </div>
            ) : null}
            {error ? (
              <div className="staff-feedback staff-feedback--error">{error}</div>
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
                  const ack = shiftAckMap.get(String(shift.id));
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
                        <p className="staff-my-shift-card__note">
                          {ack
                            ? {
                                pending: "Chưa phản hồi",
                                accepted: "Đã nhận ca",
                                declined: "Đã từ chối",
                                cancelled: "Đã hủy",
                              }[ack.status] || "Chưa phản hồi"
                            : "Chưa tạo yêu cầu phản hồi ca"}
                        </p>
                        {ack?.status === "declined" ? (
                          <p className="staff-my-shift-card__note">
                            {
                              {
                                valid: "Lý do hợp lệ - chờ quản lý xếp lại",
                                invalid: "Lý do không được duyệt",
                                unknown: "Chờ quản lý xem xét",
                                late: "Từ chối muộn",
                              }[ack?.declineClassification || "unknown"]
                            }
                          </p>
                        ) : null}
                        {ack?.status === "pending" ? (
                          <div className="staff-shift-ack-actions">
                            <button
                              className="staff-primary-btn"
                              type="button"
                              disabled={respondingShiftId === shift.id}
                              onClick={async () => {
                                setError("");
                                setSuccess("");
                                if (!ack || ack.status !== "pending") {
                                  setError(
                                    "Ca này không còn ở trạng thái chờ phản hồi.",
                                  );
                                  return;
                                }
                                setRespondingShiftId(shift.id);
                                try {
                                  await respondShiftAck({
                                    variables: {
                                      input: {
                                        shiftId: shift.id,
                                        response: "accept",
                                      },
                                    },
                                  });
                                  closeDeclinePanelForShift(shift.id);
                                  await refetchShiftAcks();
                                  setSuccess("Bạn đã nhận ca thành công.");
                                } catch (submitError) {
                                  setError(
                                    getGraphQLErrorMessage(
                                      submitError,
                                      "Không thể nhận ca.",
                                    ),
                                  );
                                } finally {
                                  setRespondingShiftId("");
                                }
                              }}
                            >
                              Nhận ca
                            </button>
                            <button
                              className="staff-primary-btn"
                              type="button"
                              onClick={() =>
                                setDeclineDraft((p) => ({
                                  ...p,
                                  [shift.id]: p[shift.id]?.open
                                    ? { open: false }
                                    : {
                                        open: true,
                                        reason: "",
                                        reasonCategory: "sick",
                                      },
                                }))
                              }
                            >
                              Từ chối ca
                            </button>
                          </div>
                        ) : null}
                        {ack?.status === "pending" &&
                        declineDraft[shift.id]?.open ? (
                          <div className="staff-shift-decline-panel">
                            <select
                              value={declineDraft[shift.id].reasonCategory}
                              onChange={(e) =>
                                setDeclineDraft((p) => ({
                                  ...p,
                                  [shift.id]: {
                                    ...p[shift.id],
                                    reasonCategory: e.target.value,
                                  },
                                }))
                              }
                            >
                              <option value="sick">Bị ốm</option>
                              <option value="personal">Việc cá nhân</option>
                              <option value="emergency">Khẩn cấp</option>
                              <option value="schedule_conflict">
                                Trùng lịch
                              </option>
                              <option value="transportation">
                                Vấn đề di chuyển
                              </option>
                              <option value="other">Khác</option>
                            </select>
                            <textarea
                              value={declineDraft[shift.id].reason}
                              onChange={(e) =>
                                setDeclineDraft((p) => ({
                                  ...p,
                                  [shift.id]: {
                                    ...p[shift.id],
                                    reason: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Lý do từ chối (>= 5 ký tự)"
                            />
                            {(declineDraft[shift.id].reason || "").trim()
                              .length < 5 ? (
                              <p className="staff-my-shift-card__note">
                                Vui lòng nhập lý do tối thiểu 5 ký tự.
                              </p>
                            ) : null}
                            <button
                              className="staff-primary-btn"
                              type="button"
                              disabled={
                                respondingShiftId === shift.id ||
                                (declineDraft[shift.id].reason || "").trim()
                                  .length < 5
                              }
                              onClick={async () => {
                                setError("");
                                setSuccess("");
                                if (!ack || ack.status !== "pending") {
                                  setError(
                                    "Ca này không còn ở trạng thái chờ phản hồi.",
                                  );
                                  return;
                                }
                                const reason = String(
                                  declineDraft[shift.id]?.reason || "",
                                ).trim();
                                const reasonCategory = String(
                                  declineDraft[shift.id]?.reasonCategory || "",
                                ).trim();
                                if (reason.length < 5) {
                                  setError(
                                    "Vui lòng nhập lý do tối thiểu 5 ký tự.",
                                  );
                                  return;
                                }
                                setRespondingShiftId(shift.id);
                                try {
                                  await respondShiftAck({
                                    variables: {
                                      input: {
                                        shiftId: shift.id,
                                        response: "decline",
                                        reason,
                                        reasonCategory,
                                      },
                                    },
                                  });
                                  closeDeclinePanelForShift(shift.id);
                                  await refetchShiftAcks();
                                  setSuccess(
                                    "Bạn đã gửi từ chối ca. Chờ quản lý xem xét.",
                                  );
                                } catch (submitError) {
                                  setError(
                                    getGraphQLErrorMessage(
                                      submitError,
                                      "Không thể gửi từ chối ca.",
                                    ),
                                  );
                                } finally {
                                  setRespondingShiftId("");
                                }
                              }}
                            >
                              {respondingShiftId === shift.id
                                ? "Đang gửi..."
                                : "Gửi từ chối"}
                            </button>
                          </div>
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
