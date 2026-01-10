import mongoose from "mongoose";
import User from "./user.model.js";

const staffSchema = new mongoose.Schema(
  {
    employeeCode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    // ⭐ Chuyên khoa / bộ phận của nhân viên
    department: {
      type: String,
      enum: [
        "service",
        "kitchen",
        "cashier",
        "management",
        "cleaning",
        "delivery",
      ],
    },

    rate: { type: Number, default: 0 },
    rateCount: { type: Number, default: 0 },

    positionTitle: {
      type: String,
      trim: true,
    },

    employmentType: {
      type: String,
      enum: ["full_time", "part_time", "probation", "seasonal", "contract"],
      default: "full_time",
    },

    employmentStatus: {
      type: String,
      enum: ["working", "on_leave", "resigned", "suspended"],
      default: "working",
    },

    primaryRestaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
    },

    shiftType: {
      type: String,
      enum: ["morning", "afternoon", "evening", "full_day", "rotating"],
    },

    workingDays: [
      {
        type: String,
        enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      },
    ],

    dateJoined: { type: Date },
    dateLeft: { type: Date, default: null },

    noteInternal: { type: String, trim: true },

    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relation: { type: String, trim: true },
    },
  }
);

staffSchema.index({ employeeCode: 1 });
staffSchema.index({ userType: 1, employmentStatus: 1, primaryRestaurant: 1 });

export const Staff =
  mongoose.models.Staff || User.discriminator("Staff", staffSchema, "STAFF");
export default Staff;
