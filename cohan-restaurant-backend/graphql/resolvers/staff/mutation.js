// src/graphql/staff/mutation.js
import { Staff, Role, EventLog, Shift } from "../../../models/index.js";

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
    // Ép kiểu userType (HIỆN TẠI luôn là STAFF)
    const normalizedUserType = (input.userType || "STAFF")
      .toString()
      .toUpperCase();
    input.userType = normalizedUserType;

    // =========================
    // XÁC ĐỊNH ROLE CHO STAFF
    // =========================
    let roleDoc = null;

    // Nếu FE truyền roleId vào
    if (input.roleId) {
      roleDoc = await Role.findById(input.roleId).populate("parentRole");

      if (!roleDoc) {
        throw new Error("Role not found");
      }

      // Nếu userType là STAFF thì role phải thuộc nhóm 'staff'
      if (normalizedUserType === "STAFF") {
        const parentSlug =
          roleDoc.parentRole?.slug ||
          (roleDoc.parent ? roleDoc.parent.toString().toLowerCase() : null);

        if (parentSlug !== "staff" && roleDoc.slug !== "staff") {
          throw new Error(
            "Role không hợp lệ: nhân viên STAFF phải có role thuộc nhóm 'staff'"
          );
        }
      }
    } else {
      // Không truyền roleId -> dùng default staff role
      roleDoc =
        (await Role.findOne({ slug: "staff" }).populate("parentRole")) ||
        (await Role.findOne({ parent: "staff" }).populate("parentRole"));

      if (!roleDoc) {
        throw new Error(
          "Default staff role not found (slug='staff' or parent='staff')"
        );
      }
      // Với default này thì đương nhiên thuộc nhóm staff nên không cần check thêm
    }

    const roleId = roleDoc._id;

    const { password, primaryRestaurantId, refRestaurantIds, ...rest } = input;

    const doc = {
      ...rest,
      role: roleId,
    };

    // Chuẩn hoá enum để khớp Mongoose
    // EmploymentType: FULL_TIME -> full_time
    if (doc.employmentType) {
      doc.employmentType = doc.employmentType.toString().toLowerCase();
    }

    // EmploymentStatus: ON_LEAVE -> on_leave
    if (doc.employmentStatus) {
      doc.employmentStatus = doc.employmentStatus.toString().toLowerCase();
    }

    // ShiftType: MORNING -> morning, FULL_DAY -> full_day
    if (doc.shiftType) {
      doc.shiftType = doc.shiftType.toString().toLowerCase();
    }

    // StaffWorkingDay: [MON, TUE] -> ["mon", "tue"]
    if (doc.workingDays && Array.isArray(doc.workingDays)) {
      doc.workingDays = doc.workingDays.map((d) =>
        d != null ? d.toString().toLowerCase() : d
      );
    }

    // DepartmentType đã là lowercase (service, kitchen, ...) -> không cần đổi

    // Gán nhà hàng
    if (primaryRestaurantId) doc.primaryRestaurant = primaryRestaurantId;
    if (refRestaurantIds) doc.refRestaurants = refRestaurantIds;

    const staff = new Staff(doc);

    // Nếu FE có truyền password → hash luôn
    // Nếu không → hook pre('save') trong User.js sẽ tự generate (nếu em có thêm logic đó)
    if (password && password.trim() !== "") {
      await staff.setPassword(password.trim());
    }

    await staff.save();
    await staff.populate(["role", "refRestaurants", "primaryRestaurant"]);

    await logStaffEvent({
      staff,
      verb: "staff.create",
      ctx,
      meta: {
        roleId,
        userType: staff.userType,
        department: staff.department || null,
      },
    });

    return staff;
  },

  // =========================
  // UPDATE STAFF
  // =========================
  updateStaff: async (_, { userId, input }, ctx) => {
    const staff = await Staff.findById(userId);
    if (!staff || staff.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    const before = staff.toObject();

    // Map các field ID sang schema thực tế
    if (input.primaryRestaurantId) {
      input.primaryRestaurant = input.primaryRestaurantId;
      delete input.primaryRestaurantId;
    }

    if (input.refRestaurantIds) {
      input.refRestaurants = input.refRestaurantIds;
      delete input.refRestaurantIds;
    }

    // Chuẩn hoá enum giống như createStaff
    if (input.employmentType) {
      input.employmentType = input.employmentType.toString().toLowerCase();
    }

    if (input.employmentStatus) {
      input.employmentStatus = input.employmentStatus.toString().toLowerCase();
    }

    if (input.shiftType) {
      input.shiftType = input.shiftType.toString().toLowerCase();
    }

    if (input.workingDays && Array.isArray(input.workingDays)) {
      input.workingDays = input.workingDays.map((d) =>
        d != null ? d.toString().toLowerCase() : d
      );
    }

    // department từ GraphQL là DepartmentType (service, kitchen...) -> đã đúng format

    // Hỗ trợ đổi mật khẩu nếu có truyền trong input
    if (input.password && input.password.trim() !== "") {
      await staff.setPassword(input.password.trim());
      delete input.password;
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
          department: before.department,
          employmentType: before.employmentType,
          employmentStatus: before.employmentStatus,
          primaryRestaurant: before.primaryRestaurant,
        },
        after: {
          fullName: staff.fullName,
          employeeCode: staff.employeeCode,
          positionTitle: staff.positionTitle,
          department: staff.department,
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
    const staff = await Staff.findById(userId);

    if (!staff || staff.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    staff.status = "inactive";
    // Enum trong User.js: "working", "on_leave", "resigned", "suspended"
    staff.employmentStatus = "resigned";
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
  // SET STAFF EMPLOYMENT STATUS
  // =========================
  setStaffEmploymentStatus: async (_, { userId, employmentStatus }, ctx) => {
    const staff = await Staff.findById(userId);

    if (!staff || staff.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    const beforeStatus = staff.employmentStatus;

    // GraphQL: WORKING, ON_LEAVE, RESIGNED, SUSPENDED
    // Mongo: "working", "on_leave", "resigned", "suspended"
    const normalizedStatus = employmentStatus
      ? employmentStatus.toString().toLowerCase()
      : "";

    staff.employmentStatus = normalizedStatus;
    await staff.save();
    await staff.populate(["role", "refRestaurants", "primaryRestaurant"]);

    const verb =
      normalizedStatus === "on_leave"
        ? "staff.setOnLeave"
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
    const staff = await Staff.findById(userId);

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

  createStaffShift: async (_, { input }) => {
    const staff = await Staff.findById(input.employeeId).lean();
    if (!staff || staff.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    const created = await Shift.create({
      employeeId: input.employeeId,
      restaurantId: input.restaurantId,
      shiftType: input.shiftType.toString().toLowerCase(),
      startTime: new Date(input.startTime),
      endTime: new Date(input.endTime),
      status: input.status || "scheduled",
      notes: input.notes || "",
    });

    return {
      id: String(created._id),
      employeeId: String(created.employeeId),
      employeeName: staff.fullName || null,
      restaurantId: String(created.restaurantId),
      shiftType: created.shiftType,
      startTime: created.startTime,
      endTime: created.endTime,
      status: created.status,
      notes: created.notes || "",
    };
  },

  updateStaffShift: async (_, { shiftId, input }) => {
    const payload = { ...input };
    if (payload.shiftType) payload.shiftType = payload.shiftType.toString().toLowerCase();
    if (payload.startTime) payload.startTime = new Date(payload.startTime);
    if (payload.endTime) payload.endTime = new Date(payload.endTime);

    const updated = await Shift.findByIdAndUpdate(shiftId, payload, { new: true })
      .populate("employeeId", "fullName");
    if (!updated) throw new Error("Shift not found");

    return {
      id: String(updated._id),
      employeeId: String(updated.employeeId?._id || updated.employeeId),
      employeeName: updated.employeeId?.fullName || null,
      restaurantId: String(updated.restaurantId),
      shiftType: updated.shiftType,
      startTime: updated.startTime,
      endTime: updated.endTime,
      status: updated.status || "scheduled",
      notes: updated.notes || "",
    };
  },

  deleteStaffShift: async (_, { shiftId }) => {
    const deleted = await Shift.findByIdAndDelete(shiftId);
    return Boolean(deleted);
  },
};
