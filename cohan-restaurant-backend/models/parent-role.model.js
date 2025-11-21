import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const parentRoleSchema = BaseSchemaModel({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
  },

  // Danh sách permission _id
  permissionIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Permission",
    },
  ],
});

// Index để tối ưu query theo slug
parentRoleSchema.index({ slug: 1 }, { unique: true });

// Export model
export const ParentRole =
  mongoose.models.ParentRole || mongoose.model("ParentRole", parentRoleSchema);

export default ParentRole;
