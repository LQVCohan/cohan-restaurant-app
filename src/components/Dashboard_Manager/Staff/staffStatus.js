const ACCOUNT_STATUSES = new Set(["active", "inactive", "blocked", "pending"]);
const EMPLOYMENT_STATUSES = new Set([
  "WORKING",
  "ON_LEAVE",
  "RESIGNED",
  "SUSPENDED",
]);

export const normalizeAccountStatus = (status) => {
  const normalized = String(status || "active")
    .trim()
    .toLowerCase();

  return ACCOUNT_STATUSES.has(normalized) ? normalized : "active";
};

export const normalizeEmploymentStatus = (status) => {
  const normalized = String(status || "WORKING")
    .trim()
    .toUpperCase();

  return EMPLOYMENT_STATUSES.has(normalized) ? normalized : "WORKING";
};

export const getStaffListStatus = ({ accountStatus, employmentStatus }) => {
  if (employmentStatus === "ON_LEAVE") return "break";

  if (
    employmentStatus === "RESIGNED" ||
    employmentStatus === "SUSPENDED" ||
    accountStatus === "blocked" ||
    accountStatus === "inactive" ||
    accountStatus === "pending"
  ) {
    return "inactive";
  }

  return "active";
};

export const getStaffDetailStatusInfo = ({
  accountStatus,
  employmentStatus,
}) => {
  if (accountStatus === "blocked") {
    return { key: "blocked", label: "Tài khoản bị khóa", color: "danger" };
  }

  if (employmentStatus === "ON_LEAVE") {
    return { key: "break", label: "Nghỉ phép", color: "warning" };
  }

  if (employmentStatus === "RESIGNED") {
    return { key: "inactive", label: "Đã nghỉ việc", color: "danger" };
  }

  if (employmentStatus === "SUSPENDED") {
    return { key: "inactive", label: "Tạm ngưng công tác", color: "danger" };
  }

  if (accountStatus === "inactive") {
    return { key: "inactive", label: "Tài khoản tạm ngưng", color: "danger" };
  }

  if (accountStatus === "pending") {
    return { key: "pending", label: "Chờ kích hoạt", color: "warning" };
  }

  return { key: "active", label: "Đang làm việc", color: "success" };
};

export const getStaffActionAvailability = ({
  accountStatus,
  employmentStatus,
}) => ({
  canSetOnLeave:
    accountStatus === "active" && employmentStatus === "WORKING",
  canSetWorking:
    accountStatus === "active" && employmentStatus === "ON_LEAVE",
  canSetResigned: employmentStatus !== "RESIGNED",
  canLock: accountStatus !== "blocked",
  canUnlock: accountStatus === "blocked",
});
