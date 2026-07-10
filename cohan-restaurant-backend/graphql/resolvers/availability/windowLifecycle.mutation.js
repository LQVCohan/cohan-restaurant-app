import {
  AvailabilityRegistrationWindow,
  SchedulePublication,
} from "../../../models/index.js";
import { requireRestaurantAccess, requireRoles } from "../../guards.js";
import { getSchedulingPolicy } from "../../../src/services/scheduling/schedulingPolicy.service.js";
import {
  createOrGetAvailabilityRegistrationWindow,
  lockSubmissionsForClosedWindow,
} from "../../../src/services/availability/availabilityRegistrationWindow.service.js";
import { buildAvailabilityRegistrationSchedule } from "../../../src/services/availability/availabilityRegistrationSchedule.service.js";
import { AVAILABILITY_WINDOW_ADMIN_ROLES } from "../../../src/services/scheduling/schedulingPermission.service.js";

const LOCKED_PUBLICATION_STATUSES = ["published", "active", "locked", "closed"];

async function getScopedWindow(id, ctx) {
  const windowDoc = await AvailabilityRegistrationWindow.findById(id);
  if (!windowDoc) throw new Error("AVAILABILITY_WINDOW_NOT_FOUND");
  await requireRestaurantAccess(ctx, windowDoc.restaurantId);
  return windowDoc;
}

async function assertPeriodCanReceiveRegistration({
  restaurantId,
  periodStart,
  periodEnd,
}) {
  const lockedPublication = await SchedulePublication.exists({
    restaurantId,
    periodStart: { $lte: periodEnd },
    periodEnd: { $gte: periodStart },
    status: { $in: LOCKED_PUBLICATION_STATUSES },
  });
  if (lockedPublication) {
    throw new Error("AVAILABILITY_WINDOW_SCHEDULE_ALREADY_PUBLISHED");
  }
}

function resolveManualOpenRange(windowDoc, now = new Date()) {
  const periodStart = new Date(windowDoc?.periodStart);
  const periodEnd = new Date(windowDoc?.periodEnd);
  if (
    Number.isNaN(periodStart.getTime()) ||
    Number.isNaN(periodEnd.getTime()) ||
    periodEnd <= now
  ) {
    throw new Error("AVAILABILITY_WINDOW_PERIOD_ENDED");
  }

  const configuredCloseAt = new Date(windowDoc?.closeAt);
  let closeAt = configuredCloseAt;
  if (Number.isNaN(closeAt.getTime()) || closeAt <= now) {
    closeAt =
      periodStart > now
        ? new Date(periodStart.getTime() - 60 * 1000)
        : periodEnd;
  }

  return { openAt: now, closeAt };
}

async function atomicallyOpenWindow(windowDoc) {
  const status = String(windowDoc?.status || "draft").toLowerCase();
  if (status === "open") return windowDoc;
  if (!["draft", "closed"].includes(status)) {
    throw new Error("AVAILABILITY_WINDOW_INVALID_OPEN_TRANSITION");
  }

  const mode = String(
    windowDoc?.registrationModeSnapshot || windowDoc?.registrationMode || "manual",
  ).toLowerCase();
  const timing =
    mode === "manual"
      ? resolveManualOpenRange(windowDoc)
      : {
          openAt: windowDoc.openAt,
          closeAt: windowDoc.closeAt,
        };
  const id = windowDoc?._id || windowDoc?.id;
  const updated = await AvailabilityRegistrationWindow.findOneAndUpdate(
    { _id: id, status: { $in: ["draft", "closed"] } },
    {
      $set: { status: "open", ...timing },
      $unset: { closedAt: "", closedBy: "" },
    },
    { new: true },
  );
  if (!updated) throw new Error("AVAILABILITY_WINDOW_STATE_CHANGED");
  return updated;
}

export default {
  createAvailabilityWindow: async (_, { input }, ctx) => {
    requireRoles(ctx, AVAILABILITY_WINDOW_ADMIN_ROLES);
    await requireRestaurantAccess(ctx, input.restaurantId);

    const policy = await getSchedulingPolicy({ restaurantId: input.restaurantId });
    const schedule = buildAvailabilityRegistrationSchedule({
      targetWeekStart: input.periodStart,
      targetWeekEnd: input.periodEnd,
      policy,
    });
    await assertPeriodCanReceiveRegistration({
      restaurantId: input.restaurantId,
      periodStart: schedule.periodStart,
      periodEnd: schedule.periodEnd,
    });

    const availabilityPolicy = policy?.availabilityRegistrationPolicy || {};
    const manualTiming =
      schedule.mode === "manual"
        ? resolveManualOpenRange({
            periodStart: schedule.periodStart,
            periodEnd: schedule.periodEnd,
            closeAt: schedule.closeAt,
          })
        : { openAt: schedule.openAt, closeAt: schedule.closeAt };
    const windowDoc = await createOrGetAvailabilityRegistrationWindow(
      {
        ...input,
        periodStart: schedule.periodStart,
        periodEnd: schedule.periodEnd,
        ...manualTiming,
        status: schedule.mode === "manual" ? "open" : "draft",
        registrationModeSnapshot: schedule.mode,
        targetEmploymentTypes:
          input.targetEmploymentTypes ||
          availabilityPolicy.targetEmploymentTypes ||
          ["part_time", "seasonal"],
        allowFullTimeUnavailableException:
          input.allowFullTimeUnavailableException ??
          availabilityPolicy.allowFullTimeUnavailableException ??
          true,
        lateChangeRequiresApproval:
          input.lateChangeRequiresApproval ??
          availabilityPolicy.lateChangeRequiresApproval ??
          true,
      },
      ctx.user.id,
    );

    return schedule.mode === "manual"
      ? atomicallyOpenWindow(windowDoc)
      : windowDoc;
  },

  openAvailabilityWindow: async (_, { id }, ctx) => {
    requireRoles(ctx, AVAILABILITY_WINDOW_ADMIN_ROLES);
    const windowDoc = await getScopedWindow(id, ctx);

    await assertPeriodCanReceiveRegistration({
      restaurantId: windowDoc.restaurantId,
      periodStart: windowDoc.periodStart,
      periodEnd: windowDoc.periodEnd,
    });

    return atomicallyOpenWindow(windowDoc);
  },

  closeAvailabilityWindow: async (_, { id }, ctx) => {
    requireRoles(ctx, AVAILABILITY_WINDOW_ADMIN_ROLES);
    const windowDoc = await getScopedWindow(id, ctx);
    const status = String(windowDoc.status || "").toLowerCase();
    if (status === "closed") return windowDoc;
    if (status !== "open") {
      throw new Error("AVAILABILITY_WINDOW_INVALID_CLOSE_TRANSITION");
    }

    const now = new Date();
    const updated = await AvailabilityRegistrationWindow.findOneAndUpdate(
      { _id: id, status: "open" },
      {
        $set: {
          status: "closed",
          closedBy: ctx.user.id,
          closedAt: now,
        },
      },
      { new: true },
    );
    if (!updated) throw new Error("AVAILABILITY_WINDOW_STATE_CHANGED");

    await lockSubmissionsForClosedWindow(windowDoc._id || id, now);
    return updated;
  },
};
