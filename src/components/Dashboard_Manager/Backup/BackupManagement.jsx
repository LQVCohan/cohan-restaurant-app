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

const Q_BACKUP_READINESS = gql`
  query BackupReadiness($restaurantId: ID!) {
    backupReadiness(restaurantId: $restaurantId) {
      restaurantId
      ready
      risks { key label severity resolved description }
      checklist { reportsChecked transactionsReconciled settingsReviewed exportPrepared safeCopyStored operatorRecorded }
      scope { ordersAndPayments tablesAndFloorPlan menuAndPricing inventory staffAndPermissions schedules customersAndPromotions reportsAndReconciliation }
      lastRun { id restaurantId status note completedAt createdAt updatedAt }
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
  transactionsReconciled: "Đối chiếu các khoản thanh toán",
  settingsReviewed: "Kiểm tra các cài đặt quan trọng",
  exportPrepared: "Chuẩn bị file sao lưu",
  safeCopyStored: "Lưu file ở nơi an toàn",
  operatorRecorded: "Ghi tên người thực hiện",
};

const SCOPE_LABELS = {
  ordersAndPayments: "Đơn hàng và thanh toán",
  tablesAndFloorPlan: "Bàn và sơ đồ",
  menuAndPricing: "Thực đơn và giá bán",
  inventory: "Kho và nguyên liệu",
  staffAndPermissions: "Nhân viên và quyền truy cập",
  schedules: "Lịch làm việc",
  customersAndPromotions: "Khách hàng và ưu đãi",
  reportsAndReconciliation: "Báo cáo và kiểm tra giao dịch",
};

const CONFIG_SECTIONS = [
  ["restaurantProfile", "Thông tin nhà hàng"],
  ["systemSettings", "Cài đặt vận hành"],
  ["printSettings", "Cài đặt in ấn"],
  ["customerRankSettings", "Hạng khách hàng"],
  ["payrollSettings", "Cài đặt lương"],
  ["schedulingPolicy", "Quy tắc xếp ca"],
  ["floorTableLayout", "Sơ đồ và bàn"],
  ["menuCatalog", "Thực đơn, giá và công thức"],
  ["inventoryMaster", "Danh mục kho"],
  ["promotionConfig", "Ưu đãi và mã giảm giá"],
  ["aiChatbotConfig", "Cài đặt trợ lý AI"],
];

const IMPORT_MODES = [
  ["clone", "Sao chép sang nhà hàng đang chọn"],
  ["same_restaurant_restore", "Khôi phục về nhà hàng ban đầu"],
  ["merge", "Chỉ bổ sung phần còn thiếu"],
  ["replace", "Thay các phần đã chọn"],
];

const RESOLUTION_LABELS = {
  use_source: "Dùng dữ liệu trong file",
  keep_target: "Giữ dữ liệu hiện có",
  merge: "Kết hợp nếu không ảnh hưởng dữ liệu",
  create_copy: "Tạo thêm một bản",
  rename_source: "Đổi tên rồi thêm",
  skip: "Không dùng mục này",
  replace_section: "Thay toàn bộ phần này",
};

const STATUS_LABELS = {
  planned: "Đang kiểm tra",
  checklist_completed: "Đã sẵn sàng",
  cancelled: "Đã hủy",
};

const SEVERITY_LABELS = {
  blocking: "Phải chọn trước khi tiếp tục",
  warning: "Nên xem lại",
  info: "Thông tin",
};

const ACTION_LABELS = {
  create: "Thêm",
  update: "Cập nhật",
  upsert: "Cập nhật",
  replace: "Thay",
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

const USER_MESSAGE_RULES = [
  [/database backup|Restaurant Configuration Snapshot|snapshot/i, "File này chỉ lưu cài đặt nhà hàng, không lưu toàn bộ dữ liệu đang vận hành."],
  [/device id|local IP|printer/i, "Máy in có thể cần kiểm tra lại địa chỉ kết nối sau khi khôi phục."],
  [/recipe ingredient/i, "Một vài dòng công thức có thể bị bỏ qua nếu nguyên liệu liên quan không có trong file."],
  [/singleton configuration differs from target/i, "Cài đặt trong file khác với cài đặt hiện có."],
  [/same key already exists/i, "Mục này đã có trong nhà hàng nhận dữ liệu."],
  [/not imported|could not be remapped/i, "Mục liên quan không có trong file nên chưa thể nối dữ liệu."],
  [/missing/i, "Thiếu dữ liệu liên quan. Hãy kiểm tra trước khi tiếp tục."],
  [/invalid restaurantid|restaurant not found/i, "Không tìm thấy nhà hàng đã chọn."],
  [/invalid.*snapshot|invalid.*file|decode|base64/i, "File sao lưu không hợp lệ hoặc đã bị thay đổi."],
  [/permission|forbidden|not authorized|backup\./i, "Tài khoản của bạn chưa được phép thực hiện thao tác này."],
  [/network|failed to fetch|connection/i, "Không thể kết nối đến hệ thống. Hãy thử lại."],
  [/restore|import/i, "Hãy kiểm tra nội dung và xác nhận trước khi khôi phục."],
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
const sectionLabel = (key) => CONFIG_SECTIONS.find(([sectionKey]) => sectionKey === key)?.[1] || "Nội dung khác";
const modeLabel = (value) => IMPORT_MODES.find(([mode]) => mode === value)?.[1] || "Theo lựa chọn hiện tại";
const statusLabel = (status) => STATUS_LABELS[status] || "Chưa rõ trạng thái";
const severityLabel = (severity) => SEVERITY_LABELS[severity] || "Cần xem lại";
const actionLabel = (action) => ACTION_LABELS[action] || "Thay đổi";
const fieldLabel = (field) => FIELD_LABELS[field] || "Thông tin";
const hasVietnameseText = (value = "") => /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(value);

const friendlyMessage = (message = "", fallback = "Có nội dung cần kiểm tra trước khi tiếp tục.") => {
  const text = String(message || "").trim();
  const rule = USER_MESSAGE_RULES.find(([pattern]) => pattern.test(text));
  if (rule) return rule[1];
  return hasVietnameseText(text) ? text : fallback;
};

const friendlyReason = (reason = "") => friendlyMessage(reason, "Dữ liệu trong file khác với dữ liệu hiện có. Hãy chọn nội dung muốn giữ.");

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
      setStatusNotice({
        scope: "run",
        type: "success",
        text: "Đã bắt đầu lần kiểm tra mới. Hãy đánh dấu các việc đã hoàn tất rồi lưu lại.",
      });
      afterRunMutation();
    },
    onError: (error) => setStatusNotice({
      scope: "run",
      type: "error",
      text: friendlyMessage(error?.message, "Không thể bắt đầu lần kiểm tra mới. Hãy thử lại."),
    }),
  });

  const [updateBackupRun, updateRunState] = useMutation(M_UPDATE_BACKUP_RUN, {
    onCompleted: ({ updateBackupRun: updated }) => {
      const cancelled = runActionRef.current === "cancel";
      setSelectedRunId(updated?.id || "");
      setStatusNotice({
        scope: "run",
        type: "success",
        text: cancelled
          ? "Đã hủy lần kiểm tra. Cài đặt nhà hàng và các file đã tải không bị xóa."
          : "Đã lưu các việc đã kiểm tra, nội dung được chọn và ghi chú.",
      });
      afterRunMutation();
    },
    onError: (error) => setStatusNotice({
      scope: "run",
      type: "error",
      text: friendlyMessage(
        error?.message,
        runActionRef.current === "cancel"
          ? "Không thể hủy lần kiểm tra. Hãy thử lại."
          : "Không thể lưu lần kiểm tra. Hãy thử lại.",
      ),
    }),
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
  const selectedRun = runs.find((run) => run.id === selectedRunId) || runs[0] || currentLastRun || null;

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
    if (selectedRun?.id && selectedRun.id !== selectedRunId) setSelectedRunId(selectedRun.id);
  }, [selectedRun?.id, selectedRunId]);

  useEffect(() => {
    if (selectedRun) {
      setRunDraft({
        checklist: { ...FALLBACK_CHECKLIST, ...(selectedRun.checklist || {}) },
        scope: normalizeDraftScope(selectedRun.scope),
        note: selectedRun.note || "",
      });
      return;
    }
    setRunDraft({ checklist: FALLBACK_CHECKLIST, scope: FALLBACK_SCOPE, note: "" });
  }, [restaurantId, selectedRun?.id]);

  const checklistItems = useMemo(() => toChecklistItems(readiness.checklist), [readiness.checklist]);
  const scopeItems = useMemo(() => toScopeItems(readiness.scope), [readiness.scope]);
  const unresolvedRisks = useMemo(() => (readiness.risks || []).filter((risk) => !risk.resolved), [readiness.risks]);
  const completedChecklistCount = checklistItems.filter((item) => item.done).length;
  const enabledScopeCount = scopeItems.filter((item) => item.enabled).length;
  const staleReadData = Boolean((rawReadiness && !readinessMatchesScope) || rawRuns.some((run) => String(run.restaurantId || "") !== restaurantId));
  const loading = restaurantScope.restaurantsLoading
    || (canRead && hasConfirmedRestaurantScope && (readinessQuery.loading || runsQuery.loading));
  const importConflicts = importPreview?.conflicts || [];
  const importWarnings = (importPreview?.warnings || []).map((item) => friendlyMessage(item));
  const exportWarnings = (exportPreview?.warnings || []).map((item) => friendlyMessage(item));
  const resultWarnings = (importResult?.warnings || []).map((item) => friendlyMessage(item));
  const exportCount = selectedSectionCount(exportSections);
  const importCount = selectedSectionCount(importSections);
  const hasExportSections = exportCount > 0;
  const hasImportSections = importCount > 0;

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

  const updateDraftChecklist = (key, checked) => setRunDraft((prev) => ({
    ...prev,
    checklist: { ...prev.checklist, [key]: checked },
  }));

  const updateDraftScope = (key, checked) => {
    if (UNSUPPORTED_SCOPE_KEYS.has(key)) return;
    setRunDraft((prev) => ({ ...prev, scope: { ...prev.scope, [key]: checked } }));
  };

  const updateConflictResolution = (conflictId, patch) => {
    setConfirmedImport(false);
    setConflictResolutions((prev) => ({
      ...prev,
      [conflictId]: { ...(prev[conflictId] || { conflictId }), ...patch },
    }));
  };

  const applyBulkResolution = (resolution, predicate = () => true) => {
    setConfirmedImport(false);
    setConflictResolutions((prev) => {
      const next = { ...prev };
      for (const conflict of importConflicts) {
        if (!predicate(conflict) || !conflict.allowedResolutions.includes(resolution)) continue;
        next[conflict.id] = {
          ...(next[conflict.id] || { conflictId: conflict.id, renameTo: "", fieldOverridesJson: "" }),
          resolution,
        };
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
    void createBackupRun({
      variables: {
        input: {
          restaurantId,
          checklist: runDraft.checklist,
          scope: normalizeDraftScope(runDraft.scope),
          note: runDraft.note,
        },
      },
    });
  };

  const saveRun = (status) => {
    if (!selectedRun?.id || !hasConfirmedRestaurantScope || !canWrite) return;
    const isCancel = status === "cancelled";
    if (isCancel) {
      const confirmed = window.confirm(
        "Hủy lần kiểm tra đang chọn?\n\nThao tác này chỉ đóng lần kiểm tra; không xóa cài đặt nhà hàng hoặc file sao lưu đã tải.",
      );
      if (!confirmed) return;
    }
    runActionRef.current = isCancel ? "cancel" : "save";
    setStatusNotice(null);
    void updateBackupRun({
      variables: {
        input: {
          id: selectedRun.id,
          restaurantId,
          checklist: runDraft.checklist,
          scope: normalizeDraftScope(runDraft.scope),
          note: runDraft.note,
          ...(status ? { status } : {}),
        },
      },
    });
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
      const { data } = await previewExport({
        variables: { input: { restaurantId, sections: selectedSectionsPayload(exportSections) } },
      });
      setExportPreview(data?.restaurantConfigBackupPreview || null);
    } catch (error) {
      setStatusNotice({
        type: "error",
        text: friendlyMessage(error?.message, "Không thể kiểm tra nội dung file sao lưu. Hãy thử lại."),
      });
    }
  };

  const handleDownloadExport = async () => {
    if (!restaurantId || !hasExportSections || !canExport) return;
    setStatusNotice(null);
    try {
      const { data } = await exportBackup({
        variables: { input: { restaurantId, sections: selectedSectionsPayload(exportSections) } },
      });
      const file = data?.exportRestaurantConfigBackup;
      if (!file?.contentBase64) throw new Error("Máy chủ không trả về nội dung file");
      const blob = base64ToBlob(file.contentBase64, file.mimeType);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.fileName || "sao-luu-cai-dat-nha-hang.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatusNotice({ type: "success", text: `Đã tải file ${file.fileName || "sao lưu"}.` });
    } catch (error) {
      setStatusNotice({
        type: "error",
        text: friendlyMessage(error?.message, "Không thể tải file sao lưu. Hãy thử lại."),
      });
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
      setStatusNotice({
        type: "error",
        text: "File không đúng định dạng sao lưu. Hãy chọn file được tải từ trang này.",
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setStatusNotice({ type: "error", text: "File sao lưu quá lớn. Kích thước tối đa là 10 MB." });
      return;
    }
    try {
      const content = await readFileAsBase64(file);
      setSelectedFile(file);
      setFileContentBase64(content);
    } catch (error) {
      setStatusNotice({
        type: "error",
        text: friendlyMessage(error?.message, "Không đọc được file sao lưu. Hãy chọn lại file."),
      });
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
        {
          conflictId: conflict.id,
          resolution: conflict.defaultResolution,
          renameTo: "",
          fieldOverridesJson: "",
        },
      ])));
    } catch (error) {
      setImportPreview(null);
      setStatusNotice({
        type: "error",
        text: friendlyMessage(error?.message, "Không thể kiểm tra file trước khi khôi phục. Hãy thử lại."),
      });
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
        text: result?.success
          ? "Đã khôi phục cài đặt vào nhà hàng đã chọn."
          : "Chưa thể khôi phục. Hãy xem phần kết quả bên dưới.",
      });
    } catch (error) {
      setStatusNotice({
        type: "error",
        text: friendlyMessage(error?.message, "Không thể khôi phục cài đặt. Hãy thử lại."),
      });
    }
  };

  const pageWarning = !canRead
    ? "Tài khoản của bạn chưa được phép xem thông tin sao lưu và các lần đã thực hiện."
    : !hasConfirmedRestaurantScope && !restaurantScope.restaurantsLoading
      ? "Chọn một chi nhánh ở thanh quản trị phía trên để bắt đầu."
      : readinessQuery.error || runsQuery.error
        ? "Không tải được thông tin sao lưu mới nhất. Hãy kiểm tra kết nối hoặc quyền truy cập."
        : staleReadData
          ? "Thông tin nhận được không thuộc chi nhánh đang chọn nên chưa được hiển thị. Hãy tải lại trang."
          : "";

  const headerStats = [
    { label: "Mức sẵn sàng", value: readiness.ready ? "Sẵn sàng" : "Cần xem lại", icon: <ShieldCheck size={17} />, tone: readiness.ready ? "success" : "warning" },
    { label: "Việc đã kiểm tra", value: `${completedChecklistCount}/${checklistItems.length}`, icon: <CheckCircle2 size={17} /> },
    { label: "Nội dung đã chọn", value: `${enabledScopeCount}/${scopeItems.length}`, icon: <FileText size={17} /> },
    { label: "Số lần đã lưu", value: runs.length, icon: <History size={17} /> },
  ];

  return (
    <div className="backup-management" aria-busy={loading}>
      <ManagementPageHeader
        eyebrow="Sao lưu và khôi phục"
        title="Sao lưu cài đặt nhà hàng"
        subtitle="Lưu một bản các cài đặt quan trọng, kiểm tra trước khi khôi phục và theo dõi người thực hiện."
        icon={<Archive size={18} />}
        stats={headerStats}
        loading={loading}
        density="compact"
        showTimeWidget={false}
        customControls={(
          <div className="backup-management__badges" aria-label="Thông tin về file sao lưu">
            <span><Building2 size={14} />{selectedRestaurant ? restaurantOptionName(selectedRestaurant) : "Chưa chọn chi nhánh"}</span>
            <span><LockKeyhole size={14} />Không lưu mật khẩu hoặc khóa thanh toán</span>
          </div>
        )}
      />

      {pageWarning ? <section className="backup-management__alert is-warning" role="status"><AlertTriangle size={18} />{pageWarning}</section> : null}
      {statusNotice && statusNotice.scope !== "run" ? <section className={`backup-management__alert is-${statusNotice.type}`} role={statusNotice.type === "error" ? "alert" : "status"}>{statusNotice.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}{statusNotice.text}</section> : null}
      {loading ? <section className="backup-management__state" role="status"><RefreshCw className="is-spinning" size={20} /><div><strong>Đang tải thông tin sao lưu</strong><p>Hệ thống đang lấy các việc cần kiểm tra và các lần đã thực hiện của chi nhánh đang chọn.</p></div></section> : null}

      <section className="backup-management__run-workflow" aria-label="Kiểm tra trước khi sao lưu">
        <div className="backup-management__run-editor">
          <div className="backup-management__section-head">
            <div>
              <span>01 · Chuẩn bị</span>
              <h2>Kiểm tra trước khi sao lưu</h2>
              <p>Đánh dấu các việc đã hoàn tất, chọn nội dung cần lưu và thêm ghi chú cho lần sao lưu này.</p>
            </div>
            <div className="backup-management__run-action-block">
              <div className="backup-management__run-actions">
                <button type="button" className="is-primary" onClick={createRun} disabled={!hasConfirmedRestaurantScope || !canWrite || createRunState.loading} title={!canWrite ? "Tài khoản chưa được phép tạo lần kiểm tra" : "Tạo một lần kiểm tra mới"}>
                  <ShieldCheck size={16} />{createRunState.loading ? "Đang bắt đầu..." : "Bắt đầu lần kiểm tra mới"}
                </button>
                <button type="button" onClick={() => saveRun()} disabled={!selectedRun?.id || !canWrite || updateRunState.loading} title={!canWrite ? "Tài khoản chưa được phép lưu thay đổi" : "Lưu các việc đã kiểm tra, nội dung được chọn và ghi chú"}>
                  <Save size={16} />{updateRunState.loading && runActionRef.current === "save" ? "Đang lưu..." : "Lưu lần đang kiểm tra"}
                </button>
                <button type="button" className="is-danger" onClick={() => saveRun("cancelled")} disabled={!selectedRun?.id || !canWrite || updateRunState.loading} title="Đóng lần kiểm tra đang chọn">
                  <XCircle size={16} />{updateRunState.loading && runActionRef.current === "cancel" ? "Đang hủy..." : "Hủy lần kiểm tra"}
                </button>
              </div>
              <p className="backup-management__run-action-help">Bắt đầu để tạo lần kiểm tra mới; Lưu để cập nhật lần đang xem; Hủy chỉ đóng lần kiểm tra, không xóa cài đặt hoặc file sao lưu.</p>
              {statusNotice?.scope === "run" ? (
                <div className={`backup-management__run-feedback is-${statusNotice.type}`} role={statusNotice.type === "error" ? "alert" : "status"} aria-live="polite">
                  {statusNotice.type === "success" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                  <span>{statusNotice.text}</span>
                </div>
              ) : null}
            </div>
          </div>
          {!canWrite ? <p className="backup-management__permission-note">Bạn chỉ có thể xem. Hãy nhờ quản trị viên cấp quyền tạo và cập nhật lần kiểm tra.</p> : null}
          <div className="backup-management__check-scope-grid">
            <fieldset>
              <legend>Việc cần hoàn tất</legend>
              {Object.entries(CHECKLIST_LABELS).map(([key, label]) => (
                <label key={key}>
                  <input type="checkbox" checked={Boolean(runDraft.checklist[key])} disabled={!canWrite} onChange={(event) => updateDraftChecklist(key, event.target.checked)} />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Nội dung sẽ được lưu</legend>
              {Object.entries(SCOPE_LABELS).map(([key, label]) => {
                const unsupported = UNSUPPORTED_SCOPE_KEYS.has(key);
                return (
                  <label key={key} className={unsupported ? "is-disabled" : ""}>
                    <input type="checkbox" checked={Boolean(runDraft.scope[key])} disabled={!canWrite || unsupported} onChange={(event) => updateDraftScope(key, event.target.checked)} />
                    <span>{label}{unsupported ? <small>Không có trong bản sao lưu</small> : null}</span>
                  </label>
                );
              })}
            </fieldset>
          </div>
          <label className="backup-management__run-note">Ghi chú
            <textarea value={runDraft.note} maxLength={1000} disabled={!canWrite} onChange={(event) => setRunDraft((prev) => ({ ...prev, note: event.target.value }))} placeholder="Ví dụ: nơi lưu file, ca đã kiểm tra, người thực hiện..." />
            <small>{runDraft.note.length}/1000 ký tự</small>
          </label>
        </div>

        <aside className="backup-management__run-detail">
          <div className="backup-management__section-head">
            <div><span>Lần kiểm tra đang xem</span><h3>{selectedRun ? statusLabel(selectedRun.status) : "Chưa có thông tin"}</h3></div>
          </div>
          {selectedRun ? (
            <dl>
              <div><dt>Bắt đầu lúc</dt><dd>{formatDate(selectedRun.createdAt)}</dd></div>
              <div><dt>Hoàn tất lúc</dt><dd>{selectedRun.completedAt ? formatDate(selectedRun.completedAt) : "Chưa hoàn tất"}</dd></div>
              <div><dt>Cập nhật lúc</dt><dd>{formatDate(selectedRun.updatedAt)}</dd></div>
              <div><dt>Ghi chú</dt><dd>{selectedRun.note || "Chưa có"}</dd></div>
            </dl>
          ) : <div className="backup-management__empty">Chưa có lần kiểm tra. Hãy bắt đầu một lần mới để ghi lại các việc đã làm.</div>}
          {runs.length ? <label>Các lần gần đây<select value={selectedRun?.id || ""} onChange={(event) => setSelectedRunId(event.target.value)}>{runs.map((run) => <option key={run.id} value={run.id}>{statusLabel(run.status)} · {formatDate(run.createdAt)}</option>)}</select></label> : null}
          <p className="backup-management__run-hint">File này chỉ lưu cài đặt nhà hàng. Đơn hàng, thanh toán và dữ liệu đang vận hành không được lưu.</p>
        </aside>
      </section>

      <section className="backup-management__flow" aria-label="Tạo và khôi phục file sao lưu">
        <section className="backup-management__config-panel backup-management__config-panel--export" aria-label="Tạo file sao lưu">
          <div className="backup-management__section-head">
            <div><span>02 · Sao lưu</span><h2>Tạo file sao lưu</h2><p>Dữ liệu được lấy từ chi nhánh đang chọn: <strong>{selectedRestaurant ? restaurantOptionName(selectedRestaurant) : "chưa chọn"}</strong>.</p></div>
            <Download size={22} aria-hidden="true" />
          </div>
          {!canExport ? <p className="backup-management__permission-note">Tài khoản của bạn chưa được phép tải file sao lưu.</p> : null}
          <div className="backup-management__section-toolbar"><strong>{exportCount}/{CONFIG_SECTIONS.length} nội dung</strong><button type="button" onClick={() => setAllExportSections(exportCount !== CONFIG_SECTIONS.length)}>{exportCount === CONFIG_SECTIONS.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}</button></div>
          <div className="backup-management__section-list">
            {CONFIG_SECTIONS.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(exportSections[key])} onChange={() => toggleExportSection(key)} /><span>{label}</span></label>)}
          </div>
          {!hasExportSections ? <p className="backup-management__field-error">Chọn ít nhất một nội dung để tạo file.</p> : null}
          <div className="backup-management__actions">
            <button type="button" onClick={handlePreviewExport} disabled={!hasConfirmedRestaurantScope || !hasExportSections || !canRead || previewExportState.loading} title={!canRead ? "Tài khoản chưa được phép xem trước" : "Kiểm tra số lượng dữ liệu sẽ được lưu"}>
              <FileText size={16} />{previewExportState.loading ? "Đang kiểm tra..." : "Kiểm tra nội dung file"}
            </button>
            <button type="button" className="is-primary" onClick={handleDownloadExport} disabled={!hasConfirmedRestaurantScope || !hasExportSections || !canExport || exportBackupState.loading} title={!canExport ? "Tài khoản chưa được phép tải file" : "Tải file sao lưu về máy"}>
              <Download size={16} />{exportBackupState.loading ? "Đang tạo file..." : "Tải file sao lưu"}
            </button>
          </div>
          {exportPreview ? <div className="backup-management__result"><h3>File đã sẵn sàng</h3><p><strong>{exportPreview.fileName}</strong></p><ul>{exportPreview.counts.map((item) => <li key={item.key}><span>{sectionLabel(item.key)}</span><strong>{item.enabled ? `${item.count} mục` : "Không chọn"}</strong></li>)}</ul>{exportWarnings.map((item) => <p key={item}>{item}</p>)}</div> : null}
        </section>

        <section className="backup-management__config-panel backup-management__config-panel--import" aria-label="Khôi phục cài đặt">
          <div className="backup-management__section-head">
            <div><span>03 · Khôi phục</span><h2>Khôi phục cài đặt</h2><p>Chọn file sao lưu, kiểm tra nhà hàng nhận dữ liệu, xem phần bị trùng rồi xác nhận.</p></div>
            <Upload size={22} aria-hidden="true" />
          </div>
          {!canImport ? <p className="backup-management__permission-note">Tài khoản của bạn chưa được phép kiểm tra hoặc khôi phục từ file.</p> : null}
          <ol className="backup-management__wizard" aria-label="Các bước khôi phục">
            <li className={selectedFile ? "is-done" : ""}><span>1</span>Chọn file</li>
            <li className={importPreview ? "is-done" : ""}><span>2</span>Kiểm tra nội dung</li>
            <li className={importPreview && !invalidConflictResolution ? "is-done" : ""}><span>3</span>Xử lý dữ liệu trùng</li>
            <li className={confirmedImport ? "is-done" : ""}><span>4</span>Xác nhận</li>
          </ol>
          <label className="backup-management__file-input">File sao lưu
            <input type="file" accept=".json,application/json" disabled={!canImport} onChange={handleFileChange} />
            <span><Upload size={16} />{selectedFile ? selectedFile.name : "Chọn file sao lưu tối đa 10 MB"}</span>
          </label>
          <div className="backup-management__import-options">
            <label>Nhà hàng nhận dữ liệu
              <select value={targetRestaurantId} disabled={!canImport} onChange={(event) => { setTargetRestaurantId(event.target.value); resetImportReview(); }}>
                {restaurants.map((restaurant) => <option key={restaurantOptionId(restaurant)} value={restaurantOptionId(restaurant)}>{restaurantOptionName(restaurant)}</option>)}
              </select>
            </label>
            <label>Cách khôi phục
              <select value={importMode} disabled={!canImport} onChange={(event) => { setImportMode(event.target.value); resetImportReview(); }}>
                {IMPORT_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <div className="backup-management__section-toolbar"><strong>{importCount}/{CONFIG_SECTIONS.length} nội dung</strong><button type="button" onClick={() => setAllImportSections(importCount !== CONFIG_SECTIONS.length)}>{importCount === CONFIG_SECTIONS.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}</button></div>
          <div className="backup-management__section-list">
            {CONFIG_SECTIONS.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(importSections[key])} disabled={!canImport} onChange={() => toggleImportSection(key)} /><span>{label}</span></label>)}
          </div>
          {!hasImportSections ? <p className="backup-management__field-error">Chọn ít nhất một nội dung để kiểm tra.</p> : null}
          <div className="backup-management__actions">
            <button type="button" onClick={handlePreviewImport} disabled={!fileContentBase64 || !targetRestaurantId || !hasImportSections || !canImport || previewImportState.loading}>
              <FileText size={16} />{previewImportState.loading ? "Đang kiểm tra..." : "Kiểm tra trước khi khôi phục"}
            </button>
            <button type="button" className="is-primary" onClick={handleImport} disabled={!importCanRun || importBackupState.loading}>
              <Upload size={16} />{importBackupState.loading ? "Đang khôi phục..." : "Khôi phục cài đặt"}
            </button>
          </div>

          {importPreview ? (
            <div className={`backup-management__result ${importPreviewReady ? "is-ready" : "is-blocked"}`}>
              <h3>{importPreviewReady ? "Sẵn sàng khôi phục" : "Cần xem lại trước khi khôi phục"}</h3>
              <p>File được tạo từ: <strong>{importPreview.sourceRestaurantName || "-"}</strong> · {modeLabel(importPreview.mode)}</p>
              <ul>{importPreview.changes.map((item) => <li key={`${item.section}-${item.action}`}><span>{sectionLabel(item.section)}</span><strong>{actionLabel(item.action)} {item.count} mục</strong></li>)}</ul>
              {importWarnings.map((item) => <p key={item}>{item}</p>)}
              {(importPreview.errors || []).map((item, index) => <p key={`${index}-${item}`} className="backup-management__error">{friendlyMessage(item, "File sao lưu có lỗi. Hãy kiểm tra lại file.")}</p>)}
            </div>
          ) : null}

          {importConflicts.length ? (
            <section className="backup-management__conflicts" aria-label="Xử lý dữ liệu bị trùng">
              <div className="backup-management__section-head"><div><span>Dữ liệu bị trùng</span><h3>Chọn nội dung muốn giữ</h3><p>Chọn dữ liệu muốn giữ cho từng mục. Hệ thống sẽ lưu lại lựa chọn này trong lịch sử.</p></div></div>
              <div className="backup-management__conflict-summary">
                <article><strong>{conflictStats.total}</strong><span>Tổng mục</span></article>
                <article><strong>{conflictStats.blocking}</strong><span>Phải chọn</span></article>
                <article><strong>{conflictStats.warning}</strong><span>Nên xem lại</span></article>
                <article><strong>{conflictStats.keepTarget}</strong><span>Giữ hiện có</span></article>
                <article><strong>{conflictStats.useSource}</strong><span>Dùng trong file</span></article>
                <article><strong>{conflictStats.merge}</strong><span>Kết hợp</span></article>
              </div>
              <div className="backup-management__conflict-filters">
                <select aria-label="Lọc theo nội dung" value={conflictFilter.section} onChange={(event) => setConflictFilter((prev) => ({ ...prev, section: event.target.value }))}>
                  <option value="all">Tất cả nội dung</option>
                  {[...new Set(importConflicts.map((conflict) => conflict.section))].map((section) => <option key={section} value={section}>{sectionLabel(section)}</option>)}
                </select>
                <select aria-label="Lọc theo mức cần xem" value={conflictFilter.severity} onChange={(event) => setConflictFilter((prev) => ({ ...prev, severity: event.target.value }))}>
                  <option value="all">Tất cả mức</option><option value="blocking">Phải chọn trước khi tiếp tục</option><option value="warning">Nên xem lại</option><option value="info">Thông tin</option>
                </select>
                <select aria-label="Lọc theo cách xử lý" value={conflictFilter.resolution} onChange={(event) => setConflictFilter((prev) => ({ ...prev, resolution: event.target.value }))}>
                  <option value="all">Tất cả cách xử lý</option>{Object.keys(RESOLUTION_LABELS).map((key) => <option key={key} value={key}>{RESOLUTION_LABELS[key]}</option>)}
                </select>
                <input aria-label="Tìm mục bị trùng" value={conflictFilter.search} onChange={(event) => setConflictFilter((prev) => ({ ...prev, search: event.target.value }))} placeholder="Tìm theo tên hoặc mã" />
              </div>
              <div className="backup-management__actions is-wrap">
                <button type="button" onClick={() => { setConfirmedImport(false); setConflictResolutions(Object.fromEntries(importConflicts.map((conflict) => [conflict.id, { conflictId: conflict.id, resolution: conflict.defaultResolution, renameTo: "", fieldOverridesJson: "" }]))); }}>Dùng lựa chọn gợi ý</button>
                <button type="button" onClick={() => applyBulkResolution("keep_target")}>Giữ dữ liệu hiện có</button>
                <button type="button" onClick={() => applyBulkResolution("use_source")}>Dùng dữ liệu trong file</button>
                <button type="button" onClick={() => applyBulkResolution("merge", (conflict) => conflict.severity !== "blocking")}>Kết hợp mục phù hợp</button>
              </div>
              {invalidConflictResolution ? <p className="backup-management__error">Hãy chọn cách xử lý cho các mục bắt buộc trước khi tiếp tục.</p> : null}
              <div className="backup-management__conflict-list">
                {filteredConflicts.map((conflict) => {
                  const current = conflictResolutions[conflict.id] || { conflictId: conflict.id, resolution: conflict.defaultResolution, renameTo: "" };
                  const displayName = conflict.label || sectionLabel(conflict.section);
                  return (
                    <article key={conflict.id}>
                      <header><strong>{sectionLabel(conflict.section)} · {displayName}</strong><span className={`backup-management__severity is-${conflict.severity}`}>{severityLabel(conflict.severity)}</span></header>
                      <p>{friendlyReason(conflict.reason)}</p>
                      <label>Cách xử lý
                        <select aria-label={`Cách xử lý cho ${displayName}`} value={current.resolution} onChange={(event) => updateConflictResolution(conflict.id, { resolution: event.target.value })}>
                          {conflict.allowedResolutions.map((resolution) => <option key={resolution} value={resolution}>{RESOLUTION_LABELS[resolution] || "Cách xử lý khác"}</option>)}
                        </select>
                      </label>
                      {current.resolution === "rename_source" ? <label>Tên mới<input aria-label={`Tên mới cho ${displayName}`} value={current.renameTo || ""} onChange={(event) => updateConflictResolution(conflict.id, { renameTo: event.target.value })} /></label> : null}
                      <details><summary>Xem điểm khác nhau</summary><ul>{conflict.fieldDiffs.map((diff) => <li key={`${conflict.id}-${diff.field}`}>{fieldLabel(diff.field)}: trong file {diff.sourceValuePreview || "-"} · hiện có {diff.targetValuePreview || "-"}</li>)}</ul></details>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {importPreviewReady ? <label className="backup-management__confirm"><input type="checkbox" checked={confirmedImport} onChange={(event) => setConfirmedImport(event.target.checked)} /><span>Tôi đã kiểm tra đúng nhà hàng, nội dung và cách xử lý; đồng ý khôi phục.</span></label> : null}
          {importResult ? (
            <div className={`backup-management__result ${importResult.success ? "is-ready" : "is-blocked"}`}>
              <h3>{importResult.success ? "Khôi phục thành công" : "Khôi phục chưa thành công"}</h3>
              <p>Mã lần khôi phục: <strong>{importResult.backupRun?.id || "-"}</strong></p>
              {(importResult.appliedResolutions || []).length ? <p>Đã xử lý: {(importResult.appliedResolutions || []).map((item) => `${RESOLUTION_LABELS[item.resolution] || "Cách khác"}${item.renameTo ? ` → ${item.renameTo}` : ""}`).join(", ")}</p> : null}
              {resultWarnings.map((item) => <p key={`import-warning-${item}`}>{item}</p>)}
              {(importResult.errors || []).map((item, index) => <p key={`import-error-${index}-${item}`} className="backup-management__error">{friendlyMessage(item, "Không thể hoàn tất việc khôi phục. Hãy thử lại.")}</p>)}
            </div>
          ) : null}
        </section>
      </section>

      <section className="backup-management__secondary" aria-label="Thông tin bổ sung về sao lưu">
        <details>
          <summary><span><FileText size={17} />Nội dung đang theo dõi</span><strong>{enabledScopeCount}/{scopeItems.length}</strong></summary>
          <div className="backup-management__detail-grid">{scopeItems.map((item) => <article key={item.key}><h3>{item.label}</h3><p>{item.enabled ? "Được bao gồm" : "Không bao gồm"}</p></article>)}</div>
        </details>
        <details>
          <summary><span><AlertTriangle size={17} />Việc cần hoàn tất</span><strong>{unresolvedRisks.length}</strong></summary>
          <div className="backup-management__detail-grid">{(readiness.risks || []).length ? readiness.risks.map((risk) => <article key={risk.key} className={risk.resolved ? "is-resolved" : ""}><h3>{CHECKLIST_LABELS[risk.key] || friendlyMessage(risk.label, "Việc cần kiểm tra")}</h3><p>{risk.resolved ? "Đã hoàn tất" : "Cần hoàn tất trước khi sao lưu."}</p></article>) : <p className="backup-management__empty">Chưa có việc nào cần kiểm tra.</p>}</div>
        </details>
        <details>
          <summary><span><History size={17} />5 lần gần nhất</span><strong>{runs.length}</strong></summary>
          <ol className="backup-management__timeline">{runs.length ? runs.map((run) => {
            const doneCount = toChecklistItems(run.checklist).filter((item) => item.done).length;
            const scopeCount = toScopeItems(run.scope).filter((item) => item.enabled).length;
            return <li key={run.id}><div><h3>{statusLabel(run.status)}</h3><time>{formatDate(run.createdAt)}</time><p>Đã kiểm tra {doneCount}/{checklistItems.length} · Đã chọn {scopeCount}/{scopeItems.length}</p>{run.note ? <p>{run.note}</p> : null}</div></li>;
          }) : <li><div><p>Chưa có lần sao lưu nào.</p></div></li>}</ol>
        </details>
      </section>
    </div>
  );
};

export default BackupManagement;
