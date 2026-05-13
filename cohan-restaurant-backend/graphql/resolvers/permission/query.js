import { Permission } from "../../../models/index.js";
import { requireAnyPermission } from "../../../src/services/auth/authorization.service.js";

export const PermissionQuery = {
  permissions: async (_, { search, group, resource, action }, ctx) => {
    await requireAnyPermission(ctx, ["permission.read", "role.read", "staff.read"]);

    const q = {};
    if (group) q.group = group.toLowerCase();
    if (resource) q.resource = resource.toLowerCase();
    if (action) q.action = action.toLowerCase();
    if (search) {
      q.$or = [
        { code: new RegExp(search, "i") },
        { name: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }

    return Permission.find(q).sort({ group: 1, code: 1 });
  },
};
