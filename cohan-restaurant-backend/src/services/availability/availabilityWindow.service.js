import { AvailabilityWindow, StaffAvailabilitySubmission, Staff } from "../../../models/index.js";

export async function createOrGetAvailabilityWindow(input, userId = null) {
  const payload = { ...input };
  try {
    return await AvailabilityWindow.create({ ...payload, createdBy: userId || payload.createdBy || null });
  } catch (error) {
    if (error?.code === 11000) {
      return AvailabilityWindow.findOne({ restaurantId: payload.restaurantId, periodStart: payload.periodStart, periodEnd: payload.periodEnd });
    }
    throw error;
  }
}

export function isAvailabilityWindowOpen(windowDoc, now = new Date()) {
  if (!windowDoc) return false;
  return windowDoc.status === "open" && new Date(windowDoc.openAt) <= now && now <= new Date(windowDoc.closeAt);
}

export async function getSubmissionStateForEmployee({ windowDoc, employeeId, now = new Date() }) {
  const submission = await StaffAvailabilitySubmission.findOne({ availabilityWindowId: windowDoc._id, employeeId });
  if (submission) return submission.status;
  if (windowDoc.status === "closed" || now > new Date(windowDoc.closeAt)) return "unavailable";
  return "pending_submission";
}

export async function lockSubmissionsForClosedWindow(windowId, lockedAt = new Date()) {
  return StaffAvailabilitySubmission.updateMany(
    { availabilityWindowId: windowId, status: { $in: ["submitted", "approved", "rejected", "late_change_requested"] } },
    { $set: { status: "locked", lockedAt } },
  );
}

export async function getStaffEmploymentType(employeeId) {
  const staff = await Staff.findById(employeeId).select("employmentType");
  return staff?.employmentType || null;
}
