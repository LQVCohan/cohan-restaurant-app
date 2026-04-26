import React from "react";

const ROLE_LABELS = {
  server: "Phục vụ",
  supervisor: "Giám sát ca",
  host: "Đón khách",
  cashier: "Thu ngân",
  chef: "Bếp trưởng",
  cook: "Bếp",
  kitchen_helper: "Phụ bếp",
  cleaner: "Vệ sinh",
  shipper: "Giao hàng",
  storekeeper: "Kho",
  bartender: "Pha chế",
};

const SCORE_LEVELS = [
  {
    min: 85,
    label: "Rất phù hợp",
    tone: "excellent",
    description: "Nên ưu tiên xếp nếu không có ràng buộc khác.",
  },
  {
    min: 70,
    label: "Phù hợp",
    tone: "good",
    description: "Có thể xếp ca an toàn.",
  },
  {
    min: 50,
    label: "Cân nhắc",
    tone: "medium",
    description: "Có thể dùng nhưng nên xem lại cảnh báo và tải làm việc.",
  },
  {
    min: 0,
    label: "Rủi ro",
    tone: "risk",
    description: "Chỉ nên dùng khi thiếu lựa chọn tốt hơn.",
  },
];

const compactNumber = (value, digits = 1) =>
  new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: digits,
  }).format(Number(value || 0));

const normalizeScore = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
};

const getScoreLevel = (value) => {
  const score = normalizeScore(value);
  if (score == null) return null;
  return (
    SCORE_LEVELS.find((level) => score >= level.min) || SCORE_LEVELS.at(-1)
  );
};

const getRoleLabel = (role) =>
  ROLE_LABELS[String(role || "").toLowerCase()] || role || "Vai trò";

const buildCandidateHighlights = ({ assignment }) => {
  const metrics = assignment?.validationMetrics || {};
  const highlights = [];

  const validationScore = normalizeScore(assignment?.validationScore);
  const performanceScore = normalizeScore(metrics.performanceScore);
  const reliabilityScore = normalizeScore(metrics.reliabilityScore);
  const weeklyHoursAfter = Number(metrics.weeklyHoursAfter);
  const shiftsInDayAfter = Number(metrics.shiftsInDayAfter);
  const consecutiveWorkingDays = Number(metrics.consecutiveWorkingDays);

  if (validationScore != null) {
    const level = getScoreLevel(validationScore);
    highlights.push({
      key: "fit",
      label: "Mức phù hợp",
      value: `${level.label} (${validationScore}/100)`,
      tone: level.tone,
      description: level.description,
    });
  }

  if (performanceScore != null) {
    const level = getScoreLevel(performanceScore);
    highlights.push({
      key: "performance",
      label: "Hiệu suất gần đây",
      value: `${level.label} (${performanceScore}/100)`,
      tone: level.tone,
      description:
        "Dựa trên snapshot hiệu suất: năng suất, đúng giờ, chất lượng, đánh giá quản lý và tuân thủ.",
    });
  }

  if (reliabilityScore != null) {
    const level = getScoreLevel(reliabilityScore);
    highlights.push({
      key: "reliability",
      label: "Độ tin cậy chấm công",
      value: `${level.label} (${reliabilityScore}/100)`,
      tone: level.tone,
      description:
        "Ưu tiên nhân sự ít đi trễ, ít vắng, ít phát sinh vấn đề tuân thủ.",
    });
  }

  if (Number.isFinite(weeklyHoursAfter) && weeklyHoursAfter > 0) {
    highlights.push({
      key: "weekly-hours",
      label: "Tải giờ tuần sau ca này",
      value: `${compactNumber(weeklyHoursAfter)}h`,
      tone:
        weeklyHoursAfter >= 48
          ? "risk"
          : weeklyHoursAfter >= 40
            ? "medium"
            : "good",
      description:
        "Dùng để tránh dồn quá nhiều giờ làm vào một nhân viên trong tuần.",
    });
  }

  if (Number.isFinite(shiftsInDayAfter) && shiftsInDayAfter > 0) {
    highlights.push({
      key: "daily-shifts",
      label: "Số ca trong ngày",
      value: `${compactNumber(shiftsInDayAfter)} ca`,
      tone: shiftsInDayAfter > 1 ? "medium" : "good",
      description:
        "Giúp phát hiện nhân viên bị xếp quá nhiều ca trong cùng một ngày.",
    });
  }

  if (Number.isFinite(consecutiveWorkingDays) && consecutiveWorkingDays > 0) {
    highlights.push({
      key: "consecutive-days",
      label: "Ngày làm liên tục",
      value: `${compactNumber(consecutiveWorkingDays)} ngày`,
      tone:
        consecutiveWorkingDays >= 7
          ? "risk"
          : consecutiveWorkingDays >= 6
            ? "medium"
            : "good",
      description:
        "Giúp hạn chế mệt mỏi khi nhân viên làm nhiều ngày liên tiếp.",
    });
  }

  return highlights;
};

const CandidateScoreBreakdown = ({ assignment }) => {
  const warnings = assignment?.validationWarnings || [];
  const highlights = buildCandidateHighlights({ assignment });
  const roleLabel = getRoleLabel(assignment?.role);

  if (!assignment) return null;

  return (
    <div className="candidate-score-breakdown">
      <div className="candidate-score-head">
        <div>
          <span className="candidate-role-label">{roleLabel}</span>
          <strong>Lý do đề xuất</strong>
        </div>

        {assignment.validationScore != null ? (
          <span
            className={`candidate-score-pill ${
              getScoreLevel(assignment.validationScore)?.tone || "medium"
            }`}
          >
            {normalizeScore(assignment.validationScore)}/100
          </span>
        ) : null}
      </div>

      <p className="candidate-reason">
        {assignment.reason || "Phù hợp với nhu cầu nhân sự của ca này."}
      </p>

      {highlights.length ? (
        <div className="candidate-metrics-grid">
          {highlights.map((item) => (
            <div key={item.key} className={`candidate-metric ${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.description}</small>
            </div>
          ))}
        </div>
      ) : (
        <div className="candidate-score-empty">
          Chưa có dữ liệu điểm chi tiết từ bước kiểm tra backend.
        </div>
      )}

      {warnings.length ? (
        <div className="candidate-warning-list">
          <strong>Cảnh báo cần xem xét</strong>
          <ul>
            {warnings.map((warning, index) => (
              <li key={`${warning.code || "warning"}-${index}`}>
                <span>{warning.message}</span>
                {warning.suggestedAction ? (
                  <small>Gợi ý: {warning.suggestedAction}</small>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export default CandidateScoreBreakdown;
export { ROLE_LABELS, getRoleLabel };
