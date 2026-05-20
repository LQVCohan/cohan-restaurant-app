export const TABLE_STATUS_OPTIONS = [
  { value: "available", icon: "🟢", label: "Trống", color: "success" },
  { value: "occupied", icon: "🔴", label: "Có khách", color: "danger" },
  { value: "payment_pending", icon: "🟡", label: "Chờ thanh toán", color: "warning" },
  { value: "reserved", icon: "🔵", label: "Đã đặt", color: "primary" },
  { value: "cleaning", icon: "🧽", label: "Dọn dẹp", color: "secondary" },
  { value: "offline", icon: "⚫", label: "Tạm ngưng", color: "secondary" },
];

export const TABLE_AREA_OPTIONS = [
  { value: "standard", label: "Trong nhà" },
  { value: "booth", label: "Booth" },
  { value: "vip", label: "VIP" },
  { value: "outdoor", label: "Ngoài trời" },
  { value: "bar", label: "Bar" },
  { value: "private", label: "Riêng" },
];

export const TABLE_STATUS_LABELS = TABLE_STATUS_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

export const TABLE_AREA_LABELS = TABLE_AREA_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

export const getTableStatusConfig = (status) => {
  const found = TABLE_STATUS_OPTIONS.find((item) => item.value === status);
  return found
    ? { text: found.label, color: found.color, icon: found.icon }
    : { text: status || "Không rõ", color: "secondary", icon: "" };
};

export const getTableAreaLabel = (area) => TABLE_AREA_LABELS[area] || area || "Chưa rõ";
