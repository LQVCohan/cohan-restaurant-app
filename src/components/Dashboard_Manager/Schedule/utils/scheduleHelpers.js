import {
  STAFF_ROLE_LABEL_BY_SLUG,
  STAFF_ROLE_OPTIONS,
  STAFF_ROLE_SLUGS,
} from "../../../../utils/staffRoleOptions";

export const SHIFT_RULE_STORAGE_KEY = "cohan.schedule.shiftRules.v1";

const SMART_SHIFT_PRESETS = {
  2: [
    {
      type: "morning",
      label: "Ca Sáng",
      startTime: "06:00",
      endTime: "14:00",
      icon: "🌅",
    },
    {
      type: "evening",
      label: "Ca Tối",
      startTime: "14:00",
      endTime: "23:00",
      icon: "🌙",
    },
  ],
  3: [
    {
      type: "morning",
      label: "Ca Sáng",
      startTime: "06:00",
      endTime: "14:00",
      icon: "🌅",
    },
    {
      type: "afternoon",
      label: "Ca Chiều",
      startTime: "14:00",
      endTime: "18:00",
      icon: "☀️",
    },
    {
      type: "evening",
      label: "Ca Tối",
      startTime: "18:00",
      endTime: "23:00",
      icon: "🌙",
    },
  ],
};

const SHIFT_ICON_BY_TYPE = {
  morning: "🌅",
  afternoon: "☀️",
  evening: "🌙",
  night: "🌃",
};

const ROLE_EMOJI = {
  server: "🍽️",
  supervisor: "🎯",
  host: "🛎️",
  cashier: "💰",
  chef: "👨‍🍳",
  cook: "🍳",
  kitchen_helper: "🥣",
  cleaner: "🧹",
  shipper: "🚚",
  storekeeper: "📦",
  bartender: "🍸",
};

const ROLE_COLOR = {
  chef: "#dc2626",
  cook: "#ea580c",
  kitchen_helper: "#f97316",
  server: "#2563eb",
  supervisor: "#0f766e",
  host: "#db2777",
  cashier: "#16a34a",
  cleaner: "#4b5563",
  shipper: "#0891b2",
  storekeeper: "#7c2d12",
  bartender: "#7c3aed",
};

export const ROLE_ALIAS_MAP = {
  service: "server",
  server: "server",
  cashier: "cashier",
  kitchen: "cook",
  cook: "cook",
  chef: "chef",
  kitchen_helper: "kitchen_helper",
  cleaning: "cleaner",
  cleaner: "cleaner",
  delivery: "shipper",
  shipper: "shipper",
  inventory: "storekeeper",
  storekeeper: "storekeeper",
  bar: "bartender",
  bartender: "bartender",
  management: "supervisor",
  supervisor: "supervisor",
  staff: "",
};

export const normalizeRoleKey = (role) => {
  const key = String(role || "").trim().toLowerCase();
  return ROLE_ALIAS_MAP[key] || key;
};

const POSITION_TITLE_ROLE_MAP = [
  [/giám sát/, "supervisor"],
  [/đón khách|đieu phoi ban|điều phối bàn|host/, "host"],
  [/bếp trưởng/, "chef"],
  [/phụ bếp/, "kitchen_helper"],
  [/nhân viên bếp|\bbếp\b|cook/, "cook"],
  [/thu ngân|cashier/, "cashier"],
  [/phục vụ|server/, "server"],
  [/vệ sinh|cleaner/, "cleaner"],
  [/giao hàng|shipper|delivery/, "shipper"],
  [/thủ kho|storekeeper|inventory/, "storekeeper"],
  [/pha chế|bartender|bar/, "bartender"],
];

export const resolveConcreteStaffRoleSlug = (
  staff = {},
  { allowDepartmentFallback = false } = {},
) => {
  const fromRoleSlug = normalizeRoleKey(staff?.role?.slug || staff?.roleSlug);
  if (STAFF_ROLE_SLUGS.includes(fromRoleSlug)) return fromRoleSlug;

  const fromRoleName = normalizeRoleKey(staff?.roleName);
  if (STAFF_ROLE_SLUGS.includes(fromRoleName)) return fromRoleName;

  const normalizedTitle = String(staff?.positionTitle || "")
    .trim()
    .toLowerCase();
  const matched = POSITION_TITLE_ROLE_MAP.find(([pattern]) =>
    pattern.test(normalizedTitle),
  );
  if (matched) return matched[1];

  if (!allowDepartmentFallback) return "";
  const byDepartment = normalizeRoleKey(staff?.department);
  const maybeSlug = ROLE_ALIAS_MAP[byDepartment] || "";
  return STAFF_ROLE_SLUGS.includes(maybeSlug) ? maybeSlug : "";
};

export const toShiftMinutes = (timeText) => {
  if (!/^\d{2}:\d{2}$/.test(String(timeText || ""))) return null;
  const [hour, minute] = timeText.split(":").map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
};

export const normalizeShiftRule = (rule) => {
  const type = String(rule?.type || rule?.key || "")
    .trim()
    .toLowerCase();
  const startTime = String(rule?.startTime || "");
  const endTime = String(rule?.endTime || "");

  return {
    type,
    label: String(rule?.label || rule?.type || rule?.key || ""),
    startTime,
    endTime,
    icon: rule?.icon || SHIFT_ICON_BY_TYPE[type] || "⏱️",
    time: `${startTime} - ${endTime}`,
  };
};

export const buildSmartShiftRules = (count = 3) =>
  (SMART_SHIFT_PRESETS[count] || SMART_SHIFT_PRESETS[3]).map(normalizeShiftRule);

export const resizeShiftRules = (rules = [], count = 3) => {
  const targetCount = count <= 2 ? 2 : 3;
  const presets = buildSmartShiftRules(targetCount);
  const current = (rules || []).map(normalizeShiftRule);
  const currentByType = new Map(current.map((rule) => [rule.type, rule]));

  const resized = presets.map((preset) => currentByType.get(preset.type) || preset);

  if (resized.length < targetCount) {
    current.forEach((rule) => {
      if (
        resized.length < targetCount &&
        !resized.some((item) => item.type === rule.type)
      ) {
        resized.push(rule);
      }
    });
  }

  return resized.slice(0, targetCount).map(normalizeShiftRule);
};

export const shiftTemplatesToRules = (templates = []) =>
  (templates || [])
    .filter((template) => template?.enabled !== false)
    .map((template) =>
      normalizeShiftRule({
        type: template.key,
        label: template.label || template.key,
        startTime: template.startTime,
        endTime: template.endTime,
        icon: SHIFT_ICON_BY_TYPE[String(template.key || "").toLowerCase()],
      }),
    );

export const shiftRulesToTypes = (rules = []) =>
  rules.reduce((acc, rule) => {
    const normalized = normalizeShiftRule(rule);
    if (!normalized.type) return acc;
    acc[normalized.type] = {
      label: normalized.label,
      time: `${normalized.startTime} - ${normalized.endTime}`,
      startTime: normalized.startTime,
      endTime: normalized.endTime,
      icon: normalized.icon,
    };
    return acc;
  }, {});

export const validateShiftRules = (rules = []) => {
  const errors = [];
  const normalizedRules = (rules || []).map(normalizeShiftRule);
  const seenTypes = new Set();

  if (normalizedRules.length < 2 || normalizedRules.length > 3) {
    errors.push("Cần cấu hình từ 2 đến 3 khung ca.");
  }

  normalizedRules.forEach((rule, index) => {
    const label = rule.label || `Ca ${index + 1}`;
    const start = toShiftMinutes(rule.startTime);
    const end = toShiftMinutes(rule.endTime);

    if (!rule.type) {
      errors.push(`${label}: thiếu loại ca.`);
    } else if (seenTypes.has(rule.type)) {
      errors.push(`${label}: loại ca "${rule.type}" bị trùng.`);
    } else {
      seenTypes.add(rule.type);
    }

    if (start == null || end == null) {
      errors.push(`${label}: giờ bắt đầu/kết thúc không hợp lệ.`);
      return;
    }

    if (start === end) {
      errors.push(`${label}: giờ kết thúc phải khác giờ bắt đầu.`);
    }
    // end < start is a supported cross-day shift. The concrete shift builder
    // advances endTime to the following day and the backend stores allowCrossDay.
  });

  return {
    ok: errors.length === 0,
    errors,
    message: errors.join(" "),
  };
};

const getScopedStorageKey = (scopeKey) => {
  const normalized = String(scopeKey || "").trim();
  return normalized
    ? `${SHIFT_RULE_STORAGE_KEY}.${normalized}`
    : SHIFT_RULE_STORAGE_KEY;
};

export const loadStoredShiftRules = (scopeKey) => {
  if (typeof window === "undefined") return buildSmartShiftRules(3);
  try {
    const scopedKey = getScopedStorageKey(scopeKey);
    const raw =
      window.localStorage.getItem(scopedKey) ||
      (scopeKey ? window.localStorage.getItem(SHIFT_RULE_STORAGE_KEY) : null);
    const parsed = JSON.parse(raw || "null");
    if (Array.isArray(parsed) && validateShiftRules(parsed).ok) {
      return parsed.map(normalizeShiftRule);
    }
  } catch {
    // Fall through to default rules.
  }
  return buildSmartShiftRules(3);
};

export const persistShiftRules = (rules, scopeKey) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    getScopedStorageKey(scopeKey),
    JSON.stringify((rules || []).map(normalizeShiftRule)),
  );
};

export const shiftTypes = shiftRulesToTypes(buildSmartShiftRules(3));

export const jobOptions = STAFF_ROLE_OPTIONS.map((role) => ({
  value: role.slug,
  label: role.label,
  emoji: ROLE_EMOJI[role.slug] || "👤",
}));

export const getJobName = (job) => {
  const normalized = normalizeRoleKey(job);
  return (
    STAFF_ROLE_LABEL_BY_SLUG[normalized] ||
    jobOptions.find((item) => item.value === normalized)?.label ||
    job
  );
};

export const getJobEmoji = (job) => {
  const found = jobOptions.find((item) => item.value === job);
  return found ? found.emoji : "👤";
};

export const getJobColor = (job) => ROLE_COLOR[job] || "#4b5563";

export const getAvatarUrl = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name,
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
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", { weekday: "long" });
};

export const filterStaffByControls = (
  list,
  { search = "", job = "", status = "" },
) => {
  const q = search.trim().toLowerCase();
  return list.filter((person) => {
    if (status && person.status !== status) return false;
    if (job && person.job !== job) return false;
    if (!q) return true;
    return (
      person.name.toLowerCase().includes(q) ||
      getJobName(person.job).toLowerCase().includes(q)
    );
  });
};
