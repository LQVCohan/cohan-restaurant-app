import { User, Permission, ParentRole } from "../../../models/index.js";

async function findPermissions(permissionRefs = []) {
  if (!permissionRefs?.length) return [];
  return Permission.find({ _id: { $in: permissionRefs } }).lean({
    virtuals: true,
  });
}

function permissionKey(permission) {
  return String(permission?._id || permission?.id || permission?.code || "");
}

function mergePermissions(...permissionGroups) {
  const permissionMap = new Map();
  for (const group of permissionGroups) {
    for (const permission of group || []) {
      const key = permissionKey(permission);
      if (key) permissionMap.set(key, permission);
    }
  }
  return Array.from(permissionMap.values());
}

export default {
  Role: {
    id: (p) => p.id ?? String(p._id),
    users: async (parent) => {
      return User.find({ role: parent._id }).lean();
    },
    directPermissions: async (parent) => {
      if (parent.directPermissions) return parent.directPermissions;
      return findPermissions(parent.permissions);
    },
    permissions: async (parent) => {
      if (parent.permissions && parent.parentRole?.permissions) return parent.permissions;

      const directPermissions = await findPermissions(parent.permissions);
      let inheritedPermissions = [];
      if (parent.parentRole?.permissions) {
        inheritedPermissions = parent.parentRole.permissions;
      } else if (parent.parentRole) {
        const parentRole = await ParentRole.findById(parent.parentRole).populate("permissions").lean({ virtuals: true });
        inheritedPermissions = parentRole?.permissions || [];
      }

      return mergePermissions(inheritedPermissions, directPermissions);
    },
  },
};
