const ISSUE_CODE_ACTIONS = {
  SCHEDULE_NOT_PUBLISHED: {
    label: "Đi tới lịch làm việc",
    page: "schedules",
    query: { focus: "publication" },
  },
  SCHEDULE_ACK_PENDING: {
    label: "Xem xác nhận lịch",
    page: "schedules",
    query: { focus: "acknowledgements" },
  },
  SCHEDULE_CHANGED_AFTER_ACK: {
    label: "Xem lịch thay đổi",
    page: "schedules",
    query: { focus: "changes" },
  },
  SHIFT_DECLINE_UNREVIEWED: {
    label: "Xử lý ca bị từ chối",
    page: "schedules",
    query: { focus: "declined-shifts" },
  },
  ATTENDANCE_MISSING_CHECK_IN: {
    label: "Xử lý chấm công",
    page: "staff",
    query: { staffPage: "attendance", attendanceTab: "all", status: "missing_check_in" },
  },
  ATTENDANCE_MISSING_CHECK_OUT: {
    label: "Xử lý thiếu check-out",
    page: "staff",
    query: { staffPage: "attendance", attendanceTab: "all", status: "missed_checkout" },
  },
  ATTENDANCE_NO_SHOW_UNRESOLVED: {
    label: "Xử lý no-show",
    page: "staff",
    query: { staffPage: "attendance", attendanceTab: "all", status: "scheduled_absent" },
  },
  ATTENDANCE_EXCEPTION_UNRESOLVED: {
    label: "Xử lý ngoại lệ chấm công",
    page: "staff",
    query: { staffPage: "attendance", attendanceTab: "all", status: "exception" },
  },
  ATTENDANCE_CORRECTION_PENDING: {
    label: "Duyệt đơn sửa công",
    page: "staff",
    query: {
      staffPage: "attendance",
      attendanceTab: "corrections",
      correctionStatus: "pending",
    },
  },
  OFF_SCHEDULE_ATTENDANCE_PENDING: {
    label: "Duyệt công ngoài lịch",
    page: "staff",
    query: {
      staffPage: "attendance",
      attendanceTab: "off_schedule",
      offScheduleStatus: "pending",
    },
  },
  OVERTIME_PENDING: {
    label: "Duyệt tăng ca",
    page: "staff",
    query: {
      staffPage: "attendance",
      attendanceTab: "overtime",
      overtimeStatus: "pending",
    },
  },
  PAYROLL_PERIOD_EMPTY: {
    label: "Tính lại bảng lương",
    page: "payroll",
    query: { focus: "recalculate" },
  },
  PAYROLL_SETTINGS_INCOMPLETE: {
    label: "Mở cấu hình lương",
    page: "payroll",
    query: { focus: "settings" },
  },
};

const TARGET_ROUTE_ACTIONS = {
  schedule: {
    label: "Đi tới lịch làm việc",
    page: "schedules",
    query: { focus: "schedule" },
  },
  attendance: {
    label: "Đi tới chấm công",
    page: "staff",
    query: { staffPage: "attendance" },
  },
  attendance_correction: {
    label: "Duyệt đơn sửa công",
    page: "staff",
    query: {
      staffPage: "attendance",
      attendanceTab: "corrections",
      correctionStatus: "pending",
    },
  },
  off_schedule: {
    label: "Duyệt công ngoài lịch",
    page: "staff",
    query: {
      staffPage: "attendance",
      attendanceTab: "off_schedule",
      offScheduleStatus: "pending",
    },
  },
  overtime: {
    label: "Duyệt tăng ca",
    page: "staff",
    query: {
      staffPage: "attendance",
      attendanceTab: "overtime",
      overtimeStatus: "pending",
    },
  },
  payroll: {
    label: "Xem bảng lương",
    page: "payroll",
    query: {},
  },
};

export function getPayrollReadinessIssueAction(issue = {}) {
  const byCode = ISSUE_CODE_ACTIONS[issue.code];
  const byTarget = TARGET_ROUTE_ACTIONS[issue.targetRoute];

  const action = byCode || byTarget || {
    label: "Xem nơi cần xử lý",
    page: "payroll",
    query: {},
  };

  return {
    ...action,
    query: {
      ...(action.query || {}),
      ...(issue.employeeId ? { employeeId: issue.employeeId } : {}),
      ...(issue.employeeName ? { employeeName: issue.employeeName } : {}),
      ...(issue.sourceId ? { sourceId: issue.sourceId } : {}),
      ...(issue.sourceType ? { sourceType: issue.sourceType } : {}),
      ...(issue.code ? { issueCode: issue.code } : {}),
    },
  };
}

export function dispatchPayrollReadinessNavigation(issue) {
  const action = getPayrollReadinessIssueAction(issue);

  window.dispatchEvent(
    new CustomEvent("manager:navigate", {
      detail: {
        page: action.page,
        query: action.query,
        source: "payroll-readiness",
      },
    }),
  );

  return action;
}
