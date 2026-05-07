import { format, startOfWeek } from "date-fns";

import { shiftTypes } from "./scheduleHelpers";

const ROLE_BY_DEPARTMENT = {
  management: "host",
  kitchen: "cook",
  service: "server",
  cashier: "cashier",
  cleaning: "cleaner",
  delivery: "shipper",
  inventory: "storekeeper",
  bar: "bartender",
};

const SHIFT_ORDER = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  full_day: 3,
  rotating: 4,
};

const DAY_KEYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const PART_TIME_AVAILABILITY_TYPES = new Set(["part_time", "seasonal"]);
const ACTIVE_AVAILABILITY_STATUSES = new Set(["submitted", "locked", "approved", "late_change_requested"]);
const INACTIVE_AVAILABILITY_STATUSES = new Set(["rejected", "cancelled"]);

const NON_BLOCKING_AVAILABILITY_ISSUES = new Set([
  "LATE_AVAILABILITY_CHANGE_PENDING",
]);

const shouldBlockAvailabilityIssue = (issue) =>
  Boolean(issue?.code) && !NON_BLOCKING_AVAILABILITY_ISSUES.has(issue.code);

const AVAILABILITY_WARNING_MESSAGES = {
  PART_TIME_AVAILABILITY_REQUIRED:
    "Nhan vien part-time chua dang ky ca nay",
  OUTSIDE_SUBMITTED_AVAILABILITY:
    "Nhan vien part-time chua dang ky ca nay",
  FULL_TIME_UNAVAILABLE_EXCEPTION:
    "Nhan vien full-time da bao khong kha dung",
  AVAILABILITY_PENDING_SUBMISSION:
    "Availability chua dong, du lieu con cho cap nhat",
  LATE_AVAILABILITY_CHANGE_PENDING:
    "Thay doi availability sau han dang cho quan ly duyet",
};

const formatYmd = (value) => format(new Date(value), "yyyy-MM-dd");

const toValidDate = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

const getShiftSortOrder = (shiftType) =>
  SHIFT_ORDER[String(shiftType || "").toLowerCase()] ?? 99;

export const mapDepartmentToJob = (department) =>
  ROLE_BY_DEPARTMENT[String(department || "").toLowerCase()] || "server";

export const calculateShiftHours = (startTime, endTime) => {
  const start = toValidDate(startTime);
  const end = toValidDate(endTime);
  if (!start || !end || end <= start) return 8;
  return Number(((end.getTime() - start.getTime()) / 3600000 || 8).toFixed(2));
};

export const buildShiftWindow = (
  dateKey,
  shiftType,
  shiftConfig = shiftTypes,
) => {
  const safeDateKey = String(dateKey || "");
  const safeType = String(shiftType || "").toLowerCase();
  const config =
    shiftConfig[safeType] || shiftTypes[safeType] || shiftTypes.morning;
  const [startHour, startMinute] = String(config.startTime || "06:00")
    .split(":")
    .map(Number);
  const [endHour, endMinute] = String(config.endTime || "14:00")
    .split(":")
    .map(Number);

  const start = new Date(`${safeDateKey}T00:00:00`);
  start.setHours(startHour || 0, startMinute || 0, 0, 0);

  const end = new Date(`${safeDateKey}T00:00:00`);
  end.setHours(endHour || 0, endMinute || 0, 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1);

  return {
    start,
    end,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    hours: calculateShiftHours(start, end),
  };
};

const getWeekKey = (value) => {
  const date = toValidDate(value);
  if (!date) return "";
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
};

const getWorkingDayKey = (dateKey) => {
  const date = toValidDate(`${dateKey}T12:00:00`);
  if (!date) return "";
  return DAY_KEYS[date.getDay()] || "";
};

const normalizeEmploymentType = (value) =>
  String(value || "full_time").toLowerCase();

const isAvailabilityWindowClosed = (windowRow, now) => {
  if (!windowRow) return false;
  const status = String(windowRow.status || "").toLowerCase();
  const closeAt = toValidDate(windowRow.closeAt);
  return (
    ["closed", "used_for_schedule"].includes(status) ||
    (closeAt && closeAt < now)
  );
};

const getAvailabilityWindowForDate = (windows = [], dateKey) => {
  return (
    windows.find((windowRow) => {
      if (String(windowRow?.status || "").toLowerCase() === "cancelled") {
        return false;
      }
      const start = toValidDate(windowRow?.periodStart);
      const end = toValidDate(windowRow?.periodEnd);
      if (!start || !end) return false;
      return startOfDayKey(start) <= dateKey && dateKey <= startOfDayKey(end);
    }) || null
  );
};

const startOfDayKey = (value) => format(toValidDate(value), "yyyy-MM-dd");

const buildSubmissionMap = (availabilitySubmissions = []) => {
  const map = new Map();
  for (const submission of availabilitySubmissions || []) {
    const windowId = String(submission?.availabilityWindowId || "");
    const employeeId = String(submission?.employeeId || "");
    if (!windowId || !employeeId) continue;
    map.set(`${windowId}|${employeeId}`, submission);
  }
  return map;
};

const findAvailabilitySlot = (submission, dateKey, shiftType, status) => {
  const safeShiftType = String(shiftType || "").toLowerCase();
  return (submission?.slots || []).find((slot) => {
    if (status && String(slot?.status || "").toLowerCase() !== status) {
      return false;
    }
    const slotDate = toValidDate(slot?.date);
    return (
      slotDate &&
      format(slotDate, "yyyy-MM-dd") === dateKey &&
      String(slot?.shiftType || "").toLowerCase() === safeShiftType
    );
  });
};

const buildAvailabilityIssue = (code, severity = "warning") => ({
  code,
  severity,
  message: AVAILABILITY_WARNING_MESSAGES[code] || "Can xem lai availability",
  suggestedAction:
    code === "AVAILABILITY_PENDING_SUBMISSION"
      ? "Kiem tra lai sau khi window availability dong."
      : "Uu tien nhan vien da available, hoac override co ly do neu van can xep.",
});

const getCandidateAvailabilityIssue = ({
  staff,
  shiftInsight,
  availabilityWindows,
  availabilitySubmissionMap,
  now,
}) => {
  if (!staff) return null;

  const windowRow = getAvailabilityWindowForDate(
    availabilityWindows,
    shiftInsight.date,
  );
  const employmentType = normalizeEmploymentType(staff.employmentType);
  const requiresSubmission = PART_TIME_AVAILABILITY_TYPES.has(employmentType);

  if (!windowRow) {
    return requiresSubmission
      ? buildAvailabilityIssue("AVAILABILITY_PENDING_SUBMISSION", "info")
      : null;
  }

  const submission =
    availabilitySubmissionMap.get(`${String(windowRow.id)}|${String(staff.id)}`) ||
    availabilitySubmissionMap.get(`${String(windowRow._id)}|${String(staff.id)}`);
  const status = String(submission?.status || "").toLowerCase();
  const lateChangePending = status === "late_change_requested";
  const windowClosed = isAvailabilityWindowClosed(windowRow, now);

  if (requiresSubmission) {
    const hasUsableSubmission =
      submission &&
      !INACTIVE_AVAILABILITY_STATUSES.has(status) &&
      ACTIVE_AVAILABILITY_STATUSES.has(status);

    if (!hasUsableSubmission) {
      return windowClosed
        ? buildAvailabilityIssue("PART_TIME_AVAILABILITY_REQUIRED", "risk")
        : buildAvailabilityIssue("AVAILABILITY_PENDING_SUBMISSION", "info");
    }

    if (
      findAvailabilitySlot(
        submission,
        shiftInsight.date,
        shiftInsight.shiftType,
        "available",
      )
    ) {
      return lateChangePending
        ? buildAvailabilityIssue("LATE_AVAILABILITY_CHANGE_PENDING", "warning")
        : null;
    }

    return windowClosed
      ? buildAvailabilityIssue("OUTSIDE_SUBMITTED_AVAILABILITY", "risk")
      : buildAvailabilityIssue("AVAILABILITY_PENDING_SUBMISSION", "info");
  }

  if (
    submission &&
    !INACTIVE_AVAILABILITY_STATUSES.has(status) &&
    String(submission.submissionType || "").toLowerCase() ===
      "unavailable_exception" &&
    findAvailabilitySlot(
      submission,
      shiftInsight.date,
      shiftInsight.shiftType,
      "unavailable",
    )
  ) {
    return buildAvailabilityIssue("FULL_TIME_UNAVAILABLE_EXCEPTION", "warning");
  }

  return lateChangePending
    ? buildAvailabilityIssue("LATE_AVAILABILITY_CHANGE_PENDING", "warning")
    : null;
};

const staffWorksThatDay = (staff, dateKey) => {
  const workingDays = Array.isArray(staff?.workingDays)
    ? staff.workingDays
    : [];
  if (!workingDays.length) return true;
  return workingDays.includes(getWorkingDayKey(dateKey));
};

const leaveBlocksShift = (leave, dateKey, shiftType) => {
  if (!leave || String(leave.status || "").toUpperCase() === "REJECTED")
    return false;

  const shiftDay = String(dateKey || "");
  const startDay = formatYmd(leave.startDate);
  const endDay = formatYmd(leave.endDate);

  if (shiftDay < startDay || shiftDay > endDay) return false;

  const safeShiftType = String(shiftType || "").toLowerCase();
  const startSession = String(leave.startSession || "FULL").toUpperCase();
  const endSession = String(leave.endSession || "FULL").toUpperCase();

  if (startDay === endDay) {
    if (startSession === "MORNING" && endSession === "MORNING") {
      return safeShiftType === "morning";
    }
    if (startSession === "AFTERNOON" && endSession === "AFTERNOON") {
      return safeShiftType === "afternoon" || safeShiftType === "evening";
    }
    return true;
  }

  if (shiftDay === startDay && startSession === "AFTERNOON") {
    return safeShiftType === "afternoon" || safeShiftType === "evening";
  }

  if (shiftDay === endDay && endSession === "MORNING") {
    return safeShiftType === "morning";
  }

  return true;
};

const getWeeklyHours = (weekHoursByStaff, staffId, weekKey) =>
  Number(weekHoursByStaff.get(`${staffId}|${weekKey}`) || 0);

const increaseWeeklyHours = (weekHoursByStaff, staffId, weekKey, hours) => {
  const key = `${staffId}|${weekKey}`;
  weekHoursByStaff.set(
    key,
    Number(
      (getWeeklyHours(weekHoursByStaff, staffId, weekKey) + hours).toFixed(2),
    ),
  );
};

const buildExistingAssignmentsMap = (existingShiftRows = []) => {
  const map = new Map();

  for (const row of existingShiftRows) {
    const employeeId = String(row?.employeeId || "");
    const start = toValidDate(row?.startTime);
    const end = toValidDate(row?.endTime);
    if (!employeeId || !start || !end) continue;

    if (!map.has(employeeId)) {
      map.set(employeeId, []);
    }
    map.get(employeeId).push({
      start,
      end,
      shiftType: String(row?.shiftType || "").toLowerCase(),
      date: format(start, "yyyy-MM-dd"),
    });
  }

  return map;
};

const buildWeekHoursMap = (existingShiftRows = []) => {
  const map = new Map();

  for (const row of existingShiftRows) {
    const employeeId = String(row?.employeeId || "");
    const weekKey = getWeekKey(row?.startTime);
    if (!employeeId || !weekKey) continue;

    increaseWeeklyHours(
      map,
      employeeId,
      weekKey,
      calculateShiftHours(row?.startTime, row?.endTime),
    );
  }

  return map;
};

const buildLeaveMap = (leaveRequests = []) => {
  const map = new Map();

  for (const leave of leaveRequests) {
    const employeeId = String(leave?.employeeId || "");
    if (!employeeId) continue;

    if (!map.has(employeeId)) {
      map.set(employeeId, []);
    }
    map.get(employeeId).push(leave);
  }

  return map;
};

const pushAssignment = (assignmentMap, staffId, assignment) => {
  if (!assignmentMap.has(staffId)) {
    assignmentMap.set(staffId, []);
  }
  assignmentMap.get(staffId).push(assignment);
};

const getCandidateOrder = (shiftInsight) => {
  const order = new Map();
  (shiftInsight?.suggestedCandidates || []).forEach((candidate, index) => {
    const key = `${candidate.staffId}|${candidate.role}`;
    if (!order.has(key)) {
      order.set(key, index);
    }
  });
  return order;
};

const evaluateCandidate = ({
  candidate,
  staff,
  shiftInsight,
  shiftWindow,
  existingAssignedIds,
  currentShiftAssignedIds,
  existingAssignmentsByStaff,
  plannedAssignmentsByStaff,
  leaveByStaff,
  weekHoursByStaff,
  weeklyHoursCap,
  respectAvailability,
  avoidOvertime,
}) => {
  const staffId = String(candidate.staffId || "");
  const staffAssignments = existingAssignmentsByStaff.get(staffId) || [];
  const plannedAssignments = plannedAssignmentsByStaff.get(staffId) || [];
  const leaveRows = leaveByStaff.get(staffId) || [];
  const weekKey = getWeekKey(shiftWindow.startTime);
  const shiftHours = Number(shiftWindow.hours || 0);

  if (!staff) return "Không tìm thấy hồ sơ nhân sự trong staff list";
  if (String(staff.employmentStatus || "").toLowerCase() !== "working") {
    return "Nhân sự không ở trạng thái làm việc";
  }
  if (mapDepartmentToJob(staff.department) !== candidate.role) {
    return "Vai trò thực tế không khớp với gợi ý assistant";
  }
  if (
    existingAssignedIds.has(staffId) ||
    currentShiftAssignedIds.has(staffId)
  ) {
    return "Đã có trong ca hoặc đã được chọn cho ca này";
  }
  const employmentType = normalizeEmploymentType(staff.employmentType);
  const usesAvailabilitySubmission = PART_TIME_AVAILABILITY_TYPES.has(employmentType);

  if (
    respectAvailability &&
    !usesAvailabilitySubmission &&
    !staffWorksThatDay(staff, shiftInsight.date)
  ) {
    return "Không nằm trong workingDays của nhân sự";
  }
  if (
    respectAvailability &&
    candidate.availabilityIssue &&
    shouldBlockAvailabilityIssue(candidate.availabilityIssue)
  ) {
    return candidate.availabilityIssue.message || "Không đạt yêu cầu availability";
  }
  if (
    respectAvailability &&
    leaveRows.some((leave) =>
      leaveBlocksShift(leave, shiftInsight.date, shiftInsight.shiftType),
    )
  ) {
    return "Đang có lịch nghỉ/nghỉ phép trong ngày này";
  }
  if (
    [...staffAssignments, ...plannedAssignments].some((assignment) =>
      overlaps(
        shiftWindow.start,
        shiftWindow.end,
        assignment.start,
        assignment.end,
      ),
    )
  ) {
    return "Bị trùng với ca hiện có";
  }
  if (avoidOvertime && weeklyHoursCap > 0) {
    const nextWeekHours =
      getWeeklyHours(weekHoursByStaff, staffId, weekKey) + shiftHours;
    if (nextWeekHours > weeklyHoursCap) {
      return `Vượt giới hạn ${weeklyHoursCap} giờ/tuần`;
    }
  }
  return "";
};

export const buildAutoSchedulePreview = ({
  assistant,
  staffList = [],
  existingShiftRows = [],
  leaveRequests = [],
  availabilityWindows = [],
  availabilitySubmissions = [],
  weeklyHoursCap = 40,
  employmentTypePolicy = {},
  respectAvailability = true,
  avoidOvertime = true,
  shiftConfig = shiftTypes,
  now = new Date(),
}) => {
  const shiftInsights = assistant?.shifts || [];
  if (!shiftInsights.length) {
    return {
      items: [],
      summary: {
        totalShiftGroups: 0,
        recommendedAssignments: 0,
        blockedAssignments: 0,
        unresolvedShifts: 0,
      },
    };
  }

  const staffById = new Map(
    staffList.map((staff) => [
      String(staff.id),
      {
        id: String(staff.id),
        fullName: staff.fullName || staff.name || "Nhân viên",
        department: String(staff.department || "").toLowerCase(),
        employmentType: normalizeEmploymentType(staff.employmentType),
        employmentStatus: String(staff.employmentStatus || "").toLowerCase(),
        workingDays: Array.isArray(staff.workingDays)
          ? staff.workingDays.map((day) => String(day || "").toUpperCase())
          : [],
      },
    ]),
  );

  const existingAssignmentsByStaff =
    buildExistingAssignmentsMap(existingShiftRows);
  const plannedAssignmentsByStaff = new Map();
  const leaveByStaff = buildLeaveMap(leaveRequests);
  const weekHoursByStaff = buildWeekHoursMap(existingShiftRows);
  const availabilitySubmissionMap = buildSubmissionMap(availabilitySubmissions);

  const sortedInsights = [...shiftInsights].sort(
    (a, b) =>
      String(a.date || "").localeCompare(String(b.date || "")) ||
      getShiftSortOrder(a.shiftType) - getShiftSortOrder(b.shiftType),
  );

  let recommendedAssignments = 0;
  let blockedAssignments = 0;
  let unresolvedShifts = 0;

  const items = sortedInsights.map((shiftInsight) => {
    const shiftWindow = buildShiftWindow(
      shiftInsight.date,
      shiftInsight.shiftType,
      shiftConfig,
    );
    const weekKey = getWeekKey(shiftWindow.startTime);
    const currentShiftAssignedIds = new Set();
    const candidateOrder = getCandidateOrder(shiftInsight);
    const blockedCandidates = [];

    const existingAssignedIds = new Set(
      existingShiftRows
        .filter((row) => {
          const start = toValidDate(row?.startTime);
          return (
            start &&
            format(start, "yyyy-MM-dd") === shiftInsight.date &&
            String(row?.shiftType || "").toLowerCase() ===
              String(shiftInsight.shiftType || "").toLowerCase()
          );
        })
        .map((row) => String(row.employeeId)),
    );

    const missingRoles = (shiftInsight.recommendedRoles || []).filter(
      (role) => Number(role.delta || 0) < 0,
    );

    const plannedAssignments = [];
    const unfilledRoles = [];
    const getMinOrTargetGap = (staffId, staffEmploymentType) => {
      const currentHours = getWeeklyHours(weekHoursByStaff, staffId, weekKey);
      const typePolicy = employmentTypePolicy?.[staffEmploymentType] || {};
      const minHours = Number(typePolicy?.minWeeklyHours || 0);
      const targetHours = Number(typePolicy?.weeklyHoursTarget || 0);
      const minGap = Math.max(0, minHours - currentHours);
      const targetGap = Math.max(0, targetHours - currentHours);
      return minGap > 0 ? minGap + 10 : targetGap;
    };
    const buildFallbackCandidatesForRole = (role) =>
      Array.from(staffById.values())
        .filter((staff) => mapDepartmentToJob(staff.department) === role)
        .map((staff) => ({
          staffId: staff.id,
          fullName: staff.fullName,
          role,
          reason:
            "Đề xuất từ danh sách nhân sự hiện có: đang thuộc bộ phận phù hợp với vai trò cần bổ sung",
          source: "staff_list_fallback",
        }));
    for (const roleNeed of missingRoles) {
      const needed = Math.abs(Number(roleNeed.delta || 0));
      let assignedForRole = 0;

      const assistantRoleCandidates = (
        shiftInsight.suggestedCandidates || []
      ).filter((candidate) => candidate.role === roleNeed.role);

      const fallbackRoleCandidates = buildFallbackCandidatesForRole(
        roleNeed.role,
      );

      const roleCandidateMap = new Map();

      [...assistantRoleCandidates, ...fallbackRoleCandidates].forEach(
        (candidate) => {
          const key = String(candidate.staffId || "");
          if (!key || roleCandidateMap.has(key)) return;
          roleCandidateMap.set(key, candidate);
        },
      );

      const roleCandidates = Array.from(roleCandidateMap.values())
        .map((candidate) => {
          const staff = staffById.get(String(candidate.staffId));
          const availabilityIssue = respectAvailability
            ? getCandidateAvailabilityIssue({
                staff,
                shiftInsight,
                availabilityWindows,
                availabilitySubmissionMap,
                now,
              })
            : null;

          return {
            ...candidate,
            availabilityIssue,
          };
        })
        .sort((left, right) => {
          const leftAvailabilityRisk = left.availabilityIssue ? 1 : 0;
          const rightAvailabilityRisk = right.availabilityIssue ? 1 : 0;
          if (leftAvailabilityRisk !== rightAvailabilityRisk) {
            return leftAvailabilityRisk - rightAvailabilityRisk;
          }

          const leftHours = getWeeklyHours(
            weekHoursByStaff,
            String(left.staffId),
            weekKey,
          );
          const rightHours = getWeeklyHours(
            weekHoursByStaff,
            String(right.staffId),
            weekKey,
          );

          if (leftHours !== rightHours) return leftHours - rightHours;
          const leftStaffType = normalizeEmploymentType(
            staffById.get(String(left.staffId))?.employmentType,
          );
          const rightStaffType = normalizeEmploymentType(
            staffById.get(String(right.staffId))?.employmentType,
          );
          const leftGap = getMinOrTargetGap(String(left.staffId), leftStaffType);
          const rightGap = getMinOrTargetGap(String(right.staffId), rightStaffType);
          if (leftGap !== rightGap) return rightGap - leftGap;

          return (
            (candidateOrder.get(`${left.staffId}|${left.role}`) ?? 99) -
            (candidateOrder.get(`${right.staffId}|${right.role}`) ?? 99)
          );
        });
      const roleRejectedCandidates = [];

      if (!roleCandidates.length) {
        unfilledRoles.push({
          role: roleNeed.role,
          required: Number(roleNeed.required || 0),
          assigned: Number(roleNeed.assigned || 0),
          missing: needed,
          planned: 0,
          unresolved: needed,
          candidateCount: 0,
          blockedCount: 0,
          reason:
            "Không có ứng viên nào được assistant đề xuất cho vai trò này.",
          suggestedAction:
            "Kiểm tra staff thuộc vai trò/bộ phận này, trạng thái làm việc, dữ liệu forecast hoặc cấu hình nhu cầu nhân sự.",
          blockedCandidates: [],
        });

        continue;
      }

      for (const candidate of roleCandidates) {
        if (assignedForRole >= needed) break;

        const staff = staffById.get(String(candidate.staffId));
        const rejectionReason = evaluateCandidate({
          candidate,
          staff,
          shiftInsight,
          shiftWindow,
          existingAssignedIds,
          currentShiftAssignedIds,
          existingAssignmentsByStaff,
          plannedAssignmentsByStaff,
          leaveByStaff,
          weekHoursByStaff,
          weeklyHoursCap,
          respectAvailability,
          avoidOvertime,
        });

        if (rejectionReason) {
          const rejected = {
            staffId: String(candidate.staffId),
            fullName: candidate.fullName || staff?.fullName || "Nhân viên",
            role: candidate.role,
            reason: rejectionReason,
          };

          blockedAssignments += 1;
          blockedCandidates.push(rejected);
          roleRejectedCandidates.push(rejected);
          continue;
        }

        const staffId = String(candidate.staffId);

        assignedForRole += 1;
        currentShiftAssignedIds.add(staffId);

        const availabilityIssueBlocks = shouldBlockAvailabilityIssue(
          candidate.availabilityIssue,
        );

        plannedAssignments.push({
          staffId,
          fullName: candidate.fullName || staff?.fullName || "Nhân viên",
          role: candidate.role,
          validationWarnings: candidate.availabilityIssue
            ? [candidate.availabilityIssue]
            : [],
          requiresOverride: Boolean(
            candidate.availabilityIssue && availabilityIssueBlocks,
          ),
          reason: candidate.reason || "Đề xuất từ scheduling assistant",
          currentWeekHours: getWeeklyHours(weekHoursByStaff, staffId, weekKey),
          projectedWeekHours: Number(
            (
              getWeeklyHours(weekHoursByStaff, staffId, weekKey) +
              shiftWindow.hours
            ).toFixed(2),
          ),
        });

        recommendedAssignments += 1;

        increaseWeeklyHours(
          weekHoursByStaff,
          staffId,
          weekKey,
          shiftWindow.hours,
        );

        pushAssignment(plannedAssignmentsByStaff, staffId, {
          start: toValidDate(shiftWindow.startTime),
          end: toValidDate(shiftWindow.endTime),
          shiftType: shiftInsight.shiftType,
          date: shiftInsight.date,
        });
      }

      const unresolvedForRole = Math.max(0, needed - assignedForRole);

      if (unresolvedForRole > 0) {
        unfilledRoles.push({
          role: roleNeed.role,
          required: Number(roleNeed.required || 0),
          assigned: Number(roleNeed.assigned || 0),
          missing: needed,
          planned: assignedForRole,
          unresolved: unresolvedForRole,
          candidateCount: roleCandidates.length,
          blockedCount: roleRejectedCandidates.length,
          reason:
            assignedForRole > 0
              ? `Đã tìm được ${assignedForRole}/${needed} người, vẫn còn thiếu ${unresolvedForRole}.`
              : "Có ứng viên nhưng tất cả đều bị loại bởi guard.",
          suggestedAction:
            "Xem danh sách ứng viên bị chặn để biết nguyên nhân: nghỉ phép, trùng ca, vượt giờ tuần, ngoài ngày làm việc hoặc không đúng vai trò.",
          blockedCandidates: roleRejectedCandidates,
        });
      }
    }
    const missingHeadcount = Math.max(
      0,
      Number(shiftInsight.recommendedTotalStaff || 0) -
        Number(shiftInsight.currentAssignedStaff || 0),
    );

    const unresolvedCount = unfilledRoles.reduce(
      (sum, role) => sum + Number(role.unresolved || 0),
      0,
    );

    if (unresolvedCount > 0) {
      unresolvedShifts += 1;
    }

    return {
      shiftKey: shiftInsight.shiftKey,
      date: shiftInsight.date,
      shiftType: String(shiftInsight.shiftType || "").toLowerCase(),
      demandLevel: shiftInsight.demandLevel,
      severity: shiftInsight.severity,
      status: shiftInsight.status,
      confidence: Number(shiftInsight.confidence || 0),
      recommendedTotalStaff: Number(shiftInsight.recommendedTotalStaff || 0),
      currentAssignedStaff: Number(shiftInsight.currentAssignedStaff || 0),
      missingHeadcount,
      unresolvedCount,
      recommendedRoles: shiftInsight.recommendedRoles || [],
      plannedAssignments,
      blockedCandidates,
      unfilledRoles,
      canApply: plannedAssignments.length > 0,
      startTime: shiftWindow.startTime,
      endTime: shiftWindow.endTime,
      hours: shiftWindow.hours,
    };
  });

  return {
    items,
    summary: {
      totalShiftGroups: items.length,
      recommendedAssignments,
      blockedAssignments,
      unresolvedShifts,
    },
  };
};

export const buildAutoScheduleCreateInputs = ({
  previewItems = [],
  selectedShiftKeys = {},
  restaurantId,
}) => {
  const inputs = [];
  const dedupe = new Set();

  for (const item of previewItems) {
    if (!selectedShiftKeys[item.shiftKey]) continue;

    if (!item.canApply || !(item.plannedAssignments || []).length) {
      continue;
    }

    for (const assignment of item.plannedAssignments || []) {
      const dedupeKey = `${assignment.staffId}|${item.startTime}|${item.endTime}`;
      if (dedupe.has(dedupeKey)) continue;
      dedupe.add(dedupeKey);

      const scoreText =
        assignment.validationScore != null
          ? ` • Điểm phù hợp: ${assignment.validationScore}/100`
          : "";

      const warningText = assignment.requiresOverride
        ? " • Có cảnh báo policy, cần override khi áp dụng"
        : "";

      const missingText =
        Number(item.unresolvedCount || 0) > 0
          ? ` • Ca còn thiếu ${item.unresolvedCount} vị trí, manager cần bổ sung sau`
          : "";

      inputs.push({
        employeeId: assignment.staffId,
        restaurantId,
        shiftType: String(item.shiftType || "").toUpperCase(),
        startTime: item.startTime,
        endTime: item.endTime,
        status: "scheduled",
        notes: `Auto scheduled${scoreText}${warningText}${missingText}`,
      });
    }
  }

  return inputs;
};
