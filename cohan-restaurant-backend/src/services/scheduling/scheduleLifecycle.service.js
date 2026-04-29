export const SCHEDULE_LIFECYCLE_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ACTIVE: "active",
  LOCKED: "locked",
  CLOSED: "closed",
};

export function resolveScheduleLifecycleStatus({
  publication,
  periodStart,
  periodEnd,
  now = new Date(),
}) {
  const storedStatus = String(publication?.status || "draft").toLowerCase();

  if (storedStatus === "locked") return "locked";
  if (storedStatus === "closed") return "closed";

  const start = periodStart ? new Date(periodStart) : null;
  const end = periodEnd ? new Date(periodEnd) : null;

  const validStart = start && !Number.isNaN(start.getTime());
  const validEnd = end && !Number.isNaN(end.getTime());

  if (validStart && validEnd && now >= start && now <= end) {
    if (storedStatus === "published" || storedStatus === "active") {
      return "active";
    }
  }

  if (validEnd && now > end) {
    if (storedStatus === "published" || storedStatus === "active") {
      return "closed";
    }
  }

  if (storedStatus === "active") return "active";
  if (storedStatus === "published") return "published";

  return "draft";
}

export function getScheduleLifecyclePermissions(effectiveStatus) {
  const status = String(effectiveStatus || "draft").toLowerCase();

  return {
    canPublish: status === "draft",
    canApplyAutoSchedule: status === "draft",
    canEditDraftSchedule: status === "draft",
    canMakePublishedChange: status === "published",
    canChangeShiftTime: status === "published",
    canAddStaffToShift: status === "draft" || status === "published",
    canRemoveStaffFromShift: status === "draft" || status === "published",
    canDeleteShiftGroup: status === "draft" || status === "published",
    requiresChangeReason: status === "published",
    requiresEmployeeNotification: status === "published",
    isReadOnly: ["active", "locked", "closed"].includes(status),
  };
}

export function mapSchedulePublicationOutput(doc) {
  if (!doc) return null;
  const raw = typeof doc.toObject === "function" ? doc.toObject() : doc;

  const effectiveStatus = resolveScheduleLifecycleStatus({
    publication: raw,
    periodStart: raw.periodStart,
    periodEnd: raw.periodEnd,
  });

  const permissions = getScheduleLifecyclePermissions(effectiveStatus);

  return {
    id: String(raw._id),
    restaurantId: String(raw.restaurantId),
    periodStart: raw.periodStart,
    periodEnd: raw.periodEnd,
    status: raw.status || "draft",
    effectiveStatus,
    publishedAt: raw.publishedAt || null,
    publishedBy: raw.publishedBy ? String(raw.publishedBy) : null,
    activatedAt: raw.activatedAt || null,
    lockedAt: raw.lockedAt || null,
    lockedBy: raw.lockedBy ? String(raw.lockedBy) : null,
    lockReason: raw.lockReason || "",
    closedAt: raw.closedAt || null,
    closedBy: raw.closedBy ? String(raw.closedBy) : null,
    closeReason: raw.closeReason || "",
    reminderSentAt: raw.reminderSentAt || null,
    lastChangedAt: raw.lastChangedAt || null,
    permissions,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
}
