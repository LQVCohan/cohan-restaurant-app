import { User, Permission, ParentRole } from "../../../models/index.js";
import { mergeEffectivePermissions } from "./rbacRoleResponse.js";

async function findPermissions(permissionRefs = []) {
  if (!permissionRefs?.length) return [];
  return Permission.find({ _id: { $in: permissionRefs } }).lean({
    virtuals: true,
  });
}

export default {
  Role: {
    id: (p) => p.id ?? String(p._id),
    parentRole: async (parent) => {
      if (!parent.parentRole) return null;
      if (typeof parent.parentRole === "object" && (parent.parentRole.name || parent.parentRole.slug)) {
        return parent.parentRole;
      }
      return ParentRole.findById(parent.parentRole).populate("permissions").lean({ virtuals: true });
    },
    users: async (parent) => {
      return User.find({ role: parent._id }).lean();
    },
    directPermissions: async (parent) => {
      if (parent.directPermissions) return parent.directPermissions;
      return findPermissions(parent.permissions);
    },
    permissions: async (parent) => {
      if (parent.directPermissions) return parent.permissions || [];

      const directPermissions = await findPermissions(parent.permissions);
      let inheritedPermissions = [];
      if (parent.parentRole?.permissions) {
        inheritedPermissions = parent.parentRole.permissions;
      } else if (parent.parentRole) {
        const parentRole = await ParentRole.findById(parent.parentRole).populate("permissions").lean({ virtuals: true });
        inheritedPermissions = parentRole?.permissions || [];
      }

      return mergeEffectivePermissions({ parentRole: { permissions: inheritedPermissions }, permissions: directPermissions });
    },
  },
  ParentRole: {
    id: (parent) => parent.id ?? String(parent._id),
  },
};