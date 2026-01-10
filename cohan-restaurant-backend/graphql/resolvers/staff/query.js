// src/graphql/staff/query.js
import { Staff } from "../../../models/index.js";

export default {
  // =========================
  // GET ONE STAFF
  // =========================
  staff: async (_, { id }, ctx) => {
    const user = await Staff.findById(id)
      .populate("role")
      .populate("refRestaurants")
      .populate("primaryRestaurant");

    if (!user || user.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    return user;
  },

  // =========================
  // GET STAFF LIST
  // =========================
  staffList: async (
    _,
    { restaurantId, roleId, search, employmentStatus },
    ctx
  ) => {
    const filter = {};

    if (restaurantId) filter.refRestaurants = restaurantId;
    if (roleId) filter.role = roleId;
    if (employmentStatus) filter.employmentStatus = employmentStatus;

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { fullName: regex },
        { email: regex },
        { phone: regex },
        { username: regex },
        { employeeCode: regex },
      ];
    }

    return Staff.find(filter)
      .populate("role")
      .populate("refRestaurants")
      .populate("primaryRestaurant")
      .sort({ fullName: 1 });
  },
};
