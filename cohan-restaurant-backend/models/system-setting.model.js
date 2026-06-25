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

const SystemSettingSchema = new Schema(
  {
    restaurantId: {
      type: Types.ObjectId,
      ref: "Restaurant",
      required: true,
      unique: true,
      index: true,
    },
    timezone: {
      type: String,
      default: "Asia/Ho_Chi_Minh",
      trim: true,
      validate: {
        validator: (value) => typeof value === "string" && value.trim().length > 0,
        message: "timezone must be a non-empty string",
      },
    },
    currency: {
      type: String,
      default: "VND",
      trim: true,
      validate: {
        validator: (value) => typeof value === "string" && value.trim().length > 0,
        message: "currency must be a non-empty string",
      },
    },
    dateFormat: {
      type: String,
      default: "DD/MM/YYYY",
      trim: true,
      validate: {
        validator: (value) => typeof value === "string" && value.trim().length > 0,
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
        service: { type: overtimeLimitSchema, default: () => ({ maxMinutesPerDay: 120 }) },
        kitchen: { type: overtimeLimitSchema, default: () => ({ maxMinutesPerDay: 180 }) },
        shiftManager: { type: overtimeLimitSchema, default: () => ({ maxMinutesPerDay: 240 }) },
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
  { timestamps: true }
);

SystemSettingSchema.index({ restaurantId: 1 }, { unique: true });

export default mongoose.models.SystemSetting || mongoose.model("SystemSetting", SystemSettingSchema);
