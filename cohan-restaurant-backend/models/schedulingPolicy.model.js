import mongoose from "mongoose";

const { Schema, Types } = mongoose;
const DAY_OF_WEEK_VALUES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const EMPLOYMENT_TYPE_VALUES = [
  "full_time",
  "part_time",
  "probation",
  "seasonal",
  "contract",
];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const ShiftTemplateSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    allowCrossDay: { type: Boolean, default: false },
  },
  { _id: false },
);

const SchedulingLaborRulesSchema = new Schema(
  {
    respectWorkingDays: { type: Boolean, default: true },
    workingDaysRuleLevel: {
      type: String,
      enum: ["hard", "warning", "off"],
      default: "hard",
    },

    respectLeaveRequests: { type: Boolean, default: true },
    leaveConflictRuleLevel: {
      type: String,
      enum: ["hard", "warning", "off"],
      default: "hard",
    },

    preventShiftOverlap: { type: Boolean, default: true },

    weeklyHoursCap: { type: Number, default: 48 },
    recommendedWeeklyHoursCap: { type: Number, default: 40 },
    weeklyHoursRuleLevel: {
      type: String,
      enum: ["hard", "warning", "off"],
      default: "hard",
    },

    maxShiftsPerDay: { type: Number, default: 1 },
    maxShiftsPerDayRuleLevel: {
      type: String,
      enum: ["hard", "warning", "off"],
      default: "warning",
    },

    minRestHoursBetweenShifts: { type: Number, default: 10 },
    minRestRuleLevel: {
      type: String,
      enum: ["hard", "warning", "off"],
      default: "warning",
    },

    maxConsecutiveWorkingDays: { type: Number, default: 6 },
    hardMaxConsecutiveWorkingDays: { type: Number, default: 7 },
    consecutiveDaysRuleLevel: {
      type: String,
      enum: ["hard", "warning", "off"],
      default: "hard",
    },

    allowManagerOverride: { type: Boolean, default: true },
    overrideRequiresReason: { type: Boolean, default: true },
  },
  { _id: false },
);

const SchedulingScoringWeightsSchema = new Schema(
  {
    roleFit: { type: Number, default: 20 },
    availabilityFit: { type: Number, default: 15 },
    workloadBalance: { type: Number, default: 15 },
    fairness: { type: Number, default: 10 },
    performance: { type: Number, default: 10 },
    employmentTypeFit: { type: Number, default: 10 },
    costEfficiency: { type: Number, default: 5 },
    reliability: { type: Number, default: 5 },
    fatiguePenalty: { type: Number, default: 20 },
    overtimePenalty: { type: Number, default: 15 },
    ruleRiskPenalty: { type: Number, default: 30 },
  },
  { _id: false },
);

const EmploymentTypePolicySchema = new Schema(
  {
    minWeeklyHours: { type: Number, default: 0 },
    weeklyHoursTarget: { type: Number, default: 40 },
    weeklyHoursCap: { type: Number, default: 48 },
    maxShiftsPerWeek: { type: Number, default: 6 },
    maxConsecutiveWorkingDays: { type: Number, default: 6 },
    requireAvailability: { type: Boolean, default: false },
    allowOvertime: { type: Boolean, default: true },
    avoidSoloCriticalShift: { type: Boolean, default: false },
    priorityWeight: { type: Number, default: 1 },
  },
  { _id: false },
);

const AvailabilityRegistrationPolicySchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    targetEmploymentTypes: {
      type: [String],
      enum: EMPLOYMENT_TYPE_VALUES,
      default: ["part_time", "seasonal"],
    },
    openDayOfWeek: {
      type: String,
      enum: DAY_OF_WEEK_VALUES,
      default: "MON",
    },
    openTime: {
      type: String,
      match: TIME_REGEX,
      default: "08:00",
    },
    closeDayOfWeek: {
      type: String,
      enum: DAY_OF_WEEK_VALUES,
      default: "WED",
    },
    closeTime: {
      type: String,
      match: TIME_REGEX,
      default: "22:00",
    },
    publishTargetDayOfWeek: {
      type: String,
      enum: DAY_OF_WEEK_VALUES,
      default: "FRI",
    },
    publishTargetTime: {
      type: String,
      match: TIME_REGEX,
      default: "17:00",
    },
    timezone: { type: String, default: "Asia/Ho_Chi_Minh" },
    allowFullTimeUnavailableException: { type: Boolean, default: true },
    lateChangeRequiresApproval: { type: Boolean, default: true },
    treatMissingPartTimeSubmissionAsUnavailable: { type: Boolean, default: true },
    autoCreateWindow: { type: Boolean, default: true },
  },
  { _id: false },
);

const SchedulingPolicySchema = new Schema(
  {
    restaurantId: {
      type: Types.ObjectId,
      ref: "Restaurant",
      required: true,
      unique: true,
      index: true,
    },

    shiftTemplates: {
      type: [ShiftTemplateSchema],
      default: () => [
        {
          key: "morning",
          label: "Ca sáng",
          startTime: "06:00",
          endTime: "12:00",
          enabled: true,
        },
        {
          key: "afternoon",
          label: "Ca chiều",
          startTime: "12:00",
          endTime: "18:00",
          enabled: true,
        },
        {
          key: "evening",
          label: "Ca tối",
          startTime: "18:00",
          endTime: "23:00",
          enabled: true,
        },
      ],
    },

    laborRules: {
      type: SchedulingLaborRulesSchema,
      default: () => ({}),
    },

    scoringWeights: {
      type: SchedulingScoringWeightsSchema,
      default: () => ({}),
    },
    mandatoryShiftRoles: {
      type: [String],
      default: ["server", "cook", "cashier"],
    },

    employmentTypePolicy: {
      full_time: {
        type: EmploymentTypePolicySchema,
        default: () => ({
          minWeeklyHours: 0,
          weeklyHoursTarget: 40,
          weeklyHoursCap: 48,
          maxShiftsPerWeek: 6,
          maxConsecutiveWorkingDays: 6,
          requireAvailability: false,
          allowOvertime: true,
          avoidSoloCriticalShift: false,
          priorityWeight: 1,
        }),
      },
      part_time: {
        type: EmploymentTypePolicySchema,
        default: () => ({
          minWeeklyHours: 8,
          weeklyHoursTarget: 20,
          weeklyHoursCap: 28,
          maxShiftsPerWeek: 4,
          maxConsecutiveWorkingDays: 4,
          requireAvailability: true,
          allowOvertime: false,
          avoidSoloCriticalShift: false,
          priorityWeight: 0.85,
        }),
      },
      probation: {
        type: EmploymentTypePolicySchema,
        default: () => ({
          minWeeklyHours: 0,
          weeklyHoursTarget: 40,
          weeklyHoursCap: 48,
          maxShiftsPerWeek: 6,
          maxConsecutiveWorkingDays: 6,
          requireAvailability: false,
          allowOvertime: false,
          avoidSoloCriticalShift: true,
          priorityWeight: 0.75,
        }),
      },
      seasonal: {
        type: EmploymentTypePolicySchema,
        default: () => ({
          minWeeklyHours: 0,
          weeklyHoursTarget: 24,
          weeklyHoursCap: 40,
          maxShiftsPerWeek: 5,
          maxConsecutiveWorkingDays: 5,
          requireAvailability: true,
          allowOvertime: true,
          avoidSoloCriticalShift: false,
          priorityWeight: 0.8,
        }),
      },
      contract: {
        type: EmploymentTypePolicySchema,
        default: () => ({
          minWeeklyHours: 0,
          weeklyHoursTarget: 40,
          weeklyHoursCap: 48,
          maxShiftsPerWeek: 6,
          maxConsecutiveWorkingDays: 6,
          requireAvailability: false,
          allowOvertime: true,
          avoidSoloCriticalShift: false,
          priorityWeight: 1,
        }),
      },
    },
    availabilityRegistrationPolicy: {
      type: AvailabilityRegistrationPolicySchema,
      default: () => ({}),
    },

    updatedBy: { type: Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("SchedulingPolicy", SchedulingPolicySchema);
