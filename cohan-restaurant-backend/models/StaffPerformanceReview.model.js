import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const StaffPerformanceReviewSchema = new Schema(
  {
    employeeId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    restaurantId: {
      type: Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },

    periodStart: {
      type: Date,
      required: true,
      index: true,
    },
    periodEnd: {
      type: Date,
      required: true,
      index: true,
    },

    managerRatingScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 75,
    },

    attitudeScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 75,
    },

    teamworkScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 75,
    },

    skillScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 75,
    },

    note: {
      type: String,
      default: "",
      trim: true,
    },

    reviewedBy: {
      type: Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedByName: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

StaffPerformanceReviewSchema.index(
  {
    employeeId: 1,
    restaurantId: 1,
    periodStart: 1,
    periodEnd: 1,
  },
  {
    unique: true,
    name: "uniq_staff_performance_review_period",
  },
);

export default mongoose.model(
  "StaffPerformanceReview",
  StaffPerformanceReviewSchema,
);
