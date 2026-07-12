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
  AttendanceCorrectionRequest,
} from "../../../models/index.js";
import {
  getPayrollSettings,
  toStartOfDay,
  toEndOfDay,
} from "./payrollRuntime.service.js";
import { normalizeSalaryType } from "./payrollCalculator.service.js";
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
    error: issues.filter((issue) => issue.severity === "error"),
    warning: issues.filter((issue) => issue.severity === "warning"),
  };
}

export function hasBlockingPayrollIssues(issues = []) {
  return issues.some((issue) => issue.severity === "error");
}

function employeeFields(record) {
  return {
    employeeId: record?._id ? String(record._id) : null,
    employeeName: record?.fullName || null,
    employeeCode: record?.employeeCode || null,
  };
}

function addCompensationProfileIssue(issues, staff) {
  const salaryType = normalizeSalaryType(staff.salaryType);
  const baseSalary = Number(staff.baseSalary || 0);
  const hourlyRate = Number(staff.hourlyRate || 0);
  let invalid = false;
  let message = "";
  let suggestedAction = "";

  if (salaryType === "hourly" && !(hourlyRate > 0)) {
    invalid = true;
    message = "Nhân viên tính lương theo giờ nhưng chưa có đơn giá giờ hợp lệ.";
    suggestedAction = "Cập nhật đơn giá lương theo giờ trước khi chốt kỳ.";
  } else if (salaryType === "shift" && !(baseSalary > 0)) {
    invalid = true;
    message = "Nhân viên tính lương theo ca nhưng chưa có đơn giá ca hợp lệ.";
    suggestedAction = "Cập nhật đơn giá lương theo ca trước khi chốt kỳ.";
  } else if (salaryType === "monthly" && !(baseSalary > 0)) {
    invalid = true;
    message = "Nhân viên tính lương tháng nhưng chưa có mức lương hợp lệ.";
    suggestedAction = "Cập nhật mức lương tháng trước khi chốt kỳ.";
  }

  if (!invalid) return;
  pushIssue(issues, {
    code: "STAFF_MISSING_COMPENSATION_RATE",
    severity: "error",
    message,
    ...employeeFields(staff),
    sourceType: "Staff",
    sourceId: String(staff._id),
    suggestedAction,
  });
}

export async function validatePayrollPeriod(periodId, options = {}) {
  const period = await PayrollPeriod.findById(periodId).lean();
  if (!period) throw new Error("Không tìm thấy kỳ lương.");

  const issues = [];
  const start = toStartOfDay(period.startDate);
  const end = toEndOfDay(period.endDate);
  const restaurantId = oid(period.restaurantId);
  const strictMinimumWage = Boolean(options.strictMinimumWage);

  const [
    pendingOvertimeRequests,
    unapprovedOvertimeTimesheets,
    pendingOffScheduleTimesheets,
    pendingAttendanceCorrections,
  ] = await Promise.all([
    OvertimeRequest.find({
      restaurantId: period.restaurantId,
      workDate: { $gte: start, $lte: end },
      status: {
        $in: [
          "pending_employee_confirmation",
          "pending_approval",
          "approved",
        ],
      },
    })
      .populate("employeeId", "fullName employeeCode")
      .lean(),
    Timesheet.find({
      restaurantId: period.restaurantId,
      workDate: { $gte: start, $lte: end },
      overtimeMinutes: { $gt: 0 },
      $or: [
        { overtimeApprovalStatus: { $exists: false } },
        { overtimeApprovalStatus: null },
        { overtimeApprovalStatus: "not_required" },
        { overtimeApprovalStatus: "pending" },
        {
          overtimeApprovalStatus: "approved",
          approvedOvertimeMinutes: { $lte: 0 },
        },
      ],
    })
      .populate("employeeId", "fullName employeeCode")
      .lean(),
    Timesheet.find({
      restaurantId: period.restaurantId,
      workDate: { $gte: start, $lte: end },
      isOffSchedule: true,
      approved: { $ne: true },
      $and: [
        {
          $or: [
            { offScheduleApprovalStatus: { $exists: false } },
            { offScheduleApprovalStatus: "not_required" },
            { offScheduleApprovalStatus: "pending" },
            { offScheduleApprovalStatus: null },
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
      .lean(),
    AttendanceCorrectionRequest.find({
      restaurantId: period.restaurantId,
      status: "pending",
      workDate: { $gte: start, $lte: end },
    })
      .populate("employeeId", "fullName employeeCode")
      .lean(),
  ]);

  pendingOvertimeRequests.forEach((request) => {
    pushIssue(issues, {
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

  unapprovedOvertimeTimesheets.forEach((timesheet) => {
    pushIssue(issues, {
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

  pendingOffScheduleTimesheets.forEach((timesheet) => {
    pushIssue(issues, {
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

  pendingAttendanceCorrections.forEach((request) => {
    pushIssue(issues, {
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

  const staffMembershipFilter =
    await getStaffMembershipRestaurantFilter(restaurantId);
  const [settings, items, staffs, shifts, timesheets, leaves, adjustments] =
    await Promise.all([
      getPayrollSettings(period.restaurantId),
      PayrollItem.find({ periodId: period._id }).lean(),
      Staff.find({
        userType: "STAFF",
        deletedAt: null,
        ...staffMembershipFilter,
      })
        .select({
          _id: 1,
          fullName: 1,
          employeeCode: 1,
          baseSalary: 1,
          salaryType: 1,
          hourlyRate: 1,
          employmentStatus: 1,
          department: 1,
          positionTitle: 1,
        })
        .lean(),
      Shift.find({
        restaurantId,
        startTime: { $lte: end },
        endTime: { $gte: start },
        status: { $ne: "cancelled" },
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
  shifts.forEach((shift) => {
    const sid = String(shift.employeeId);
    shiftByStaff.set(sid, (shiftByStaff.get(sid) || 0) + 1);
  });
  const timesheetByStaff = new Map();
  timesheets.forEach((timesheet) => {
    const sid = String(timesheet.employeeId);
    timesheetByStaff.set(sid, (timesheetByStaff.get(sid) || 0) + 1);
  });
  const timesheetByShift = new Set(
    timesheets
      .filter((timesheet) => timesheet.shiftId)
      .map((timesheet) => String(timesheet.shiftId)),
  );
  const itemEmployeeIds = new Set(
    items.map((item) => String(item.employeeId)),
  );
  const scopedStaffIds = new Set(staffs.map((staff) => String(staff._id)));

  staffs.forEach((staff) => {
    const sid = String(staff._id);
    const working =
      String(staff.employmentStatus || "").toLowerCase() === "working";
    if (working) addCompensationProfileIssue(issues, staff);

    if (!staff.department) {
      pushIssue(issues, {
        code: "STAFF_MISSING_DEPARTMENT",
        severity: "warning",
        message: "Nhân viên chưa có bộ phận.",
        ...employeeFields(staff),
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
        ...employeeFields(staff),
        sourceType: "Staff",
        sourceId: sid,
        suggestedAction: "Bổ sung chức danh cho nhân viên.",
      });
    }

    if (working) {
      const hasTimesheet = Number(timesheetByStaff.get(sid) || 0) > 0;
      const hasShift = Number(shiftByStaff.get(sid) || 0) > 0;
      if (!hasTimesheet) {
        pushIssue(issues, {
          code: "STAFF_WITHOUT_TIMESHEET",
          severity: hasShift ? "error" : "warning",
          message: "Nhân viên không có chấm công trong kỳ.",
          ...employeeFields(staff),
          sourceType: "Timesheet",
          suggestedAction:
            "Bổ sung/chỉnh công cho nhân viên trước khi chốt kỳ.",
        });
      }
    }

    if (!itemEmployeeIds.has(sid)) {
      pushIssue(issues, {
        code: "PAYROLL_ITEM_MISSING_FOR_STAFF",
        severity: "error",
        message: "Nhân viên thuộc nhà hàng nhưng chưa có phiếu lương trong kỳ.",
        ...employeeFields(staff),
        sourceType: "PayrollItem",
        suggestedAction: "Tính lại kỳ lương để đồng bộ danh sách nhân viên.",
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

  timesheets.forEach((timesheet) => {
    const sid = String(timesheet.employeeId);
    if (timesheet.actualCheckInAt && !timesheet.actualCheckOutAt) {
      pushIssue(issues, {
        code: "TIMESHEET_OPEN_CHECKIN",
        severity: "error",
        message: "Có bản ghi check-in chưa check-out.",
        employeeId: sid,
        sourceType: "Timesheet",
        sourceId: String(timesheet._id),
        suggestedAction: "Hoàn tất check-out hoặc chỉnh công cho bản ghi này.",
      });
    }
    if (
      String(timesheet.source || "") === "manual" &&
      timesheet.approved !== true
    ) {
      pushIssue(issues, {
        code: "TIMESHEET_MANUAL_NOT_APPROVED",
        severity: "error",
        message: "Bản ghi chấm công thủ công chưa được duyệt.",
        employeeId: sid,
        sourceType: "Timesheet",
        sourceId: String(timesheet._id),
        suggestedAction:
          "Duyệt bản ghi chấm công thủ công trước khi chốt kỳ.",
      });
    }
    const invalidHours =
      Number(timesheet.workedMinutes || 0) < 0 ||
      Number(timesheet.hours || 0) < 0 ||
      (timesheet.actualCheckInAt &&
        timesheet.actualCheckOutAt &&
        new Date(timesheet.actualCheckOutAt) <
          new Date(timesheet.actualCheckInAt));
    if (invalidHours) {
      pushIssue(issues, {
        code: "TIMESHEET_NEGATIVE_OR_INVALID_HOURS",
        severity: "error",
        message: "Bản ghi chấm công có số giờ không hợp lệ.",
        employeeId: sid,
        sourceType: "Timesheet",
        sourceId: String(timesheet._id),
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
        suggestedAction: "Duyệt hoặc từ chối đơn nghỉ phép trước khi chốt lương.",
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

  adjustments.forEach((adjustment) => {
    const amount = Number(adjustment.amount || 0);
    if (!(amount > 0)) {
      pushIssue(issues, {
        code: "PAYROLL_ADJUSTMENT_INVALID_AMOUNT",
        severity: "error",
        message: "Điều chỉnh lương có số tiền không hợp lệ.",
        employeeId: String(adjustment.employeeId),
        sourceType: "PayrollAdjustment",
        sourceId: String(adjustment._id),
        suggestedAction: "Kiểm tra lại số tiền điều chỉnh lương.",
      });
    }
    if (!VALID_ADJUSTMENT_TYPES.has(String(adjustment.type || ""))) {
      pushIssue(issues, {
        code: "PAYROLL_ADJUSTMENT_INVALID_TYPE",
        severity: "error",
        message: "Điều chỉnh lương có loại không hợp lệ.",
        employeeId: String(adjustment.employeeId),
        sourceType: "PayrollAdjustment",
        sourceId: String(adjustment._id),
        suggestedAction: "Chuyển loại điều chỉnh về danh mục hợp lệ.",
      });
    }
    if (!scopedStaffIds.has(String(adjustment.employeeId))) {
      pushIssue(issues, {
        code: "PAYROLL_ADJUSTMENT_WRONG_RESTAURANT",
        severity: "error",
        message: "Điều chỉnh lương thuộc nhân viên ngoài phạm vi nhà hàng.",
        employeeId: String(adjustment.employeeId),
        sourceType: "PayrollAdjustment",
        sourceId: String(adjustment._id),
        suggestedAction: "Xóa hoặc chuyển điều chỉnh sang đúng kỳ lương.",
      });
    }
  });

  items.forEach((item) => {
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
    if (item?.breakdown?.missingCompensationRate) {
      pushIssue(issues, {
        code: "PAYROLL_ITEM_MISSING_COMPENSATION_RATE",
        severity: "error",
        message: "Phiếu lương thiếu đơn giá hoặc dữ liệu thu nhập theo loại lương.",
        employeeId: String(item.employeeId),
        sourceType: "PayrollItem",
        sourceId: String(item._id),
        suggestedAction: "Cập nhật hồ sơ lương hoặc dữ liệu nguồn rồi tính lại kỳ.",
      });
    }
    if (item?.breakdown?.minimumWageViolation) {
      pushIssue(issues, {
        code: "PAYROLL_ITEM_MINIMUM_WAGE_VIOLATION",
        severity: strictMinimumWage ? "error" : "warning",
        message: "Mức lương thấp hơn mức lương tối thiểu vùng.",
        employeeId: String(item.employeeId),
        sourceType: "PayrollItem",
        sourceId: String(item._id),
        suggestedAction: "Rà soát mức lương và chính sách áp dụng.",
      });
    }
    if (!scopedStaffIds.has(String(item.employeeId))) {
      pushIssue(issues, {
        code: "PAYROLL_ITEM_WRONG_RESTAURANT",
        severity: "error",
        message: "Phiếu lương thuộc nhân viên ngoài phạm vi nhà hàng.",
        employeeId: String(item.employeeId),
        sourceType: "PayrollItem",
        sourceId: String(item._id),
        suggestedAction: "Tính lại kỳ lương để đồng bộ phạm vi nhân viên.",
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
