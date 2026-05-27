import mongoose from "mongoose";
import { buildStaffSchedulingAssistant } from "../ai/staffSchedulingAssistant.service.js";
import { buildAutoSchedulePreviewBackend } from "./autoSchedule.service.js";

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function toDate(value, fieldName) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error(`${fieldName} không hợp lệ.`);
  return date;
}

function normalizeShiftType(value) {
  return String(value || "morning").trim().toLowerCase();
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v || 0)));
}

function hasNonEmptyObject(value) {
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

const SHIFT_TEMPLATE_TIMES = {
  morning: { startTime: "06:00", endTime: "12:00" },
  afternoon: { startTime: "12:00", endTime: "18:00" },
  evening: { startTime: "18:00", endTime: "23:00" },
  full_day: { startTime: "06:00", endTime: "23:00" },
};

function buildRecommendationsFromAssistant(assistant = {}) {
  const requiredRoles = {};
  const recommendedShiftTemplates = [];

  for (const row of assistant.shifts || []) {
    const shiftType = normalizeShiftType(row?.shiftType);
    const fallbackTime = SHIFT_TEMPLATE_TIMES[shiftType] || SHIFT_TEMPLATE_TIMES.morning;
    const roleRows = Array.isArray(row?.recommendedRoles) ? row.recommendedRoles : [];
    const rowRoles = [];

    for (const rr of roleRows) {
      const role = normalizeRole(rr?.role);
      const requiredCountRaw = Number(rr?.required);
      const requiredCount = Number.isFinite(requiredCountRaw) ? Math.max(0, Math.floor(requiredCountRaw)) : 0;
      const delta = Number(rr?.delta || 0);
      if (!role) continue;
      if (delta < 0 || requiredCount > 0) {
        if (!Array.isArray(requiredRoles[shiftType])) requiredRoles[shiftType] = [];
        for (let i = 0; i < requiredCount; i += 1) {
          requiredRoles[shiftType].push(role);
          rowRoles.push(role);
        }
      }
    }

    if (rowRoles.length === 0 && (Number(row?.expectedOrders || 0) > 0 || Number(row?.expectedGuests || 0) > 0)) {
      rowRoles.push("server", "cook");
      if (!Array.isArray(requiredRoles[shiftType])) requiredRoles[shiftType] = [];
      requiredRoles[shiftType].push("server", "cook");
    }

    recommendedShiftTemplates.push({
      date: row?.date || null,
      shiftType,
      startTime: row?.window?.startTime || row?.startTime || fallbackTime.startTime,
      endTime: row?.window?.endTime || row?.endTime || fallbackTime.endTime,
      requiredRoles: rowRoles,
    });
  }

  return {
    recommendedShiftTemplates,
    recommendedRoles: requiredRoles,
  };
}

function buildRiskWarnings(preview, assistant) {
  const warnings = [];
  for (const row of preview?.warnings || []) warnings.push(row);
  for (const row of preview?.validationIssues || []) warnings.push(row);
  for (const row of preview?.unfilledRoles || []) {
    warnings.push({
      code: row?.reason || "UNFILLED_ROLE",
      severity: "error",
      message: `Thiếu nhân sự cho vai trò ${row?.requiredRole || row?.shiftType || "chưa xác định"}.`,
      suggestedAction: "Điều chỉnh yêu cầu vai trò hoặc cho phép override có kiểm soát.",
    });
  }
  for (const note of assistant?.summary?.notes || []) {
    warnings.push({
      code: "AI_ASSISTANT_NOTE",
      severity: "warning",
      message: `Lưu ý AI: ${String(note)}`,
      suggestedAction: "Kiểm tra lại dự báo nhu cầu và availability trước khi áp dụng.",
    });
  }
  return warnings;
}

function buildExplanations(preview) {
  return (preview?.plannedAssignments || []).map((item) => {
    const warningCount = Array.isArray(item?.warnings) ? item.warnings.length : 0;
    const validationCount = Array.isArray(item?.validationIssues) ? item.validationIssues.length : 0;
    const confidence = clamp01(0.88 - warningCount * 0.12 - validationCount * 0.08);
    const factors = [
      "Đúng vai trò theo nhu cầu ca",
      "Không trùng ca trong preview",
      "Phù hợp availability/guardrail hệ thống",
      "Điểm hiệu suất được ưu tiên nếu dữ liệu sẵn có",
      "Không vượt giới hạn giờ tuần nếu có cấu hình",
    ];
    if (warningCount > 0 || validationCount > 0) {
      factors.push("Có cảnh báo nên cần quản lý rà soát trước khi apply");
    }
    return {
      shiftKey: item?.shiftKey || null,
      employeeId: item?.employeeId || null,
      employeeName: item?.employeeName || null,
      reason: (() => {
        const base = item?.requiredRole
          ? `Đề xuất nhân viên cho vai trò ${item.requiredRole} dựa trên ràng buộc lịch và độ phù hợp.`
          : "Đề xuất nhân viên dựa trên ràng buộc lịch và độ phù hợp tổng thể.";
        const scorePart = Number.isFinite(Number(item?.score))
          ? ` Điểm phù hợp ${Number(item.score).toFixed(2)}.`
          : "";
        const warningPart = warningCount > 0 ? " Có cảnh báo cần rà soát trước khi áp dụng." : "";
        return `${base}${scorePart}${warningPart}`.trim();
      })(),
      factors,
      confidence: Number(confidence.toFixed(3)),
    };
  });
}

export async function buildAiSchedulePlannerPreview(input, ctx = {}) {
  const restaurantId = toObjectId(input?.restaurantId);
  if (!restaurantId) throw new Error("restaurantId không hợp lệ.");
  const periodStart = toDate(input?.periodStart, "periodStart");
  const periodEnd = toDate(input?.periodEnd, "periodEnd");
  if (periodEnd < periodStart) throw new Error("periodEnd phải lớn hơn hoặc bằng periodStart.");

  const assistant = await buildStaffSchedulingAssistant({
    restaurantId,
    timezone: input?.timezone || "Asia/Ho_Chi_Minh",
    horizonDays: Number(input?.horizonDays || 2),
    actor: ctx?.user || null,
  });

  const { recommendedShiftTemplates, recommendedRoles } = buildRecommendationsFromAssistant(assistant);
  const assistantMeta = assistant?.meta || {};
  const fallbackUsed = Boolean(assistantMeta.fallbackUsed);
  const basedOnForecast = assistantMeta.basedOnForecast === true;

  const previewInput = {
    restaurantId: String(restaurantId),
    periodStart: input?.periodStart,
    periodEnd: input?.periodEnd,
    requiredRoles: hasNonEmptyObject(input?.requiredRoles) ? input.requiredRoles : recommendedRoles,
    mandatoryShiftRoles: hasNonEmptyObject(input?.mandatoryShiftRoles)
      ? input.mandatoryShiftRoles
      : undefined,
    weeklyHoursCap: input?.weeklyHoursCap,
    respectAvailability: input?.respectAvailability,
    avoidOvertime: input?.avoidOvertime,
    shiftConfig: input?.shiftConfig,
    shiftTemplates: Array.isArray(input?.shiftTemplates) && input.shiftTemplates.length ? input.shiftTemplates : recommendedShiftTemplates,
    allowOverride: input?.allowOverride,
    overrideReason: input?.overrideReason,
  };

  const preview = await buildAutoSchedulePreviewBackend(previewInput, ctx);
  const explanations = buildExplanations(preview);
  const riskWarnings = buildRiskWarnings(preview, assistant);

  const baseConfidence = explanations.length
    ? explanations.reduce((acc, row) => acc + Number(row.confidence || 0), 0) / explanations.length
    : 0.55;
  const confidence = Number(clamp01(baseConfidence - (fallbackUsed ? 0.15 : 0)).toFixed(3));

  return {
    preview,
    aiSummary: fallbackUsed
      ? "Dữ liệu dự báo chưa đủ ổn định nên hệ thống dùng dữ liệu tham khảo để tạo preview."
      : basedOnForecast
        ? "Hệ thống đã tạo preview dựa trên forecast, hiệu suất và availability hiện có."
        : "Hệ thống đã tạo preview dựa trên availability, policy và dữ liệu vận hành hiện có.",
    confidence,
    generatedFrom: ["staffSchedulingAssistant", "autoSchedulePreviewBackend", "shiftAssignmentValidation"],
    recommendedShiftTemplates,
    recommendedRoles,
    explanations,
    riskWarnings,
    fallbackUsed,
  };
}
