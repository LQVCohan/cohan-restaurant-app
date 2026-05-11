import React, { useMemo, useState } from "react";
import { toAttendanceIsoStartOfDay } from "@/hooks/useAttendanceManagement";
import {
  CORRECTION_TYPES,
  formatTime,
  fromDatetimeLocalToIso,
  getAttendanceActionErrorMessage,
  getCorrectionTypeLabel,
  resolveTimesheetId,
  validateCorrectionForm,
} from "./attendanceCorrectionUtils";

const buildEvidenceUrls = (value = "") =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export default function AttendanceCorrectionModal({
  record,
  form,
  effectiveRestaurantId,
  isSubmitting,
  onChange,
  onClose,
  onSubmitted,
  createAttendanceCorrectionRequest,
}) {
  const [localError, setLocalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const title = useMemo(() => {
    if (!record) return "Tạo yêu cầu chỉnh công";
    return `Tạo yêu cầu chỉnh công - ${record.employeeName || "Nhân viên"}`;
  }, [record]);

  if (!record || !form) return null;

  const submit = async (event) => {
    event.preventDefault();
    setLocalError("");
    setSuccessMessage("");

    const restaurantId = record.restaurantId || effectiveRestaurantId || null;
    if (!restaurantId) {
      setLocalError("Không xác định được nhà hàng để tạo yêu cầu chỉnh công.");
      return;
    }

    const validationError = validateCorrectionForm(form);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    const requestedCheckInAt = fromDatetimeLocalToIso(form.requestedCheckInAt);
    const requestedCheckOutAt = fromDatetimeLocalToIso(form.requestedCheckOutAt);

    try {
      await createAttendanceCorrectionRequest({
        variables: {
          input: {
            employeeId: record.employeeId,
            restaurantId,
            timesheetId: resolveTimesheetId(record),
            shiftId: record.shiftId || undefined,
            workDate: toAttendanceIsoStartOfDay(form.workDate),
            correctionType: form.correctionType,
            requestedCheckInAt: requestedCheckInAt || undefined,
            requestedCheckOutAt: requestedCheckOutAt || undefined,
            reason: form.reason.trim(),
            evidenceNote: form.evidenceNote?.trim() || undefined,
            evidenceUrls: buildEvidenceUrls(form.evidenceUrlsText),
          },
        },
      });

      setSuccessMessage("Đã gửi yêu cầu chỉnh công.");
      onSubmitted?.();
    } catch (err) {
      setLocalError(
        getAttendanceActionErrorMessage(
          err,
          err?.message || "Không thể tạo yêu cầu chỉnh công.",
        ),
      );
    }
  };

  return (
    <div className="modal-overlay correction-modal-overlay">
      <div className="modal-content correction-modal">
        <div className="modal-header">
          <div>
            <h3>{title}</h3>
            <p>
              Giờ hiện tại: vào {formatTime(record.actualCheckInAt) || "--:--"} · ra{" "}
              {formatTime(record.actualCheckOutAt) || "--:--"}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={isSubmitting}>
            ×
          </button>
        </div>

        <form className="correction-form" onSubmit={submit}>
          {localError && <div className="modal-error">❌ {localError}</div>}
          {successMessage && <div className="modal-success">✅ {successMessage}</div>}

          <div className="form-grid two-columns">
            <label>
              Loại chỉnh công
              <select
                value={form.correctionType}
                onChange={(event) => onChange("correctionType", event.target.value)}
                disabled={isSubmitting}
              >
                {CORRECTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Ngày công
              <input
                type="date"
                value={form.workDate || ""}
                onChange={(event) => onChange("workDate", event.target.value)}
                disabled={isSubmitting}
              />
            </label>

            <label>
              Check-in đề xuất
              <input
                type="datetime-local"
                value={form.requestedCheckInAt || ""}
                onChange={(event) => onChange("requestedCheckInAt", event.target.value)}
                disabled={isSubmitting}
              />
            </label>

            <label>
              Check-out đề xuất
              <input
                type="datetime-local"
                value={form.requestedCheckOutAt || ""}
                onChange={(event) => onChange("requestedCheckOutAt", event.target.value)}
                disabled={isSubmitting}
              />
            </label>
          </div>

          <label>
            Lý do chỉnh công <span className="required">*</span>
            <textarea
              value={form.reason || ""}
              onChange={(event) => onChange("reason", event.target.value)}
              placeholder={`VD: ${getCorrectionTypeLabel(form.correctionType)} do quên thao tác trên máy chấm công.`}
              rows={3}
              disabled={isSubmitting}
            />
          </label>

          <label>
            Ghi chú bằng chứng
            <textarea
              value={form.evidenceNote || ""}
              onChange={(event) => onChange("evidenceNote", event.target.value)}
              placeholder="VD: Camera, xác nhận của ca trưởng..."
              rows={2}
              disabled={isSubmitting}
            />
          </label>

          <label>
            Link bằng chứng, mỗi dòng một link
            <textarea
              value={form.evidenceUrlsText || ""}
              onChange={(event) => onChange("evidenceUrlsText", event.target.value)}
              rows={2}
              disabled={isSubmitting}
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Đóng
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
