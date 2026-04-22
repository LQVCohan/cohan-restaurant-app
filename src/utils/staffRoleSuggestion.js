const ROLE_BY_DEPARTMENT_AI = {
  management: "host",
  kitchen: "cook",
  service: "waiter",
  cashier: "cashier",
  cleaning: "cleaner",
  delivery: "waiter",
};

const POSITION_TITLE_BY_ROLE = {
  host: "Điều phối sảnh",
  cook: "Nhân viên bếp",
  waiter: "Nhân viên phục vụ",
  cashier: "Nhân viên thu ngân",
  cleaner: "Nhân viên vệ sinh",
};

/**
 * Gợi ý chức vụ theo bộ phận.
 * Mapping được trích/adapt theo roleFromDepartment trong
 * cohan-restaurant-backend/src/services/ai/staffSchedulingAssistant.service.js
 */
export const getAiSuggestedPositionTitle = (department) => {
  const normalizedDepartment = String(department || "").toLowerCase();
  const roleKey = ROLE_BY_DEPARTMENT_AI[normalizedDepartment];
  if (!roleKey) return "";
  return POSITION_TITLE_BY_ROLE[roleKey] || "";
};

export const AI_POSITION_HINT =
  "Chọn bộ phận trước để nhận gợi ý chức vụ từ A.I. (chỉ tham khảo, không tự ghi đè).";

