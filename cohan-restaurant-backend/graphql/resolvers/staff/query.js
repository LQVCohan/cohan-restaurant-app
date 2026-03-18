// src/graphql/staff/query.js
import mongoose from "mongoose";
import {
  Staff,
  Shift,
  Timesheet,
  Order,
  Table,
  Category,
  Promotion,
} from "../../../models/index.js";

function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

async function resolveStaffDoc(staffId, ctx) {
  const fallbackId = ctx?.user?.id;
  const targetId = staffId || fallbackId;
  const oid = toObjectId(targetId);
  if (!oid) return null;

  return Staff.findById(oid)
    .populate("role")
    .populate("refRestaurants")
    .populate("primaryRestaurant");
}

export default {
  // =========================
  // GET ONE STAFF
  // =========================
  staff: async (_, { id }) => {
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
    { restaurantId, roleId, search, employmentStatus }
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

  staffAccountOverview: async (_, { staffId }, ctx) => {
    const staff = await resolveStaffDoc(staffId, ctx);
    if (!staff || staff.userType !== "STAFF") return null;

    const restaurantId =
      staff?.restaurantForStaff || staff?.primaryRestaurant?._id || null;
    const rid = toObjectId(restaurantId);

    let floorAssigned = [];
    let tableList = [];
    let tableCount = 0;
    let floorCount = 0;
    let categoryCount = 0;
    let promotionCount = 0;

    if (rid) {
      const [tables, categoryAgg, promoAgg] = await Promise.all([
        Table.find({ restaurantId: rid }).select({ code: 1, floorLevel: 1 }).lean(),
        Category.countDocuments({ restaurantId: rid }),
        Promotion.countDocuments({ restaurantId: rid, isActive: true }),
      ]);
      tableCount = tables.length;
      tableList = tables.map((t) => t.code).filter(Boolean);
      floorAssigned = Array.from(
        new Set(
          tables
            .map((t) =>
              t?.floorLevel != null ? `Tầng ${Number(t.floorLevel)}` : null
            )
            .filter(Boolean)
        )
      );
      floorCount = floorAssigned.length;
      categoryCount = Number(categoryAgg || 0);
      promotionCount = Number(promoAgg || 0);
    }

    const orderFilter = {
      userId: staff._id,
      currentStatus: { $in: ["served", "completed", "paid"] },
    };
    if (rid) orderFilter.restaurantId = rid;

    const [ordersServedCount, shiftDocs] = await Promise.all([
      Order.countDocuments(orderFilter),
      Shift.find({ employeeId: staff._id })
        .sort({ startTime: -1 })
        .limit(2)
        .lean(),
    ]);

    const shiftsWorkedCount = await Shift.countDocuments({ employeeId: staff._id });

    return {
      staffId: String(staff._id),
      fullName: staff.fullName || null,
      email: staff.email || null,
      phone: staff.phone || null,
      avatarUrl: staff.avatarUrl || staff.avatar || null,
      roleName:
        staff?.positionTitle || staff?.roleName || staff?.role?.name || "Nhân viên",
      positionTitle: staff.positionTitle || null,
      employeeCode: staff.employeeCode || null,
      employmentStatus: String(staff.employmentStatus || "working").toUpperCase(),
      primaryRestaurant: staff.primaryRestaurant || null,
      restaurantForStaff: staff.restaurantForStaff || null,
      floorAssigned,
      floorCount,
      tableCount,
      categoryCount,
      promotionCount,
      tableList,
      ordersServedCount,
      shiftsWorkedCount,
      currentShift: shiftDocs?.[0]?.shiftType || null,
      lastShift: shiftDocs?.[1]?.shiftType || shiftDocs?.[0]?.shiftType || null,
    };
  },

  staffSalarySummary: async (_, { staffId }, ctx) => {
    const staff = await resolveStaffDoc(staffId, ctx);
    if (!staff || staff.userType !== "STAFF") return null;

    const shifts = await Shift.find({ employeeId: staff._id })
      .select({ _id: 1 })
      .lean();
    const shiftIds = shifts.map((s) => s._id);

    if (!shiftIds.length) {
      const baseSalary = Number(staff.baseSalary || 0);
      return {
        staffId: String(staff._id),
        baseSalary,
        totalHours: 0,
        totalWage: 0,
        totalAmount: 0,
        bonusAmount: 0,
        coefficient: 0,
        timesheetCount: 0,
      };
    }

    const agg = await Timesheet.aggregate([
      { $match: { shiftId: { $in: shiftIds } } },
      {
        $group: {
          _id: null,
          totalHours: { $sum: { $ifNull: ["$hours", 0] } },
          totalWage: { $sum: { $ifNull: ["$wage", 0] } },
          totalAmount: { $sum: { $ifNull: ["$amount", 0] } },
          timesheetCount: { $sum: 1 },
        },
      },
    ]);

    const row = agg?.[0] || {};
    const totalWage = Number(row.totalWage || 0);
    const totalAmount = Number(row.totalAmount || 0);
    const baseSalary = Number(staff.baseSalary || 0);
    const bonusAmount = Math.max(0, totalAmount - totalWage);
    const coefficient = baseSalary > 0 ? totalWage / baseSalary : 0;
    return {
      staffId: String(staff._id),
      baseSalary,
      totalHours: Number(row.totalHours || 0),
      totalWage,
      totalAmount,
      bonusAmount,
      coefficient: Number(coefficient.toFixed(2)),
      timesheetCount: Number(row.timesheetCount || 0),
    };
  },

  staffShiftHistory: async (_, { staffId, limit = 20 }, ctx) => {
    const staff = await resolveStaffDoc(staffId, ctx);
    if (!staff || staff.userType !== "STAFF") return [];

    const rows = await Shift.find({ employeeId: staff._id })
      .sort({ startTime: -1 })
      .limit(Math.max(1, Math.min(Number(limit || 20), 100)))
      .populate("restaurantId", "name")
      .lean();

    return rows.map((r) => ({
      id: String(r._id),
      restaurant: r.restaurantId
        ? { id: String(r.restaurantId._id || r.restaurantId.id), name: r.restaurantId.name }
        : null,
      shiftType: r.shiftType || null,
      startTime: r.startTime || null,
      endTime: r.endTime || null,
      status: r.status || null,
      notes: r.notes || null,
    }));
  },
};
