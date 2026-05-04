import mongoose from "mongoose";
import { SchedulingPolicy } from "../../../models/index.js";
const AUTO_REQUIRED_ROLE_VALUES = [
  "server",
  "cook",
  "cashier",
  "host",
  "cleaner",
  "bartender",
  "shipper",
  "storekeeper",
];
const DAY_OF_WEEK_VALUES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const EMPLOYMENT_TYPE_VALUES = [
  "full_time",
  "part_time",
  "probation",
  "seasonal",
  "contract",
];
const DEFAULT_AVAILABILITY_REGISTRATION_POLICY = {
  availabilityRegistrationMode: "manual",
  availabilityOpenDayOffset: -7,
  availabilityOpenTime: "00:00",
  availabilityCloseDayOffset: -5,
  availabilityCloseTime: "23:59",
  enabled: true,
  targetEmploymentTypes: ["part_time", "seasonal"],
  openDayOfWeek: "MON",
  openTime: "08:00",
  closeDayOfWeek: "WED",
  closeTime: "22:00",
  publishTargetDayOfWeek: "FRI",
  publishTargetTime: "17:00",
  timezone: "Asia/Ho_Chi_Minh",
  allowFullTimeUnavailableException: true,
  lateChangeRequiresApproval: true,
  treatMissingPartTimeSubmissionAsUnavailable: true,
  autoCreateWindow: true,
};
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

export function getDefaultSchedulingPolicyPayload(restaurantId) {
  return {
    restaurantId,
    shiftTemplates: [
      {
        key: "morning",
        label: "Ca sáng",
        startTime: "06:00",
        endTime: "12:00",
        enabled: true,
        allowCrossDay: false,
      },
      {
        key: "afternoon",
        label: "Ca chiều",
        startTime: "12:00",
        endTime: "18:00",
        enabled: true,
        allowCrossDay: false,
      },
      {
        key: "evening",
        label: "Ca tối",
        startTime: "18:00",
        endTime: "23:00",
        enabled: true,
        allowCrossDay: false,
      },
    ],
    laborRules: {
      respectWorkingDays: true,
      workingDaysRuleLevel: "hard",
      respectLeaveRequests: true,
      leaveConflictRuleLevel: "hard",
      preventShiftOverlap: true,
      weeklyHoursCap: 48,
      recommendedWeeklyHoursCap: 40,
      weeklyHoursRuleLevel: "hard",
      maxShiftsPerDay: 1,
      maxShiftsPerDayRuleLevel: "warning",
      minRestHoursBetweenShifts: 10,
      minRestRuleLevel: "warning",
      maxConsecutiveWorkingDays: 6,
      hardMaxConsecutiveWorkingDays: 7,
      consecutiveDaysRuleLevel: "hard",
      allowManagerOverride: true,
      overrideRequiresReason: true,
    },
    scoringWeights: {
      roleFit: 20,
      availabilityFit: 15,
      workloadBalance: 15,
      fairness: 10,
      performance: 10,
      employmentTypeFit: 10,
      costEfficiency: 5,
      reliability: 5,
      fatiguePenalty: 20,
      overtimePenalty: 15,
      ruleRiskPenalty: 30,
    },
    mandatoryShiftRoles: ["server", "cook", "cashier"],
    availabilityRegistrationPolicy: { ...DEFAULT_AVAILABILITY_REGISTRATION_POLICY },
    schedulingOperationalStartAt: null,
    firstWeekGracePolicy: {
      enabled: true,
      strategy: "availability_warning_only",
      appliedUntil: null,
    },
  };
}
export function startOfWeekMonday(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}
export function endOfWeekMonday(value) {
  const end = startOfWeekMonday(value);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}
export function isFirstOperationalWeek(policy, targetDate = new Date()) {
  if (!policy?.schedulingOperationalStartAt) return { active: false, reason: "missing_start_at", weekStart: null, weekEnd: null };
  if (policy?.firstWeekGracePolicy?.enabled === false) return { active: false, reason: "grace_disabled", weekStart: null, weekEnd: null };
  const weekStart = startOfWeekMonday(policy.schedulingOperationalStartAt);
  const weekEnd = endOfWeekMonday(policy.schedulingOperationalStartAt);
  const target = new Date(targetDate);
  const appliedUntil = policy?.firstWeekGracePolicy?.appliedUntil ? new Date(policy.firstWeekGracePolicy.appliedUntil) : null;
  const inside = target >= weekStart && target <= weekEnd;
  const withinAppliedUntil = !appliedUntil || target <= appliedUntil;
  return { active: inside && withinAppliedUntil, weekStart, weekEnd, reason: inside ? (withinAppliedUntil ? "active" : "beyond_applied_until") : "outside_week" };
}

function validateDayOfWeek(fieldName, value) {
  if (!DAY_OF_WEEK_VALUES.includes(value)) {
    throw new Error(
      `${fieldName} không hợp lệ. Chỉ chấp nhận: ${DAY_OF_WEEK_VALUES.join(" | ")}.`,
    );
  }
}

function validateTime(fieldName, value) {
  if (!TIME_REGEX.test(value)) {
    throw new Error(`${fieldName} không hợp lệ. Định dạng phải là HH:mm.`);
  }
}

function sanitizeAvailabilityRegistrationPolicy(input = {}) {
  const merged = {
    ...DEFAULT_AVAILABILITY_REGISTRATION_POLICY,
    ...input,
  };

  const normalizedEmploymentTypes = Array.isArray(merged.targetEmploymentTypes)
    ? Array.from(
        new Set(
          merged.targetEmploymentTypes
            .map((type) => String(type || "").trim().toLowerCase())
            .filter(Boolean),
        ),
      )
    : [...DEFAULT_AVAILABILITY_REGISTRATION_POLICY.targetEmploymentTypes];

  if (
    normalizedEmploymentTypes.some(
      (type) => !EMPLOYMENT_TYPE_VALUES.includes(type),
    )
  ) {
    throw new Error(
      `targetEmploymentTypes không hợp lệ. Chỉ chấp nhận: ${EMPLOYMENT_TYPE_VALUES.join(", ")}.`,
    );
  }

  validateDayOfWeek("openDayOfWeek", String(merged.openDayOfWeek || "").toUpperCase());
  validateDayOfWeek("closeDayOfWeek", String(merged.closeDayOfWeek || "").toUpperCase());
  validateDayOfWeek(
    "publishTargetDayOfWeek",
    String(merged.publishTargetDayOfWeek || "").toUpperCase(),
  );

  validateTime("openTime", String(merged.openTime || ""));
  validateTime("closeTime", String(merged.closeTime || ""));
  validateTime("publishTargetTime", String(merged.publishTargetTime || ""));
  validateTime("availabilityOpenTime", String(merged.availabilityOpenTime || ""));
  validateTime("availabilityCloseTime", String(merged.availabilityCloseTime || ""));
  const mode = String(merged.availabilityRegistrationMode || "manual").toLowerCase();
  if (!["auto", "manual"].includes(mode)) throw new Error("availabilityRegistrationMode không hợp lệ.");

  return {
    enabled: merged.enabled !== false,
    availabilityRegistrationMode: mode,
    availabilityOpenDayOffset: Number(merged.availabilityOpenDayOffset),
    availabilityOpenTime: String(merged.availabilityOpenTime),
    availabilityCloseDayOffset: Number(merged.availabilityCloseDayOffset),
    availabilityCloseTime: String(merged.availabilityCloseTime),
    targetEmploymentTypes: normalizedEmploymentTypes.length
      ? normalizedEmploymentTypes
      : [...DEFAULT_AVAILABILITY_REGISTRATION_POLICY.targetEmploymentTypes],
    openDayOfWeek: String(merged.openDayOfWeek).toUpperCase(),
    openTime: String(merged.openTime),
    closeDayOfWeek: String(merged.closeDayOfWeek).toUpperCase(),
    closeTime: String(merged.closeTime),
    publishTargetDayOfWeek: String(merged.publishTargetDayOfWeek).toUpperCase(),
    publishTargetTime: String(merged.publishTargetTime),
    timezone: String(merged.timezone || DEFAULT_AVAILABILITY_REGISTRATION_POLICY.timezone),
    allowFullTimeUnavailableException: Boolean(
      merged.allowFullTimeUnavailableException,
    ),
    lateChangeRequiresApproval: Boolean(merged.lateChangeRequiresApproval),
    treatMissingPartTimeSubmissionAsUnavailable: Boolean(
      merged.treatMissingPartTimeSubmissionAsUnavailable,
    ),
    autoCreateWindow: Boolean(merged.autoCreateWindow),
  };
}

export async function getSchedulingPolicy({ restaurantId }) {
  const rid = toObjectId(restaurantId);
  if (!rid) {
    throw new Error("restaurantId không hợp lệ.");
  }

  let policy = await SchedulingPolicy.findOne({ restaurantId: rid });

  if (!policy) {
    policy = await SchedulingPolicy.create(
      getDefaultSchedulingPolicyPayload(rid),
    );
  }

  return mapSchedulingPolicy(policy);
}

export async function updateSchedulingPolicy({ restaurantId, input, ctx }) {
  const rid = toObjectId(restaurantId || input?.restaurantId);
  if (!rid) {
    throw new Error("restaurantId không hợp lệ.");
  }

  const actorId = toObjectId(ctx?.user?.id || ctx?.user?._id);

  const payload = {};

  if (Array.isArray(input.shiftTemplates)) {
    payload.shiftTemplates = input.shiftTemplates.map((item) => ({
      key: String(item.key || "").toLowerCase(),
      label: String(item.label || ""),
      startTime: String(item.startTime || ""),
      endTime: String(item.endTime || ""),
      enabled: item.enabled !== false,
      allowCrossDay: Boolean(item.allowCrossDay),
    }));
  }

  if (input.laborRules) {
    payload.laborRules = input.laborRules;
  }

  if (input.scoringWeights) {
    payload.scoringWeights = input.scoringWeights;
  }

  if (input.employmentTypePolicy) {
    payload.employmentTypePolicy = input.employmentTypePolicy;
  }
  if (input.availabilityRegistrationPolicy) {
    payload.availabilityRegistrationPolicy = sanitizeAvailabilityRegistrationPolicy(
      input.availabilityRegistrationPolicy,
    );
  }
  if (Array.isArray(input.mandatoryShiftRoles)) {
    payload.mandatoryShiftRoles = Array.from(
      new Set(
        input.mandatoryShiftRoles
          .map((role) => String(role || "").trim().toLowerCase())
          .filter((role) => AUTO_REQUIRED_ROLE_VALUES.includes(role)),
      ),
    );
  }
  if (input.schedulingOperationalStartAt !== undefined) {
    payload.schedulingOperationalStartAt = input.schedulingOperationalStartAt || null;
  }
  if (input.firstWeekGracePolicy) {
    payload.firstWeekGracePolicy = {
      enabled: input.firstWeekGracePolicy.enabled !== false,
      strategy: "availability_warning_only",
      appliedUntil: input.firstWeekGracePolicy.appliedUntil || null,
    };
  }

  if (actorId) {
    payload.updatedBy = actorId;
  }

  const insertDefaults = getDefaultSchedulingPolicyPayload(rid);

  Object.keys(payload).forEach((key) => {
    delete insertDefaults[key];
  });

  const policy = await SchedulingPolicy.findOneAndUpdate(
    { restaurantId: rid },
    {
      $setOnInsert: insertDefaults,
      $set: payload,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  return mapSchedulingPolicy(policy);
}

export function mapSchedulingPolicy(policy) {
  if (!policy) return null;

  return {
    id: String(policy._id),
    restaurantId: String(policy.restaurantId),

    shiftTemplates: (policy.shiftTemplates || []).map((item) => ({
      key: item.key,
      label: item.label,
      startTime: item.startTime,
      endTime: item.endTime,
      enabled: Boolean(item.enabled),
      allowCrossDay: Boolean(item.allowCrossDay),
    })),

    laborRules: {
      respectWorkingDays: Boolean(policy.laborRules?.respectWorkingDays),
      workingDaysRuleLevel: policy.laborRules?.workingDaysRuleLevel || "hard",

      respectLeaveRequests: Boolean(policy.laborRules?.respectLeaveRequests),
      leaveConflictRuleLevel:
        policy.laborRules?.leaveConflictRuleLevel || "hard",

      preventShiftOverlap: Boolean(policy.laborRules?.preventShiftOverlap),

      weeklyHoursCap: Number(policy.laborRules?.weeklyHoursCap || 48),
      recommendedWeeklyHoursCap: Number(
        policy.laborRules?.recommendedWeeklyHoursCap || 40,
      ),
      weeklyHoursRuleLevel: policy.laborRules?.weeklyHoursRuleLevel || "hard",

      maxShiftsPerDay: Number(policy.laborRules?.maxShiftsPerDay || 1),
      maxShiftsPerDayRuleLevel:
        policy.laborRules?.maxShiftsPerDayRuleLevel || "warning",

      minRestHoursBetweenShifts: Number(
        policy.laborRules?.minRestHoursBetweenShifts || 10,
      ),
      minRestRuleLevel: policy.laborRules?.minRestRuleLevel || "warning",

      maxConsecutiveWorkingDays: Number(
        policy.laborRules?.maxConsecutiveWorkingDays || 6,
      ),
      hardMaxConsecutiveWorkingDays: Number(
        policy.laborRules?.hardMaxConsecutiveWorkingDays || 7,
      ),
      consecutiveDaysRuleLevel:
        policy.laborRules?.consecutiveDaysRuleLevel || "hard",

      allowManagerOverride: Boolean(policy.laborRules?.allowManagerOverride),
      overrideRequiresReason: Boolean(
        policy.laborRules?.overrideRequiresReason,
      ),
    },

    scoringWeights: {
      roleFit: Number(policy.scoringWeights?.roleFit || 20),
      availabilityFit: Number(policy.scoringWeights?.availabilityFit || 15),
      workloadBalance: Number(policy.scoringWeights?.workloadBalance || 15),
      fairness: Number(policy.scoringWeights?.fairness || 10),
      performance: Number(policy.scoringWeights?.performance || 10),
      employmentTypeFit: Number(policy.scoringWeights?.employmentTypeFit || 10),
      costEfficiency: Number(policy.scoringWeights?.costEfficiency || 5),
      reliability: Number(policy.scoringWeights?.reliability || 5),
      fatiguePenalty: Number(policy.scoringWeights?.fatiguePenalty || 20),
      overtimePenalty: Number(policy.scoringWeights?.overtimePenalty || 15),
      ruleRiskPenalty: Number(policy.scoringWeights?.ruleRiskPenalty || 30),
    },

    employmentTypePolicy: policy.employmentTypePolicy || {},
    availabilityRegistrationPolicy: sanitizeAvailabilityRegistrationPolicy(
      policy.availabilityRegistrationPolicy || {},
    ),
    schedulingOperationalStartAt: policy.schedulingOperationalStartAt || null,
    firstWeekGracePolicy: {
      enabled: policy.firstWeekGracePolicy?.enabled !== false,
      strategy:
        policy.firstWeekGracePolicy?.strategy || "availability_warning_only",
      appliedUntil: policy.firstWeekGracePolicy?.appliedUntil || null,
    },
    mandatoryShiftRoles:
      Array.isArray(policy.mandatoryShiftRoles) &&
      policy.mandatoryShiftRoles.length
        ? policy.mandatoryShiftRoles
        : ["server", "cook", "cashier"],

    updatedAt: policy.updatedAt,
    createdAt: policy.createdAt,
  };
}
export async function startSchedulingOperations({ restaurantId, ctx }) {
  const rid = toObjectId(restaurantId);
  if (!rid) throw new Error("restaurantId không hợp lệ.");
  const existing = await SchedulingPolicy.findOne({ restaurantId: rid });
  if (existing?.schedulingOperationalStartAt) return mapSchedulingPolicy(existing);
  const now = new Date();
  const appliedUntil = endOfWeekMonday(now);
  const policy = await SchedulingPolicy.findOneAndUpdate(
    { restaurantId: rid },
    {
      $setOnInsert: getDefaultSchedulingPolicyPayload(rid),
      $set: {
        schedulingOperationalStartAt: now,
        firstWeekGracePolicy: {
          enabled: true,
          strategy: "availability_warning_only",
          appliedUntil,
        },
        ...(ctx?.user?.id || ctx?.user?._id ? { updatedBy: toObjectId(ctx.user.id || ctx.user._id) } : {}),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return mapSchedulingPolicy(policy);
}
