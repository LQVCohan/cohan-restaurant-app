import mongoose from "mongoose";
import {
  Staff,
  Shift,
  Timesheet,
  LeaveRequest,
  PayrollPeriod,
  PayrollItem,
  PayrollAdjustment,
  OvertimeRequest,
} from "../../../models/index.js";
import {
  getPayrollSettings,
  toStartOfDay,
  toEndOfDay,
} from "./payrollRuntime.service.js";
import { AttendanceCorrectionRequest } from "../../../models/index.js";
import { getStaffMembershipRestaurantFilter } from "../auth/restaurantScope.service.js";
const VALID_ADJUSTMENT_TYPES = new Set([
  "allowance",
  "bonus",
  "deduction",
  "advance",
  "other_addition",
  "other_deduction",
]);

function oid(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function pushIssue(issues, payload) {
  issues.push({ severity: "warning", ...payload });
}

export function groupPayrollIssuesBySeverity(issues = []) {
  return {
    error: issues.filter((i) => i.severity === "error"),
    warning: issues.filter((i) => i.severity === "warning"),
  };
}

export function hasBlockingPayrollIssues(issues = []) {
  return issues.some((i) => i.severity === "error");
}

export async function validatePayrollPeriod(periodId, options = {}) {
  const period = await PayrollPeriod.findById(periodId).lean();
  if (!period) throw new Error("Không tìm thấy kỳ lương.");
  const issues = [];
  const pendingOvertimeRequests = await OvertimeRequest.find({
    restaurantId: period.restaurantId,
    workDate: {
      $gte: period.startDate,
      $lte: period.endDate,
    },
    status: {
      $in: ["pending_employee_confirmation", "pending_approval", "approved"],
    },
  })
    .populate("employeeId", "fullName employeeCode")
    .lean();

  pendingOvertimeRequests.forEach((request) => {
    issues.push({
      code: "OVERTIME_REQUEST_NOT_COMPLETED",
      severity: "error",
      message: "Còn yêu cầu tăng ca chưa hoàn tất trong kỳ lương.",
      employeeId: request.employeeId?._id
        ? String(request.employeeId._id)
        : request.employeeId
          ? String(request.employeeId)
          : null,
      employeeName: request.employeeId?.fullName || null,
      employeeCode: request.employeeId?.employeeCode || null,
      sourceType: "overtime_request",
      sourceId: String(request._id),
      suggestedAction:
        "Xác nhận, duyệt, từ chối hoặc hoàn tất yêu cầu tăng ca trước khi chốt kỳ lương.",
    });
  });

  const unapprovedOvertimeTimesheets = await Timesheet.find({
    restaurantId: period.restaurantId,
    workDate: {
      $gte: period.startDate,
      $lte: period.endDate,
    },
    overtimeMinutes: { $gt: 0 },
    $or: [
      { approvedOvertimeMinutes: { $exists: false } },
      { approvedOvertimeMinutes: { $lte: 0 } },
      { overtimeApprovalStatus: { $ne: "approved" } },
    ],
  })
    .populate("employeeId", "fullName employeeCode")
    .lean();

  unapprovedOvertimeTimesheets.forEach((timesheet) => {
    issues.push({
      code: "UNAPPROVED_OVERTIME",
      severity: "error",
      message: "Có giờ tăng ca thực tế nhưng chưa được duyệt để tính lương.",
      employeeId: timesheet.employeeId?._id
        ? String(timesheet.employeeId._id)
        : timesheet.employeeId
          ? String(timesheet.employeeId)
          : null,
      employeeName: timesheet.employeeId?.fullName || null,
      employeeCode: timesheet.employeeId?.employeeCode || null,
      sourceType: "timesheet",
      sourceId: String(timesheet._id),
      suggestedAction:
        "Tạo hoặc hoàn tất yêu cầu tăng ca, hoặc xác nhận không tính lương tăng ca cho bản ghi này.",
    });
  });
  const pendingOffScheduleTimesheets = await Timesheet.find({
    restaurantId: period.restaurantId,
    workDate: {
      $gte: period.startDate,
      $lte: period.endDate,
    },
    isOffSchedule: true,
    approved: { $ne: true },
    $and: [
      {
        $or: [
          { offScheduleApprovalStatus: { $exists: false } },
          { offScheduleApprovalStatus: "not_required" },
          { offScheduleApprovalStatus: "pending" },
        ],
      },
      {
        $or: [
          { workedMinutes: { $gt: 0 } },
          { hours: { $gt: 0 } },
          { amount: { $gt: 0 } },
          { actualCheckInAt: { $exists: true } },
          { actualCheckOutAt: { $exists: true } },
        ],
      },
    ],
  })
    .populate("employeeId", "fullName employeeCode")
    .lean();

  pendingOffScheduleTimesheets.forEach((timesheet) => {
    issues.push({
      code: "OFF_SCHEDULE_ATTENDANCE_PENDING_APPROVAL",
      severity: "error",
      message: "Có công ngoài lịch chưa được duyệt.",
      employeeId: timesheet.employeeId?._id
        ? String(timesheet.employeeId._id)
        : timesheet.employeeId
          ? String(timesheet.employeeId)
          : null,
      employeeName: timesheet.employeeId?.fullName || null,
      employeeCode: timesheet.employeeId?.employeeCode || null,
      sourceType: "timesheet",
      sourceId: String(timesheet._id),
      suggestedAction: "Duyệt hoặc từ chối công ngoài lịch trước khi chốt kỳ.",
    });
  });
  const pendingAttendanceCorrections = await AttendanceCorrectionRequest.find({
    restaurantId: period.restaurantId,
    status: "pending",
    workDate: {
      $gte: period.startDate,
      $lte: period.endDate,
    },
  })
    .populate("employeeId", "fullName employeeCode")
    .lean();

  pendingAttendanceCorrections.forEach((request) => {
    issues.push({
      code: "ATTENDANCE_CORRECTION_PENDING",
      severity: "error",
      message: "Còn yêu cầu chỉnh công chưa xử lý trong kỳ lương.",
      employeeId: request.employeeId?._id
        ? String(request.employeeId._id)
        : request.employeeId
          ? String(request.employeeId)
          : null,
      employeeName: request.employeeId?.fullName || null,
      employeeCode: request.employeeId?.employeeCode || null,
      sourceType: "attendance_correction",
      sourceId: String(request._id),
      suggestedAction:
        "Duyệt, từ chối hoặc hủy yêu cầu chỉnh công trước khi chốt kỳ lương.",
    });
  });
  const settings = await getPayrollSettings(period.restaurantId);
  const start = toStartOfDay(period.startDate, settings?.timezone);
  const end = toEndOfDay(period.endDate, settings?.timezone);
  const restaurantId = oid(period.restaurantId);
  const strictMinimumWage = Boolean(options.strictMinimumWage);
  const staffScopeFilter = await getStaffMembershipRestaurantFilter(restaurantId, {
    roles: ["staff", "manager"],
  });

  const [items, staffs, shifts, timesheets, leaves, adjustments] =
    await Promise.all([
      PayrollItem.find({ periodId: period._id }).lean(),
      Staff.find({
        userType: { $in: ["STAFF", "MANAGER"] },
        ...staffScopeFilter,
      })
        .select({
          _id: 1,
          fullName: 1,
          employeeCode: 1,
          baseSalary: 1,
          salaryType: 1,
          hourlyRate: 1,
          commissionRate: 1,
          employmentStatus: 1,
          department: 1,
          positionTitle: 1,
        })
        .lean(),
      Shift.find({
        restaurantId,
        startTime: { $lte: end },
        endTime: { $gte: start },
      }).lean(),
      Timesheet.find({
        restaurantId,
        workDate: { $gte: start, $lte: end },
      }).lean(),
      LeaveRequest.find({
        restaurantId,
        startDate: { $lte: end },
        endDate: { $gte: start },
      }).lean(),
      PayrollAdjustment.find({ periodId: period._id }).lean(),
    ]);

  if (!items.length) {
    pushIssue(issues, {
      code: "PAYROLL_PERIOD_EMPTY",
      severity: "error",
      message: "Kỳ lương chưa có dữ liệu bảng lương nhân viên.",
      sourceType: "PayrollPeriod",
      sourceId: String(period._id),
      suggestedAction: "Tính lại kỳ lương trước khi chốt.",
    });
  }

  if (
    !Number(settings?.standardWorkDaysPerMonth || 0) ||
    !Number(settings?.standardHoursPerDay || 0)
  ) {
    pushIssue(issues, {
      code: "PAYROLL_SETTINGS_INCOMPLETE",
      severity: "error",
      message: "Thiếu cấu hình ngày công chuẩn hoặc giờ công chuẩn.",
      sourceType: "PayrollSetting",
      suggestedAction: "Cập nhật cấu hình payroll trước khi chốt kỳ.",
    });
  }

  const shiftByStaff = new Map();
  shifts.forEach((s) => {
    const sid = String(s.employeeId);
    shiftByStaff.set(sid, (shiftByStaff.get(sid) || 0) + 1);
  });
  const timesheetByStaff = new Map();
  timesheets.forEach((t) => {
    const sid = String(t.employeeId);
    timesheetByStaff.set(sid, (timesheetByStaff.get(sid) || 0) + 1);
  });
  const timesheetByShift = new Set(
    timesheets.filter((t) => t.shiftId).map((t) => String(t.shiftId)),
  );

  staffs.forEach((staff) => {
    const sid = String(staff._id);
    const working =
      String(staff.employmentStatus || "").toLowerCase() === "working";
    if (!working) return;

    const salaryType = String(staff.salaryType || "monthly").toLowerCase();
    const hasBaseSalary = Number(staff.baseSalary || 0) > 0;
    const hasHourlyRate = Number(staff.hourlyRate || 0) > 0;
    const hasCommissionRate = Number(staff.commissionRate || 0) > 0;
    const salaryConfigured =
      salaryType === "monthly"
        ? hasBaseSalary
        : salaryType === "hourly"
          ? hasHourlyRate
          : salaryType === "shift"
            ? hasHourlyRate || hasBaseSalary
            : salaryType === "commission"
              ? hasCommissionRate
              : hasBaseSalary;
    if (!salaryConfigured) {
      pushIssue(issues, {
        code: salaryType === "commission"
          ? "STAFF_MISSING_COMMISSION_RATE"
          : salaryType === "hourly"
            ? "STAFF_MISSING_HOURLY_RATE"
            : "STAFF_MISSING_BASE_SALARY",
        severity: "error",
        message:
          salaryType === "commission"
            ? "Nhân viên hưởng hoa hồng nhưng chưa có tỷ lệ hoa hồng."
            : salaryType === "hourly"
              ? "Nhân viên tính lương theo giờ nhưng chưa có đơn giá giờ."
              : salaryType === "shift"
                ? "Nhân viên tính lương theo ca chưa có đơn giá ca hoặc lương cơ bản dự phòng."
                : "Nhân viên đang làm việc nhưng chưa có lương cơ bản hợp lệ.",
        employeeId: sid,
        employeeName: staff.fullName,
        employeeCode: staff.employeeCode,
        sourceType: "Staff",
        sourceId: sid,
        suggestedAction: "Cập nhật đúng cấu hình lương trước khi chốt kỳ.",
      });
    }

    if (!staff.department) {
      pushIssue(issues, {
        code: "STAFF_MISSING_DEPARTMENT",
        severity: "warning",
        message: "Nhân viên chưa có bộ phận.",
        employeeId: sid,
        employeeName: staff.fullName,
        employeeCode: staff.employeeCode,
        sourceType: "Staff",
        sourceId: sid,
        suggestedAction: "Cập nhật bộ phận để chuẩn hóa báo cáo.",
      });
    }

    if (!staff.positionTitle) {
      pushIssue(issues, {
        code: "STAFF_MISSING_POSITION_TITLE",
        severity: "warning",
        message: "Nhân viên chưa có chức danh.",
        employeeId: sid,
        employeeName: staff.fullName,
        employeeCode: staff.employeeCode,
        sourceType: "Staff",
        sourceId: sid,
        suggestedAction: "Bổ sung chức danh cho nhân viên.",
      });
    }

    const hasTimesheet = Number(timesheetByStaff.get(sid) || 0) > 0;
    const hasShift = Number(shiftByStaff.get(sid) || 0) > 0;
    if (!hasTimesheet) {
      pushIssue(issues, {
        code: "STAFF_WITHOUT_TIMESHEET",
        severity: hasShift ? "error" : "warning",
        message: "Nhân viên không có chấm công trong kỳ.",
        employeeId: sid,
        employeeName: staff.fullName,
        employeeCode: staff.employeeCode,
        sourceType: "Timesheet",
        suggestedAction: "Bổ sung/chỉnh công cho nhân viên trước khi chốt kỳ.",
      });
    }
  });

  shifts.forEach((shift) => {
    if (!timesheetByShift.has(String(shift._id))) {
      pushIssue(issues, {
        code: "SHIFT_WITHOUT_TIMESHEET",
        severity: "error",
        message: "Có ca làm nhưng chưa có chấm công tương ứng.",
        employeeId: String(shift.employeeId),
        sourceType: "Shift",
        sourceId: String(shift._id),
        suggestedAction: "Tạo bản ghi chấm công cho ca này trước khi chốt kỳ.",
      });
    }
  });

  timesheets.forEach((ts) => {
    const sid = String(ts.employeeId);
    if (ts.actualCheckInAt && !ts.actualCheckOutAt) {
      pushIssue(issues, {
        code: "TIMESHEET_OPEN_CHECKIN",
        severity: "error",
        message: "Có bản ghi check-in chưa check-out.",
        employeeId: sid,
        sourceType: "Timesheet",
        sourceId: String(ts._id),
        suggestedAction: "Hoàn tất check-out hoặc chỉnh công cho bản ghi này.",
      });
    }
    if (String(ts.source || "") === "manual" && ts.approved !== true) {
      pushIssue(issues, {
        code: "TIMESHEET_MANUAL_NOT_APPROVED",
        severity: "error",
        message: "Bản ghi chấm công thủ công chưa được duyệt.",
        employeeId: sid,
        sourceType: "Timesheet",
        sourceId: String(ts._id),
        suggestedAction: "Duyệt bản ghi chấm công thủ công trước khi chốt kỳ.",
      });
    }
    const invalidHours =
      Number(ts.workedMinutes || 0) < 0 ||
      Number(ts.hours || 0) < 0 ||
      (ts.actualCheckInAt &&
        ts.actualCheckOutAt &&
        new Date(ts.actualCheckOutAt) < new Date(ts.actualCheckInAt));
    if (invalidHours) {
      pushIssue(issues, {
        code: "TIMESHEET_NEGATIVE_OR_INVALID_HOURS",
        severity: "error",
        message: "Bản ghi chấm công có số giờ không hợp lệ.",
        employeeId: sid,
        sourceType: "Timesheet",
        sourceId: String(ts._id),
        suggestedAction: "Kiểm tra lại giờ vào/ra và tổng giờ làm.",
      });
    }
  });

  leaves.forEach((leave) => {
    const status = String(leave.status || "").toLowerCase();
    if (["pending", "pending_replacement_confirmation"].includes(status)) {
      pushIssue(issues, {
        code: "LEAVE_PENDING_IN_PERIOD",
        severity: "error",
        message: "Còn đơn nghỉ phép chờ duyệt trong kỳ.",
        employeeId: String(leave.employeeId),
        sourceType: "LeaveRequest",
        sourceId: String(leave._id),
        suggestedAction:
          "Duyệt hoặc từ chối đơn nghỉ phép trước khi chốt lương.",
      });
    }
    if (status === "approved" && !leave.payrollFlags) {
      pushIssue(issues, {
        code: "LEAVE_APPROVED_MISSING_PAYROLL_FLAGS",
        severity: "error",
        message: "Đơn nghỉ phép đã duyệt nhưng thiếu payrollFlags.",
        employeeId: String(leave.employeeId),
        sourceType: "LeaveRequest",
        sourceId: String(leave._id),
        suggestedAction: "Cập nhật payrollFlags cho đơn nghỉ phép đã duyệt.",
      });
    }
  });

  adjustments.forEach((adj) => {
    const amount = Number(adj.amount || 0);
    if (!(amount > 0)) {
      pushIssue(issues, {
        code: "PAYROLL_ADJUSTMENT_INVALID_AMOUNT",
        severity: "error",
        message: "Điều chỉnh lương có số tiền không hợp lệ.",
        employeeId: String(adj.employeeId),
        sourceType: "PayrollAdjustment",
        sourceId: String(adj._id),
        suggestedAction:
          "Kiểm tra lại phụ cấp/khấu trừ có số tiền không hợp lệ.",
      });
    }
    if (!VALID_ADJUSTMENT_TYPES.has(String(adj.type || ""))) {
      pushIssue(issues, {
        code: "PAYROLL_ADJUSTMENT_INVALID_TYPE",
        severity: "error",
        message: "Điều chỉnh lương có loại không hợp lệ.",
        employeeId: String(adj.employeeId),
        sourceType: "PayrollAdjustment",
        sourceId: String(adj._id),
        suggestedAction:
          "Chuyển loại điều chỉnh về danh mục hợp lệ trước khi chốt.",
      });
    }
  });

  const staffRestaurantMap = new Map(
    staffs.map((s) => [String(s._id), String(period.restaurantId)]),
  );
  items.forEach((item) => {
    const salaryConfigurationIssue = item?.breakdown?.salaryConfigurationIssue;
    if (salaryConfigurationIssue) {
      pushIssue(issues, {
        code: salaryConfigurationIssue,
        severity: "error",
        message: "Phiếu lương chưa có đủ cấu hình để tính đúng loại lương.",
        employeeId: String(item.employeeId),
        sourceType: "PayrollItem",
        sourceId: String(item._id),
        suggestedAction: "Bổ sung đơn giá/tỷ lệ lương rồi tính lại kỳ lương.",
      });
    }
    const netSalary = Number(item?.breakdown?.netSalary || 0);
    if (netSalary < 0) {
      pushIssue(issues, {
        code: "PAYROLL_ITEM_NEGATIVE_NET_SALARY",
        severity: "error",
        message: "Phiếu lương có thực lĩnh âm.",
        employeeId: String(item.employeeId),
        sourceType: "PayrollItem",
        sourceId: String(item._id),
        suggestedAction: "Rà soát khấu trừ và điều chỉnh trước khi chốt kỳ.",
      });
    }
    if (item?.breakdown?.minimumWageViolation) {
      pushIssue(issues, {
        code: "PAYROLL_ITEM_MINIMUM_WAGE_VIOLATION",
        severity: strictMinimumWage ? "error" : "warning",
        message: "Lương cơ bản thấp hơn mức lương tối thiểu vùng.",
        employeeId: String(item.employeeId),
        sourceType: "PayrollItem",
        sourceId: String(item._id),
        suggestedAction: "Rà soát mức lương cơ bản và chính sách áp dụng.",
      });
    }

    const employeeId = String(item.employeeId);
    const employeeRestaurant = staffRestaurantMap.get(employeeId);
    if (!employeeRestaurant) {
      pushIssue(issues, {
        code: "STAFF_NOT_IN_RESTAURANT",
        severity: "error",
        message: "Phiếu lương có nhân viên không thuộc nhà hàng của kỳ lương.",
        employeeId,
        sourceType: "PayrollItem",
        sourceId: String(item._id),
        suggestedAction: "Kiểm tra lại BrandMembership và tính lại kỳ lương.",
      });
    } else if (
      String(employeeRestaurant) !== String(period.restaurantId)
    ) {
      pushIssue(issues, {
        code: "PAYROLL_ITEM_WRONG_RESTAURANT",
        severity: "error",
        message: "Nhân viên không thuộc nhà hàng của kỳ lương.",
        employeeId: String(item.employeeId),
        sourceType: "PayrollItem",
        sourceId: String(item._id),
        suggestedAction:
          "Kiểm tra phân quyền nhà hàng hoặc nhân viên trước khi chốt.",
      });
    }
  });

  const grouped = groupPayrollIssuesBySeverity(issues);
  return {
    periodId: String(period._id),
    status: String(period.status || "draft"),
    errorCount: grouped.error.length,
    warningCount: grouped.warning.length,
    issues,
  };
}
