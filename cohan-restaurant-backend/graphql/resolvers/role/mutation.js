import { GraphQLError } from "graphql";
import { Role, User, Permission, ParentRole } from "../../../models/index.js";
import { hasRole } from "../../../utils/authz.js";
import {
  assertManagerAssignablePermissionCodes,
  isProtectedSystemRoleSlug,
  requirePermission,
} from "../../../src/services/auth/authorization.service.js";
import { logRbacAudit } from "../../../src/services/audit/rbacAudit.service.js";
import mongoose from "mongoose";
import { loadRoleForRbacResponse } from "./rbacRoleResponse.js";

const MANAGER_PARENT_ROLE_SLUG = "staff";

function normalizedSlug(value) {
  return String(value || "").trim().toLowerCase();
}

function forbidden(message) {
  return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
}

function assertNonAdminCanUseParentRole(user, parentRole) {
  if (hasRole(user, ["admin"])) return;
  if (normalizedSlug(parentRole?.slug || parentRole?.name) !== MANAGER_PARENT_ROLE_SLUG) {
    throw forbidden("Manager can only manage roles that inherit from staff");
  }
}

function assertNonAdminCanModifyRole(user, role) {
  if (hasRole(user, ["admin"])) return;
  assertNonAdminCanUseParentRole(user, role?.parentRole);
}

function assertAdminOnly(user) {
  if (!hasRole(user, ["admin"])) {
    throw forbidden("Only admin can manage parent roles");
  }
}

function roleName(role) {
  return role?.name || role?.slug || undefined;
}

function permissionsChanged(before = {}, after = {}) {
  const normalize = (values = []) =>
    values.map((value) => String(value?._id || value?.id || value || "")).sort();
  return JSON.stringify(normalize(before.permissions)) !== JSON.stringify(normalize(after.permissions));
}

export const RoleMutation = {
  createRole: async (_, { input }, ctx) => {
    const { user } = ctx;
    await requirePermission({ user }, "role.write");
    const { permissionIds = [], parentRoleId, ...rest } = input;
    if (!parentRoleId || !mongoose.isValidObjectId(parentRoleId)) {
      throw new GraphQLError("parentRoleId is invalid", { extensions: { code: "BAD_USER_INPUT" } });
    }
    const parentRole = await ParentRole.findById(parentRoleId);
    if (!parentRole) {
      throw new GraphQLError("ParentRole not found", { extensions: { code: "BAD_USER_INPUT" } });
    }
    assertNonAdminCanUseParentRole(user, parentRole);
    const slug = (rest.slug || "").toLowerCase().trim();
    if (!slug) throw new GraphQLError("Slug is required", { extensions: { code: "BAD_USER_INPUT" } });
    const exists = await Role.findOne({ slug }).lean();
    if (exists) throw new GraphQLError("Role slug already exists", { extensions: { code: "BAD_USER_INPUT" } });
    let permObjectIds = [];
    if (permissionIds.length) {
      const valid = permissionIds.filter((id) => mongoose.isValidObjectId(id));
      if (valid.length !== permissionIds.length) throw new GraphQLError("Some permissionIds are invalid", { extensions: { code: "BAD_USER_INPUT" } });
      const perms = await Permission.find({ _id: { $in: valid } }, { _id: 1, code: 1 }).lean();
      if (!hasRole(user, ["admin"])) assertManagerAssignablePermissionCodes(perms.map((p) => p.code));
      permObjectIds = perms.map((p) => p._id);
    }
    const doc = await Role.create({ ...rest, slug, permissions: permObjectIds, parentRole: parentRole._id, isSystem: false });
    await logRbacAudit({ ctx, action: "ROLE_CREATED", targetType: "Role", targetId: doc._id, targetName: roleName(doc), after: doc, metadata: { parentRoleId, permissionIds } });
    return loadRoleForRbacResponse(doc._id);
  },

  updateRole: async (_, { input }, ctx) => {
    const { user } = ctx;
    await requirePermission({ user }, "role.write");
    const { id, permissionIds, parentRoleId, ...rest } = input;
    const r = await Role.findById(id);
    if (!r) throw new GraphQLError("Role not found");
    await r.populate?.("parentRole");
    if (r.isSystem || isProtectedSystemRoleSlug(r.slug)) throw forbidden("System role cannot be modified");
    assertNonAdminCanModifyRole(user, r);
    const before = typeof r.toObject === "function" ? r.toObject() : { ...r };
    if (parentRoleId !== undefined) {
      if (parentRoleId === null) {
        if (!hasRole(user, ["admin"])) throw forbidden("Manager roles must inherit from staff");
        r.parentRole = undefined;
      } else {
        if (!mongoose.isValidObjectId(parentRoleId)) throw new GraphQLError("parentRoleId is invalid", { extensions: { code: "BAD_USER_INPUT" } });
        const parentRole = await ParentRole.findById(parentRoleId);
        if (!parentRole) throw new GraphQLError("ParentRole not found", { extensions: { code: "BAD_USER_INPUT" } });
        assertNonAdminCanUseParentRole(user, parentRole);
        r.parentRole = parentRole._id;
      }
    }
    if (Array.isArray(permissionIds)) {
      const valid = permissionIds.filter((pid) => mongoose.isValidObjectId(pid));
      if (valid.length !== permissionIds.length) throw new GraphQLError("Some permissionIds are invalid", { extensions: { code: "BAD_USER_INPUT" } });
      const perms = await Permission.find({ _id: { $in: valid } }, { _id: 1, code: 1 }).lean();
      if (!hasRole(user, ["admin"])) assertManagerAssignablePermissionCodes(perms.map((p) => p.code));
      r.permissions = perms.map((p) => p._id);
    }
    if (rest.name !== undefined) r.name = rest.name;
    if (rest.description !== undefined) r.description = rest.description;
    if (rest.department !== undefined) r.department = rest.department;
    await r.save();
    const after = typeof r.toObject === "function" ? r.toObject() : { ...r };
    const changedPermissions = Array.isArray(permissionIds) || permissionsChanged(before, after);
    await logRbacAudit({ ctx, action: changedPermissions ? "ROLE_PERMISSION_UPDATED" : "ROLE_UPDATED", targetType: "Role", targetId: r._id, targetName: roleName(r), before, after, metadata: { changedPermissions, parentRoleChanged: parentRoleId !== undefined } });
    return loadRoleForRbacResponse(r._id);
  },

  deleteRole: async (_, { id }, ctx) => {
    const { user } = ctx;
    await requirePermission({ user }, "role.write");
    const r = await Role.findById(id).populate("parentRole").lean();
    if (!r) throw new GraphQLError("Role not found");
    if (r.isSystem || isProtectedSystemRoleSlug(r.slug)) throw forbidden("System role cannot be deleted");
    assertNonAdminCanModifyRole(user, r);
    const used = await User.exists({ role: id });
    if (used) throw new GraphQLError("Cannot delete: role is assigned to users", { extensions: { code: "BAD_REQUEST" } });
    await Role.findByIdAndDelete(id);
    await logRbacAudit({ ctx, action: "ROLE_DELETED", targetType: "Role", targetId: r._id, targetName: roleName(r), before: r });
    return true;
  },

  createParentRole: async (_, { input }, ctx) => {
    const { user } = ctx;
    await requirePermission({ user }, "role.write");
    assertAdminOnly(user);
    const { permissionIds = [], ...rest } = input;
    const slug = (rest.slug || "").toLowerCase().trim();
    if (!slug) throw new GraphQLError("Slug is required", { extensions: { code: "BAD_USER_INPUT" } });
    const exists = await ParentRole.findOne({ slug }).lean();
    if (exists) throw new GraphQLError("ParentRole slug already exists", { extensions: { code: "BAD_USER_INPUT" } });
    let permObjectIds = [];
    if (permissionIds.length) {
      const valid = permissionIds.filter((id) => mongoose.isValidObjectId(id));
      if (valid.length !== permissionIds.length) throw new GraphQLError("Some permissionIds are invalid", { extensions: { code: "BAD_USER_INPUT" } });
      const perms = await Permission.find({ _id: { $in: valid } }, { _id: 1, code: 1 }).lean();
      permObjectIds = perms.map((p) => p._id);
    }
    const doc = await ParentRole.create({ ...rest, slug, permissions: permObjectIds });
    await logRbacAudit({ ctx, action: "PARENT_ROLE_CREATED", targetType: "ParentRole", targetId: doc._id, targetName: roleName(doc), after: doc, metadata: { permissionIds } });
    return doc.toObject();
  },

  updateParentRole: async (_, { input }, ctx) => {
    const { user } = ctx;
    await requirePermission({ user }, "role.write");
    assertAdminOnly(user);
    const { id, permissionIds, ...rest } = input;
    const pr = await ParentRole.findById(id);
    if (!pr) throw new GraphQLError("ParentRole not found");
    const before = typeof pr.toObject === "function" ? pr.toObject() : { ...pr };
    if (Array.isArray(permissionIds)) {
      const valid = permissionIds.filter((pid) => mongoose.isValidObjectId(pid));
      if (valid.length !== permissionIds.length) throw new GraphQLError("Some permissionIds are invalid", { extensions: { code: "BAD_USER_INPUT" } });
      const perms = await Permission.find({ _id: { $in: valid } }, { _id: 1, code: 1 }).lean();
      pr.permissions = perms.map((p) => p._id);
    }
    if (rest.name !== undefined) pr.name = rest.name;
    if (rest.description !== undefined) pr.description = rest.description;
    await pr.save();
    const after = typeof pr.toObject === "function" ? pr.toObject() : { ...pr };
    await logRbacAudit({ ctx, action: "PARENT_ROLE_UPDATED", targetType: "ParentRole", targetId: pr._id, targetName: roleName(pr), before, after, metadata: { changedPermissions: Array.isArray(permissionIds) } });
    return pr.toObject();
  },

  deleteParentRole: async (_, { id }, ctx) => {
    const { user } = ctx;
    await requirePermission({ user }, "role.write");
    assertAdminOnly(user);
    const pr = await ParentRole.findById(id).lean();
    if (!pr) throw new GraphQLError("ParentRole not found");
    if (isProtectedSystemRoleSlug(pr.slug)) throw forbidden("System parent role cannot be deleted");
    const used = await Role.exists({ parentRole: id });
    if (used) throw new GraphQLError("Cannot delete: parentRole is assigned to roles", { extensions: { code: "BAD_REQUEST" } });
    await ParentRole.findByIdAndDelete(id);
    await logRbacAudit({ ctx, action: "PARENT_ROLE_DELETED", targetType: "ParentRole", targetId: pr._id, targetName: roleName(pr), before: pr });
    return true;
  },
};
