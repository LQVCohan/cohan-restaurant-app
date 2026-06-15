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
                  setField(
                    "holidayDates",
                    e.target.value
                      .split("\n")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  )
                }
              />
            </label>
            <label className="settings-field">
              <span>Ghi chú</span>
              <textarea
                rows={3}
                value={form.notes || ""}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </label>
            <label className="settings-inline-checkbox settings-field settings-field--wide">
              <input
                type="checkbox"
                checked={Boolean(form.allowPaidLeaveInWorkDays)}
                onChange={(e) =>
                  setField("allowPaidLeaveInWorkDays", e.target.checked)
                }
              />
              <span>Tính phép có lương vào ngày công</span>
            </label>
            <label className="settings-inline-checkbox settings-field settings-field--wide">
              <input
                type="checkbox"
                checked={Boolean(form.enablePersonalIncomeTax)}
                onChange={(e) =>
                  setField("enablePersonalIncomeTax", e.target.checked)
                }
              />
              <span>Bật tính thuế thu nhập cá nhân</span>
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
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className="btn-primary"
            data-testid="payroll-settings-save"
            disabled={isSaving}
            onClick={() => onSave(form)}
          >
            {isSaving ? "Đang lưu..." : "Lưu cấu hình"}
          </button>
        </div>
      </div>
    </div>
  );
};

const isPeriodFullyPaid = (period) =>
  ["paid", "locked", "completed"].includes(String(period?.status || "").toLowerCase());

const flattenReadinessIssues = (readiness) => {
  const direct = Array.isArray(readiness?.issues) ? readiness.issues : [];
  const sectionIssues = Object.values(readiness?.sections || {}).flatMap((section) =>
    Array.isArray(section?.issues) ? section.issues : [],
  );
  return [...direct, ...sectionIssues];
};

const formatPeriodLabel = (period) => {
  if (!period) return "Chưa có kỳ";
  const start = toInputDate(period.startDate);
  const end = toInputDate(period.endDate);
  return period.name || [start, end].filter(Boolean).join(" - ") || period.id;
};

const PayrollManagement = () => {
  const location = useLocation();
  const { user } = useContext(AuthContext) || {};
  const roleName = resolveUserRoleName(user);
  const canManagePayroll = !user || hasAnyPermission(user, ["PAYROLL_MANAGE", "MANAGE_PAYROLL"]);
  const restaurantSelection = useManagerRestaurantSelection();
  const { selectedRestaurantId, setSelectedRestaurantId, restaurantOptions = [] } =
    restaurantSelection;

  const payroll = usePayroll(selectedRestaurantId);
  const {
    periods = [],
    currentPeriodId,
    periodDetail,
    payrollSettings,
    settingsLoading,
    settingsError,
    updateSettings,
    createPeriod,
    finalizePeriod,
    refetchDetail,
    refetchSettings,
    refetchValidation,
    refetchPayrollReadiness,
    payrollReadiness,
    readinessLoading,
    readinessError,
  } = payroll || {};

  const defaultRange = useMemo(() => getDefaultRange(), []);
  const currentPeriod = periodDetail?.period || periods.find((period) => period.id === currentPeriodId) || periods[0] || null;
  const [periodForm, setPeriodForm] = useState({
    start: toInputDate(currentPeriod?.startDate) || defaultRange.start,
    end: toInputDate(currentPeriod?.endDate) || defaultRange.end,
  });
  const [selectedPeriodId, setSelectedPeriodId] = useState(currentPeriod?.id || currentPeriodId || "");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [payslipEmployeeId, setPayslipEmployeeId] = useState(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [employeeBankModalOpen, setEmployeeBankModalOpen] = useState(false);
  const [restaurantPayoutModalOpen, setRestaurantPayoutModalOpen] = useState(false);
  const [employeeAccountNumber, setEmployeeAccountNumber] = useState("");
  const [restaurantAccountNumber, setRestaurantAccountNumber] = useState("");
  const [payoutConfirmOpen, setPayoutConfirmOpen] = useState(false);
  const [latestPayout, setLatestPayout] = useState(null);
  const [payoutError, setPayoutError] = useState("");

  useEffect(() => {
    if (!selectedPeriodId && (currentPeriod?.id || currentPeriodId)) {
      setSelectedPeriodId(currentPeriod?.id || currentPeriodId);
    }
  }, [currentPeriod?.id, currentPeriodId, selectedPeriodId]);

  const selectedPeriod = periods.find((period) => period.id === selectedPeriodId) || currentPeriod;
  const readiness = payrollReadiness;
  const readinessIssues = flattenReadinessIssues(readiness);
  const readinessBlocked = readiness?.readyToFinalize === false || Number(readiness?.blockingCount || 0) > 0;

  const handleSaveSettings = async (form) => {
    setSettingsSaveError("");
    setSettingsSaving(true);
    try {
      const restaurantId = getSettingsRestaurantId({
        settings: payrollSettings,
        periodDetail,
        periods,
      }) || selectedRestaurantId;
      await updateSettings({
        variables: {
          input: {
            ...form,
            restaurantId,
          },
        },
      });
      await Promise.all([refetchDetail?.(), refetchSettings?.()]);
      setSettingsOpen(false);
    } catch (error) {
      setSettingsSaveError(
        getPayrollActionErrorMessage(error) ||
          error?.message ||
          "Không thể lưu cấu hình lương.",
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleSetupPeriod = async () => {
    if (currentPeriod && !isPeriodFullyPaid(currentPeriod)) {
      window.alert(
        "Chi duoc doi ky luong sau khi ky dang ap dung da tinh xong va da xac nhan tra du.",
      );
      return;
    }
    await createPeriod?.({
      variables: {
        input: {
          restaurantId: selectedRestaurantId,
          startDate: periodForm.start,
          endDate: periodForm.end,
        },
      },
    });
    await refetchSettings?.();
  };

  const handleOpenReadiness = async () => {
    setReadinessOpen(true);
    await Promise.all([refetchPayrollReadiness?.(), refetchValidation?.()]);
  };

  const handleFinalize = async () => {
    if (readinessBlocked) return;
    await finalizePeriod?.({ variables: { periodId: selectedPeriodId } });
  };

  const payrollItems = payroll?.payrollItems || [];
  const periodStatus = String(selectedPeriod?.status || currentPeriod?.status || "").toLowerCase();
  const payDisabled = ["draft", "paid", "locked"].includes(periodStatus);
  const lockDisabled = periodStatus !== "paid";
  const payoutVisible = ["finalized", "paying"].includes(periodStatus);
  const payoutDisabled = !payoutVisible || payrollItems.some((item) =>
    item.bankAccountVerificationStatus && item.bankAccountVerificationStatus !== "verified",
  );
  const statusLabel = (status) => PAYROLL_STATUS_TAB_LABELS[status] || status || "--";
  const currency = (value) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0));

  const toggleEmployee = (employeeId) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId],
    );
  };

  const submitBatchPaid = async (employeeIds = selectedEmployeeIds) => {
    const result = await payroll?.batchMarkPayrollPaid?.({
      periodId: selectedPeriodId,
      employeeIds,
      method: "cash",
    });
    setBatchResult(result?.data?.batchMarkPayrollPaid || null);
  };

  const handleExportCsv = async () => {
    const result = await payroll?.refetchPayrollExportRows?.({ periodId: selectedPeriodId });
    downloadCsv(
      `payroll-${sanitizeFilenamePart(selectedPeriodId)}.csv`,
      result?.data?.payrollExportRows || [],
      PAYROLL_EXPORT_COLUMNS,
    );
  };

  const openPayslip = async (employeeId) => {
    setPayslipEmployeeId(employeeId);
    await payroll?.refetchPayrollPayslip?.({ periodId: selectedPeriodId, employeeId });
    await payroll?.refetchPayrollPayments?.({ periodId: selectedPeriodId, employeeId });
  };

  const handleEmployeeBankSave = async () => {
    await payroll?.upsertEmployeeBankAccount?.({
      employeeId: payrollItems[0]?.id,
      accountNumber: employeeAccountNumber,
    });
    await payroll?.verifyEmployeeBankAccount?.({
      employeeId: payrollItems[0]?.id,
      verificationStatus: "verified",
    });
    setEmployeeBankModalOpen(false);
    setEmployeeAccountNumber("");
  };

  const handleRestaurantPayoutSave = async () => {
    await payroll?.upsertRestaurantPayoutAccount?.({
      restaurantId: selectedRestaurantId,
      accountNumber: restaurantAccountNumber,
      payoutEnabled: true,
    });
    setRestaurantPayoutModalOpen(false);
    setRestaurantAccountNumber("");
  };

  const confirmPayout = async () => {
    setPayoutError("");
    try {
      const result = await payroll?.createPayrollPayout?.({ periodId: selectedPeriodId });
      setLatestPayout(result?.data?.createPayrollPayout || null);
    } catch (error) {
      setPayoutError(
        String(error?.message || "").includes("PAYROLL_PAYOUT_PROVIDER_NOT_CONFIGURED")
          ? "Nhà cung cấp payout/chuyển khoản chưa được cấu hình."
          : getPayrollPaymentErrorMessage(error),
      );
    }
  };

  const retryPayout = async (payoutId) => {
    await payroll?.retryPayrollPayout?.({ payoutId });
  };

  const cancelPayout = async (payoutId) => {
    await payroll?.cancelPayrollPayout?.({ payoutId, reason: "Hủy theo yêu cầu" });
  };

  const handleReadinessIssueAction = (issue) => {
    dispatchPayrollReadinessNavigation(issue);
  };

  return (
    <div className="payroll-management" data-payroll-role={roleName || "unknown"} data-location-query={location.search}>
      <header className="payroll-management__header">
        <div>
          <p className="eyebrow">Quản lý lương</p>
          <h2>Bảng lương nhân sự</h2>
        </div>
        <button
          type="button"
          className="btn-secondary"
          data-testid="payroll-settings-open"
          onClick={() => setSettingsOpen(true)}
        >
          Cấu hình lương
        </button>
      </header>

      <section className="payroll-toolbar" aria-label="Bộ lọc bảng lương">
        <label>
          <span>Nhà hàng</span>
          <select
            value={selectedRestaurantId || ""}
            onChange={(event) => setSelectedRestaurantId?.(event.target.value)}
          >
            {restaurantOptions.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Kỳ lương</span>
          <select
            value={selectedPeriodId}
            onChange={(event) => setSelectedPeriodId(event.target.value)}
          >
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {formatPeriodLabel(period)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="payroll-period-card">
        <h3>Thiết lập kỳ lương</h3>
        <div className="settings-form-grid">
          <label className="settings-field">
            <span>Ngày bắt đầu</span>
            <input
              name="start"
              type="date"
              value={periodForm.start}
              onChange={(event) =>
                setPeriodForm((prev) => ({ ...prev, start: event.target.value }))
              }
            />
          </label>
          <label className="settings-field">
            <span>Ngày kết thúc</span>
            <input
              name="end"
              type="date"
              value={periodForm.end}
              onChange={(event) =>
                setPeriodForm((prev) => ({ ...prev, end: event.target.value }))
              }
            />
          </label>
        </div>
        <button
          type="button"
          className="btn-primary"
          data-testid="payroll-period-setup"
          onClick={handleSetupPeriod}
        >
          Áp dụng kỳ lương
        </button>
      </section>



      <section className="payroll-actions-card">
        <div className="payroll-actions-card__actions">
          <button type="button" onClick={handleExportCsv}>Xuất CSV</button>
          <button
            type="button"
            data-testid="batch-payroll-paid-open"
            disabled={payDisabled}
            onClick={() => setBatchModalOpen(true)}
          >
            Thanh toán đã chọn
          </button>
          <button
            type="button"
            data-testid="full-period-payroll-paid-open"
            disabled={payDisabled}
            onClick={() => {
              setSelectedEmployeeIds([]);
              setBatchModalOpen(true);
            }}
          >
            Thanh toán toàn bộ kỳ
          </button>
          <button type="button" disabled={lockDisabled} onClick={() => payroll?.lockPeriod?.({ variables: { periodId: selectedPeriodId } })}>Khóa kỳ</button>
          {payoutVisible && (
            <button type="button" disabled={payoutDisabled} onClick={() => setPayoutConfirmOpen(true)}>
              Tạo payout
            </button>
          )}
          <button type="button" onClick={() => setEmployeeBankModalOpen(true)}>Tài khoản NH</button>
          <button type="button" onClick={() => setRestaurantPayoutModalOpen(true)}>Tài khoản nguồn</button>
        </div>
        <div>{statusLabel(periodStatus)}</div>
        {payoutError && <div role="alert">{payoutError}</div>}
        {latestPayout && <div>Trạng thái payout: {latestPayout.status}</div>}
        {latestPayout?.status === "processing" && (
          <button type="button" onClick={() => cancelPayout(latestPayout.id)}>Hủy payout</button>
        )}
        {latestPayout?.status === "failed" && (
          <button type="button" onClick={() => retryPayout(latestPayout.id)}>Retry payout</button>
        )}
        <table>
          <thead>
            <tr><th><input type="checkbox" aria-label="Chọn tất cả" disabled={payDisabled} readOnly /></th><th>Nhân viên</th><th>Trạng thái</th><th>Đã trả</th><th>Còn lại</th><th>Hành động</th></tr>
          </thead>
          <tbody>
            {payrollItems.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    type="checkbox"
                    disabled={payDisabled}
                    checked={selectedEmployeeIds.includes(item.id)}
                    onChange={() => toggleEmployee(item.id)}
                  />
                </td>
                <td>{item.name}</td>
                <td>{statusLabel(item.status)}</td>
                <td>{currency(item.paidAmount)}</td>
                <td>{currency(item.remainingAmount)}</td>
                <td>
                  <button type="button" onClick={() => openPayslip(item.id)}>Xem phiếu lương</button>
                  {item.latestPayout?.status === "failed" && (
                    <button type="button" onClick={() => retryPayout(item.latestPayout.id)}>Retry payout</button>
                  )}
                  {item.latestPayout?.status === "processing" && (
                    <button type="button" onClick={() => cancelPayout(item.latestPayout.id)}>Hủy payout</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="payroll-readiness-card">
        <div className="payroll-readiness-card__header">
          <div>
            <h3>Bảng kiểm tra sẵn sàng</h3>
            {readinessBlocked && (
              <p>
                Kỳ lương chưa sẵn sàng chốt. Vui lòng xử lý các lỗi trong bảng kiểm tra.
              </p>
            )}
          </div>
          <button type="button" className="btn-secondary" onClick={handleOpenReadiness}>
            Kiểm tra trước khi chốt
          </button>
        </div>

        {readinessOpen && (
          <div className="payroll-readiness-panel-shell">
            <PayrollReadinessPanel
              readiness={readiness}
              loading={readinessLoading}
              error={readinessError}
              onIssueAction={handleReadinessIssueAction}
            />
            {readinessIssues.map((issue) => (
              <button
                key={`${issue.code || "issue"}-${issue.targetRoute || issue.message}`}
                type="button"
                className="btn-secondary"
                onClick={() => handleReadinessIssueAction(issue)}
              >
                {issue.targetRoute === "off_schedule"
                  ? "Duyệt công ngoài lịch"
                  : issue.message || "Xử lý lỗi"}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className="btn-primary"
          disabled={!canManagePayroll || readinessBlocked}
          onClick={handleFinalize}
        >
          Chốt kỳ
        </button>
      </section>



      <PayrollPayslipModal
        open={Boolean(payslipEmployeeId)}
        onClose={() => setPayslipEmployeeId(null)}
        periodId={selectedPeriodId}
        employeeId={payslipEmployeeId}
        payrollPayslip={payroll?.payrollPayslip}
        payrollPayments={payroll?.payrollPayments || []}
        markPayrollItemPaid={payroll?.markPayrollItemPaid}
        onPaidSuccess={async () => {
          await payroll?.refetchPayrollPeriodDetail?.();
          setPayslipEmployeeId(null);
        }}
      />

      {batchModalOpen && (
        <div className="modal-overlay">
          <div className="payslip-modal">
            <button type="button" data-testid="batch-payroll-paid-submit" onClick={() => submitBatchPaid()}>Xác nhận thanh toán</button>
            {batchResult && (
              <div data-testid="batch-payroll-paid-result">
                Thành công: {batchResult.successCount || 0} Đang xử lý: {batchResult.processingCount || 0} Lỗi: {batchResult.failedCount || 0}
                {(batchResult.errors || []).map((error) => <div key={`${error.employeeId}-${error.code}`}>{error.code}: {error.message}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {employeeBankModalOpen && (
        <div className="modal-overlay" data-testid="employee-bank-account-modal">
          <div className="payslip-modal">
            <label><span>Số tài khoản</span><input value={employeeAccountNumber} onChange={(event) => setEmployeeAccountNumber(event.target.value)} /></label>
            <button type="button" onClick={handleEmployeeBankSave}>Lưu & xác minh</button>
          </div>
        </div>
      )}

      {restaurantPayoutModalOpen && (
        <div className="modal-overlay" data-testid="restaurant-payout-account-modal">
          <div className="payslip-modal">
            <input aria-label="Tên ngân hàng" />
            <input aria-label="Chi nhánh" />
            <input aria-label="Chủ tài khoản" />
            <input aria-label="Số tài khoản nguồn" value={restaurantAccountNumber} onChange={(event) => setRestaurantAccountNumber(event.target.value)} />
            <button type="button" onClick={handleRestaurantPayoutSave}>Lưu tài khoản nguồn</button>
          </div>
        </div>
      )}

      {payoutConfirmOpen && (
        <div className="modal-overlay">
          <div className="payslip-modal">
            <button type="button" onClick={confirmPayout}>Xác nhận payout</button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <PayrollSettingsModal
          settings={payrollSettings}
          loading={settingsLoading}
          loadError={settingsError}
          saveError={settingsSaveError}
          isSaving={settingsSaving}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );
};

export default PayrollManagement;
