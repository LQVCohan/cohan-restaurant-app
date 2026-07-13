const DEMO_TAG_PATTERN = /\s*\[(?:demo-menu-management-2026|defense-demo-2026)\]\s*/gi;

const EXACT_LABELS = {
  "COHAN Demo Business": "Thương hiệu mẫu COHAN",
  "COHAN Defense Demo Restaurant": "Nhà hàng mẫu COHAN",
  "COHAN Defense Demo Restaurant - Quận 1": "Nhà hàng mẫu COHAN - Quận 1",
  "Menu Demo Restaurant": "Nhà hàng thực đơn mẫu",
  "Morning Comfort": "Bữa sáng ấm áp",
  "Lunch Express": "Bữa trưa nhanh",
  "Night Specials": "Món đặc biệt buổi tối",
  "Breakfast Menu": "Thực đơn bữa sáng",
  "Lunch Menu": "Thực đơn bữa trưa",
  "Dinner Menu": "Thực đơn bữa tối",
  "Late Night Menu": "Thực đơn đêm muộn",
  Noodles: "Món sợi",
  Drinks: "Đồ uống",
  Grill: "Món nướng",
  "Main Demo Warehouse": "Kho mẫu chính",
  "Rice Noodle": "Bánh phở",
  "Beef Slice": "Thịt bò thái lát",
  "Milk Tea Base": "Nền trà sữa",
  "Pho Signature": "Phở đặc biệt",
  "Milk Tea Classic": "Trà sữa truyền thống",
  "Beef Grill Plate": "Đĩa bò nướng",
  "Night Soup": "Súp buổi tối",
  Regular: "Phần thường",
  "By Weight": "Theo khối lượng",
};

const DEMO_PERSON_LABELS = {
  admin: "Quản trị viên mẫu",
  "business owner": "Chủ thương hiệu mẫu",
  manager: "Quản lý mẫu",
  customer: "Khách hàng mẫu",
  server: "Nhân viên mẫu - Phục vụ",
  supervisor: "Nhân viên mẫu - Giám sát",
  host: "Nhân viên mẫu - Đón khách",
  cashier: "Nhân viên mẫu - Thu ngân",
  chef: "Nhân viên mẫu - Bếp trưởng",
  cook: "Nhân viên mẫu - Bếp",
  "kitchen helper": "Nhân viên mẫu - Phụ bếp",
  cleaner: "Nhân viên mẫu - Vệ sinh",
  shipper: "Nhân viên mẫu - Giao hàng",
  storekeeper: "Nhân viên mẫu - Thủ kho",
  bartender: "Nhân viên mẫu - Pha chế",
};

const normalizeSpace = (value) => String(value || "").replace(/\s+/g, " ").trim();

const stripDemoTags = (value) =>
  normalizeSpace(String(value || "").replace(DEMO_TAG_PATTERN, " "));

const localizeDemoPerson = (value) => {
  const match = value.match(/^(?:COHAN\s+)?Demo\s+(.+?)(\s+-\s+.+)?$/i);
  if (!match) return "";

  const personType = normalizeSpace(match[1]).toLowerCase();
  const localized = DEMO_PERSON_LABELS[personType];
  if (!localized) return "";

  return `${localized}${match[2] || ""}`;
};

export const localizeDemoLabel = (value, fallback = "") => {
  const cleanValue = stripDemoTags(value);
  if (!cleanValue) return fallback;

  const exactLabel = EXACT_LABELS[cleanValue];
  if (exactLabel) return exactLabel;

  const localizedPerson = localizeDemoPerson(cleanValue);
  if (localizedPerson) return localizedPerson;

  return cleanValue;
};

export const localizeDemoLabelList = (values = []) =>
  (Array.isArray(values) ? values : []).map((value) => localizeDemoLabel(value));

export { stripDemoTags };
