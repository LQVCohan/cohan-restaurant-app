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

  Query: {
    _empty: () => "ok",
  },

  Mutation: {
    _empty: () => "ok",
  },
};
