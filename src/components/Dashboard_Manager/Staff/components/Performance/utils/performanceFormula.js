export const PERFORMANCE_FORMULA_ITEMS = [
  {
    key: "productivity",
    label: "Năng suất",
    weight: 25,
    description: "Mọi role: thời lượng làm thực tế / thời lượng ca được phân công; order chỉ là bằng chứng tham khảo.",
  },
  {
    key: "punctuality",
    label: "Đúng giờ",
    weight: 25,
    description: "Mọi role: nền 100, trừ theo lượt/phút đi trễ, về sớm, vắng mặt; đây là nơi duy nhất tính attendance.",
  },
  {
    key: "quality",
    label: "Chất lượng",
    weight: 20,
    description: "Phục vụ/host: phản hồi khách; thu ngân: lỗi nghiệp vụ; bếp/bar: work item; role khác: kỹ năng quản lý; chỉ trừ khi có bằng chứng đúng role.",
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
    description: "Mọi role: mỗi yêu cầu chỉnh công trừ 7 điểm trong Tuân thủ; incident ngoài chấm công chỉ cộng/trừ sau duyệt; điểm thành phần có sàn 75 khi đủ dữ liệu.",
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
