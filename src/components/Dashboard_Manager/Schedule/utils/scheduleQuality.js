const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const buildScheduleQualitySummary = ({
  schedulePublishRiskSummary,
  scheduleLifecycleStatus,
  effectiveScheduleStatus,
  shifts,
  staffShifts,
}) => {
  const hasShiftData = Array.isArray(shifts);
  const hasRiskSummary = Boolean(schedulePublishRiskSummary);

  if (!hasShiftData && !hasRiskSummary) {
    return {
      score: null,
      level: "neutral",
      label: "Chưa đủ dữ liệu",
      tone: "info",
      headline: "Chưa đủ dữ liệu để đánh giá chất lượng lịch.",
      reasons: ["Vui lòng tải dữ liệu lịch để xem đánh giá sẵn sàng công bố."],
      nextActions: ["Làm mới dữ liệu hoặc chọn tuần có lịch làm việc."],
      metrics: [],
      hasTopIssues: false,
    };
  }

  const warnings = Number(schedulePublishRiskSummary?.warnings?.length || 0);
  const dangers = Number(schedulePublishRiskSummary?.dangers?.length || 0);
  const pendingAcknowledgements = Number(
    schedulePublishRiskSummary?.pendingAcknowledgements || 0,
  );
  const changedAfterAcknowledgementCount = Number(
    schedulePublishRiskSummary?.changedAfterAcknowledgementCount || 0,
  );
  const totalShifts = Number(Array.isArray(shifts) ? shifts.length : 0);
  const assignedShiftCount = Number(
    Array.isArray(staffShifts)
      ? staffShifts.filter((shift) => Number(shift.assignedCount || 0) > 0).length
      : 0,
  );

  const scorePenalty =
    Math.min(dangers * 15, 45) +
    Math.min(warnings * 6, 30) +
    Math.min(pendingAcknowledgements * 4, 20) +
    Math.min(changedAfterAcknowledgementCount * 6, 24) +
    (totalShifts === 0 ? 40 : 0) +
    (totalShifts > 0 && assignedShiftCount === 0 ? 30 : 0) +
    (scheduleLifecycleStatus === "revision_draft" ? 8 : 0) +
    (scheduleLifecycleStatus === "published" &&
    effectiveScheduleStatus === "revision_draft"
      ? 12
      : 0);

  const score = clamp(Math.round(100 - scorePenalty), 0, 100);

  let label = "Rủi ro cao";
  let tone = "danger";
  if (score >= 85) {
    label = "Sẵn sàng công bố";
    tone = "success";
  } else if (score >= 70) {
    label = "Có thể công bố, nên kiểm tra thêm";
    tone = "info";
  } else if (score >= 50) {
    label = "Cần xử lý trước khi công bố";
    tone = "warning";
  }

  const reasons = [];
  const nextActions = [];

  if (totalShifts === 0) {
    reasons.push("Tuần hiện tại chưa có ca làm nào được tạo.");
    nextActions.push("Tạo ca làm trước khi đánh giá công bố.");
  }
  if (totalShifts > 0 && assignedShiftCount === 0) {
    reasons.push("Các ca hiện chưa có nhân sự được phân công.");
    nextActions.push("Phân công nhân sự cho các ca chính trước khi công bố.");
  }
  if (dangers > 0) {
    reasons.push(`Có ${dangers} rủi ro nghiêm trọng cần xử lý ngay.`);
    nextActions.push("Xử lý các mục rủi ro nghiêm trọng trước.");
  }
  if (warnings > 0) {
    reasons.push(`Còn ${warnings} cảnh báo cần kiểm tra trước khi gửi lịch.`);
  }
  if (pendingAcknowledgements > 0) {
    reasons.push(`Có ${pendingAcknowledgements} nhân sự chưa xác nhận lịch.`);
    nextActions.push("Nhắc nhân sự xác nhận lịch sau khi công bố.");
  }
  if (changedAfterAcknowledgementCount > 0) {
    reasons.push(
      `Có ${changedAfterAcknowledgementCount} trường hợp lịch đổi sau khi đã xác nhận.`,
    );
    nextActions.push("Rà soát lại ca đã đổi và thông báo lại cho nhân sự liên quan.");
  }

  if (reasons.length === 0) {
    reasons.push("Lịch tuần này đã đủ ổn để công bố.");
  }
  if (nextActions.length === 0) {
    nextActions.push("Duy trì kiểm tra nhanh trước khi bấm công bố.");
  }

  return {
    score,
    level: tone,
    label,
    tone,
    headline: reasons[0],
    reasons: reasons.slice(0, 3),
    nextActions: nextActions.slice(0, 2),
    metrics: [
      { key: "warnings", label: "Cảnh báo", value: warnings },
      { key: "dangers", label: "Rủi ro nghiêm trọng", value: dangers },
      {
        key: "pendingAcknowledgements",
        label: "Chưa xác nhận",
        value: pendingAcknowledgements,
      },
      {
        key: "changedAfterAcknowledgementCount",
        label: "Đã xác nhận nhưng lịch đổi",
        value: changedAfterAcknowledgementCount,
      },
      {
        key: "assignedShiftCount",
        label: "Ca đã phân công",
        value: `${assignedShiftCount}/${totalShifts}`,
      },
    ],
    hasTopIssues: Number(schedulePublishRiskSummary?.topIssues?.length || 0) > 0,
  };
};
