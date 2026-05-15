import { calculateShiftHours, mapDepartmentToJob } from "./autoSchedule";
import {
  normalizeRoleKey,
  resolveConcreteStaffRoleSlug,
} from "./scheduleHelpers";

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

const AUTO_ROLE_LABELS = {
  server: "Phục vụ",
  cook: "Bếp",
  cashier: "Thu ngân",
  host: "Đón khách",
  cleaner: "Vệ sinh",
  bartender: "Pha chế",
  shipper: "Giao hàng",
  storekeeper: "Kho",
};

const isValidTimeValue = (value) => /^\d{2}:\d{2}$/.test(String(value || ""));

const rangesOverlap = (leftStart, leftEnd, rightStart, rightEnd) =>
  leftStart < rightEnd && rightStart < leftEnd;

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

export const resolveStaffAutoRole = (staff) =>
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

const getDepartmentLabel = (value) =>
  DEPARTMENT_LABELS[String(value || "").toLowerCase()] || "Khác";

const getAutoRoleLabel = (role) => AUTO_ROLE_LABELS[role] || role || "Vai trò";

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
