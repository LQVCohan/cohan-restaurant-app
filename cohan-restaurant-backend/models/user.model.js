import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      trim: true,
      index: true,
      unique: true,
      sparse: true,
    },
    passwordHash: String,
    roles: [{ type: Types.ObjectId, ref: "Role" }],
    status: {
      type: String,
      enum: ["active", "inactive", "blocked"],
      default: "active",
    },
    provider: {
      type: String,
      enum: ["local", "google", "facebook"],
      default: "local",
    },
    restaurants: [{ type: Types.ObjectId, ref: "Restaurant" }],
    managerOf: [{ type: Types.ObjectId, ref: "Restaurant" }],
  },
  baseOptions
);

export default mongoose.model("User", UserSchema);
