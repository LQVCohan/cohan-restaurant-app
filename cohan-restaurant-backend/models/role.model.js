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
    index: true,
  },
  description: { type: String },

  permissions: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Permission", index: true },
  ],
  parent: { type: String, trim: true, lowercase: true },
  isSystem: { type: Boolean, default: false },
});

export const Role = mongoose.models.Role || mongoose.model("Role", roleSchema);
export default Role;
