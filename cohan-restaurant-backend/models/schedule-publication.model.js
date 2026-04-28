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
      enum: ["draft", "published", "locked"],
      default: "draft",
      index: true,
    },

    publishedAt: Date,
    publishedBy: {
      type: Types.ObjectId,
      ref: "User",
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
