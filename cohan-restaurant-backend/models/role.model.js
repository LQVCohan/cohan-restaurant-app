import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const roleSchema = BaseSchemaModel({
  name: { type: String, required: true, trim: true },
  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
  },
  description: { type: String },
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
    default: null,
  },

  permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Permission" }],
  parentRole: { type: mongoose.Schema.Types.ObjectId, ref: "ParentRole" },
  isSystem: { type: Boolean, default: false },
});

export const Role = mongoose.models.Role || mongoose.model("Role", roleSchema);
export default Role;
