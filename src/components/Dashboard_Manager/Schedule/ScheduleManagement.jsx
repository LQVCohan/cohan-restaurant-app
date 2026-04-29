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
  Edit3,
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
const SCHEDULE_STATUS_LABELS = {
  draft: "Bản nháp",
  published: "Đã công bố",
  active: "Đang hoạt động",
  locked: "Đã khóa",
  revision_draft: "Đang chỉnh sửa lại",
  closed: "Đã đóng",
};

const GET_SCHEDULE_PUBLICATION = gql`
  query SchedulePublication(
    $restaurantId: ID!
    $periodStart: DateTime!
    $periodEnd: DateTime!
  ) {
    schedulePublication(
      restaurantId: $restaurantId
      periodStart: $periodStart
      periodEnd: $periodEnd
    ) {
      id
      status
      effectiveStatus
      publishedAt
      publishedBy
      activatedAt
      lockedAt
      lockedBy
      lockReason
      closedAt
      closedBy
      closeReason
      reopenedAt
      reopenedBy
      reopenReason
      reopenCount
      reminderSentAt
      lastChangedAt
      permissions {
        canPublish
        canApplyAutoSchedule
        canEditDraftSchedule
        canMakePublishedChange
        canChangeShiftTime
        canAddStaffToShift
        canRemoveStaffFromShift
        canDeleteShiftGroup
        requiresChangeReason
        requiresEmployeeNotification
        isReadOnly
        canReopen
      }
    }
  }
`;

const GET_SCHEDULE_CHANGE_LOGS = gql`
  query ScheduleChangeLogs(
    $restaurantId: ID!
    $shiftIds: [ID!]
    $periodStart: DateTime
    $periodEnd: DateTime
    $limit: Int
  ) {
    scheduleChangeLogs(
      restaurantId: $restaurantId
      shiftIds: $shiftIds
      periodStart: $periodStart
      periodEnd: $periodEnd
      limit: $limit
    ) {
      id
      restaurantId
      actorUserId
      verb
      source
      status
      objectKind
      objectId
      objectCode
      reason
      affectedShiftIds
      affectedEmployeeIds
      notifyEmployees
      oldStartTime
      oldEndTime
      newStartTime
      newEndTime
      meta
      diff
      createdAt
      at
    }
  }
`;
const PUBLISH_SCHEDULE = gql`
  mutation PublishSchedule($input: PublishScheduleInput!) {
    publishSchedule(input: $input) {
      id
      status
      effectiveStatus
      publishedAt
      lastChangedAt
      permissions {
        canPublish
        canApplyAutoSchedule
        canEditDraftSchedule
        canMakePublishedChange
        canChangeShiftTime
        canAddStaffToShift
        canRemoveStaffFromShift
        canDeleteShiftGroup
        requiresChangeReason
        requiresEmployeeNotification
        isReadOnly
      }
    }
  }
`;

const LOCK_SCHEDULE = gql`
  mutation LockSchedule($input: LockScheduleInput!) {
    lockSchedule(input: $input) {
      id
      status
      effectiveStatus
      lockedAt
      lockReason
      lastChangedAt
      permissions { canPublish canApplyAutoSchedule canEditDraftSchedule canMakePublishedChange canChangeShiftTime canAddStaffToShift canRemoveStaffFromShift canDeleteShiftGroup requiresChangeReason requiresEmployeeNotification isReadOnly }
    }
  }
`;

const CLOSE_SCHEDULE = gql`
  mutation CloseSchedule($input: CloseScheduleInput!) {
    closeSchedule(input: $input) {
      id
      status
      effectiveStatus
      closedAt
      closeReason
      lastChangedAt
      permissions { canPublish canApplyAutoSchedule canEditDraftSchedule canMakePublishedChange canChangeShiftTime canAddStaffToShift canRemoveStaffFromShift canDeleteShiftGroup requiresChangeReason requiresEmployeeNotification isReadOnly }
    }
  }
`;
const REOPEN_SCHEDULE = gql`
  mutation ReopenSchedule($input: ReopenScheduleInput!) {
    reopenSchedule(input: $input) {
      id
      status
      effectiveStatus
      reopenedAt
      reopenReason
      reopenCount
      lastChangedAt
      permissions { canPublish canApplyAutoSchedule canEditDraftSchedule canMakePublishedChange canChangeShiftTime canAddStaffToShift canRemoveStaffFromShift canDeleteShiftGroup requiresChangeReason requiresEmployeeNotification isReadOnly canReopen }
    }
  }
`;
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
const GET_MANAGER_RESTAURANTS = gql`
  query RestaurantsByManager($managerId: ID!, $limit: Int = 100, $cursor: ID) {
    restaurantsByManager(
      managerId: $managerId
      limit: $limit
      cursor: $cursor
    ) {
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
  mutation DeleteStaffShift(
    $shiftId: ID!
    $reason: String
    $notifyEmployee: Boolean
  ) {
    deleteStaffShift(
      shiftId: $shiftId
      reason: $reason
      notifyEmployee: $notifyEmployee
    )
  }
`;
const CHANGE_PUBLISHED_SHIFT_GROUP_TIME = gql`
  mutation ChangePublishedShiftGroupTime(
    $input: ChangePublishedShiftGroupTimeInput!
  ) {
    changePublishedShiftGroupTime(input: $input)
  }
`;

const ADD_STAFF_TO_PUBLISHED_SHIFT_GROUP = gql`
  mutation AddStaffToPublishedShiftGroup(
    $input: AddStaffToPublishedShiftGroupInput!
  ) {
    addStaffToPublishedShiftGroup(input: $input) {
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

const DELETE_PUBLISHED_SHIFT_GROUP = gql`
  mutation DeletePublishedShiftGroup($input: DeletePublishedShiftGroupInput!) {
    deletePublishedShiftGroup(input: $input)
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
const AUTO_REQUIRED_ROLE_OPTIONS = [
  { role: "server", label: "Phục vụ" },
  { role: "cook", label: "Bếp" },
  { role: "cashier", label: "Thu ngân" },
  { role: "host", label: "Đón khách" },
  { role: "cleaner", label: "Vệ sinh" },
  { role: "bartender", label: "Pha chế" },
  { role: "shipper", label: "Giao hàng" },
  { role: "storekeeper", label: "Kho" },
];

const DEFAULT_AUTO_REQUIRED_ROLES = ["server", "cook", "cashier"];

const AUTO_SHIFT_LABELS = {
  morning: "Ca sáng",
  afternoon: "Ca chiều",
  evening: "Ca tối",
  full_day: "Cả ngày",
  rotating: "Luân phiên",
};

const getAutoRoleLabel = (role) =>
  AUTO_REQUIRED_ROLE_OPTIONS.find((item) => item.role === role)?.label ||
  role ||
  "Vai trò";

const resolveAssistantShiftStatus = (deltaStaff) => {
  if (deltaStaff <= -3) return { status: "understaffed", severity: "high" };
  if (deltaStaff === -2 || deltaStaff === -1) {
    return { status: "understaffed", severity: "medium" };
  }
  if (deltaStaff >= 3) return { status: "overstaffed", severity: "high" };
  if (deltaStaff >= 1) return { status: "overstaffed", severity: "low" };
  return { status: "balanced", severity: "low" };
};
const getGraphQLErrorMessage = (error, fallback = "Đã xảy ra lỗi.") => {
  const graphQLError =
    error?.graphQLErrors?.[0]?.message ||
    error?.networkError?.result?.errors?.[0]?.message ||
    error?.cause?.message ||
    "";

  return graphQLError || error?.message || fallback;
};
const mergeAssistantWithRequiredRoles = (assistant, requiredRoles = []) => {
  if (!assistant) return assistant;

  const requiredRoleSet = new Set(
    (requiredRoles || [])
      .map((role) =>
        String(role || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );

  if (!requiredRoleSet.size) {
    return assistant;
  }

  const enhancedShifts = (assistant.shifts || []).map((shift) => {
    const roleMap = new Map();

    (shift.recommendedRoles || []).forEach((roleRow) => {
      const role = String(roleRow.role || "").toLowerCase();
      if (!role) return;

      roleMap.set(role, {
        ...roleRow,
        role,
        required: Number(roleRow.required || 0),
        assigned: Number(roleRow.assigned || 0),
        delta: Number(roleRow.delta || 0),
      });
    });

    requiredRoleSet.forEach((role) => {
      const current = roleMap.get(role) || {
        role,
        required: 0,
        assigned: 0,
        delta: 0,
      };

      const required = Math.max(Number(current.required || 0), 1);
      const assigned = Number(current.assigned || 0);

      roleMap.set(role, {
        ...current,
        role,
        required,
        assigned,
        delta: assigned - required,
      });
    });

    const recommendedRoles = Array.from(roleMap.values()).sort((left, right) =>
      getAutoRoleLabel(left.role).localeCompare(getAutoRoleLabel(right.role)),
    );

    const recommendedTotalStaff = recommendedRoles.reduce(
      (sum, roleRow) => sum + Number(roleRow.required || 0),
      0,
    );

    const currentAssignedStaff = Number(shift.currentAssignedStaff || 0);
    const deltaStaff = currentAssignedStaff - recommendedTotalStaff;
    const { status, severity } = resolveAssistantShiftStatus(deltaStaff);

    return {
      ...shift,
      recommendedRoles,
      recommendedTotalStaff,
      currentAssignedStaff,
      deltaStaff,
      status,
      severity,
    };
  });

  const underStaffedShifts = enhancedShifts.filter(
    (shift) => shift.status === "understaffed",
  ).length;

  const overStaffedShifts = enhancedShifts.filter(
    (shift) => shift.status === "overstaffed",
  ).length;

  const requiredRoleText = Array.from(requiredRoleSet)
    .map(getAutoRoleLabel)
    .join(", ");

  return {
    ...assistant,
    summary: {
      ...(assistant.summary || {}),
      totalShiftGroups: enhancedShifts.length,
      underStaffedShifts,
      overStaffedShifts,
      notes: [
        ...((assistant.summary || {}).notes || []),
        `Role tiên quyết do manager chọn: ${requiredRoleText}.`,
      ],
    },
    shifts: enhancedShifts,
  };
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
const assertShiftIsEditableBeforeStart = ({ startTime }) => {
  const now = new Date();

  if (new Date(startTime).getTime() <= now.getTime()) {
    throw new Error(
      "Ca đã bắt đầu hoặc đã kết thúc, không thể thêm nhân viên vào ca này.",
    );
  }
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

const buildVisibleScheduleInsights = ({ shifts, staff, mandatoryShiftRoles = [] }) => {
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
    const requiredPeople = Math.max(1, shift.essentialJobs.length, mandatoryShiftRoles.length);
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
    const assignedJobSet = new Set(
      shift.staffIds
        .map((staffId) => staffById.get(String(staffId))?.job)
        .filter(Boolean),
    );
    const missingMandatoryRoles = mandatoryShiftRoles.filter(
      (role) => !assignedJobSet.has(role),
    );
    if (missingMandatoryRoles.length > 0) {
      issues.push({
        id: `${shift.id}-missing-roles`,
        type: "missing",
        level: "warning",
        title: `Ca thiếu role bắt buộc: ${missingMandatoryRoles.map(getAutoRoleLabel).join(", ")}`,
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

  const [shiftRules, setShiftRules] = useState(() => loadStoredShiftRules());
  const [isShiftSettingsOpen, setIsShiftSettingsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmittingAddShift, setIsSubmittingAddShift] = useState(false);
  const [addModalContext, setAddModalContext] = useState({
    date: "",
    shiftType: "",
  });
  const [selectedShift, setSelectedShift] = useState(null);
  const [isStatsPanelOpen, setIsStatsPanelOpen] = useState(false);
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [publishConfirmError, setPublishConfirmError] = useState("");
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenError, setReopenError] = useState("");
  const [isAutoScheduleOpen, setIsAutoScheduleOpen] = useState(false);
  const [autoScheduleConfig, setAutoScheduleConfig] = useState({
    horizonDays: 7,
    weeklyHoursCap: 40,
    respectAvailability: true,
    avoidOvertime: true,
    requiredRoles: DEFAULT_AUTO_REQUIRED_ROLES,
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
  const { data: managerRestaurantsData } = useQuery(GET_MANAGER_RESTAURANTS, {
    variables: {
      managerId: me?.id,
      limit: 100,
    },
    skip: !me?.id || me?.roleName === "admin",
    fetchPolicy: "network-only",
  });
  const restaurantOptions = useMemo(() => {
    if (me?.roleName === "admin") {
      return (allRestaurantsData?.restaurants?.edges || [])
        .map((edge) => edge.node)
        .filter(Boolean);
    }

    return (managerRestaurantsData?.restaurantsByManager?.edges || [])
      .map((edge) => edge.node)
      .filter(Boolean);
  }, [allRestaurantsData, managerRestaurantsData, me?.roleName]);

  const effectiveRestaurantId = selectedRestaurantId || "";
  useEffect(() => {
    if (selectedRestaurantId) return;
    if (!restaurantOptions.length) return;

    setSelectedRestaurantId(restaurantOptions[0].id);
  }, [restaurantOptions, selectedRestaurantId]);
  const {
    policy: schedulingPolicy,
    loading: schedulingPolicyLoading,
    updateSchedulingPolicy,
    updateState: updateSchedulingPolicyState,
    validateShiftAssignment,
  } = useSchedulingPolicy({
    restaurantId: effectiveRestaurantId,
  });
  const policyMandatoryShiftRoles = useMemo(() => {
    const roles = Array.isArray(schedulingPolicy?.mandatoryShiftRoles)
      ? schedulingPolicy.mandatoryShiftRoles
      : [];
    return roles.length ? roles : DEFAULT_AUTO_REQUIRED_ROLES;
  }, [schedulingPolicy?.mandatoryShiftRoles]);
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

  const {
    data: staffData,
    loading: staffLoading,
    refetch: refetchStaffList,
  } = useQuery(GET_STAFF_LIST, {
    variables: { restaurantId: effectiveRestaurantId || undefined },
    fetchPolicy: "network-only",
    nextFetchPolicy: "network-only",
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
  const {
    data: publicationData,
    loading: publicationLoading,
    refetch: refetchPublication,
  } = useQuery(GET_SCHEDULE_PUBLICATION, {
    variables: {
      restaurantId: effectiveRestaurantId,
      periodStart: rangeStart.toISOString(),
      periodEnd: rangeEnd.toISOString(),
    },
    fetchPolicy: "network-only",
    skip: !effectiveRestaurantId || viewMode !== "week",
  });
  const [createShift] = useMutation(CREATE_STAFF_SHIFT);
  const [updateShift] = useMutation(UPDATE_STAFF_SHIFT);
  const [deleteShift] = useMutation(DELETE_STAFF_SHIFT);
  const [changePublishedShiftGroupTime, { loading: changingShiftGroupTime }] =
    useMutation(CHANGE_PUBLISHED_SHIFT_GROUP_TIME);
  const [publishSchedule, { loading: publishingSchedule }] =
    useMutation(PUBLISH_SCHEDULE);
  const [lockSchedule] = useMutation(LOCK_SCHEDULE);
  const [closeSchedule] = useMutation(CLOSE_SCHEDULE);
  const [reopenSchedule, { loading: reopeningSchedule }] =
    useMutation(REOPEN_SCHEDULE);
  const [addStaffToPublishedShiftGroup, { loading: addingPublishedStaff }] =
    useMutation(ADD_STAFF_TO_PUBLISHED_SHIFT_GROUP);

  const [deletePublishedShiftGroup, { loading: deletingPublishedShiftGroup }] =
    useMutation(DELETE_PUBLISHED_SHIFT_GROUP);
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
          status:
            String(item.employmentStatus || "").toLowerCase() === "working"
              ? "active"
              : "off",
          employmentStatus: String(item.employmentStatus || "").toLowerCase(),
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
  const totalAssignmentsForPublish = useMemo(
    () =>
      shifts.reduce(
        (sum, shift) => sum + Number((shift.staffIds || []).length || 0),
        0,
      ),
    [shifts],
  );

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
  const schedulePublication = publicationData?.schedulePublication || null;

  const scheduleLifecycleStatus =
    schedulePublication?.effectiveStatus || schedulePublication?.status || "draft";
  const schedulePermissions =
    schedulePublication?.permissions || {
      canPublish: scheduleLifecycleStatus === "draft",
      canApplyAutoSchedule: scheduleLifecycleStatus === "draft",
      canEditDraftSchedule: scheduleLifecycleStatus === "draft",
      canMakePublishedChange: scheduleLifecycleStatus === "published",
      canChangeShiftTime: scheduleLifecycleStatus === "published",
      canAddStaffToShift:
        scheduleLifecycleStatus === "draft" ||
        scheduleLifecycleStatus === "published",
      canRemoveStaffFromShift:
        scheduleLifecycleStatus === "draft" ||
        scheduleLifecycleStatus === "published",
      canDeleteShiftGroup:
        scheduleLifecycleStatus === "draft" ||
        scheduleLifecycleStatus === "published",
      requiresChangeReason: scheduleLifecycleStatus === "published",
      requiresEmployeeNotification: scheduleLifecycleStatus === "published",
      canReopen: scheduleLifecycleStatus === "published",
      isReadOnly: ["active", "locked", "closed"].includes(
        scheduleLifecycleStatus,
      ),
    };
  const isSchedulePublished = scheduleLifecycleStatus === "published";
  const isScheduleActive = scheduleLifecycleStatus === "active";
  const isScheduleLocked = scheduleLifecycleStatus === "locked";
  const isScheduleClosed = scheduleLifecycleStatus === "closed";
  const isScheduleReadOnly = Boolean(schedulePermissions.isReadOnly);
  const isDraftLikeSchedule = ["draft", "revision_draft"].includes(scheduleLifecycleStatus);
  const hasChangesAfterPublish =
    isSchedulePublished &&
    schedulePublication?.lastChangedAt &&
    schedulePublication?.publishedAt &&
    new Date(schedulePublication.lastChangedAt).getTime() >
      new Date(schedulePublication.publishedAt).getTime();
  const selectedShiftIds = useMemo(
    () =>
      (selectedShift?.records || [])
        .map((record) => record.id)
        .filter(Boolean),
    [selectedShift],
  );

  const daysUntilRangeStart = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(rangeStart);
    start.setHours(0, 0, 0, 0);

    return Math.ceil((start.getTime() - today.getTime()) / 86400000);
  }, [rangeStart]);

  const shouldShowPublishReminder =
    viewMode === "week" &&
    !publicationLoading &&
    !isSchedulePublished &&
    daysUntilRangeStart >= 0 &&
    daysUntilRangeStart <= 3;
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const scheduleInsights = useMemo(
    () =>
      buildVisibleScheduleInsights({
        shifts,
        staff,
        mandatoryShiftRoles: policyMandatoryShiftRoles,
      }),
    [shifts, staff, policyMandatoryShiftRoles],
  );
  const assistantForPreview = useMemo(
    () =>
      mergeAssistantWithRequiredRoles(
        assistantPayload,
        autoScheduleConfig.requiredRoles,
      ),
    [assistantPayload, autoScheduleConfig.requiredRoles],
  );
  const rawAutoSchedulePreview = useMemo(
    () =>
      buildAutoSchedulePreview({
        assistant: assistantForPreview,
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
      assistantForPreview,
      assistantShiftRows,
      autoScheduleConfig.weeklyHoursCap,
      autoScheduleConfig.respectAvailability,
      autoScheduleConfig.avoidOvertime,
      configuredShiftTypes,
      rawStaffList,
    ],
  );

  const {
    data: scheduleLogData,
    loading: scheduleLogsLoading,
    refetch: refetchScheduleLogs,
  } = useQuery(GET_SCHEDULE_CHANGE_LOGS, {
    variables: {
      restaurantId: effectiveRestaurantId,
      shiftIds: selectedShiftIds,
      limit: 50,
    },
    skip:
      !effectiveRestaurantId || !selectedShift || selectedShiftIds.length <= 0,
    fetchPolicy: "network-only",
  });
  const selectedShiftChangeLogs = scheduleLogData?.scheduleChangeLogs || [];

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
    if (isAutoScheduleOpen && assistantPayload) return;
    setAutoScheduleConfig((prev) => ({
      ...prev,
      requiredRoles: policyMandatoryShiftRoles,
    }));
  }, [policyMandatoryShiftRoles, isAutoScheduleOpen, assistantPayload]);
  const handleRestaurantChange = (nextRestaurantId) => {
    const nextRestaurant = restaurantOptions.find(
      (restaurant) => String(restaurant.id) === String(nextRestaurantId),
    );

    setSelectedRestaurantId(nextRestaurantId);
    setSelectedStaffId("");

    setAssistantPayload(null);
    setAssistantLeaveRows([]);
    setAssistantShiftRows([]);
    setSelectedAutoShiftKeys({});
    setAutoScheduleError("");
    setValidatedAutoSchedulePreview(null);

    if (nextRestaurantId) {
      showNotification(
        `Đã chuyển lịch làm việc sang ${
          nextRestaurant?.name || "nhà hàng đã chọn"
        }.`,
        "success",
      );
    }
  };
  const handlePublishSchedule = () => {
    if (!effectiveRestaurantId) {
      showNotification(
        "Vui lòng chọn nhà hàng trước khi công bố lịch.",
        "warning",
      );
      return;
    }

    if (viewMode !== "week") {
      showNotification("Chỉ công bố lịch theo phạm vi tuần.", "warning");
      return;
    }

    if (shifts.length <= 0) {
      showNotification(
        "Không thể công bố lịch rỗng. Cần có ít nhất 1 ca làm trong tuần.",
        "warning",
      );
      return;
    }

    if (!schedulePermissions.canPublish) {
      const message =
        scheduleLifecycleStatus === "published"
          ? "Lịch này đã được công bố rồi."
          : scheduleLifecycleStatus === "active"
            ? "Lịch đang hoạt động, không thể công bố lại."
            : scheduleLifecycleStatus === "locked"
              ? "Lịch đã khóa, không thể công bố lại."
              : scheduleLifecycleStatus === "closed"
                ? "Lịch đã đóng, không thể công bố lại."
                : "Không thể công bố lịch ở trạng thái hiện tại.";
      showNotification(message, "warning");
      return;
    }

    setPublishConfirmed(false);
    setPublishConfirmError("");
    setIsPublishConfirmOpen(true);
  };

  const handleConfirmPublishSchedule = async () => {
    if (!publishConfirmed) {
      setPublishConfirmError("Vui lòng xác nhận bạn đã kiểm tra lịch.");
      return;
    }

    setPublishConfirmError("");

    try {
      await publishSchedule({
        variables: {
          input: {
            restaurantId: effectiveRestaurantId,
            periodStart: rangeStart.toISOString(),
            periodEnd: rangeEnd.toISOString(),
          },
        },
      });

      await refetchPublication?.();
      await refetchScheduleLogs?.();

      setIsPublishConfirmOpen(false);
      setPublishConfirmed(false);
      setPublishConfirmError("");

      showNotification(
        scheduleLifecycleStatus === "revision_draft"
          ? "Đã công bố lại lịch làm việc và thông báo cập nhật đến nhân viên."
          : "Đã công bố lịch làm việc và thông báo đến nhân viên liên quan.",
        "success",
      );
    } catch (error) {
      const message = getGraphQLErrorMessage(
        error,
        "Không thể công bố lịch làm việc.",
      );
      setPublishConfirmError(message);
      showNotification(message, "error");
    }
  };
  const canShowReopenSchedule =
    scheduleLifecycleStatus === "published" ||
    Boolean(schedulePermissions.canReopen);
  const canShowPublishAction = ["draft", "revision_draft"].includes(
    scheduleLifecycleStatus,
  );
  const openReopenModal = () => {
    if (
      scheduleLifecycleStatus !== "published" &&
      !schedulePermissions.canReopen
    ) {
      showNotification(
        "Chỉ có thể mở lại lịch đang ở trạng thái đã công bố.",
        "warning",
      );
      return;
    }
    setReopenReason("");
    setReopenError("");
    setIsReopenModalOpen(true);
  };

  const handleConfirmReopenSchedule = async () => {
    const reason = String(reopenReason || "").trim();
    if (!reason) {
      setReopenError("Cần nhập lý do mở lại lịch để chỉnh sửa.");
      return;
    }
    try {
      await reopenSchedule({
        variables: {
          input: {
            restaurantId: effectiveRestaurantId,
            periodStart: rangeStart.toISOString(),
            periodEnd: rangeEnd.toISOString(),
            reason,
          },
        },
      });
      await refetchPublication?.();
      await refetchScheduleLogs?.();
      setIsReopenModalOpen(false);
      setReopenReason("");
      setReopenError("");
      showNotification(
        "Đã mở lại lịch để chỉnh sửa. Các thay đổi sẽ được gửi khi công bố lại.",
        "success",
      );
    } catch (error) {
      const message = getGraphQLErrorMessage(
        error,
        "Không thể mở lại lịch để chỉnh sửa.",
      );
      setReopenError(message);
      showNotification(message, "error");
    }
  };
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

    if (!["draft", "revision_draft"].includes(scheduleLifecycleStatus)) {
      const message =
        scheduleLifecycleStatus === "published"
          ? "Lịch đã công bố. Không thể tạo ca mới từ khung trống. Vui lòng mở lại lịch để chỉnh sửa hoặc chỉ thêm nhân viên vào ca đã tồn tại."
          : scheduleLifecycleStatus === "active"
            ? "Lịch đang hoạt động, không thể tạo ca mới trực tiếp."
            : scheduleLifecycleStatus === "locked"
              ? "Lịch đã khóa, không thể tạo ca mới."
              : scheduleLifecycleStatus === "closed"
                ? "Lịch đã đóng, không thể tạo ca mới."
                : "Không thể tạo ca ở trạng thái lịch hiện tại.";

      showNotification(message, "warning");
      return;
    }

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
  const handleConfirmAddShift = async (payload) => {
    if (!["draft", "revision_draft"].includes(scheduleLifecycleStatus)) {
      const message =
        scheduleLifecycleStatus === "published"
          ? "Lịch đã công bố. Không thể tạo ca mới từ khung trống. Vui lòng mở lại lịch để chỉnh sửa hoặc thêm nhân viên vào ca đã tồn tại."
          : scheduleLifecycleStatus === "active"
            ? "Lịch đang hoạt động, không thể tạo ca mới."
            : scheduleLifecycleStatus === "locked"
              ? "Lịch đã khóa, không thể tạo ca mới."
              : scheduleLifecycleStatus === "closed"
                ? "Lịch đã đóng, không thể tạo ca mới."
                : "Không thể tạo ca ở trạng thái lịch hiện tại.";
      showNotification(message, "warning");
      throw new Error(message);
    }
    if (!effectiveRestaurantId) {
      throw new Error("Vui lòng chọn nhà hàng trước khi tạo ca.");
    }

    const shiftConfigItem = configuredShiftTypes[payload.shiftType];

    if (!shiftConfigItem) {
      throw new Error("Không tìm thấy cấu hình ca làm.");
    }

    const { startTime, endTime } = buildShiftRange({
      date: payload.date,
      startTimeText: shiftConfigItem.startTime,
      endTimeText: shiftConfigItem.endTime,
    });

    assertShiftIsEditableBeforeStart({ startTime });

    const staffIds = Array.isArray(payload.staffIds) ? payload.staffIds : [];

    if (!staffIds.length) {
      throw new Error("Cần chọn ít nhất một nhân viên.");
    }

    if (scheduleLifecycleStatus === "published" && !String(payload.publishedReason || "").trim()) {
      throw new Error(
        "Lịch đã công bố, cần nhập lý do khi thêm nhân viên vào ca.",
      );
    }

    setIsSubmittingAddShift(true);

    try {
      const successRows = [];
      const failedRows = [];

      for (const staffId of staffIds) {
      try {
        if (false) {
          const reason = String(payload.publishedReason || "").trim();

          await addStaffToPublishedShiftGroup({
            variables: {
              input: {
                restaurantId: effectiveRestaurantId,
                employeeId: staffId,
                shiftType: String(payload.shiftType || "").toUpperCase(),
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                reason,
                notifyEmployee: payload.notifyEmployees !== false,
                allowOverride: Boolean(payload.allowOverride),
                overrideReason: payload.overrideReason || reason,
              },
            },
          });
        } else if (scheduleLifecycleStatus === "draft") {
          await createShift({
            variables: {
              input: {
                employeeId: staffId,
                restaurantId: effectiveRestaurantId,
                shiftType: String(payload.shiftType || "").toUpperCase(),
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                status: "scheduled",
                notes: payload.notes || "",
              },
            },
          });
        } else {
          throw new Error("Không thể thêm nhân viên vào lịch ở trạng thái hiện tại.");
        }

        successRows.push(staffId);
      } catch (error) {
        failedRows.push({
          staffId,
          message: getGraphQLErrorMessage(
            error,
            "Không thể tạo ca cho nhân viên.",
          ),
        });
      }
    }

    if (successRows.length > 0) {
      await refetch();
      await refetchScheduleLogs?.();

      if (typeof refetchPublication === "function") {
        await refetchPublication();
      }
    }

    if (successRows.length > 0 && failedRows.length === 0) {
      setIsAddModalOpen(false);
      setAddModalContext({ date: "", shiftType: "" });

      showNotification(
        scheduleLifecycleStatus === "revision_draft"
          ? `Đã cập nhật bản chỉnh sửa với ${successRows.length} phân công mới.`
          : `Đã tạo ca cho ${successRows.length} nhân viên.`,
        "success",
      );

      return;
    }

    if (successRows.length > 0 && failedRows.length > 0) {
      const failText = failedRows
        .slice(0, 3)
        .map((row) => row.message)
        .join(" | ");

      showNotification(
        `Đã lưu ${successRows.length} phân công, ${failedRows.length} phân công lỗi.`,
        "warning",
      );

      throw new Error(failText);
    }

    const failText =
      failedRows
        .slice(0, 3)
        .map((row) => row.message)
        .join(" | ") || "Không thể tạo ca làm.";

      showNotification(failText, "error");
      throw new Error(failText);
    } finally {
      setIsSubmittingAddShift(false);
    }
  };

  const handleDeleteShift = async (shiftGroupId, options = {}) => {
    if (!schedulePermissions.canDeleteShiftGroup) {
      throw new Error("Không thể xóa ca ở trạng thái lịch hiện tại.");
    }
    const shiftGroup = shifts.find((item) => item.id === shiftGroupId);

    if (!shiftGroup) {
      showNotification("Không tìm thấy ca làm cần xóa.", "error");
      throw new Error("Không tìm thấy ca làm cần xóa.");
    }

    const shiftIds = (shiftGroup.records || [])
      .map((record) => record.id)
      .filter(Boolean);

    if (!shiftIds.length) {
      showNotification("Không tìm thấy phân công trong ca cần xóa.", "error");
      throw new Error("Không tìm thấy phân công trong ca cần xóa.");
    }

    try {
      if (["draft", "revision_draft"].includes(scheduleLifecycleStatus)) {
        await Promise.all(
          shiftIds.map((shiftId) =>
            deleteShift({
              variables: {
                shiftId,
                reason: options.reason || "Xóa ca ở lịch chưa công bố",
                notifyEmployee: options.notifyEmployees === true,
              },
            }),
          ),
        );
      } else if (scheduleLifecycleStatus === "published") {
        const reason = String(options.reason || "").trim();

        if (!reason) {
          throw new Error("Cần nhập lý do khi xóa ca đã công bố.");
        }

        await deletePublishedShiftGroup({
          variables: {
            input: {
              restaurantId: effectiveRestaurantId,
              shiftIds,
              reason,
              notifyEmployees: options.notifyEmployees !== false,
            },
          },
        });

        await refetch();
        await refetchScheduleLogs?.();
        await refetchPublication?.();
        setSelectedShift(null);

        showNotification(
          "Đã xóa ca, ghi log và gửi thông báo đến nhân viên liên quan.",
          "success",
        );

        return;
      }

      await refetch();
      await refetchScheduleLogs?.();
      setSelectedShift(null);

      showNotification("Đã xóa ca làm việc.", "success");
    } catch (error) {
      const message = getGraphQLErrorMessage(
        error,
        "Không thể xóa ca làm việc.",
      );

      showNotification(message, "error");
      throw new Error(message);
    }
  };

  const handleRemoveStaffFromShift = async (
    shiftGroupId,
    staffId,
    options = {},
  ) => {
    if (!schedulePermissions.canRemoveStaffFromShift) {
      throw new Error("Không thể xóa nhân viên khỏi ca ở trạng thái lịch hiện tại.");
    }
    const shiftGroup = shifts.find((item) => item.id === shiftGroupId);

    if (!shiftGroup) {
      showNotification("Không tìm thấy ca làm cần cập nhật.", "error");
      return;
    }

    const targetRecord = (shiftGroup.records || []).find(
      (record) => String(record.employeeId) === String(staffId),
    );

    if (!targetRecord?.id) {
      showNotification("Không tìm thấy phân công ca của nhân viên.", "error");
      return;
    }

    try {
      await deleteShift({
        variables: {
          shiftId: targetRecord.id,
          reason: options.reason || "",
          notifyEmployee: options.notifyEmployee !== false,
        },
      });

      await refetch();
      await refetchScheduleLogs?.();

      const employeeName =
        staff.find((person) => String(person.id) === String(staffId))?.name ||
        "Nhân viên";

      showNotification(
        `Đã xóa ${employeeName} khỏi ca và gửi thông báo cho nhân viên.`,
        "success",
      );
    } catch (error) {
      console.error(error);
      showNotification(
        getGraphQLErrorMessage(
          error,
          "Không thể xóa nhân viên khỏi ca. Vui lòng thử lại.",
        ),
        "error",
      );
    }
  };

  const handleAddStaffToShift = async (shiftGroupId, staffId, options = {}) => {
    const shiftGroup = shifts.find((item) => item.id === shiftGroupId);

    if (!shiftGroup) {
      showNotification("Không tìm thấy ca làm cần cập nhật.", "error");
      throw new Error("Không tìm thấy ca làm cần cập nhật.");
    }

    const selectedStaff = staff.find(
      (person) => String(person.id) === String(staffId),
    );

    if (!selectedStaff) {
      showNotification("Không tìm thấy nhân viên cần thêm vào ca.", "error");
      throw new Error("Không tìm thấy nhân viên cần thêm vào ca.");
    }

    const { startTime, endTime } = buildShiftRange({
      date: shiftGroup.date,
      startTimeText: shiftGroup.startTime,
      endTimeText: shiftGroup.endTime,
    });

    try {
      if (["draft", "revision_draft"].includes(scheduleLifecycleStatus)) {
        await createShift({
          variables: {
            input: {
              employeeId: staffId,
              restaurantId: effectiveRestaurantId,
              shiftType: String(shiftGroup.shiftType || "").toUpperCase(),
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              status: "scheduled",
            },
          },
        });
      } else if (scheduleLifecycleStatus === "published") {
        const reason = String(options.reason || "").trim();

        if (!reason) {
          throw new Error(
            "Cần nhập lý do khi thêm nhân viên vào lịch đã công bố.",
          );
        }

        await addStaffToPublishedShiftGroup({
          variables: {
            input: {
              restaurantId: effectiveRestaurantId,
              employeeId: staffId,
              shiftType: String(shiftGroup.shiftType || "").toUpperCase(),
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              reason,
              notifyEmployee: options.notifyEmployee !== false,
              allowOverride: Boolean(options.allowOverride),
              overrideReason: options.overrideReason || reason,
            },
          },
        });

        await refetch();
        await refetchScheduleLogs?.();
        await refetchPublication?.();

        showNotification(
          `Đã thêm ${selectedStaff.name} vào ca, ghi log và gửi thông báo.`,
          "success",
        );

        return;
      }

      await createShift({
        variables: {
          input: {
            employeeId: staffId,
            restaurantId: effectiveRestaurantId,
            shiftType: String(shiftGroup.shiftType || "").toUpperCase(),
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            status: "scheduled",
            notes: options.reason ? `Lý do thêm ca: ${options.reason}` : "",
          },
        },
      });

      await refetch();

      showNotification(`Đã thêm ${selectedStaff.name} vào ca.`, "success");
    } catch (error) {
      const message = getGraphQLErrorMessage(
        error,
        "Không thể thêm nhân viên vào ca.",
      );

      showNotification(message, "error");
      throw new Error(message);
    }
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
          const existingBlockedCandidates = roleRow.blockedCandidates || [];

          const allBlocked = [
            ...existingBlockedCandidates,
            ...extraBlocked.filter(
              (candidate) =>
                !existingBlockedCandidates.some(
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

        if (unresolvedCount > 0) {
          unresolvedShifts += 1;
        }

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
      const [staffResult, assistantResult, leaveResult, shiftResult] =
        await Promise.all([
          refetchStaffList({
            restaurantId: effectiveRestaurantId || undefined,
          }),
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
      const nextAssistantForPreview = mergeAssistantWithRequiredRoles(
        nextAssistantPayload,
        autoScheduleConfig.requiredRoles,
      );
      setAssistantPayload(nextAssistantPayload);
      setAssistantLeaveRows(nextLeaveRows);
      setAssistantShiftRows(nextShiftRows);

      const nextStaffList = staffResult?.data?.staffList || rawStaffList;

      const nextRawPreview = buildAutoSchedulePreview({
        assistant: nextAssistantForPreview,
        staffList: nextStaffList,
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
  const getMissingRoleSummaryForSelectedPreview = () => {
    const selectedItems = (autoSchedulePreview.items || []).filter(
      (item) => selectedAutoShiftKeys[item.shiftKey],
    );

    const lines = [];

    selectedItems.forEach((item) => {
      const missingRoles = (item.unfilledRoles || [])
        .filter((roleRow) => Number(roleRow.unresolved || 0) > 0)
        .map(
          (roleRow) =>
            `${getAutoRoleLabel(roleRow.role)} x${Number(
              roleRow.unresolved || 0,
            )}`,
        );

      if (missingRoles.length) {
        lines.push(
          `${AUTO_SHIFT_LABELS[item.shiftType] || item.shiftType} ${item.date}: ${missingRoles.join(", ")}`,
        );
      }
    });

    return lines;
  };
  const handleChangeShiftGroupTime = async (shiftGroup, payload) => {
    if (!schedulePermissions.canChangeShiftTime) {
      throw new Error("Không thể đổi giờ ca ở trạng thái lịch hiện tại.");
    }
    if (!effectiveRestaurantId) {
      const message = "Vui lòng chọn nhà hàng trước khi đổi giờ ca.";
      showNotification(message, "warning");
      throw new Error(message);
    }

    const shiftIds = (shiftGroup?.records || [])
      .map((record) => record.id)
      .filter(Boolean);

    if (!shiftIds.length) {
      const message = "Không tìm thấy phân công trong ca cần đổi giờ.";
      showNotification(message, "error");
      throw new Error(message);
    }

    const reason = String(payload?.reason || "").trim();

    if (!reason) {
      const message = "Cần nhập lý do thay đổi giờ ca.";
      showNotification(message, "warning");
      throw new Error(message);
    }

    let nextRange;

    try {
      nextRange = buildShiftRange({
        date: shiftGroup.date,
        startTimeText: payload.startTime,
        endTimeText: payload.endTime,
      });
    } catch (error) {
      const message = error?.message || "Giờ bắt đầu/kết thúc không hợp lệ.";
      showNotification(message, "error");
      throw new Error(message);
    }

    try {
      await changePublishedShiftGroupTime({
        variables: {
          input: {
            restaurantId: effectiveRestaurantId,
            shiftIds,
            startTime: nextRange.startTime.toISOString(),
            endTime: nextRange.endTime.toISOString(),
            reason,
            notifyEmployees: payload.notifyEmployees !== false,
            allowOverride: Boolean(payload.allowOverride),
            overrideReason:
              payload.allowOverride && payload.overrideReason
                ? payload.overrideReason
                : reason,
          },
        },
      });

      await refetch();
      await refetchScheduleLogs?.();

      if (typeof refetchPublication === "function") {
        await refetchPublication();
      }

      setSelectedShift((current) => {
        if (!current || current.id !== shiftGroup.id) return current;

        return {
          ...current,
          startTime: payload.startTime,
          endTime: payload.endTime,
        };
      });

      showNotification(
        isSchedulePublished
          ? "Đã đổi giờ ca, ghi log và gửi thông báo cho nhân viên liên quan."
          : "Đã đổi giờ ca thành công.",
        "success",
      );
    } catch (error) {
      const message = getGraphQLErrorMessage(
        error,
        "Không thể đổi giờ ca. Vui lòng kiểm tra lại policy.",
      );

      showNotification(message, "error");
      throw new Error(message);
    }
  };
  const handleApplyAutoSchedule = async () => {
    if (!schedulePermissions.canApplyAutoSchedule) {
      const message =
        "Không thể áp dụng chia ca tự động ở trạng thái lịch hiện tại.";

      setAutoScheduleError(message);
      showNotification(message, "warning");
      return;
    }

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

    const successRows = [];
    const failedRows = [];

    try {
      for (const input of inputs) {
        try {
          const override = await validateShiftAssignmentOrThrow({
            employeeId: input.employeeId,
            shiftType: input.shiftType,
            startTime: input.startTime,
            endTime: input.endTime,
          });

          const finalInput = {
            ...input,
            allowOverride: Boolean(override.allowOverride),
            overrideReason: override.overrideReason || undefined,
          };

          await createShift({
            variables: {
              input: finalInput,
            },
          });

          successRows.push(finalInput);
        } catch (error) {
          failedRows.push({
            input,
            message: getGraphQLErrorMessage(
              error,
              error?.message || "Không thể tạo ca.",
            ),
          });
        }
      }

      if (successRows.length > 0) {
        await refetch();
      }

      const missingRoleLines = getMissingRoleSummaryForSelectedPreview();

      if (successRows.length > 0 && failedRows.length === 0) {
        setIsAutoScheduleOpen(false);
        setSelectedAutoShiftKeys({});
        setValidatedAutoSchedulePreview(null);

        const missingText = missingRoleLines.length
          ? ` Còn thiếu: ${missingRoleLines.join(" | ")}`
          : "";

        showNotification(
          `Đã áp dụng ${successRows.length} phân công từ chia ca tự động.${missingText}`,
          missingRoleLines.length ? "warning" : "success",
        );

        return;
      }

      if (successRows.length > 0 && failedRows.length > 0) {
        const failText = failedRows
          .slice(0, 3)
          .map((row) => row.message)
          .join(" | ");

        setAutoScheduleError(
          `Đã lưu ${successRows.length} phân công, ${failedRows.length} phân công lỗi. ${failText}`,
        );

        showNotification(
          `Đã lưu ${successRows.length} phân công, ${failedRows.length} phân công lỗi.`,
          "warning",
        );

        return;
      }

      const failText = failedRows
        .slice(0, 3)
        .map((row) => row.message)
        .join(" | ");

      setAutoScheduleError(failText || "Không thể áp dụng gợi ý chia ca.");
      showNotification(failText || "Không thể áp dụng gợi ý chia ca.", "error");
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
            onClick={() => handlePublishSchedule((prev) => !prev)}
            disabled={readOnly}
          >
            <div className="kpi-icon">
              <CalendarCheck2 size={20} />
            </div>
            <div className="kpi-content">
              <span className="label">Trạng thái</span>
              <span
                className={`value ${isSchedulePublished ? "published" : "draft"}`}
              >
                {isSchedulePublished ? "Đã xuất bản" : "Bản nháp"}
              </span>
              <span className="hint">
                {readOnly ? "Chỉ xem" : "Bấm để đổi trạng thái"}
              </span>
              <span
                className={`schedule-status-badge ${
                  scheduleLifecycleStatus === "published" && hasChangesAfterPublish
                    ? "changed"
                    : scheduleLifecycleStatus
                }`}
              >
                {scheduleLifecycleStatus === "published" && hasChangesAfterPublish
                  ? "Đã công bố • Có chỉnh sửa sau công bố"
                  : SCHEDULE_STATUS_LABELS[scheduleLifecycleStatus] || "Bản nháp"}
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
            onChange={(event) => handleRestaurantChange(event.target.value)}
            disabled={readOnly || !restaurantOptions.length}
          >
            <option value="" disabled>
              Chọn nhà hàng
            </option>

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

          {!readOnly && canShowPublishAction ? (
            <button
              type="button"
              className="btn-publish"
              onClick={handlePublishSchedule}
              disabled={
                publicationLoading ||
                publishingSchedule ||
                viewMode !== "week" ||
                !effectiveRestaurantId ||
                !schedulePermissions.canPublish
              }
            >
              {publishingSchedule
                ? "Đang công bố..."
                : scheduleLifecycleStatus === "revision_draft"
                  ? "Công bố lại"
                  : "Công bố lịch"}
            </button>
          ) : (
            <span className={`schedule-status-badge ${scheduleLifecycleStatus}`}>
              {SCHEDULE_STATUS_LABELS[scheduleLifecycleStatus] || "Bản nháp"}
            </span>
          )}
          {!readOnly && canShowReopenSchedule ? (
            <button
              type="button"
              className="btn-reopen-schedule"
              onClick={openReopenModal}
              disabled={reopeningSchedule}
            >
              {reopeningSchedule ? "Đang mở lại..." : "Mở lại để chỉnh sửa"}
            </button>
          ) : null}
        </div>
      </div>
      {shouldShowPublishReminder ? (
        <div className="schedule-publish-reminder">
          <div className="reminder-content">
            <strong>Nhắc công bố lịch làm việc</strong>
            <p>
              Tuần này sẽ bắt đầu trong {daysUntilRangeStart} ngày. Nên công bố
              lịch trước ít nhất 3 ngày để nhân viên chủ động sắp xếp.
            </p>
          </div>

          <button
            type="button"
            onClick={handlePublishSchedule}
            disabled={
              publishingSchedule ||
              publicationLoading ||
              !effectiveRestaurantId ||
              viewMode !== "week" ||
              !schedulePermissions.canPublish
            }
          >
            {publishingSchedule ? "Đang công bố..." : "Công bố lịch"}
          </button>
        </div>
      ) : null}
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
      {!effectiveRestaurantId ? (
        <div className="schedule-empty-state">
          Vui lòng chọn nhà hàng để xem và xếp lịch làm việc.
        </div>
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
          onConfirm={handleConfirmAddShift}
          isSchedulePublished={isSchedulePublished}
          submitting={isSubmittingAddShift || addingPublishedStaff}
        />
      )}

      <ShiftDetailModal
        isOpen={Boolean(selectedShift)}
        onClose={() => setSelectedShift(null)}
        shift={selectedShift}
        staffList={staff}
        readOnly={readOnly}
        onRemoveStaff={handleRemoveStaffFromShift}
        onAddStaff={handleAddStaffToShift}
        onDeleteShift={handleDeleteShift}
        onUpdateNotes={handleUpdateSelectedNotes}
        onUpdateTime={handleUpdateSelectedTime}
        shiftConfig={configuredShiftTypes}
        isSchedulePublished={isSchedulePublished}
        isChangingShiftTime={changingShiftGroupTime}
        onChangeShiftGroupTime={handleChangeShiftGroupTime}
        isAddingPublishedStaff={addingPublishedStaff}
        isDeletingPublishedShiftGroup={deletingPublishedShiftGroup}
        scheduleChangeLogs={selectedShiftChangeLogs}
        scheduleChangeLogsLoading={scheduleLogsLoading}
        scheduleLifecycleStatus={scheduleLifecycleStatus}
        schedulePermissions={schedulePermissions}
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
          requiredRoleOptions={AUTO_REQUIRED_ROLE_OPTIONS}
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

      {isPublishConfirmOpen ? (
        <div className="publish-confirm-backdrop">
          <div className="publish-confirm-card">
            <button
              type="button"
              className="publish-confirm-close"
              onClick={() => {
                if (publishingSchedule) return;
                setIsPublishConfirmOpen(false);
                setPublishConfirmed(false);
                setPublishConfirmError("");
              }}
              disabled={publishingSchedule}
            >
              <X size={18} />
            </button>
            <div className="publish-confirm-icon">
              <CalendarCheck2 size={24} />
            </div>
            <div className="publish-confirm-content">
              <h3>
                {scheduleLifecycleStatus === "revision_draft"
                  ? "Công bố lại bản chỉnh sửa?"
                  : "Công bố lịch làm việc?"}
              </h3>
              <p>
                Sau khi công bố, nhân viên sẽ nhận thông báo và các chỉnh sửa
                sau đó sẽ phải đi qua quy trình có kiểm soát.
              </p>
              <div className="publish-confirm-summary">
                <div>
                  <span>Phạm vi</span>
                  <strong>
                    {format(rangeStart, "dd/MM/yyyy")} -{" "}
                    {format(rangeEnd, "dd/MM/yyyy")}
                  </strong>
                </div>
                <div>
                  <span>Trạng thái hiện tại</span>
                  <strong>
                    {SCHEDULE_STATUS_LABELS[scheduleLifecycleStatus] ||
                      "Bản nháp"}
                  </strong>
                </div>
                <div>
                  <span>Số nhóm ca</span>
                  <strong>{shifts.length}</strong>
                </div>
                <div>
                  <span>Tổng phân công</span>
                  <strong>{totalAssignmentsForPublish}</strong>
                </div>
              </div>
              <label className="publish-confirm-check">
                <input
                  type="checkbox"
                  checked={publishConfirmed}
                  onChange={(event) => {
                    setPublishConfirmed(event.target.checked);
                    if (event.target.checked) setPublishConfirmError("");
                  }}
                  disabled={publishingSchedule}
                />
                <span>Tôi đã kiểm tra lịch và xác nhận công bố.</span>
              </label>
              {publishConfirmError ? (
                <div className="publish-confirm-error">{publishConfirmError}</div>
              ) : null}
              <div className="publish-confirm-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    if (publishingSchedule) return;
                    setIsPublishConfirmOpen(false);
                    setPublishConfirmed(false);
                    setPublishConfirmError("");
                  }}
                  disabled={publishingSchedule}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleConfirmPublishSchedule}
                  disabled={publishingSchedule || !publishConfirmed}
                >
                  {publishingSchedule
                    ? "Đang công bố..."
                    : scheduleLifecycleStatus === "revision_draft"
                      ? "Xác nhận công bố lại"
                      : "Xác nhận công bố"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {isReopenModalOpen ? (
        <div className="publish-confirm-backdrop">
          <div className="publish-confirm-card">
            <div className="publish-confirm-icon">
              <Edit3 size={24} />
            </div>
            <div className="publish-confirm-content">
              <h3>Mở lại lịch đã công bố?</h3>
              <p>
                Lịch này đã được công bố cho nhân viên. Khi mở lại, bạn có thể
                chỉnh sửa như bản nháp. Nhân viên sẽ chưa nhận thông báo cho
                đến khi bạn công bố lại lịch.
              </p>
              <label className="time-change-reason">
                Lý do mở lại lịch <span>*</span>
                <textarea
                  value={reopenReason}
                  onChange={(event) => {
                    setReopenReason(event.target.value);
                    if (reopenError) setReopenError("");
                  }}
                  rows={3}
                  placeholder="Nhập lý do mở lại lịch để chỉnh sửa..."
                  disabled={reopeningSchedule}
                />
              </label>
              {reopenError ? (
                <div className="publish-confirm-error">{reopenError}</div>
              ) : null}
              <div className="publish-confirm-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    if (reopeningSchedule) return;
                    setIsReopenModalOpen(false);
                    setReopenReason("");
                    setReopenError("");
                  }}
                  disabled={reopeningSchedule}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleConfirmReopenSchedule}
                  disabled={reopeningSchedule}
                >
                  {reopeningSchedule ? "Đang mở lại..." : "Xác nhận mở lại"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ScheduleManagement;
