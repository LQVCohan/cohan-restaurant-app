import mongoose from "mongoose";
import { SchedulingPolicy } from "../../../models/index.js";

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

    updatedAt: policy.updatedAt,
    createdAt: policy.createdAt,
  };
}
