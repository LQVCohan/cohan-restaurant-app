import React, { useEffect, useMemo, useRef, useState } from "react";
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
  ClipboardList,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import "./ScheduleManagement.scss";
import {
  loadStoredShiftRules,
  normalizeRoleKey,
  persistShiftRules,
  resolveConcreteStaffRoleSlug,
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
import AvailabilityRegistrationPanel from "./components/AvailabilityRegistrationPanel";
import useAvailabilityPolicyUpdate from "./hooks/useAvailabilityPolicyUpdate";
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

const GET_SCHEDULE_ACK_SUMMARY = gql`
  query ScheduleAckSummary(
    $restaurantId: ID!
    $periodStart: DateTime!
    $periodEnd: DateTime!
  ) {
    scheduleAcknowledgementSummary(
      restaurantId: $restaurantId
      periodStart: $periodStart
      periodEnd: $periodEnd
    ) {
      totalAssignedStaff
      acknowledgedCount
      pendingCount
      changedAfterAcknowledgementCount
    }
  }
`;
const GET_DECLINED_SHIFT_ACKS = gql`
  query ShiftAcknowledgements($restaurantId: ID!, $periodStart: DateTime, $periodEnd: DateTime, $status: ShiftAcknowledgementStatus) {
    shiftAcknowledgements(restaurantId: $restaurantId, periodStart: $periodStart, periodEnd: $periodEnd, status: $status) {
      id
      shiftId
      employeeId
      reasonCategory
      reason
      declineClassification
    }
  }
`;
const REVIEW_SHIFT_ACK = gql`
  mutation ReviewShiftAcknowledgement($input: ReviewShiftAcknowledgementInput!) {
    reviewShiftAcknowledgement(input: $input) { id declineClassification }
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

const CLOSE_SCHEDULE = gql`
  mutation CloseSchedule($input: CloseScheduleInput!) {
    closeSchedule(input: $input) {
      id
      status
      effectiveStatus
      closedAt
      closeReason
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
      roleName
      role {
        id
        slug
        name
        department
      }
      positionTitle
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

const GET_AVAILABILITY_WINDOWS = gql`
  query ScheduleAvailabilityWindows(
    $restaurantId: ID!
    $from: DateTime
    $to: DateTime
  ) {
    availabilityWindows(restaurantId: $restaurantId, from: $from, to: $to) {
      id
      restaurantId
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

const GET_AVAILABILITY_SUBMISSIONS = gql`
  query ScheduleAvailabilitySubmissions($windowId: ID!, $restaurantId: ID!) {
    staffAvailabilitySubmissions(
      windowId: $windowId
      restaurantId: $restaurantId
    ) {
      id
      restaurantId
      availabilityWindowId
      employeeId
      periodStart
      periodEnd
      employmentType
      submissionType
      status
      submittedAt
      lockedAt
      source
      pendingSubmittedAt
      pendingSubmissionType
      pendingSource
      pendingNote
      pendingSlots {
        date
        shiftType
        status
        note
      }
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

const CREATE_AVAILABILITY_WINDOW = gql`
  mutation CreateAvailabilityWindow($input: CreateAvailabilityWindowInput!) {
    createAvailabilityWindow(input: $input) {
      id
      periodStart
      periodEnd
      openAt
      closeAt
      status
      effectiveStatus
      registrationMode
    }
  }
`;

const OPEN_AVAILABILITY_WINDOW = gql`
  mutation OpenAvailabilityWindow($id: ID!) {
    openAvailabilityWindow(id: $id) {
      id
      status
      openAt
      closeAt
    }
  }
`;

const CLOSE_AVAILABILITY_WINDOW = gql`
  mutation CloseAvailabilityWindow($id: ID!) {
    closeAvailabilityWindow(id: $id) {
      id
      status
      closeAt
    }
  }
`;

const REVIEW_AVAILABILITY_SUBMISSION = gql`
  mutation ReviewAvailabilitySubmission(
    $input: ReviewStaffAvailabilitySubmissionInput!
  ) {
    reviewStaffAvailabilitySubmission(input: $input) {
      id
      status
      reviewNote
      reviewedAt
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
const CREATE_STAFF_SHIFTS = gql`
  mutation CreateStaffShifts($inputs: [CreateStaffShiftInput!]!) {
    createStaffShifts(inputs: $inputs) {
      successCount
      failedCount
      shifts {
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
      errors {
        index
        employeeId
        message
        code
      }
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

const normalizeAutoRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase();

const normalizeMandatoryShiftRoles = (roles = []) =>
  Array.from(
    new Set(
      (roles || []).map((role) => normalizeRoleKey(role)).filter(Boolean),
    ),
  );

const resolveStaffAutoRole = (staff) =>
  normalizeAutoRole(
    resolveConcreteStaffRoleSlug(staff, { allowDepartmentFallback: true }) ||
      mapDepartmentToJob(staff?.department),
  );

const getEmploymentTypeMinHours = (
  employmentTypePolicy = {},
  employmentType = "full_time",
) =>
  Number(
    employmentTypePolicy?.[String(employmentType || "full_time").toLowerCase()]
      ?.minWeeklyHours || 0,
  );

const resolveStaffWeeklyAvailabilityHours = (person) => {
  const direct = Number(
    person?.weeklyAvailabilityHours ??
      person?.availableHoursPerWeek ??
      person?.availabilityHoursPerWeek ??
      0,
  );
  return Number.isFinite(direct) ? direct : 0;
};

export const buildVisibleScheduleInsights = ({
  shifts,
  staff,
  mandatoryShiftRoles = [],
  employmentTypePolicy = {},
}) => {
  const staffById = new Map(staff.map((person) => [String(person.id), person]));
  const issues = [];
  const costByDepartment = new Map();
  const hoursByStaff = new Map();
  const recordsByStaff = new Map();

  let totalCost = 0;
  let totalHours = 0;
  let totalAssignments = 0;

  const mandatoryRoleKeys = normalizeMandatoryShiftRoles(mandatoryShiftRoles);

  shifts.forEach((shift) => {
    const shiftHours = getShiftHoursFromGroup(shift);
    const staffIds = Array.isArray(shift.staffIds) ? shift.staffIds : [];
    const essentialJobs = Array.isArray(shift.essentialJobs)
      ? shift.essentialJobs
      : [];
    const requiredPeople = Math.max(
      1,
      essentialJobs.length,
      mandatoryRoleKeys.length,
    );
    const assignedPeople = staffIds.length;
    const missingCount = Math.max(0, requiredPeople - assignedPeople);

    if (assignedPeople === 0) {
      issues.push({
        id: `${shift.id}-empty`,
        type: "missing",
        level: "warning",
        title: "Ca chưa có nhân sự",
        description: `${shift.date} • ${shift.startTime} - ${shift.endTime}`,
        targetShiftId: shift.id,
        targetShiftIds: [shift.id],
        targetDate: shift.date,
        targetShiftType: shift.shiftType,
      });
    } else if (missingCount > 0) {
      issues.push({
        id: `${shift.id}-missing`,
        type: "missing",
        level: "warning",
        title: `Ca thiếu ${missingCount} người`,
        description: `${shift.date} • ${shift.startTime} - ${shift.endTime}`,
        targetShiftId: shift.id,
        targetShiftIds: [shift.id],
        targetDate: shift.date,
        targetShiftType: shift.shiftType,
      });
    }

    const assignedRoleSet = new Set(
      staffIds
        .map((staffId) =>
          resolveConcreteStaffRoleSlug(staffById.get(String(staffId))),
        )
        .filter(Boolean),
    );
    const missingMandatoryRoles = mandatoryRoleKeys.filter(
      (role) => !assignedRoleSet.has(role),
    );

    if (missingMandatoryRoles.length > 0) {
      issues.push({
        id: `${shift.id}-missing-roles`,
        type: "missing",
        level: "warning",
        title: `Ca thiếu role bắt buộc: ${missingMandatoryRoles.map(getAutoRoleLabel).join(", ")}`,
        description: `${shift.date} • ${shift.startTime} - ${shift.endTime}`,
        targetShiftId: shift.id,
        targetShiftIds: [shift.id],
        targetDate: shift.date,
        targetShiftType: shift.shiftType,
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
      recordsByStaff.get(staffKey).push({
        ...record,
        shiftGroupId: shift.id,
        shiftDate: shift.date,
        shiftType: shift.shiftType,
      });
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
        const targetShiftIds = [
          previous.shiftGroupId,
          current.shiftGroupId,
        ].filter(Boolean);
        issues.push({
          id: `${staffId}-${previous.id}-${current.id}-overlap`,
          type: "overlap",
          level: "danger",
          title: "Nhân viên bị trùng ca",
          description: `${person?.name || "Nhân viên"} có 2 ca chồng thời gian.`,
          targetShiftId: targetShiftIds[0] || "",
          targetShiftIds,
          targetDate: current.shiftDate || previous.shiftDate || "",
          targetShiftType: current.shiftType || previous.shiftType || "",
        });
      }
    }
  });

  staff.forEach((person) => {
    const staffId = String(person?.id || "");
    if (!staffId) return;
    const employmentType = String(
      person?.employmentType || "full_time",
    ).toLowerCase();
    const minWeeklyHours = getEmploymentTypeMinHours(
      employmentTypePolicy,
      employmentType,
    );
    if (minWeeklyHours <= 0) return;

    const assignedHours = Number(hoursByStaff.get(staffId) || 0);
    if (assignedHours < minWeeklyHours) {
      issues.push({
        id: `${staffId}-below-min-hours`,
        type: "hours",
        level: "warning",
        title: "Nhân viên part-time chưa đạt giờ tối thiểu tuần",
        description: `${person?.name || person?.fullName || "Nhân viên"} mới được xếp ${assignedHours}h / tối thiểu ${minWeeklyHours}h.`,
      });
    }

    const availableHours = resolveStaffWeeklyAvailabilityHours(person);
    if (availableHours > 0 && availableHours < minWeeklyHours) {
      issues.push({
        id: `${staffId}-availability-below-min-hours`,
        type: "availability",
        level: "warning",
        title: "Availability đăng ký không đủ để đạt giờ tối thiểu",
        description: `${person?.name || person?.fullName || "Nhân viên"} chỉ đăng ký ${availableHours}h, thấp hơn mức tối thiểu ${minWeeklyHours}h.`,
      });
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
  const [isAvailabilityPanelCollapsed, setIsAvailabilityPanelCollapsed] =
    useState(false);
  const lastAvailabilityTargetPublicationKeyRef = useRef("");
  const [highlightedShiftIds, setHighlightedShiftIds] = useState([]);
  const [focusedIssueId, setFocusedIssueId] = useState("");
  const shiftHighlightTimerRef = useRef(null);
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [publishConfirmError, setPublishConfirmError] = useState("");
  const [publishIssueSnapshot, setPublishIssueSnapshot] = useState({
    warnings: [],
    dangers: [],
    topIssues: [],
    pendingAcknowledgements: 0,
  });
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
  const [assistantAvailabilityWindows, setAssistantAvailabilityWindows] =
    useState([]);
  const [
    assistantAvailabilitySubmissions,
    setAssistantAvailabilitySubmissions,
  ] = useState([]);
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
    startSchedulingOperations,
  } = useSchedulingPolicy({
    restaurantId: effectiveRestaurantId,
  });
  const normalizeMandatoryRoleList = (roles) => {
    if (!Array.isArray(roles)) return [];
    return Array.from(
      new Set(
        roles
          .map((role) =>
            String(role || "")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );
  };
  const policyMandatoryShiftRoles = useMemo(
    () => normalizeMandatoryRoleList(schedulingPolicy?.mandatoryShiftRoles),
    [schedulingPolicy?.mandatoryShiftRoles],
  );
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

  const schedulingStartedAt = schedulingPolicy?.schedulingOperationalStartAt
    ? new Date(schedulingPolicy.schedulingOperationalStartAt)
    : null;
  const firstWeekGraceAppliedUntil = schedulingPolicy?.firstWeekGracePolicy
    ?.appliedUntil
    ? new Date(schedulingPolicy.firstWeekGracePolicy.appliedUntil)
    : null;
  const isFirstWeekGraceActive = Boolean(
    schedulingStartedAt &&
    firstWeekGraceAppliedUntil &&
    currentDate >= schedulingStartedAt &&
    currentDate <= firstWeekGraceAppliedUntil &&
    schedulingPolicy?.firstWeekGracePolicy?.enabled,
  );
  const isSunday = currentDate.getDay() === 0;
  const managerNextWeekWindow = null;
  const shouldRemindNextWeekRegistration =
    !isSunday && !managerNextWeekWindow?.id;

  const handleStartSchedulingOperations = async () => {
    if (!effectiveRestaurantId) return;
    const ok = await startSchedulingOperations(effectiveRestaurantId);
    if (ok) {
      showNotification("Đã bắt đầu sử dụng lịch làm việc.", "success");
    } else {
      showNotification("Không thể bắt đầu sử dụng lịch làm việc.", "error");
    }
  };

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
  const { data: ackSummaryData } = useQuery(GET_SCHEDULE_ACK_SUMMARY, {
    variables: {
      restaurantId: effectiveRestaurantId,
      periodStart: rangeStart.toISOString(),
      periodEnd: rangeEnd.toISOString(),
    },
    fetchPolicy: "network-only",
    skip: !effectiveRestaurantId || viewMode !== "week",
  });
  const { data: declinedShiftAcksData, refetch: refetchDeclinedShiftAcks } = useQuery(GET_DECLINED_SHIFT_ACKS, {
    variables: {
      restaurantId: effectiveRestaurantId,
      periodStart: rangeStart.toISOString(),
      periodEnd: rangeEnd.toISOString(),
      status: "declined",
    },
    fetchPolicy: "network-only",
    skip: !effectiveRestaurantId || viewMode !== "week",
  });
  const [reviewShiftAck] = useMutation(REVIEW_SHIFT_ACK);
  const currentWeekStart = startOfWeek(rangeStart, { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(rangeStart, { weekStartsOn: 1 });
  const nextWeekStart = startOfWeek(addWeeks(currentWeekStart, 1), {
    weekStartsOn: 1,
  });
  const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });
  const [availabilityMode] = useState("nextWeek");
  const availabilityTargetStart =
    availabilityMode === "currentWeek" ? currentWeekStart : nextWeekStart;
  const availabilityTargetEnd =
    availabilityMode === "currentWeek" ? currentWeekEnd : nextWeekEnd;
  const availabilityTargetStartTime =
    availabilityTargetStart instanceof Date
      ? availabilityTargetStart.getTime()
      : NaN;

  const availabilityTargetEndTime =
    availabilityTargetEnd instanceof Date
      ? availabilityTargetEnd.getTime()
      : NaN;

  const availabilityTargetStartIso = Number.isFinite(
    availabilityTargetStartTime,
  )
    ? new Date(availabilityTargetStartTime).toISOString()
    : "";

  const availabilityTargetEndIso = Number.isFinite(availabilityTargetEndTime)
    ? new Date(availabilityTargetEndTime).toISOString()
    : "";

  const availabilityTargetPublicationKey = [
    effectiveRestaurantId || "",
    availabilityTargetStartIso,
    availabilityTargetEndIso,
  ].join(":");
  const {
    data: managerAvailabilityWindowsData,
    refetch: refetchManagerWindows,
  } = useQuery(GET_AVAILABILITY_WINDOWS, {
    variables: {
      restaurantId: effectiveRestaurantId,
      from: currentWeekStart.toISOString(),
      to: nextWeekEnd.toISOString(),
    },
    fetchPolicy: "network-only",
    skip: !effectiveRestaurantId,
  });
  const managerCurrentWindow = useMemo(() => {
    const windows = managerAvailabilityWindowsData?.availabilityWindows || [];
    return (
      windows.find((item) => {
        const start = new Date(item.periodStart);
        const end = new Date(item.periodEnd);
        return (
          start.getTime() === availabilityTargetStart.getTime() &&
          end.getTime() === availabilityTargetEnd.getTime()
        );
      }) || null
    );
  }, [
    availabilityTargetEnd,
    availabilityTargetStart,
    managerAvailabilityWindowsData?.availabilityWindows,
  ]);
  const managerScheduleWeekWindow = useMemo(() => {
    const windows = managerAvailabilityWindowsData?.availabilityWindows || [];
    return (
      windows.find((item) => {
        const start = new Date(item.periodStart);
        const end = new Date(item.periodEnd);
        return (
          start.getTime() === currentWeekStart.getTime() &&
          end.getTime() === currentWeekEnd.getTime()
        );
      }) || null
    );
  }, [
    currentWeekEnd,
    currentWeekStart,
    managerAvailabilityWindowsData?.availabilityWindows,
  ]);

  const {
    data: managerAvailabilitySubmissionsData,
    refetch: refetchManagerSubmissions,
  } = useQuery(GET_AVAILABILITY_SUBMISSIONS, {
    variables: {
      restaurantId: effectiveRestaurantId,
      windowId: managerCurrentWindow?.id,
    },
    fetchPolicy: "network-only",
    skip: !effectiveRestaurantId || !managerCurrentWindow?.id,
  });

  const [createShift] = useMutation(CREATE_STAFF_SHIFT);
  const [createShifts] = useMutation(CREATE_STAFF_SHIFTS);
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
  const [createAvailabilityWindow, { loading: creatingAvailabilityWindow }] =
    useMutation(CREATE_AVAILABILITY_WINDOW);
  const [openAvailabilityWindow, { loading: openingAvailabilityWindow }] =
    useMutation(OPEN_AVAILABILITY_WINDOW);
  const [closeAvailabilityWindow, { loading: closingAvailabilityWindow }] =
    useMutation(CLOSE_AVAILABILITY_WINDOW);
  const [
    reviewAvailabilitySubmission,
    { loading: reviewingAvailabilitySubmission },
  ] = useMutation(REVIEW_AVAILABILITY_SUBMISSION);
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
  const [loadAvailabilityWindows, availabilityWindowsState] = useLazyQuery(
    GET_AVAILABILITY_WINDOWS,
    {
      fetchPolicy: "network-only",
    },
  );
  const [loadAvailabilitySubmissions, availabilitySubmissionsState] =
    useLazyQuery(GET_AVAILABILITY_SUBMISSIONS, {
      fetchPolicy: "network-only",
    });
  const [loadAssistantContextShifts, assistantContextState] = useLazyQuery(
    GET_STAFF_SHIFTS,
    {
      fetchPolicy: "network-only",
    },
  );
  const [
    loadAvailabilityTargetPublication,
    availabilityTargetPublicationState,
  ] = useLazyQuery(GET_SCHEDULE_PUBLICATION, {
    fetchPolicy: "network-only",
  });

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
          departmentLabel: getDepartmentLabel(item.department),
          role: item.role || null,
          roleSlug: item.role?.slug || "",
          roleName: item.roleName || item.role?.name || "",
          positionTitle: item.positionTitle || "",
          job: resolveStaffAutoRole(item),
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

  const selectedShiftForModal = useMemo(() => {
    if (!selectedShift?.id) return null;

    return (
      shifts.find((item) => String(item.id) === String(selectedShift.id)) ||
      selectedShift
    );
  }, [selectedShift, shifts]);
  const managerAvailabilitySubmissions =
    managerAvailabilitySubmissionsData?.staffAvailabilitySubmissions || [];
  const { data: managerScheduleWeekSubmissionsData } = useQuery(
    GET_AVAILABILITY_SUBMISSIONS,
    {
      variables: {
        restaurantId: effectiveRestaurantId,
        windowId: managerScheduleWeekWindow?.id,
      },
      fetchPolicy: "network-only",
      skip: !effectiveRestaurantId || !managerScheduleWeekWindow?.id,
    },
  );
  const managerScheduleWeekSubmissions =
    managerScheduleWeekSubmissionsData?.staffAvailabilitySubmissions || [];
  const partTimeStaff = useMemo(
    () =>
      staff.filter((person) =>
        ["part_time", "seasonal"].includes(
          String(person.employmentType || "").toLowerCase(),
        ),
      ),
    [staff],
  );
  const managerAvailabilitySummary = useMemo(() => {
    const submittedIds = new Set(
      managerAvailabilitySubmissions
        .filter((item) =>
          ["submitted", "approved", "locked"].includes(item.status),
        )
        .map((item) => String(item.employeeId)),
    );
    const latePending = managerAvailabilitySubmissions.filter(
      (item) => item.status === "late_change_requested",
    ).length;
    return {
      requiredCount: partTimeStaff.length,
      submittedCount: submittedIds.size,
      missingCount: Math.max(0, partTimeStaff.length - submittedIds.size),
      latePending,
    };
  }, [managerAvailabilitySubmissions, partTimeStaff.length]);
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
    schedulePublication?.effectiveStatus ||
    schedulePublication?.status ||
    "draft";
  const schedulePermissions = schedulePublication?.permissions || {
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
  const isDraftLikeSchedule = ["draft", "revision_draft"].includes(
    scheduleLifecycleStatus,
  );
  const hasChangesAfterPublish =
    isSchedulePublished &&
    schedulePublication?.lastChangedAt &&
    schedulePublication?.publishedAt &&
    new Date(schedulePublication.lastChangedAt).getTime() >
      new Date(schedulePublication.publishedAt).getTime();
  const getScheduleStatusClass = () =>
    scheduleLifecycleStatus === "published" && hasChangesAfterPublish
      ? "changed"
      : scheduleLifecycleStatus;
  const getScheduleStatusLabel = () =>
    scheduleLifecycleStatus === "published" && hasChangesAfterPublish
      ? "Đã công bố • Có chỉnh sửa"
      : SCHEDULE_STATUS_LABELS[scheduleLifecycleStatus] || "Bản nháp";
  const selectedShiftIds = useMemo(
    () =>
      (selectedShiftForModal?.records || [])
        .map((record) => record.id)
        .filter(Boolean),
    [selectedShiftForModal],
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
  useEffect(() => {
    if (
      !effectiveRestaurantId ||
      !availabilityTargetStartIso ||
      !availabilityTargetEndIso
    ) {
      lastAvailabilityTargetPublicationKeyRef.current = "";
      return;
    }

    if (
      lastAvailabilityTargetPublicationKeyRef.current ===
      availabilityTargetPublicationKey
    ) {
      return;
    }

    lastAvailabilityTargetPublicationKeyRef.current =
      availabilityTargetPublicationKey;

    loadAvailabilityTargetPublication({
      variables: {
        restaurantId: effectiveRestaurantId,
        periodStart: availabilityTargetStartIso,
        periodEnd: availabilityTargetEndIso,
      },
    }).catch(() => {
      lastAvailabilityTargetPublicationKeyRef.current = "";
    });
  }, [
    availabilityTargetEndIso,
    availabilityTargetPublicationKey,
    availabilityTargetStartIso,
    effectiveRestaurantId,
    loadAvailabilityTargetPublication,
  ]);

  const availabilityTargetPublicationStatus = String(
    availabilityTargetPublicationState?.data?.schedulePublication
      ?.effectiveStatus ||
      availabilityTargetPublicationState?.data?.schedulePublication?.status ||
      "draft",
  ).toLowerCase();
  const canReopenAvailabilityWindowForTargetPeriod = ![
    "published",
    "active",
    "locked",
    "closed",
  ].includes(availabilityTargetPublicationStatus);
  const reopenAvailabilityBlockedReason =
    managerCurrentWindow?.status === "closed" &&
    !canReopenAvailabilityWindowForTargetPeriod
      ? "Không thể mở lại vì lịch tuần này đã được công bố/khóa."
      : "";

  const handleCreateOrOpenAvailabilityWindow = async () => {
    if (!effectiveRestaurantId) return;

    if (!availabilityTargetStartIso || !availabilityTargetEndIso) {
      showNotification("Không xác định được tuần đăng ký lịch.", "error");
      return;
    }

    if (managerCurrentWindow?.id) {
      const targetPeriodPublication = await loadAvailabilityTargetPublication({
        variables: {
          restaurantId: effectiveRestaurantId,
          periodStart: availabilityTargetStartIso,
          periodEnd: availabilityTargetEndIso,
        },
      });
      const targetStatus = String(
        targetPeriodPublication?.data?.schedulePublication?.effectiveStatus ||
          targetPeriodPublication?.data?.schedulePublication?.status ||
          "draft",
      ).toLowerCase();
      if (["published", "active", "locked", "closed"].includes(targetStatus)) {
        showNotification(
          "Không thể mở lại đăng ký: tuần mục tiêu đã công bố hoặc đã khóa/chốt lịch.",
          "warning",
        );
        return;
      }
      const confirmed = window.confirm(
        [
          "Mở lại đăng ký lịch?",
          `Tuần áp dụng: ${format(availabilityTargetStart, "dd/MM/yyyy")} - ${format(availabilityTargetEnd, "dd/MM/yyyy")}`,
          "Sau khi mở lại, nhân viên có thể thay đổi submissions.",
        ].join("\n"),
      );
      if (!confirmed) return;
      await openAvailabilityWindow({
        variables: { id: managerCurrentWindow.id },
      });
    } else {
      await createAvailabilityWindow({
        variables: {
          input: {
            restaurantId: effectiveRestaurantId,
            periodStart: nextWeekStart.toISOString(),
            periodEnd: nextWeekEnd.toISOString(),
          },
        },
      });
    }
    await refetchManagerWindows();
  };

  const handleCloseStatsPanel = () => {
    setIsStatsPanelOpen(false);
    setFocusedIssueId("");
    setHighlightedShiftIds([]);
  };

  const handleCloseAvailabilityWindow = async () => {
    if (!managerCurrentWindow?.id) return;

    const targetWeek = `${format(new Date(managerCurrentWindow.periodStart), "dd/MM/yyyy")} - ${format(new Date(managerCurrentWindow.periodEnd), "dd/MM/yyyy")}`;
    const total = managerAvailabilitySubmissions.length;
    const summaryByStatus = managerAvailabilitySubmissions.reduce(
      (acc, item) => {
        const status = String(item?.status || "pending").toLowerCase();
        acc[status] = Number(acc[status] || 0) + 1;
        return acc;
      },
      {},
    );
    const submittedOrApprovedOrLocked =
      Number(summaryByStatus.submitted || 0) +
      Number(summaryByStatus.approved || 0) +
      Number(summaryByStatus.locked || 0);
    const missing = Math.max(
      0,
      partTimeStaff.length - submittedOrApprovedOrLocked,
    );

    const confirmed = window.confirm(
      [
        "Xác nhận đóng đăng ký availability?",
        `Tuần áp dụng: ${targetWeek}`,
        `Tổng submission: ${total}`,
        `Submitted: ${Number(summaryByStatus.submitted || 0)} | Approved: ${Number(summaryByStatus.approved || 0)} | Locked: ${Number(summaryByStatus.locked || 0)} | Pending: ${Number(summaryByStatus.pending || 0)} | Missing part-time: ${missing}`,
        "Sau khi đóng, dữ liệu đăng ký sẽ được dùng để kiểm tra hợp lệ khi xếp lịch.",
      ].join("\n"),
    );

    if (!confirmed) return;

    await closeAvailabilityWindow({
      variables: { id: managerCurrentWindow.id },
    });
    await refetchManagerWindows();
  };

  const handleReviewLateChange = async (submissionId, approved) => {
    await reviewAvailabilitySubmission({
      variables: {
        input: {
          id: submissionId,
          status: approved ? "approved" : "rejected",
        },
      },
    });
    await refetchManagerSubmissions();
    showNotification(
      approved ? "Đã duyệt thay đổi muộn." : "Đã từ chối thay đổi muộn.",
      "success",
    );
  };
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
        employmentTypePolicy: schedulingPolicy?.employmentTypePolicy,
      }),
    [
      shifts,
      staff,
      policyMandatoryShiftRoles,
      schedulingPolicy?.employmentTypePolicy,
    ],
  );

  const schedulePublishRiskSummary = useMemo(() => {
    const baseIssues = Array.isArray(scheduleInsights?.issues)
      ? scheduleInsights.issues
      : [];
    const dedupedIssues = Array.from(
      new Map(
        baseIssues.map((issue) => [String(issue.id || Math.random()), issue]),
      ).values(),
    );
    const warnings = dedupedIssues.filter(
      (issue) => String(issue.level || "warning").toLowerCase() !== "danger",
    );
    const dangers = dedupedIssues.filter(
      (issue) => String(issue.level || "").toLowerCase() === "danger",
    );
    const pendingAcknowledgements = 0;
    return {
      warnings,
      dangers,
      pendingAcknowledgements,
      topIssues: [...dangers, ...warnings].slice(0, 8),
    };
  }, [scheduleInsights?.issues]);
  const groupPublishWarnings = (issues = []) => {
    const requiredRoleIssues = [];
    const missingStaffIssues = [];
    const minHoursIssues = [];
    const otherIssues = [];

    issues.forEach((issue) => {
      const title = String(issue.title || "").toLowerCase();
      const type = String(issue.type || "").toLowerCase();

      if (
        title.includes("thiếu role") ||
        title.includes("role bắt buộc") ||
        type === "missing_role"
      ) {
        requiredRoleIssues.push(issue);
        return;
      }

      if (
        title.includes("ca thiếu") ||
        title.includes("chưa có nhân sự") ||
        type === "missing"
      ) {
        missingStaffIssues.push(issue);
        return;
      }

      if (
        title.includes("part-time chưa đạt giờ tối thiểu") ||
        title.includes("giờ tối thiểu")
      ) {
        minHoursIssues.push(issue);
        return;
      }

      otherIssues.push(issue);
    });

    return {
      requiredRoleIssues,
      missingStaffIssues,
      minHoursIssues,
      otherIssues,
    };
  };
  const [expandedWarningGroups, setExpandedWarningGroups] = useState({});
  const groupedPublishWarnings = useMemo(
    () => groupPublishWarnings(schedulePublishRiskSummary.warnings),
    [schedulePublishRiskSummary.warnings],
  );
  const minHoursSummaryRows = useMemo(
    () =>
      groupedPublishWarnings.minHoursIssues.map((issue) => ({
        id: issue.id,
        title: issue.title,
        description: issue.description,
      })),
    [groupedPublishWarnings.minHoursIssues],
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
        availabilityWindows: assistantAvailabilityWindows,
        availabilitySubmissions: assistantAvailabilitySubmissions,
        weeklyHoursCap: autoScheduleConfig.weeklyHoursCap,
        employmentTypePolicy: schedulingPolicy?.employmentTypePolicy,
        respectAvailability: autoScheduleConfig.respectAvailability,
        avoidOvertime: autoScheduleConfig.avoidOvertime,
        shiftConfig: configuredShiftTypes,
      }),
    [
      assistantLeaveRows,
      assistantAvailabilitySubmissions,
      assistantAvailabilityWindows,
      assistantForPreview,
      assistantShiftRows,
      autoScheduleConfig.weeklyHoursCap,
      schedulingPolicy?.employmentTypePolicy,
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
      !effectiveRestaurantId ||
      !selectedShiftForModal ||
      selectedShiftIds.length <= 0,
    fetchPolicy: "network-only",
  });
  const selectedShiftChangeLogs = scheduleLogData?.scheduleChangeLogs || [];

  const autoSchedulePreview =
    validatedAutoSchedulePreview || rawAutoSchedulePreview;

  const isGeneratingAutoSchedule =
    schedulingAssistantState.loading ||
    leaveRequestsState.loading ||
    availabilityWindowsState.loading ||
    availabilitySubmissionsState.loading ||
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
  useEffect(
    () => () => {
      if (shiftHighlightTimerRef.current) {
        clearTimeout(shiftHighlightTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    setAssistantPayload(null);
    setAssistantLeaveRows([]);
    setAssistantShiftRows([]);
    setAssistantAvailabilityWindows([]);
    setAssistantAvailabilitySubmissions([]);
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
    setAssistantAvailabilityWindows([]);
    setAssistantAvailabilitySubmissions([]);
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
  const clearShiftHighlightLater = () => {
    if (shiftHighlightTimerRef.current)
      clearTimeout(shiftHighlightTimerRef.current);
    shiftHighlightTimerRef.current = setTimeout(() => {
      setHighlightedShiftIds([]);
      setFocusedIssueId("");
    }, 3000);
  };
  const handleFocusScheduleIssue = (issue) => {
    const targetIds = Array.isArray(issue?.targetShiftIds)
      ? issue.targetShiftIds.filter(Boolean)
      : issue?.targetShiftId
        ? [issue.targetShiftId]
        : [];

    if (!targetIds.length) {
      showNotification(
        "Cảnh báo này chưa liên kết trực tiếp với một ca cụ thể.",
        "warning",
      );
      return;
    }

    const firstTargetId = targetIds[0];
    const targetShift =
      shifts.find((shift) => String(shift.id) === String(firstTargetId)) ||
      null;

    setFocusedIssueId(issue.id);
    setHighlightedShiftIds(targetIds);

    if (targetShift) {
      setIsPublishConfirmOpen(false);
      setSelectedShift(targetShift);
    } else {
      showNotification(
        "Không tìm thấy ca cần sửa trong tuần hiện tại.",
        "warning",
      );
    }

    requestAnimationFrame(() => {
      const firstTarget = document.querySelector(
        `[data-shift-group-id="${firstTargetId}"]`,
      );

      if (firstTarget) {
        firstTarget.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
      }

      clearShiftHighlightLater();
    });
  };
  const handleOpenStaffFromStats = (person) => {
    const staffId = person?.staffId || person?.id;
    const staffName = person?.name || person?.fullName || "";
    const params = new URLSearchParams(window.location.search);
    if (staffId) params.set("employeeId", String(staffId));
    if (staffName) params.set("employeeName", staffName);
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}#staff`;
    window.history.pushState(null, "", nextUrl);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
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
    setExpandedWarningGroups({});
    setPublishIssueSnapshot(schedulePublishRiskSummary);
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
      // TODO(schedule-incident): khi backend có ScheduleIncident service/mutation,
      // gửi snapshot issue publish tại đây với type:
      // - PUBLISH_WITH_WARNING (nếu chỉ có warning)
      // - PUBLISH_WITH_DANGER (nếu có danger/hard conflict)
      // để theo dõi schedule quality.

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
  const handleUpdateAvailabilityPolicy = useAvailabilityPolicyUpdate({
    effectiveRestaurantId,
    schedulingPolicy,
    updateSchedulingPolicy,
    refetchManagerWindows,
    refetchManagerSubmissions,
    stripTypenameDeep,
    showNotification,
    getGraphQLErrorMessage,
  });

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
    const availabilityMessages = {
      PART_TIME_AVAILABILITY_REQUIRED:
        "Nhân viên part-time chưa đăng ký ca này",
      OUTSIDE_SUBMITTED_AVAILABILITY: "Nhân viên part-time chưa đăng ký ca này",
      FULL_TIME_UNAVAILABLE_EXCEPTION:
        "Nhân viên full-time đã báo không khả dụng",
      AVAILABILITY_PENDING_SUBMISSION:
        "Availability chưa đóng, dữ liệu còn chờ cập nhật",
      LATE_AVAILABILITY_CHANGE_PENDING:
        "Thay đổi availability sau hạn đang chờ quản lý duyệt",
    };
    const message = issue?.message || "Có vấn đề với phân công ca.";
    const displayMessage = availabilityMessages[issue?.code] || message;
    const action = issue?.suggestedAction
      ? `\nGợi ý: ${issue.suggestedAction}`
      : "";
    return `- ${displayMessage}${action}`;
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

    if (
      scheduleLifecycleStatus === "published" &&
      !String(payload.publishedReason || "").trim()
    ) {
      throw new Error(
        "Lịch đã công bố, cần nhập lý do khi thêm nhân viên vào ca.",
      );
    }

    setIsSubmittingAddShift(true);

    try {
      const validationFailures = [];
      for (const staffId of staffIds) {
        try {
          await validateShiftAssignmentOrThrow({
            employeeId: staffId,
            shiftType: payload.shiftType,
            startTime,
            endTime,
            precheckOnly: true,
          });
        } catch (error) {
          const employeeName =
            staff.find((person) => String(person.id) === String(staffId))
              ?.name || `#${staffId}`;
          validationFailures.push(
            `${employeeName}: ${getGraphQLErrorMessage(error, "Không thể tạo ca cho nhân viên.")}`,
          );
        }
      }

      if (validationFailures.length) {
        throw new Error(
          `Không thể tạo ca vì có nhân viên không hợp lệ:\n${validationFailures.join("\n")}`,
        );
      }

      if (scheduleLifecycleStatus !== "draft") {
        throw new Error(
          "Không thể thêm nhân viên vào lịch ở trạng thái hiện tại.",
        );
      }

      const mutationResults = await Promise.allSettled(
        staffIds.map((staffId) =>
          createShift({
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
          }),
        ),
      );

      const failedRows = mutationResults
        .map((result, index) => ({ result, staffId: staffIds[index] }))
        .filter((row) => row.result.status === "rejected")
        .map((row) => {
          const employeeName =
            staff.find((person) => String(person.id) === String(row.staffId))
              ?.name || `#${row.staffId}`;
          return `${employeeName}: ${getGraphQLErrorMessage(row.result.reason, "Không thể tạo ca cho nhân viên.")}`;
        });

      if (failedRows.length) {
        throw new Error(
          `Tạo ca chưa hoàn tất cho tất cả nhân viên:\n${failedRows.join("\n")}`,
        );
      }

      await refetch();
      await refetchScheduleLogs?.();

      if (typeof refetchPublication === "function") {
        await refetchPublication();
      }

      setIsAddModalOpen(false);
      setAddModalContext({ date: "", shiftType: "" });

      showNotification(
        scheduleLifecycleStatus === "revision_draft"
          ? `Đã cập nhật bản chỉnh sửa với ${staffIds.length} phân công mới.`
          : `Đã tạo ca cho ${staffIds.length} nhân viên.`,
        "success",
      );
      return;
    } catch (error) {
      const failText = getGraphQLErrorMessage(error, "Không thể tạo ca làm.");
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
      } else if (
        ["published", "revision_draft", "active"].includes(
          scheduleLifecycleStatus,
        )
      ) {
        const reason = String(options.reason || "").trim();

        if (schedulePermissions.requiresChangeReason && !reason) {
          throw new Error("Cần nhập lý do khi xóa ca đã công bố/chỉnh sửa.");
        }

        await deletePublishedShiftGroup({
          variables: {
            input: {
              restaurantId: effectiveRestaurantId,
              shiftIds,
              reason: reason || "Cập nhật ca đã công bố",
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
      throw new Error(
        "Không thể xóa nhân viên khỏi ca ở trạng thái lịch hiện tại.",
      );
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
      const message = "Không tìm thấy ca làm cần cập nhật.";
      showNotification(message, "error");
      throw new Error(message);
    }

    const selectedStaff = staff.find(
      (person) => String(person.id) === String(staffId),
    );

    if (!selectedStaff) {
      const message = "Không tìm thấy nhân viên cần thêm vào ca.";
      showNotification(message, "error");
      throw new Error(message);
    }

    let range;

    try {
      range = buildShiftRange({
        date: shiftGroup.date,
        startTimeText: shiftGroup.startTime,
        endTimeText: shiftGroup.endTime,
      });
    } catch (error) {
      const message = getGraphQLErrorMessage(error, "Giờ ca làm không hợp lệ.");

      showNotification(message, "error");
      throw new Error(message);
    }

    const { startTime, endTime } = range;
    const normalizedLifecycleStatus = String(
      scheduleLifecycleStatus || "draft",
    ).toLowerCase();

    const normalizedShiftType = String(
      shiftGroup.shiftType || "",
    ).toUpperCase();

    try {
      if (["published", "active"].includes(normalizedLifecycleStatus)) {
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
              shiftType: normalizedShiftType,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              reason,
              notifyEmployee: options.notifyEmployee !== false,
              allowOverride: Boolean(options.allowOverride),
              overrideReason: String(options.overrideReason || reason).trim(),
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

      if (["draft", "revision_draft"].includes(normalizedLifecycleStatus)) {
        await createShift({
          variables: {
            input: {
              employeeId: staffId,
              restaurantId: effectiveRestaurantId,
              shiftType: normalizedShiftType,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              status: "scheduled",
              notes: options.reason ? `Lý do thêm ca: ${options.reason}` : "",
            },
          },
        });

        await refetch();

        showNotification(`Đã thêm ${selectedStaff.name} vào ca.`, "success");

        return;
      }

      throw new Error("Không thể thêm nhân viên ở trạng thái lịch hiện tại.");
    } catch (error) {
      const message = getGraphQLErrorMessage(
        error,
        "Không thể thêm nhân viên vào ca.",
      );

      showNotification(message, "error");
      throw new Error(message);
    }
  };
  const handleAddStaffToShiftBatch = async (
    shiftGroupId,
    staffIdsToAdd = [],
    options = {},
  ) => {
    const shiftGroup = shifts.find((item) => item.id === shiftGroupId);

    if (!shiftGroup) {
      const message = "Không tìm thấy ca làm cần cập nhật.";
      showNotification(message, "error");
      throw new Error(message);
    }

    const uniqueStaffIds = Array.from(
      new Set(
        (staffIdsToAdd || []).map((item) => String(item)).filter(Boolean),
      ),
    );

    if (!uniqueStaffIds.length) {
      return {
        successCount: 0,
        failedCount: 0,
        shifts: [],
        errors: [],
      };
    }

    const { startTime, endTime } = buildShiftRange({
      date: shiftGroup.date,
      startTimeText: shiftGroup.startTime,
      endTimeText: shiftGroup.endTime,
    });

    const normalizedShiftType = String(
      shiftGroup.shiftType || "",
    ).toUpperCase();

    const inputs = uniqueStaffIds.map((staffId) => ({
      employeeId: staffId,
      restaurantId: effectiveRestaurantId,
      shiftType: normalizedShiftType,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: "scheduled",
      notes: options.reason ? `Lý do thêm ca: ${options.reason}` : "",
    }));

    try {
      const response = await createShifts({
        variables: {
          inputs,
        },
      });

      const result = response?.data?.createStaffShifts || {
        successCount: 0,
        failedCount: inputs.length,
        shifts: [],
        errors: [],
      };

      if (result.successCount > 0) {
        await refetch();
      }

      if (result.failedCount > 0) {
        const staffById = new Map(
          staff.map((person) => [String(person.id), person]),
        );

        const errorText = result.errors
          .map((error) => {
            const person = staffById.get(String(error.employeeId || ""));
            const name =
              person?.name ||
              person?.fullName ||
              error.employeeId ||
              "Nhân viên";
            return `${name}: ${error.message}`;
          })
          .join("\n");

        showNotification(
          result.successCount > 0
            ? `Đã thêm ${result.successCount} nhân viên, ${result.failedCount} nhân viên bị lỗi.`
            : "Không thể thêm nhân viên vào ca.",
          result.successCount > 0 ? "warning" : "error",
        );

        return {
          ...result,
          errorText,
        };
      }

      showNotification(
        `Đã thêm ${result.successCount} nhân viên vào ca.`,
        "success",
      );

      return result;
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
            const backendWarnings = validation?.warnings || [];
            const localWarnings = assignment.validationWarnings || [];
            const warnings = [
              ...localWarnings,
              ...backendWarnings.filter(
                (warning) =>
                  !localWarnings.some(
                    (local) => String(local.code) === String(warning.code),
                  ),
              ),
            ];

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
    setAssistantAvailabilityWindows([]);
    setAssistantAvailabilitySubmissions([]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const analysisEnd = addDays(
      today,
      Math.max(0, Number(autoScheduleConfig.horizonDays || 1) - 1),
    );

    const contextStart = startOfWeek(today, { weekStartsOn: 1 });
    const contextEnd = endOfWeek(analysisEnd, { weekStartsOn: 1 });

    try {
      const [
        staffResult,
        assistantResult,
        leaveResult,
        shiftResult,
        availabilityWindowResult,
      ] = await Promise.all([
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
        loadAvailabilityWindows({
          variables: {
            restaurantId: effectiveRestaurantId,
            from: contextStart.toISOString(),
            to: contextEnd.toISOString(),
          },
        }),
      ]);

      const nextAssistantPayload =
        assistantResult?.data?.staffSchedulingAssistant || null;
      const nextLeaveRows = leaveResult?.data?.leaveRequests || [];
      const nextShiftRows = shiftResult?.data?.staffShifts || [];
      const nextAvailabilityWindows =
        availabilityWindowResult?.data?.availabilityWindows || [];
      const availabilitySubmissionResults = await Promise.all(
        nextAvailabilityWindows.map((windowRow) =>
          loadAvailabilitySubmissions({
            variables: {
              windowId: windowRow.id,
              restaurantId: effectiveRestaurantId,
            },
          }),
        ),
      );
      const nextAvailabilitySubmissions = availabilitySubmissionResults.flatMap(
        (result) => result?.data?.staffAvailabilitySubmissions || [],
      );
      const nextAssistantForPreview = mergeAssistantWithRequiredRoles(
        nextAssistantPayload,
        autoScheduleConfig.requiredRoles,
      );
      setAssistantPayload(nextAssistantPayload);
      setAssistantLeaveRows(nextLeaveRows);
      setAssistantShiftRows(nextShiftRows);
      setAssistantAvailabilityWindows(nextAvailabilityWindows);
      setAssistantAvailabilitySubmissions(nextAvailabilitySubmissions);

      const nextStaffList = staffResult?.data?.staffList || rawStaffList;

      const nextRawPreview = buildAutoSchedulePreview({
        assistant: nextAssistantForPreview,
        staffList: nextStaffList,
        existingShiftRows: nextShiftRows,
        leaveRequests: nextLeaveRows,
        availabilityWindows: nextAvailabilityWindows,
        availabilitySubmissions: nextAvailabilitySubmissions,
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

          <div className="kpi-card status schedule-status-card">
            <div className="kpi-icon">
              <CalendarCheck2 size={20} />
            </div>
            <div className="kpi-content">
              <span className="label">Trạng thái</span>
              <div className={`status-chip ${getScheduleStatusClass()}`}>
                {getScheduleStatusLabel()}
              </div>
              {scheduleLifecycleStatus === "revision_draft" ? (
                <small className="status-subtext">
                  Đang chỉnh sửa, cần công bố lại để gửi nhân viên.
                </small>
              ) : scheduleLifecycleStatus === "published" &&
                hasChangesAfterPublish ? (
                <small className="status-subtext">
                  Có chỉnh sửa sau lần công bố gần nhất.
                </small>
              ) : null}

              {ackSummaryData?.scheduleAcknowledgementSummary
                ?.totalAssignedStaff > 0 ? (
                <small className="status-subtext">
                  Đã xác nhận:{" "}
                  {
                    ackSummaryData.scheduleAcknowledgementSummary
                      .acknowledgedCount
                  }
                  /
                  {
                    ackSummaryData.scheduleAcknowledgementSummary
                      .totalAssignedStaff
                  }{" "}
                  · Chưa xác nhận:{" "}
                  {ackSummaryData.scheduleAcknowledgementSummary.pendingCount} ·
                  Cần xem lại:{" "}
                  {
                    ackSummaryData.scheduleAcknowledgementSummary
                      .changedAfterAcknowledgementCount
                  }
                </small>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <section className="declined-shift-review-panel">
        <h3>Ca bị từ chối ({(declinedShiftAcksData?.shiftAcknowledgements || []).length})</h3>
        {(declinedShiftAcksData?.shiftAcknowledgements || []).map((ack) => (
          <div key={ack.id} className="declined-shift-review-item">
            <div>Nhân viên: {ack.employeeId}</div>
            <div>Ca: {ack.shiftId}</div>
            <div>Lý do: {ack.reasonCategory} - {ack.reason}</div>
            <div>Phân loại: {ack.declineClassification || "unknown"}</div>
            {!readOnly ? (
              <>
                <button type="button" onClick={async () => { await reviewShiftAck({ variables: { input: { acknowledgementId: ack.id, classification: "valid" } } }); await refetchDeclinedShiftAcks(); }}>
                  Chấp nhận lý do
                </button>
                <button type="button" onClick={async () => { await reviewShiftAck({ variables: { input: { acknowledgementId: ack.id, classification: "invalid" } } }); await refetchDeclinedShiftAcks(); }}>
                  Không duyệt lý do
                </button>
              </>
            ) : (
              <small>Chế độ chỉ xem: không thể duyệt lý do từ chối.</small>
            )}
            {ack.declineClassification === "valid" ? <small>Lý do hợp lệ. Quản lý cần chỉnh lại ca hoặc đổi nhân viên trong ShiftDetailModal.</small> : null}
          </div>
        ))}
      </section>

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
            <span
              className={`schedule-status-badge ${getScheduleStatusClass()}`}
            >
              {getScheduleStatusLabel()}
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

      {!readOnly &&
      !schedulingPolicyLoading &&
      !schedulingPolicy?.schedulingOperationalStartAt ? (
        <div className="schedule-publish-reminder">
          <div className="reminder-content">
            <strong>Bắt đầu sử dụng hệ thống lịch làm việc</strong>
            <p>
              Hệ thống sẽ ghi nhận tuần hiện tại là tuần khởi tạo. Trong tuần
              đầu, nhân viên part-time chưa có availability sẽ được cảnh báo
              thay vì chặn cứng để quản lý có thể tạo lịch gấp.
            </p>
          </div>
          <button type="button" onClick={handleStartSchedulingOperations}>
            Bắt đầu sử dụng
          </button>
        </div>
      ) : null}
      {!readOnly && isFirstWeekGraceActive ? (
        <div className="schedule-publish-reminder">
          <div className="reminder-content">
            <strong>
              Tuần đầu sử dụng hệ thống — thiếu availability của nhân viên bán
              thời gian sẽ được cảnh báo thay vì chặn cứng. Hãy mở đăng ký lịch
              cho tuần sau để vận hành đúng quy trình.
            </strong>
          </div>
        </div>
      ) : null}

      {!readOnly ? (
        <AvailabilityRegistrationPanel
          selectedRestaurantId={effectiveRestaurantId}
          mode={availabilityMode}
          targetWeekStart={availabilityTargetStart}
          targetWeekEnd={availabilityTargetEnd}
          nextWeekStart={nextWeekStart}
          nextWeekEnd={nextWeekEnd}
          availabilityWindow={managerCurrentWindow}
          submissions={managerAvailabilitySubmissions}
          loading={
            creatingAvailabilityWindow ||
            openingAvailabilityWindow ||
            closingAvailabilityWindow
          }
          error={null}
          onCreateWindow={handleCreateOrOpenAvailabilityWindow}
          onOpenWindow={handleCreateOrOpenAvailabilityWindow}
          onCloseWindow={handleCloseAvailabilityWindow}
          collapsed={isAvailabilityPanelCollapsed}
          onToggleCollapse={() =>
            setIsAvailabilityPanelCollapsed((prev) => !prev)
          }
          reopenBlockedReason={reopenAvailabilityBlockedReason}
          availabilityPolicy={schedulingPolicy?.availabilityRegistrationPolicy}
          onUpdateAvailabilityPolicy={handleUpdateAvailabilityPolicy}
          policySaving={updateSchedulingPolicyState.loading}
          onReviewSubmission={handleReviewLateChange}
          reviewingSubmission={reviewingAvailabilitySubmission}
          firstWeekGraceActive={isFirstWeekGraceActive}
          nextWeekWindowMissing={!managerNextWeekWindow?.id}
          isSunday={isSunday}
          shouldRemindNextWeekRegistration={shouldRemindNextWeekRegistration}
        />
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
              onClick={handleCloseStatsPanel}
              aria-label="Đóng thống kê chi tiết"
              title="Đóng thống kê chi tiết"
            >
              {isStatsPanelOpen ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
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
              <p>Bấm vào cảnh báo để trỏ tới ca cần sửa.</p>
              {scheduleInsights.issues.length ? (
                <div className="issue-list">
                  {scheduleInsights.issues.slice(0, 8).map((issue) => (
                    <button
                      type="button"
                      key={issue.id}
                      className={`insight-issue-row ${issue.level || "warning"} ${
                        focusedIssueId === issue.id ? "is-focused" : ""
                      }`}
                      onClick={() => handleFocusScheduleIssue(issue)}
                      title="Bấm để trỏ tới ca cần xử lý"
                    >
                      <AlertTriangle size={14} />
                      <div>
                        <strong>{issue.title}</strong>
                        <span>{issue.description}</span>
                      </div>
                    </button>
                  ))}
                </div>
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
                      {person.staffId ? (
                        <button
                          type="button"
                          className="staff-stat-link"
                          onClick={() => handleOpenStaffFromStats(person)}
                          title="Mở trong Quản lý nhân viên"
                        >
                          {person.name}
                        </button>
                      ) : (
                        <span>{person.name}</span>
                      )}
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
                    <div
                      key={shift.id}
                      data-shift-group-id={shift.id}
                      className={`shift-card-anchor ${highlightedShiftIds.includes(shift.id) ? "is-highlighted" : ""}`}
                    >
                      <ShiftCard
                        shift={shift}
                        staffList={staff}
                        onClick={setSelectedShift}
                      />
                    </div>
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
                          <div
                            data-shift-group-id={shift.id}
                            className={`shift-card-anchor ${highlightedShiftIds.includes(shift.id) ? "is-highlighted" : ""}`}
                          >
                            <ShiftCard
                              shift={shift}
                              staffList={staff}
                              onClick={setSelectedShift}
                            />
                          </div>
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
          availabilitySubmissions={managerScheduleWeekSubmissions}
          mandatoryShiftRoles={policyMandatoryShiftRoles}
          onConfirm={handleConfirmAddShift}
          isSchedulePublished={isSchedulePublished}
          submitting={isSubmittingAddShift || addingPublishedStaff}
        />
      )}

      <ShiftDetailModal
        isOpen={Boolean(selectedShift)}
        onClose={() => setSelectedShift(null)}
        shift={selectedShiftForModal}
        staffList={staff}
        readOnly={readOnly}
        onRemoveStaff={handleRemoveStaffFromShift}
        onAddStaff={handleAddStaffToShift}
        onAddStaffBatch={handleAddStaffToShiftBatch}
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
          mandatoryShiftRoles={policyMandatoryShiftRoles}
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
        <div className="schedule-publish-modal-overlay">
          <div className="schedule-publish-modal">
            <div className="schedule-publish-modal__header">
              <div>
                <h3>Xác nhận công bố lịch</h3>
                <p>
                  Kiểm tra các cảnh báo quan trọng trước khi gửi lịch cho nhân
                  viên.
                </p>
              </div>
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
            </div>
            <div className="schedule-publish-modal__body">
              <div className="publish-summary-grid">
                <div className="publish-summary-card">
                  <span>Phạm vi</span>
                  <strong>
                    {format(rangeStart, "dd/MM/yyyy")} -{" "}
                    {format(rangeEnd, "dd/MM/yyyy")}
                  </strong>
                </div>
                <div className="publish-summary-card">
                  <span>Trạng thái hiện tại</span>
                  <strong>
                    {SCHEDULE_STATUS_LABELS[scheduleLifecycleStatus] ||
                      "Bản nháp"}
                  </strong>
                </div>
                <div className="publish-summary-card">
                  <span>Số nhóm ca</span>
                  <strong>{shifts.length}</strong>
                </div>
                <div className="publish-summary-card">
                  <span>Tổng phân công</span>
                  <strong>{totalAssignmentsForPublish}</strong>
                </div>
                <div className="publish-summary-card">
                  <span>Cảnh báo</span>
                  <strong>{publishIssueSnapshot.warnings.length}</strong>
                </div>
                <div className="publish-summary-card">
                  <span>Nguy cơ nghiêm trọng</span>
                  <strong>{publishIssueSnapshot.dangers.length}</strong>
                </div>
              </div>
              {groupedPublishWarnings.requiredRoleIssues.length > 0 ? (
                <div className="publish-warning-banner">
                  Lịch còn thiếu role bắt buộc ở{" "}
                  {groupedPublishWarnings.requiredRoleIssues.length} ca. Bạn vẫn
                  có thể công bố nếu đã kiểm tra.
                </div>
              ) : null}
              <div className="publish-warning-groups">
                {[
                  {
                    key: "requiredRoleIssues",
                    title: "Thiếu role bắt buộc",
                    items: groupedPublishWarnings.requiredRoleIssues,
                    tone: "critical",
                  },
                  {
                    key: "missingStaffIssues",
                    title: "Ca thiếu nhân sự",
                    items: groupedPublishWarnings.missingStaffIssues,
                  },
                  {
                    key: "otherIssues",
                    title: "Khác",
                    items: groupedPublishWarnings.otherIssues,
                  },
                ]
                  .filter((group) => group.items.length > 0)
                  .map((group) => {
                    const isExpanded = Boolean(
                      expandedWarningGroups[group.key],
                    );
                    const visibleItems = isExpanded
                      ? group.items
                      : group.items.slice(0, 3);
                    return (
                      <div className="publish-warning-group" key={group.key}>
                        <div className="publish-warning-group__header">
                          <h4>{group.title}</h4>
                          <span>{group.items.length}</span>
                        </div>
                        {visibleItems.map((issue) => (
                          <button
                            key={issue.id}
                            type="button"
                            className={`publish-issue-row ${group.tone === "critical" ? "critical" : ""}`}
                            onClick={() => handleFocusScheduleIssue(issue)}
                          >
                            <div className="publish-issue-icon">
                              <AlertTriangle size={14} />
                            </div>
                            <div>
                              <strong>{issue.title}</strong>
                              <span>{issue.description}</span>
                            </div>
                          </button>
                        ))}
                        {group.items.length > 3 ? (
                          <button
                            type="button"
                            className="publish-warning-group__toggle"
                            onClick={() =>
                              setExpandedWarningGroups((prev) => ({
                                ...prev,
                                [group.key]: !isExpanded,
                              }))
                            }
                          >
                            {isExpanded
                              ? "Thu gọn"
                              : `Xem thêm ${group.items.length - 3} cảnh báo`}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                {minHoursSummaryRows.length ? (
                  <div className="publish-warning-group">
                    <div className="publish-warning-group__header">
                      <h4>Nhân viên part-time chưa đạt giờ tối thiểu</h4>
                      <span>{minHoursSummaryRows.length}</span>
                    </div>
                    <div className="publish-issue-row">
                      <div className="publish-issue-icon">
                        <Clock3 size={14} />
                      </div>
                      <div>
                        <strong>
                          {minHoursSummaryRows.length} nhân viên part-time chưa
                          đạt giờ tối thiểu tuần.
                        </strong>
                      </div>
                    </div>
                    {(expandedWarningGroups.minHours
                      ? minHoursSummaryRows
                      : minHoursSummaryRows.slice(0, 3)
                    ).map((item) => (
                      <div className="publish-issue-row compact" key={item.id}>
                        <div>
                          <strong>{item.title}</strong>
                          <span>{item.description}</span>
                        </div>
                      </div>
                    ))}
                    {!expandedWarningGroups.minHours &&
                    minHoursSummaryRows.length > 3 ? (
                      <div className="publish-minhours-more">
                        +{minHoursSummaryRows.length - 3} nhân viên khác
                      </div>
                    ) : null}
                    {minHoursSummaryRows.length > 3 ? (
                      <button
                        type="button"
                        className="publish-warning-group__toggle"
                        onClick={() =>
                          setExpandedWarningGroups((prev) => ({
                            ...prev,
                            minHours: !prev.minHours,
                          }))
                        }
                      >
                        {expandedWarningGroups.minHours
                          ? "Thu gọn"
                          : "Xem danh sách"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {publishIssueSnapshot.pendingAcknowledgements > 0 ? (
                <div className="publish-confirm-error">
                  Còn {publishIssueSnapshot.pendingAcknowledgements} xác nhận từ
                  nhân viên chưa hoàn tất (republish). Vẫn có thể công bố.
                </div>
              ) : null}
              {publishConfirmError ? (
                <div className="publish-confirm-error">
                  {publishConfirmError}
                </div>
              ) : null}
            </div>
            <div className="schedule-publish-modal__footer">
              <label className="publish-confirm-row">
                <input
                  type="checkbox"
                  checked={publishConfirmed}
                  onChange={(event) => {
                    setPublishConfirmed(event.target.checked);
                    if (event.target.checked) setPublishConfirmError("");
                  }}
                  disabled={publishingSchedule}
                />
                <span>
                  Tôi đã kiểm tra các cảnh báo và xác nhận công bố lịch.
                </span>
              </label>
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
                  {publishingSchedule ? "Đang công bố..." : "Công bố lịch"}
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
                chỉnh sửa như bản nháp. Nhân viên sẽ chưa nhận thông báo cho đến
                khi bạn công bố lại lịch.
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
