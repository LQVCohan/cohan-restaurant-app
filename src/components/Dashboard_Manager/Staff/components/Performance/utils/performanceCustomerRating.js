const safeFactorNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const formatCustomerRating = (factors = {}) => {
  const staffRateCount = safeFactorNumber(factors?.staffRateCount, 0);
  if (staffRateCount <= 0) {
    return {
      hasRating: false,
      label: "Chưa có đánh giá khách hàng",
      hint: "Đánh giá khách hàng không tự động thay đổi điểm hiệu suất. Quản lý có thể dùng thông tin này để cân nhắc khi nhập đánh giá.",
    };
  }

  const staffRate = safeFactorNumber(factors?.staffRate, 0);
  const customerRatingScore = safeFactorNumber(
    factors?.customerRatingScore,
    staffRate * 20,
  );
  const normalizedRate = Math.round(staffRate * 100) / 100;
  const normalizedScore = Math.round(customerRatingScore * 100) / 100;

  return {
    hasRating: true,
    label: `Đánh giá khách hàng: ${normalizedRate}/5 (${staffRateCount} lượt)`,
    hint: `Quy đổi tham khảo: ${normalizedScore}/100`,
  };
};
