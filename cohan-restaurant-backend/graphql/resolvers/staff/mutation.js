// src/graphql/staff/mutation.js
import mongoose from "mongoose";
import {
  Staff,
  Role,
  EventLog,
  Shift,
  Timesheet,
  LeaveRequest,
  LeaveBalance,
  PayrollSetting,
  PayrollPeriod,
  PayrollItem,
  PayrollAdjustment,
  EmployeeCodeCounter,
} from "../../../models/index.js";
import { mailer } from "../../../lib/mailer.js";
import {
  getPayrollSettings,
  getPeriodDetail,
  mapPayrollDocToGql,
  toEndOfDay as payrollToEndOfDay,
  toObjectId as payrollToObjectId,
  toStartOfDay as payrollToStartOfDay,
  upsertPeriodItems,
} from "../../../src/services/payroll/payrollRuntime.service.js";

function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

const EMPLOYEE_CODE_PREFIX = "NV";
const EMPLOYEE_CODE_COUNTER_RETRIES = 3;

function formatEmployeeCode(sequence) {
  const padded = String(Math.max(Number(sequence) || 0, 0)).padStart(4, "0");
  return `${EMPLOYEE_CODE_PREFIX}${padded}`;
}

async function getNextEmployeeCode(restaurantId) {
  const rid = toObjectId(restaurantId);
  if (!rid) {
    throw new Error("Missing primary restaurant to generate employee code");
  }

  let lastError = null;
  for (let attempt = 1; attempt <= EMPLOYEE_CODE_COUNTER_RETRIES; attempt += 1) {
    try {
      const counter = await EmployeeCodeCounter.findOneAndUpdate(
        { restaurantId: rid },
        {
          $setOnInsert: { restaurantId: rid },
          $inc: { seq: 1 },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      return formatEmployeeCode(counter?.seq);
    } catch (error) {
      lastError = error;
      if (error?.code !== 11000 || attempt === EMPLOYEE_CODE_COUNTER_RETRIES) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Failed to generate employee code");
}

function toStartOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toEndOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function mapAttendanceStatus(timesheet) {
  if (!timesheet?.actualCheckInAt) return timesheet?.isOffSchedule ? "unscheduled_absent" : "scheduled_absent";
  if (!timesheet?.actualCheckOutAt) return timesheet?.isOffSchedule ? "unscheduled_checkin" : "checked_in";
  if (timesheet?.isOffSchedule) return "unscheduled_completed";
  const hasLate = Number(timesheet?.latenessMinutes || 0) > 0;
  const hasEarly = Number(timesheet?.earlyLeaveMinutes || 0) > 0;
  if (hasLate && hasEarly) return "late_early_leave";
  if (hasLate) return "late";
  if (hasEarly) return "early_leave";
  return "completed";
}

function toMinutes(ms) {
  return Math.max(Math.round(ms / 60000), 0);
}

function mapAttendanceOutput(timesheet, staff) {
  return {
    id: String(timesheet._id),
    employeeId: String(timesheet.employeeId),
    employeeName: staff?.fullName || null,
    employeeCode: staff?.employeeCode || null,
    employeeRole: staff?.positionTitle || staff?.roleName || staff?.role?.name || null,
    employeeAvatar: staff?.avatarUrl || staff?.avatar || null,
    restaurantId: String(timesheet.restaurantId),
    workDate: timesheet.workDate,
    shiftId: timesheet.shiftId ? String(timesheet.shiftId._id || timesheet.shiftId) : null,
    shiftType: timesheet.shiftId?.shiftType || null,
    plannedStartTime: timesheet.plannedStartTime || timesheet.shiftId?.startTime || null,
    plannedEndTime: timesheet.plannedEndTime || timesheet.shiftId?.endTime || null,
    actualCheckInAt: timesheet.actualCheckInAt || null,
    actualCheckOutAt: timesheet.actualCheckOutAt || null,
    workedMinutes: Number(timesheet.workedMinutes || 0),
    hours: Number(timesheet.hours || 0),
    latenessMinutes: Number(timesheet.latenessMinutes || 0),
    earlyLeaveMinutes: Number(timesheet.earlyLeaveMinutes || 0),
    overtimeMinutes: Number(timesheet.overtimeMinutes || 0),
    status: mapAttendanceStatus(timesheet),
    isOffSchedule: Boolean(timesheet.isOffSchedule),
    source: timesheet.source || "quick",
    note: timesheet.note || "",
    approved: Boolean(timesheet.approved),
    createdAt: timesheet.createdAt || null,
    updatedAt: timesheet.updatedAt || null,
  };
}

function fromGraphLeaveType(value) {
  const map = {
    ANNUAL: "annual",
    SICK: "sick",
    UNPAID: "unpaid",
    PAID_PERSONAL: "paid_personal",
    MATERNITY: "maternity",
    COMPENSATORY: "compensatory",
    HOLIDAY: "holiday",
    HALF_DAY: "half_day",
  };
  return map[String(value || "").toUpperCase()] || "annual";
}

function fromGraphSession(value) {
  const map = { FULL: "full", MORNING: "morning", AFTERNOON: "afternoon" };
  return map[String(value || "").toUpperCase()] || "full";
}

function toGraphLeaveType(value) {
  const reverse = {
    annual: "ANNUAL",
    sick: "SICK",
    unpaid: "UNPAID",
    paid_personal: "PAID_PERSONAL",
    maternity: "MATERNITY",
    compensatory: "COMPENSATORY",
    holiday: "HOLIDAY",
    half_day: "HALF_DAY",
  };
  return reverse[String(value || "").toLowerCase()] || "ANNUAL";
}

function toGraphLeaveStatus(value) {
  const reverse = {
    pending: "PENDING",
    pending_replacement_confirmation: "PENDING_REPLACEMENT_CONFIRMATION",
    approved: "APPROVED",
    rejected: "REJECTED",
  };
  return reverse[String(value || "").toLowerCase()] || "PENDING";
}

function toGraphReplacementStatus(value) {
  const reverse = {
    not_required: "NOT_REQUIRED",
    pending: "PENDING",
    confirmed: "CONFIRMED",
    rejected: "REJECTED",
  };
  return reverse[String(value || "").toLowerCase()] || "NOT_REQUIRED";
}

function toGraphSession(value) {
  const reverse = { full: "FULL", morning: "MORNING", afternoon: "AFTERNOON" };
  return reverse[String(value || "").toLowerCase()] || "FULL";
}

function calcLeaveDays(startDate, endDate, startSession = "full", endSession = "full", leaveType = "annual") {
  if (leaveType === "half_day") return 0.5;
  const start = toStartOfDay(startDate);
  const end = toStartOfDay(endDate);
  if (end < start) return 0;

  let days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (startSession !== "full") days -= 0.5;
  if (endSession !== "full" && days > 0.5) days -= 0.5;
  return Math.max(Number(days.toFixed(2)), 0);
}

function computeLeaveFlags(leaveType, requestedDays) {
  const paidTypes = new Set(["annual", "sick", "paid_personal", "maternity", "compensatory", "holiday", "half_day"]);
  const deductTypes = new Set(["annual", "sick", "compensatory", "half_day"]);
  const isPaidLeave = paidTypes.has(leaveType);
  const deductLeaveBalance = deductTypes.has(leaveType);
  const isHalfDay = leaveType === "half_day" || requestedDays === 0.5;
  const quotaImpact = {
    deductAnnualDays: leaveType === "annual" || leaveType === "half_day" ? requestedDays : 0,
    deductSickDays: leaveType === "sick" ? requestedDays : 0,
    deductCompensatoryDays: leaveType === "compensatory" ? requestedDays : 0,
    totalDeductDays: deductLeaveBalance ? requestedDays : 0,
  };
  return {
    payrollFlags: {
      isPaidLeave,
      deductLeaveBalance,
      payrollCountable: isPaidLeave,
      halfDayFactor: isHalfDay ? 0.5 : 1,
      maternityTreatment: leaveType === "maternity",
      holidayTreatment: leaveType === "holiday",
      compensatoryTreatment: leaveType === "compensatory",
      unpaidFactor: isPaidLeave ? 0 : 1,
    },
    quotaImpact,
  };
}

async function applyLeaveBalanceImpact({ employeeId, year, quotaImpact }) {
  if (!quotaImpact || Number(quotaImpact.totalDeductDays || 0) <= 0) return null;
  const balance =
    (await LeaveBalance.findOne({ employeeId, year })) ||
    (await LeaveBalance.create({ employeeId, year }));
  balance.annualUsedDays += Number(quotaImpact.deductAnnualDays || 0);
  balance.sickUsedDays += Number(quotaImpact.deductSickDays || 0);
  balance.compensatoryUsedDays += Number(quotaImpact.deductCompensatoryDays || 0);
  balance.annualRemainingDays = Math.max(balance.annualEntitledDays - balance.annualUsedDays, 0);
  balance.sickRemainingDays = Math.max(balance.sickEntitledDays - balance.sickUsedDays, 0);
  balance.compensatoryRemainingDays = Math.max(
    balance.compensatoryEntitledDays - balance.compensatoryUsedDays,
    0
  );
  await balance.save();
  return balance;
}

function mapLeaveOutput(row) {
  return {
    id: String(row._id),
    employeeId: String(row.employeeId?._id || row.employeeId),
    employeeName: row.employeeId?.fullName || null,
    employeeCode: row.employeeId?.employeeCode || null,
    employeeRole: row.employeeId?.positionTitle || row.employeeId?.roleName || null,
    employeeAvatar: row.employeeId?.avatarUrl || row.employeeId?.avatar || null,
    restaurantId: String(row.restaurantId),
    leaveType: toGraphLeaveType(row.leaveType),
    startDate: row.startDate,
    endDate: row.endDate,
    startSession: toGraphSession(row.startSession),
    endSession: toGraphSession(row.endSession),
    requestedDays: Number(row.requestedDays || 0),
    requestedHours: Number(row.requestedHours || 0),
    reason: row.reason || "",
    status: toGraphLeaveStatus(row.status),
    approverId: row.approverId?._id ? String(row.approverId._id) : row.approverId ? String(row.approverId) : null,
    approverName: row.approverId?.fullName || null,
    approvedAt: row.approvedAt || null,
    rejectedAt: row.rejectedAt || null,
    rejectionReason: row.rejectionReason || "",
    replacementManagerId: row.replacementManagerId?._id
      ? String(row.replacementManagerId._id)
      : row.replacementManagerId
      ? String(row.replacementManagerId)
      : null,
    replacementManagerName: row.replacementManagerId?.fullName || null,
    replacementStatus: toGraphReplacementStatus(row.replacementStatus),
    replacementConfirmedAt: row.replacementConfirmedAt || null,
    replacementConfirmedBy: row.replacementConfirmedBy?._id
      ? String(row.replacementConfirmedBy._id)
      : row.replacementConfirmedBy
      ? String(row.replacementConfirmedBy)
      : null,
    payrollFlags: {
      isPaidLeave: Boolean(row.payrollFlags?.isPaidLeave),
      deductLeaveBalance: Boolean(row.payrollFlags?.deductLeaveBalance),
      payrollCountable: Boolean(row.payrollFlags?.payrollCountable),
      halfDayFactor: Number(row.payrollFlags?.halfDayFactor ?? 1),
      maternityTreatment: Boolean(row.payrollFlags?.maternityTreatment),
      holidayTreatment: Boolean(row.payrollFlags?.holidayTreatment),
      compensatoryTreatment: Boolean(row.payrollFlags?.compensatoryTreatment),
      unpaidFactor: Number(row.payrollFlags?.unpaidFactor ?? 0),
    },
    quotaImpact: {
      deductAnnualDays: Number(row.quotaImpact?.deductAnnualDays || 0),
      deductSickDays: Number(row.quotaImpact?.deductSickDays || 0),
      deductCompensatoryDays: Number(row.quotaImpact?.deductCompensatoryDays || 0),
      totalDeductDays: Number(row.quotaImpact?.totalDeductDays || 0),
    },
    leaveBalanceSnapshot: null,
    auditLogs: (row.auditLogs || []).map((item) => ({
      action: item.action,
      actorId: item.actorId ? String(item.actorId) : null,
      actorName: item.actorName || null,
      note: item.note || "",
      at: item.at || null,
    })),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function formatLeaveTypeLabel(leaveType) {
  const map = {
    annual: "Nghỉ năm",
    sick: "Nghỉ bệnh",
    unpaid: "Nghỉ không lương",
    paid_personal: "Nghỉ việc riêng có lương",
    maternity: "Nghỉ thai sản",
    compensatory: "Nghỉ bù",
    holiday: "Nghỉ lễ/tết",
    half_day: "Nghỉ nửa ngày",
  };
  return map[String(leaveType || "").toLowerCase()] || leaveType;
}

function formatDateVi(date) {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? String(date || "") : d.toLocaleDateString("vi-VN");
}

async function sendLeaveDecisionMail({ leaveDoc, decision }) {
  const employeeEmail = String(leaveDoc?.employeeId?.email || "").trim().toLowerCase();
  if (!isValidEmail(employeeEmail)) {
    throw new Error("Nhân viên không có email hợp lệ để gửi thông báo nghỉ phép");
  }

  const employeeName = leaveDoc?.employeeId?.fullName || leaveDoc?.employeeId?.employeeCode || "Nhân viên";
  const leaveTypeLabel = formatLeaveTypeLabel(leaveDoc?.leaveType);
  const rangeText = `${formatDateVi(leaveDoc?.startDate)} - ${formatDateVi(leaveDoc?.endDate)}`;
  const isApproved = decision === "approved";
  const subject = isApproved
    ? "Đơn nghỉ phép của bạn đã được duyệt"
    : "Đơn nghỉ phép của bạn đã bị từ chối";
  const statusText = isApproved ? "ĐÃ DUYỆT" : "BỊ TỪ CHỐI";
  const rejectReason = !isApproved && leaveDoc?.rejectionReason
    ? `<p><strong>Lý do từ chối:</strong> ${leaveDoc.rejectionReason}</p>`
    : "";

  const mailResult = await mailer.sendMail({
    to: employeeEmail,
    subject,
    text: [
      `Xin chào ${employeeName},`,
      `Đơn nghỉ phép: ${leaveTypeLabel}`,
      `Thời gian: ${rangeText}`,
      `Kết quả xử lý: ${statusText}`,
      !isApproved && leaveDoc?.rejectionReason ? `Lý do từ chối: ${leaveDoc.rejectionReason}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    html: `
      <h3>Thông báo xử lý đơn nghỉ phép</h3>
      <p>Xin chào <strong>${employeeName}</strong>,</p>
      <p>Đơn nghỉ phép của bạn đã được xử lý.</p>
      <ul>
        <li><strong>Loại nghỉ:</strong> ${leaveTypeLabel}</li>
        <li><strong>Thời gian:</strong> ${rangeText}</li>
        <li><strong>Kết quả:</strong> ${statusText}</li>
      </ul>
      ${rejectReason}
    `,
  });

  if (mailResult?.skipped || (Array.isArray(mailResult?.rejected) && mailResult.rejected.length > 0)) {
    throw new Error("Email provider chưa sẵn sàng hoặc từ chối gửi email");
  }

  return mailResult;
}

async function logStaffEvent({
  staff,
  verb,
  ctx,
  status = "success",
  meta = {},
  diff = {},
}) {
  try {
    const actorUserId = ctx?.user?.id || ctx?.user?._id || null;

    const restaurantId =
      staff.primaryRestaurant ||
      (Array.isArray(staff.refRestaurants) && staff.refRestaurants.length > 0
        ? staff.refRestaurants[0]
        : null);

    await EventLog.create({
      restaurantId,
      actorUserId,
      verb,
      object: {
        kind: "User",
        id: staff._id,
        code: staff.employeeCode || staff.username || staff.email || null,
      },
      source: "staff-mutation",
      status,
      meta,
      diff,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Failed to create staff event log:", err.message);
  }
}

export const __testables = {
  formatEmployeeCode,
  getNextEmployeeCode,
};

export default {
  // =========================
  // CREATE STAFF
  // =========================
  createStaff: async (_, { input }, ctx) => {
    // Ép kiểu userType (HIỆN TẠI luôn là STAFF)
    const normalizedUserType = (input.userType || "STAFF")
      .toString()
      .toUpperCase();
    input.userType = normalizedUserType;

    // =========================
    // XÁC ĐỊNH ROLE CHO STAFF
    // =========================
    let roleDoc = null;

    // Nếu FE truyền roleId vào
    if (input.roleId) {
      roleDoc = await Role.findById(input.roleId).populate("parentRole");

      if (!roleDoc) {
        throw new Error("Role not found");
      }

      // Nếu userType là STAFF thì role phải thuộc nhóm 'staff'
      if (normalizedUserType === "STAFF") {
        const parentSlug =
          roleDoc.parentRole?.slug ||
          (roleDoc.parent ? roleDoc.parent.toString().toLowerCase() : null);

        if (parentSlug !== "staff" && roleDoc.slug !== "staff") {
          throw new Error(
            "Role không hợp lệ: nhân viên STAFF phải có role thuộc nhóm 'staff'"
          );
        }
      }
    } else {
      // Không truyền roleId -> dùng default staff role
      roleDoc =
        (await Role.findOne({ slug: "staff" }).populate("parentRole")) ||
        (await Role.findOne({ parent: "staff" }).populate("parentRole"));

      if (!roleDoc) {
        throw new Error(
          "Default staff role not found (slug='staff' or parent='staff')"
        );
      }
      // Với default này thì đương nhiên thuộc nhóm staff nên không cần check thêm
    }

    const roleId = roleDoc._id;

    const {
      password,
      primaryRestaurantId,
      refRestaurantIds,
      employeeCode: _ignoredEmployeeCode,
      ...rest
    } = input;

    const doc = {
      ...rest,
      role: roleId,
    };

    // Chuẩn hoá enum để khớp Mongoose
    // EmploymentType: FULL_TIME -> full_time
    if (doc.employmentType) {
      doc.employmentType = doc.employmentType.toString().toLowerCase();
    }

    // EmploymentStatus: ON_LEAVE -> on_leave
    if (doc.employmentStatus) {
      doc.employmentStatus = doc.employmentStatus.toString().toLowerCase();
    }

    // ShiftType: MORNING -> morning, FULL_DAY -> full_day
    if (doc.shiftType) {
      doc.shiftType = doc.shiftType.toString().toLowerCase();
    }

    // StaffWorkingDay: [MON, TUE] -> ["mon", "tue"]
    if (doc.workingDays && Array.isArray(doc.workingDays)) {
      doc.workingDays = doc.workingDays.map((d) =>
        d != null ? d.toString().toLowerCase() : d
      );
    }

    // DepartmentType đã là lowercase (service, kitchen, ...) -> không cần đổi

    // Gán nhà hàng
    const sequenceRestaurantId =
      primaryRestaurantId ||
      input.restaurantForStaff ||
      (Array.isArray(refRestaurantIds) ? refRestaurantIds[0] : null);
    if (!sequenceRestaurantId) {
      throw new Error("primaryRestaurantId is required to generate employee code");
    }

    doc.primaryRestaurant = sequenceRestaurantId;
    if (!doc.restaurantForStaff) {
      doc.restaurantForStaff = sequenceRestaurantId;
    }
    if (refRestaurantIds) doc.refRestaurants = refRestaurantIds;

    let staff = null;
    let lastCreateError = null;
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      const employeeCode = await getNextEmployeeCode(sequenceRestaurantId);
      const candidate = new Staff({
        ...doc,
        employeeCode,
      });

      // Nếu FE có truyền password → hash luôn
      // Nếu không → hook pre('save') trong User.js sẽ tự generate (nếu em có thêm logic đó)
      if (password && password.trim() !== "") {
        await candidate.setPassword(password.trim());
      }

      try {
        await candidate.save();
        staff = candidate;
        break;
      } catch (error) {
        lastCreateError = error;
        if (error?.code !== 11000 || attempt === MAX_RETRIES) {
          throw error;
        }
      }
    }

    if (!staff) {
      throw lastCreateError || new Error("Failed to create staff");
    }

    await staff.populate(["role", "refRestaurants", "primaryRestaurant"]);

    await logStaffEvent({
      staff,
      verb: "staff.create",
      ctx,
      meta: {
        roleId,
        userType: staff.userType,
        department: staff.department || null,
      },
    });

    return staff;
  },

  // =========================
  // UPDATE STAFF
  // =========================
  updateStaff: async (_, { userId, input }, ctx) => {
    const staff = await Staff.findById(userId);
    if (!staff || staff.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    if ("employeeCode" in input) {
      delete input.employeeCode;
    }

    const before = staff.toObject();

    // Map các field ID sang schema thực tế
    if (input.primaryRestaurantId) {
      input.primaryRestaurant = input.primaryRestaurantId;
      delete input.primaryRestaurantId;
    }

    if (input.refRestaurantIds) {
      input.refRestaurants = input.refRestaurantIds;
      delete input.refRestaurantIds;
    }

    // Chuẩn hoá enum giống như createStaff
    if (input.employmentType) {
      input.employmentType = input.employmentType.toString().toLowerCase();
    }

    if (input.employmentStatus) {
      input.employmentStatus = input.employmentStatus.toString().toLowerCase();
    }

    if (input.shiftType) {
      input.shiftType = input.shiftType.toString().toLowerCase();
    }

    if (input.workingDays && Array.isArray(input.workingDays)) {
      input.workingDays = input.workingDays.map((d) =>
        d != null ? d.toString().toLowerCase() : d
      );
    }

    // department từ GraphQL là DepartmentType (service, kitchen...) -> đã đúng format

    // Hỗ trợ đổi mật khẩu nếu có truyền trong input
    if (input.password && input.password.trim() !== "") {
      await staff.setPassword(input.password.trim());
      delete input.password;
    }

    Object.assign(staff, input);
    await staff.save();
    await staff.populate(["role", "refRestaurants", "primaryRestaurant"]);

    await logStaffEvent({
      staff,
      verb: "staff.update",
      ctx,
      diff: {
        before: {
          fullName: before.fullName,
          employeeCode: before.employeeCode,
          positionTitle: before.positionTitle,
          department: before.department,
          employmentType: before.employmentType,
          employmentStatus: before.employmentStatus,
          primaryRestaurant: before.primaryRestaurant,
        },
        after: {
          fullName: staff.fullName,
          employeeCode: staff.employeeCode,
          positionTitle: staff.positionTitle,
          department: staff.department,
          employmentType: staff.employmentType,
          employmentStatus: staff.employmentStatus,
          primaryRestaurant: staff.primaryRestaurant,
        },
      },
    });

    return staff;
  },

  // =========================
  // DELETE STAFF (SOFT DELETE)
  // =========================
  deleteStaff: async (_, { userId }, ctx) => {
    const staff = await Staff.findById(userId);

    if (!staff || staff.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    staff.status = "inactive";
    // Enum trong User.js: "working", "on_leave", "resigned", "suspended"
    staff.employmentStatus = "resigned";
    await staff.save();

    await logStaffEvent({
      staff,
      verb: "staff.delete",
      ctx,
      meta: { reason: "soft-delete" },
    });

    return true;
  },

  // =========================
  // SET STAFF EMPLOYMENT STATUS
  // =========================
  setStaffEmploymentStatus: async (_, { userId, employmentStatus }, ctx) => {
    const staff = await Staff.findById(userId);

    if (!staff || staff.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    const beforeStatus = staff.employmentStatus;

    // GraphQL: WORKING, ON_LEAVE, RESIGNED, SUSPENDED
    // Mongo: "working", "on_leave", "resigned", "suspended"
    const normalizedStatus = employmentStatus
      ? employmentStatus.toString().toLowerCase()
      : "";

    staff.employmentStatus = normalizedStatus;
    await staff.save();
    await staff.populate(["role", "refRestaurants", "primaryRestaurant"]);

    const verb =
      normalizedStatus === "on_leave"
        ? "staff.setOnLeave"
        : "staff.setEmploymentStatus";

    await logStaffEvent({
      staff,
      verb,
      ctx,
      diff: {
        before: { employmentStatus: beforeStatus },
        after: { employmentStatus: staff.employmentStatus },
      },
    });

    return staff;
  },

  // =========================
  // RATE STAFF (1–5 sao)
  // =========================
  rateStaff: async (_, { userId, rating }, ctx) => {
    const staff = await Staff.findById(userId);

    if (!staff || staff.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    const r = Math.max(1, Math.min(5, Number(rating) || 0));
    const prevRate = staff.rate || 0;
    const prevCount = staff.rateCount || 0;

    const newCount = prevCount + 1;
    const newRate = (prevRate * prevCount + r) / newCount;

    staff.rate = newRate;
    staff.rateCount = newCount;

    await staff.save();
    await staff.populate(["role", "refRestaurants", "primaryRestaurant"]);

    await logStaffEvent({
      staff,
      verb: "staff.rate",
      ctx,
      meta: { rating: r },
      diff: {
        before: { rate: prevRate, rateCount: prevCount },
        after: { rate: staff.rate, rateCount: staff.rateCount },
      },
    });

    return staff;
  },

  createStaffShift: async (_, { input }) => {
    const staff = await Staff.findById(input.employeeId).lean();
    if (!staff || staff.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    const created = await Shift.create({
      employeeId: input.employeeId,
      restaurantId: input.restaurantId,
      shiftType: input.shiftType.toString().toLowerCase(),
      startTime: new Date(input.startTime),
      endTime: new Date(input.endTime),
      status: input.status || "scheduled",
      notes: input.notes || "",
    });

    return {
      id: String(created._id),
      employeeId: String(created.employeeId),
      employeeName: staff.fullName || null,
      restaurantId: String(created.restaurantId),
      shiftType: created.shiftType,
      startTime: created.startTime,
      endTime: created.endTime,
      status: created.status,
      notes: created.notes || "",
    };
  },

  updateStaffShift: async (_, { shiftId, input }) => {
    const payload = { ...input };
    if (payload.shiftType) payload.shiftType = payload.shiftType.toString().toLowerCase();
    if (payload.startTime) payload.startTime = new Date(payload.startTime);
    if (payload.endTime) payload.endTime = new Date(payload.endTime);

    const updated = await Shift.findByIdAndUpdate(shiftId, payload, { new: true })
      .populate("employeeId", "fullName");
    if (!updated) throw new Error("Shift not found");

    return {
      id: String(updated._id),
      employeeId: String(updated.employeeId?._id || updated.employeeId),
      employeeName: updated.employeeId?.fullName || null,
      restaurantId: String(updated.restaurantId),
      shiftType: updated.shiftType,
      startTime: updated.startTime,
      endTime: updated.endTime,
      status: updated.status || "scheduled",
      notes: updated.notes || "",
    };
  },

  deleteStaffShift: async (_, { shiftId }) => {
    const deleted = await Shift.findByIdAndDelete(shiftId);
    return Boolean(deleted);
  },

  createPayrollPeriod: async (_, { input }, ctx) => {
    const actor = ctx?.user || {};
    const rid = payrollToObjectId(input.restaurantId || actor.restaurantForStaff || actor.primaryRestaurantId);
    if (!rid) throw new Error("Restaurant is required");
    const startDate = payrollToStartOfDay(input.startDate);
    const endDate = payrollToEndOfDay(input.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
      throw new Error("Invalid payroll period range");
    }

    const payrollSetting = await PayrollSetting.findOne({ restaurantId: rid });
    const currentPeriodId = payrollSetting?.currentPayrollPeriodId
      ? String(payrollSetting.currentPayrollPeriodId)
      : null;
    const currentPeriod = currentPeriodId
      ? await PayrollPeriod.findById(currentPeriodId)
      : null;

    const isSameCurrentRange =
      currentPeriod &&
      currentPeriod.startDate?.getTime?.() === startDate.getTime() &&
      currentPeriod.endDate?.getTime?.() === endDate.getTime();

    if (
      currentPeriod &&
      !isSameCurrentRange &&
      currentPeriod.status !== "paid"
    ) {
      throw new Error("Current payroll period must be fully paid before changing the applied payroll cycle");
    }

    let period = await PayrollPeriod.findOne({ restaurantId: rid, startDate, endDate });
    if (!period) {
      const settings = await getPayrollSettings(rid);
      period = await PayrollPeriod.create({
        restaurantId: rid,
        name: input.name || `Kỳ lương ${startDate.toISOString().slice(0, 10)} - ${endDate.toISOString().slice(0, 10)}`,
        startDate,
        endDate,
        status: "draft",
        settingsSnapshot: settings,
        statsSnapshot: { totalPayroll: 0, paidAmount: 0, remaining: 0, progress: 0 },
      });
    }

    const detail = await upsertPeriodItems(period);
    await PayrollPeriod.findByIdAndUpdate(period._id, { $set: { statsSnapshot: detail.stats } });
    await PayrollSetting.findOneAndUpdate(
      { restaurantId: rid },
      {
        $set: {
          currentPayrollPeriodId: period._id,
          updatedBy: payrollToObjectId(actor.id || actor._id),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return {
      id: String(period._id),
      restaurantId: String(period.restaurantId),
      name: period.name || "",
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
      finalizedAt: period.finalizedAt || null,
      lockedAt: period.lockedAt || null,
      paidAt: period.paidAt || null,
      stats: detail.stats,
    };
  },

  recalculatePayrollPeriod: async (_, { periodId }) => {
    const period = await PayrollPeriod.findById(periodId);
    if (!period) throw new Error("Payroll period not found");
    if (["locked", "paid"].includes(period.status)) {
      throw new Error("Payroll period is locked/paid and cannot be recalculated");
    }
    const { stats } = await upsertPeriodItems(period);
    period.statsSnapshot = stats;
    period.status = "draft";
    await period.save();
    return getPeriodDetail(periodId);
  },

  finalizePayrollPeriod: async (_, { periodId }) => {
    const period = await PayrollPeriod.findById(periodId);
    if (!period) throw new Error("Payroll period not found");
    if (["locked", "paid"].includes(period.status)) throw new Error("Locked/Paid period cannot be finalized again");
    const { stats } = await upsertPeriodItems(period);
    period.status = "finalized";
    period.finalizedAt = new Date();
    period.statsSnapshot = stats;
    await PayrollItem.updateMany({ periodId: period._id }, { $set: { status: "finalized" } });
    await period.save();
    return {
      id: String(period._id),
      restaurantId: String(period.restaurantId),
      name: period.name || "",
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
      finalizedAt: period.finalizedAt,
      lockedAt: period.lockedAt || null,
      paidAt: period.paidAt || null,
      stats,
    };
  },

  lockPayrollPeriod: async (_, { periodId }) => {
    const period = await PayrollPeriod.findById(periodId);
    if (!period) throw new Error("Payroll period not found");
    if (period.status === "paid") throw new Error("Paid period cannot be locked");
    if (period.status === "draft") throw new Error("Finalize payroll period before locking");
    period.status = "locked";
    period.lockedAt = new Date();
    await PayrollItem.updateMany({ periodId: period._id, status: { $ne: "paid" } }, { $set: { status: "locked" } });
    await period.save();
    return {
      id: String(period._id),
      restaurantId: String(period.restaurantId),
      name: period.name || "",
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
      finalizedAt: period.finalizedAt || null,
      lockedAt: period.lockedAt || null,
      paidAt: period.paidAt || null,
      stats: period.statsSnapshot || { totalPayroll: 0, paidAmount: 0, remaining: 0, progress: 0 },
    };
  },

  markPayrollPeriodPaid: async (_, { periodId, employeeIds = [] }) => {
    const period = await PayrollPeriod.findById(periodId);
    if (!period) throw new Error("Payroll period not found");
    if (!["locked", "paid"].includes(period.status)) {
      throw new Error("Only locked payroll period can be marked as paid");
    }

    const query = { periodId: period._id };
    if (Array.isArray(employeeIds) && employeeIds.length) {
      query.employeeId = { $in: employeeIds.map((id) => payrollToObjectId(id)).filter(Boolean) };
    }

    await PayrollItem.updateMany(query, { $set: { status: "paid", paidAt: new Date() } });
    const remain = await PayrollItem.countDocuments({ periodId: period._id, status: { $ne: "paid" } });
    if (remain === 0) {
      period.status = "paid";
      period.paidAt = new Date();
      await period.save();
    }
    const detail = await getPeriodDetail(periodId);
    await PayrollPeriod.findByIdAndUpdate(period._id, { $set: { statsSnapshot: detail.stats } });
    return detail.period;
  },

  updatePayrollSettings: async (_, { input }, ctx) => {
    const actor = ctx?.user || {};
    const rid = payrollToObjectId(input.restaurantId || actor.restaurantForStaff || actor.primaryRestaurantId);
    if (!rid) throw new Error("Restaurant is required");

    const update = {
      currentPayrollPeriodId: input.currentPayrollPeriodId
        ? payrollToObjectId(input.currentPayrollPeriodId)
        : input.currentPayrollPeriodId,
      standardWorkDaysPerMonth: input.standardWorkDaysPerMonth,
      standardHoursPerDay: input.standardHoursPerDay,
      overtimeMultiplierWeekday: input.overtimeMultiplierWeekday,
      overtimeMultiplierWeekend: input.overtimeMultiplierWeekend,
      overtimeMultiplierHoliday: input.overtimeMultiplierHoliday,
      latenessPenaltyPerMinute: input.latenessPenaltyPerMinute,
      earlyLeavePenaltyPerMinute: input.earlyLeavePenaltyPerMinute,
      unpaidLeaveDeductionPerDay: input.unpaidLeaveDeductionPerDay,
      defaultAllowance: input.defaultAllowance,
      allowPaidLeaveInWorkDays: input.allowPaidLeaveInWorkDays,
      defaultBonus: input.defaultBonus,
      defaultDeduction: input.defaultDeduction,
      notes: input.notes,
      updatedBy: payrollToObjectId(actor.id || actor._id),
    };
    Object.keys(update).forEach((key) => update[key] === undefined && delete update[key]);

    const doc = await PayrollSetting.findOneAndUpdate(
      { restaurantId: rid },
      { $set: update },
      { upsert: true, new: true },
    );

    return {
      ...doc.toObject(),
      restaurantId: String(doc.restaurantId),
    };
  },

  upsertPayrollAdjustment: async (_, { input }, ctx) => {
    const period = await PayrollPeriod.findById(input.periodId);
    if (!period) throw new Error("Payroll period not found");
    if (["locked", "paid"].includes(period.status)) throw new Error("Cannot adjust locked/paid payroll period");

    await PayrollAdjustment.create({
      periodId: period._id,
      employeeId: payrollToObjectId(input.employeeId),
      type: String(input.type || "other").toLowerCase(),
      amount: Number(input.amount || 0),
      note: input.note || "",
      createdBy: payrollToObjectId(ctx?.user?.id || ctx?.user?._id),
    });

    await upsertPeriodItems(period);
    const detail = await getPeriodDetail(input.periodId);
    return detail.items.find((item) => String(item.id) === String(input.employeeId)) || null;
  },

  deletePayrollAdjustment: async (_, { periodId, employeeId, adjustmentId }) => {
    const period = await PayrollPeriod.findById(periodId);
    if (!period) throw new Error("Payroll period not found");
    if (["locked", "paid"].includes(period.status)) throw new Error("Cannot adjust locked/paid payroll period");

    await PayrollAdjustment.deleteOne({
      _id: payrollToObjectId(adjustmentId),
      periodId: period._id,
      employeeId: payrollToObjectId(employeeId),
    });

    await upsertPeriodItems(period);
    const detail = await getPeriodDetail(periodId);
    return detail.items.find((item) => String(item.id) === String(employeeId)) || null;
  },

  upsertStaffAttendance: async (_, { input }) => {
    const employeeId = toObjectId(input.employeeId);
    const restaurantId = toObjectId(input.restaurantId);
    if (!employeeId || !restaurantId) throw new Error("Invalid employeeId or restaurantId");

    const action = String(input.action || "").toLowerCase();
    if (!["check_in", "check_out", "in", "out"].includes(action)) {
      throw new Error("Invalid attendance action");
    }
    const normalizedAction = ["check_in", "in"].includes(action) ? "check_in" : "check_out";
    const eventTime = input.timestamp ? new Date(input.timestamp) : new Date();
    const workDate = input.workDate ? toStartOfDay(input.workDate) : toStartOfDay(eventTime);
    const note = input.note?.trim() || "";
    const source = ["manual", "system", "quick"].includes(String(input.source || "").toLowerCase())
      ? String(input.source).toLowerCase()
      : "quick";

    const staff = await Staff.findById(employeeId).populate("role");
    if (!staff || staff.userType !== "STAFF") throw new Error("Staff not found");

    const assignedShift = await Shift.findOne({
      employeeId,
      restaurantId,
      startTime: { $lte: toEndOfDay(workDate) },
      endTime: { $gte: toStartOfDay(workDate) },
      status: { $in: ["scheduled", "pending", "completed"] },
    })
      .sort({ startTime: 1 })
      .lean();

    const query = assignedShift
      ? { employeeId, workDate, shiftId: assignedShift._id }
      : { employeeId, workDate, isOffSchedule: true };

    const defaults = {
      employeeId,
      restaurantId,
      workDate,
      shiftId: assignedShift?._id || null,
      plannedStartTime: assignedShift?.startTime || null,
      plannedEndTime: assignedShift?.endTime || null,
      source,
      isOffSchedule: !assignedShift,
      note,
      approved: false,
    };

    const record = (await Timesheet.findOne(query)) || new Timesheet(defaults);
    record.employeeId = employeeId;
    record.restaurantId = restaurantId;
    record.workDate = workDate;
    record.shiftId = assignedShift?._id || null;
    record.plannedStartTime = assignedShift?.startTime || null;
    record.plannedEndTime = assignedShift?.endTime || null;
    record.isOffSchedule = !assignedShift;
    record.source = source;
    if (note) record.note = note;

    if (normalizedAction === "check_in") {
      if (record.actualCheckInAt) throw new Error("Nhân viên đã check-in trong ngày làm việc này");
      record.actualCheckInAt = eventTime;
    } else {
      if (!record.actualCheckInAt) throw new Error("Nhân viên chưa check-in");
      if (record.actualCheckOutAt) throw new Error("Nhân viên đã check-out");
      if (eventTime < record.actualCheckInAt) throw new Error("Thời gian check-out không hợp lệ");
      record.actualCheckOutAt = eventTime;
    }

    const checkInAt = record.actualCheckInAt;
    const checkOutAt = record.actualCheckOutAt;
    const plannedStart = record.plannedStartTime;
    const plannedEnd = record.plannedEndTime;

    record.latenessMinutes = plannedStart && checkInAt ? toMinutes(new Date(checkInAt) - new Date(plannedStart)) : 0;
    record.earlyLeaveMinutes = plannedEnd && checkOutAt ? toMinutes(new Date(plannedEnd) - new Date(checkOutAt)) : 0;
    record.workedMinutes = checkInAt && checkOutAt ? toMinutes(new Date(checkOutAt) - new Date(checkInAt)) : 0;
    record.overtimeMinutes = plannedEnd && checkOutAt ? toMinutes(new Date(checkOutAt) - new Date(plannedEnd)) : 0;
    record.hours = Number((record.workedMinutes / 60).toFixed(2));

    await record.save();
    const populated = await Timesheet.findById(record._id).populate("shiftId").lean();
    return mapAttendanceOutput(populated, staff);
  },

  createLeaveRequest: async (_, { input }, ctx) => {
    const employeeId = toObjectId(input.employeeId);
    const restaurantId = toObjectId(input.restaurantId);
    if (!employeeId || !restaurantId) throw new Error("Invalid employeeId or restaurantId");

    const employee = await Staff.findById(employeeId)
      .populate("role")
      .select({ _id: 1, fullName: 1, employeeCode: 1, positionTitle: 1, roleName: 1, avatarUrl: 1, avatar: 1, department: 1 })
      .lean();
    if (!employee || employee.userType !== "STAFF") throw new Error("Staff not found");

    const leaveType = fromGraphLeaveType(input.leaveType);
    const startSession = fromGraphSession(input.startSession);
    const endSession = fromGraphSession(input.endSession);
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    const requestedDays = calcLeaveDays(startDate, endDate, startSession, endSession, leaveType);
    if (requestedDays <= 0) throw new Error("Invalid leave date range");
    const requestedHours = Number((requestedDays * 8).toFixed(2));

    const isManager =
      String(employee.department || "").toLowerCase() === "management" ||
      String(employee.positionTitle || "").toLowerCase().includes("manager") ||
      String(employee.roleName || "").toLowerCase().includes("manager") ||
      String(employee.role?.slug || "").toLowerCase().includes("manager");

    let replacementManagerId = toObjectId(input.replacementManagerId);
    let replacementStatus = "not_required";
    let status = "pending";

    if (isManager) {
      if (!replacementManagerId) {
        throw new Error("Manager leave requires replacement manager");
      }
      if (String(replacementManagerId) === String(employeeId)) {
        throw new Error("Replacement manager cannot be requester");
      }
      const replacementManager = await Staff.findById(replacementManagerId)
        .select({ _id: 1, department: 1, positionTitle: 1, roleName: 1 })
        .lean();
      if (!replacementManager) throw new Error("Replacement manager not found");
      replacementStatus = "pending";
      status = "pending_replacement_confirmation";
    }

    const { payrollFlags, quotaImpact } = computeLeaveFlags(leaveType, requestedDays);
    const actorId = toObjectId(ctx?.user?.id || ctx?.user?._id || null);

    const created = await LeaveRequest.create({
      employeeId,
      restaurantId,
      leaveType,
      startDate: toStartOfDay(startDate),
      endDate: toStartOfDay(endDate),
      startSession,
      endSession,
      requestedDays,
      requestedHours,
      reason: String(input.reason || "").trim(),
      status,
      replacementManagerId: replacementManagerId || null,
      replacementStatus,
      payrollFlags,
      quotaImpact,
      auditLogs: [
        {
          action: "created",
          actorId: actorId || employeeId,
          actorName: null,
          note: "Leave request created",
          at: new Date(),
        },
      ],
    });

    const populated = await LeaveRequest.findById(created._id)
      .populate("employeeId", "fullName employeeCode positionTitle roleName avatarUrl avatar")
      .populate("replacementManagerId", "fullName")
      .lean();
    return mapLeaveOutput(populated);
  },

  approveLeaveRequest: async (_, { requestId, approverId, note }, ctx) => {
    const request = await LeaveRequest.findById(requestId)
      .populate("employeeId", "fullName employeeCode positionTitle roleName avatarUrl avatar email")
      .populate("replacementManagerId", "fullName")
      .populate("approverId", "fullName");
    if (!request) throw new Error("Leave request not found");
    if (request.status === "rejected") return mapLeaveOutput(request.toObject());
    if (request.status === "approved") return mapLeaveOutput(request.toObject());
    if (request.replacementStatus === "pending") {
      throw new Error("Replacement manager must confirm before approval");
    }

    request.status = "approved";
    request.approvedAt = new Date();
    request.rejectedAt = null;
    request.rejectionReason = "";
    request.approverId = toObjectId(approverId || ctx?.user?.id || ctx?.user?._id || null);
    request.auditLogs.push({
      action: "approved",
      actorId: request.approverId,
      actorName: null,
      note: note || "Approved",
      at: new Date(),
    });
    await request.save();

    await applyLeaveBalanceImpact({
      employeeId: request.employeeId?._id || request.employeeId,
      year: new Date(request.startDate).getFullYear(),
      quotaImpact: request.quotaImpact,
    });

    const populated = await LeaveRequest.findById(request._id)
      .populate("employeeId", "fullName employeeCode positionTitle roleName avatarUrl avatar email")
      .populate("replacementManagerId", "fullName")
      .populate("approverId", "fullName")
      .lean();

    try {
      await sendLeaveDecisionMail({ leaveDoc: populated, decision: "approved" });
      await LeaveRequest.findByIdAndUpdate(request._id, {
        $push: {
          auditLogs: {
            action: "mail_sent",
            actorId: request.approverId || null,
            actorName: null,
            note: "Sent approval email to employee",
            at: new Date(),
          },
        },
      });
    } catch (mailErr) {
      await LeaveRequest.findByIdAndUpdate(request._id, {
        $push: {
          auditLogs: {
            action: "mail_failed",
            actorId: request.approverId || null,
            actorName: null,
            note: `Approval email failed: ${mailErr.message}`,
            at: new Date(),
          },
        },
      });
      throw new Error(
        `Trạng thái đơn nghỉ đã được duyệt trong DB nhưng gửi email thất bại: ${mailErr.message}`
      );
    }
    return mapLeaveOutput(populated);
  },

  rejectLeaveRequest: async (_, { requestId, approverId, reason }, ctx) => {
    const request = await LeaveRequest.findById(requestId)
      .populate("employeeId", "fullName employeeCode positionTitle roleName avatarUrl avatar email")
      .populate("replacementManagerId", "fullName")
      .populate("approverId", "fullName");
    if (!request) throw new Error("Leave request not found");

    request.status = "rejected";
    request.rejectedAt = new Date();
    request.approvedAt = null;
    request.rejectionReason = String(reason || "").trim();
    request.approverId = toObjectId(approverId || ctx?.user?.id || ctx?.user?._id || null);
    request.auditLogs.push({
      action: "rejected",
      actorId: request.approverId,
      actorName: null,
      note: reason || "Rejected",
      at: new Date(),
    });
    await request.save();

    const populated = await LeaveRequest.findById(request._id)
      .populate("employeeId", "fullName employeeCode positionTitle roleName avatarUrl avatar email")
      .populate("replacementManagerId", "fullName")
      .populate("approverId", "fullName")
      .lean();

    try {
      await sendLeaveDecisionMail({ leaveDoc: populated, decision: "rejected" });
      await LeaveRequest.findByIdAndUpdate(request._id, {
        $push: {
          auditLogs: {
            action: "mail_sent",
            actorId: request.approverId || null,
            actorName: null,
            note: "Sent rejection email to employee",
            at: new Date(),
          },
        },
      });
    } catch (mailErr) {
      await LeaveRequest.findByIdAndUpdate(request._id, {
        $push: {
          auditLogs: {
            action: "mail_failed",
            actorId: request.approverId || null,
            actorName: null,
            note: `Rejection email failed: ${mailErr.message}`,
            at: new Date(),
          },
        },
      });
      throw new Error(
        `Trạng thái đơn nghỉ đã được từ chối trong DB nhưng gửi email thất bại: ${mailErr.message}`
      );
    }
    return mapLeaveOutput(populated);
  },

  confirmReplacementLeaveRequest: async (_, { requestId, managerId, note }, ctx) => {
    const actorId = toObjectId(managerId || ctx?.user?.id || ctx?.user?._id || null);
    const request = await LeaveRequest.findById(requestId)
      .populate("employeeId", "fullName employeeCode positionTitle roleName avatarUrl avatar")
      .populate("replacementManagerId", "fullName")
      .lean();
    if (!request) throw new Error("Leave request not found");
    if (!actorId) throw new Error("Replacement manager is required");
    if (!request.replacementManagerId) throw new Error("Leave request does not require replacement");
    if (String(request.replacementManagerId._id || request.replacementManagerId) !== String(actorId)) {
      throw new Error("Only assigned replacement manager can confirm");
    }

    const updated = await LeaveRequest.findByIdAndUpdate(
      requestId,
      {
        $set: {
          replacementStatus: "confirmed",
          replacementConfirmedAt: new Date(),
          replacementConfirmedBy: actorId,
          status: "pending",
        },
        $push: {
          auditLogs: {
            action: "replacement_confirmed",
            actorId,
            actorName: null,
            note: note || "Replacement manager confirmed",
            at: new Date(),
          },
        },
      },
      { new: true }
    )
      .populate("employeeId", "fullName employeeCode positionTitle roleName avatarUrl avatar")
      .populate("replacementManagerId", "fullName")
      .lean();

    return mapLeaveOutput(updated);
  },
};
