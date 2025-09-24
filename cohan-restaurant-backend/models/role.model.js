import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const RoleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: String,
    permissions: [{ type: Types.ObjectId, ref: "Permission" }],
    ownerId: { type: Types.ObjectId, ref: "User" },
  },
  baseOptions
);

export default mongoose.model("Role", RoleSchema);
