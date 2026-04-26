import React, { useEffect, useMemo, useState } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { vi } from "date-fns/locale";
import { useNotification } from "@/hooks/useNotification";
import useSchedulingPolicy from "@/hooks/useSchedulingPolicy";
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Settings,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";

import "./ScheduleManagement.scss";
import {
  loadStoredShiftRules,
  persistShiftRules,
  shiftRulesToTypes,
  validateShiftRules,
} from "./utils/scheduleHelpers";
import {
  buildAutoScheduleCreateInputs,
  buildAutoSchedulePreview,
  calculateShiftHours,
  mapDepartmentToJob,
} from "./utils/autoSchedule";
import ShiftCard from "./components/ShiftCard";
import AddShiftModal from "./components/AddShiftModal";
import ShiftDetailModal from "./components/ShiftDetailModal";
import AutoScheduleModal from "./components/AutoScheduleModal";
import ShiftRulesModal from "./components/ShiftRulesModal";
import DailyView from "./DailyView";

const ME_QUERY = gql`
  query Me {
    me {
      id
      roleName
      restaurantForStaff
      refRestaurants {
        id
        name
      }
    }
  }
`;

const GET_ALL_RESTAURANTS = gql`
  query AllRestaurants($limit: Int = 100, $cursor: ID) {
    restaurants(limit: $limit, cursor: $cursor) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

const GET_STAFF_LIST = gql`
  query StaffList($restaurantId: ID, $search: String) {
    staffList(restaurantId: $restaurantId, search: $search) {
      id
      fullName
      employeeCode
      department
      employmentStatus
      employmentType
      workingDays
      baseSalary
    }
  }
`;

const GET_STAFF_SHIFTS = gql`
  query StaffShifts(
    $restaurantId: ID
    $employeeId: ID
    $startDate: DateTime
    $endDate: DateTime
    $status: String
  ) {
    staffShifts(
      restaurantId: $restaurantId
      employeeId: $employeeId
      startDate: $startDate
      endDate: $endDate
      status: $status
      limit: 1000
    ) {
      id
      employeeId
      employeeName
      restaurantId
      shiftType
      startTime
      endTime
      status
      notes
    }
  }
`;

const GET_LEAVE_REQUESTS = gql`
  query ScheduleLeaveRequests($filter: LeaveRequestFilterInput) {
    leaveRequests(filter: $filter) {
      id
      employeeId
      startDate
      endDate
      startSession
      endSession
      status
    }
  }
`;

const GET_SCHEDULING_ASSISTANT = gql`
  query StaffSchedulingAssistant(
    $restaurantId: ID!
    $horizonDays: Int!
    $timezone: String!
  ) {
    staffSchedulingAssistant(
      restaurantId: $restaurantId
      horizonDays: $horizonDays
      timezone: $timezone
    ) {
      summary {
        totalShiftGroups
        underStaffedShifts
        overStaffedShifts
        highestRiskShift
        notes
      }
      shifts {
        shiftKey
        date
        shiftType
        demandLevel
        expectedOrders
        expectedGuests
        recommendedTotalStaff
        currentAssignedStaff
        deltaStaff
        status
        severity
        confidence
        recommendedRoles {
          role
          required
          assigned
          delta
        }
        suggestedCandidates {
          staffId
          fullName
          role
          reason
        }
      }
      meta {
        method
        basedOnForecast
        fallbackUsed
        generatedAt
        timezone
      }
    }
  }
`;

const CREATE_STAFF_SHIFT = gql`
  mutation CreateStaffShift($input: CreateStaffShiftInput!) {
    createStaffShift(input: $input) {
      id
    }
  }
`;

const UPDATE_STAFF_SHIFT = gql`
  mutation UpdateStaffShift($shiftId: ID!, $input: UpdateStaffShiftInput!) {
    updateStaffShift(shiftId: $shiftId, input: $input) {
      id
      startTime
      endTime
      notes
      status
    }
  }
`;

const DELETE_STAFF_SHIFT = gql`
  mutation DeleteStaffShift($shiftId: ID!) {
    deleteStaffShift(shiftId: $shiftId)
  }
`;

const SCHEDULING_TIMEZONE = "Asia/Ho_Chi_Minh";

const DEPARTMENT_LABELS = {
  service: "Phục vụ",
  kitchen: "Bếp",
  cashier: "Thu ngân",
  cleaning: "Vệ sinh",
  delivery: "Giao hàng",
  management: "Quản lý",
  inventory: "Kho",
  bar: "Quầy bar",
};

const normalizeTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "HH:mm");
};
const stripTypenameDeep = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripTypenameDeep);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, val]) => {
      if (key === "__typename") return acc;
      acc[key] = stripTypenameDeep(val);
      return acc;
    }, {});
  }

  return value;
};
const isValidTimeValue = (value) => /^\d{2}:\d{2}$/.test(String(value || ""));

const rangesOverlap = (leftStart, leftEnd, rightStart, rightEnd) =>
  leftStart < rightEnd && rightStart < leftEnd;

const formatCurrency = (value) =>
  `${Math.round(Number(value || 0)).toLocaleString("vi-VN")} đ`;

const compactNumber = (value, digits = 1) =>
  new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: digits,
  }).format(Number(value || 0));

const getDepartmentLabel = (value) =>
  DEPARTMENT_LABELS[String(value || "").toLowerCase()] || "Khác";
const POLICY_SHIFT_ICON_MAP = {
  morning: "🌅",
  afternoon: "☀️",
  evening: "🌙",
  night: "🌃",
};

const policyTemplatesToShiftRules = (templates = []) =>
  templates
    .filter((item) => item.enabled !== false)
    .map((item) => ({
      type: String(item.key || "").toLowerCase(),
      label: item.label || item.key,
      startTime: item.startTime,
      endTime: item.endTime,
      time: `${item.startTime} - ${item.endTime}`,
      icon: POLICY_SHIFT_ICON_MAP[String(item.key || "").toLowerCase()] || "🕒",
    }));
const buildShiftRange = ({ date, startTimeText, endTimeText }) => {
  if (
    !date ||
    !isValidTimeValue(startTimeText) ||
    !isValidTimeValue(endTimeText)
  ) {
    throw new Error("Giờ bắt đầu/kết thúc không hợp lệ.");
  }

  if (startTimeText === endTimeText) {
    throw new Error("Giờ kết thúc phải khác giờ bắt đầu.");
  }

  const [year, month, day] = date.split("-").map(Number);
  const [startHour, startMin] = startTimeText.split(":").map(Number);
  const [endHour, endMin] = endTimeText.split(":").map(Number);
  const startTime = new Date(year, month - 1, day, startHour, startMin, 0, 0);
  const endTime = new Date(year, month - 1, day, endHour, endMin, 0, 0);

  if (endTime <= startTime) {
    endTime.setDate(endTime.getDate() + 1);
  }

  return { startTime, endTime };
};

const getShiftHoursFromGroup = (shift) => {
  try {
    const { startTime, endTime } = buildShiftRange({
      date: shift.date,
      startTimeText: shift.startTime,
      endTimeText: shift.endTime,
    });
    return calculateShiftHours(startTime, endTime);
  } catch {
    return 0;
  }
};

const buildVisibleScheduleInsights = ({ shifts, staff }) => {
  const staffById = new Map(staff.map((person) => [String(person.id), person]));
  const issues = [];
  const costByDepartment = new Map();
  const hoursByStaff = new Map();
  const recordsByStaff = new Map();

  let totalCost = 0;
  let totalHours = 0;
  let totalAssignments = 0;

  shifts.forEach((shift) => {
    const shiftHours = getShiftHoursFromGroup(shift);
    const requiredPeople = Math.max(1, shift.essentialJobs.length);
    const assignedPeople = shift.staffIds.length;
    const missingCount = Math.max(0, requiredPeople - assignedPeople);

    if (assignedPeople === 0) {
      issues.push({
        id: `${shift.id}-empty`,
        type: "missing",
        level: "warning",
        title: "Ca chưa có nhân sự",
        description: `${shift.date} • ${shift.startTime} - ${shift.endTime}`,
      });
    } else if (missingCount > 0) {
      issues.push({
        id: `${shift.id}-missing`,
        type: "missing",
        level: "warning",
        title: `Ca thiếu ${missingCount} người`,
        description: `${shift.date} • ${shift.startTime} - ${shift.endTime}`,
      });
    }

    shift.staffIds.forEach((staffId) => {
      const person = staffById.get(String(staffId));
      if (!person) return;

      const hourlyRate = Number(person.hourlyRate || person.salary || 0);
      const assignmentCost = hourlyRate * shiftHours;
      const departmentLabel = getDepartmentLabel(person.department);

      totalAssignments += 1;
      totalHours += shiftHours;
      totalCost += assignmentCost;

      costByDepartment.set(
        departmentLabel,
        Number(
          (
            Number(costByDepartment.get(departmentLabel) || 0) + assignmentCost
          ).toFixed(2),
        ),
      );

      hoursByStaff.set(
        String(staffId),
        Number(
          (Number(hoursByStaff.get(String(staffId)) || 0) + shiftHours).toFixed(
            2,
          ),
        ),
      );
    });

    shift.records.forEach((record) => {
      const staffKey = String(record.employeeId || "");
      if (!staffKey) return;
      if (!recordsByStaff.has(staffKey)) {
        recordsByStaff.set(staffKey, []);
      }
      recordsByStaff.get(staffKey).push(record);
    });
  });

  recordsByStaff.forEach((records, staffId) => {
    const sortedRecords = [...records].sort(
      (left, right) =>
        new Date(left.startTime).getTime() -
        new Date(right.startTime).getTime(),
    );

    for (let index = 1; index < sortedRecords.length; index += 1) {
      const previous = sortedRecords[index - 1];
      const current = sortedRecords[index];
      const previousStart = new Date(previous.startTime);
      const previousEnd = new Date(previous.endTime);
      const currentStart = new Date(current.startTime);
      const currentEnd = new Date(current.endTime);

      if (
        !Number.isNaN(previousStart.getTime()) &&
        !Number.isNaN(previousEnd.getTime()) &&
        !Number.isNaN(currentStart.getTime()) &&
        !Number.isNaN(currentEnd.getTime()) &&
        rangesOverlap(previousStart, previousEnd, currentStart, currentEnd)
      ) {
        const person = staffById.get(String(staffId));
        issues.push({
          id: `${staffId}-${previous.id}-${current.id}-overlap`,
          type: "overlap",
          level: "danger",
          title: "Nhân viên bị trùng ca",
          description: `${person?.name || "Nhân viên"} có 2 ca chồng thời gian.`,
        });
      }
    }
  });

  const busiestStaff = Array.from(hoursByStaff.entries())
    .map(([staffId, hours]) => ({
      staffId,
      hours,
      name: staffById.get(String(staffId))?.name || "Nhân viên",
    }))
    .sort((left, right) => right.hours - left.hours)
    .slice(0, 5);

  const costBreakdown = Array.from(costByDepartment.entries())
    .map(([department, amount]) => ({ department, amount }))
    .sort((left, right) => right.amount - left.amount);

  return {
    totalShiftGroups: shifts.length,
    totalAssignments,
    totalHours: Number(totalHours.toFixed(2)),
    totalCost: Number(totalCost.toFixed(2)),
    averageHoursPerAssignment:
      totalAssignments > 0
        ? Number((totalHours / totalAssignments).toFixed(2))
        : 0,
    actionCount: issues.length,
    issues,
    costBreakdown,
    busiestStaff,
  };
};

const ScheduleManagement = ({ readOnly = false }) => {
  const { showNotification } = useNotification();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("week");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [shiftRules, setShiftRules] = useState(() => loadStoredShiftRules());
  const [isShiftSettingsOpen, setIsShiftSettingsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalContext, setAddModalContext] = useState({
    date: "",
    shiftType: "",
  });
  const [selectedShift, setSelectedShift] = useState(null);
  const [isStatsPanelOpen, setIsStatsPanelOpen] = useState(false);
  const [isAutoScheduleOpen, setIsAutoScheduleOpen] = useState(false);
  const [autoScheduleConfig, setAutoScheduleConfig] = useState({
    horizonDays: 7,
    weeklyHoursCap: 40,
    respectAvailability: true,
    avoidOvertime: true,
  });
  const [assistantPayload, setAssistantPayload] = useState(null);
  const [assistantLeaveRows, setAssistantLeaveRows] = useState([]);
  const [assistantShiftRows, setAssistantShiftRows] = useState([]);
  const [selectedAutoShiftKeys, setSelectedAutoShiftKeys] = useState({});
  const [autoScheduleError, setAutoScheduleError] = useState("");
  const [isApplyingAutoSchedule, setIsApplyingAutoSchedule] = useState(false);
  const [validatedAutoSchedulePreview, setValidatedAutoSchedulePreview] =
    useState(null);
  const [isValidatingAutoSchedule, setIsValidatingAutoSchedule] =
    useState(false);
  const { data: meData } = useQuery(ME_QUERY, { fetchPolicy: "network-only" });
  const me = meData?.me;

  const { data: allRestaurantsData } = useQuery(GET_ALL_RESTAURANTS, {
    variables: { limit: 100 },
    skip: me?.roleName !== "admin",
    fetchPolicy: "network-only",
  });

  const restaurantOptions = useMemo(() => {
    if (me?.roleName === "admin") {
      return (allRestaurantsData?.restaurants?.edges || []).map(
        (edge) => edge.node,
      );
    }
    return (me?.refRestaurants || []).map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name,
    }));
  }, [allRestaurantsData, me]);

  const effectiveRestaurantId =
    selectedRestaurantId ||
    me?.restaurantForStaff ||
    restaurantOptions[0]?.id ||
    "";
  const {
    policy: schedulingPolicy,
    loading: schedulingPolicyLoading,
    updateSchedulingPolicy,
    updateState: updateSchedulingPolicyState,
    validateShiftAssignment,
  } = useSchedulingPolicy({
    restaurantId: effectiveRestaurantId,
  });
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const rangeStart =
    viewMode === "week"
      ? weekStart
      : viewMode === "month"
        ? monthStart
        : currentDate;
  const rangeEnd =
    viewMode === "week"
      ? weekEnd
      : viewMode === "month"
        ? monthEnd
        : currentDate;

  const configuredShiftTypes = useMemo(
    () => shiftRulesToTypes(shiftRules),
    [shiftRules],
  );
  const configuredShiftKeys = useMemo(
    () => Object.keys(configuredShiftTypes),
    [configuredShiftTypes],
  );

  const { data: staffData, loading: staffLoading } = useQuery(GET_STAFF_LIST, {
    variables: { restaurantId: effectiveRestaurantId || undefined },
    fetchPolicy: "network-only",
    skip: !effectiveRestaurantId,
  });

  const {
    data: shiftsData,
    loading: shiftsLoading,
    error: shiftsError,
    refetch,
  } = useQuery(GET_STAFF_SHIFTS, {
    variables: {
      restaurantId: effectiveRestaurantId || undefined,
      employeeId: selectedStaffId || undefined,
      startDate: rangeStart.toISOString(),
      endDate: rangeEnd.toISOString(),
    },
    fetchPolicy: "network-only",
    skip: !effectiveRestaurantId,
  });

  const [createShift] = useMutation(CREATE_STAFF_SHIFT);
  const [updateShift] = useMutation(UPDATE_STAFF_SHIFT);
  const [deleteShift] = useMutation(DELETE_STAFF_SHIFT);

  const [loadSchedulingAssistant, schedulingAssistantState] = useLazyQuery(
    GET_SCHEDULING_ASSISTANT,
    {
      fetchPolicy: "network-only",
    },
  );
  const [loadLeaveRequests, leaveRequestsState] = useLazyQuery(
    GET_LEAVE_REQUESTS,
    {
      fetchPolicy: "network-only",
    },
  );
  const [loadAssistantContextShifts, assistantContextState] = useLazyQuery(
    GET_STAFF_SHIFTS,
    {
      fetchPolicy: "network-only",
    },
  );

  const rawStaffList = useMemo(
    () => staffData?.staffList || [],
    [staffData?.staffList],
  );

  const staff = useMemo(
    () =>
      rawStaffList.map((item) => {
        const hourlyRate = Number(item.baseSalary || 0) / 26 / 8;

        return {
          id: item.id,
          name: item.fullName || "Nhân viên",
          fullName: item.fullName || "Nhân viên",
          employeeCode: item.employeeCode || "",
          department: item.department,
          job: mapDepartmentToJob(item.department),
          status: item.employmentStatus === "working" ? "active" : "off",
          employmentStatus: item.employmentStatus,
          employmentType: item.employmentType,
          workingDays: item.workingDays || [],
          hourlyRate,
          salary: hourlyRate,
        };
      }),
    [rawStaffList],
  );

  const shifts = useMemo(() => {
    const rows = shiftsData?.staffShifts || [];
    const map = new Map();

    rows.forEach((row) => {
      const date = format(new Date(row.startTime), "yyyy-MM-dd");
      const key = `${date}|${String(row.shiftType || "").toLowerCase()}`;

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          date,
          day: format(new Date(row.startTime), "EEEE").toLowerCase(),
          shiftType: String(row.shiftType || "").toLowerCase(),
          startTime: normalizeTime(row.startTime),
          endTime: normalizeTime(row.endTime),
          essentialJobs: [],
          staffIds: [],
          notes: row.notes || "",
          records: [],
        });
      }

      const bucket = map.get(key);
      bucket.records.push(row);
      bucket.staffIds.push(row.employeeId);

      const staffItem = staff.find(
        (item) => String(item.id) === String(row.employeeId),
      );
      if (staffItem?.job && !bucket.essentialJobs.includes(staffItem.job)) {
        bucket.essentialJobs.push(staffItem.job);
      }
    });

    return Array.from(map.values()).sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.shiftType.localeCompare(right.shiftType),
    );
  }, [shiftsData, staff]);

  const dateLabel = useMemo(() => {
    if (viewMode === "week") {
      return `Tuần ${format(weekStart, "w")}, ${format(weekStart, "yyyy")} (${format(
        weekStart,
        "dd/MM",
      )} - ${format(weekEnd, "dd/MM")})`;
    }
    if (viewMode === "month") {
      return `Tháng ${format(currentDate, "MM/yyyy")}`;
    }
    return format(currentDate, "EEEE, dd/MM/yyyy", { locale: vi });
  }, [currentDate, viewMode, weekEnd, weekStart]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const scheduleInsights = useMemo(
    () => buildVisibleScheduleInsights({ shifts, staff }),
    [shifts, staff],
  );

  const rawAutoSchedulePreview = useMemo(
    () =>
      buildAutoSchedulePreview({
        assistant: assistantPayload,
        staffList: rawStaffList,
        existingShiftRows: assistantShiftRows,
        leaveRequests: assistantLeaveRows,
        weeklyHoursCap: autoScheduleConfig.weeklyHoursCap,
        respectAvailability: autoScheduleConfig.respectAvailability,
        avoidOvertime: autoScheduleConfig.avoidOvertime,
        shiftConfig: configuredShiftTypes,
      }),
    [
      assistantLeaveRows,
      assistantPayload,
      assistantShiftRows,
      autoScheduleConfig,
      configuredShiftTypes,
      rawStaffList,
    ],
  );

  const autoSchedulePreview =
    validatedAutoSchedulePreview || rawAutoSchedulePreview;

  const isGeneratingAutoSchedule =
    schedulingAssistantState.loading ||
    leaveRequestsState.loading ||
    assistantContextState.loading ||
    isValidatingAutoSchedule;
  useEffect(() => {
    if (!isAutoScheduleOpen) return;

    setSelectedAutoShiftKeys((prev) => {
      const next = {};
      (autoSchedulePreview.items || []).forEach((item) => {
        if (item.canApply) {
          next[item.shiftKey] = prev[item.shiftKey] ?? true;
        }
      });
      return next;
    });
  }, [autoSchedulePreview.items, isAutoScheduleOpen]);

  useEffect(() => {
    setAssistantPayload(null);
    setAssistantLeaveRows([]);
    setAssistantShiftRows([]);
    setSelectedAutoShiftKeys({});
    setAutoScheduleError("");
    setValidatedAutoSchedulePreview(null);
  }, [effectiveRestaurantId]);
  useEffect(() => {
    setValidatedAutoSchedulePreview(null);
  }, [autoScheduleConfig, configuredShiftTypes]);
  useEffect(() => {
    if (!schedulingPolicy?.shiftTemplates?.length) return;

    const nextRules = policyTemplatesToShiftRules(
      schedulingPolicy.shiftTemplates,
    );

    if (!nextRules.length) return;

    setShiftRules(nextRules);
    persistShiftRules(nextRules);
  }, [schedulingPolicy?.shiftTemplates]);
  const handleNavigate = (direction) => {
    if (viewMode === "week") {
      setCurrentDate((prev) =>
        direction === "next" ? addWeeks(prev, 1) : subWeeks(prev, 1),
      );
      return;
    }
    if (viewMode === "month") {
      setCurrentDate((prev) =>
        direction === "next" ? addMonths(prev, 1) : subMonths(prev, 1),
      );
      return;
    }
    setCurrentDate((prev) =>
      direction === "next" ? addDays(prev, 1) : subDays(prev, 1),
    );
  };

  const getGraphQLErrorMessage = (error, fallback) => {
    const graphQLError =
      error?.graphQLErrors?.[0]?.message ||
      error?.networkError?.result?.errors?.[0]?.message;

    return graphQLError || error?.message || fallback;
  };

  const handleApplyShiftRules = async (nextRules, policyInput) => {
    const validation = validateShiftRules(nextRules);

    if (!validation.ok) {
      showNotification(
        validation.message ||
          "Quy tắc xếp lịch chưa hợp lệ. Vui lòng kiểm tra lại.",
        "warning",
      );
      return;
    }

    try {
      if (effectiveRestaurantId && policyInput) {
        await updateSchedulingPolicy({
          variables: {
            restaurantId: effectiveRestaurantId,
            input: stripTypenameDeep(policyInput),
          },
        });
      }

      setShiftRules(nextRules);
      persistShiftRules(nextRules);

      setIsShiftSettingsOpen(false);
      showNotification("Đã lưu quy tắc xếp lịch thành công.", "success");
    } catch (error) {
      console.error(error);
      showNotification(
        getGraphQLErrorMessage(
          error,
          "Không thể lưu quy tắc xếp lịch. Vui lòng thử lại.",
        ),
        "error",
      );
    }
  };

  const overlapsExistingShiftGroup = ({
    date,
    shiftGroupId,
    startTime,
    endTime,
  }) =>
    shifts.some((shift) => {
      if (shift.id === shiftGroupId || shift.date !== date) return false;
      const other = buildShiftRange({
        date: shift.date,
        startTimeText: shift.startTime,
        endTimeText: shift.endTime,
      });
      return rangesOverlap(startTime, endTime, other.startTime, other.endTime);
    });

  const openAddShiftModal = (dateObj, shiftType) => {
    if (readOnly) return;
    setAddModalContext({ date: format(dateObj, "yyyy-MM-dd"), shiftType });
    setIsAddModalOpen(true);
  };
  const formatAssignmentIssue = (issue) => {
    const message = issue?.message || "Có vấn đề với phân công ca.";
    const action = issue?.suggestedAction
      ? `\nGợi ý: ${issue.suggestedAction}`
      : "";
    return `- ${message}${action}`;
  };

  const validateShiftAssignmentOrThrow = async ({
    employeeId,
    shiftType,
    startTime,
    endTime,
    ignoreShiftId,
    precheckOnly = false,
  }) => {
    const baseInput = {
      employeeId,
      restaurantId: effectiveRestaurantId,
      shiftType: String(shiftType || "").toUpperCase(),
      startTime:
        startTime instanceof Date ? startTime.toISOString() : startTime,
      endTime: endTime instanceof Date ? endTime.toISOString() : endTime,
      ignoreShiftId: ignoreShiftId || undefined,
    };

    const result = await validateShiftAssignment({
      variables: {
        input: {
          ...baseInput,
          // Cho phép backend trả warning cho soft rule thay vì biến thành blocking error.
          // Đây chỉ là precheck, chưa ghi DB.
          allowOverride: true,
          overrideReason: precheckOnly
            ? "__AUTO_SCHEDULE_PREVIEW__"
            : "__SHIFT_ASSIGNMENT_PRECHECK__",
        },
      },
    });

    const validation = result?.data?.validateShiftAssignment;

    if (!validation) {
      throw new Error("Không nhận được kết quả kiểm tra phân công ca.");
    }

    if (!validation.ok) {
      const text = validation.blockingErrors
        .map(formatAssignmentIssue)
        .join("\n\n");

      throw new Error(text || "Không thể xếp ca vì vi phạm quy tắc lịch.");
    }

    if (precheckOnly) {
      return {
        allowOverride: false,
        overrideReason: "",
        validation,
      };
    }

    if (validation.warnings?.length) {
      const warningText = validation.warnings
        .map(formatAssignmentIssue)
        .join("\n\n");

      const employeeName =
        staff.find((person) => String(person.id) === String(employeeId))
          ?.name || "nhân viên";

      const reason = window.prompt(
        `Có cảnh báo khi xếp ca cho ${employeeName}:\n\n${warningText}\n\nNhập lý do override để tiếp tục:`,
      );

      if (!reason || !reason.trim()) {
        throw new Error("Đã hủy thao tác vì chưa nhập lý do override.");
      }

      return {
        allowOverride: true,
        overrideReason: reason.trim(),
        validation,
      };
    }

    return {
      allowOverride: false,
      overrideReason: "",
      validation,
    };
  };
  const handleCreateShift = async (newShiftData) => {
    if (readOnly) return;

    const config = configuredShiftTypes[newShiftData.shiftType];
    if (!config || !effectiveRestaurantId) return;

    if (!(newShiftData.staffIds || []).length) {
      throw new Error("Cần chọn ít nhất một nhân viên để tạo ca.");
    }

    const { startTime, endTime } = buildShiftRange({
      date: newShiftData.date,
      startTimeText: config.startTime,
      endTimeText: config.endTime,
    });
    const overrideByEmployee = new Map();

    for (const employeeId of newShiftData.staffIds || []) {
      const override = await validateShiftAssignmentOrThrow({
        employeeId,
        shiftType: newShiftData.shiftType,
        startTime,
        endTime,
      });

      overrideByEmployee.set(String(employeeId), override);
    }

    await Promise.all(
      (newShiftData.staffIds || []).map((employeeId) => {
        const override = overrideByEmployee.get(String(employeeId)) || {};

        return createShift({
          variables: {
            input: {
              employeeId,
              restaurantId: effectiveRestaurantId,
              shiftType: newShiftData.shiftType.toUpperCase(),
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              status: "scheduled",
              notes: newShiftData.notes || "",
              allowOverride: Boolean(override.allowOverride),
              overrideReason: override.overrideReason || undefined,
            },
          },
        });
      }),
    );

    await refetch();
    setIsAddModalOpen(false);
  };

  const handleDeleteShift = async (shiftGroupId) => {
    if (readOnly) return;
    const found = shifts.find((item) => item.id === shiftGroupId);
    if (!found) return;
    await Promise.all(
      found.records.map((row) =>
        deleteShift({ variables: { shiftId: row.id } }),
      ),
    );
    await refetch();
    setSelectedShift(null);
  };

  const handleRemoveStaff = async (shiftGroupId, staffId) => {
    if (readOnly) return;
    const found = shifts.find((item) => item.id === shiftGroupId);
    const targetRecord = found?.records?.find(
      (record) => String(record.employeeId) === String(staffId),
    );
    if (!targetRecord) return;
    await deleteShift({ variables: { shiftId: targetRecord.id } });
    await refetch();
    setSelectedShift(null);
  };

  const handleAddStaff = async (shiftGroupId, staffId) => {
    if (readOnly) return;
    const found = shifts.find((item) => item.id === shiftGroupId);
    if (!found || !effectiveRestaurantId) return;
    if (found.staffIds.some((id) => String(id) === String(staffId))) return;

    const { startTime, endTime } = buildShiftRange({
      date: found.date,
      startTimeText: found.startTime,
      endTimeText: found.endTime,
    });

    const override = await validateShiftAssignmentOrThrow({
      employeeId: staffId,
      shiftType: found.shiftType,
      startTime,
      endTime,
    });

    await createShift({
      variables: {
        input: {
          employeeId: staffId,
          restaurantId: effectiveRestaurantId,
          shiftType: found.shiftType.toUpperCase(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          status: "scheduled",
          notes: found.notes || "",
          allowOverride: Boolean(override.allowOverride),
          overrideReason: override.overrideReason || undefined,
        },
      },
    });
    await refetch();
    setSelectedShift(null);
  };

  const handleUpdateSelectedNotes = async (notes) => {
    if (readOnly) return;
    if (!selectedShift?.records?.length) return;
    await Promise.all(
      selectedShift.records.map((record) =>
        updateShift({ variables: { shiftId: record.id, input: { notes } } }),
      ),
    );
    await refetch();
    setSelectedShift(null);
  };

  const handleUpdateSelectedTime = async ({ startTime, endTime }) => {
    if (readOnly) return;
    if (!selectedShift?.records?.length) return;

    const { startTime: nextStart, endTime: nextEnd } = buildShiftRange({
      date: selectedShift.date,
      startTimeText: startTime,
      endTimeText: endTime,
    });

    if (
      overlapsExistingShiftGroup({
        date: selectedShift.date,
        shiftGroupId: selectedShift.id,
        startTime: nextStart,
        endTime: nextEnd,
      })
    ) {
      throw new Error("Thời gian ca đang chồng với ca khác trong ngày.");
    }
    const overrideByShiftId = new Map();

    for (const record of selectedShift.records) {
      const override = await validateShiftAssignmentOrThrow({
        employeeId: record.employeeId,
        shiftType: selectedShift.shiftType,
        startTime: nextStart,
        endTime: nextEnd,
        ignoreShiftId: record.id,
      });

      overrideByShiftId.set(String(record.id), override);
    }
    await Promise.all(
      selectedShift.records.map((record) =>
        updateShift({
          variables: {
            shiftId: record.id,
            input: {
              startTime: nextStart.toISOString(),
              endTime: nextEnd.toISOString(),
              allowOverride: Boolean(
                overrideByShiftId.get(String(record.id))?.allowOverride,
              ),
              overrideReason:
                overrideByShiftId.get(String(record.id))?.overrideReason ||
                undefined,
            },
          },
        }),
      ),
    );
    await refetch();
    setSelectedShift(null);
  };

  const validateAutoSchedulePreview = async (preview) => {
    const sourceItems = preview?.items || [];

    if (!sourceItems.length) {
      return preview;
    }

    setIsValidatingAutoSchedule(true);

    let recommendedAssignments = 0;
    let blockedAssignments = Number(preview?.summary?.blockedAssignments || 0);
    let warningAssignments = 0;
    let unresolvedShifts = 0;

    try {
      const items = [];

      for (const item of sourceItems) {
        const plannedAssignments = [];
        const blockedCandidates = [...(item.blockedCandidates || [])];

        for (const assignment of item.plannedAssignments || []) {
          try {
            const result = await validateShiftAssignmentOrThrow({
              employeeId: assignment.staffId,
              shiftType: item.shiftType,
              startTime: item.startTime,
              endTime: item.endTime,
              precheckOnly: true,
            });

            const validation = result.validation;
            const warnings = validation?.warnings || [];

            if (warnings.length > 0) {
              warningAssignments += 1;
            }

            plannedAssignments.push({
              ...assignment,
              backendValidated: true,
              validationScore: validation?.score ?? null,
              validationWarnings: warnings,
              validationMetrics: validation?.metrics || null,
              requiresOverride: warnings.length > 0,
            });

            recommendedAssignments += 1;
          } catch (error) {
            blockedAssignments += 1;

            blockedCandidates.push({
              staffId: String(assignment.staffId),
              fullName: assignment.fullName || "Nhân viên",
              role: assignment.role,
              reason:
                error?.message ||
                "Không đạt kiểm tra quy tắc xếp lịch từ backend.",
              source: "backend_validation",
            });
          }
        }

        if (unresolvedCount > 0) {
          unresolvedShifts += 1;
        }

        const existingUnfilledRoles = item.unfilledRoles || [];

        const backendBlockedByRole = blockedCandidates.reduce(
          (map, candidate) => {
            const role = String(candidate.role || "");
            if (!role) return map;

            if (!map.has(role)) {
              map.set(role, []);
            }

            map.get(role).push(candidate);
            return map;
          },
          new Map(),
        );

        const unfilledRoles = existingUnfilledRoles.map((roleRow) => {
          const role = String(roleRow.role || "");
          const extraBlocked = backendBlockedByRole.get(role) || [];
          const allBlocked = [
            ...(roleRow.blockedCandidates || []),
            ...extraBlocked.filter(
              (candidate) =>
                !(roleRow.blockedCandidates || []).some(
                  (existing) =>
                    String(existing.staffId) === String(candidate.staffId),
                ),
            ),
          ];

          return {
            ...roleRow,
            blockedCandidates: allBlocked,
            blockedCount: allBlocked.length,
          };
        });

        const plannedByRole = plannedAssignments.reduce((map, assignment) => {
          const role = String(assignment.role || "");
          map.set(role, Number(map.get(role) || 0) + 1);
          return map;
        }, new Map());

        const normalizedUnfilledRoles = unfilledRoles.map((roleRow) => {
          const planned = Number(
            plannedByRole.get(String(roleRow.role || "")) || 0,
          );
          const unresolved = Math.max(
            0,
            Number(roleRow.missing || 0) - planned,
          );

          return {
            ...roleRow,
            planned,
            unresolved,
          };
        });

        const unresolvedCount = normalizedUnfilledRoles.reduce(
          (sum, roleRow) => sum + Number(roleRow.unresolved || 0),
          0,
        );

        items.push({
          ...item,
          plannedAssignments,
          blockedCandidates,
          unfilledRoles: normalizedUnfilledRoles,
          unresolvedCount,
          canApply: plannedAssignments.length > 0,
        });
      }

      return {
        ...preview,
        items,
        summary: {
          ...(preview.summary || {}),
          recommendedAssignments,
          blockedAssignments,
          warningAssignments,
          unresolvedShifts,
        },
      };
    } finally {
      setIsValidatingAutoSchedule(false);
    }
  };
  const handleGenerateAutoSchedule = async () => {
    if (readOnly) return;

    if (!effectiveRestaurantId) {
      setAutoScheduleError(
        "Chưa xác định được nhà hàng để gọi scheduling assistant.",
      );
      showNotification(
        "Chưa xác định được nhà hàng để tạo preview chia ca.",
        "warning",
      );
      return;
    }

    setAutoScheduleError("");
    setValidatedAutoSchedulePreview(null);
    setSelectedAutoShiftKeys({});

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const analysisEnd = addDays(
      today,
      Math.max(0, Number(autoScheduleConfig.horizonDays || 1) - 1),
    );

    const contextStart = startOfWeek(today, { weekStartsOn: 1 });
    const contextEnd = endOfWeek(analysisEnd, { weekStartsOn: 1 });

    try {
      const [assistantResult, leaveResult, shiftResult] = await Promise.all([
        loadSchedulingAssistant({
          variables: {
            restaurantId: effectiveRestaurantId,
            horizonDays: Number(autoScheduleConfig.horizonDays || 1),
            timezone: SCHEDULING_TIMEZONE,
          },
        }),
        loadLeaveRequests({
          variables: {
            filter: {
              restaurantId: effectiveRestaurantId,
              startDate: today.toISOString(),
              endDate: analysisEnd.toISOString(),
            },
          },
        }),
        loadAssistantContextShifts({
          variables: {
            restaurantId: effectiveRestaurantId,
            startDate: contextStart.toISOString(),
            endDate: contextEnd.toISOString(),
          },
        }),
      ]);

      const nextAssistantPayload =
        assistantResult?.data?.staffSchedulingAssistant || null;
      const nextLeaveRows = leaveResult?.data?.leaveRequests || [];
      const nextShiftRows = shiftResult?.data?.staffShifts || [];

      setAssistantPayload(nextAssistantPayload);
      setAssistantLeaveRows(nextLeaveRows);
      setAssistantShiftRows(nextShiftRows);

      const nextRawPreview = buildAutoSchedulePreview({
        assistant: nextAssistantPayload,
        staffList: rawStaffList,
        existingShiftRows: nextShiftRows,
        leaveRequests: nextLeaveRows,
        weeklyHoursCap: autoScheduleConfig.weeklyHoursCap,
        respectAvailability: autoScheduleConfig.respectAvailability,
        avoidOvertime: autoScheduleConfig.avoidOvertime,
        shiftConfig: configuredShiftTypes,
      });

      const nextValidatedPreview =
        await validateAutoSchedulePreview(nextRawPreview);

      setValidatedAutoSchedulePreview(nextValidatedPreview);

      const readyCount = Number(
        nextValidatedPreview?.summary?.recommendedAssignments || 0,
      );
      const warningCount = Number(
        nextValidatedPreview?.summary?.warningAssignments || 0,
      );
      const blockedCount = Number(
        nextValidatedPreview?.summary?.blockedAssignments || 0,
      );

      if (readyCount <= 0) {
        showNotification(
          "Đã tạo preview nhưng chưa có phân công nào đủ điều kiện áp dụng.",
          "warning",
        );
        return;
      }

      showNotification(
        `Đã tạo preview: ${readyCount} phân công hợp lệ, ${warningCount} cảnh báo, ${blockedCount} bị chặn.`,
        warningCount > 0 ? "warning" : "success",
      );
    } catch (error) {
      const message =
        error?.message || "Không thể tạo preview chia ca tự động.";

      setAutoScheduleError(message);
      showNotification(message, "error");
    }
  };

  const handleToggleAutoShift = (shiftKey) => {
    setSelectedAutoShiftKeys((prev) => ({
      ...prev,
      [shiftKey]: !prev[shiftKey],
    }));
  };

  const handleApplyAutoSchedule = async () => {
    const inputs = buildAutoScheduleCreateInputs({
      previewItems: autoSchedulePreview.items,
      selectedShiftKeys: selectedAutoShiftKeys,
      restaurantId: effectiveRestaurantId,
    });

    if (!inputs.length) {
      setAutoScheduleError("Không có phân công hợp lệ để áp dụng.");
      showNotification("Không có phân công hợp lệ để áp dụng.", "warning");
      return;
    }

    setIsApplyingAutoSchedule(true);
    setAutoScheduleError("");

    try {
      const validatedInputs = [];

      for (const input of inputs) {
        const override = await validateShiftAssignmentOrThrow({
          employeeId: input.employeeId,
          shiftType: input.shiftType,
          startTime: input.startTime,
          endTime: input.endTime,
        });

        validatedInputs.push({
          ...input,
          allowOverride: Boolean(override.allowOverride),
          overrideReason: override.overrideReason || undefined,
        });
      }

      await Promise.all(
        validatedInputs.map((input) =>
          createShift({
            variables: {
              input,
            },
          }),
        ),
      );

      await refetch();

      setIsAutoScheduleOpen(false);
      setSelectedAutoShiftKeys({});
      setValidatedAutoSchedulePreview(null);

      showNotification(
        `Đã áp dụng ${validatedInputs.length} phân công từ chia ca tự động.`,
        "success",
      );
    } catch (error) {
      const message = error?.message || "Không thể áp dụng gợi ý chia ca.";
      setAutoScheduleError(message);
      showNotification(message, "error");
    } finally {
      setIsApplyingAutoSchedule(false);
    }
  };

  const selectedRestaurantName =
    restaurantOptions.find(
      (restaurant) => String(restaurant.id) === String(effectiveRestaurantId),
    )?.name || "Nhà hàng hiện tại";

  return (
    <div className={`schedule-container ${readOnly ? "read-only" : ""}`}>
      <header className="schedule-header">
        <div className="header-top">
          <div className="title-group">
            <div className="eyebrow-row">
              <span className="eyebrow">{selectedRestaurantName}</span>
              <span className="dot-divider">•</span>
              <span className="eyebrow">{dateLabel}</span>
            </div>
            <h1>
              {readOnly ? "Thông Tin Ca Làm Việc" : "Quản Lý Lịch Làm Việc"}
            </h1>
            <p className="subtitle">
              {readOnly
                ? "Xem lịch ca theo dữ liệu thật từ backend."
                : "Theo dõi ca thiếu người, chi phí dự kiến và xuất bản lịch làm việc."}
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setIsStatsPanelOpen((prev) => !prev)}
            >
              <BarChart3 size={17} />
              Thống kê
            </button>

            <button
              type="button"
              className="schedule-settings-trigger"
              onClick={() => {
                setIsShiftSettingsOpen(true);
              }}
              disabled={readOnly}
            >
              <Settings size={18} />
              <div className="user-info">
                <span className="name">{me?.roleName || "manager"}</span>
                <span className="role">
                  {readOnly ? "Chỉ xem" : "Cài đặt ca"}
                </span>
              </div>
            </button>
          </div>
        </div>

        <div className="kpi-grid compact">
          <button
            type="button"
            className={`kpi-card action ${scheduleInsights.actionCount > 0 ? "has-alert" : ""}`}
            onClick={() => setIsStatsPanelOpen(true)}
          >
            <div className="kpi-icon">
              <AlertTriangle size={20} />
            </div>
            <div className="kpi-content">
              <span className="label">Cần xử lý</span>
              <span className="value">{scheduleInsights.actionCount}</span>
              <span className="hint">Cảnh báo trong kỳ hiển thị</span>
            </div>
          </button>

          <button
            type="button"
            className="kpi-card hours"
            onClick={() => setIsStatsPanelOpen(true)}
          >
            <div className="kpi-icon">
              <Clock3 size={20} />
            </div>
            <div className="kpi-content">
              <span className="label">Tổng giờ dự kiến</span>
              <span className="value">
                {compactNumber(scheduleInsights.totalHours)}h
              </span>
              <span className="hint">
                {scheduleInsights.totalAssignments} lượt xếp ca
              </span>
            </div>
          </button>

          <button
            type="button"
            className="kpi-card money"
            onClick={() => setIsStatsPanelOpen(true)}
          >
            <div className="kpi-icon">
              <Wallet size={20} />
            </div>
            <div className="kpi-content">
              <span className="label">Chi phí dự kiến</span>
              <span className="value">
                {formatCurrency(scheduleInsights.totalCost)}
              </span>
              <span className="hint">Tính theo giờ ca thực tế</span>
            </div>
          </button>

          <button
            type="button"
            className="kpi-card status"
            onClick={() => setIsPublished((prev) => !prev)}
            disabled={readOnly}
          >
            <div className="kpi-icon">
              <CalendarCheck2 size={20} />
            </div>
            <div className="kpi-content">
              <span className="label">Trạng thái</span>
              <span className={`value ${isPublished ? "published" : "draft"}`}>
                {isPublished ? "Đã xuất bản" : "Bản nháp"}
              </span>
              <span className="hint">
                {readOnly ? "Chỉ xem" : "Bấm để đổi trạng thái"}
              </span>
            </div>
          </button>
        </div>
      </header>

      <div className="schedule-toolbar">
        <div className="toolbar-left">
          <div className="view-toggles">
            <button
              type="button"
              className={viewMode === "week" ? "active" : ""}
              onClick={() => setViewMode("week")}
            >
              Theo Tuần
            </button>
            <button
              type="button"
              className={viewMode === "day" ? "active" : ""}
              onClick={() => setViewMode("day")}
            >
              Theo Ngày
            </button>
            <button
              type="button"
              className={viewMode === "month" ? "active" : ""}
              onClick={() => setViewMode("month")}
            >
              Theo Tháng
            </button>
          </div>

          <div className="date-navigation">
            <button
              type="button"
              onClick={() => handleNavigate("prev")}
              className="nav-btn"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="week-label">{dateLabel}</span>
            <button
              type="button"
              onClick={() => handleNavigate("next")}
              className="nav-btn"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          <select
            value={selectedRestaurantId}
            onChange={(event) => setSelectedRestaurantId(event.target.value)}
          >
            <option value="">Nhà hàng hiện tại</option>
            {restaurantOptions.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStaffId}
            onChange={(event) => setSelectedStaffId(event.target.value)}
          >
            <option value="">Tất cả nhân viên</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>

          {!readOnly && (
            <button
              type="button"
              className="btn-auto-schedule"
              onClick={() => setIsAutoScheduleOpen(true)}
            >
              <Sparkles size={16} />
              Chia ca tự động
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              className={`btn-publish ${isPublished ? "published" : ""}`}
              onClick={() => setIsPublished((prev) => !prev)}
            >
              {isPublished ? "Chuyển về nháp" : "Xuất bản"}
            </button>
          )}
        </div>
      </div>

      {isStatsPanelOpen ? (
        <section className="schedule-insights-panel">
          <div className="insights-header">
            <div>
              <h3>Thống kê chi tiết</h3>
              <p>
                Thông tin phụ được tách khỏi KPI chính để giao diện lịch không
                bị rối.
              </p>
            </div>
            <button
              type="button"
              className="btn-close-panel"
              onClick={() => setIsStatsPanelOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <div className="insights-grid">
            <div className="insight-card">
              <span className="label">Nhóm ca</span>
              <strong>{scheduleInsights.totalShiftGroups}</strong>
            </div>
            <div className="insight-card">
              <span className="label">Lượt xếp ca</span>
              <strong>{scheduleInsights.totalAssignments}</strong>
            </div>
            <div className="insight-card">
              <span className="label">Giờ trung bình / lượt</span>
              <strong>
                {compactNumber(scheduleInsights.averageHoursPerAssignment)}h
              </strong>
            </div>
            <div className="insight-card">
              <span className="label">Chi phí / giờ</span>
              <strong>
                {scheduleInsights.totalHours > 0
                  ? formatCurrency(
                      scheduleInsights.totalCost / scheduleInsights.totalHours,
                    )
                  : "0 đ"}
              </strong>
            </div>
          </div>

          <div className="insights-columns">
            <div className="insight-block">
              <h4>Cần xử lý</h4>
              {scheduleInsights.issues.length ? (
                <ul className="issue-list">
                  {scheduleInsights.issues.slice(0, 8).map((issue) => (
                    <li key={issue.id} className={issue.level}>
                      <AlertTriangle size={14} />
                      <div>
                        <strong>{issue.title}</strong>
                        <span>{issue.description}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-mini">
                  Không có cảnh báo trong kỳ hiển thị.
                </div>
              )}
            </div>

            <div className="insight-block">
              <h4>Chi phí theo bộ phận</h4>
              {scheduleInsights.costBreakdown.length ? (
                <ul className="metric-list">
                  {scheduleInsights.costBreakdown.map((item) => (
                    <li key={item.department}>
                      <span>{item.department}</span>
                      <strong>{formatCurrency(item.amount)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-mini">Chưa có chi phí dự kiến.</div>
              )}
            </div>

            <div className="insight-block">
              <h4>Nhân viên nhiều giờ nhất</h4>
              {scheduleInsights.busiestStaff.length ? (
                <ul className="metric-list">
                  {scheduleInsights.busiestStaff.map((person) => (
                    <li key={person.staffId}>
                      <span>{person.name}</span>
                      <strong>{compactNumber(person.hours)}h</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-mini">Chưa có phân công.</div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {shiftsError ? (
        <div className="empty-state schedule-feedback">
          Không tải được lịch làm việc.
        </div>
      ) : viewMode === "day" ? (
        <DailyView
          currentDate={currentDate}
          shifts={shifts}
          staffList={staff}
          shiftConfig={configuredShiftTypes}
        />
      ) : viewMode === "month" ? (
        <div className="schedule-board month-board">
          {Array.from({ length: 42 }, (_, index) =>
            addDays(startOfWeek(monthStart, { weekStartsOn: 1 }), index),
          ).map((day) => {
            const dayStr = format(day, "yyyy-MM-dd");
            const shiftsForDay = shifts.filter(
              (shift) => shift.date === dayStr,
            );
            const isCurrentMonth = day >= monthStart && day <= monthEnd;

            return (
              <div
                className={`schedule-day-column ${isCurrentMonth ? "" : "muted-day"}`}
                key={dayStr}
              >
                <div
                  className={`day-header ${isSameDay(day, new Date()) ? "today" : ""}`}
                >
                  <span>{format(day, "EEE", { locale: vi })}</span>
                  <strong>{format(day, "dd/MM")}</strong>
                </div>
                <div className="day-body">
                  <div className="day-summary-pill">
                    {shiftsForDay.length} ca
                  </div>
                  {shiftsForDay.slice(0, 2).map((shift) => (
                    <ShiftCard
                      key={shift.id}
                      shift={shift}
                      staffList={staff}
                      onClick={setSelectedShift}
                    />
                  ))}
                  {shiftsForDay.length > 2 ? (
                    <button
                      type="button"
                      className="more-shifts-btn"
                      onClick={() => {
                        setCurrentDate(day);
                        setViewMode("day");
                      }}
                    >
                      +{shiftsForDay.length - 2} ca khác
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="schedule-board">
          {weekDays.map((day) => {
            const dayStr = format(day, "yyyy-MM-dd");
            const shiftsForDay = shifts.filter(
              (shift) => shift.date === dayStr,
            );

            return (
              <div className="schedule-day-column" key={dayStr}>
                <div
                  className={`day-header ${isSameDay(day, new Date()) ? "today" : ""}`}
                >
                  <div>
                    <span>{format(day, "EEE", { locale: vi })}</span>
                    <strong>{format(day, "dd/MM")}</strong>
                  </div>
                  <small>{shiftsForDay.length} ca</small>
                </div>
                <div className="day-body">
                  {Array.from(
                    new Set([
                      ...configuredShiftKeys,
                      ...shiftsForDay.map((item) => item.shiftType),
                    ]),
                  ).map((type) => {
                    const shiftConfig = configuredShiftTypes[type];
                    const shift = shiftsForDay.find(
                      (item) => item.shiftType === type,
                    );

                    return (
                      <div key={type} className="shift-slot">
                        {shift ? (
                          <ShiftCard
                            shift={shift}
                            staffList={staff}
                            onClick={setSelectedShift}
                          />
                        ) : readOnly ? (
                          <div className="empty-shift-slot">
                            Chưa phân{" "}
                            {shiftConfig?.label?.toLowerCase() || "ca"}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="add-shift-btn"
                            onClick={() => openAddShiftModal(day, type)}
                          >
                            + {shiftConfig?.label || "Ca"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(staffLoading || shiftsLoading) && (
        <div className="empty-state schedule-feedback">
          Đang tải dữ liệu lịch làm việc...
        </div>
      )}

      {!readOnly && (
        <AddShiftModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          selectedDate={addModalContext.date}
          selectedShiftType={addModalContext.shiftType}
          shiftConfig={configuredShiftTypes}
          staffList={staff}
          onConfirm={handleCreateShift}
        />
      )}

      <ShiftDetailModal
        isOpen={Boolean(selectedShift)}
        onClose={() => setSelectedShift(null)}
        shift={selectedShift}
        staffList={staff}
        readOnly={readOnly}
        onRemoveStaff={handleRemoveStaff}
        onAddStaff={handleAddStaff}
        onDeleteShift={handleDeleteShift}
        onUpdateNotes={handleUpdateSelectedNotes}
        onUpdateTime={handleUpdateSelectedTime}
        shiftConfig={configuredShiftTypes}
      />

      {!readOnly && (
        <ShiftRulesModal
          isOpen={isShiftSettingsOpen}
          onClose={() => setIsShiftSettingsOpen(false)}
          rules={shiftRules}
          policy={schedulingPolicy}
          policyLoading={schedulingPolicyLoading}
          policySaving={updateSchedulingPolicyState.loading}
          onApply={handleApplyShiftRules}
        />
      )}

      {!readOnly && (
        <AutoScheduleModal
          isOpen={isAutoScheduleOpen}
          onClose={() => setIsAutoScheduleOpen(false)}
          config={autoScheduleConfig}
          onConfigChange={setAutoScheduleConfig}
          onGenerate={handleGenerateAutoSchedule}
          generating={isGeneratingAutoSchedule}
          generateError={autoScheduleError}
          assistantMeta={assistantPayload?.meta || null}
          assistantSummary={assistantPayload?.summary || null}
          preview={autoSchedulePreview}
          selectedShiftKeys={selectedAutoShiftKeys}
          onToggleShift={handleToggleAutoShift}
          onApply={handleApplyAutoSchedule}
          applying={isApplyingAutoSchedule}
        />
      )}
    </div>
  );
};

export default ScheduleManagement;
