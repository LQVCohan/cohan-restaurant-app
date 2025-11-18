// src/graphql/staff/mutation.js
import { User, Role, EventLog } from "../../../models/index.js";

async function logStaffEvent({
  staff,
  verb,
  ctx,
  status = "success",
  meta = {},
  diff = {},
}) {
  try {
    const actorUserId = ctx?.user?.id || ctx?.user?._id || null;

    const restaurantId =
      staff.primaryRestaurant ||
      (Array.isArray(staff.refRestaurants) && staff.refRestaurants.length > 0
        ? staff.refRestaurants[0]
        : null);

    await EventLog.create({
      restaurantId,
      actorUserId,
      verb,
      object: {
        kind: "User",
        id: staff._id,
        code: staff.employeeCode || staff.username || staff.email || null,
      },
      source: "staff-mutation",
      status,
      meta,
      diff,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Failed to create staff event log:", err.message);
  }
}

export default {
  // =========================
  // CREATE STAFF
  // =========================
  createStaff: async (_, { input }, ctx) => {
    input.userType = "STAFF";

    // xác định role cho staff
    let roleId = input.roleId;
    if (!roleId) {
      let staffRole =
        (await Role.findOne({ slug: "staff" })) ||
        (await Role.findOne({ parent: "staff" }));

      if (!staffRole) {
        throw new Error(
          "Default staff role not found (slug='staff' or parent='staff')"
        );
      }

      roleId = staffRole._id;
    }

    const { password, primaryRestaurantId, refRestaurantIds, ...rest } = input;

    const doc = {
      ...rest,
      role: roleId,
    };

    if (primaryRestaurantId) doc.primaryRestaurant = primaryRestaurantId;
    if (refRestaurantIds) doc.refRestaurants = refRestaurantIds;

    const staff = new User(doc);
    if (password) await staff.setPassword(password);

    await staff.save();
    await staff.populate(["role", "refRestaurants", "primaryRestaurant"]);

    await logStaffEvent({
      staff,
      verb: "staff.create",
      ctx,
      meta: {
        roleId,
        userType: staff.userType,
      },
    });

    return staff;
  },

  // =========================
  // UPDATE STAFF
  // =========================
  updateStaff: async (_, { userId, input }, ctx) => {
    const staff = await User.findById(userId);
    if (!staff || staff.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    const before = staff.toObject();

    if (input.primaryRestaurantId) {
      input.primaryRestaurant = input.primaryRestaurantId;
      delete input.primaryRestaurantId;
    }

    if (input.refRestaurantIds) {
      input.refRestaurants = input.refRestaurantIds;
      delete input.refRestaurantIds;
    }

    Object.assign(staff, input);
    await staff.save();
    await staff.populate(["role", "refRestaurants", "primaryRestaurant"]);

    await logStaffEvent({
      staff,
      verb: "staff.update",
      ctx,
      diff: {
        before: {
          fullName: before.fullName,
          employeeCode: before.employeeCode,
          positionTitle: before.positionTitle,
          employmentType: before.employmentType,
          employmentStatus: before.employmentStatus,
          primaryRestaurant: before.primaryRestaurant,
        },
        after: {
          fullName: staff.fullName,
          employeeCode: staff.employeeCode,
          positionTitle: staff.positionTitle,
          employmentType: staff.employmentType,
          employmentStatus: staff.employmentStatus,
          primaryRestaurant: staff.primaryRestaurant,
        },
      },
    });

    return staff;
  },

  // =========================
  // DELETE STAFF (SOFT DELETE)
  // =========================
  deleteStaff: async (_, { userId }, ctx) => {
    const staff = await User.findById(userId);

    if (!staff || staff.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    staff.status = "inactive";
    staff.employmentStatus = "RESIGNED";
    await staff.save();

    await logStaffEvent({
      staff,
      verb: "staff.delete",
      ctx,
      meta: { reason: "soft-delete" },
    });

    return true;
  },

  // =========================
  // SET STAFF EMPLOYMENT STATUS ("Tạm nghỉ")
  // =========================
  setStaffEmploymentStatus: async (_, { userId, employmentStatus }, ctx) => {
    const staff = await User.findById(userId);

    if (!staff || staff.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    const beforeStatus = staff.employmentStatus;

    staff.employmentStatus = employmentStatus;
    await staff.save();
    await staff.populate(["role", "refRestaurants", "primaryRestaurant"]);

    // Nếu là TẠM NGHỈ thì log verb rõ ràng
    const verb =
      employmentStatus === "ON_LEAVE"
        ? "staff.setOnLeave" // nút "Tạm nghỉ"
        : "staff.setEmploymentStatus";

    await logStaffEvent({
      staff,
      verb,
      ctx,
      diff: {
        before: { employmentStatus: beforeStatus },
        after: { employmentStatus: staff.employmentStatus },
      },
    });

    return staff;
  },

  // =========================
  // RATE STAFF (1–5 sao)
  // =========================
  rateStaff: async (_, { userId, rating }, ctx) => {
    const staff = await User.findById(userId);

    if (!staff || staff.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    const r = Math.max(1, Math.min(5, Number(rating) || 0));
    const prevRate = staff.rate || 0;
    const prevCount = staff.rateCount || 0;

    const newCount = prevCount + 1;
    const newRate = (prevRate * prevCount + r) / newCount;

    staff.rate = newRate;
    staff.rateCount = newCount;

    await staff.save();
    await staff.populate(["role", "refRestaurants", "primaryRestaurant"]);

    await logStaffEvent({
      staff,
      verb: "staff.rate",
      ctx,
      meta: { rating: r },
      diff: {
        before: { rate: prevRate, rateCount: prevCount },
        after: { rate: staff.rate, rateCount: staff.rateCount },
      },
    });

    return staff;
  },
};
