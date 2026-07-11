import mongoose from "mongoose";
import { Shift, Staff, SchedulePublication } from "../../../models/index.js";
import { validateShiftAssignment } from "./shiftAssignmentValidation.service.js";
import { resolveScheduleLifecycleStatus } from "./scheduleLifecycle.service.js";
import { getSchedulingPolicy } from "./schedulingPolicy.service.js";
import { getStaffMembershipRestaurantFilter } from "../auth/restaurantScope.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const AUTO_SCHEDULE_PARTIAL_APPLY_ERROR =
  "Không thể áp dụng auto schedule vì vẫn còn ca/vai trò chưa được xếp đủ.";
const INVALID_SELECTED_SHIFT_KEYS_ERROR =
  "Một số ca được chọn không còn hợp lệ, vui lòng tạo preview lại.";
const NO_SELECTED_ASSIGNMENTS_ERROR =
  "Không có ca hợp lệ nào được chọn để áp dụng auto schedule.";
const MIN_OVERRIDE_REASON_LENGTH = 5;
const DEFAULT_SCHEDULING_TIMEZONE = "Asia/Ho_Chi_Minh";

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

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function toDate(value, fieldName) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error(`${fieldName} không hợp lệ.`);
  return date;
}

function safeTimeZone(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return DEFAULT_SCHEDULING_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return DEFAULT_SCHEDULING_TIMEZONE;
  }
}

function calendarDate(value, timezone = DEFAULT_SCHEDULING_TIMEZONE) {
  const raw = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    return raw.slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Ngày không hợp lệ.");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function zonedDateTimeToUtc(datePart, timePart, timezone = DEFAULT_SCHEDULING_TIMEZONE) {
  const [year, month, day] = String(datePart).split("-").map(Number);
  const [hour = 0, minute = 0, second = 0] = String(timePart || "00:00:00")
    .split(":")
    .map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
  const rendered = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timezone),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utcGuess);
  const map = Object.fromEntries(rendered.map((part) => [part.type, part.value]));
  const renderedAsUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
    0,
  );
  return new Date(utcGuess.getTime() - (renderedAsUtc - utcGuess.getTime()));
}

function addCalendarDays(value, amount) {
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

function startOfDay(value, timezone = DEFAULT_SCHEDULING_TIMEZONE) {
  return zonedDateTimeToUtc(calendarDate(value, timezone), "00:00:00", timezone);
}

function endOfDay(value, timezone = DEFAULT_SCHEDULING_TIMEZONE) {
  return zonedDateTimeToUtc(calendarDate(value, timezone), "23:59:59", timezone);
}

function hoursBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s) return 0;
  return Number(((e.getTime() - s.getTime()) / 3600000).toFixed(2));
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeShiftType(value) {
  return String(value || "morning").trim().toLowerCase();
}

function getStaffRoleTokens(staff = {}) {
  const normalizedDepartment = normalizeRole(staff.department);
  const mappedDepartmentRole = ROLE_BY_DEPARTMENT[normalizedDepartment] || "";

  return new Set([
    staff.department,
    mappedDepartmentRole,
    staff.positionTitle,
    staff.roleName,
    staff.role?.slug,
    staff.role?.name,
    ...(Array.isArray(staff.skills) ? staff.skills : []),
  ].map(normalizeRole).filter(Boolean));
}

function staffMatchesRole(staff, requiredRole) {
  const role = normalizeRole(requiredRole);
  if (!role) return true;
  const tokens = getStaffRoleTokens(staff);
  return tokens.has(role) || [...tokens].some((token) => token.includes(role) || role.includes(token));
}

function normalizeRequiredRoles(input = {}) {
  const raw = input.mandatoryShiftRoles || input.requiredRoles || {};
  if (Array.isArray(raw)) return { default: raw.map(normalizeRole).filter(Boolean) };
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [normalizeShiftType(key), Array.isArray(value) ? value.map(normalizeRole).filter(Boolean) : []]));
}

function getRequiredRolesForShift(requiredRolesByShift, shiftType) {
  return requiredRolesByShift[normalizeShiftType(shiftType)] || requiredRolesByShift.default || [];
}

function parseTimeOnDay(day, timeValue, fallbackHour, timezone) {
  if (timeValue instanceof Date) return new Date(timeValue);
  const raw = String(timeValue || "").trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return new Date(raw);
  const [hour = fallbackHour, minute = 0, second = 0] = raw.split(":").map(Number);
  return zonedDateTimeToUtc(
    day,
    `${String(Number.isFinite(hour) ? hour : fallbackHour).padStart(2, "0")}:${String(Number.isFinite(minute) ? minute : 0).padStart(2, "0")}:${String(Number.isFinite(second) ? second : 0).padStart(2, "0")}`,
    timezone,
  );
}

function normalizeTemplates(input) {
  const configured = input.shiftTemplates || input.shiftConfig || [];
  const templates = Array.isArray(configured) ? configured : Object.entries(configured || {}).map(([shiftType, cfg]) => ({ shiftType, ...(cfg || {}) }));
  return templates.length ? templates : [{ shiftType: "morning", startTime: "08:00", endTime: "12:00" }];
}

function buildDemandItems(input) {
  const timezone = safeTimeZone(input.timezone);
  const periodStart = calendarDate(input.periodStart, timezone);
  const periodEnd = calendarDate(input.periodEnd, timezone);
  const requiredRolesByShift = normalizeRequiredRoles(input);
  const templates = normalizeTemplates(input);
  const items = [];

  const buildFromTemplate = (day, template) => {
    const shiftType = normalizeShiftType(template.shiftType || template.type || template.key || template.id);
    const startTime = parseTimeOnDay(
      day,
      template.startTime || template.start || template.from,
      shiftType === "evening" ? 17 : 8,
      timezone,
    );
    const endTime = parseTimeOnDay(
      day,
      template.endTime || template.end || template.to,
      shiftType === "evening" ? 22 : 16,
      timezone,
    );
    if (endTime <= startTime) endTime.setUTCDate(endTime.getUTCDate() + 1);

    const hasDateAwareTemplate = Boolean(template?.date);
    const hasExplicitRequiredRoles = Array.isArray(template.requiredRoles);
    if (hasDateAwareTemplate && hasExplicitRequiredRoles && template.requiredRoles.length === 0) {
      return;
    }

    const roles = hasExplicitRequiredRoles
      ? template.requiredRoles.map(normalizeRole).filter(Boolean)
      : getRequiredRolesForShift(requiredRolesByShift, shiftType);
    const normalizedRoles = roles.length ? roles : [""];

    normalizedRoles.forEach((role, roleIndex) => {
      items.push({
        shiftKey: `${startTime.toISOString()}|${endTime.toISOString()}|${shiftType}|${role || "any"}|${roleIndex}`,
        shiftType,
        startTime,
        endTime,
        requiredRole: role,
      });
    });
  };

  for (const template of templates) {
    if (template?.date) {
      const day = calendarDate(template.date, timezone);
      if (day >= periodStart && day <= periodEnd) buildFromTemplate(day, template);
      continue;
    }

    for (
      let cursor = periodStart;
      cursor <= periodEnd;
      cursor = addCalendarDays(cursor, 1)
    ) {
      buildFromTemplate(cursor, template);
    }
  }

  return items;
}

function mapIssue(issue, fallbackCode = "VALIDATION_FAILED") {
  return {
    code: issue?.code || fallbackCode,
    severity: issue?.severity || "error",
    message: issue?.message || "Không đủ điều kiện xếp ca.",
    suggestedAction: issue?.suggestedAction || "",
  };
}

function normalizeIssueList(issues = [], fallbackCode = "VALIDATION_FAILED") {
  if (!Array.isArray(issues)) return [];
  return issues.map((issue) => mapIssue(issue, fallbackCode));
}

function normalizeAutoSchedulePreviewItem(item = {}) {
  const warnings = normalizeIssueList(item.warnings, "AUTO_SCHEDULE_WARNING");
  const validationIssues = normalizeIssueList(item.validationIssues, "VALIDATION_FAILED");
  return {
    ...item,
    status: item.status || (item.employeeId ? "ready" : "blocked"),
    warnings,
    validationIssues,
  };
}

function assertValidOverrideInput(input = {}) {
  if (!input.allowOverride) return;

  const reason = String(input.overrideReason || "").trim();
  if (reason.length < MIN_OVERRIDE_REASON_LENGTH) {
    throw new Error("Cần nhập lý do override hợp lệ trước khi áp dụng auto schedule.");
  }
}

function assertPreviewCanApply(preview) {
  if (preview?.canApply === false || Number(preview?.unresolvedCount || 0) > 0) {
    throw new Error(AUTO_SCHEDULE_PARTIAL_APPLY_ERROR);
  }
}

function getSelectedShiftKeySet(input = {}) {
  if (!Array.isArray(input.selectedShiftKeys) || input.selectedShiftKeys.length === 0) {
    return null;
  }

  return new Set(
    input.selectedShiftKeys.map((key) => String(key || "").trim()),
  );
}

function assertSelectedShiftKeysValid(preview, selectedShiftKeySet) {
  if (!selectedShiftKeySet) return;

  const validShiftKeys = new Set(
    (preview.items || []).map((item) => String(item.shiftKey || "")),
  );
  const invalidKeys = [...selectedShiftKeySet].filter(
    (key) => !validShiftKeys.has(key),
  );

  if (invalidKeys.length > 0) {
    throw new Error(INVALID_SELECTED_SHIFT_KEYS_ERROR);
  }
}

function getApplyScopePreview(preview, selectedShiftKeySet) {
  if (!selectedShiftKeySet) return preview;

  const selectedItems = (preview.items || []).filter((item) =>
    selectedShiftKeySet.has(String(item.shiftKey || "")),
  );
  const plannedAssignments = (preview.plannedAssignments || []).filter((item) =>
    selectedShiftKeySet.has(String(item.shiftKey || "")),
  );
  const unfilledRoles = (preview.unfilledRoles || []).filter((item) =>
    selectedShiftKeySet.has(String(item.shiftKey || "")),
  );
  const unresolvedCount = selectedItems.filter((item) => !item.employeeId || item.status === "blocked").length + unfilledRoles.length;

  return {
    ...preview,
    items: selectedItems.map(normalizeAutoSchedulePreviewItem),
    plannedAssignments: plannedAssignments.map(normalizeAutoSchedulePreviewItem),
    unfilledRoles,
    unresolvedCount,
    canApply: plannedAssignments.length > 0 && unresolvedCount === 0,
  };
}

export async function assertAutoSchedulePeriodCanEdit({ restaurantId, periodStart, periodEnd }) {
  const publication = await SchedulePublication.findOne({ restaurantId, periodStart: { $lte: endOfDay(periodEnd) }, periodEnd: { $gte: startOfDay(periodStart) } }).lean();
  if (!publication) return true;
  const status = resolveScheduleLifecycleStatus({ publication, periodStart: publication.periodStart, periodEnd: publication.periodEnd });
  if (!["draft", "revision_draft"].includes(status)) throw new Error("Không thể áp dụng chia ca tự động khi lịch đã published/active/locked/closed.");
  return true;
}

export async function buildAutoSchedulePreviewBackend(input, ctx = {}) {
  const restaurantId = toObjectId(input.restaurantId);
  if (!restaurantId) throw new Error("restaurantId không hợp lệ.");
  const periodStart = startOfDay(input.periodStart);
  const periodEnd = endOfDay(input.periodEnd);
  const avoidOvertime = input.avoidOvertime !== false;
  const respectAvailability = input.respectAvailability !== false;
  const weeklyHoursCap = Number(input.weeklyHoursCap || 0);

  const staffRows = await Staff.find({ userType: "STAFF", restaurantForStaff: restaurantId, $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] }).lean();
  const existingShifts = await Shift.find({ restaurantId, status: { $ne: "cancelled" }, startTime: { $lte: periodEnd }, endTime: { $gte: periodStart } }).lean();
  const demandItems = buildDemandItems(input);
  const plannedHoursByEmployee = new Map();
  const plannedWindowsByEmployee = new Map();
  const plannedAssignments = [];
  const blockedCandidates = [];
  const items = [];
  const unfilledRoles = [];

  for (const demand of demandItems) {
    const candidates = [];
    for (const staff of staffRows) {
      if (demand.requiredRole && !staffMatchesRole(staff, demand.requiredRole)) {
        const issue = mapIssue({ code: "ROLE_MISMATCH", severity: "error", message: "Nhân viên không đúng role bắt buộc." });
        blockedCandidates.push({ shiftKey: demand.shiftKey, employeeId: String(staff._id), requiredRole: demand.requiredRole, issues: [issue] });
        continue;
      }
      const employeeKey = String(staff._id);
      const plannedOverlap = (plannedWindowsByEmployee.get(employeeKey) || []).some((window) => window.startTime < demand.endTime && window.endTime > demand.startTime);
      if (plannedOverlap) {
        const issue = mapIssue({ code: "PLANNED_SHIFT_OVERLAP", severity: "error", message: "Nhân viên đã được preview cho ca khác trùng thời gian." });
        blockedCandidates.push({ shiftKey: demand.shiftKey, employeeId: employeeKey, requiredRole: demand.requiredRole, issues: [issue] });
        continue;
      }
      const validation = await validateShiftAssignment({ input: { employeeId: staff._id, restaurantId, shiftType: demand.shiftType, startTime: demand.startTime, endTime: demand.endTime, allowOverride: input.allowOverride, overrideReason: input.overrideReason } });
      const plannedHours = Number(plannedHoursByEmployee.get(String(staff._id)) || 0);
      const afterPlanned = Number((Number(validation.metrics?.weeklyHoursAfter || 0) + plannedHours).toFixed(2));
      const blocking = [...(validation.blockingErrors || [])];
      if (avoidOvertime && weeklyHoursCap > 0 && afterPlanned > weeklyHoursCap) blocking.push({ code: "WEEKLY_HOURS_CAP_EXCEEDED", severity: "error", message: `Tổng giờ tuần sau khi xếp ca vượt giới hạn ${weeklyHoursCap}h.` });
      if (respectAvailability && (validation.warnings || []).some((issue) => String(issue.code || "").includes("AVAILABILITY")) && !input.allowOverride) blocking.push({ code: "AVAILABILITY_VIOLATION", severity: "error", message: "Nhân viên không phù hợp availability đã đăng ký." });
      if (blocking.length) {
        blockedCandidates.push({ shiftKey: demand.shiftKey, employeeId: String(staff._id), requiredRole: demand.requiredRole, issues: normalizeIssueList(blocking) });
        continue;
      }
      candidates.push({ staff, validation, afterPlanned });
    }

    candidates.sort((a, b) => Number(b.validation.score || 0) - Number(a.validation.score || 0));
    const selected = candidates[0] || null;
    if (!selected) {
      const validationIssues = [mapIssue({ code: "NO_ELIGIBLE_CANDIDATE", severity: "error", message: "Không có nhân viên đủ điều kiện." })];
      unfilledRoles.push({ shiftKey: demand.shiftKey, shiftType: demand.shiftType, startTime: demand.startTime, endTime: demand.endTime, requiredRole: demand.requiredRole, reason: "NO_ELIGIBLE_CANDIDATE" });
      items.push(normalizeAutoSchedulePreviewItem({
        ...demand,
        status: "blocked",
        employeeId: null,
        employeeName: null,
        warnings: [],
        validationIssues,
      }));
      continue;
    }
    const employeeId = String(selected.staff._id);
    plannedHoursByEmployee.set(employeeId, Number((Number(plannedHoursByEmployee.get(employeeId) || 0) + hoursBetween(demand.startTime, demand.endTime)).toFixed(2)));
    plannedWindowsByEmployee.set(employeeId, [
      ...(plannedWindowsByEmployee.get(employeeId) || []),
      { startTime: demand.startTime, endTime: demand.endTime },
    ]);
    const warnings = normalizeIssueList(selected.validation.warnings || [], "AUTO_SCHEDULE_WARNING");
    const item = normalizeAutoSchedulePreviewItem({
      ...demand,
      status: warnings.length ? "warning" : "ready",
      employeeId,
      employeeName: selected.staff.fullName || null,
      score: selected.validation.score || 0,
      warnings,
      validationIssues: warnings,
    });
    items.push(item);
    plannedAssignments.push(item);
  }

  const normalizedItems = items.map(normalizeAutoSchedulePreviewItem);
  const normalizedPlannedAssignments = plannedAssignments.map(normalizeAutoSchedulePreviewItem);
  const normalizedUnfilledIssues = unfilledRoles.map((row) => mapIssue({
    code: row.reason,
    severity: "error",
    message: `Thiếu nhân sự cho ${row.requiredRole || row.shiftType}.`,
  }));
  const summary = {
    totalDemand: demandItems.length,
    recommendedAssignments: normalizedPlannedAssignments.length,
    warningAssignments: normalizedItems.filter((item) => item.status === "warning").length,
    blockedAssignments: normalizedItems.filter((item) => item.status === "blocked").length,
    existingShiftCount: existingShifts.length,
  };
  const unresolvedCount = unfilledRoles.length;
  return {
    items: normalizedItems,
    summary,
    plannedAssignments: normalizedPlannedAssignments,
    blockedCandidates,
    unfilledRoles,
    unresolvedCount,
    canApply: normalizedPlannedAssignments.length > 0 && unresolvedCount === 0,
    warnings: [],
    validationIssues: normalizedUnfilledIssues,
  };
}

export async function buildAutoScheduleCreateInputs(input, ctx = {}) {
  assertValidOverrideInput(input);

  const preview = await buildAutoSchedulePreviewBackend(input, ctx);
  const selectedShiftKeySet = getSelectedShiftKeySet(input);
  assertSelectedShiftKeysValid(preview, selectedShiftKeySet);

  const applyPreview = getApplyScopePreview(preview, selectedShiftKeySet);
  if (selectedShiftKeySet && applyPreview.plannedAssignments.length === 0) {
    throw new Error(NO_SELECTED_ASSIGNMENTS_ERROR);
  }
  assertPreviewCanApply(applyPreview);

  return applyPreview.plannedAssignments.map((item) => ({
    employeeId: item.employeeId,
    restaurantId: input.restaurantId,
    shiftType: item.shiftType,
    startTime: item.startTime,
    endTime: item.endTime,
    status: "scheduled",
    notes: "Auto schedule backend",
    allowOverride: Boolean(input.allowOverride),
    overrideReason: input.allowOverride ? String(input.overrideReason || "").trim() : undefined,
  }));
}

export {
  AUTO_SCHEDULE_PARTIAL_APPLY_ERROR,
  INVALID_SELECTED_SHIFT_KEYS_ERROR,
  NO_SELECTED_ASSIGNMENTS_ERROR,
};
