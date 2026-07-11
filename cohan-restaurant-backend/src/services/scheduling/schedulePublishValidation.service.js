import mongoose from "mongoose";
import { Shift, Staff } from "../../../models/index.js";
import { getSchedulingPolicy } from "./schedulingPolicy.service.js";
import { validateShiftAssignment } from "./shiftAssignmentValidation.service.js";
import { getStaffMembershipRestaurantFilter } from "../auth/restaurantScope.service.js";

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function getStaffRoleTokens(staff = {}) {
  return new Set([staff.department, staff.positionTitle, staff.roleName, staff.role?.slug, staff.role?.name, ...(Array.isArray(staff.skills) ? staff.skills : [])].map(normalizeRole).filter(Boolean));
}

function staffMatchesRole(staff, requiredRole) {
  const role = normalizeRole(requiredRole);
  if (!role) return true;
  const tokens = getStaffRoleTokens(staff);
  return tokens.has(role) || [...tokens].some((token) => token.includes(role) || role.includes(token));
}

function normalizeMandatoryShiftRoles(value) {
  if (!value) return {};
  if (Array.isArray(value)) return { default: value.map(normalizeRole).filter(Boolean) };
  if (typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).map(([key, roles]) => [String(key).toLowerCase(), Array.isArray(roles) ? roles.map(normalizeRole).filter(Boolean) : []]));
}

function pushIssue(issues, issue) {
  issues.push({ code: issue.code, severity: issue.severity || "error", message: issue.message, shiftId: issue.shiftId ? String(issue.shiftId) : null, employeeId: issue.employeeId ? String(issue.employeeId) : null, suggestedAction: issue.suggestedAction || "" });
}

export function hasBlockingSchedulePublishIssues(result) {
  return (result?.issues || []).some((issue) => issue.severity === "error");
}

export async function validateScheduleBeforePublish({ restaurantId, periodStart, periodEnd, mandatoryShiftRoles }) {
  const rid = toObjectId(restaurantId);
  if (!rid) throw new Error("restaurantId không hợp lệ.");
  const trustedMandatoryShiftRoles = Array.isArray(mandatoryShiftRoles)
    ? mandatoryShiftRoles
    : (await getSchedulingPolicy({ restaurantId: rid }))?.mandatoryShiftRoles;
  const requiredRoles = normalizeMandatoryShiftRoles(trustedMandatoryShiftRoles);
  const issues = [];
  const shifts = await Shift.find({ restaurantId: rid, startTime: { $lte: periodEnd }, endTime: { $gte: periodStart }, status: { $ne: "cancelled" } }).lean();
  const employeeIds = [...new Set(shifts.map((shift) => String(shift.employeeId)).filter(Boolean))];
  const staffScopeFilter = await getStaffMembershipRestaurantFilter(rid, {
    roles: ["staff", "manager"],
  });
  const staffRows = employeeIds.length
    ? await Staff.find({
        $and: [{ _id: { $in: employeeIds } }, staffScopeFilter],
      }).lean()
    : [];
  const staffById = new Map(staffRows.map((staff) => [String(staff._id), staff]));
  const seenRequired = new Map();

  if (!shifts.length) {
    pushIssue(issues, { code: "EMPTY_SCHEDULE", severity: "error", message: "Không thể công bố lịch rỗng. Cần có ít nhất 1 ca làm trong tuần." });
  }

  for (const shift of shifts) {
    if (!shift.employeeId) {
      pushIssue(issues, { code: "UNASSIGNED_SHIFT", severity: "error", message: "Ca làm chưa có nhân viên.", shiftId: shift._id });
      continue;
    }
    const staff = staffById.get(String(shift.employeeId));
    if (!staff) {
      pushIssue(issues, { code: "STAFF_NOT_IN_RESTAURANT", severity: "error", message: "Nhân viên trong ca không thuộc nhà hàng.", shiftId: shift._id, employeeId: shift.employeeId });
      continue;
    }
    if (String(staff.employmentStatus || "").toLowerCase() !== "working") {
      pushIssue(issues, { code: "STAFF_NOT_WORKING", severity: "error", message: "Nhân viên không còn ở trạng thái working.", shiftId: shift._id, employeeId: shift.employeeId });
    }
    const rolesForShift = requiredRoles[String(shift.shiftType || "").toLowerCase()] || requiredRoles.default || [];
    for (const role of rolesForShift) {
      if (staffMatchesRole(staff, role)) seenRequired.set(`${shift.shiftType}:${role}`, true);
    }
    if (rolesForShift.length && !rolesForShift.some((role) => staffMatchesRole(staff, role))) {
      pushIssue(issues, { code: "MANDATORY_ROLE_MISSING_ON_SHIFT", severity: "error", message: "Nhân viên không đáp ứng role bắt buộc của ca.", shiftId: shift._id, employeeId: shift.employeeId });
    }
    const validation = await validateShiftAssignment({ input: { employeeId: shift.employeeId, restaurantId: rid, shiftType: shift.shiftType, startTime: shift.startTime, endTime: shift.endTime, ignoreShiftId: shift._id } });
    for (const issue of validation.blockingErrors || []) pushIssue(issues, { ...issue, shiftId: shift._id, employeeId: shift.employeeId });
    for (const issue of validation.warnings || []) pushIssue(issues, { ...issue, severity: "warning", shiftId: shift._id, employeeId: shift.employeeId });
  }

  for (const [shiftType, roles] of Object.entries(requiredRoles)) {
    for (const role of roles) {
      if (!seenRequired.get(`${shiftType}:${role}`) && shiftType !== "default") {
        pushIssue(issues, { code: "MANDATORY_ROLE_UNFILLED", severity: "error", message: `Thiếu role bắt buộc ${role} cho ca ${shiftType}.` });
      }
    }
  }

  return { ok: !hasBlockingSchedulePublishIssues({ issues }), errorCount: issues.filter((issue) => issue.severity === "error").length, warningCount: issues.filter((issue) => issue.severity === "warning").length, issues };
}
