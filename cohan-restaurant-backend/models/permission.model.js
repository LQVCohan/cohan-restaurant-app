// src/models/Permission.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const permissionSchema = BaseSchemaModel({
  code: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
  },
  action: { type: String, trim: true, lowercase: true, required: true },
  resource: { type: String, trim: true, lowercase: true, required: true },
  name: { type: String, required: true, trim: true },

  description: { type: String, trim: true },

  group: { type: String, trim: true, lowercase: true }, // ví dụ: "restaurant", "order", "user"
});
permissionSchema.index(
  { action: 1, resource: 1 },
  {
    unique: true,
    partialFilterExpression: {
      action: { $type: "string" },
      resource: { $type: "string" },
    },
  }
);
export const Permission =
  mongoose.models.Permission || mongoose.model("Permission", permissionSchema);
export default Permission;
