import { AvailabilityRegistrationWindow, StaffAvailabilitySubmission, Staff } from "../../../models/index.js";

let workspaceIndexMigrationPromise = null;

function normalizeWorkspaceType(value) {
  const normalized = String(value || "full_time").trim().toLowerCase();
  return ["full_time", "part_time", "rotating"].includes(normalized)
    ? normalized
    : "full_time";
}

function workspaceFilter(workspaceType) {
  const normalized = normalizeWorkspaceType(workspaceType);
  if (normalized !== "full_time") return { workspaceType: normalized };
  return {
    $or: [
      { workspaceType: "full_time" },
      { workspaceType: { $exists: false } },
      { workspaceType: null },
    ],
  };
}

function isLegacyPeriodIndex(index) {
  const keys = Object.keys(index?.key || {});
  return (
    index?.unique === true &&
    keys.length === 3 &&
    index.key.restaurantId === 1 &&
    index.key.periodStart === 1 &&
    index.key.periodEnd === 1
  );
}

function isWorkspacePeriodIndex(index) {
  const keys = Object.keys(index?.key || {});
  return (
    index?.unique === true &&
    keys.length === 4 &&
    index.key.restaurantId === 1 &&
    index.key.periodStart === 1 &&
    index.key.periodEnd === 1 &&
    index.key.workspaceType === 1
  );
}

async function ensureWorkspaceWindowIndex() {
  if (workspaceIndexMigrationPromise) return workspaceIndexMigrationPromise;

  workspaceIndexMigrationPromise = (async () => {
    const collection = AvailabilityRegistrationWindow?.collection;
    if (!collection?.indexes || !collection?.createIndex) return;

    await collection.updateMany?.(
      { workspaceType: { $exists: false } },
      { $set: { workspaceType: "full_time" } },
    );

    let indexes = await collection.indexes();
    const legacyIndex = (indexes || []).find(isLegacyPeriodIndex);

    if (legacyIndex?.name) {
      try {
        await collection.dropIndex(legacyIndex.name);
      } catch (error) {
        if (![26, 27].includes(error?.code) && error?.codeName !== "IndexNotFound") {
          throw error;
        }
      }
      indexes = await collection.indexes();
    }

    if (!(indexes || []).some(isWorkspacePeriodIndex)) {
      await collection.createIndex(
        { restaurantId: 1, periodStart: 1, periodEnd: 1, workspaceType: 1 },
        { unique: true },
      );
    }
  })().catch((error) => {
    workspaceIndexMigrationPromise = null;
    throw error;
  });

  return workspaceIndexMigrationPromise;
}

export async function createOrGetAvailabilityRegistrationWindow(input, userId = null) {
  await ensureWorkspaceWindowIndex();
  const payload = {
    ...input,
    workspaceType: normalizeWorkspaceType(input?.workspaceType),
  };

  try {
    return await AvailabilityRegistrationWindow.create({
      ...payload,
      createdBy: userId || payload.createdBy || null,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return AvailabilityRegistrationWindow.findOne({
        restaurantId: payload.restaurantId,
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        ...workspaceFilter(payload.workspaceType),
      });
    }
    throw error;
  }
}

export function isAvailabilityRegistrationWindowOpen(windowDoc, now = new Date()) {
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
    { availabilityWindowId: windowId, status: { $in: ["submitted", "approved"] } },
    { $set: { status: "locked", lockedAt } },
  );
}

export async function getStaffEmploymentType(employeeId) {
  const staff = await Staff.findById(employeeId).select("employmentType");
  return staff?.employmentType || null;
}
