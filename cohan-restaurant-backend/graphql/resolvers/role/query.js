import { Role } from "../../../models/index.js";
import { requireRole } from "../../../utils/authz.js";
export const RoleQuery = {
  role: async (_, { search, parent }, { user }) => {
    //    requireRole(user, ["admin", "manager"]); // ai được xem danh sách role
    const q = {};
    if (search)
      q.$or = [
        { name: new RegExp(search, "i") },
        { slug: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    if (parent) q.parent = parent.toLowerCase();
    return Role.find(q).sort({ slug: 1 }).lean();
  },
};
