import { GraphQLDateTime, GraphQLJSON } from "graphql-scalars";

export default {
  DateTime: GraphQLDateTime,
  JSON: GraphQLJSON,

  EmploymentType: {
    FULL_TIME: "full_time",
    PART_TIME: "part_time",
    PROBATION: "probation",
    SEASONAL: "seasonal",
    CONTRACT: "contract",
  },

  EmploymentStatus: {
    WORKING: "working",
    ON_LEAVE: "on_leave",
    RESIGNED: "resigned",
    SUSPENDED: "suspended",
  },

  ShiftType: {
    MORNING: "morning",
    AFTERNOON: "afternoon",
    EVENING: "evening",
    FULL_DAY: "full_day",
    ROTATING: "rotating",
  },

  StaffWorkingDay: {
    MON: "mon",
    TUE: "tue",
    WED: "wed",
    THU: "thu",
    FRI: "fri",
    SAT: "sat",
    SUN: "sun",
  },

  StaffGender: {
    MALE: "male",
    FEMALE: "female",
    OTHER: "other",
    UNSPECIFIED: "unspecified",
  },

  MaritalStatus: {
    SINGLE: "single",
    MARRIED: "married",
    DIVORCED: "divorced",
    WIDOWED: "widowed",
    UNSPECIFIED: "unspecified",
  },

  StaffContractType: {
    NONE: "none",
    PROBATION: "probation",
    FIXED_TERM: "fixed_term",
    INDEFINITE: "indefinite",
    SEASONAL: "seasonal",
    SERVICE: "service",
  },

  StaffSalaryType: {
    MONTHLY: "monthly",
    HOURLY: "hourly",
    SHIFT: "shift",
    COMMISSION: "commission",
  },

  StaffTrainingStatus: {
    NOT_STARTED: "not_started",
    IN_PROGRESS: "in_progress",
    COMPLETED: "completed",
    EXPIRED: "expired",
  },

  Query: {
    _empty: () => "ok",
  },

  Mutation: {
    _empty: () => "ok",
  },
};
