import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const StaffPerformanceComponentSchema = new Schema(
  {
    score: { type: Number, min: 0, max: 100, default: 75 },
    weight: { type: Number, min: 0, max: 100, default: 0 },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const StaffPerformanceSnapshotSchema = new Schema(
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

    productivity: {
      type: StaffPerformanceComponentSchema,
      default: () => ({
        score: 75,
        weight: 25,
        note: "Năng suất làm việc trong kỳ.",
      }),
    },

    punctuality: {
      type: StaffPerformanceComponentSchema,
      default: () => ({
        score: 75,
        weight: 25,
        note: "Đúng giờ, ít đi trễ/về sớm/vắng.",
      }),
    },

    quality: {
      type: StaffPerformanceComponentSchema,
      default: () => ({
        score: 75,
        weight: 20,
        note: "Chất lượng phục vụ/vận hành.",
      }),
    },

    managerReview: {
      type: StaffPerformanceComponentSchema,
      default: () => ({
        score: 75,
        weight: 20,
        note: "Đánh giá quản lý.",
      }),
    },

    compliance: {
      type: StaffPerformanceComponentSchema,
      default: () => ({
        score: 75,
        weight: 10,
        note: "Tuân thủ quy trình, ít chỉnh công/vi phạm.",
      }),
    },

    finalPerformanceScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 75,
      index: true,
    },

    performanceLevel: {
      type: String,
      enum: ["excellent", "good", "average", "needs_attention", "poor"],
      default: "average",
      index: true,
    },

    factors: {
      type: Schema.Types.Mixed,
      default: {},
    },

    generatedBy: {
      type: Types.ObjectId,
      ref: "User",
      default: null,
    },

    generatedByName: {
      type: String,
      default: "",
    },

    reviewedBy: {
      type: Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    lockedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

StaffPerformanceSnapshotSchema.index(
  {
    employeeId: 1,
    restaurantId: 1,
    periodStart: 1,
    periodEnd: 1,
  },
  { unique: true },
);

export default mongoose.model(
  "StaffPerformanceSnapshot",
  StaffPerformanceSnapshotSchema,
);
