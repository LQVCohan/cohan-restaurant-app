// src/models/baseSchemaModel.js
import mongoose from "mongoose";
import mongooseLeanVirtuals from "mongoose-lean-virtuals";

export default function BaseSchemaModel(definition, options = {}) {
  const schema = new mongoose.Schema(definition, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    ...options,
  });

  // virtual id chung cho tất cả schema
  schema.virtual("id").get(function () {
    return this._id ? String(this._id) : null;
  });

  // hỗ trợ virtuals khi dùng .lean()
  schema.plugin(mongooseLeanVirtuals);

  return schema;
}
