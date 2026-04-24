import { getPositionTitleSuggestion } from "./staffRoleOptions";

export const getAiSuggestedPositionTitle = (department, roleSlug) =>
  getPositionTitleSuggestion(department, roleSlug);

export const AI_POSITION_HINT =
  "Chọn bộ phận và vai trò trước để nhận gợi ý tên hiển thị/chức danh từ A.I. Gợi ý chỉ hỗ trợ nhập nhanh và không tự ghi đè nội dung bạn đã sửa.";
