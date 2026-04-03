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
  Restaurant,
} from "../../../models/index.js";
import { buildStaffSchedulingAssistant } from "../../../src/services/ai/staffSchedulingAssistant.service.js";
import {
  buildPayrollItem,
  calculatePeriodCalendarDays,
  normalizeRegionCode,
} from "../../../src/services/payroll/payrollCalculator.service.js";

function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function toStartOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toEndOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function mapDepartmentLabel(department) {
  const map = {
    management: "Management",
    kitchen: "Kitchen",
    service: "Service",
    cashier: "Cashier",
    cleaning: "Cleaning",
    delivery: "Delivery",
  };
  return map[String(department || "").toLowerCase()] || "Other";
}

function inferRegionCodeFromRestaurant(restaurant) {
  const manual = String(restaurant?.payrollRegionCode || "").trim().toUpperCase();
  if (["I", "II", "III", "IV"].includes(manual)) return manual;

  const city = String(restaurant?.address?.city || "").toLowerCase();
  if (city.includes("hà nội") || city.includes("ha noi") || city.includes("hồ chí minh") || city.includes("ho chi minh")) {
    return "I";
  }
  return "II";
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
    const filter = { userType: "STAFF" };

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
      const payroll = buildPayrollItem({
        staff,
        period: { start: new Date(), end: new Date(), calendarDays: 0 },
        aggregate: { workedDateCount: 0, totalHours: 0, totalWage: 0, totalAmount: 0 },
        regionCode: "I",
        payrollStatus: "draft",
      });
      return {
        staffId: String(staff._id),
        baseSalary,
        totalHours: 0,
        totalWage: 0,
        totalAmount: 0,
        bonusAmount: 0,
        grossIncome: 0,
        totalDeduction: 0,
        netSalary: 0,
        insuranceSocial: 0,
        insuranceHealth: 0,
        insuranceUnemployment: 0,
        insuranceTotal: 0,
        overtimeNormal: 0,
        overtimeWeekend: 0,
        overtimeHoliday: 0,
        nightShiftExtra: 0,
        insuranceEligible: payroll.insuranceEligible,
        policyCode: payroll.policyCode,
        policyEffectiveFrom: payroll.policyEffectiveFrom,
        warningMessages: [],
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
    const payroll = buildPayrollItem({
      staff,
      period: {
        start: new Date(),
        end: new Date(),
        calendarDays: 26,
      },
      aggregate: {
        workedDateCount: Number(row.timesheetCount || 0),
        totalHours: Number(row.totalHours || 0),
        totalWage,
        totalAmount,
      },
      regionCode: "I",
      payrollStatus: "draft",
    });

    return {
      staffId: String(staff._id),
      baseSalary,
      totalHours: Number(row.totalHours || 0),
      totalWage,
      totalAmount,
      bonusAmount,
      grossIncome: payroll.grossIncome,
      totalDeduction: payroll.totalDeduction,
      netSalary: payroll.netSalary,
      insuranceSocial: payroll.insuranceSocial,
      insuranceHealth: payroll.insuranceHealth,
      insuranceUnemployment: payroll.insuranceUnemployment,
      insuranceTotal: payroll.insuranceTotal,
      overtimeNormal: payroll.overtimeNormal,
      overtimeWeekend: payroll.overtimeWeekend,
      overtimeHoliday: payroll.overtimeHoliday,
      nightShiftExtra: payroll.nightShiftExtra,
      insuranceEligible: payroll.insuranceEligible,
      policyCode: payroll.policyCode,
      policyEffectiveFrom: payroll.policyEffectiveFrom,
      warningMessages: payroll.minimumWageViolation ? ["Lương cơ bản thấp hơn mức tối thiểu vùng"] : [],
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

  staffPayrollOverview: async (_, { startDate, endDate, restaurantId }, ctx) => {
    const start = toStartOfDay(startDate);
    const end = toEndOfDay(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return {
        stats: { totalPayroll: 0, paidAmount: 0, remaining: 0, progress: 0 },
        items: [],
      };
    }

    const authUser = ctx?.user || null;
    const fallbackRestaurantId =
      restaurantId ||
      authUser?.restaurantForStaff ||
      authUser?.primaryRestaurantId ||
      null;
    const rid = toObjectId(fallbackRestaurantId);

    const staffFilter = { userType: "STAFF" };
    if (rid) {
      staffFilter.$or = [{ primaryRestaurant: rid }, { refRestaurants: rid }];
    }

    const staffs = await Staff.find(staffFilter)
      .select({
        _id: 1,
        fullName: 1,
        employeeCode: 1,
        positionTitle: 1,
        roleName: 1,
        department: 1,
        avatarUrl: 1,
        avatar: 1,
        baseSalary: 1,
      })
      .lean();

    if (!staffs.length) {
      return {
        stats: { totalPayroll: 0, paidAmount: 0, remaining: 0, progress: 0 },
        items: [],
      };
    }

    const staffIds = staffs.map((s) => s._id);
    const shiftMatch = {
      employeeId: { $in: staffIds },
      startTime: { $gte: start, $lte: end },
    };
    if (rid) shiftMatch.restaurantId = rid;

    const shifts = await Shift.find(shiftMatch)
      .select({ _id: 1, employeeId: 1, startTime: 1 })
      .lean();

    const shiftIds = shifts.map((s) => s._id);
    const timesheetAgg = shiftIds.length
      ? await Timesheet.aggregate([
          { $match: { shiftId: { $in: shiftIds } } },
          {
            $group: {
              _id: "$shiftId",
              totalHours: { $sum: { $ifNull: ["$hours", 0] } },
              totalWage: { $sum: { $ifNull: ["$wage", 0] } },
              totalAmount: { $sum: { $ifNull: ["$amount", 0] } },
            },
          },
        ])
      : [];

    const timesheetByShiftId = new Map(
      timesheetAgg.map((row) => [
        String(row._id),
        {
          totalHours: Number(row.totalHours || 0),
          totalWage: Number(row.totalWage || 0),
          totalAmount: Number(row.totalAmount || 0),
        },
      ])
    );

    const payrollByStaffId = new Map();
    for (const shift of shifts) {
      const sid = String(shift.employeeId);
      if (!payrollByStaffId.has(sid)) {
        payrollByStaffId.set(sid, {
          workedDateKeys: new Set(),
          totalHours: 0,
          totalWage: 0,
          totalAmount: 0,
        });
      }
      const bucket = payrollByStaffId.get(sid);
      bucket.workedDateKeys.add(new Date(shift.startTime).toISOString().slice(0, 10));
      const ts = timesheetByShiftId.get(String(shift._id)) || {
        totalHours: 0,
        totalWage: 0,
        totalAmount: 0,
      };
      bucket.totalHours += ts.totalHours;
      bucket.totalWage += ts.totalWage;
      bucket.totalAmount += ts.totalAmount;
    }

    const now = new Date();
    const workDays = calculatePeriodCalendarDays(start, end);
    const restaurant = rid ? await Restaurant.findById(rid).select({ address: 1, payrollRegionCode: 1 }).lean() : null;
    const regionCode = normalizeRegionCode(inferRegionCodeFromRestaurant(restaurant));

    const items = staffs.map((staff) => {
      const sid = String(staff._id);
      const agg = payrollByStaffId.get(sid) || {
        workedDateKeys: new Set(),
        totalHours: 0,
        totalWage: 0,
        totalAmount: 0,
      };

      const actualWorkDays = agg.workedDateKeys.size;
      let status = "draft";
      if (actualWorkDays > 0) status = end < now ? "paid" : "approved";

      const payroll = buildPayrollItem({
        staff,
        period: { start, end, calendarDays: workDays },
        aggregate: {
          workedDateCount: actualWorkDays,
          totalHours: agg.totalHours,
          totalWage: agg.totalWage,
          totalAmount: agg.totalAmount,
        },
        regionCode,
        payrollStatus: status,
      });

      const warningMessages = [];
      if (payroll.minimumWageViolation) warningMessages.push("Lương cơ bản thấp hơn lương tối thiểu vùng áp dụng.");
      if (payroll.missingTimesheetData) warningMessages.push("Có ca làm nhưng thiếu dữ liệu timesheet giờ công.");
      if (!payroll.insuranceEligible) warningMessages.push("Nhân sự chưa thuộc diện đóng BH bắt buộc theo cấu hình chính sách.");

      return {
        id: sid,
        name: staff.fullName || "Nhân viên",
        code: staff.employeeCode || null,
        role: staff.positionTitle || staff.roleName || "Nhân viên",
        department: mapDepartmentLabel(staff.department),
        avatar: staff.avatarUrl || staff.avatar || null,
        baseSalary: payroll.baseSalary,
        workDays: payroll.workDays,
        actualWorkDays: payroll.actualWorkDays,
        totalHours: payroll.totalHours,
        hourlyRate: payroll.hourlyRate,
        allowance: payroll.allowance,
        bonus: payroll.bonus,
        otherAddition: payroll.otherAddition,
        overtime: payroll.overtime,
        overtimeNormal: payroll.overtimeNormal,
        overtimeWeekend: payroll.overtimeWeekend,
        overtimeHoliday: payroll.overtimeHoliday,
        nightShiftExtra: payroll.nightShiftExtra,
        overtimeHours: payroll.overtimeHours,
        overtimeNormalHours: payroll.overtimeNormalHours,
        overtimeWeekendHours: payroll.overtimeWeekendHours,
        overtimeHolidayHours: payroll.overtimeHolidayHours,
        nightHours: payroll.nightHours,
        overtimeNightHours: payroll.overtimeNightHours,
        deduction: payroll.deduction,
        otherDeduction: payroll.otherDeduction,
        advance: payroll.advance,
        insuranceSocial: payroll.insuranceSocial,
        insuranceHealth: payroll.insuranceHealth,
        insuranceUnemployment: payroll.insuranceUnemployment,
        insuranceTotal: payroll.insuranceTotal,
        insuranceEmployerTotal: payroll.insuranceEmployerTotal,
        personalIncomeTax: payroll.personalIncomeTax,
        grossIncome: payroll.grossIncome,
        totalIncome: payroll.totalIncome,
        totalDeduction: payroll.totalDeduction,
        netSalary: payroll.netSalary,
        coefficient: Number(payroll.coefficient.toFixed(2)),
        status: payroll.payrollStatus,
        policyCode: payroll.policyCode,
        policyEffectiveFrom: payroll.policyEffectiveFrom,
        regionCode: payroll.regionCode,
        minimumWageMonthly: payroll.minimumWageMonthly,
        minimumWageHourly: payroll.minimumWageHourly,
        minimumWageViolation: payroll.minimumWageViolation,
        insuranceEligible: payroll.insuranceEligible,
        warningMessages,
      };
    });

    const totalPayroll = items.reduce(
      (sum, item) => sum + Number(item.netSalary || 0),
      0,
    );

    const paidAmount = items.reduce((sum, item) => {
      if (item.status !== "paid") return sum;
      return sum + Number(item.netSalary || 0);
    }, 0);

    const remaining = totalPayroll - paidAmount;
    const progress = totalPayroll > 0 ? Math.round((paidAmount / totalPayroll) * 100) : 0;

    return {
      stats: {
        totalPayroll,
        paidAmount,
        remaining,
        progress,
      },
      items,
    };
  },



  staffSchedulingAssistant: async (_, { restaurantId, horizonDays = 2, timezone = "Asia/Ho_Chi_Minh" }) => {
    return buildStaffSchedulingAssistant({
      restaurantId,
      horizonDays,
      timezone,
    });
  },

  staffShifts: async (
    _,
    { restaurantId, employeeId, startDate, endDate, status, limit = 500 },
    ctx,
  ) => {
    const filter = { userType: "STAFF" };
    const authUser = ctx?.user || null;
    const fallbackRestaurantId =
      restaurantId ||
      authUser?.restaurantForStaff ||
      authUser?.primaryRestaurantId ||
      null;
    const rid = toObjectId(fallbackRestaurantId);
    const eid = toObjectId(employeeId);

    if (rid) filter.restaurantId = rid;
    if (eid) filter.employeeId = eid;
    if (status) filter.status = status;

    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) filter.startTime.$gte = toStartOfDay(startDate);
      if (endDate) filter.startTime.$lte = toEndOfDay(endDate);
    }

    const rows = await Shift.find(filter)
      .sort({ startTime: 1 })
      .limit(Math.max(1, Math.min(Number(limit || 500), 2000)))
      .populate("employeeId", "fullName")
      .lean();

    return rows.map((row) => ({
      id: String(row._id),
      employeeId: String(row.employeeId?._id || row.employeeId),
      employeeName: row.employeeId?.fullName || null,
      restaurantId: String(row.restaurantId),
      shiftType: row.shiftType,
      startTime: row.startTime,
      endTime: row.endTime,
      status: row.status || "scheduled",
      notes: row.notes || "",
    }));
  },
};
