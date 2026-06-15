import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import { hasAnyPermission } from "@/utils/frontendPermissionAccess";
import { resolveUserRoleName } from "@/utils/frontendRoleAccess";
import usePayroll from "@/hooks/usePayroll";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import PayrollReadinessPanel from "./components/PayrollReadinessPanel";
import PayrollPayslipModal, {
  getPayrollPaymentErrorMessage,
} from "@/components/Dashboard_Manager/Staff/components/PayrollPayslipModal";
import { getPayrollActionErrorMessage } from "@/utils/payrollPerformanceErrorMessages";
import { dispatchPayrollReadinessNavigation } from "@/utils/payrollReadinessRouting";
import "./PayrollManagement.scss";
import "./PayrollManagementStorageTheme.scss";

const getDefaultRange = () => {
  const today = new Date();
  const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 26);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 25);
  return {
    start: prevMonth.toISOString().split("T")[0],
    end: thisMonth.toISOString().split("T")[0],
  };
};

export function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadCsv(filename, rows, columns) {
  const header = columns
    .map((column) => escapeCsvValue(column.label))
    .join(",");
  const body = rows
    .map((row) =>
      columns.map((column) => escapeCsvValue(row[column.key])).join(","),
    )
    .join("\n");

  const blob = new Blob([`\uFEFF${header}\n${body}`], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}


const PAYROLL_STATUS_TAB_LABELS = {
  all: "Tất cả",
  draft: "Nháp",
  finalized: "Đã chốt",
  paying: "Đang chi",
  pending_payment: "Chờ chi",
  processing_payment: "Đang xử lý",
  payment_failed: "Lỗi chi",
  paid: "Đã trả",
  locked: "Đã khóa",
};

const PAYROLL_STATUS_TABS = Object.keys(PAYROLL_STATUS_TAB_LABELS);

const PAYROLL_LOADING_ROWS = Array.from({ length: 6 }, (_, index) => index);

const PAYROLL_EXPORT_COLUMNS = [
  "employeeCode",
  "employeeName",
  "department",
  "role",
  "baseSalary",
  "actualWorkDays",
  "totalHours",
  "overtimeNormalHours",
  "overtimeWeekendHours",
  "overtimeHolidayHours",
  "nightHours",
  "grossIncome",
  "allowance",
  "bonus",
  "deduction",
  "insuranceTotal",
  "personalIncomeTax",
  "netSalary",
  "paidAmount",
  "remainingAmount",
  "status",
].map((key) => ({ key, label: key }));

const sanitizeFilenamePart = (value) =>
  String(value || "payroll")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "");

const PAYROLL_SETTINGS_DEFAULTS = {
  standardWorkDaysPerMonth: 26,
  standardHoursPerDay: 8,
  overtimeMultiplierWeekday: 1.5,
  overtimeMultiplierWeekend: 2,
  overtimeMultiplierHoliday: 3,
  latenessPenaltyPerMinute: 0,
  earlyLeavePenaltyPerMinute: 0,
  unpaidLeaveDeductionPerDay: 0,
  defaultAllowance: 0,
  defaultBonus: 0,
  defaultDeduction: 0,
  weekendDays: ["SUN"],
  holidayDates: [],
  nightShiftStart: "22:00",
  nightShiftEnd: "06:00",
  nightShiftAllowanceRate: 0.3,
  enablePersonalIncomeTax: false,
  personalIncomeTaxRate: 0,
  personalIncomeTaxFreeThreshold: 0,
  allowPaidLeaveInWorkDays: true,
  notes: "",
};

const PAYROLL_SETTINGS_FIELDS = [
  "standardWorkDaysPerMonth",
  "standardHoursPerDay",
  "overtimeMultiplierWeekday",
  "overtimeMultiplierWeekend",
  "overtimeMultiplierHoliday",
  "latenessPenaltyPerMinute",
  "earlyLeavePenaltyPerMinute",
  "unpaidLeaveDeductionPerDay",
  "defaultAllowance",
  "defaultBonus",
  "defaultDeduction",
];

const WEEKDAY_OPTIONS = [
  { value: "MON", label: "Thứ 2" },
  { value: "TUE", label: "Thứ 3" },
  { value: "WED", label: "Thứ 4" },
  { value: "THU", label: "Thứ 5" },
  { value: "FRI", label: "Thứ 6" },
  { value: "SAT", label: "Thứ 7" },
  { value: "SUN", label: "Chủ nhật" },
];

const PAYROLL_ADVANCED_NUMBER_FIELDS = [
  "nightShiftAllowanceRate",
  "personalIncomeTaxRate",
  "personalIncomeTaxFreeThreshold",
];

const buildPayrollSettingsForm = (settings) => ({
  ...PAYROLL_SETTINGS_DEFAULTS,
  ...settings,
  weekendDays: Array.isArray(settings?.weekendDays)
    ? settings.weekendDays
    : PAYROLL_SETTINGS_DEFAULTS.weekendDays,
  holidayDates: Array.isArray(settings?.holidayDates)
    ? settings.holidayDates.map((value) => String(value).slice(0, 10))
    : PAYROLL_SETTINGS_DEFAULTS.holidayDates,
  nightShiftStart:
    settings?.nightShiftStart ?? PAYROLL_SETTINGS_DEFAULTS.nightShiftStart,
  nightShiftEnd:
    settings?.nightShiftEnd ?? PAYROLL_SETTINGS_DEFAULTS.nightShiftEnd,
  nightShiftAllowanceRate:
    settings?.nightShiftAllowanceRate ??
    PAYROLL_SETTINGS_DEFAULTS.nightShiftAllowanceRate,
  enablePersonalIncomeTax:
    settings?.enablePersonalIncomeTax ??
    PAYROLL_SETTINGS_DEFAULTS.enablePersonalIncomeTax,
  personalIncomeTaxRate:
    settings?.personalIncomeTaxRate ??
    PAYROLL_SETTINGS_DEFAULTS.personalIncomeTaxRate,
  personalIncomeTaxFreeThreshold:
    settings?.personalIncomeTaxFreeThreshold ??
    PAYROLL_SETTINGS_DEFAULTS.personalIncomeTaxFreeThreshold,
  allowPaidLeaveInWorkDays:
    settings?.allowPaidLeaveInWorkDays ??
    PAYROLL_SETTINGS_DEFAULTS.allowPaidLeaveInWorkDays,
  notes: settings?.notes ?? PAYROLL_SETTINGS_DEFAULTS.notes,
});

const toInputDate = (value) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let bit = 0; bit < 8; bit += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

const crc32 = (input) => {
  let crc = 0xffffffff;
  for (let i = 0; i < input.length; i += 1) {
    crc = CRC_TABLE[(crc ^ input[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const createZipBuffer = (files) => {
  const writeU16 = (view, offset, value) => view.setUint16(offset, value, true);
  const writeU32 = (view, offset, value) => view.setUint32(offset, value, true);
  const localFileRecords = [];
  const centralDirectory = [];
  let offset = 0;

  files.forEach(({ name, data }) => {
    const nameBytes = new TextEncoder().encode(name);
    const checksum = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length + data.length);
    const localView = new DataView(localHeader.buffer);
    writeU32(localView, 0, 0x04034b50);
    writeU16(localView, 4, 20);
    writeU16(localView, 6, 0);
    writeU16(localView, 8, 0);
    writeU16(localView, 10, 0);
    writeU16(localView, 12, 0);
    writeU32(localView, 14, checksum);
    writeU32(localView, 18, data.length);
    writeU32(localView, 22, data.length);
    writeU16(localView, 26, nameBytes.length);
    writeU16(localView, 28, 0);
    localHeader.set(nameBytes, 30);
    localHeader.set(data, 30 + nameBytes.length);
    localFileRecords.push(localHeader);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeU32(centralView, 0, 0x02014b50);
    writeU16(centralView, 4, 20);
    writeU16(centralView, 6, 20);
    writeU16(centralView, 8, 0);
    writeU16(centralView, 10, 0);
    writeU16(centralView, 12, 0);
    writeU16(centralView, 14, 0);
    writeU32(centralView, 16, checksum);
    writeU32(centralView, 20, data.length);
    writeU32(centralView, 24, data.length);
    writeU16(centralView, 28, nameBytes.length);
    writeU16(centralView, 30, 0);
    writeU16(centralView, 32, 0);
    writeU16(centralView, 34, 0);
    writeU16(centralView, 36, 0);
    writeU32(centralView, 38, 0);
    writeU32(centralView, 42, offset);
    centralHeader.set(nameBytes, 46);
    centralDirectory.push(centralHeader);

    offset += localHeader.length;
  });

  const centralSize = centralDirectory.reduce(
    (sum, row) => sum + row.length,
    0,
  );
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  writeU32(endView, 0, 0x06054b50);
  writeU16(endView, 4, 0);
  writeU16(endView, 6, 0);
  writeU16(endView, 8, files.length);
  writeU16(endView, 10, files.length);
  writeU32(endView, 12, centralSize);
  writeU32(endView, 16, offset);
  writeU16(endView, 20, 0);

  const output = new Uint8Array(offset + centralSize + endRecord.length);
  let cursor = 0;
  [...localFileRecords, ...centralDirectory, endRecord].forEach((chunk) => {
    output.set(chunk, cursor);
    cursor += chunk.length;
  });
  return output;
};

const buildPayrollXlsxBlob = ({ rows, sheetName = "BangLuong" }) => {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const sheetRows = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map((cell, cellIndex) => {
            const col = String.fromCharCode(65 + cellIndex);
            const isNumber = typeof cell === "number" && Number.isFinite(cell);
            return isNumber
              ? `<c r="${col}${rowIndex + 1}"><v>${cell}</v></c>`
              : `<c r="${col}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
          })
          .join("")}</row>`,
    )
    .join("");
  const worksheet = `${xmlHeader}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
  const workbook = `${xmlHeader}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const workbookRels = `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const rootRels = `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const styles = `${xmlHeader}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellXfs count="1"><xf fontId="0" fillId="0" borderId="0"/></cellXfs></styleSheet>`;
  const contentTypes = `${xmlHeader}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const encoder = new TextEncoder();
  const zipBytes = createZipBuffer([
    { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { name: "_rels/.rels", data: encoder.encode(rootRels) },
    { name: "xl/workbook.xml", data: encoder.encode(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRels) },
    { name: "xl/worksheets/sheet1.xml", data: encoder.encode(worksheet) },
    { name: "xl/styles.xml", data: encoder.encode(styles) },
  ]);

  return new Blob([zipBytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};

const getSettingsRestaurantId = ({ settings, periodDetail, periods }) =>
  settings?.restaurantId ||
  periodDetail?.period?.restaurantId ||
  periods?.[0]?.restaurantId ||
  null;

const PayrollSettingsModal = ({
  settings,
  loading,
  loadError,
  saveError,
  isSaving,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState(() => buildPayrollSettingsForm(settings));

  useEffect(() => {
    setForm(buildPayrollSettingsForm(settings));
  }, [settings]);

  const setField = (key, value) =>
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));

  const hasPersistedSettings = Boolean(settings?.updatedAt);

  return (
    <div
      className="modal-overlay"
      data-testid="payroll-settings-modal"
      onClick={onClose}
    >
      <div className="payslip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Cấu hình lương</h3>
          <button className="close-btn" type="button" onClick={onClose}>
            x
          </button>
        </div>
        <div className="modal-body">
          {loading && (
            <div className="settings-modal-state">
              Đang tải cấu hình lương...
            </div>
          )}
          {!loading && !hasPersistedSettings && (
            <div className="settings-modal-state">
              Chưa có cấu hình lương trong dữ liệu. Hệ thống sẽ tạo mới khi bạn
              lưu.
            </div>
          )}
          {loadError && (
            <div className="settings-modal-state settings-modal-state--error">
              Không tải được cấu hình hiện tại. Bạn vẫn có thể nhập và lưu cấu
              hình mới.
            </div>
          )}
          {saveError && (
            <div
              className="settings-modal-state settings-modal-state--error"
              data-testid="payroll-settings-save-error"
            >
              {saveError}
            </div>
          )}

          <div className="settings-form-grid">
            {PAYROLL_SETTINGS_FIELDS.map((field) => (
              <label key={field} className="settings-field">
                <span>{field}</span>
                <input
                  type="number"
                  value={form[field]}
                  onChange={(e) => setField(field, Number(e.target.value || 0))}
                />
              </label>
            ))}
            <div className="settings-field">
              <span>Ngày cuối tuần</span>
              <div className="settings-checkbox-group">
                {WEEKDAY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="settings-inline-checkbox"
                  >
                    <input
                      type="checkbox"
                      checked={(form.weekendDays || []).includes(option.value)}
                      onChange={(e) => {
                        const current = new Set(form.weekendDays || []);
                        if (e.target.checked) current.add(option.value);
                        else current.delete(option.value);
                        setField("weekendDays", Array.from(current));
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="settings-field">
              <span>Ngày lễ, mỗi dòng một ngày YYYY-MM-DD</span>
              <textarea
                rows={4}
                value={(form.holidayDates || []).join("\n")}
                onChange={(e) =>
... (truncated)