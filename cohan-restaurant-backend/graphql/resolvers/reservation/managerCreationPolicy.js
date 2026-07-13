const MANAGEMENT_ROLE_MARKERS = [
  "manager",
  "admin",
  "owner",
  "quản lý",
  "quan ly",
];

function normalizeRoleValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function isManagerReservationActor(user) {
  if (!user) return false;

  const roleValues = [
    user.userType,
    user.roleName,
    user.role?.slug,
    user.role?.name,
    typeof user.role === "string" ? user.role : "",
  ]
    .map(normalizeRoleValue)
    .filter(Boolean);

  return roleValues.some((roleValue) =>
    MANAGEMENT_ROLE_MARKERS.some((marker) => roleValue.includes(marker)),
  );
}

export function buildManagerReservationNote(managerName, note) {
  const safeManagerName = String(managerName || "").trim() || "không rõ tên";
  const managerPrefix = `Quản lý ${safeManagerName} đặt`;
  const safeNote = String(note || "").trim();

  if (!safeNote) return managerPrefix;
  if (safeNote.toLowerCase().startsWith(managerPrefix.toLowerCase())) {
    return safeNote;
  }
  return `${managerPrefix} | ${safeNote}`;
}

export function withManagerReservationCreation(
  baseMutation,
  createManagerReservation,
) {
  if (typeof baseMutation?.createReservation !== "function") {
    throw new TypeError("baseMutation.createReservation must be a function");
  }
  if (typeof createManagerReservation !== "function") {
    throw new TypeError("createManagerReservation must be a function");
  }

  return {
    ...baseMutation,
    async createReservation(parent, args, ctx, info) {
      if (!isManagerReservationActor(ctx?.user)) {
        return baseMutation.createReservation(parent, args, ctx, info);
      }
      return createManagerReservation(parent, args, ctx, info);
    },
  };
}
