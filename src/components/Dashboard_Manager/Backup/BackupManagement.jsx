import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import {
  AlertTriangle,
  Archive,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  History,
  LockKeyhole,
  RefreshCw,
  Save,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { AuthContext } from "../../../context/AuthContext";
import useManagerRestaurantSelection from "../../../hooks/useManagerRestaurantSelection";
import { hasPermission } from "../../../utils/frontendPermissionAccess";
import "./BackupManagement.scss";
import "./BackupManagementFeedback.scss";
import ManagementPageHeader from "../shared/ManagementPageHeader";
import {
  getExportReadinessState,
  REQUIRED_EXPORT_CHECKLIST_KEYS,
  selectBackupRuns,
} from "./backupChecklistState";

const Q_BACKUP_READINESS = gql`
  query BackupReadiness($restaurantId: ID!) {
    backupReadiness(restaurantId: $restaurantId) {
      restaurantId
      ready
      risks { key label severity resolved description }
      checklist { reportsChecked transactionsReconciled settingsReviewed exportPrepared safeCopyStored operatorRecorded }
      scope { ordersAndPayments tablesAndFloorPlan menuAndPricing inventory staffAndPermissions schedules customersAndPromotions reportsAndReconciliation }
      lastRun {
        id restaurantId status note completedAt createdAt updatedAt
        checklist { reportsChecked transactionsReconciled settingsReviewed exportPrepared safeCopyStored operatorRecorded }
        scope { ordersAndPayments tablesAndFloorPlan menuAndPricing inventory staffAndPermissions schedules customersAndPromotions reportsAndReconciliation }
      }
    }
  }
`;

const Q_BACKUP_RUNS = gql`
  query BackupRuns($restaurantId: ID!, $limit: Int!, $offset: Int!) {
    backupRuns(restaurantId: $restaurantId, limit: $limit, offset: $offset) {
      id restaurantId status note createdBy completedBy completedAt createdAt updatedAt
      checklist { reportsChecked transactionsReconciled settingsReviewed exportPrepared safeCopyStored operatorRecorded }
      scope { ordersAndPayments tablesAndFloorPlan menuAndPricing inventory staffAndPermissions schedules customersAndPromotions reportsAndReconciliation }
    }
  }
`;

const Q_CONFIG_BACKUP_PREVIEW = gql`
  query RestaurantConfigBackupPreview($input: ExportRestaurantConfigBackupInput!) {
    restaurantConfigBackupPreview(input: $input) {
      restaurantId fileName schemaVersion createdAt warnings
      counts { key label count enabled }
    }
  }
`;

const M_CREATE_BACKUP_RUN = gql`
  mutation CreateBackupRun($input: CreateBackupRunInput!) {
    createBackupRun(input: $input) {
      id restaurantId status note createdBy completedBy completedAt createdAt updatedAt
      checklist { reportsChecked transactionsReconciled settingsReviewed exportPrepared safeCopyStored operatorRecorded }
      scope { ordersAndPayments tablesAndFloorPlan menuAndPricing inventory staffAndPermissions schedules customersAndPromotions reportsAndReconciliation }
    }
  }
`;

const M_UPDATE_BACKUP_RUN = gql`
  mutation UpdateBackupRun($input: UpdateBackupRunInput!) {
    updateBackupRun(input: $input) {
      id restaurantId status note createdBy completedBy completedAt createdAt updatedAt
      checklist { reportsChecked transactionsReconciled settingsReviewed exportPrepared safeCopyStored operatorRecorded }
      scope { ordersAndPayments tablesAndFloorPlan menuAndPricing inventory staffAndPermissions schedules customersAndPromotions reportsAndReconciliation }
    }
  }
`;

const M_EXPORT_CONFIG_BACKUP = gql`
  mutation ExportRestaurantConfigBackup($input: ExportRestaurantConfigBackupInput!) {
    exportRestaurantConfigBackup(input: $input) {
      fileName mimeType encoding contentBase64 checksum sizeBytes createdAt
    }
  }
`;

const M_PREVIEW_CONFIG_IMPORT = gql`
  mutation PreviewRestaurantConfigImport($input: ImportRestaurantConfigBackupInput!) {
    previewRestaurantConfigImport(input: $input) {
      valid schemaVersion sourceRestaurantName targetRestaurantId mode warnings errors
      changes { section action label count warning }
      conflictSummary { key label count enabled }
      conflicts {
        id section entityType entityKey label severity reason sourceLegacyId targetId defaultResolution allowedResolutions warnings
        fieldDiffs { field sourceValuePreview targetValuePreview severity }
      }
    }
  }
`;

const M_IMPORT_CONFIG_BACKUP = gql`
  mutation ImportRestaurantConfigBackup($input: ImportRestaurantConfigBackupInput!) {
    importRestaurantConfigBackup(input: $input) {
      success dryRun targetRestaurantId mode warnings errors
      changes { section action label count warning }
      conflicts { id section entityType entityKey label severity reason defaultResolution allowedResolutions warnings fieldDiffs { field sourceValuePreview targetValuePreview severity } }
      appliedResolutions { conflictId resolution renameTo fieldOverridesJson }
      backupRun { id status note createdAt completedAt }
    }
  }
`;

const FALLBACK_CHECKLIST = {
  reportsChecked: false,
  transactionsReconciled: false,
  settingsReviewed: false,
  exportPrepared: false,
  safeCopyStored: false,
  operatorRecorded: false,
};

const FALLBACK_SCOPE = {
  ordersAndPayments: false,
  tablesAndFloorPlan: true,
  menuAndPricing: true,
  inventory: true,
  staffAndPermissions: false,
  schedules: true,
  customersAndPromotions: true,
  reportsAndReconciliation: false,
};

const FALLBACK_READINESS = {
  restaurantId: "",
  ready: false,
  risks: [],
  checklist: FALLBACK_CHECKLIST,
  scope: FALLBACK_SCOPE,
  lastRun: null,
};

const CHECKLIST_LABELS = {
  reportsChecked: "Kiểm tra báo cáo cuối ngày",
  transactionsReconciled: "Đối soát giao dịch",
  settingsReviewed: "Rà soát cấu hình quan trọng",
  exportPrepared: "Chuẩn bị file sao lưu",
  safeCopyStored: "Lưu file ở nơi an toàn",
  operatorRecorded: "Ghi nhận người thực hiện",
};

const SCOPE_LABELS = {
  ordersAndPayments: "Đơn hàng & thanh toán",
  tablesAndFloorPlan: "Bàn & sơ đồ tầng",
  menuAndPricing: "Menu & giá bán",
  inventory: "Kho & nguyên liệu",
  staffAndPermissions: "Nhân viên & phân quyền",
  schedules: "Lịch làm việc",
  customersAndPromotions: "Khách hàng & khuyến mãi",
  reportsAndReconciliation: "Báo cáo & đối soát",
};

const CONFIG_SECTIONS = [
  ["restaurantProfile", "Thông tin nhà hàng"],
  ["systemSettings", "Cài đặt vận hành"],
  ["printSettings", "Cài đặt in ấn"],
  ["customerRankSettings", "Hạng khách hàng"],
  ["payrollSettings", "Cài đặt lương"],
  ["schedulingPolicy", "Quy tắc xếp ca"],
  ["floorTableLayout", "Sơ đồ tầng & bàn"],
  ["menuCatalog", "Menu, giá & công thức"],
  ["inventoryMaster", "Danh mục kho"],
  ["promotionConfig", "Khuyến mãi & mã giảm giá"],
  ["aiChatbotConfig", "Cài đặt chatbot"],
];

const IMPORT_MODES = [
  ["clone", "Sao chép sang nhà hàng này"],
  ["same_restaurant_restore", "Khôi phục về nhà hàng gốc"],
  ["merge", "Bổ sung vào cấu hình hiện tại"],
  ["replace", "Thay cấu hình đã chọn"],
];

const RESOLUTION_LABELS = {
  use_source: "Dùng bản trong file",
  keep_target: "Giữ bản hiện tại",
  merge: "Gộp nếu an toàn",
  create_copy: "Tạo thêm bản mới",
  rename_source: "Đổi tên rồi thêm mới",
  skip: "Bỏ qua mục này",
  replace_section: "Thay cả hạng mục",
};

const STATUS_LABELS = {
  planned: "Đang chuẩn bị",
  checklist_completed: "Đã sẵn sàng",
  cancelled: "Đã hủy",
};

const SEVERITY_LABELS = {
  blocking: "Cần chọn cách xử lý",
  warning: "Nên kiểm tra",
  info: "Thông tin",
};

const ACTION_LABELS = {
  create: "Thêm mới",
  update: "Cập nhật",
  upsert: "Cập nhật",
  replace: "Thay thế",
  merge: "Bổ sung",
  skip: "Bỏ qua",
  delete: "Gỡ bỏ",
};

const FIELD_LABELS = {
  name: "Tên",
  code: "Mã",
  status: "Trạng thái",
  basePrice: "Giá bán",
  price: "Giá",
  description: "Mô tả",
  enabled: "Đang bật",
  content: "Nội dung",
  sortOrder: "Thứ tự",
};

const FRIENDLY_WARNING_RULES = [
  [/database backup|Restaurant Configuration Snapshot|snapshot/i, "File này chỉ dùng cho cấu hình nhà hàng, không thay thế bản sao toàn bộ dữ liệu vận hành."],
  [/device id|local IP|printer/i, "Máy in có thể cần kiểm tra lại địa chỉ kết nối sau khi khôi phục."],
  [/recipe ingredient/i, "Một vài dòng công thức có thể bị bỏ qua nếu nguyên liệu liên quan không có trong file."],
  [/restore|import/i, "Hãy xem trước và xác nhận trước khi áp dụng thay đổi."],
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const UNSUPPORTED_SCOPE_KEYS = new Set([
  "ordersAndPayments",
  "staffAndPermissions",
  "reportsAndReconciliation",
]);
const allSections = () => Object.fromEntries(CONFIG_SECTIONS.map(([key]) => [key, true]));
const selectedSectionCount = (state) => CONFIG_SECTIONS.filter(([key]) => Boolean(state[key])).length;
const toChecklistItems = (checklist = FALLBACK_CHECKLIST) => Object.entries(CHECKLIST_LABELS).map(([key, label]) => ({ key, label, done: Boolean(checklist?.[key]) }));
const toScopeItems = (scope = FALLBACK_SCOPE) => Object.entries(SCOPE_LABELS).map(([key, label]) => ({ key, label, enabled: Boolean(scope?.[key]) }));
const restaurantOptionId = (restaurant) => String(restaurant?.id || restaurant?._id || restaurant?.restaurantId || "");
const restaurantOptionName = (restaurant) => restaurant?.name || restaurant?.restaurantName || restaurant?.displayName || restaurantOptionId(restaurant);
const selectedSectionsPayload = (state) => Object.fromEntries(CONFIG_SECTIONS.map(([key]) => [key, Boolean(state[key])]));
const sectionLabel = (key) => CONFIG_SECTIONS.find(([sectionKey]) => sectionKey === key)?.[1] || key;
const modeLabel = (value) => IMPORT_MODES.find(([mode]) => mode === value)?.[1] || value;
const statusLabel = (status) => STATUS_LABELS[status] || status || "Chưa xác định";
const severityLabel = (severity) => SEVERITY_LABELS[severity] || severity || "Thông tin";
const actionLabel = (action) => ACTION_LABELS[action] || action || "Thay đổi";
const fieldLabel = (field) => FIELD_LABELS[field] || field || "Trường dữ liệu";

const normalizeDraftScope = (scope = FALLBACK_SCOPE) => ({
  ...FALLBACK_SCOPE,
  ...scope,
  ordersAndPayments: false,
  staffAndPermissions: false,
  reportsAndReconciliation: false,
});

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("vi-VN");
};

const base64ToBlob = (base64, mimeType) => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType || "application/json" });
};

const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || "").split(",").pop() || "");
  reader.onerror = () => reject(reader.error || new Error("Không đọc được file sao lưu"));
  reader.readAsDataURL(file);
});

const friendlyWarning = (message = "") => {
  const rule = FRIENDLY_WARNING_RULES.find(([pattern]) => pattern.test(message));
  return rule?.[1] || message;
};

const friendlyReason = (reason = "") => {
  if (/same key already exists/i.test(reason)) return "Mục này đã có trong nhà hàng đích.";
  if (/not imported|could not be remapped/i.test(reason)) return "Mục liên quan chưa có trong file nên không thể tự nối dữ liệu.";
  if (/missing/i.test(reason)) return "Thiếu dữ liệu liên quan, cần kiểm tra trước khi áp dụng.";
  return reason || "Cần chọn cách xử lý trước khi khôi phục.";
};

const BackupManagement = () => {
  const auth = useContext(AuthContext) || {};
  const { user, restaurants: authRestaurants = [] } = auth;
  const restaurantScope = useManagerRestaurantSelection(authRestaurants);
  const sourceRestaurants = restaurantScope.restaurantOptions || [];
  const restaurantId = restaurantScope.selectedRestaurantId || "";
  const selectedRestaurant = restaurantScope.selectedRestaurant
    || sourceRestaurants.find((restaurant) => restaurantOptionId(restaurant) === restaurantId)
    || null;
  const restaurants = useMemo(() => {
    const byId = new Map();
    [...authRestaurants, ...sourceRestaurants].forEach((restaurant) => {
      const id = restaurantOptionId(restaurant);
      if (id) byId.set(id, restaurant);
    });
    return [...byId.values()];
  }, [authRestaurants, sourceRestaurants]);
  const hasConfirmedRestaurantScope = Boolean(
    !restaurantScope.restaurantsLoading
      && restaurantId
      && selectedRestaurant
      && restaurantOptionId(selectedRestaurant) === restaurantId,
  );

  const canRead = hasPermission(user, "backup.read");
  const canWrite = hasPermission(user, "backup.write");
  const canExport = hasPermission(user, "backup.export");
  const canImport = hasPermission(user, "backup.import");

  const [targetRestaurantId, setTargetRestaurantId] = useState("");
  const [exportSections, setExportSections] = useState(allSections);
  const [importSections, setImportSections] = useState(allSections);
  const [exportPreview, setExportPreview] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importMode, setImportMode] = useState("clone");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContentBase64, setFileContentBase64] = useState("");
  const [confirmedImport, setConfirmedImport] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [runDraft, setRunDraft] = useState({ checklist: FALLBACK_CHECKLIST, scope: FALLBACK_SCOPE, note: "" });
  const [statusNotice, setStatusNotice] = useState(null);
  const runActionRef = useRef("save");
  const [conflictResolutions, setConflictResolutions] = useState({});
  const [conflictFilter, setConflictFilter] = useState({ section: "all", severity: "all", resolution: "all", search: "" });

  const readinessQuery = useQuery(Q_BACKUP_READINESS, {
    variables: { restaurantId },
    skip: !hasConfirmedRestaurantScope || !canRead,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });
  const runsQuery = useQuery(Q_BACKUP_RUNS, {
    variables: { restaurantId, limit: 5, offset: 0 },
    skip: !hasConfirmedRestaurantScope || !canRead,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });
  const [previewExport, previewExportState] = useLazyQuery(Q_CONFIG_BACKUP_PREVIEW, { fetchPolicy: "network-only" });
  const [exportBackup, exportBackupState] = useMutation(M_EXPORT_CONFIG_BACKUP);
  const [previewImport, previewImportState] = useMutation(M_PREVIEW_CONFIG_IMPORT);

  const afterRunMutation = () => {
    void readinessQuery.refetch?.();
    void runsQuery.refetch?.();
  };

  const [createBackupRun, createRunState] = useMutation(M_CREATE_BACKUP_RUN, {
    onCompleted: ({ createBackupRun: created }) => {
      setSelectedRunId(created?.id || "");
      if (created) {
        setRunDraft({
          checklist: { ...FALLBACK_CHECKLIST, ...(created.checklist || {}) },
          scope: normalizeDraftScope(created.scope),
          note: created.note || "",
        });
      }
      setStatusNotice({
        scope: "run",
        type: "success",
        text: "Đã bắt đầu checklist mới. Hãy đánh dấu các bước đã kiểm tra rồi lưu lần chuẩn bị này.",
      });
      afterRunMutation();
    },
    onError: (error) => setStatusNotice({ scope: "run", type: "error", text: `Không thể bắt đầu checklist mới: ${error.message}` }),
  });
  const [updateBackupRun, updateRunState] = useMutation(M_UPDATE_BACKUP_RUN, {
    onCompleted: ({ updateBackupRun: updated }) => {
      const cancelled = runActionRef.current === "cancel";
      setSelectedRunId(updated?.id || "");
      setStatusNotice({
        scope: "run",
        type: "success",
        text: cancelled
          ? "Đã hủy lần chuẩn bị. Cấu hình nhà hàng và các file sao lưu đã tải không bị xóa."
          : "Đã lưu checklist, phạm vi và ghi chú của lần chuẩn bị đang chọn.",
      });
      afterRunMutation();
    },
    onError: (error) => {
      const action = runActionRef.current === "cancel" ? "hủy lần chuẩn bị" : "lưu checklist";
      setStatusNotice({ scope: "run", type: "error", text: `Không thể ${action}: ${error.message}` });
    },
  });
  const [importBackup, importBackupState] = useMutation(M_IMPORT_CONFIG_BACKUP, {
    onCompleted: () => afterRunMutation(),
  });

  const rawReadiness = readinessQuery.data?.backupReadiness;
  const readinessMatchesScope = Boolean(rawReadiness && String(rawReadiness.restaurantId || "") === restaurantId);
  const readiness = readinessMatchesScope ? rawReadiness : FALLBACK_READINESS;
  const rawRuns = Array.isArray(runsQuery.data?.backupRuns) ? runsQuery.data.backupRuns : [];
  const runs = rawRuns.filter((run) => String(run.restaurantId || "") === restaurantId);
  const currentLastRun = readiness.lastRun && String(readiness.lastRun.restaurantId || "") === restaurantId
    ? readiness.lastRun
    : null;
  const { latestRun, selectedRun } = selectBackupRuns({ runs, selectedRunId, currentLastRun });

  useEffect(() => {
    setTargetRestaurantId(restaurantId);
    setSelectedRunId("");
    setRunDraft({ checklist: FALLBACK_CHECKLIST, scope: FALLBACK_SCOPE, note: "" });
    setExportPreview(null);
    setImportPreview(null);
    setImportResult(null);
    setConfirmedImport(false);
    setConflictResolutions({});
    setConflictFilter({ section: "all", severity: "all", resolution: "all", search: "" });
    setStatusNotice(null);
  }, [restaurantId]);

  useEffect(() => {
    if (!selectedRunId && latestRun?.id) setSelectedRunId(latestRun.id);
  }, [latestRun?.id, selectedRunId]);

  useEffect(() => {
    if (selectedRun) {
      setRunDraft({
        checklist: { ...FALLBACK_CHECKLIST, ...(selectedRun.checklist || {}) },
        scope: normalizeDraftScope(selectedRun.scope),
        note: selectedRun.note || "",
      });
      return;
    }
    if (!selectedRunId) {
      setRunDraft({ checklist: FALLBACK_CHECKLIST, scope: FALLBACK_SCOPE, note: "" });
    }
  }, [restaurantId, selectedRun?.id, selectedRunId]);

  const checklistItems = useMemo(() => toChecklistItems(readiness.checklist), [readiness.checklist]);
  const scopeItems = useMemo(() => toScopeItems(readiness.scope), [readiness.scope]);
  const unresolvedRisks = useMemo(() => (readiness.risks || []).filter((risk) => !risk.resolved), [readiness.risks]);
  const completedChecklistCount = checklistItems.filter((item) => item.done).length;
  const enabledScopeCount = scopeItems.filter((item) => item.enabled).length;
  const staleReadData = Boolean((rawReadiness && !readinessMatchesScope) || rawRuns.some((run) => String(run.restaurantId || "") !== restaurantId));
  const loading = restaurantScope.restaurantsLoading
    || (canRead && hasConfirmedRestaurantScope && (readinessQuery.loading || runsQuery.loading));
  const importConflicts = importPreview?.conflicts || [];
  const importWarnings = (importPreview?.warnings || []).map(friendlyWarning);
  const exportWarnings = (exportPreview?.warnings || []).map(friendlyWarning);
  const resultWarnings = (importResult?.warnings || []).map(friendlyWarning);
  const exportCount = selectedSectionCount(exportSections);
  const importCount = selectedSectionCount(importSections);
  const hasExportSections = exportCount > 0;
  const hasImportSections = importCount > 0;
  const exportReadiness = getExportReadinessState({ latestRun, selectedRun, runDraft });
  const savedMissingLabels = exportReadiness.savedMissingKeys.map((key) => CHECKLIST_LABELS[key]);

  const conflictStats = useMemo(() => ({
    total: importConflicts.length,
    blocking: importConflicts.filter((conflict) => conflict.severity === "blocking").length,
    warning: importConflicts.filter((conflict) => conflict.severity === "warning").length,
    keepTarget: Object.values(conflictResolutions).filter((item) => item.resolution === "keep_target").length,
    useSource: Object.values(conflictResolutions).filter((item) => item.resolution === "use_source").length,
    merge: Object.values(conflictResolutions).filter((item) => item.resolution === "merge").length,
  }), [importConflicts, conflictResolutions]);

  const filteredConflicts = useMemo(() => importConflicts.filter((conflict) => {
    const current = conflictResolutions[conflict.id]?.resolution || conflict.defaultResolution;
    const searchText = `${conflict.entityKey} ${conflict.label || ""} ${friendlyReason(conflict.reason)}`.toLowerCase();
    return (conflictFilter.section === "all" || conflict.section === conflictFilter.section)
      && (conflictFilter.severity === "all" || conflict.severity === conflictFilter.severity)
      && (conflictFilter.resolution === "all" || current === conflictFilter.resolution)
      && (!conflictFilter.search || searchText.includes(conflictFilter.search.toLowerCase()));
  }), [importConflicts, conflictFilter, conflictResolutions]);

  const invalidConflictResolution = importConflicts.some((conflict) => {
    const current = conflictResolutions[conflict.id] || { resolution: conflict.defaultResolution, renameTo: "" };
    return !conflict.allowedResolutions.includes(current.resolution)
      || (current.resolution === "rename_source" && !current.renameTo?.trim())
      || (conflict.severity === "blocking" && current.resolution === "skip");
  });
  const importPreviewReady = Boolean(importPreview && !(importPreview.errors || []).length && !invalidConflictResolution);
  const importCanRun = Boolean(importPreviewReady && confirmedImport && fileContentBase64 && hasImportSections && canImport);

  const resetImportReview = () => {
    setImportPreview(null);
    setImportResult(null);
    setConfirmedImport(false);
    setConflictResolutions({});
    setConflictFilter({ section: "all", severity: "all", resolution: "all", search: "" });
  };
  const updateDraftChecklist = (key, checked) => setRunDraft((prev) => ({ ...prev, checklist: { ...prev.checklist, [key]: checked } }));
  const updateDraftScope = (key, checked) => {
    if (UNSUPPORTED_SCOPE_KEYS.has(key)) return;
    setRunDraft((prev) => ({ ...prev, scope: { ...prev.scope, [key]: checked } }));
  };
  const updateConflictResolution = (conflictId, patch) => {
    setConfirmedImport(false);
    setConflictResolutions((prev) => ({ ...prev, [conflictId]: { ...(prev[conflictId] || { conflictId }), ...patch } }));
  };
  const applyBulkResolution = (resolution, predicate = () => true) => {
    setConfirmedImport(false);
    setConflictResolutions((prev) => {
      const next = { ...prev };
      for (const conflict of importConflicts) {
        if (!predicate(conflict) || !conflict.allowedResolutions.includes(resolution)) continue;
        next[conflict.id] = { ...(next[conflict.id] || { conflictId: conflict.id, renameTo: "", fieldOverridesJson: "" }), resolution };
      }
      return next;
    });
  };

  const importInput = (dryRun = true) => ({
    targetRestaurantId,
    fileContentBase64,
    mode: importMode,
    sections: selectedSectionsPayload(importSections),
    dryRun,
    replaceExisting: importMode === "replace" ? confirmedImport : false,
    conflictResolutions: Object.values(conflictResolutions),
  });

  const createRun = () => {
    if (!hasConfirmedRestaurantScope || !canWrite) return;
    setStatusNotice(null);
    void createBackupRun({ variables: { input: { restaurantId, checklist: runDraft.checklist, scope: normalizeDraftScope(runDraft.scope), note: runDraft.note } } });
  };
  const saveRun = (status) => {
    if (!selectedRun?.id || !hasConfirmedRestaurantScope || !canWrite) return;
    const isCancel = status === "cancelled";
    if (isCancel) {
      const confirmed = window.confirm(
        "Hủy lần chuẩn bị đang chọn?\n\nThao tác này chỉ đánh dấu lần chuẩn bị là đã hủy; không xóa cấu hình nhà hàng hoặc file sao lưu đã tải.",
      );
      if (!confirmed) return;
    }
    runActionRef.current = isCancel ? "cancel" : "save";
    setStatusNotice(null);
    void updateBackupRun({ variables: { input: { id: selectedRun.id, restaurantId, checklist: runDraft.checklist, scope: normalizeDraftScope(runDraft.scope), note: runDraft.note, ...(status ? { status } : {}) } } });
  };

  const toggleExportSection = (key) => {
    setExportPreview(null);
    setExportSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const toggleImportSection = (key) => {
    resetImportReview();
    setImportSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const setAllExportSections = (enabled) => {
    setExportPreview(null);
    setExportSections(Object.fromEntries(CONFIG_SECTIONS.map(([key]) => [key, enabled])));
  };
  const setAllImportSections = (enabled) => {
    resetImportReview();
    setImportSections(Object.fromEntries(CONFIG_SECTIONS.map(([key]) => [key, enabled])));
  };

  const handlePreviewExport = async () => {
    if (!restaurantId || !hasExportSections || !canRead) return;
    setStatusNotice(null);
    try {
      const { data } = await previewExport({ variables: { input: { restaurantId, sections: selectedSectionsPayload(exportSections) } } });
      setExportPreview(data?.restaurantConfigBackupPreview || null);
    } catch (error) {
      setStatusNotice({ type: "error", text: `Không thể xem trước file sao lưu: ${error.message}` });
    }
  };

  const handleDownloadExport = async () => {
    if (!restaurantId || !hasExportSections || !canExport || !exportReadiness.canDownload) return;
    setStatusNotice(null);
    try {
      const { data } = await exportBackup({ variables: { input: { restaurantId, sections: selectedSectionsPayload(exportSections) } } });
      const file = data?.exportRestaurantConfigBackup;
      if (!file?.contentBase64) throw new Error("Máy chủ không trả về nội dung file");
      const blob = base64ToBlob(file.contentBase64, file.mimeType);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.fileName || "sao-luu-cau-hinh-nha-hang.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatusNotice({ type: "success", text: `Đã tạo file ${file.fileName}. Mã kiểm tra: ${file.checksum}` });
    } catch (error) {
      setStatusNotice({ type: "error", text: `Không tải được file sao lưu: ${error.message}` });
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    resetImportReview();
    setSelectedFile(null);
    setFileContentBase64("");
    setStatusNotice(null);
    if (!file) return;
    const isJson = file.type === "application/json" || file.name.toLowerCase().endsWith(".json");
    if (!isJson) {
      setStatusNotice({ type: "error", text: "Chỉ chấp nhận file sao lưu định dạng JSON." });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setStatusNotice({ type: "error", text: "File sao lưu quá lớn, giới hạn là 10MB." });
      return;
    }
    try {
      const content = await readFileAsBase64(file);
      setSelectedFile(file);
      setFileContentBase64(content);
    } catch (error) {
      setStatusNotice({ type: "error", text: error.message || "Không đọc được file sao lưu." });
    }
  };

  const handlePreviewImport = async () => {
    if (!fileContentBase64 || !targetRestaurantId || !hasImportSections || !canImport) return;
    setStatusNotice(null);
    setConfirmedImport(false);
    setImportResult(null);
    try {
      const { data } = await previewImport({ variables: { input: importInput(true) } });
      const preview = data?.previewRestaurantConfigImport || null;
      setImportPreview(preview);
      setConflictResolutions(Object.fromEntries((preview?.conflicts || []).map((conflict) => [
        conflict.id,
        { conflictId: conflict.id, resolution: conflict.defaultResolution, renameTo: "", fieldOverridesJson: "" },
      ])));
    } catch (error) {
      setImportPreview(null);
      setStatusNotice({ type: "error", text: `Không thể xem trước khôi phục: ${error.message}` });
    }
  };

  const handleImport = async () => {
    if (!importCanRun) return;
    setStatusNotice(null);
    try {
      const { data } = await importBackup({ variables: { input: importInput(false) } });
      const result = data?.importRestaurantConfigBackup || null;
      setImportResult(result);
      setConfirmedImport(false);
      setStatusNotice({
        type: result?.success ? "success" : "error",
        text: result?.success ? "Đã áp dụng cấu hình vào nhà hàng đã chọn." : "Khôi phục không thành công. Hãy kiểm tra kết quả bên dưới.",
      });
    } catch (error) {
      setStatusNotice({ type: "error", text: `Khôi phục thất bại: ${error.message}` });
    }
  };

  const pageWarning = !canRead
    ? "Tài khoản chưa có quyền backup.read nên không thể xem checklist và lịch sử. Các thao tác khác vẫn phụ thuộc quyền riêng của từng chức năng."
    : !hasConfirmedRestaurantScope && !restaurantScope.restaurantsLoading
      ? "Chọn một chi nhánh ở thanh quản trị phía trên để bắt đầu."
      : readinessQuery.error || runsQuery.error
        ? "Không đọc được trạng thái sao lưu mới nhất. Hãy kiểm tra kết nối hoặc quyền truy cập."
        : staleReadData
          ? "Dữ liệu trả về không thuộc chi nhánh đang chọn nên đã được bỏ qua. Hãy làm mới để tải lại."
          : "";

  const exportReadinessMessage = !latestRun || latestRun.status !== "planned"
    ? "Chưa có lần chuẩn bị đang hoạt động. Bấm “Bắt đầu checklist mới”, chọn 3 việc bắt buộc rồi lưu."
    : exportReadiness.viewingHistory
      ? "Bạn đang xem một lần cũ. Nút tải file luôn kiểm tra lần mới nhất; hãy chọn mục có nhãn “Mới nhất” trong lịch sử."
      : exportReadiness.draftCompleteButUnsaved
        ? "Bạn đã chọn đủ 3 việc bắt buộc nhưng chưa lưu. Bấm “Lưu checklist hiện tại” trước khi tải file."
        : savedMissingLabels.length
          ? `Checklist mới nhất đã lưu còn thiếu: ${savedMissingLabels.join(", ")}.`
          : "Checklist mới nhất đã lưu đủ 3 việc bắt buộc. Bạn có thể tải file.";

  const headerStats = [
    { label: "An toàn", value: readiness.ready ? "Sẵn sàng" : "Cần rà soát", icon: <ShieldCheck size={17} />, tone: readiness.ready ? "success" : "warning" },
    { label: "Checklist đã lưu", value: `${completedChecklistCount}/${checklistItems.length}`, icon: <CheckCircle2 size={17} /> },
    { label: "Phạm vi", value: `${enabledScopeCount}/${scopeItems.length}`, icon: <FileText size={17} /> },
    { label: "Lịch sử", value: runs.length, icon: <History size={17} /> },
  ];

  return (
    <div className="backup-management" aria-busy={loading}>
      <ManagementPageHeader
        eyebrow="Sao lưu & khôi phục"
        title="Sao lưu cấu hình"
        subtitle="Tạo file cấu hình có kiểm soát, xem trước trước khi khôi phục và lưu dấu vết người thực hiện."
        icon={<Archive size={18} />}
        stats={headerStats}
        loading={loading}
        density="compact"
        showTimeWidget={false}
        customControls={(
          <div className="backup-management__badges" aria-label="Nguyên tắc sao lưu">
            <span><Building2 size={14} />{selectedRestaurant ? restaurantOptionName(selectedRestaurant) : "Chưa chọn chi nhánh"}</span>
            <span><LockKeyhole size={14} />Không chứa mật khẩu hoặc khóa thanh toán</span>
          </div>
        )}
      />

      {pageWarning ? <section className="backup-management__alert is-warning" role="status"><AlertTriangle size={18} />{pageWarning}</section> : null}
      {statusNotice && statusNotice.scope !== "run" ? <section className={`backup-management__alert is-${statusNotice.type}`} role={statusNotice.type === "error" ? "alert" : "status"}>{statusNotice.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}{statusNotice.text}</section> : null}
      {loading ? <section className="backup-management__state" role="status"><RefreshCw className="is-spinning" size={20} /><div><strong>Đang đồng bộ dữ liệu sao lưu</strong><p>Hệ thống đang lấy checklist và lịch sử đúng theo chi nhánh đã chọn.</p></div></section> : null}

      <section className="backup-management__run-workflow" aria-label="Checklist an toàn">
        <div className="backup-management__run-editor">
          <div className="backup-management__section-head">
            <div>
              <span>01 · Chuẩn bị</span>
              <h2>Checklist an toàn</h2>
              <p>Xác nhận điều kiện trước khi tải file để lần sao lưu có người thực hiện, phạm vi và ghi chú rõ ràng.</p>
            </div>
            <div className="backup-management__run-action-block">
              <div className="backup-management__run-actions">
                <button type="button" className="is-primary" onClick={createRun} disabled={!hasConfirmedRestaurantScope || !canWrite || createRunState.loading} title={!canWrite ? "Cần quyền backup.write" : "Tạo một lần ghi nhận checklist mới"}>
                  <ShieldCheck size={16} />{createRunState.loading ? "Đang bắt đầu..." : "Bắt đầu checklist mới"}
                </button>
                <button type="button" onClick={() => saveRun()} disabled={!selectedRun?.id || !canWrite || updateRunState.loading} title={!canWrite ? "Cần quyền backup.write" : "Lưu checklist, phạm vi và ghi chú của lần đang chọn"}>
                  <Save size={16} />{updateRunState.loading && runActionRef.current === "save" ? "Đang lưu..." : "Lưu checklist hiện tại"}
                </button>
                <button type="button" className="is-danger" onClick={() => saveRun("cancelled")} disabled={!selectedRun?.id || !canWrite || updateRunState.loading} title="Đánh dấu lần chuẩn bị đang chọn là đã hủy">
                  <XCircle size={16} />{updateRunState.loading && runActionRef.current === "cancel" ? "Đang hủy..." : "Hủy lần chuẩn bị"}
                </button>
              </div>
              <p className="backup-management__run-action-help">Bắt đầu tạo một lần ghi nhận mới; Lưu cập nhật lần đang chọn; Hủy chỉ đóng lần chuẩn bị, không xóa cấu hình hoặc file sao lưu.</p>
              {statusNotice?.scope === "run" ? (
                <div className={`backup-management__run-feedback is-${statusNotice.type}`} role={statusNotice.type === "error" ? "alert" : "status"} aria-live="polite">
                  {statusNotice.type === "success" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                  <span>{statusNotice.text}</span>
                </div>
              ) : null}
            </div>
          </div>
          {!canWrite ? <p className="backup-management__permission-note">Bạn có thể xem nhưng cần quyền <strong>backup.write</strong> để tạo hoặc cập nhật checklist.</p> : null}
          <div className="backup-management__check-scope-grid">
            <fieldset>
              <legend>Việc cần xác nhận</legend>
              {Object.entries(CHECKLIST_LABELS).map(([key, label]) => (
                <label key={key}>
                  <input type="checkbox" checked={Boolean(runDraft.checklist[key])} disabled={!canWrite} onChange={(event) => updateDraftChecklist(key, event.target.checked)} />
                  <span>{label}{REQUIRED_EXPORT_CHECKLIST_KEYS.includes(key) ? <small>Bắt buộc trước khi tải file</small> : null}</span>
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Phạm vi file cấu hình</legend>
              {Object.entries(SCOPE_LABELS).map(([key, label]) => {
                const unsupported = UNSUPPORTED_SCOPE_KEYS.has(key);
                return (
                  <label key={key} className={unsupported ? "is-disabled" : ""}>
                    <input type="checkbox" checked={Boolean(runDraft.scope[key])} disabled={!canWrite || unsupported} onChange={(event) => updateDraftScope(key, event.target.checked)} />
                    <span>{label}{unsupported ? <small>Không thuộc file cấu hình</small> : null}</span>
                  </label>
                );
              })}
            </fieldset>
          </div>
          <label className="backup-management__run-note">Ghi chú nội bộ
            <textarea value={runDraft.note} maxLength={1000} disabled={!canWrite} onChange={(event) => setRunDraft((prev) => ({ ...prev, note: event.target.value }))} placeholder="Nơi lưu file, ca đã đối soát, người thực hiện..." />
            <small>{runDraft.note.length}/1000 ký tự</small>
          </label>
        </div>
        <aside className="backup-management__run-detail">
          <div className="backup-management__section-head">
            <div><span>{exportReadiness.viewingHistory ? "Lịch sử đang xem" : "Lần mới nhất"}</span><h3>{selectedRun ? statusLabel(selectedRun.status) : selectedRunId ? "Đang đồng bộ" : "Chưa có dữ liệu"}</h3></div>
          </div>
          {selectedRun ? (
            <dl>
              <div><dt>Tạo lúc</dt><dd>{formatDate(selectedRun.createdAt)}</dd></div>
              <div><dt>Hoàn tất</dt><dd>{selectedRun.completedAt ? formatDate(selectedRun.completedAt) : "Chưa hoàn tất"}</dd></div>
              <div><dt>Cập nhật</dt><dd>{formatDate(selectedRun.updatedAt)}</dd></div>
              <div><dt>Ghi chú</dt><dd>{selectedRun.note || "Chưa có"}</dd></div>
            </dl>
          ) : <div className="backup-management__empty">{selectedRunId ? "Đang tải lần chuẩn bị vừa chọn..." : "Chưa có lần chuẩn bị. Hãy bắt đầu checklist mới để ghi nhận lần kiểm tra."}</div>}
          {runs.length ? <label>Lịch sử gần đây<select value={selectedRun?.id || selectedRunId || ""} onChange={(event) => setSelectedRunId(event.target.value)}>{runs.map((run, index) => <option key={run.id} value={run.id}>{index === 0 ? "Mới nhất · " : ""}{statusLabel(run.status)} · {formatDate(run.createdAt)}</option>)}</select></label> : null}
          {exportReadiness.viewingHistory ? <p className="backup-management__permission-note">Bạn đang xem một lần cũ. Trạng thái tải file được tính theo lần có nhãn <strong>Mới nhất</strong>.</p> : null}
          <p className="backup-management__run-hint">File này chỉ lưu cấu hình. Đơn hàng, giao dịch và dữ liệu vận hành không nằm trong snapshot.</p>
        </aside>
      </section>

      <section className="backup-management__flow" aria-label="Sao lưu và khôi phục cấu hình">
        <section className="backup-management__config-panel backup-management__config-panel--export" aria-label="Tải file sao lưu">
          <div className="backup-management__section-head">
            <div><span>02 · Sao lưu</span><h2>Tải file cấu hình</h2><p>Nguồn dữ liệu là chi nhánh đang chọn trên thanh quản trị: <strong>{selectedRestaurant ? restaurantOptionName(selectedRestaurant) : "chưa chọn"}</strong>.</p></div>
            <Download size={22} aria-hidden="true" />
          </div>
          {!canExport ? <p className="backup-management__permission-note">Cần quyền <strong>backup.export</strong> để tải file. Quyền <strong>backup.read</strong> dùng cho bước xem trước.</p> : null}
          <p className={exportReadiness.canDownload ? "backup-management__run-hint" : "backup-management__permission-note"} role="status">{exportReadinessMessage}</p>
          <div className="backup-management__section-toolbar"><strong>{exportCount}/{CONFIG_SECTIONS.length} hạng mục</strong><button type="button" onClick={() => setAllExportSections(exportCount !== CONFIG_SECTIONS.length)}>{exportCount === CONFIG_SECTIONS.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}</button></div>
          <div className="backup-management__section-list">
            {CONFIG_SECTIONS.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(exportSections[key])} onChange={() => toggleExportSection(key)} /><span>{label}</span></label>)}
          </div>
          {!hasExportSections ? <p className="backup-management__field-error">Chọn ít nhất một hạng mục để tạo file.</p> : null}
          <div className="backup-management__actions">
            <button type="button" onClick={handlePreviewExport} disabled={!hasConfirmedRestaurantScope || !hasExportSections || !canRead || previewExportState.loading} title={!canRead ? "Cần quyền backup.read" : "Kiểm tra số lượng dữ liệu"}>
              <FileText size={16} />{previewExportState.loading ? "Đang kiểm tra..." : "Xem nội dung"}
            </button>
            <button type="button" className="is-primary" onClick={handleDownloadExport} disabled={!hasConfirmedRestaurantScope || !hasExportSections || !canExport || !exportReadiness.canDownload || exportBackupState.loading} title={!canExport ? "Cần quyền backup.export" : !exportReadiness.canDownload ? exportReadinessMessage : "Tải file JSON"}>
              <Download size={16} />{exportBackupState.loading ? "Đang tạo file..." : "Tải file sao lưu"}
            </button>
          </div>
          {exportPreview ? <div className="backup-management__result"><h3>Sẵn sàng tải file</h3><p><strong>{exportPreview.fileName}</strong></p><ul>{exportPreview.counts.map((item) => <li key={item.key}><span>{item.label}</span><strong>{item.enabled ? `${item.count} mục` : "Không chọn"}</strong></li>)}</ul>{exportWarnings.map((item) => <p key={item}>{item}</p>)}</div> : null}
        </section>

        <section className="backup-management__config-panel backup-management__config-panel--import" aria-label="Khôi phục cấu hình">
          <div className="backup-management__section-head">
            <div><span>03 · Khôi phục</span><h2>Khôi phục từ file</h2><p>Chọn file, xem trước đúng nhà hàng đích, xử lý mục trùng rồi xác nhận.</p></div>
            <Upload size={22} aria-hidden="true" />
          </div>
          {!canImport ? <p className="backup-management__permission-note">Cần quyền <strong>backup.import</strong> để xem trước và áp dụng khôi phục.</p> : null}
          <ol className="backup-management__wizard" aria-label="Các bước khôi phục">
            <li className={selectedFile ? "is-done" : ""}><span>1</span>Chọn file</li>
            <li className={importPreview ? "is-done" : ""}><span>2</span>Xem trước</li>
            <li className={importPreview && !invalidConflictResolution ? "is-done" : ""}><span>3</span>Xử lý trùng</li>
            <li className={confirmedImport ? "is-done" : ""}><span>4</span>Xác nhận</li>
          </ol>
          <label className="backup-management__file-input">File sao lưu
            <input type="file" accept=".json,application/json" disabled={!canImport} onChange={handleFileChange} />
            <span><Upload size={16} />{selectedFile ? selectedFile.name : "Chọn file JSON tối đa 10MB"}</span>
          </label>
          <div className="backup-management__import-options">
            <label>Khôi phục vào nhà hàng
              <select value={targetRestaurantId} disabled={!canImport} onChange={(event) => { setTargetRestaurantId(event.target.value); resetImportReview(); }}>
                {restaurants.map((restaurant) => <option key={restaurantOptionId(restaurant)} value={restaurantOptionId(restaurant)}>{restaurantOptionName(restaurant)}</option>)}
              </select>
            </label>
            <label>Cách áp dụng
              <select value={importMode} disabled={!canImport} onChange={(event) => { setImportMode(event.target.value); resetImportReview(); }}>
                {IMPORT_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <div className="backup-management__section-toolbar"><strong>{importCount}/{CONFIG_SECTIONS.length} hạng mục</strong><button type="button" onClick={() => setAllImportSections(importCount !== CONFIG_SECTIONS.length)}>{importCount === CONFIG_SECTIONS.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}</button></div>
          <div className="backup-management__section-list">
            {CONFIG_SECTIONS.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(importSections[key])} disabled={!canImport} onChange={() => toggleImportSection(key)} /><span>{label}</span></label>)}
          </div>
          {!hasImportSections ? <p className="backup-management__field-error">Chọn ít nhất một hạng mục để xem trước.</p> : null}
          <div className="backup-management__actions">
            <button type="button" onClick={handlePreviewImport} disabled={!fileContentBase64 || !targetRestaurantId || !hasImportSections || !canImport || previewImportState.loading}>
              <FileText size={16} />{previewImportState.loading ? "Đang xem trước..." : "Xem trước khôi phục"}
            </button>
            <button type="button" className="is-primary" onClick={handleImport} disabled={!importCanRun || importBackupState.loading}>
              <Upload size={16} />{importBackupState.loading ? "Đang áp dụng..." : "Áp dụng khôi phục"}
            </button>
          </div>
          {importPreview ? <div className={`backup-management__result ${importPreviewReady ? "is-ready" : "is-blocked"}`}><h3>{importPreviewReady ? "Có thể khôi phục" : "Cần xử lý trước khi khôi phục"}</h3><p>Nguồn file: <strong>{importPreview.sourceRestaurantName || "-"}</strong> · {modeLabel(importPreview.mode)}</p><ul>{importPreview.changes.map((item) => <li key={`${item.section}-${item.action}`}><span>{item.label || sectionLabel(item.section)}</span><strong>{actionLabel(item.action)} {item.count} mục</strong></li>)}</ul>{importWarnings.map((item) => <p key={item}>{item}</p>)}{(importPreview.errors || []).map((item) => <p key={item} className="backup-management__error">{item}</p>)}</div> : null}

          {importConflicts.length ? (
            <section className="backup-management__conflicts" aria-label="Xử lý mục trùng khi khôi phục">
              <div className="backup-management__section-head"><div><span>Xung đột dữ liệu</span><h3>Chọn cách xử lý</h3><p>Mỗi lựa chọn sẽ được gửi lại cùng thao tác khôi phục và ghi vào audit log.</p></div></div>
              <div className="backup-management__conflict-summary">
                <article><strong>{conflictStats.total}</strong><span>Tổng mục</span></article>
                <article><strong>{conflictStats.blocking}</strong><span>Cần xử lý</span></article>
                <article><strong>{conflictStats.warning}</strong><span>Nên kiểm tra</span></article>
                <article><strong>{conflictStats.keepTarget}</strong><span>Giữ hiện tại</span></article>
                <article><strong>{conflictStats.useSource}</strong><span>Dùng file</span></article>
                <article><strong>{conflictStats.merge}</strong><span>Gộp</span></article>
              </div>
              <div className="backup-management__conflict-filters">
                <select aria-label="Lọc hạng mục xung đột" value={conflictFilter.section} onChange={(event) => setConflictFilter((prev) => ({ ...prev, section: event.target.value }))}>
                  <option value="all">Tất cả hạng mục</option>
                  {[...new Set(importConflicts.map((conflict) => conflict.section))].map((section) => <option key={section} value={section}>{sectionLabel(section)}</option>)}
                </select>
                <select aria-label="Lọc mức độ xung đột" value={conflictFilter.severity} onChange={(event) => setConflictFilter((prev) => ({ ...prev, severity: event.target.value }))}>
                  <option value="all">Tất cả mức độ</option><option value="blocking">Cần chọn cách xử lý</option><option value="warning">Nên kiểm tra</option><option value="info">Thông tin</option>
                </select>
                <select aria-label="Lọc cách xử lý xung đột" value={conflictFilter.resolution} onChange={(event) => setConflictFilter((prev) => ({ ...prev, resolution: event.target.value }))}>
                  <option value="all">Tất cả cách xử lý</option>{Object.keys(RESOLUTION_LABELS).map((key) => <option key={key} value={key}>{RESOLUTION_LABELS[key]}</option>)}
                </select>
                <input aria-label="Tìm xung đột" value={conflictFilter.search} onChange={(event) => setConflictFilter((prev) => ({ ...prev, search: event.target.value }))} placeholder="Tìm theo tên hoặc mã" />
              </div>
              <div className="backup-management__actions is-wrap">
                <button type="button" onClick={() => { setConfirmedImport(false); setConflictResolutions(Object.fromEntries(importConflicts.map((conflict) => [conflict.id, { conflictId: conflict.id, resolution: conflict.defaultResolution, renameTo: "", fieldOverridesJson: "" }]))); }}>Dùng đề xuất</button>
                <button type="button" onClick={() => applyBulkResolution("keep_target")}>Giữ bản hiện tại</button>
                <button type="button" onClick={() => applyBulkResolution("use_source")}>Dùng bản trong file</button>
                <button type="button" onClick={() => applyBulkResolution("merge", (conflict) => conflict.severity !== "blocking")}>Gộp mục an toàn</button>
              </div>
              {invalidConflictResolution ? <p className="backup-management__error">Cần chọn cách xử lý hợp lệ cho các mục bắt buộc trước khi khôi phục.</p> : null}
              <div className="backup-management__conflict-list">
                {filteredConflicts.map((conflict) => {
                  const current = conflictResolutions[conflict.id] || { conflictId: conflict.id, resolution: conflict.defaultResolution, renameTo: "" };
                  return (
                    <article key={conflict.id}>
                      <header><strong>{sectionLabel(conflict.section)} · {conflict.label || conflict.entityKey}</strong><span className={`backup-management__severity is-${conflict.severity}`}>{severityLabel(conflict.severity)}</span></header>
                      <p>{friendlyReason(conflict.reason)}</p>
                      <label>Cách xử lý
                        <select aria-label={`Cách xử lý ${conflict.entityKey}`} value={current.resolution} onChange={(event) => updateConflictResolution(conflict.id, { resolution: event.target.value })}>
                          {conflict.allowedResolutions.map((resolution) => <option key={resolution} value={resolution}>{RESOLUTION_LABELS[resolution] || resolution}</option>)}
                        </select>
                      </label>
                      {current.resolution === "rename_source" ? <label>Tên mới<input aria-label={`Tên mới ${conflict.entityKey}`} value={current.renameTo || ""} onChange={(event) => updateConflictResolution(conflict.id, { renameTo: event.target.value })} /></label> : null}
                      <details><summary>Xem khác biệt</summary><ul>{conflict.fieldDiffs.map((diff) => <li key={`${conflict.id}-${diff.field}`}>{fieldLabel(diff.field)}: file={diff.sourceValuePreview || "-"} / hiện tại={diff.targetValuePreview || "-"}</li>)}</ul></details>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {importPreviewReady ? <label className="backup-management__confirm"><input type="checkbox" checked={confirmedImport} onChange={(event) => setConfirmedImport(event.target.checked)} /><span>Tôi đã xem đúng nhà hàng đích, hạng mục và cách xử lý; đồng ý áp dụng thay đổi.</span></label> : null}
          {importResult ? <div className={`backup-management__result ${importResult.success ? "is-ready" : "is-blocked"}`}><h3>Khôi phục {importResult.success ? "thành công" : "không thành công"}</h3><p>Mã ghi nhận: <strong>{importResult.backupRun?.id || "-"}</strong></p>{(importResult.appliedResolutions || []).length ? <p>Cách xử lý đã áp dụng: {(importResult.appliedResolutions || []).map((item) => `${RESOLUTION_LABELS[item.resolution] || item.resolution}${item.renameTo ? ` → ${item.renameTo}` : ""}`).join(", ")}</p> : null}{resultWarnings.map((item) => <p key={`import-warning-${item}`}>{item}</p>)}{(importResult.errors || []).map((item) => <p key={`import-error-${item}`} className="backup-management__error">{item}</p>)}</div> : null}
        </section>
      </section>

      <section className="backup-management__secondary" aria-label="Thông tin sao lưu bổ sung">
        <details>
          <summary><span><FileText size={17} />Phạm vi đang theo dõi</span><strong>{enabledScopeCount}/{scopeItems.length}</strong></summary>
          <div className="backup-management__detail-grid">{scopeItems.map((item) => <article key={item.key}><h3>{item.label}</h3><p>{item.enabled ? "Đang nằm trong kế hoạch" : "Không bao gồm"}</p></article>)}</div>
        </details>
        <details>
          <summary><span><AlertTriangle size={17} />Điểm cần kiểm tra</span><strong>{unresolvedRisks.length}</strong></summary>
          <div className="backup-management__detail-grid">{(readiness.risks || []).length ? readiness.risks.map((risk) => <article key={risk.key} className={risk.resolved ? "is-resolved" : ""}><h3>{CHECKLIST_LABELS[risk.key] || risk.label}</h3><p>{risk.resolved ? "Đã xử lý" : "Cần hoàn tất trước khi chốt."}</p></article>) : <p className="backup-management__empty">Chưa có dữ liệu kiểm tra.</p>}</div>
        </details>
        <details>
          <summary><span><History size={17} />5 lần gần nhất</span><strong>{runs.length}</strong></summary>
          <ol className="backup-management__timeline">{runs.length ? runs.map((run) => {
            const doneCount = toChecklistItems(run.checklist).filter((item) => item.done).length;
            const scopeCount = toScopeItems(run.scope).filter((item) => item.enabled).length;
            return <li key={run.id}><div><h3>{statusLabel(run.status)}</h3><time>{formatDate(run.createdAt)}</time><p>Checklist {doneCount}/{checklistItems.length} · Phạm vi {scopeCount}/{scopeItems.length}</p>{run.note ? <p>{run.note}</p> : null}</div></li>;
          }) : <li><div><p>Chưa có lịch sử sao lưu.</p></div></li>}</ol>
        </details>
      </section>
    </div>
  );
};

export default BackupManagement;
