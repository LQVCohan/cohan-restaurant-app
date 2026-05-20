import { KitchenShiftRosterSnapshot, Shift, Staff } from "../../../models/index.js";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function buildStaffSignals(staff) {
  return [
    normalizeText(staff?.department),
    normalizeText(staff?.positionTitle),
    normalizeText(staff?.roleName),
    normalizeText(staff?.role?.name),
    normalizeText(staff?.roleSlug),
    normalizeText(staff?.role?.slug),
  ].join(" ");
}

export function resolveKitchenStation(staff) {
  const signals = buildStaffSignals(staff);
  if (!signals) return null;

  if (/(bar|bartender|pha chế)/.test(signals)) return "bar";
  if (/(kitchen|cook|chef|bếp|đầu bếp|phụ bếp)/.test(signals)) return "kitchen";

  return null;
}

export function resolveKitchenDutyRole(staff, station) {
  const signals = buildStaffSignals(staff);

  if (station === "bar") {
    if (/(lead|trưởng|bar_lead|head)/.test(signals)) return "bar_lead";
    return "bar_staff";
  }

  if (station === "kitchen") {
    if (/(head_chef|chef|bếp trưởng|trưởng bếp)/.test(signals)) return "head_chef";
    if (/(cook|đầu bếp|bếp chính)/.test(signals)) return "cook";
    if (/(assistant|phụ bếp|kitchen_helper)/.test(signals)) return "assistant_chef";
    if (/(helper)/.test(signals)) return "helper";
  }

  return "team";
}

export async function syncKitchenShiftRosterSnapshotsForPublication({
  restaurantId,
  publication,
  periodStart,
  periodEnd,
  shifts,
  actorUserId,
  source,
}) {
  if (!publication?._id) {
    return { createdCount: 0, supersededCount: 0 };
  }

  const resolvedShifts = Array.isArray(shifts)
    ? shifts
    : await Shift.find({
        restaurantId,
        startTime: { $gte: periodStart, $lte: periodEnd },
        status: { $ne: "cancelled" },
      }).lean();

  const supersededResult = await KitchenShiftRosterSnapshot.updateMany(
    {
      restaurantId,
      schedulePublicationId: publication._id,
      status: "active",
    },
    {
      $set: {
        status: "superseded",
        supersededAt: new Date(),
        updatedBy: actorUserId,
      },
    },
  );

  const employeeIds = [
    ...new Set(resolvedShifts.map((shift) => String(shift?.employeeId || "")).filter(Boolean)),
  ];

  const staffs = employeeIds.length
    ? await Staff.find({ _id: { $in: employeeIds } })
        .select(
          "_id fullName employeeCode department positionTitle roleName role deletedAt userType restaurantForStaff",
        )
        .populate("role", "slug name")
        .lean()
    : [];

  const staffById = new Map(staffs.map((staff) => [String(staff._id), staff]));

  const version = Date.now();
  const docs = resolvedShifts
    .map((shift) => {
      const staff = staffById.get(String(shift?.employeeId || ""));
      if (!staff) return null;
      const roleSlug = staff?.roleSlug || staff?.role?.slug || null;
      const station = resolveKitchenStation({ ...staff, roleSlug });
      if (!station) return null;

      return {
        restaurantId,
        schedulePublicationId: publication._id,
        shiftId: shift._id,
        employeeId: shift.employeeId,
        employeeName: staff.fullName || null,
        employeeCode: staff.employeeCode || null,
        department: staff.department || null,
        positionTitle: staff.positionTitle || null,
        roleName: staff.roleName || staff?.role?.name || null,
        roleSlug,
        shiftType: shift.shiftType || null,
        startTime: shift.startTime,
        endTime: shift.endTime,
        station,
        kitchenDutyRole: resolveKitchenDutyRole({ ...staff, roleSlug }, station),
        version,
        status: "active",
        source,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      };
    })
    .filter(Boolean);

  if (!docs.length) {
    return {
      createdCount: 0,
      supersededCount: supersededResult?.modifiedCount || 0,
    };
  }

  const inserted = await KitchenShiftRosterSnapshot.insertMany(docs);
  return {
    createdCount: inserted.length,
    supersededCount: supersededResult?.modifiedCount || 0,
  };
}
