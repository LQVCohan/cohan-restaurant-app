import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const overtimeLimitSchema = new Schema(
  {
    maxMinutesPerDay: {
      type: Number,
      default: 120,
      min: 0,
      max: 1440,
    },
  },
  { _id: false },
);

const performanceLevelThresholdsSchema = new Schema(
  {
    excellentMin: { type: Number, default: 90, min: 0, max: 100 },
    goodMin: { type: Number, default: 80, min: 0, max: 100 },
    averageMin: { type: Number, default: 65, min: 0, max: 100 },
    needsAttentionMin: { type: Number, default: 50, min: 0, max: 100 },
  },
  { _id: false },
);

const SystemSettingSchema = new Schema(
  {
    restaurantId: {
      type: Types.ObjectId,
      ref: "Restaurant",
      required: true,
      unique: true,
    },
    timezone: {
      type: String,
      default: "Asia/Ho_Chi_Minh",
      trim: true,
      validate: {
        validator: (value) =>
          typeof value === "string" && value.trim().length > 0,
        message: "timezone must be a non-empty string",
      },
    },
    currency: {
      type: String,
      default: "VND",
      trim: true,
      validate: {
        validator: (value) =>
          typeof value === "string" && value.trim().length > 0,
        message: "currency must be a non-empty string",
      },
    },
    dateFormat: {
      type: String,
      default: "DD/MM/YYYY",
      trim: true,
      validate: {
        validator: (value) =>
          typeof value === "string" && value.trim().length > 0,
        message: "dateFormat must be a non-empty string",
      },
    },
    operational: {
      businessDayStartHour: {
        type: Number,
        default: 5,
        min: 0,
        max: 23,
      },
      defaultLanguage: {
        type: String,
        default: "vi",
        trim: true,
      },
    },
    modules: {
      scheduling: { type: Boolean, default: true },
      rbac: { type: Boolean, default: true },
      printing: { type: Boolean, default: true },
      backup: { type: Boolean, default: true },
    },
    overtimePolicy: {
      enabled: { type: Boolean, default: true },
      defaultMaxMinutesPerDay: {
        type: Number,
        default: 120,
        min: 0,
        max: 1440,
      },
      roleGroupLimits: {
        service: {
          type: overtimeLimitSchema,
          default: () => ({ maxMinutesPerDay: 120 }),
        },
        kitchen: {
          type: overtimeLimitSchema,
          default: () => ({ maxMinutesPerDay: 180 }),
        },
        shiftManager: {
          type: overtimeLimitSchema,
          default: () => ({ maxMinutesPerDay: 240 }),
        },
      },
    },
    performancePolicy: {
      levelThresholds: {
        type: performanceLevelThresholdsSchema,
        default: () => ({
          excellentMin: 90,
          goodMin: 80,
          averageMin: 65,
          needsAttentionMin: 50,
        }),
      },
    },
    metadata: {
      note: { type: String, default: "" },
      version: { type: Number, default: 1 },
    },
    updatedBy: {
      type: Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

export default mongoose.models.SystemSetting ||
  mongoose.model("SystemSetting", SystemSettingSchema);
