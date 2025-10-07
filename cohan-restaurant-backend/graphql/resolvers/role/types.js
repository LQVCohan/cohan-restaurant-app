import { User, Permission } from "../../../models/index.js";

export default {
  Role: {
    id: (p) => p.id ?? String(p._id),
    users: async (parent) => {
      return User.find({ role: parent._id }).lean();
    },
    permissions: async (parent) => {
      if (!parent.permissions?.length) return [];
      return Permission.find({ _id: { $in: parent.permissions } }).lean({
        virtuals: true,
      });
    },
  },
};
