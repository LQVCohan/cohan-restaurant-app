export const PERFORMANCE_FORMULA_ITEMS = [
  {
    key: "productivity",
    label: "Năng suất",
    weight: 25,
    description: "Thời lượng làm thực tế / thời lượng ca được phân công; order chỉ tham khảo",
  },
  {
    key: "punctuality",
    label: "Đúng giờ",
    weight: 25,
    description: "Điểm nền 100, trừ lượt và phút đi trễ, về sớm, vắng mặt",
  },
  {
    key: "quality",
    label: "Chất lượng",
    weight: 20,
    description: "Điểm kỹ năng theo role; chỉ trừ khi có bằng chứng phù hợp vai trò",
  },
  {
    key: "managerReview",
    label: "Đánh giá quản lý",
    weight: 20,
    description: "Điểm tổng quan do quản lý nhập; thái độ/phối hợp là ngữ cảnh review",
  },
  {
    key: "compliance",
    label: "Tuân thủ",
    weight: 10,
    description: "Mỗi yêu cầu chỉnh công hiện trừ 7 điểm, có dữ liệu thì tối thiểu 75",
  },
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
