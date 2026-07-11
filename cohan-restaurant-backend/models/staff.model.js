import mongoose from "mongoose";
import User from "./user.model.js";

const staffSchema = new mongoose.Schema(
  {
    employeeCode: {
      type: String,
      trim: true,
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
        "inventory",
        "bar",
      ],
    },

    baseSalary: { type: Number, default: 0, min: 0 },

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

    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["male", "female", "other", "unspecified"], default: "unspecified" },
    nationalId: { type: String, trim: true },
    nationalIdIssuedAt: { type: Date },
    nationalIdIssuedPlace: { type: String, trim: true },
    maritalStatus: { type: String, enum: ["single", "married", "divorced", "widowed", "unspecified"], default: "unspecified" },
    permanentAddress: { type: String, trim: true },
    temporaryAddress: { type: String, trim: true },
    contractCode: { type: String, trim: true },
    contractType: { type: String, enum: ["none", "probation", "fixed_term", "indefinite", "seasonal", "service"], default: "none" },
    contractStartDate: { type: Date },
    contractEndDate: { type: Date },
    probationEndDate: { type: Date },
    officialStartDate: { type: Date },
    terminationReason: { type: String, trim: true },
    salaryType: { type: String, enum: ["monthly", "hourly", "shift", "commission"], default: "monthly" },
    hourlyRate: { type: Number, min: 0 },
    commissionRate: { type: Number, min: 0, max: 100 },
    allowanceAmount: { type: Number, min: 0 },
    bankName: { type: String, trim: true },
    bankAccountNumber: { type: String, trim: true },
    bankAccountHolder: { type: String, trim: true },
    socialInsuranceNumber: { type: String, trim: true },
    healthInsuranceNumber: { type: String, trim: true },
    unemploymentInsuranceNumber: { type: String, trim: true },
    insuranceEligible: { type: Boolean, default: false },
    insuranceStartDate: { type: Date },
    educationLevel: { type: String, trim: true },
    certifications: [{ name: String, issuedBy: String, issuedAt: Date, expiresAt: Date, fileUrl: String }],
    skills: [{ type: String, trim: true }],
    languages: [{ name: String, level: String }],
    uniformSize: { type: String, trim: true },
    deviceIds: [{ type: String, trim: true }],
    accessCardCode: { type: String, trim: true },
    trainingStatus: { type: String, enum: ["not_started", "in_progress", "completed", "expired"], default: "not_started" },
    lastTrainingAt: { type: Date },
    nextTrainingDueAt: { type: Date },


    emergencyContacts: [{ name: String, phone: String, relation: String, address: String, isPrimary: Boolean }],
  }
);


export const Staff =
  mongoose.models.Staff || User.discriminator("Staff", staffSchema, "STAFF");
export default Staff;
