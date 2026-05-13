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
  isSystem: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
});

function normalizePermission(doc) {
  if (!doc) return;
  if (doc.code) doc.code = String(doc.code).trim().toLowerCase();
  if (doc.resource) doc.resource = String(doc.resource).trim().toLowerCase();
  if (doc.action) doc.action = String(doc.action).trim().toLowerCase();
  if (doc.group) doc.group = String(doc.group).trim().toLowerCase();
  if (!doc.code && doc.resource && doc.action) doc.code = `${doc.resource}.${doc.action}`;
}

permissionSchema.pre("validate", function (next) {
  normalizePermission(this);
  next();
});

permissionSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const target = update.$set || update;
  normalizePermission(target);
  next();
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
