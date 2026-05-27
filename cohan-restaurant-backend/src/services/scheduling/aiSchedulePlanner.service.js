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

function buildRecommendationsFromAssistant(assistant = {}) {
  const templatesByShiftType = new Map();
  const requiredRoles = {};

  for (const row of assistant.shifts || []) {
    const shiftType = normalizeShiftType(row?.shiftType);
    if (!templatesByShiftType.has(shiftType)) {
      templatesByShiftType.set(shiftType, {
        shiftType,
        startTime: row?.window?.startTime || row?.startTime || (shiftType === "evening" ? "17:00" : "08:00"),
        endTime: row?.window?.endTime || row?.endTime || (shiftType === "evening" ? "22:00" : "16:00"),
      });
    }

    const roleRows = Array.isArray(row?.recommendedRoles) ? row.recommendedRoles : [];
    for (const rr of roleRows) {
      const role = normalizeRole(rr?.role);
      const requiredCount = Number(rr?.required || rr?.requiredCount || 0);
      const delta = Number(rr?.delta || 0);
      if (!role) continue;
      if (delta < 0 || requiredCount > 0) {
        if (!Array.isArray(requiredRoles[shiftType])) requiredRoles[shiftType] = [];
        if (!requiredRoles[shiftType].includes(role)) requiredRoles[shiftType].push(role);
      }
    }

    if ((!requiredRoles[shiftType] || requiredRoles[shiftType].length === 0) && (Number(row?.expectedOrders || 0) > 0 || Number(row?.expectedGuests || 0) > 0)) {
      requiredRoles[shiftType] = ["server", "cook"];
    }
  }

  return {
    recommendedShiftTemplates: [...templatesByShiftType.values()],
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

function buildExplanations(preview, fallbackUsed) {
  return (preview?.plannedAssignments || []).map((item) => {
    const warningCount = Array.isArray(item?.warnings) ? item.warnings.length : 0;
    const validationCount = Array.isArray(item?.validationIssues) ? item.validationIssues.length : 0;
    let confidence = clamp01(0.88 - warningCount * 0.12 - validationCount * 0.08 - (fallbackUsed ? 0.15 : 0));
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
      reason: "Đề xuất dựa trên vai trò ca, ràng buộc lịch và độ phù hợp tổng thể.",
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
  const fallbackUsed = Boolean(assistant?.summary?.fallbackUsed || assistant?.metadata?.fallbackUsed || !(assistant?.forecast?.hourlyForecast || []).length);

  const enrichedInput = {
    ...input,
    restaurantId: String(restaurantId),
    shiftTemplates: Array.isArray(input?.shiftTemplates) && input.shiftTemplates.length ? input.shiftTemplates : recommendedShiftTemplates,
    requiredRoles: input?.requiredRoles && Object.keys(input.requiredRoles || {}).length ? input.requiredRoles : recommendedRoles,
  };

  const preview = await buildAutoSchedulePreviewBackend(enrichedInput, ctx);
  const explanations = buildExplanations(preview, fallbackUsed);
  const riskWarnings = buildRiskWarnings(preview, assistant);

  const baseConfidence = explanations.length
    ? explanations.reduce((acc, row) => acc + Number(row.confidence || 0), 0) / explanations.length
    : 0.55;
  const confidence = Number(clamp01(baseConfidence - (fallbackUsed ? 0.15 : 0)).toFixed(3));

  return {
    preview,
    aiSummary: fallbackUsed
      ? "AI Planner đã tạo preview theo rule-based fallback do dữ liệu dự báo/hiệu suất chưa đầy đủ."
      : "AI Planner đã tạo preview dựa trên forecast, performance và availability hiện có.",
    confidence,
    generatedFrom: ["staffSchedulingAssistant", "autoSchedulePreviewBackend", "shiftAssignmentValidation"],
    recommendedShiftTemplates,
    recommendedRoles,
    explanations,
    riskWarnings,
    fallbackUsed,
  };
}
