export const PERFORMANCE_FORMULA_ITEMS = [
  { key: "productivity", label: "Năng suất", weight: 25, description: "Tỷ lệ hoàn thành ca được phân công" },
  { key: "punctuality", label: "Đúng giờ", weight: 25, description: "Đi trễ, về sớm, vắng mặt" },
  { key: "quality", label: "Chất lượng", weight: 20, description: "Kỹ năng/chất lượng chuyên môn theo vai trò" },
  { key: "managerReview", label: "Đánh giá quản lý", weight: 20, description: "Đánh giá tổng quan của quản lý" },
  { key: "compliance", label: "Tuân thủ", weight: 10, description: "Tuân thủ quy trình/chỉnh công" },
];

export const formatContributionScore = (value) => {
  const n = Number(value || 0);
  return `${Math.round(n * 100) / 100}`;
};

export const resolveComponentWeight = (component, defaultWeight) => {
  const componentWeight = Number(component?.weight);
  if (Number.isFinite(componentWeight)) return componentWeight;
  return Number(defaultWeight) || 0;
};

export const getWeightedContribution = (score, weight) => {
  const safeScore = Number(score);
  const safeWeight = Number(weight);
  if (!Number.isFinite(safeScore) || !Number.isFinite(safeWeight)) return 0;
  return (safeScore * safeWeight) / 100;
};

export const calculateFormulaScore = (snapshot = {}) =>
  PERFORMANCE_FORMULA_ITEMS.reduce((total, item) => {
    const component = snapshot?.[item.key];
    const componentWeight = resolveComponentWeight(component, item.weight);
    return total + getWeightedContribution(component?.score, componentWeight);
  }, 0);
