import {
  AvailabilityRegistrationWindow,
  Staff,
} from "../../../models/index.js";
import {
  requireAuth,
  requireRestaurantAccess,
} from "../../guards.js";
import {
  AVAILABILITY_READ_ROLES,
  userHasAnyRole,
} from "../../../src/services/scheduling/schedulingPermission.service.js";

export const AVAILABILITY_WORKSPACE_TYPES = Object.freeze({
  FULL_TIME: "full_time",
  PART_TIME: "part_time",
  ROTATING: "rotating",
});

const VALID_WORKSPACES = new Set(Object.values(AVAILABILITY_WORKSPACE_TYPES));
const PART_TIME_EMPLOYMENT_TYPES = new Set([
  "part_time",
  "seasonal",
  "probation",
  "contract",
]);

const WORKSPACE_DEFAULTS = {
  full_time: {
    targetEmploymentTypes: ["full_time"],
    allowFullTimeUnavailableException: true,
  },
  part_time: {
    targetEmploymentTypes: ["part_time", "seasonal", "probation", "contract"],
    allowFullTimeUnavailableException: false,
  },
  rotating: {
    targetEmploymentTypes: [
      "full_time",
      "part_time",
      "probation",
      "seasonal",
      "contract",
    ],
    allowFullTimeUnavailableException: false,
  },
};

export function normalizeAvailabilityWorkspaceType(value, fallback = "full_time") {
  const normalized = String(value || "").trim().toLowerCase();
  return VALID_WORKSPACES.has(normalized) ? normalized : fallback;
}

function normalizeEmploymentType(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeShiftType(value) {
  return String(value || "").trim().toLowerCase();
}

export function resolveStaffAvailabilityWorkspace(staff) {
  if (normalizeShiftType(staff?.shiftType) === "rotating") {
    return AVAILABILITY_WORKSPACE_TYPES.ROTATING;
  }

  return PART_TIME_EMPLOYMENT_TYPES.has(
    normalizeEmploymentType(staff?.employmentType),
  )
    ? AVAILABILITY_WORKSPACE_TYPES.PART_TIME
    : AVAILABILITY_WORKSPACE_TYPES.FULL_TIME;
}

function workspaceQuery(workspaceType) {
  const normalized = normalizeAvailabilityWorkspaceType(workspaceType);
  if (normalized !== AVAILABILITY_WORKSPACE_TYPES.FULL_TIME) {
    return { workspaceType: normalized };
  }

  return {
    $or: [
      { workspaceType: AVAILABILITY_WORKSPACE_TYPES.FULL_TIME },
      { workspaceType: { $exists: false } },
      { workspaceType: null },
    ],
  };
}

async function readStaffProfile(employeeId) {
  if (!employeeId) return null;
  const query = Staff.findById(employeeId);
  const selected = query?.select
    ? query.select({
        _id: 1,
        restaurantForStaff: 1,
        employmentType: 1,
        shiftType: 1,
      })
    : query;
  return selected?.lean ? selected.lean() : selected;
}

async function resolveViewerWorkspace(ctx, explicitWorkspaceType) {
  if (explicitWorkspaceType) {
    return normalizeAvailabilityWorkspaceType(explicitWorkspaceType);
  }

  if (userHasAnyRole(ctx?.user, AVAILABILITY_READ_ROLES)) {
    return AVAILABILITY_WORKSPACE_TYPES.FULL_TIME;
  }

  const staff = await readStaffProfile(ctx?.user?.id || ctx?.user?._id);
  return resolveStaffAvailabilityWorkspace(staff);
}

export function withAvailabilityWorkspaceQueries(baseQuery) {
  return {
    ...baseQuery,

    availabilityWindow: async (
      _,
      { restaurantId, periodStart, periodEnd, workspaceType },
      ctx,
    ) => {
      requireAuth(ctx);
      await requireRestaurantAccess(ctx, restaurantId);
      const resolvedWorkspace = await resolveViewerWorkspace(ctx, workspaceType);

      return AvailabilityRegistrationWindow.findOne({
        restaurantId,
        periodStart,
        periodEnd,
        ...workspaceQuery(resolvedWorkspace),
      });
    },

    availabilityWindows: async (
      _,
      { restaurantId, from, to, status, workspaceType },
      ctx,
    ) => {
      requireAuth(ctx);
      await requireRestaurantAccess(ctx, restaurantId);
      const resolvedWorkspace = await resolveViewerWorkspace(ctx, workspaceType);
      const query = {
        restaurantId,
        ...workspaceQuery(resolvedWorkspace),
      };

      if (status) query.status = status;
      if (from || to) {
        query.periodStart = {
          ...(from ? { $gte: from } : {}),
          ...(to ? { $lte: to } : {}),
        };
      }

      return AvailabilityRegistrationWindow.find(query).sort({ periodStart: 1 });
    },
  };
}

export function withAvailabilityWorkspaceMutations(baseMutation) {
  return {
    ...baseMutation,

    createAvailabilityWindow: async (_, { input }, ctx) => {
      const workspaceType = normalizeAvailabilityWorkspaceType(
        input?.workspaceType,
      );
      const defaults = WORKSPACE_DEFAULTS[workspaceType];

      return baseMutation.createAvailabilityWindow(
        _,
        {
          input: {
            ...input,
            workspaceType,
            targetEmploymentTypes:
              input?.targetEmploymentTypes?.length
                ? input.targetEmploymentTypes
                : defaults.targetEmploymentTypes,
            allowFullTimeUnavailableException:
              input?.allowFullTimeUnavailableException ??
              defaults.allowFullTimeUnavailableException,
          },
        },
        ctx,
      );
    },

    submitStaffAvailability: async (_, { input }, ctx) => {
      const [windowDoc, staff] = await Promise.all([
        AvailabilityRegistrationWindow.findById(input.availabilityWindowId),
        readStaffProfile(input.employeeId),
      ]);

      if (!windowDoc) throw new Error("AVAILABILITY_WINDOW_NOT_FOUND");
      if (!staff) throw new Error("STAFF_NOT_FOUND");

      const windowWorkspace = normalizeAvailabilityWorkspaceType(
        windowDoc.workspaceType,
      );
      const staffWorkspace = resolveStaffAvailabilityWorkspace(staff);

      if (windowWorkspace !== staffWorkspace) {
        throw new Error("AVAILABILITY_WORKSPACE_MISMATCH");
      }

      return baseMutation.submitStaffAvailability(_, { input }, ctx);
    },
  };
}
