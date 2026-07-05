const safeFactorNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const formatScoreValue = (value) => Math.round(safeFactorNumber(value, 0) * 100) / 100;

export const formatCustomerRating = (factors = {}) => {
  const staffRateCount = safeFactorNumber(factors?.staffRateCount, 0);
  if (staffRateCount <= 0) {
    return {
      hasRating: false,
      affectsScore: false,
      label: "Chưa có đánh giá khách hàng",
      hint: "Chưa có dữ liệu đánh giá để đối chiếu thành phần Chất lượng.",
    };
  }

  const staffRate = safeFactorNumber(factors?.staffRate, 0);
  const customerRatingScore = safeFactorNumber(
    factors?.customerRatingScore,
    staffRate * 20,
  );
  const normalizedRate = formatScoreValue(staffRate);
  const normalizedScore = formatScoreValue(customerRatingScore);
  const ratingEvidence = factors?.customerRatingEvidence || null;
  const customerPenalty = safeFactorNumber(
    ratingEvidence?.customerPenalty ?? factors?.customerPenalty,
    0,
  );
  const affectsScore = customerPenalty > 0;

  let hint = `Quy đổi tham khảo: ${normalizedScore}/100`;
  if (ratingEvidence) {
    if (staffRateCount < 3) {
      hint = `Quy đổi ${normalizedScore}/100; chưa đủ 3 lượt nên chưa điều chỉnh điểm Chất lượng.`;
    } else if (affectsScore) {
      hint = `Quy đổi ${normalizedScore}/100; đã giảm ${formatScoreValue(customerPenalty)} điểm trong thành phần Chất lượng theo vai trò.`;
    } else {
      hint = `Quy đổi ${normalizedScore}/100; không phát sinh điều chỉnh điểm Chất lượng trong kỳ.`;
    }
  }

  return {
    hasRating: true,
    affectsScore,
    customerPenalty: formatScoreValue(customerPenalty),
    label: `Đánh giá khách hàng: ${normalizedRate}/5 (${staffRateCount} lượt)`,
    hint,
  };
};
