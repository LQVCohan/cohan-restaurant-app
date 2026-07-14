import mongoose from "mongoose";

const { Schema, Types } = mongoose;

export const SCHEDULE_PUBLICATION_POINT_LOOKUP_SORT = Object.freeze({
  periodStart: -1,
  periodEnd: 1,
  updatedAt: -1,
});

export function isSchedulePublicationPointLookup(filter = {}) {
  const periodStart = filter?.periodStart;
  const periodEnd = filter?.periodEnd;

  return Boolean(
    periodStart &&
      typeof periodStart === "object" &&
      Object.prototype.hasOwnProperty.call(periodStart, "$lte") &&
      periodEnd &&
      typeof periodEnd === "object" &&
      Object.prototype.hasOwnProperty.call(periodEnd, "$gte"),
  );
}

export function applySchedulePublicationPointLookupSort(query) {
  const filter = query?.getFilter?.() || query?.getQuery?.() || {};
  const options = query?.getOptions?.() || {};

  if (!isSchedulePublicationPointLookup(filter) || options.sort) return false;

  query.sort(SCHEDULE_PUBLICATION_POINT_LOOKUP_SORT);
  return true;
}

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

// Point-in-time lookups can match more than one overlapping publication window.
// Prefer the most specific/current window instead of relying on MongoDB's
// undefined findOne ordering, which could incorrectly select a published week
// while the manager is editing the draft week shown in the UI.
SchedulePublicationSchema.pre("findOne", function prioritizeContainingWindow() {
  applySchedulePublicationPointLookupSort(this);
});

SchedulePublicationSchema.index(
  { restaurantId: 1, periodStart: 1, periodEnd: 1 },
  { unique: true },
);

export default mongoose.model("SchedulePublication", SchedulePublicationSchema);
