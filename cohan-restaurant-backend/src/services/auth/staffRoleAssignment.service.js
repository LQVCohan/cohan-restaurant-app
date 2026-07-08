import { GraphQLError } from "graphql";
import { Role, Staff } from "../../../models/index.js";
import { hasRole } from "../../../utils/authz.js";
import {
  assertManagerAssignablePermissionCodes,
  isProtectedSystemRoleSlug,
  requireRestaurantPermission,
} from "./authorization.service.js";
import { logRbacAudit } from "../audit/rbacAudit.service.js";

function toId(value) {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
}

function roleSlug(role) {
  return String(role?.slug || role?.name || "").trim().toLowerCase();
}

function parentRoleSlug(role) {
  return String(role?.parentRole?.slug || role?.parentRole?.name || "").trim().toLowerCase();
}

function effectivePermissionCodes(role) {
  const parentPermissions = Array.isArray(role?.parentRole?.permissions) ? role.parentRole.permissions : [];
  const rolePermissions = Array.isArray(role?.permissions) ? role.permissions : [];
  return [...parentPermissions, ...rolePermissions]
    .map((permission) => String(permission?.code || permission || "").trim().toLowerCase())
    .filter(Boolean);
}

function forbidden(message = "FORBIDDEN") {
  return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
}

function roleSnapshot(role) {
  if (!role) return null;
  return {
    id: toId(role),
    name: role.name,
    slug: role.slug,
    parentRole: role.parentRole
      ? { id: toId(role.parentRole), name: role.parentRole.name, slug: role.parentRole.slug }
      : null,
  };
}

function actorScope(actor) {
  return hasRole(actor, ["admin"]) ? "admin" : "manager";
}

export function assertAssignableStaffRole({ actor, role }) {
  if (!role) throw new GraphQLError("Role not found", { extensions: { code: "BAD_USER_INPUT" } });

  if (isProtectedSystemRoleSlug(roleSlug(role)) || isProtectedSystemRoleSlug(parentRoleSlug(role))) {
    throw forbidden("Protected system role cannot be assigned to staff");
  }

  if (parentRoleSlug(role) !== "staff") {
    throw forbidden("Only staff-derived roles can be assigned to staff");
  }

  if (hasRole(actor, ["admin"])) return true;

  assertManagerAssignablePermissionCodes(effectivePermissionCodes(role));
  return true;
}

export async function assignStaffRoleWithinRestaurant({ actor, staffUserId, roleId, restaurantId, ctx }) {
  await requireRestaurantPermission({ user: actor }, restaurantId, "staff.write");

  const staff = await Staff.findById(staffUserId);
  if (!staff || staff.userType !== "STAFF" || staff.deletedAt) {
    throw new GraphQLError("Staff not found", { extensions: { code: "BAD_USER_INPUT" } });
  }

  if (toId(staff.restaurantForStaff) !== toId(restaurantId)) {
    throw forbidden("Staff does not belong to this restaurant");
  }

  await staff.populate?.({ path: "role", populate: { path: "parentRole" } });
  const beforeRole = roleSnapshot(staff.role);

  const role = await Role.findById(roleId)
    .populate("permissions")
    .populate({ path: "parentRole", populate: { path: "permissions" } })
    .lean();

  assertAssignableStaffRole({ actor, role });

  staff.role = role._id;
  await staff.save();

  await logRbacAudit({
    ctx: ctx || { user: actor },
    action: "STAFF_ROLE_ASSIGNED",
    targetType: "User",
    targetId: staff._id,
    targetName: staff.fullName || staff.employeeCode || staff.email || null,
    restaurantId,
    before: { role: beforeRole },
    after: { role: roleSnapshot(role) },
    metadata: {
      assignedRoleId: toId(role),
      assignedRoleSlug: role?.slug || null,
      actorScope: actorScope(actor),
      restaurantId: toId(restaurantId),
    },
  });

  await staff.populate?.(["role", "refRestaurants"]);
  return staff;
}
