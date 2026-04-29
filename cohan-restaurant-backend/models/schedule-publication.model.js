import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const SchedulePublicationSchema = new Schema(
  {
    restaurantId: {
      type: Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },

    periodStart: {
      type: Date,
      required: true,
      index: true,
    },

    periodEnd: {
      type: Date,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["draft", "revision_draft", "published", "active", "locked", "closed"],
      default: "draft",
      index: true,
    },

    publishedAt: Date,
    publishedBy: {
      type: Types.ObjectId,
      ref: "User",
    },


    activatedAt: Date,

    lockedAt: Date,
    lockedBy: {
      type: Types.ObjectId,
      ref: "User",
    },
    lockReason: String,

    closedAt: Date,
    closedBy: {
      type: Types.ObjectId,
      ref: "User",
    },
    closeReason: String,

    reopenedAt: Date,
    reopenedBy: {
      type: Types.ObjectId,
      ref: "User",
    },
    reopenReason: String,
    reopenCount: {
      type: Number,
      default: 0,
    },

    reminderSentAt: Date,

    lastChangedAt: Date,
  },
  { timestamps: true },
);

SchedulePublicationSchema.index(
  { restaurantId: 1, periodStart: 1, periodEnd: 1 },
  { unique: true },
);

export default mongoose.model("SchedulePublication", SchedulePublicationSchema);
