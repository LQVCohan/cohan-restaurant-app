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
                  setField(
                    "holidayDates",
                    e.target.value
                      .split(/\n|,/)
                      .map((value) => value.trim())
                      .filter(Boolean),
                  )
                }
                placeholder={"2026-01-01\n2026-04-30\n2026-05-01"}
              />
            </label>
            <label className="settings-field">
              <span>Bắt đầu ca đêm</span>
              <input
                type="time"
                value={form.nightShiftStart || "22:00"}
                onChange={(e) => setField("nightShiftStart", e.target.value)}
              />
            </label>

            <label className="settings-field">
              <span>Kết thúc ca đêm</span>
              <input
                type="time"
                value={form.nightShiftEnd || "06:00"}
                onChange={(e) => setField("nightShiftEnd", e.target.value)}
              />
            </label>
            {PAYROLL_ADVANCED_NUMBER_FIELDS.map((field) => (
              <label key={field} className="settings-field">
                <span>{field}</span>
                <input
                  type="number"
                  value={form[field]}
                  onChange={(e) => setField(field, Number(e.target.value || 0))}
                />
              </label>
            ))}
            <label className="settings-field settings-field--checkbox">
              <input
                type="checkbox"
                checked={Boolean(form.enablePersonalIncomeTax)}
                onChange={(e) =>
                  setField("enablePersonalIncomeTax", e.target.checked)
                }
              />
              <span>Bật tính thuế TNCN</span>
            </label>
            <label className="settings-field settings-field--checkbox">
              <input
                type="checkbox"
                checked={form.allowPaidLeaveInWorkDays}
                onChange={(e) =>
                  setField("allowPaidLeaveInWorkDays", e.target.checked)
                }
              />
              <span>Tính nghỉ có lương vào công thực tế</span>
            </label>

            <label className="settings-field">
              <span>Ghi chú</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Hủy
          </button>
          <button
            className="btn btn-primary"
            data-testid="payroll-settings-save"
            type="button"
            disabled={isSaving}
            onClick={() =>
              onSave({
                ...form,
                weekendDays: Array.from(new Set(form.weekendDays || [])),
                holidayDates: Array.from(
                  new Set(
                    (form.holidayDates || [])
                      .map((value) => String(value).trim())
                      .filter(Boolean),
                  ),
                ),
              })
            }
          >
            {isSaving ? "Đang lưu..." : "Lưu cấu hình"}
          </button>
        </div>
      </div>
    </div>
  );
};

const PayrollManagement = () => {
  const location = useLocation();
  const [dateRange, setDateRange] = useState(getDefaultRange);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [employeeFilterId, setEmployeeFilterId] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [sortBy, setSortBy] = useState("net_desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedPayslipEmployeeId, setSelectedPayslipEmployeeId] =
    useState("");
  const [payslipLoading, setPayslipLoading] = useState(false);
  const [paymentMutationLoading, setPaymentMutationLoading] = useState(false);
  const [showBatchPayment, setShowBatchPayment] = useState(false);
  const [paymentMode, setPaymentMode] = useState("selected");
  const [batchPaymentLoading, setBatchPaymentLoading] = useState(false);
  const [batchPaymentError, setBatchPaymentError] = useState("");
  const [batchPaymentResult, setBatchPaymentResult] = useState(null);
  const [batchPaymentForm, setBatchPaymentForm] = useState({
    method: "cash",
    paidAt: new Date().toISOString().slice(0, 16),
    note: "",
  });
  const [bankAccountModal, setBankAccountModal] = useState(null);
  const [bankAccountForm, setBankAccountForm] = useState({ accountHolderName: "", bankName: "", bankCode: "", accountNumber: "", branchName: "", verificationStatus: "verified", isDefault: true });
  const [sourceAccountModal, setSourceAccountModal] = useState(false);
  const [sourceAccountForm, setSourceAccountForm] = useState({ accountName: "", bankName: "", bankCode: "", accountNumber: "", provider: "manual", status: "active", payoutEnabled: true, dailyLimit: "", perTransactionLimit: "" });
  const [payoutModal, setPayoutModal] = useState(null);
  const [payoutForm, setPayoutForm] = useState({ method: "bank_transfer", note: "", referenceCode: "" });
  const [payoutResult, setPayoutResult] = useState(null);
  const [financialSetupLoading, setFinancialSetupLoading] = useState(false);
  const [financialSetupError, setFinancialSetupError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentType, setAdjustmentType] = useState("bonus");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const { user } = useContext(AuthContext);

  const role = resolveUserRoleName(user) || "admin";
  const isAdminOrAccountant = ["admin", "accountant"].includes(role);
  const payrollUiPermissions = {
    canConfigure: isAdminOrAccountant || hasAnyPermission(user, ["payroll.settings.update"]),
    canCreate: isAdminOrAccountant || hasAnyPermission(user, ["payroll.period.create"]),
    canRecalculate: isAdminOrAccountant || hasAnyPermission(user, ["payroll.period.recalculate"]),
    canFinalize: isAdminOrAccountant || hasAnyPermission(user, ["payroll.period.finalize"]),
    canLock: isAdminOrAccountant || hasAnyPermission(user, ["payroll.period.lock"]),
    canAdjust: isAdminOrAccountant || hasAnyPermission(user, ["payroll.adjustment.write"]),
    canPay: ["admin", "accountant", "hr", "manager"].includes(role) || hasAnyPermission(user, ["payroll.payment.record"]),
    canPayout: isAdminOrAccountant || hasAnyPermission(user, ["payroll.payout.execute"]),
    canExport: ["admin", "accountant", "hr", "manager"].includes(role) || hasAnyPermission(user, ["payroll.export"]),
  };

  const {
    restaurantOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    restaurantsLoading,
    hasRestaurants,
  } = useManagerRestaurantSelection();

  const handleRestaurantChange = (restaurantId) => {
    setSelectedRestaurantId(restaurantId);
    setSelectedPeriodId("");
    setSelectedIds([]);
    setEmployeeFilterId("");
    setSelectedPayslipEmployeeId("");
    setShowBatchPayment(false);
  };

  const {
    periods,
    currentPeriodId,
    periodDetail,
    payrollItems,
    payrollStats,
    payrollSettings,
    resolvedRestaurantId,
    settingsLoading,
    settingsError,
    loading,
    error,
    createPeriod,
    recalculatePeriod,
    finalizePeriod,
    lockPeriod,
    markPayrollItemPaid,
    batchMarkPayrollPaid,
    createPayrollPayout,
    upsertEmployeeBankAccount,
    verifyEmployeeBankAccount,
    upsertRestaurantPayoutAccount,
    payrollPayslip,
    payrollPayments,
    refetchPayrollPayslip,
    refetchPayrollPayments,
    refetchPayrollExportRows,
    updateSettings,
    upsertAdjustment,
    validationResult,
    payrollReadiness,
    readinessLoading,
    readinessError,
    refetchValidation,
    refetchPayrollReadiness,
    refetchDetail,
    refetchPayrollPeriodDetail,
    refetchPeriods,
    refetchPayrollPeriods,
    refetchSettings,
  } = usePayroll({
    restaurantId: selectedRestaurantId || undefined,
    periodId: selectedPeriodId || undefined,
    startDate: dateRange.start
      ? new Date(dateRange.start).toISOString()
      : undefined,
    endDate: dateRange.end ? new Date(dateRange.end).toISOString() : undefined,
  });

  const employeeIdFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    return params.get("employeeId") || "";
  }, [location.search]);

  useEffect(() => {
    if (!selectedPeriodId && currentPeriodId) {
      setSelectedPeriodId(currentPeriodId);
    }
  }, [currentPeriodId, selectedPeriodId]);

  useEffect(() => {
    setEmployeeFilterId(employeeIdFromQuery || "");
  }, [employeeIdFromQuery]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(Number(amount || 0));

  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "--";

  const getStatusBadge = (status) => {
    const map = {
      draft: { label: "Nháp", class: "draft" },
      finalized: { label: "Đã chốt", class: "info" },
      paying: { label: "Đang chi trả", class: "info" },
      paid: { label: "Đã thanh toán", class: "success" },
      locked: { label: "Đã khóa", class: "warning" },
    };
    const s = map[status] || map.draft;
    return <span className={`status-dot ${s.class}`}>{s.label}</span>;
  };

  const departmentOptions = useMemo(() => {
    const set = new Set(
      payrollItems.map((item) => item.department).filter(Boolean),
    );
    return ["all", ...Array.from(set)];
  }, [payrollItems]);

  const filteredData = useMemo(() => {
    const list = payrollItems.filter((item) => {
      const matchTab = activeTab === "all" || item.status === activeTab;
      const matchDept = deptFilter === "all" || item.department === deptFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        String(item.name || "")
          .toLowerCase()
          .includes(q) ||
        String(item.code || "")
          .toLowerCase()
          .includes(q);
      const matchEmployee =
        !employeeFilterId || String(item.id) === String(employeeFilterId);
      return matchTab && matchDept && matchSearch && matchEmployee;
    });
    if (sortBy === "name_asc")
      list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    else if (sortBy === "name_desc")
      list.sort((a, b) => String(b.name).localeCompare(String(a.name)));
    else if (sortBy === "net_asc")
      list.sort((a, b) => Number(a.netSalary || 0) - Number(b.netSalary || 0));
    else
      list.sort((a, b) => Number(b.netSalary || 0) - Number(a.netSalary || 0));
    return list;
  }, [
    payrollItems,
    activeTab,
    deptFilter,
    employeeFilterId,
    searchQuery,
    sortBy,
  ]);

  const stats = useMemo(() => {
    if (payrollStats) return payrollStats;
    return { totalPayroll: 0, paidAmount: 0, remaining: 0, progress: 0 };
  }, [payrollStats]);

  const displayedPeriod = periodDetail?.period || null;
  const periodStatus = displayedPeriod?.status || "draft";
  const readinessBlocksFinalize =
    payrollReadiness?.readyToFinalize === false;
  const canPayInPeriod = ["finalized", "paying"].includes(periodStatus) && payrollUiPermissions.canPay;
  const isPeriodLocked = periodStatus === "locked";
  const selectedPayableItems = useMemo(
    () =>
      payrollItems.filter(
        (item) => selectedIds.includes(item.id) && item.status !== "paid",
      ),
    [payrollItems, selectedIds],
  );
  const unpaidItems = useMemo(() => payrollItems.filter((item) => item.status !== "paid" && item.status !== "locked" && Number(item.remainingAmount ?? item.netSalary ?? 0) > 0), [payrollItems]);
  const hasBatchPayableSelection =
    selectedPayableItems.length > 0 && canPayInPeriod && !isPeriodLocked;
  const canPayFullPeriod = canPayInPeriod && Number(stats.remaining || 0) > 0 && unpaidItems.length > 0;
  const modalPayslip =
    String(payrollPayslip?.employee?.id || payrollPayslip?.item?.id || "") ===
    String(selectedPayslipEmployeeId)
      ? payrollPayslip
      : null;
  const modalPayments = useMemo(
    () =>
      (payrollPayments || []).filter(
        (payment) =>
          !selectedPayslipEmployeeId ||
          String(payment.employeeId) === String(selectedPayslipEmployeeId),
      ),
    [payrollPayments, selectedPayslipEmployeeId],
  );
  const hasRealItems = payrollItems.length > 0;
  const currentAppliedPeriod = useMemo(
    () =>
      periods.find((period) => String(period.id) === String(currentPeriodId)) ||
      null,
    [periods, currentPeriodId],
  );
  const settingsRestaurantId = selectedRestaurantId || resolvedRestaurantId || getSettingsRestaurantId({
    settings: payrollSettings,
    periodDetail,
    periods,
  });

  useEffect(() => {
    if (!displayedPeriod) return;
    setDateRange({
      start: toInputDate(displayedPeriod.startDate),
      end: toInputDate(displayedPeriod.endDate),
    });
  }, [displayedPeriod]);

  const handleSelectPeriod = (nextPeriodId) => {
    if (!nextPeriodId || nextPeriodId === selectedPeriodId) return;
    const currentPeriod = periods.find((p) => p.id === selectedPeriodId);
    if (
      currentPeriod &&
      currentPeriod.id === currentPeriodId &&
      currentPeriod.status !== "paid"
    ) {
      alert("Chỉ được đổi kỳ khi kỳ hiện tại đã tính xong và xác nhận trả đủ.");
      return;
    }
    setSelectedPeriodId(nextPeriodId);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(
        filteredData
          .filter((item) => item.status !== "paid")
          .map((item) => item.id),
      );
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreatePeriod = async () => {
    if (!selectedRestaurantId) return;
    const isDifferentFromCurrentApplied =
      currentAppliedPeriod &&
      (toInputDate(currentAppliedPeriod.startDate) !== dateRange.start ||
        toInputDate(currentAppliedPeriod.endDate) !== dateRange.end);

    if (
      isDifferentFromCurrentApplied &&
      currentAppliedPeriod?.status !== "paid"
    ) {
      alert(
        "Chi duoc doi ky luong sau khi ky dang ap dung da tinh xong va da xac nhan tra du.",
      );
      return;
    }

    try {
      const created = await createPeriod({
        variables: {
          input: {
            startDate: dateRange.start,
            endDate: dateRange.end,
            restaurantId: selectedRestaurantId,
            name: `Kỳ ${dateRange.start} - ${dateRange.end}`,
          },
        },
      });
      const id = created?.data?.createPayrollPeriod?.id;
      if (id) {
        await refetchSettings?.();
        setSelectedPeriodId(id);
      }
    } catch (err) {
      alert(
        getPayrollActionErrorMessage(
          err,
          `Không thể thiết lập kỳ lương: ${err?.message || "Lỗi không xác định"}`,
        ),
      );
    }
  };

  const handleOpenPayslip = async (employeeId) => {
    if (!selectedPeriodId || !employeeId) return;
    setSelectedPayslipEmployeeId(employeeId);
    setPayslipLoading(true);
    try {
      await Promise.all(
        [
          refetchPayrollPayslip?.({ periodId: selectedPeriodId, employeeId }),
          refetchPayrollPayments?.({ periodId: selectedPeriodId, employeeId }),
        ].filter(Boolean),
      );
    } catch (err) {
      alert(getPayrollActionErrorMessage(err, "Không tải được phiếu lương."));
    } finally {
      setPayslipLoading(false);
    }
  };

  const handleSingleMarkPaid = async (input) => {
    setPaymentMutationLoading(true);
    try {
      return await markPayrollItemPaid(input);
    } finally {
      setPaymentMutationLoading(false);
    }
  };

  const handlePaidSuccess = async () => {
    const employeeId = selectedPayslipEmployeeId;
    await Promise.all(
      [
        employeeId
          ? refetchPayrollPayslip?.({ periodId: selectedPeriodId, employeeId })
          : null,
        employeeId
          ? refetchPayrollPayments?.({ periodId: selectedPeriodId, employeeId })
          : null,
        refetchPayrollPeriodDetail?.() || refetchDetail?.(),
        refetchPayrollPeriods?.() || refetchPeriods?.(),
      ].filter(Boolean),
    );
    alert("✅ Đã thanh toán phiếu lương.");
  };

  const handleExportCsv = async () => {
    if (!selectedRestaurantId || !selectedPeriodId) return;
    try {
      const result = await refetchPayrollExportRows?.({
        periodId: selectedPeriodId,
      });
      const rows = result?.data?.payrollExportRows || [];
      const periodName =
        displayedPeriod?.name || periodDetail?.period?.name || selectedPeriodId;
      const today = new Date().toISOString().slice(0, 10);
      downloadCsv(
        `payroll_${sanitizeFilenamePart(periodName)}_${today}.csv`,
        rows,
        PAYROLL_EXPORT_COLUMNS,
      );
    } catch (err) {
      alert(
        getPayrollActionErrorMessage(err, "Không thể xuất CSV bảng lương."),
      );
    }
  };

  const openBatchPaymentModal = () => {
    if (!selectedRestaurantId || !selectedPeriodId || !hasBatchPayableSelection) return;
    setPaymentMode("selected");
    setBatchPaymentError("");
    setBatchPaymentResult(null);
    setBatchPaymentForm({
      method: "cash",
      paidAt: new Date().toISOString().slice(0, 16),
      note: "",
    });
    setShowBatchPayment(true);
  };

  const handleOpenFullPeriodPayment = () => {
    if (!selectedRestaurantId || !selectedPeriodId || !canPayFullPeriod) return;
    setPaymentMode("full");
    setBatchPaymentError("");
    setBatchPaymentResult(null);
    setShowBatchPayment(true);
  };

  const handleBatchPaymentSubmit = async () => {
    if (!selectedRestaurantId || !selectedPeriodId) return;
    setBatchPaymentLoading(true);
    setBatchPaymentError("");
    setBatchPaymentResult(null);
    try {
      const targetItems = paymentMode === "full" ? [] : selectedPayableItems;
      const result = await batchMarkPayrollPaid({
        periodId: selectedPeriodId,
        employeeIds: targetItems.map((item) => item.id),
        method: batchPaymentForm.method || "cash",
        paidAt: batchPaymentForm.paidAt
          ? new Date(batchPaymentForm.paidAt).toISOString()
          : new Date().toISOString(),
        note: batchPaymentForm.note,
      });
      const payload = result?.data?.batchMarkPayrollPaid || {};
      setBatchPaymentResult(payload);
      await Promise.all(
        [
          refetchPayrollPeriodDetail?.() || refetchDetail?.(),
          refetchPayrollPeriods?.() || refetchPeriods?.(),
        ].filter(Boolean),
      );
      setSelectedIds([]);
    } catch (err) {
      setBatchPaymentError(getPayrollPaymentErrorMessage(err));
    } finally {
      setBatchPaymentLoading(false);
    }
  };


  const openEmployeeBankAccountModal = (item) => {
    setFinancialSetupError("");
    setBankAccountModal(item);
    setBankAccountForm({
      accountHolderName: item?.name || "",
      bankName: "",
      bankCode: "",
      accountNumber: "",
      branchName: "",
      verificationStatus: "verified",
      isDefault: true,
    });
  };

  const submitEmployeeBankAccount = async () => {
    if (!bankAccountModal || !selectedRestaurantId) return;
    setFinancialSetupLoading(true);
    setFinancialSetupError("");
    try {
      await upsertEmployeeBankAccount({
        employeeId: bankAccountModal.id,
        restaurantId: selectedRestaurantId,
        ...bankAccountForm,
        isDefault: Boolean(bankAccountForm.isDefault),
      });
      if (bankAccountForm.verificationStatus === "verified") {
        await verifyEmployeeBankAccount({ employeeId: bankAccountModal.id, restaurantId: selectedRestaurantId, verificationStatus: "verified" });
      }
      setBankAccountModal(null);
    } catch (err) {
      setFinancialSetupError(getPayrollActionErrorMessage(err, "Không thể lưu tài khoản nhận lương."));
    } finally {
      setFinancialSetupLoading(false);
    }
  };

  const submitRestaurantPayoutAccount = async () => {
    if (!selectedRestaurantId) return;
    setFinancialSetupLoading(true);
    setFinancialSetupError("");
    try {
      await upsertRestaurantPayoutAccount({
        restaurantId: selectedRestaurantId,
        ...sourceAccountForm,
        payoutEnabled: Boolean(sourceAccountForm.payoutEnabled),
        dailyLimit: Number(sourceAccountForm.dailyLimit || 0),
        perTransactionLimit: Number(sourceAccountForm.perTransactionLimit || 0),
      });
      setSourceAccountModal(false);
    } catch (err) {
      setFinancialSetupError(getPayrollActionErrorMessage(err, "Không thể lưu tài khoản nguồn chi lương."));
    } finally {
      setFinancialSetupLoading(false);
    }
  };

  const openPayoutModal = (item) => {
    setPayoutResult(null);
    setFinancialSetupError("");
    setPayoutModal(item);
    setPayoutForm({ method: "bank_transfer", note: "", referenceCode: "" });
  };

  const submitPayrollPayout = async () => {
    if (!payoutModal || !selectedPeriodId) return;
    setFinancialSetupLoading(true);
    setFinancialSetupError("");
    setPayoutResult(null);
    try {
      const result = await createPayrollPayout({
        periodId: selectedPeriodId,
        employeeId: payoutModal.id,
        method: payoutForm.method,
        note: payoutForm.note,
        referenceCode: payoutForm.referenceCode,
        idempotencyKey: `ui-payout:${selectedPeriodId}:${payoutModal.id}:${Date.now()}`,
      });
      const payout = result?.data?.createPayrollPayout || result;
      setPayoutResult(payout);
      await Promise.all([refetchPayrollPeriodDetail?.() || refetchDetail?.(), refetchPayrollPeriods?.() || refetchPeriods?.()].filter(Boolean));
    } catch (err) {
      setFinancialSetupError(getPayrollActionErrorMessage(err, "Không thể tạo payout/chuyển khoản."));
    } finally {
      setFinancialSetupLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!selectedRestaurantId || !selectedPeriodId) return;
    const header = [
      "Nhân viên",
      "Mã NV",
      "Phòng ban",
      "Lương cơ bản",
      "Công thực tế",
      "Giờ công",
      "Phụ cấp",
      "Thưởng",
      "OT",
      "Tổng thu nhập",
      "Tổng khấu trừ",
      "Thực lĩnh",
      "Trạng thái",
    ];

    const rows = filteredData.map((item) => [
      item.name,
      item.code || "",
      item.department || "",
      Number(item.baseSalary || 0),
      `${item.actualWorkDays}/${item.workDays}`,
      Number(item.totalHours || 0),
      Number(item.allowance || 0),
      Number(item.bonus || 0),
      Number(item.overtime || 0),
      Number(item.totalIncome || 0),
      Number(item.totalDeduction || 0),
      Number(item.netSalary || 0),
      item.status,
    ]);

    const blob = buildPayrollXlsxBlob({
      rows: [header, ...rows],
      sheetName: "BangLuong",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bang-luong-${periodDetail?.period?.id || "period"}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenSettings = () => {
    if (!selectedRestaurantId) return;
    setSettingsSaveError("");
    setShowSettings(true);
  };

  const handleCloseSettings = () => {
    if (settingsSaving) return;
    setSettingsSaveError("");
    setShowSettings(false);
  };

  const handleSaveSettings = async (formData) => {
    setSettingsSaveError("");
    setSettingsSaving(true);

    try {
      const input = selectedRestaurantId
        ? { ...formData, restaurantId: selectedRestaurantId }
        : { ...formData, restaurantId: settingsRestaurantId };

      await updateSettings({ variables: { input } });

      const refetchTasks = [];
      if (selectedPeriodId || currentPeriodId) {
        refetchTasks.push(refetchDetail?.());
      }
      refetchTasks.push(refetchSettings?.());
      await Promise.all(refetchTasks.filter(Boolean));

      setShowSettings(false);
    } catch (saveError) {
      setSettingsSaveError(
        getPayrollActionErrorMessage(
          saveError,
          saveError?.message || "Không thể lưu cấu hình lương.",
        ),
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleOpenReadinessPanel = async () => {
    if (!selectedRestaurantId || !selectedPeriodId) return;
    setShowValidationPanel(true);

    const tasks = [];
    if (refetchPayrollReadiness) tasks.push(refetchPayrollReadiness());
    if (refetchValidation) tasks.push(refetchValidation());

    await Promise.allSettled(tasks);
  };

  const handleGoToReadinessIssue = (issue) => {
    const action = dispatchPayrollReadinessNavigation(issue);

    if (action.page === "payroll") {
      alert(
        issue?.suggestedAction ||
          issue?.message ||
          "Vui lòng xử lý lỗi trước khi chốt lương.",
      );
    }
  };

  const handleApplyAdjustment = async () => {
    if (!selectedPayslipEmployeeId || !selectedPeriodId) return;
    const amount = Number(adjustmentAmount || 0);
    if (!(amount > 0)) return;
    if (
      ["deduction", "advance", "other_deduction"].includes(adjustmentType) &&
      !String(adjustmentNote || "").trim()
    ) {
      alert("Vui lòng nhập ghi chú cho khoản khấu trừ/tạm ứng.");
      return;
    }
    try {
      await upsertAdjustment({
        variables: {
          input: {
            periodId: selectedPeriodId,
            employeeId: selectedPayslipEmployeeId,
            type: adjustmentType,
            amount,
            note: adjustmentNote,
          },
        },
      });
      setAdjustmentAmount("");
      setAdjustmentNote("");
      await refetchDetail?.();
      await refetchValidation?.();
      alert("✅ Đã cập nhật điều chỉnh bảng lương.");
    } catch (err) {
      alert(
        getPayrollActionErrorMessage(
          err,
          `❌ Không thể cập nhật điều chỉnh: ${err?.message || "Lỗi không xác định"}`,
        ),
      );
    }
  };

  return (
    <div className="payroll-page-compact">
      <div className="header-toolbar">
        <div className="left-section">
          <h2 className="page-title">Quản lý lương</h2>
          <div className="cycle-picker-compact">
            <div className="input-group">
              <span className="label">Nhà hàng:</span>
              <select
                className="filter-select"
                data-testid="payroll-restaurant-select"
                value={selectedRestaurantId}
                onChange={(event) => handleRestaurantChange(event.target.value)}
                disabled={restaurantsLoading || !hasRestaurants}
              >
                <option value="">
                  {restaurantsLoading ? "Đang tải nhà hàng..." : "Chọn nhà hàng"}
                </option>
                {restaurantOptions.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <span className="label">Từ:</span>
              <input
                type="date"
                name="start"
                value={dateRange.start}
                onChange={handleDateChange}
              />
            </div>
            <span className="arrow">➝</span>
            <div className="input-group">
              <span className="label">Đến:</span>
              <input
                type="date"
                name="end"
                value={dateRange.end}
                onChange={handleDateChange}
              />
            </div>
            <button
              className="btn btn-white"
              data-testid="payroll-period-setup"
              onClick={handleCreatePeriod}
              disabled={!selectedRestaurantId || !payrollUiPermissions.canCreate}
            >
              Thiết lập kỳ lương
            </button>
          </div>
        </div>

        <div className="right-actions">
          <select
            className="filter-select"
            value={selectedPeriodId}
            onChange={(e) => handleSelectPeriod(e.target.value)}
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name ||
                  `${formatDate(p.startDate)} - ${formatDate(p.endDate)}`}{" "}
                ({p.status})
              </option>
            ))}
          </select>
          <button
            className="btn btn-white"
            data-testid="payroll-settings-open"
            onClick={handleOpenSettings}
            disabled={!selectedRestaurantId || !payrollUiPermissions.canConfigure}
          >
            ⚙️ Cấu hình
          </button>
          <button
            className="btn btn-white"
            type="button"
            onClick={() => setSourceAccountModal(true)}
            disabled={!selectedRestaurantId || !payrollUiPermissions.canPayout}
          >
            🏦 Tài khoản nguồn
          </button>
          <button className="btn btn-white" onClick={handleExportExcel} disabled={!selectedRestaurantId || !selectedPeriodId || !payrollUiPermissions.canExport}>
            📥 Xuất Excel
          </button>
          <button
            className="btn btn-white"
            onClick={handleExportCsv}
            disabled={!selectedRestaurantId || !selectedPeriodId || periodStatus === "draft" || !payrollUiPermissions.canExport}
          >
            Xuất CSV
          </button>
          <button
            className="btn btn-primary"
            disabled={!selectedRestaurantId || !selectedPeriodId || periodStatus !== "draft" || !payrollUiPermissions.canRecalculate}
            onClick={async () => {
              if (!selectedRestaurantId || !selectedPeriodId) return;
              try {
                await recalculatePeriod({
                  variables: { periodId: selectedPeriodId },
                });
                alert("✅ Đã tính lại bảng lương.");
              } catch (err) {
                alert(
                  getPayrollActionErrorMessage(
                    err,
                    `❌ Không thể tính lại bảng lương: ${err?.message || "Lỗi không xác định"}`,
                  ),
                );
              }
            }}
          >
            🔄 Tính lại
          </button>
        </div>
      </div>

      {!selectedRestaurantId && !restaurantsLoading ? (
        <div className="settings-modal-state" style={{ margin: "16px 0" }}>
          Chọn nhà hàng để xem bảng lương
        </div>
      ) : null}

      {periodDetail?.period && (
        <div className="metrics-strip" style={{ marginBottom: 12 }}>
          <div className="metric-group">
            <div className="metric-item">
              <span className="label">Kỳ đang áp dụng</span>
              <span className="value">
                {formatDate(periodDetail.period.startDate)} -{" "}
                {formatDate(periodDetail.period.endDate)}
              </span>
            </div>
            <div className="separator"></div>
            <div className="metric-item">
              <span className="label">Trạng thái kỳ</span>
              <span className="value">
                {getStatusBadge(periodDetail.period.status)}
              </span>
            </div>
          </div>
          <div className="right-actions" style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-white"
              onClick={handleOpenReadinessPanel}
              disabled={!selectedRestaurantId || !selectedPeriodId}
            >
              Kiểm tra trước khi chốt
            </button>
            <button
              className="btn btn-white"
              disabled={
                !selectedRestaurantId ||
                !selectedPeriodId ||
                periodStatus !== "draft" ||
                !payrollUiPermissions.canFinalize ||
                Number(validationResult?.errorCount || 0) > 0 ||
                readinessBlocksFinalize
              }
              onClick={async () => {
                if (!selectedRestaurantId || !selectedPeriodId) return;
                try {
                  await finalizePeriod({
                    variables: { periodId: selectedPeriodId },
                  });
                  alert("✅ Đã chốt kỳ lương.");
                } catch (err) {
                  const message = String(err?.message || err?.code || "");

                  if (message.includes("PAYROLL_PERIOD_NOT_READY")) {
                    setShowValidationPanel(true);
                    await refetchPayrollReadiness?.();
                    alert(
                      "Kỳ lương chưa sẵn sàng chốt. Vui lòng xử lý các lỗi trong bảng kiểm tra trước khi chốt.",
                    );
                    return;
                  }

                  alert(
                    getPayrollActionErrorMessage(
                      err,
                      `❌ Không thể chốt kỳ lương: ${err?.message || "Lỗi không xác định"}`,
                    ),
                  );
                }
              }}
            >
              Chốt kỳ
            </button>
            <button
              className="btn btn-white"
              disabled={!selectedRestaurantId || !selectedPeriodId || periodStatus !== "paid" || !payrollUiPermissions.canLock}
              onClick={async () => {
                if (!selectedRestaurantId || !selectedPeriodId) return;
                try {
                  await lockPeriod({
                    variables: { periodId: selectedPeriodId },
                  });
                  alert("✅ Đã khóa kỳ lương.");
                } catch (err) {
                  alert(
                    getPayrollActionErrorMessage(
                      err,
                      `❌ Không thể khóa kỳ lương: ${err?.message || "Lỗi không xác định"}`,
                    ),
                  );
                }
              }}
            >
              Khóa kỳ
            </button>
            <button
              className="btn btn-success"
              data-testid="full-period-payroll-paid-open"
              disabled={!selectedRestaurantId || !selectedPeriodId || !canPayFullPeriod}
              onClick={handleOpenFullPeriodPayment}
            >
              Thanh toán toàn bộ kỳ
            </button>
            <button
              className="btn btn-primary"
              data-testid="batch-payroll-paid-open"
              disabled={!selectedRestaurantId || !selectedPeriodId || !hasBatchPayableSelection}
              onClick={openBatchPaymentModal}
            >
              Thanh toán đã chọn ({selectedPayableItems.length})
            </button>
          </div>
        </div>
      )}

      {readinessBlocksFinalize && (
        <p className="payroll-action-hint payroll-action-hint--error">
          Kỳ lương chưa sẵn sàng chốt. Vui lòng xử lý các lỗi trong bảng kiểm tra.
        </p>
      )}

      {showValidationPanel && (
        <PayrollReadinessPanel
          readiness={payrollReadiness}
          loading={readinessLoading}
          error={readinessError}
          onRefresh={handleOpenReadinessPanel}
          onGoToIssue={handleGoToReadinessIssue}
        />
      )}

      <div className="metrics-strip">
        <div className="metric-group">
          <div className="metric-item">
            <span className="label">Tổng quỹ lương</span>
            <span className="value highlight">
              {formatCurrency(stats.totalPayroll)}
            </span>
          </div>
          <div className="separator"></div>
          <div className="metric-item">
            <span className="label">Đã chi trả</span>
            <span className="value success">
              {formatCurrency(stats.paidAmount)}
            </span>
          </div>
          <div className="separator"></div>
          <div className="metric-item">
            <span className="label">Còn lại</span>
            <span className="value danger">
              {formatCurrency(stats.remaining)}
            </span>
          </div>
        </div>

        <div className="progress-section">
          <div className="progress-info">
            <span>Tiến độ giải ngân</span>
            <strong>{stats.progress}%</strong>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${stats.progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-controls">
          <div className="left-controls">
            <div className="workflow-tabs">
              {["all", "draft", "finalized", "paying", "pending_payment", "processing_payment", "payment_failed", "paid", "locked"].map((tab) => (
                <button
                  key={tab}
                  className={`tab-btn ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "all" ? "Tất cả" : tab}
                </button>
              ))}
            </div>
          </div>
          <div className="right-controls">
            <select
              className="filter-select"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              {departmentOptions.map((dep) => (
                <option key={dep} value={dep}>
                  {dep === "all" ? "🏢 Tất cả phòng ban" : dep}
                </option>
              ))}
            </select>
            <select
              className="filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="net_desc">💰 Thực lĩnh giảm dần</option>
              <option value="net_asc">💰 Thực lĩnh tăng dần</option>
              <option value="name_asc">🔤 Tên A→Z</option>
              <option value="name_desc">🔤 Tên Z→A</option>
            </select>
            <div className="search-box">
              <span className="icon">🔍</span>
              <input
                type="text"
                placeholder="Tìm tên, mã NV..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {employeeFilterId && (
              <button
                className="btn btn-white"
                onClick={() => setEmployeeFilterId("")}
              >
                Bỏ lọc nhân viên
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="table-empty">Không tải được dữ liệu bảng lương.</div>
        )}

        <div className="table-responsive">
          <table className="payroll-table">
            <thead>
              <tr>
                <th className="center">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    disabled={!canPayInPeriod || isPeriodLocked}
                    checked={
                      selectedIds.length ===
                        filteredData.filter((item) => item.status !== "paid")
                          .length &&
                      filteredData.some((item) => item.status !== "paid")
                    }
                  />
                </th>
                <th className="sticky-left">Nhân viên</th>
                <th>Lương CB</th>
                <th className="center">Công</th>
                <th className="text-right">OT</th>
                <th className="text-right">Đi muộn/về sớm</th>
                <th className="text-right">Nghỉ không lương</th>
                <th className="text-right">Thu Nhập (+)</th>
                <th className="text-right">Khấu Trừ (-)</th>
                <th className="text-right">Thực Lĩnh</th>
                <th className="text-right">Đã trả</th>
                <th className="text-right">Còn lại</th>
                <th className="center">Trạng thái</th>
                <th className="center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={14} className="table-empty">
                    Đang tải dữ liệu bảng lương...
                  </td>
                </tr>
              )}
              {!loading && filteredData.length === 0 && (
                <tr>
                  <td colSpan={14} className="table-empty">
                    {!currentPeriodId && !hasRealItems
                      ? "Chưa có kỳ lương đang áp dụng. Hãy thiết lập kỳ lương để bắt đầu."
                      : "Không có dữ liệu phù hợp."}
                  </td>
                </tr>
              )}
              {!loading &&
                filteredData.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  const isRowPayable = item.status !== "paid";
                  return (
                    <tr key={item.id} className={isSelected ? "selected" : ""}>
                      <td
                        className="center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={
                            !isRowPayable || isPeriodLocked || !canPayInPeriod
                          }
                          onChange={() => handleSelectRow(item.id)}
                        />
                      </td>
                      <td className="sticky-left">
                        <div className="emp-cell">
                          <div className="avatar">
                            {item.name?.charAt(0) || "N"}
                          </div>
                          <div>
                            <div className="name">{item.name}</div>
                            <div className="sub">
                              {item.code || "—"} • {item.department}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{formatCurrency(item.baseSalary)}</td>
                      <td className="center">
                        <span className="work-tag">
                          {item.actualWorkDays}/{item.workDays}
                        </span>
                      </td>
                      <td className="text-right">
                        {formatCurrency(item.overtime)}
                      </td>
                      <td className="text-right">
                        {item.lateMinutes || 0} / {item.earlyLeaveMinutes || 0}{" "}
                        phút
                      </td>
                      <td className="text-right">
                        {item.unpaidLeaveDays || 0} ngày
                      </td>
                      <td className="text-right text-success">
                        +{formatCurrency(item.totalIncome)}
                      </td>
                      <td className="text-right text-danger">
                        -{formatCurrency(item.totalDeduction)}
                      </td>
                      <td className="text-right net-cell">
                        <strong>{formatCurrency(item.netSalary)}</strong>
                      </td>
                      <td className="text-right">{formatCurrency(item.paidAmount || 0)}</td>
                      <td className="text-right">{formatCurrency(item.remainingAmount ?? Math.max(Number(item.netSalary || 0) - Number(item.paidAmount || 0), 0))}</td>
                      <td className="center">
                        <div className="status-badge-wrapper">
                          {getStatusBadge(item.status)}
                        </div>
                      </td>
                      <td className="center">
                        <button
                          className="btn btn-white"
                          type="button"
                          onClick={() => handleOpenPayslip(item.id)}
                        >
                          Xem phiếu lương
                        </button>
                        {payrollUiPermissions.canPayout && (
                          <button
                            className="btn btn-white"
                            type="button"
                            onClick={() => openEmployeeBankAccountModal(item)}
                          >
                            Tài khoản NH
                          </button>
                        )}
                        {payrollUiPermissions.canPayout && canPayInPeriod && Number(item.remainingAmount ?? item.netSalary ?? 0) > 0 && (
                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={() => openPayoutModal(item)}
                          >
                            Tạo payout
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPayslipEmployeeId && (
        <PayrollPayslipModal
          open={Boolean(selectedPayslipEmployeeId)}
          onClose={() => setSelectedPayslipEmployeeId("")}
          periodId={selectedPeriodId}
          employeeId={selectedPayslipEmployeeId}
          payrollPayslip={modalPayslip}
          payrollPayments={modalPayments}
          markPayrollItemPaid={handleSingleMarkPaid}
          loading={payslipLoading || paymentMutationLoading}
          onPaidSuccess={handlePaidSuccess}
        />
      )}

      {showBatchPayment && (
        <div
          className="modal-overlay"
          data-testid="batch-payroll-paid-modal"
          onClick={() => !batchPaymentLoading && setShowBatchPayment(false)}
        >
          <div className="payslip-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{paymentMode === "full" ? "Thanh toán toàn bộ kỳ lương" : "Thanh toán đã chọn"}</h3>
              <button
                className="close-btn"
                type="button"
                onClick={() => setShowBatchPayment(false)}
              >
                x
              </button>
            </div>
            <div className="modal-body">
              <p>
                Bạn đang thanh toán{" "}
                <strong>{paymentMode === "full" ? unpaidItems.length : selectedPayableItems.length}</strong> nhân viên. Tổng còn lại: <strong>{formatCurrency(paymentMode === "full" ? stats.remaining : selectedPayableItems.reduce((sum, item) => sum + Number(item.remainingAmount ?? item.netSalary ?? 0), 0))}</strong>.
              </p>
              {batchPaymentError && (
                <div className="settings-modal-state settings-modal-state--error">
                  {batchPaymentError}
                </div>
              )}
              {batchPaymentResult && (
                <div
                  className="settings-modal-state"
                  data-testid="batch-payroll-paid-result"
                >
                  Thành công:{" "}
                  <strong>{batchPaymentResult.successCount || 0}</strong> | Lỗi:{" "}
                  <strong>{batchPaymentResult.failedCount || 0}</strong>
                  {!!batchPaymentResult.errors?.length && (
                    <ul>
                      {batchPaymentResult.errors.map((err) => (
                        <li key={`${err.employeeId}-${err.code}`}>
                          {err.employeeId}: {err.code} - {err.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="settings-form-grid">
                <label className="settings-field">
                  <span>Phương thức</span>
                  <select
                    value={batchPaymentForm.method}
                    onChange={(e) =>
                      setBatchPaymentForm((prev) => ({
                        ...prev,
                        method: e.target.value,
                      }))
                    }
                  >
                    <option value="cash">cash</option>
                    <option value="bank_transfer">bank_transfer</option>
                    <option value="card">card</option>
                    <option value="e_wallet">e_wallet</option>
                    <option value="other">other</option>
                  </select>
                </label>
                <label className="settings-field">
                  <span>Ngày thanh toán</span>
                  <input
                    type="datetime-local"
                    value={batchPaymentForm.paidAt}
                    onChange={(e) =>
                      setBatchPaymentForm((prev) => ({
                        ...prev,
                        paidAt: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="settings-field">
                  <span>Ghi chú</span>
                  <textarea
                    rows={3}
                    value={batchPaymentForm.note}
                    onChange={(e) =>
                      setBatchPaymentForm((prev) => ({
                        ...prev,
                        note: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setShowBatchPayment(false)}
              >
                Đóng
              </button>
              <button
                className="btn btn-primary"
                data-testid="batch-payroll-paid-submit"
                type="button"
                disabled={
                  batchPaymentLoading || (paymentMode === "full" ? unpaidItems.length === 0 : selectedPayableItems.length === 0)
                }
                onClick={handleBatchPaymentSubmit}
              >
                {batchPaymentLoading
                  ? "Đang thanh toán..."
                  : "Xác nhận thanh toán"}
              </button>
            </div>
          </div>
        </div>
      )}


      {bankAccountModal && (
        <div className="modal-overlay" data-testid="employee-bank-account-modal" onClick={() => !financialSetupLoading && setBankAccountModal(null)}>
          <div className="payslip-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Tài khoản nhận lương - {bankAccountModal.name}</h3><button className="close-btn" type="button" onClick={() => setBankAccountModal(null)}>x</button></div>
            <div className="modal-body">
              {financialSetupError && <div className="settings-modal-state settings-modal-state--error">{financialSetupError}</div>}
              <div className="settings-form-grid">
                {[
                  ["accountHolderName", "Chủ tài khoản"],
                  ["bankName", "Ngân hàng"],
                  ["bankCode", "Mã ngân hàng"],
                  ["accountNumber", "Số tài khoản"],
                  ["branchName", "Chi nhánh"],
                ].map(([key, label]) => (
                  <label className="settings-field" key={key}><span>{label}</span><input value={bankAccountForm[key]} onChange={(e) => setBankAccountForm((prev) => ({ ...prev, [key]: e.target.value }))} /></label>
                ))}
                <label className="settings-field"><span>Trạng thái xác minh</span><select value={bankAccountForm.verificationStatus} onChange={(e) => setBankAccountForm((prev) => ({ ...prev, verificationStatus: e.target.value }))}><option value="verified">Đã xác minh</option><option value="pending">Chờ xác minh</option><option value="rejected">Bị từ chối</option></select></label>
              </div>
              <p className="payroll-action-hint">Số tài khoản sẽ được mã hóa AES-GCM ở backend và UI chỉ hiển thị dạng mask.</p>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" type="button" onClick={() => setBankAccountModal(null)}>Đóng</button><button className="btn btn-primary" type="button" disabled={financialSetupLoading} onClick={submitEmployeeBankAccount}>{financialSetupLoading ? "Đang lưu..." : "Lưu & xác minh"}</button></div>
          </div>
        </div>
      )}

      {sourceAccountModal && (
        <div className="modal-overlay" data-testid="restaurant-payout-account-modal" onClick={() => !financialSetupLoading && setSourceAccountModal(false)}>
          <div className="payslip-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Tài khoản nguồn chi lương</h3><button className="close-btn" type="button" onClick={() => setSourceAccountModal(false)}>x</button></div>
            <div className="modal-body">
              {financialSetupError && <div className="settings-modal-state settings-modal-state--error">{financialSetupError}</div>}
              <div className="settings-form-grid">
                {[
                  ["accountName", "Tên tài khoản"],
                  ["bankName", "Ngân hàng"],
                  ["bankCode", "Mã ngân hàng"],
                  ["accountNumber", "Số tài khoản"],
                  ["provider", "Provider"],
                  ["dailyLimit", "Hạn mức/ngày"],
                  ["perTransactionLimit", "Hạn mức/giao dịch"],
                ].map(([key, label]) => (
                  <label className="settings-field" key={key}><span>{label}</span><input value={sourceAccountForm[key]} onChange={(e) => setSourceAccountForm((prev) => ({ ...prev, [key]: e.target.value }))} /></label>
                ))}
                <label className="settings-field"><span>Trạng thái</span><select value={sourceAccountForm.status} onChange={(e) => setSourceAccountForm((prev) => ({ ...prev, status: e.target.value }))}><option value="active">active</option><option value="inactive">inactive</option><option value="pending_verification">pending_verification</option></select></label>
              </div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" type="button" onClick={() => setSourceAccountModal(false)}>Đóng</button><button className="btn btn-primary" type="button" disabled={financialSetupLoading} onClick={submitRestaurantPayoutAccount}>{financialSetupLoading ? "Đang lưu..." : "Lưu tài khoản nguồn"}</button></div>
          </div>
        </div>
      )}

      {payoutModal && (
        <div className="modal-overlay" data-testid="payroll-payout-modal" onClick={() => !financialSetupLoading && setPayoutModal(null)}>
          <div className="payslip-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>{payoutForm.method === "bank_transfer" ? "Chuyển khoản qua provider" : "Ghi nhận payout"}</h3><button className="close-btn" type="button" onClick={() => setPayoutModal(null)}>x</button></div>
            <div className="modal-body">
              <p>Nhân viên: <strong>{payoutModal.name}</strong>. Số tiền còn lại: <strong>{formatCurrency(payoutModal.remainingAmount ?? payoutModal.netSalary)}</strong>.</p>
              {financialSetupError && <div className="settings-modal-state settings-modal-state--error">{financialSetupError}</div>}
              {payoutResult && <div className="settings-modal-state">Trạng thái payout: <strong>{payoutResult.status}</strong>{payoutResult.failureReason ? ` - ${payoutResult.failureReason}` : ""}</div>}
              <div className="settings-form-grid">
                <label className="settings-field"><span>Phương thức</span><select value={payoutForm.method} onChange={(e) => setPayoutForm((prev) => ({ ...prev, method: e.target.value }))}><option value="bank_transfer">Chuyển khoản qua provider</option><option value="other">Ghi nhận thanh toán thủ công</option></select></label>
                <label className="settings-field"><span>Mã tham chiếu</span><input value={payoutForm.referenceCode} onChange={(e) => setPayoutForm((prev) => ({ ...prev, referenceCode: e.target.value }))} /></label>
                <label className="settings-field"><span>Ghi chú</span><textarea rows={2} value={payoutForm.note} onChange={(e) => setPayoutForm((prev) => ({ ...prev, note: e.target.value }))} /></label>
              </div>
              <p className="payroll-action-hint">Manual mode ghi nhận thanh toán thủ công; mock/provider mode theo dõi success/processing/failed và không báo thành công trước khi có kết quả.</p>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" type="button" onClick={() => setPayoutModal(null)}>Đóng</button><button className="btn btn-primary" type="button" disabled={financialSetupLoading} onClick={submitPayrollPayout}>{financialSetupLoading ? "Đang xử lý..." : "Xác nhận payout"}</button></div>
          </div>
        </div>
      )}

      {showSettings && (
        <PayrollSettingsModal
          settings={payrollSettings}
          loading={settingsLoading}
          loadError={settingsError}
          saveError={settingsSaveError}
          isSaving={settingsSaving}
          onClose={handleCloseSettings}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );
};

const PayslipModal = ({
  data,
  period,
  onClose,
  formatCurrency,
  adjustmentType,
  setAdjustmentType,
  adjustmentAmount,
  setAdjustmentAmount,
  adjustmentNote,
  setAdjustmentNote,
  onApplyAdjustment,
}) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="payslip-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <div className="brand">
          <h3>PHIẾU LƯƠNG</h3>
          <span>
            Kỳ:{" "}
            {period
              ? `${new Date(period.startDate).toLocaleDateString("vi-VN")} - ${new Date(period.endDate).toLocaleDateString("vi-VN")}`
              : "--"}
          </span>
        </div>
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="modal-body">
        <div className="emp-summary">
          <div className="left">
            <h4>{data.name}</h4>
            <p>
              {data.code} - {data.role}
            </p>
            <p>{data.department}</p>
            <p>Ca kế hoạch: {data.scheduleShiftCount || 0}</p>
            <p>
              Đi muộn: {data.lateMinutes || 0} phút | Về sớm:{" "}
              {data.earlyLeaveMinutes || 0} phút
            </p>
            <p>
              Nghỉ có lương: {data.paidLeaveDays || 0} ngày | Nghỉ không lương:{" "}
              {data.unpaidLeaveDays || 0} ngày
            </p>
          </div>
          <div className="right">
            <div className="net-total-box">
              <span>Thực Lĩnh:</span>
              <h2>{formatCurrency(data.netSalary)}</h2>
            </div>
          </div>
        </div>

        <div className="details-grid">
          <div className="section">
            <h5 className="section-title income">Thu nhập</h5>
            <div className="row">
              <span>Lương cơ bản</span>
              <span>{formatCurrency(data.baseSalary)}</span>
            </div>
            <div className="row">
              <span>Phụ cấp</span>
              <span>{formatCurrency(data.allowance)}</span>
            </div>
            <div className="row">
              <span>Thưởng</span>
              <span>{formatCurrency(data.bonus)}</span>
            </div>
            <div className="row">
              <span>OT</span>
              <span>{formatCurrency(data.overtime)}</span>
            </div>
            <div className="row total text-success">
              <strong>Tổng thu nhập</strong>
              <strong>{formatCurrency(data.totalIncome)}</strong>
            </div>
          </div>
          <div className="section">
            <h5 className="section-title deduction">Khấu trừ</h5>
            <div className="row">
              <span>BH bắt buộc</span>
              <span>{formatCurrency(data.insuranceTotal)}</span>
            </div>
            <div className="row">
              <span>Khấu trừ khác</span>
              <span>{formatCurrency(data.otherDeduction)}</span>
            </div>
            <div className="row">
              <span>Tổng khấu trừ</span>
              <span>{formatCurrency(data.totalDeduction)}</span>
            </div>
            <div className="row total text-danger">
              <strong>Thực lĩnh</strong>
              <strong>{formatCurrency(data.netSalary)}</strong>
            </div>
          </div>
        </div>

        <div className="formula-note">
          Điều chỉnh thủ công: {formatCurrency(data.manualAdjustmentTotal || 0)}
        </div>

        <div
          className="formula-note"
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <select
            value={adjustmentType}
            onChange={(e) => setAdjustmentType(e.target.value)}
          >
            <option value="bonus">Thưởng</option>
            <option value="allowance">Phụ cấp</option>
            <option value="deduction">Khấu trừ</option>
            <option value="advance">Tạm ứng</option>
            <option value="other_addition">Cộng khác</option>
            <option value="other_deduction">Trừ khác</option>
          </select>
          <input
            type="number"
            placeholder="Số tiền"
            value={adjustmentAmount}
            onChange={(e) => setAdjustmentAmount(e.target.value)}
          />
          <input
            type="text"
            placeholder="Ghi chú"
            value={adjustmentNote}
            onChange={(e) => setAdjustmentNote(e.target.value)}
          />
          <button className="btn btn-primary" onClick={onApplyAdjustment}>
            Áp dụng điều chỉnh
          </button>
        </div>

        {!!data.warningMessages?.length && (
          <div className="formula-note">
            ⚠️ {data.warningMessages.join(" | ")}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>
          Đóng
        </button>
      </div>
    </div>
  </div>
);

export default PayrollManagement;
