import mongoose from "mongoose";
import { resolveStaffAvailabilityForShift } from "./staffAvailabilityContext.service.js";
import {
  LeaveRequest,
  SchedulingPolicy,
  Shift,
  Staff,
} from "../../../models/index.js";
import { assertNoLockedPayrollPeriodOverlap } from "../payroll/payrollLockGuard.service.js";
import {
  getDefaultSchedulingPolicyPayload,
  mapSchedulingPolicy,
} from "./schedulingPolicy.service.js";
import { getLatestStaffPerformanceSnapshot } from "../staffPerformance/staffPerformance.service.js";
const DAY_KEYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const PART_TIME_LIKE_EMPLOYMENT_TYPES = new Set(["part_time", "seasonal", "probation", "contract"]);

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function toValidDate(value, fieldName) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} không hợp lệ.`);
  }
  return date;
}

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(value) {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeekMonday(value) {
  const d = startOfDay(value);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function endOfWeekMonday(value) {
  const start = startOfWeekMonday(value);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function hoursBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s)
    return 0;
  return Number(((e.getTime() - s.getTime()) / 3600000).toFixed(2));
}

function ymd(value) {
  return startOfDay(value).toISOString().slice(0, 10);
}

function normalizeWorkingDay(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function getDayKey(value) {
  return DAY_KEYS[new Date(value).getDay()];
}

function normalizeShiftType(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function pushIssue(collection, { code, severity, message, suggestedAction }) {
  collection.push({
    code,
    severity,
    message,
    suggestedAction: suggestedAction || "",
  });
}

function isHard(level) {
  return String(level || "").toLowerCase() === "hard";
}

function isOff(level) {
  return String(level || "").toLowerCase() === "off";
}

function canOverride(policy, input) {
  const rules = policy.laborRules || {};
  if (!rules.allowManagerOverride) return false;
  if (!input.allowOverride) return false;
  if (
    rules.overrideRequiresReason &&
    !String(input.overrideReason || "").trim()
  ) {
    return false;
  }
  return true;
}

function shouldBlock({ level, input, policy }) {
  if (isOff(level)) return false;
  if (isHard(level)) return true;
  return !canOverride(policy, input);
}

async function resolvePolicy(restaurantId) {
  const rid = toObjectId(restaurantId);
  let policy = await SchedulingPolicy.findOne({ restaurantId: rid });

  if (!policy) {
    policy = await SchedulingPolicy.create(
      getDefaultSchedulingPolicyPayload(rid),
    );
  }

  return mapSchedulingPolicy(policy);
}

async function findLeaveConflicts({
  employeeId,
  restaurantId,
  startTime,
  endTime,
}) {
  return LeaveRequest.find({
    employeeId,
    restaurantId,
    status: {
      $in: ["pending", "pending_replacement_confirmation", "approved"],
    },
    startDate: { $lte: endOfDay(endTime) },
    endDate: { $gte: startOfDay(startTime) },
  }).lean();
}

function leaveBlocksShift(leave, date, shiftType) {
  if (!leave || String(leave.status || "").toLowerCase() === "rejected") {
    return false;
  }

  const shiftDay = ymd(date);
  const startDay = ymd(leave.startDate);
  const endDay = ymd(leave.endDate);

  if (shiftDay < startDay || shiftDay > endDay) return false;

  const safeShiftType = normalizeShiftType(shiftType);
  const startSession = String(leave.startSession || "full").toLowerCase();
  const endSession = String(leave.endSession || "full").toLowerCase();

  if (startDay === endDay) {
    if (startSession === "morning" && endSession === "morning") {
      return safeShiftType === "morning";
    }
    if (startSession === "afternoon" && endSession === "afternoon") {
      return safeShiftType === "afternoon" || safeShiftType === "evening";
    }
    return true;
  }

  if (shiftDay === startDay && startSession === "afternoon") {
    return safeShiftType === "afternoon" || safeShiftType === "evening";
  }

  if (shiftDay === endDay && endSession === "morning") {
    return safeShiftType === "morning";
  }

  return true;
}

async function findOverlappingShifts({
  employeeId,
  startTime,
  endTime,
  ignoreShiftId,
}) {
  const filter = {
    employeeId,
    status: { $ne: "cancelled" },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };

  const ignored = toObjectId(ignoreShiftId);
  if (ignored) {
    filter._id = { $ne: ignored };
  }

  return Shift.find(filter).lean();
}

async function findDayShifts({ employeeId, date, ignoreShiftId }) {
  const filter = {
    employeeId,
    status: { $ne: "cancelled" },
    startTime: { $lte: endOfDay(date) },
    endTime: { $gte: startOfDay(date) },
  };

  const ignored = toObjectId(ignoreShiftId);
  if (ignored) {
    filter._id = { $ne: ignored };
  }

  return Shift.find(filter).lean();
}

async function findWeekShifts({ employeeId, date, ignoreShiftId }) {
  const filter = {
    employeeId,
    status: { $ne: "cancelled" },
    startTime: { $lte: endOfWeekMonday(date) },
    endTime: { $gte: startOfWeekMonday(date) },
  };

  const ignored = toObjectId(ignoreShiftId);
  if (ignored) {
    filter._id = { $ne: ignored };
  }

  return Shift.find(filter).lean();
}

async function findNeighborShifts({
  employeeId,
  startTime,
  endTime,
  ignoreShiftId,
}) {
  const windowStart = new Date(startTime);
  windowStart.setDate(windowStart.getDate() - 2);

  const windowEnd = new Date(endTime);
  windowEnd.setDate(windowEnd.getDate() + 2);

  const filter = {
    employeeId,
    status: { $ne: "cancelled" },
    startTime: { $lte: windowEnd },
    endTime: { $gte: windowStart },
  };

  const ignored = toObjectId(ignoreShiftId);
  if (ignored) {
    filter._id = { $ne: ignored };
  }

  return Shift.find(filter).sort({ startTime: 1 }).lean();
}

async function getConsecutiveWorkingDays({
  employeeId,
  restaurantId,
  targetDate,
  ignoreShiftId,
}) {
  const scanStart = new Date(targetDate);
  scanStart.setDate(scanStart.getDate() - 14);

  const scanEnd = new Date(targetDate);
  scanEnd.setDate(scanEnd.getDate() + 14);

  const ignored = toObjectId(ignoreShiftId);

  const shifts = await Shift.find({
    employeeId,
    restaurantId,
    status: { $ne: "cancelled" },
    startTime: { $lte: endOfDay(scanEnd) },
    endTime: { $gte: startOfDay(scanStart) },
    ...(ignored ? { _id: { $ne: ignored } } : {}),
  }).lean();

  const workingDates = new Set(shifts.map((shift) => ymd(shift.startTime)));
  workingDates.add(ymd(targetDate));

  let count = 1;

  let cursor = new Date(targetDate);
  while (true) {
    cursor.setDate(cursor.getDate() - 1);
    if (!workingDates.has(ymd(cursor))) break;
    count += 1;
  }

  cursor = new Date(targetDate);
  while (true) {
    cursor.setDate(cursor.getDate() + 1);
    if (!workingDates.has(ymd(cursor))) break;
    count += 1;
  }

  return count;
}
function computeCandidateScore({
  staff,
  policy,
  weeklyHoursAfter,
  hasWarnings,
  consecutiveDays,
  performanceSnapshot,
}) {
  const weights = policy.scoringWeights || {};
  const rules = policy.laborRules || {};
  const employmentType = String(staff.employmentType || "full_time")
    .trim()
    .toLowerCase();
  const employmentPolicy =
    policy.employmentTypePolicy?.[employmentType] ||
    policy.employmentTypePolicy?.full_time ||
    {};

  let score = 0;

  score += Number(weights.roleFit || 20);
  score += Number(weights.availabilityFit || 15);

  const weeklyTarget = Number(
    employmentPolicy.weeklyHoursTarget || rules.recommendedWeeklyHoursCap || 40,
  );

  if (weeklyHoursAfter <= weeklyTarget * 0.5) {
    score += Number(weights.workloadBalance || 15);
  } else if (weeklyHoursAfter <= weeklyTarget * 0.75) {
    score += Math.round(Number(weights.workloadBalance || 15) * 0.75);
  } else if (weeklyHoursAfter <= weeklyTarget) {
    score += Math.round(Number(weights.workloadBalance || 15) * 0.45);
  } else {
    score += Math.round(Number(weights.workloadBalance || 15) * 0.15);
  }

  score += Math.round(
    Number(weights.employmentTypeFit || 10) *
      Number(employmentPolicy.priorityWeight || 1),
  );

  score += Number(weights.costEfficiency || 5);

  const performanceScore = Number(
    performanceSnapshot?.finalPerformanceScore ?? 75,
  );

  const performanceContribution = Math.round(
    (performanceScore / 100) * Number(weights.performance || 10),
  );

  score += performanceContribution;

  const punctualityScore = Number(
    performanceSnapshot?.punctuality?.score ?? performanceScore ?? 75,
  );

  const complianceScore = Number(
    performanceSnapshot?.compliance?.score ?? performanceScore ?? 75,
  );

  const reliabilityScore = Math.round((punctualityScore + complianceScore) / 2);

  const reliabilityContribution = Math.round(
    (reliabilityScore / 100) * Number(weights.reliability || 5),
  );

  score += reliabilityContribution;

  if (consecutiveDays >= Number(rules.maxConsecutiveWorkingDays || 6)) {
    score -= Number(weights.fatiguePenalty || 20);
  }

  if (weeklyHoursAfter > Number(rules.recommendedWeeklyHoursCap || 40)) {
    score -= Number(weights.overtimePenalty || 15);
  }

  if (hasWarnings) {
    score -= Math.round(Number(weights.ruleRiskPenalty || 30) * 0.4);
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    performanceScore,
    performanceContribution,
    reliabilityScore,
    reliabilityContribution,
    performanceSnapshotId: performanceSnapshot?._id
      ? String(performanceSnapshot._id)
      : null,
  };
}


function buildAssignmentExplanations({
  blockingErrors,
  warnings,
  availabilityResult,
  weeklyHoursAfter,
  effectiveWeeklyCap,
  scoreResult,
}) {
  const reasons = [];

  if (blockingErrors.length) {
    reasons.push(
      ...blockingErrors.map((issue) => `Skipped because ${issue.code}: ${issue.message}`),
    );
  } else {
    reasons.push(
      `Selected candidate because validation passed with score ${scoreResult.score}.`,
    );
  }

  if (availabilityResult?.status) {
    reasons.push(`Availability status: ${availabilityResult.status}.`);
  }

  if (weeklyHoursAfter <= effectiveWeeklyCap) {
    reasons.push(
      `Weekly hours after assignment ${weeklyHoursAfter}h stay within cap ${effectiveWeeklyCap}h.`,
    );
  }

  if (warnings.length) {
    reasons.push(
      ...warnings.map((issue) => `Warning ${issue.code}: ${issue.message}`),
    );
  }

  return reasons;
}

export async function validateShiftAssignment({ input }) {
  const employeeId = toObjectId(input.employeeId);
  const restaurantId = toObjectId(input.restaurantId);
  const ignoreShiftId = input.ignoreShiftId || null;

  if (!employeeId) throw new Error("employeeId không hợp lệ.");
  if (!restaurantId) throw new Error("restaurantId không hợp lệ.");

  const startTime = toValidDate(input.startTime, "Giờ bắt đầu");
  const endTime = toValidDate(input.endTime, "Giờ kết thúc");

  if (endTime <= startTime) {
    throw new Error("Giờ kết thúc ca phải lớn hơn giờ bắt đầu.");
  }

  const shiftHours = hoursBetween(startTime, endTime);
  const isCrossDayShift = ymd(startTime) !== ymd(endTime);

  const staff = await Staff.findById(employeeId).lean();
  if (!staff || staff.userType !== "STAFF" || staff.deletedAt) {
    throw new Error("Không tìm thấy nhân viên.");
  }

  const employmentType = String(staff.employmentType || "full_time")
    .trim()
    .toLowerCase();
  const isPartTimeLike = PART_TIME_LIKE_EMPLOYMENT_TYPES.has(employmentType);

  const policy = await resolvePolicy(restaurantId);
  const rules = policy.laborRules || {};

  const blockingErrors = [];
  const warnings = [];

  await assertNoLockedPayrollPeriodOverlap({
    restaurantId,
    employeeId,
    startDate: startTime,
    endDate: endTime,
    action: "shift",
  });

  if (isCrossDayShift) {
    pushIssue(warnings, {
      code: "CROSS_DAY_SHIFT_WARNING",
      severity: "warning",
      message: "Ca làm qua ngày, cần kiểm tra bàn giao và chấm công qua đêm.",
      suggestedAction:
        "Xác nhận giờ nghỉ, checkout và payroll trước khi công bố lịch.",
    });
  }

  if (String(staff.employmentStatus || "").toLowerCase() !== "working") {
    pushIssue(blockingErrors, {
      code: "STAFF_NOT_WORKING",
      severity: "error",
      message: "Nhân viên không ở trạng thái đang làm việc.",
      suggestedAction: "Chỉ xếp ca cho nhân viên đang làm việc.",
    });
  }

  if (
    !isPartTimeLike &&
    rules.respectWorkingDays &&
    !isOff(rules.workingDaysRuleLevel)
  ) {
    const workingDays = Array.isArray(staff.workingDays)
      ? staff.workingDays.map(normalizeWorkingDay)
      : [];

    const dayKey = getDayKey(startTime);
    const isAllowed = !workingDays.length || workingDays.includes(dayKey);

    if (!isAllowed) {
      const issue = {
        code: "OUTSIDE_WORKING_DAYS",
        severity: shouldBlock({
          level: rules.workingDaysRuleLevel,
          input,
          policy,
        })
          ? "error"
          : "warning",
        message: "Ca này nằm ngoài ngày khả dụng của nhân viên.",
        suggestedAction:
          "Chọn nhân viên khác, cập nhật ngày làm việc mặc định hoặc override có lý do.",
      };

      if (issue.severity === "error") {
        pushIssue(blockingErrors, issue);
      } else {
        pushIssue(warnings, issue);
      }
    }
  }

  if (rules.respectLeaveRequests && !isOff(rules.leaveConflictRuleLevel)) {
    const leaveConflicts = (
      await findLeaveConflicts({
        employeeId,
        restaurantId,
        startTime,
        endTime,
      })
    ).filter((leave) => leaveBlocksShift(leave, startTime, input.shiftType));

    const approvedLeaveConflicts = leaveConflicts.filter(
      (leave) => String(leave.status || "").toLowerCase() === "approved",
    );

    if (approvedLeaveConflicts.length > 0) {
      pushIssue(blockingErrors, {
        code: "LEAVE_CONFLICT",
        severity: "error",
        message: "NhÃ¢n viÃªn Ä‘Ã£ Ä‘Æ°á»£c duyá»‡t nghá»‰ phÃ©p trÃ¹ng vá»›i ca nÃ y.",
        suggestedAction:
          "KhÃ´ng xáº¿p ca trong thá»i gian nghá»‰ Ä‘Ã£ duyá»‡t; hÃ£y chá»n nhÃ¢n viÃªn khÃ¡c.",
      });
    } else if (leaveConflicts.length > 0) {
      const issue = {
        code: "LEAVE_CONFLICT",
        severity: shouldBlock({
          level: rules.leaveConflictRuleLevel,
          input,
          policy,
        })
          ? "error"
          : "warning",
        message: "Nhân viên đang có đơn nghỉ phép trùng với ca này.",
        suggestedAction:
          "Không xếp ca trong ngày nghỉ hoặc xử lý đơn nghỉ trước khi xếp lịch.",
      };

      if (issue.severity === "error") {
        pushIssue(blockingErrors, issue);
      } else {
        pushIssue(warnings, issue);
      }
    }
  }

  const availabilityResult = await resolveStaffAvailabilityForShift({
    restaurantId,
    employeeId,
    staff,
    shiftDate: startTime,
    shiftType: input.shiftType,
    policy,
  });

  for (const issue of availabilityResult.issues || []) {
    pushIssue(warnings, issue);
  }

  if (rules.preventShiftOverlap) {
    const overlaps = await findOverlappingShifts({
      employeeId,
      startTime,
      endTime,
      ignoreShiftId,
    });

    if (overlaps.length > 0) {
      pushIssue(blockingErrors, {
        code: "SHIFT_OVERLAP",
        severity: "error",
        message: "Nhân viên đã có ca khác bị trùng thời gian.",
        suggestedAction: "Chọn khung giờ khác hoặc xóa/sửa ca đang trùng.",
      });
    }
  }

  const dayShifts = await findDayShifts({
    employeeId,
    date: startTime,
    ignoreShiftId,
  });

  const shiftsInDayAfter = dayShifts.length + 1;

  if (
    Number(rules.maxShiftsPerDay || 0) > 0 &&
    shiftsInDayAfter > Number(rules.maxShiftsPerDay)
  ) {
    const issue = {
      code: "MAX_SHIFTS_PER_DAY_EXCEEDED",
      severity: shouldBlock({
        level: rules.maxShiftsPerDayRuleLevel,
        input,
        policy,
      })
        ? "error"
        : "warning",
      message: `Nhân viên sẽ có ${shiftsInDayAfter} ca trong ngày, vượt giới hạn ${rules.maxShiftsPerDay} ca/ngày.`,
      suggestedAction:
        "Giảm số ca trong ngày hoặc override nếu doanh nghiệp cho phép.",
    };

    if (issue.severity === "error") {
      pushIssue(blockingErrors, issue);
    } else {
      pushIssue(warnings, issue);
    }
  }

  const weekShifts = await findWeekShifts({
    employeeId,
    date: startTime,
    ignoreShiftId,
  });

  const weeklyHoursBefore = weekShifts.reduce(
    (sum, shift) => sum + hoursBetween(shift.startTime, shift.endTime),
    0,
  );

  const weeklyHoursAfter = Number((weeklyHoursBefore + shiftHours).toFixed(2));

  const employmentPolicy =
    policy.employmentTypePolicy?.[employmentType] ||
    policy.employmentTypePolicy?.full_time ||
    {};

  const effectiveWeeklyCap = Number(
    employmentPolicy.weeklyHoursCap || rules.weeklyHoursCap || 48,
  );

  if (effectiveWeeklyCap > 0 && weeklyHoursAfter > effectiveWeeklyCap) {
    const issue = {
      code: "WEEKLY_HOURS_CAP_EXCEEDED",
      severity: shouldBlock({
        level: rules.weeklyHoursRuleLevel,
        input,
        policy,
      })
        ? "error"
        : "warning",
      message: `Tổng giờ tuần sau khi xếp ca là ${weeklyHoursAfter}h, vượt giới hạn ${effectiveWeeklyCap}h.`,
      suggestedAction:
        "Chọn nhân viên còn ít giờ hơn hoặc điều chỉnh giới hạn theo chính sách.",
    };

    if (issue.severity === "error") {
      pushIssue(blockingErrors, issue);
    } else {
      pushIssue(warnings, issue);
    }
  } else if (weeklyHoursAfter > Number(rules.recommendedWeeklyHoursCap || 40)) {
    pushIssue(warnings, {
      code: "RECOMMENDED_WEEKLY_HOURS_EXCEEDED",
      severity: "warning",
      message: `Tổng giờ tuần sau khi xếp ca là ${weeklyHoursAfter}h, vượt mức khuyến nghị ${rules.recommendedWeeklyHoursCap}h.`,
      suggestedAction: "Cân nhắc chọn nhân viên khác để cân bằng tải làm việc.",
    });
  }

  const neighborShifts = await findNeighborShifts({
    employeeId,
    startTime,
    endTime,
    ignoreShiftId,
  });

  if (!isOff(rules.minRestRuleLevel)) {
    const minRestHours = Number(rules.minRestHoursBetweenShifts || 0);

    for (const shift of neighborShifts) {
      const restBefore = hoursBetween(shift.endTime, startTime);
      const restAfter = hoursBetween(endTime, shift.startTime);

      const isBefore = new Date(shift.endTime) <= startTime;
      const isAfter = endTime <= new Date(shift.startTime);

      const restHours = isBefore ? restBefore : isAfter ? restAfter : 999;

      if (restHours < minRestHours) {
        const issue = {
          code: "MIN_REST_HOURS_VIOLATION",
          severity: shouldBlock({
            level: rules.minRestRuleLevel,
            input,
            policy,
          })
            ? "error"
            : "warning",
          message: `Nhân viên không đủ ${minRestHours} giờ nghỉ giữa hai ca.`,
          suggestedAction:
            "Đổi ca hoặc chọn nhân viên khác để đảm bảo thời gian nghỉ.",
        };

        if (issue.severity === "error") {
          pushIssue(blockingErrors, issue);
        } else {
          pushIssue(warnings, issue);
        }
        break;
      }
    }
  }

  const consecutiveDays = await getConsecutiveWorkingDays({
    employeeId,
    restaurantId,
    targetDate: startTime,
    ignoreShiftId,
  });

  const hardMaxConsecutive = Number(rules.hardMaxConsecutiveWorkingDays || 7);
  const softMaxConsecutive = Number(rules.maxConsecutiveWorkingDays || 6);

  if (!isOff(rules.consecutiveDaysRuleLevel)) {
    if (consecutiveDays > hardMaxConsecutive) {
      pushIssue(blockingErrors, {
        code: "HARD_MAX_CONSECUTIVE_DAYS_EXCEEDED",
        severity: "error",
        message: `Nhân viên sẽ làm ${consecutiveDays} ngày liên tục, vượt giới hạn cứng ${hardMaxConsecutive} ngày.`,
        suggestedAction: "Bắt buộc chọn nhân viên khác hoặc sắp xếp ngày nghỉ.",
      });
    } else if (consecutiveDays > softMaxConsecutive) {
      const issue = {
        code: "MAX_CONSECUTIVE_DAYS_WARNING",
        severity: shouldBlock({
          level: rules.consecutiveDaysRuleLevel,
          input,
          policy,
        })
          ? "error"
          : "warning",
        message: `Nhân viên sẽ làm ${consecutiveDays} ngày liên tục, vượt mức khuyến nghị ${softMaxConsecutive} ngày.`,
        suggestedAction:
          "Nên sắp xếp nghỉ hoặc override có lý do nếu thật sự cần.",
      };

      if (issue.severity === "error") {
        pushIssue(blockingErrors, issue);
      } else {
        pushIssue(warnings, issue);
      }
    }
  }
  const performanceSnapshot = await getLatestStaffPerformanceSnapshot({
    employeeId,
    restaurantId,
    atDate: startTime,
  });

  const scoringWarnings = warnings.filter((warning) => warning.code !== "FIRST_WEEK_GRACE_MISSING_AVAILABILITY");

  const scoreResult = computeCandidateScore({
    staff,
    policy,
    weeklyHoursAfter,
    hasWarnings: scoringWarnings.length > 0,
    consecutiveDays,
    performanceSnapshot,
  });

  return {
    ok: blockingErrors.length === 0,
    employeeId: String(employeeId),
    restaurantId: String(restaurantId),
    score: scoreResult.score,
    blockingErrors,
    warnings,
    explanations: buildAssignmentExplanations({
      blockingErrors,
      warnings,
      availabilityResult,
      weeklyHoursAfter,
      effectiveWeeklyCap,
      scoreResult,
    }),
    metrics: {
      shiftHours,
      weeklyHoursBefore: Number(weeklyHoursBefore.toFixed(2)),
      weeklyHoursAfter,
      shiftsInDayAfter,
      consecutiveWorkingDays: consecutiveDays,

      performanceScore: scoreResult.performanceScore,
      performanceContribution: scoreResult.performanceContribution,
      reliabilityScore: scoreResult.reliabilityScore,
      reliabilityContribution: scoreResult.reliabilityContribution,
      performanceSnapshotId: scoreResult.performanceSnapshotId,
    },
  };
}

export async function assertShiftAssignmentValid({ input, ctx }) {
  const result = await validateShiftAssignment({ input, ctx });

  if (!result.ok) {
    const first = result.blockingErrors[0];
    throw new Error(
      first?.message || "Không thể xếp ca vì vi phạm quy tắc lịch làm việc.",
    );
  }

  return result;
}

export function hasNonInfoWarnings(result) {
  return (result?.warnings || []).some(
    (warning) => String(warning?.severity || "warning").toLowerCase() !== "info",
  );
}
