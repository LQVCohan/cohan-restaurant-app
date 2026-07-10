import { getStaffRoleDisplayLabel } from "../../../utils/staffRoleOptions";
import {
  getStaffListStatus,
  normalizeAccountStatus,
  normalizeEmploymentStatus,
} from "./staffStatus";

export const formatStaffAddress = (address) => {
  if (!address) return "";
  if (typeof address === "string") return address.trim();
  if (typeof address !== "object") return String(address);

  return [
    address.line1,
    address.line2,
    address.ward,
    address.district,
    address.city,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
};

export const mapStaffToEmployee = (staff = {}) => {
  const accountStatus = normalizeAccountStatus(staff.status);
  const employmentStatus = normalizeEmploymentStatus(staff.employmentStatus);
  const roleLabel =
    getStaffRoleDisplayLabel(staff.role) ||
    getStaffRoleDisplayLabel(staff.roleName) ||
    getStaffRoleDisplayLabel(staff.role?.slug);
  const avatarUrl =
    staff.avatarUrl ||
    staff.avatar ||
    staff.photoUrl ||
    staff.profileImage ||
    "";

  return {
    id: staff.id || staff._id,
    name: staff.fullName || staff.name || "",
    code: staff.employeeCode,
    role: staff.positionTitle || roleLabel || "Chưa gán vị trí",
    roleId: staff.role?.id || staff.role?._id || null,
    roleSlug: staff.role?.slug || "",
    roleName: roleLabel || staff.roleName || "",
    positionTitle: staff.positionTitle || "",
    department: staff.department,
    status: getStaffListStatus({ accountStatus, employmentStatus }),
    accountStatus,
    employmentStatus,
    email: staff.email,
    phone: staff.phone,
    username: staff.username,
    avatar: avatarUrl,
    avatarUrl,
    startDate: staff.dateJoined
      ? new Date(staff.dateJoined).toLocaleDateString("vi-VN")
      : "---",
    shift: staff.shiftType || "Ca xoay",
    baseSalary: staff.baseSalary ?? null,
    salary: staff.baseSalary ?? null,
    address: formatStaffAddress(staff.address),
    employmentType: staff.employmentType,
    workingDays: Array.isArray(staff.workingDays) ? staff.workingDays : [],
    dateLeft: staff.dateLeft,
    taxCode: staff.taxCode,
    emergencyContact: staff.emergencyContact,
    noteInternal: staff.noteInternal,
    emailVerified: Boolean(staff.emailVerified),
    phoneVerified: Boolean(staff.phoneVerified),
    verificationStatus:
      staff.emailVerified || staff.phoneVerified
        ? "verified"
        : accountStatus === "pending"
          ? "pending"
          : "unverified",
    verificationLabel: staff.emailVerified
      ? "Đã xác minh email"
      : staff.phoneVerified
        ? "Đã xác minh SĐT"
        : accountStatus === "pending"
          ? "Chờ xác minh"
          : "Chưa xác minh",
    canResendVerification: Boolean(
      (staff.email && !staff.emailVerified) ||
        (staff.phone && !staff.phoneVerified),
    ),
    raw: staff,
  };
};
