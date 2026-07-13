import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "@apollo/client";
import {
  CalendarDays,
  Clock3,
  Info,
  Save,
  Settings2,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import {
  MUT_UPDATE_SETTINGS,
  QUERY_PAYROLL_SETTINGS,
} from "@/hooks/usePayroll";
import {
  isAccountantRole,
  isAdminRole,
  isManagerRole,
} from "@/utils/frontendRoleAccess";
import "./PayrollSettingsControl.scss";

const WEEKDAYS = [
  ["MON", "Thứ 2"],
  ["TUE", "Thứ 3"],
  ["WED", "Thứ 4"],
  ["THU", "Thứ 5"],
  ["FRI", "Thứ 6"],
  ["SAT", "Thứ 7"],
  ["SUN", "Chủ nhật"],
];

const DEFAULT_FORM = {
  standardWorkDaysPerMonth: "26",
  standardHoursPerDay: "8",
  latenessPenaltyPerMinute: "0",
  earlyLeavePenaltyPerMinute: "0",
  unpaidLeaveDeductionPerDay: "0",
  defaultAllowance: "0",
  allowPaidLeaveInWorkDays: true,
  weekendDays: ["SUN"],
  holidayDates: "",
  nightShiftStart: "22:00",
  nightShiftEnd: "06:00",
  notes: "",
  overtimeMultiplierWeekday: "1.5",
  overtimeMultiplierWeekend: "2",
  overtimeMultiplierHoliday: "3",
  defaultBonus: "0",
  defaultDeduction: "0",
  nightShiftAllowancePercent: "30",
  enablePersonalIncomeTax: false,
  personalIncomeTaxPercent: "0",
  personalIncomeTaxFreeThreshold: "0",
};

const toNumberText = (value, fallback = 0) =>
  String(Number.isFinite(Number(value)) ? Number(value) : fallback);

const toDateKey = (value) => {
  const key = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
};

const toForm = (settings) => ({
  ...DEFAULT_FORM,
  standardWorkDaysPerMonth: toNumberText(settings?.standardWorkDaysPerMonth, 26),
  standardHoursPerDay: toNumberText(settings?.standardHoursPerDay, 8),
  latenessPenaltyPerMinute: toNumberText(settings?.latenessPenaltyPerMinute),
  earlyLeavePenaltyPerMinute: toNumberText(settings?.earlyLeavePenaltyPerMinute),
  unpaidLeaveDeductionPerDay: toNumberText(settings?.unpaidLeaveDeductionPerDay),
  defaultAllowance: toNumberText(settings?.defaultAllowance),
  allowPaidLeaveInWorkDays: settings?.allowPaidLeaveInWorkDays !== false,
  weekendDays: Array.isArray(settings?.weekendDays)
    ? settings.weekendDays.map((day) => String(day).toUpperCase())
    : ["SUN"],
  holidayDates: Array.isArray(settings?.holidayDates)
    ? settings.holidayDates.map(toDateKey).filter(Boolean).join(", ")
    : "",
  nightShiftStart: settings?.nightShiftStart || "22:00",
  nightShiftEnd: settings?.nightShiftEnd || "06:00",
  notes: settings?.notes || "",
  overtimeMultiplierWeekday: toNumberText(settings?.overtimeMultiplierWeekday, 1.5),
  overtimeMultiplierWeekend: toNumberText(settings?.overtimeMultiplierWeekend, 2),
  overtimeMultiplierHoliday: toNumberText(settings?.overtimeMultiplierHoliday, 3),
  defaultBonus: toNumberText(settings?.defaultBonus),
  defaultDeduction: toNumberText(settings?.defaultDeduction),
  nightShiftAllowancePercent: toNumberText(
    Number(settings?.nightShiftAllowanceRate ?? 0.3) * 100,
    30,
  ),
  enablePersonalIncomeTax: settings?.enablePersonalIncomeTax === true,
  personalIncomeTaxPercent: toNumberText(
    Number(settings?.personalIncomeTaxRate || 0) * 100,
  ),
  personalIncomeTaxFreeThreshold: toNumberText(
    settings?.personalIncomeTaxFreeThreshold,
  ),
});

const parseHolidayDates = (value) => {
  const dates = String(value || "")
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const invalid = dates.find((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date));
  if (invalid) {
    throw new Error(`Ngày lễ ${invalid} chưa đúng định dạng YYYY-MM-DD.`);
  }
  return [...new Set(dates)].sort().map((date) => `${date}T00:00:00.000Z`);
};

const numeric = (value, label, minimum, maximum) => {
  const result = Number(value);
  if (!Number.isFinite(result) || result < minimum || result > maximum) {
    throw new Error(`${label} phải từ ${minimum} đến ${maximum}.`);
  }
  return result;
};

export const buildPayrollSettingsInput = ({
  form,
  restaurantId,
  canEditAdvanced,
}) => {
  const input = {
    restaurantId,
    standardWorkDaysPerMonth: numeric(
      form.standardWorkDaysPerMonth,
      "Ngày công chuẩn",
      1,
      31,
    ),
    standardHoursPerDay: numeric(form.standardHoursPerDay, "Giờ công chuẩn", 1, 24),
    latenessPenaltyPerMinute: numeric(
      form.latenessPenaltyPerMinute,
      "Mức trừ đi muộn",
      0,
      1_000_000_000,
    ),
    earlyLeavePenaltyPerMinute: numeric(
      form.earlyLeavePenaltyPerMinute,
      "Mức trừ về sớm",
      0,
      1_000_000_000,
    ),
    unpaidLeaveDeductionPerDay: numeric(
      form.unpaidLeaveDeductionPerDay,
      "Mức trừ nghỉ không lương",
      0,
      1_000_000_000,
    ),
    defaultAllowance: numeric(
      form.defaultAllowance,
      "Phụ cấp mặc định",
      0,
      1_000_000_000,
    ),
    allowPaidLeaveInWorkDays: Boolean(form.allowPaidLeaveInWorkDays),
    weekendDays: [...new Set(form.weekendDays)],
    holidayDates: parseHolidayDates(form.holidayDates),
    nightShiftStart: form.nightShiftStart,
    nightShiftEnd: form.nightShiftEnd,
    notes: String(form.notes || "").trim(),
  };

  if (form.nightShiftStart === form.nightShiftEnd) {
    throw new Error("Giờ bắt đầu và kết thúc ca đêm không được trùng nhau.");
  }
  if (input.notes.length > 1000) {
    throw new Error("Ghi chú không được vượt quá 1000 ký tự.");
  }

  if (canEditAdvanced) {
    Object.assign(input, {
      overtimeMultiplierWeekday: numeric(
        form.overtimeMultiplierWeekday,
        "Hệ số tăng ca ngày thường",
        1,
        5,
      ),
      overtimeMultiplierWeekend: numeric(
        form.overtimeMultiplierWeekend,
        "Hệ số tăng ca cuối tuần",
        1,
        5,
      ),
      overtimeMultiplierHoliday: numeric(
        form.overtimeMultiplierHoliday,
        "Hệ số tăng ca ngày lễ",
        1,
        5,
      ),
      defaultBonus: numeric(form.defaultBonus, "Thưởng mặc định", 0, 1_000_000_000),
      defaultDeduction: numeric(
        form.defaultDeduction,
        "Khấu trừ mặc định",
        0,
        1_000_000_000,
      ),
      nightShiftAllowanceRate:
        numeric(form.nightShiftAllowancePercent, "Phụ cấp ca đêm", 0, 100) / 100,
      enablePersonalIncomeTax: Boolean(form.enablePersonalIncomeTax),
      personalIncomeTaxRate:
        numeric(form.personalIncomeTaxPercent, "Tỷ lệ thuế TNCN", 0, 100) / 100,
      personalIncomeTaxFreeThreshold: numeric(
        form.personalIncomeTaxFreeThreshold,
        "Ngưỡng miễn thuế TNCN",
        0,
        1_000_000_000_000,
      ),
    });
  }

  return input;
};

const mutationError = (error) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.message ||
  "Không thể lưu cấu hình tính lương.";

export const formatSavedPayrollValue = (value, suffix = "") => {
  const numericValue = Number(value);
  const formattedValue = Number.isFinite(numericValue)
    ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(numericValue)
    : String(value || "0");
  return `${formattedValue}${suffix ? ` ${suffix}` : ""}`;
};

const NumberField = ({ label, value, savedValue, onChange, suffix, min = 0, max, step = "1", disabled }) => (
  <label className="payroll-settings-field">
    <span className="payroll-settings-field__heading">
      <span>{label}</span>
      <small>Hiện tại: {formatSavedPayrollValue(savedValue, suffix)}</small>
    </span>
    <div className="payroll-settings-input-wrap">
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {suffix ? <small>{suffix}</small> : null}
    </div>
  </label>
);

const PayrollSettingsControl = ({ restaurantId, restaurantName, actor }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const canEditAdvanced = isAdminRole(actor) || isAccountantRole(actor);
  const canEditSettings = canEditAdvanced || isManagerRole(actor);

  const settingsQuery = useQuery(QUERY_PAYROLL_SETTINGS, {
    variables: { restaurantId: restaurantId || undefined },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });
  const [updateSettings] = useMutation(MUT_UPDATE_SETTINGS);
  const settings = settingsQuery.data?.payrollSettings || null;
  const savedForm = useMemo(() => toForm(settings), [settings]);

  const summary = useMemo(() => {
    if (!settings) return "Chưa tải cấu hình";
    const days = Number(settings.standardWorkDaysPerMonth || 0);
    const hours = Number(settings.standardHoursPerDay || 0);
    return `${days} ngày/tháng · ${hours} giờ/ngày · ca đêm ${settings.nightShiftStart || "22:00"}-${settings.nightShiftEnd || "06:00"}`;
  }, [settings]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, saving]);

  const openDrawer = () => {
    setForm(toForm(settings));
    setFeedback("");
    setOpen(true);
  };

  const setField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const toggleWeekend = (day) => {
    setForm((current) => ({
      ...current,
      weekendDays: current.weekendDays.includes(day)
        ? current.weekendDays.filter((value) => value !== day)
        : [...current.weekendDays, day],
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!restaurantId || !canEditSettings || saving) return;
    try {
      setSaving(true);
      setFeedback("");
      const input = buildPayrollSettingsInput({
        form,
        restaurantId,
        canEditAdvanced,
      });
      await updateSettings({ variables: { input } });
      await settingsQuery.refetch?.({ restaurantId });
      setFeedback(
        "Đã lưu cấu hình. Bản tạm tính dùng ngay; kỳ lương nháp cần bấm Tính lại.",
      );
    } catch (error) {
      setFeedback(mutationError(error));
    } finally {
      setSaving(false);
    }
  };

  const drawer = open ? (
    <div
      className="payroll-settings-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) setOpen(false);
      }}
    >
      <aside
        className="payroll-settings-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payroll-settings-title"
      >
        <header className="payroll-settings-drawer__header">
          <div>
            <span className="payroll-settings-drawer__eyebrow">Theo từng nhà hàng</span>
            <h2 id="payroll-settings-title">Cấu hình tính lương</h2>
            <p>{restaurantName || "Nhà hàng đang chọn"}</p>
          </div>
          <button
            type="button"
            className="payroll-settings-close"
            aria-label="Đóng cấu hình tính lương"
            disabled={saving}
            onClick={() => setOpen(false)}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form className="payroll-settings-form" onSubmit={handleSave}>
          {settingsQuery.loading && !settings ? (
            <div className="payroll-settings-state" role="status">
              Đang tải cấu hình nhà hàng...
            </div>
          ) : settingsQuery.error ? (
            <div className="payroll-settings-state is-error" role="alert">
              Không thể tải cấu hình. Đóng bảng này và thử lại.
            </div>
          ) : (
            <>
              <section className="payroll-settings-section">
                <div className="payroll-settings-section__heading">
                  <CalendarDays size={19} aria-hidden="true" />
                  <div>
                    <h3>Ngày công và khấu trừ vận hành</h3>
                    <p>Cấu hình dùng khi tổng hợp công của chi nhánh.</p>
                  </div>
                </div>
                <div className="payroll-settings-grid">
                  <NumberField label="Ngày công chuẩn" suffix="ngày/tháng" min="1" max="31" value={form.standardWorkDaysPerMonth} savedValue={savedForm.standardWorkDaysPerMonth} onChange={(value) => setField("standardWorkDaysPerMonth", value)} />
                  <NumberField label="Giờ công chuẩn" suffix="giờ/ngày" min="1" max="24" step="0.5" value={form.standardHoursPerDay} savedValue={savedForm.standardHoursPerDay} onChange={(value) => setField("standardHoursPerDay", value)} />
                  <NumberField label="Trừ đi muộn" suffix="đ/phút" value={form.latenessPenaltyPerMinute} savedValue={savedForm.latenessPenaltyPerMinute} onChange={(value) => setField("latenessPenaltyPerMinute", value)} />
                  <NumberField label="Trừ về sớm" suffix="đ/phút" value={form.earlyLeavePenaltyPerMinute} savedValue={savedForm.earlyLeavePenaltyPerMinute} onChange={(value) => setField("earlyLeavePenaltyPerMinute", value)} />
                  <NumberField label="Nghỉ không lương" suffix="đ/ngày" value={form.unpaidLeaveDeductionPerDay} savedValue={savedForm.unpaidLeaveDeductionPerDay} onChange={(value) => setField("unpaidLeaveDeductionPerDay", value)} />
                  <NumberField label="Phụ cấp mặc định" suffix="đ/kỳ" value={form.defaultAllowance} savedValue={savedForm.defaultAllowance} onChange={(value) => setField("defaultAllowance", value)} />
                </div>
                <label className="payroll-settings-switch">
                  <input type="checkbox" checked={form.allowPaidLeaveInWorkDays} onChange={(event) => setField("allowPaidLeaveInWorkDays", event.target.checked)} />
                  <span>
                    <strong>Tính nghỉ phép hưởng lương vào ngày công</strong>
                    <small>Tắt khi nhà hàng muốn tách ngày phép khỏi ngày công trả lương.</small>
                  </span>
                </label>
              </section>

              <section className="payroll-settings-section">
                <div className="payroll-settings-section__heading">
                  <Clock3 size={19} aria-hidden="true" />
                  <div>
                    <h3>Lịch cuối tuần, ngày lễ và ca đêm</h3>
                    <p>Dùng để phân loại tăng ca và thời gian làm ban đêm.</p>
                  </div>
                </div>
                <fieldset className="payroll-settings-weekdays">
                  <legend>Ngày cuối tuần của nhà hàng</legend>
                  <div>
                    {WEEKDAYS.map(([value, label]) => (
                      <label key={value}>
                        <input type="checkbox" checked={form.weekendDays.includes(value)} onChange={() => toggleWeekend(value)} />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="payroll-settings-field payroll-settings-field--wide">
                  <span>Ngày lễ áp dụng</span>
                  <textarea
                    rows="2"
                    value={form.holidayDates}
                    onChange={(event) => setField("holidayDates", event.target.value)}
                    placeholder="2026-01-01, 2026-04-30, 2026-05-01"
                  />
                  <small>Nhập dạng YYYY-MM-DD, cách nhau bằng dấu phẩy hoặc xuống dòng.</small>
                </label>
                <div className="payroll-settings-grid payroll-settings-grid--time">
                  <label className="payroll-settings-field">
                    <span className="payroll-settings-field__heading"><span>Bắt đầu ca đêm</span><small>Hiện tại: {savedForm.nightShiftStart}</small></span>
                    <input type="time" value={form.nightShiftStart} onChange={(event) => setField("nightShiftStart", event.target.value)} />
                  </label>
                  <label className="payroll-settings-field">
                    <span className="payroll-settings-field__heading"><span>Kết thúc ca đêm</span><small>Hiện tại: {savedForm.nightShiftEnd}</small></span>
                    <input type="time" value={form.nightShiftEnd} onChange={(event) => setField("nightShiftEnd", event.target.value)} />
                  </label>
                </div>
              </section>

              <section className={`payroll-settings-section payroll-settings-section--advanced ${canEditAdvanced ? "" : "is-locked"}`}>
                <div className="payroll-settings-section__heading">
                  <ShieldCheck size={19} aria-hidden="true" />
                  <div>
                    <h3>Hệ số và chính sách tài chính</h3>
                    <p>{canEditAdvanced ? "Dành cho Admin và Kế toán." : "Chỉ Admin hoặc Kế toán được thay đổi nhóm này."}</p>
                  </div>
                </div>
                <fieldset disabled={!canEditAdvanced}>
                  <div className="payroll-settings-grid">
                    <NumberField label="OT ngày thường" suffix="lần" min="1" max="5" step="0.1" disabled={!canEditAdvanced} value={form.overtimeMultiplierWeekday} savedValue={savedForm.overtimeMultiplierWeekday} onChange={(value) => setField("overtimeMultiplierWeekday", value)} />
                    <NumberField label="OT cuối tuần" suffix="lần" min="1" max="5" step="0.1" disabled={!canEditAdvanced} value={form.overtimeMultiplierWeekend} savedValue={savedForm.overtimeMultiplierWeekend} onChange={(value) => setField("overtimeMultiplierWeekend", value)} />
                    <NumberField label="OT ngày lễ" suffix="lần" min="1" max="5" step="0.1" disabled={!canEditAdvanced} value={form.overtimeMultiplierHoliday} savedValue={savedForm.overtimeMultiplierHoliday} onChange={(value) => setField("overtimeMultiplierHoliday", value)} />
                    <NumberField label="Phụ cấp ca đêm" suffix="%" min="0" max="100" step="1" disabled={!canEditAdvanced} value={form.nightShiftAllowancePercent} savedValue={savedForm.nightShiftAllowancePercent} onChange={(value) => setField("nightShiftAllowancePercent", value)} />
                    <NumberField label="Thưởng mặc định" suffix="đ/kỳ" disabled={!canEditAdvanced} value={form.defaultBonus} savedValue={savedForm.defaultBonus} onChange={(value) => setField("defaultBonus", value)} />
                    <NumberField label="Khấu trừ mặc định" suffix="đ/kỳ" disabled={!canEditAdvanced} value={form.defaultDeduction} savedValue={savedForm.defaultDeduction} onChange={(value) => setField("defaultDeduction", value)} />
                  </div>
                  <label className="payroll-settings-switch">
                    <input type="checkbox" disabled={!canEditAdvanced} checked={form.enablePersonalIncomeTax} onChange={(event) => setField("enablePersonalIncomeTax", event.target.checked)} />
                    <span>
                      <strong>Bật tính thuế TNCN theo tỷ lệ cấu hình</strong>
                      <small>Chỉ dùng khi nhà hàng đã xác nhận chính sách kế toán áp dụng.</small>
                    </span>
                  </label>
                  <div className="payroll-settings-grid">
                    <NumberField label="Tỷ lệ thuế TNCN" suffix="%" min="0" max="100" step="0.1" disabled={!canEditAdvanced || !form.enablePersonalIncomeTax} value={form.personalIncomeTaxPercent} savedValue={savedForm.personalIncomeTaxPercent} onChange={(value) => setField("personalIncomeTaxPercent", value)} />
                    <NumberField label="Ngưỡng miễn thuế" suffix="đ" disabled={!canEditAdvanced || !form.enablePersonalIncomeTax} value={form.personalIncomeTaxFreeThreshold} savedValue={savedForm.personalIncomeTaxFreeThreshold} onChange={(value) => setField("personalIncomeTaxFreeThreshold", value)} />
                  </div>
                </fieldset>
              </section>

              <section className="payroll-settings-section payroll-settings-section--note">
                <div className="payroll-settings-section__heading">
                  <WalletCards size={19} aria-hidden="true" />
                  <div>
                    <h3>Ghi chú chính sách</h3>
                    <p>Ghi rõ quy ước nội bộ để người duyệt lương cùng hiểu.</p>
                  </div>
                </div>
                <label className="payroll-settings-field payroll-settings-field--wide">
                  <span>Ghi chú</span>
                  <textarea rows="3" maxLength="1000" value={form.notes} onChange={(event) => setField("notes", event.target.value)} placeholder="Ví dụ: Áp dụng lịch cuối tuần riêng cho chi nhánh từ tháng 8/2026." />
                  <small>{form.notes.length}/1000 ký tự</small>
                </label>
              </section>

              <div className="payroll-settings-warning">
                <Info size={18} aria-hidden="true" />
                <span>Cấu hình mới áp dụng ngay cho bản tạm tính và kỳ nháp sau khi bấm <strong>Tính lại</strong>. Kỳ đã chốt, đang chi, đã trả hoặc đã khóa không bị thay đổi.</span>
              </div>
            </>
          )}

          {feedback ? (
            <div className={`payroll-settings-feedback ${feedback.startsWith("Đã lưu") ? "is-success" : "is-error"}`} role="status" aria-live="polite">
              {feedback}
            </div>
          ) : null}

          <footer className="payroll-settings-actions">
            <button type="button" className="payroll-settings-button is-secondary" disabled={saving} onClick={() => setOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="payroll-settings-button is-primary" disabled={!canEditSettings || saving || settingsQuery.loading || Boolean(settingsQuery.error)}>
              <Save size={17} aria-hidden="true" />
              {saving ? "Đang lưu..." : "Lưu cấu hình"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  ) : null;

  return (
    <>
      <section className="payroll-settings-entry" aria-label="Cấu hình tính lương theo nhà hàng">
        <div className="payroll-settings-entry__identity">
          <span className="payroll-settings-entry__icon" aria-hidden="true">
            <Settings2 size={19} />
          </span>
          <div>
            <strong>Cấu hình tính lương</strong>
            <span>{restaurantName || "Nhà hàng đang chọn"} · {summary}</span>
          </div>
        </div>
        <button
          type="button"
          className="payroll-settings-entry__action"
          disabled={!restaurantId || !canEditSettings}
          onClick={openDrawer}
        >
          <Settings2 size={17} aria-hidden="true" />
          Mở cấu hình
        </button>
      </section>
      {typeof document !== "undefined" && drawer
        ? createPortal(drawer, document.body)
        : null}
    </>
  );
};

export default PayrollSettingsControl;
