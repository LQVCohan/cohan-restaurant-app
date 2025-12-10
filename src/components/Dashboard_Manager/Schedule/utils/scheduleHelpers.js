export const shiftTypes = {
  morning: {
    label: "Ca Sáng",
    time: "06:00 - 14:00",
    startTime: "06:00",
    endTime: "14:00",
    icon: "🌅",
  },
  afternoon: {
    label: "Ca Chiều",
    time: "14:00 - 22:00",
    startTime: "14:00",
    endTime: "22:00",
    icon: "☀️",
  },
  night: {
    label: "Ca Đêm",
    time: "22:00 - 06:00",
    startTime: "22:00",
    endTime: "06:00",
    icon: "🌙",
  },
};

export const jobOptions = [
  { value: "chef", label: "Đầu bếp", emoji: "👨‍🍳" },
  { value: "cook", label: "Phụ bếp", emoji: "🍳" },
  { value: "waiter", label: "Phục vụ", emoji: "🍽️" },
  { value: "cashier", label: "Thu ngân", emoji: "💰" },
  { value: "cleaner", label: "Vệ sinh", emoji: "🧹" },
  { value: "host", label: "Tiếp tân", emoji: "🎯" },
  { value: "bartender", label: "Pha chế", emoji: "🍹" },
];

export const getJobName = (job) => {
  const found = jobOptions.find((j) => j.value === job);
  return found ? found.label : job;
};

export const getJobEmoji = (job) => {
  const found = jobOptions.find((j) => j.value === job);
  return found ? found.emoji : "👤";
};

// Màu sắc định danh cho từng vị trí (dùng cho badge)
export const getJobColor = (job) =>
  ({
    chef: "#dc2626", // Red
    cook: "#ea580c", // Orange
    waiter: "#2563eb", // Blue
    cashier: "#16a34a", // Green
    cleaner: "#4b5563", // Gray
    host: "#db2777", // Pink
    bartender: "#7c3aed", // Purple
  }[job] || "#4b5563");

export const getAvatarUrl = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name
  )}&background=random&color=fff&size=64`;

export const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};
export const getStatusText = (status) => {
  switch (status) {
    case "active":
      return "Hoạt động";
    case "inactive":
      return "Không hoạt động";
    case "on_leave":
      return "Đang nghỉ";
    default:
      return "Không xác định";
  }
};
export const getDayName = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("vi-VN", { weekday: "long" });
};
// Hàm lọc nhân viên đa năng
export const filterStaffByControls = (
  list,
  { search = "", job = "", status = "" }
) => {
  const q = search.trim().toLowerCase();
  return list.filter((p) => {
    if (status && p.status !== status) return false;
    if (job && p.job !== job) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      getJobName(p.job).toLowerCase().includes(q)
    );
  });
};
