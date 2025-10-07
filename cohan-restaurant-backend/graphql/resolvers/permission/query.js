import { Permission } from "../../../models/index.js";

export const PermissionQuery = {
  permissions: async (_, { search, group, resource, action }) => {
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

    return Permission.find(q).sort({ code: 1 });
  },
};
