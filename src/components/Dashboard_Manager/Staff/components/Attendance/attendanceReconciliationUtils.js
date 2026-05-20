const toStatusText = (value) => String(value || "").toLowerCase();

const hasStatusToken = (status, token) => toStatusText(status).includes(token);

const formatTimeLabel = (start, end, fallback) => {
  const toTime = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  };

  const startLabel = toTime(start);
  const endLabel = toTime(end);
  if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
  return fallback;
};

const buildReasonInfo = ({ late, earlyLeave, missedCheckout, noShow, offSchedule }) => {
  const reasonLabels = [];
  let primaryFilter = null;

  if (noShow) {
    reasonLabels.push("Vắng lịch");
    primaryFilter = primaryFilter || "scheduled_absent";
  }
  if (missedCheckout) {
    reasonLabels.push("Thiếu check-out");
    primaryFilter = primaryFilter || "missed_checkout";
  }
  if (late) {
    reasonLabels.push("Đi muộn");
    primaryFilter = primaryFilter || "late";
  }
  if (earlyLeave) {
    reasonLabels.push("Về sớm");
    primaryFilter = primaryFilter || "early_leave";
  }
  if (offSchedule) {
    reasonLabels.push("Ngoài lịch");
    primaryFilter = primaryFilter || "unscheduled_checkin";
  }

  return { reasonLabels, primaryFilter };
};

export const buildAttendanceReconciliationSummary = (records = [], now = new Date()) => {
  const safeRecords = Array.isArray(records) ? records : [];

  const summary = {
    total: safeRecords.length,
    onTime: 0,
    late: 0,
    earlyLeave: 0,
    missedCheckout: 0,
    noShow: 0,
    offSchedule: 0,
    needsReview: 0,
    reviewItems: [],
    score: null,
    tone: "neutral",
    headline: "Chưa có dữ liệu chấm công để đối chiếu cho ngày này.",
  };

  safeRecords.forEach((record) => {
    const status = toStatusText(record?.status);
    const displayStatus = toStatusText(record?.displayStatus || record?.resolvedStatus || record?.status);
    const late = Number(record?.latenessMinutes || 0) > 0 || hasStatusToken(status, "late");
    const earlyLeave = Number(record?.earlyLeaveMinutes || 0) > 0 || hasStatusToken(status, "early_leave");
    const noShow = status === "scheduled_absent" || displayStatus === "scheduled_absent";
    const offSchedule = Boolean(record?.isOffSchedule) || status.startsWith("unscheduled");

    const plannedEndMs = record?.plannedEndTime ? new Date(record.plannedEndTime).getTime() : null;
    const shouldInferMissedCheckout =
      record?.actualCheckInAt &&
      !record?.actualCheckOutAt &&
      Number.isFinite(plannedEndMs) &&
      plannedEndMs <= now.getTime();
    const missedCheckout =
      displayStatus === "missed_checkout" || status === "missed_checkout" || shouldInferMissedCheckout;

    const completed = status === "completed";
    const onTime = completed && !late && !earlyLeave && !offSchedule && !noShow && !missedCheckout;

    if (late) summary.late += 1;
    if (earlyLeave) summary.earlyLeave += 1;
    if (noShow) summary.noShow += 1;
    if (offSchedule) summary.offSchedule += 1;
    if (missedCheckout) summary.missedCheckout += 1;
    if (onTime) summary.onTime += 1;

    const reviewFlags = { late, earlyLeave, missedCheckout, noShow, offSchedule };
    const needsReview = Object.values(reviewFlags).some(Boolean);
    if (needsReview) {
      summary.needsReview += 1;
      const { reasonLabels, primaryFilter } = buildReasonInfo(reviewFlags);
      summary.reviewItems.push({
        id: record?.id,
        employeeName: record?.employeeName || "Nhân viên",
        employeeCode: record?.employeeCode || "--",
        reasonLabels,
        plannedTimeLabel: formatTimeLabel(record?.plannedStartTime, record?.plannedEndTime, offSchedule ? "Ngoài lịch" : "Chưa phân ca"),
        actualTimeLabel: formatTimeLabel(record?.actualCheckInAt, record?.actualCheckOutAt, "Chưa đủ dữ liệu"),
        status: record?.status || "--",
        primaryFilter,
      });
    }
  });

  summary.reviewItems = summary.reviewItems.slice(0, 5);

  if (summary.total > 0) {
    const score = 100
      - Math.min(summary.noShow * 15, 45)
      - Math.min(summary.missedCheckout * 10, 30)
      - Math.min(summary.late * 5, 25)
      - Math.min(summary.earlyLeave * 5, 25)
      - Math.min(summary.offSchedule * 6, 30);

    summary.score = Math.max(0, Math.min(100, score));
    if (summary.score >= 85) {
      summary.tone = "success";
      summary.headline = "Ổn định";
    } else if (summary.score >= 70) {
      summary.tone = "info";
      summary.headline = "Cần kiểm tra";
    } else if (summary.score >= 50) {
      summary.tone = "warning";
      summary.headline = "Cần kiểm tra";
    } else {
      summary.tone = "danger";
      summary.headline = "Rủi ro cao";
    }
  }

  return summary;
};
