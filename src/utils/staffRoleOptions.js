export const STAFF_ROLE_OPTIONS = [
  { slug: "server", name: "Server", label: "Nhân viên phục vụ", department: "service" },
  { slug: "supervisor", name: "Supervisor", label: "Giám sát ca", department: "service" },
  { slug: "host", name: "Host", label: "Đón khách / điều phối bàn", department: "service" },
  { slug: "cashier", name: "Cashier", label: "Thu ngân", department: "cashier" },
  { slug: "chef", name: "Chef", label: "Bếp trưởng", department: "kitchen" },
  { slug: "cook", name: "Cook", label: "Nhân viên bếp", department: "kitchen" },
  { slug: "kitchen_helper", name: "Kitchen Helper", label: "Phụ bếp", department: "kitchen" },
  { slug: "cleaner", name: "Cleaner", label: "Nhân viên vệ sinh", department: "cleaning" },
  { slug: "shipper", name: "Shipper", label: "Nhân viên giao hàng", department: "delivery" },
  { slug: "storekeeper", name: "Storekeeper", label: "Thủ kho", department: "inventory" },
  { slug: "bartender", name: "Bartender", label: "Nhân viên pha chế", department: "bar" },
];

export const DEPARTMENT_OPTIONS = [
  { value: "service", label: "🍽️ Phục vụ", description: "Đón khách, phục vụ, điều phối sảnh" },
  { value: "kitchen", label: "👨‍🍳 Bếp", description: "Chế biến món ăn, phụ bếp" },
  { value: "cashier", label: "💰 Thu ngân", description: "Thanh toán, thu chi" },
  { value: "cleaning", label: "🧹 Vệ sinh", description: "Giữ gìn vệ sinh" },
  { value: "delivery", label: "🚚 Giao hàng", description: "Giao đơn cho khách" },
  { value: "inventory", label: "📦 Kho", description: "Quản lý nguyên liệu, hàng hóa, nhập xuất kho" },
  { value: "bar", label: "🍸 Quầy bar", description: "Pha chế đồ uống, cocktail, đồ uống tại quầy" },
];

const DEFAULT_ROLE_BY_DEPARTMENT = {
  service: "server",
  kitchen: "cook",
  cashier: "cashier",
  cleaning: "cleaner",
  delivery: "shipper",
  inventory: "storekeeper",
  bar: "bartender",
};

const POSITION_TITLE_BY_ROLE = {
  server: "Nhân viên phục vụ",
  supervisor: "Giám sát ca",
  host: "Nhân viên đón khách",
  cashier: "Nhân viên thu ngân",
  chef: "Bếp trưởng",
  cook: "Nhân viên bếp",
  kitchen_helper: "Phụ bếp",
  cleaner: "Nhân viên vệ sinh",
  shipper: "Nhân viên giao hàng",
  storekeeper: "Thủ kho",
  bartender: "Nhân viên pha chế",
};

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

export const getStaffRolesByDepartment = (department) => {
  const normalizedDepartment = normalizeKey(department);
  return STAFF_ROLE_OPTIONS.filter((role) => role.department === normalizedDepartment);
};

export const getDefaultRoleByDepartment = (department) => {
  const normalizedDepartment = normalizeKey(department);
  const defaultSlug = DEFAULT_ROLE_BY_DEPARTMENT[normalizedDepartment];
  return (
    STAFF_ROLE_OPTIONS.find((role) => role.slug === defaultSlug) ||
    getStaffRolesByDepartment(normalizedDepartment)[0] ||
    null
  );
};

export const getPositionTitleSuggestion = (department, roleSlug) => {
  const normalizedRoleSlug = normalizeKey(roleSlug);
  const role =
    STAFF_ROLE_OPTIONS.find((item) => item.slug === normalizedRoleSlug) ||
    getDefaultRoleByDepartment(department);

  if (!role) return "";
  return POSITION_TITLE_BY_ROLE[role.slug] || role.label || role.name || "";
};

export const getStaffRoleOption = (roleSlug) => {
  const normalizedRoleSlug = normalizeKey(roleSlug);
  return STAFF_ROLE_OPTIONS.find((role) => role.slug === normalizedRoleSlug) || null;
};

export const STAFF_ROLE_LABEL_BY_SLUG = STAFF_ROLE_OPTIONS.reduce((acc, role) => {
  acc[role.slug] = role.label;
  return acc;
}, {});

export const STAFF_ROLE_SLUGS = STAFF_ROLE_OPTIONS.map((role) => role.slug);
