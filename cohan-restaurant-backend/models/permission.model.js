import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const PermissionSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    description: String,
  },
  baseOptions
);

PermissionSchema.index({ action: 1, resource: 1 }, { unique: true });

export default mongoose.model("Permission", PermissionSchema);
