import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "../../../context/AuthContext";
import "./BackupManagement.scss";
import ManagementPageHeader from "../shared/ManagementPageHeader";

const Q_BACKUP_READINESS = gql`
  query BackupReadiness($restaurantId: ID!) {
    backupReadiness(restaurantId: $restaurantId) {
      restaurantId
      ready
      risks { key label severity resolved description }
      checklist { reportsChecked transactionsReconciled settingsReviewed exportPrepared safeCopyStored operatorRecorded }
      scope { ordersAndPayments tablesAndFloorPlan menuAndPricing inventory staffAndPermissions schedules customersAndPromotions reportsAndReconciliation }
      lastRun { id status note completedAt createdAt updatedAt }
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
  ordersAndPayments: true,
  tablesAndFloorPlan: true,
  menuAndPricing: true,
  inventory: true,
  staffAndPermissions: true,
  schedules: true,
  customersAndPromotions: true,
  reportsAndReconciliation: true,
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
const allSections = () => Object.fromEntries(CONFIG_SECTIONS.map(([key]) => [key, true]));
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
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState("");
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
  const [statusMessage, setStatusMessage] = useState("");
  const [conflictResolutions, setConflictResolutions] = useState({});
  const [conflictFilter, setConflictFilter] = useState({ section: "all", severity: "all", resolution: "all", search: "" });

  useEffect(() => {
    const firstId = restaurantOptionId(restaurants[0]);
    if (!restaurantId && firstId) setRestaurantId(firstId);
    if (!targetRestaurantId && firstId) setTargetRestaurantId(firstId);
  }, [restaurantId, targetRestaurantId, restaurants]);

  const readinessQuery = useQuery(Q_BACKUP_READINESS, { variables: { restaurantId }, skip: !restaurantId, fetchPolicy: "network-only" });
  const runsQuery = useQuery(Q_BACKUP_RUNS, { variables: { restaurantId, limit: 5, offset: 0 }, skip: !restaurantId, fetchPolicy: "network-only" });
  const [previewExport, previewExportState] = useLazyQuery(Q_CONFIG_BACKUP_PREVIEW, { fetchPolicy: "network-only", onError: (error) => setStatusMessage(`Không thể xem trước file sao lưu: ${error.message}`) });
  const [exportBackup, exportBackupState] = useMutation(M_EXPORT_CONFIG_BACKUP, { onError: (error) => setStatusMessage(`Không tải được file sao lưu: ${error.message}`) });
  const [previewImport, previewImportState] = useMutation(M_PREVIEW_CONFIG_IMPORT, { onError: (error) => setStatusMessage(`Không thể xem trước khôi phục: ${error.message}`) });

  const afterRunMutation = () => {
    readinessQuery.refetch?.();
    runsQuery.refetch?.();
  };

  const [createBackupRun, createRunState] = useMutation(M_CREATE_BACKUP_RUN, {
    onCompleted: ({ createBackupRun: created }) => {
      setSelectedRunId(created?.id || "");
      setStatusMessage("Đã tạo lần chuẩn bị sao lưu.");
      afterRunMutation();
    },
    onError: (error) => setStatusMessage(`Không tạo được lần chuẩn bị sao lưu: ${error.message}`),
  });
  const [updateBackupRun, updateRunState] = useMutation(M_UPDATE_BACKUP_RUN, {
    onCompleted: ({ updateBackupRun: updated }) => {
      setSelectedRunId(updated?.id || "");
      setStatusMessage("Đã lưu checklist an toàn.");
      afterRunMutation();
    },
    onError: (error) => setStatusMessage(`Không lưu được checklist an toàn: ${error.message}`),
  });
  const [importBackup, importBackupState] = useMutation(M_IMPORT_CONFIG_BACKUP, {
    onError: (error) => setStatusMessage(`Khôi phục thất bại: ${error.message}`),
    onCompleted: () => afterRunMutation(),
  });

  const readiness = readinessQuery.data?.backupReadiness || FALLBACK_READINESS;
  const runs = Array.isArray(runsQuery.data?.backupRuns) ? runsQuery.data.backupRuns : [];
  const selectedRun = runs.find((run) => run.id === selectedRunId) || runs[0] || readiness.lastRun || null;

  useEffect(() => {
    if (!selectedRunId && selectedRun?.id) setSelectedRunId(selectedRun.id);
  }, [selectedRunId, selectedRun?.id]);

  useEffect(() => {
    if (selectedRun) {
      setRunDraft({ checklist: { ...FALLBACK_CHECKLIST, ...(selectedRun.checklist || {}) }, scope: { ...FALLBACK_SCOPE, ...(selectedRun.scope || {}) }, note: selectedRun.note || "" });
    } else {
      setRunDraft((prev) => ({ checklist: { ...FALLBACK_CHECKLIST, ...prev.checklist }, scope: { ...FALLBACK_SCOPE, ...prev.scope }, note: prev.note || "" }));
    }
  }, [selectedRun?.id]);

  const checklistItems = useMemo(() => toChecklistItems(readiness.checklist), [readiness.checklist]);
  const scopeItems = useMemo(() => toScopeItems(readiness.scope), [readiness.scope]);
  const unresolvedRisks = useMemo(() => (readiness.risks || []).filter((risk) => !risk.resolved), [readiness.risks]);
  const completedChecklistCount = checklistItems.filter((item) => item.done).length;
  const enabledScopeCount = scopeItems.filter((item) => item.enabled).length;
  const lastRunDate = readiness.lastRun?.completedAt || readiness.lastRun?.updatedAt || readiness.lastRun?.createdAt;
  const loading = readinessQuery.loading || runsQuery.loading;
  const importConflicts = importPreview?.conflicts || [];
  const importWarnings = (importPreview?.warnings || []).map(friendlyWarning);
  const exportWarnings = (exportPreview?.warnings || []).map(friendlyWarning);
  const resultWarnings = (importResult?.warnings || []).map(friendlyWarning);
  const warning = !restaurantId ? "Chọn nhà hàng để xem trạng thái sao lưu." : readinessQuery.error || runsQuery.error ? "Không đọc được trạng thái sao lưu, đang hiển thị checklist khuyến nghị." : "";

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
    return !conflict.allowedResolutions.includes(current.resolution) || (current.resolution === "rename_source" && !current.renameTo?.trim()) || (conflict.severity === "blocking" && current.resolution === "skip");
  });

  const statusText = statusMessage.toLowerCase();
  const statusType = statusText.includes("thất bại") || statusText.includes("lỗi") || statusText.includes("không") ? "error" : statusText.includes("mã kiểm tra") || statusText.includes("đã") ? "success" : "warning";
  const importCanRun = Boolean(importPreview?.valid && !(importPreview?.errors || []).length && confirmedImport && fileContentBase64 && !invalidConflictResolution);

  const toggleSection = (setter, key) => setter((prev) => ({ ...prev, [key]: !prev[key] }));
  const updateDraftChecklist = (key, checked) => setRunDraft((prev) => ({ ...prev, checklist: { ...prev.checklist, [key]: checked } }));
  const updateDraftScope = (key, checked) => setRunDraft((prev) => ({ ...prev, scope: { ...prev.scope, [key]: checked } }));
  const updateConflictResolution = (conflictId, patch) => setConflictResolutions((prev) => ({ ...prev, [conflictId]: { ...(prev[conflictId] || { conflictId }), ...patch } }));

  const applyBulkResolution = (resolution, predicate = () => true) => setConflictResolutions((prev) => {
    const next = { ...prev };
    for (const conflict of importConflicts) {
      if (!predicate(conflict) || !conflict.allowedResolutions.includes(resolution)) continue;
      next[conflict.id] = { ...(next[conflict.id] || { conflictId: conflict.id, renameTo: "", fieldOverridesJson: "" }), resolution };
    }
    return next;
  });

  const importInput = (dryRun = true) => ({
    targetRestaurantId,
    fileContentBase64,
    mode: importMode,
    sections: selectedSectionsPayload(importSections),
    dryRun,
    replaceExisting: importMode === "replace" ? confirmedImport : false,
    conflictResolutions: Object.values(conflictResolutions),
  });

  const createRun = () => createBackupRun({ variables: { input: { restaurantId, checklist: runDraft.checklist, scope: runDraft.scope, note: runDraft.note } } });
  const saveRun = (status) => {
    if (!selectedRun?.id) return;
    updateBackupRun({ variables: { input: { id: selectedRun.id, restaurantId, checklist: runDraft.checklist, scope: runDraft.scope, note: runDraft.note, ...(status ? { status } : {}) } } });
  };

  const handlePreviewExport = async () => {
    setStatusMessage("");
    const { data } = await previewExport({ variables: { input: { restaurantId, sections: selectedSectionsPayload(exportSections) } } });
    setExportPreview(data?.restaurantConfigBackupPreview || null);
  };

  const handleDownloadExport = async () => {
    setStatusMessage("");
    const { data } = await exportBackup({ variables: { input: { restaurantId, sections: selectedSectionsPayload(exportSections) } } });
    const file = data?.exportRestaurantConfigBackup;
    if (!file?.contentBase64) return;
    const blob = base64ToBlob(file.contentBase64, file.mimeType);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.fileName || "sao-luu-cau-hinh-nha-hang.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatusMessage(`Đã tạo file ${file.fileName}. Mã kiểm tra: ${file.checksum}`);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    setImportPreview(null);
    setImportResult(null);
    setConfirmedImport(false);
    setConflictResolutions({});
    setSelectedFile(file || null);
    setFileContentBase64("");
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setStatusMessage("File sao lưu quá lớn, giới hạn là 10MB.");
      return;
    }
    setFileContentBase64(await readFileAsBase64(file));
  };

  const handlePreviewImport = async () => {
    setStatusMessage("");
    const { data } = await previewImport({ variables: { input: importInput(true) } });
    const preview = data?.previewRestaurantConfigImport || null;
    setImportPreview(preview);
    setConflictResolutions(Object.fromEntries((preview?.conflicts || []).map((conflict) => [conflict.id, { conflictId: conflict.id, resolution: conflict.defaultResolution, renameTo: "", fieldOverridesJson: "" }])));
  };

  const handleImport = async () => {
    setStatusMessage("");
    const { data } = await importBackup({ variables: { input: importInput(false) } });
    setImportResult(data?.importRestaurantConfigBackup || null);
  };

  const summaryItems = [
    { title: "An toàn", value: readiness.ready ? "Sẵn sàng" : "Cần rà soát", description: readiness.ready ? "Có thể tạo file sau khi kiểm tra lần cuối." : `${unresolvedRisks.length} mục cần hoàn tất trước khi chốt.` },
    { title: "Checklist", value: `${completedChecklistCount}/${checklistItems.length}`, description: "Bước xác nhận trước khi tạo bản sao." },
    { title: "Phạm vi", value: `${enabledScopeCount}/${scopeItems.length}`, description: "Hạng mục đang nằm trong kế hoạch sao lưu." },
    { title: "Gần nhất", value: lastRunDate ? formatDate(lastRunDate) : "Chưa có", description: "Lần chuẩn bị sao lưu gần nhất." },
  ];

  return (
    <div className="backup-management backup-management--final">
      <ManagementPageHeader
        eyebrow="Sao lưu & khôi phục"
        title="Sao lưu cấu hình nhà hàng"
        subtitle="Lưu lại các cài đặt quan trọng, xem trước thay đổi và khôi phục có kiểm soát. File này không thay thế bản sao toàn bộ dữ liệu vận hành."
        icon="🗄️"
        stats={[{ label: "Checklist", value: `${completedChecklistCount}/${checklistItems.length}`, icon: "✅" }, { label: "Lần gần nhất", value: runs.length, icon: "🧾" }]}
        customControls={(
          <div className="backup-management__badges" aria-label="Thiết lập sao lưu">
            <label>Nhà hàng
              <select value={restaurantId} onChange={(event) => setRestaurantId(event.target.value)}>
                {restaurants.map((restaurant) => <option key={restaurantOptionId(restaurant)} value={restaurantOptionId(restaurant)}>{restaurantOptionName(restaurant)}</option>)}
              </select>
            </label>
            <span>Xem trước trước khi áp dụng</span>
            <span>Không chứa mật khẩu hoặc khóa thanh toán</span>
          </div>
        )}
        showTimeWidget={false}
      />

      <section className="backup-management__hero" aria-label="Giới thiệu sao lưu cấu hình">
        <div>
          <span>Bản sao an toàn</span>
          <h2>Lưu cấu hình trước khi thay đổi lớn</h2>
          <p>Trang này giúp quản lý tạo file sao lưu cho cài đặt, menu, sơ đồ bàn, quy tắc xếp ca, khuyến mãi và các dữ liệu cấu hình. Khi khôi phục, hệ thống luôn yêu cầu xem trước và xác nhận.</p>
        </div>
        <aside>
          <strong>{readiness.ready ? "Sẵn sàng" : "Cần kiểm tra"}</strong>
          <small>{readiness.ready ? "Checklist đã đủ điều kiện." : "Hoàn tất checklist để giảm rủi ro khi sao lưu."}</small>
        </aside>
      </section>

      <section className="backup-management__summary" aria-label="Tổng quan trước sao lưu">
        {loading ? <p className="backup-management__note">Đang tải trạng thái sao lưu...</p> : null}
        {summaryItems.map((item) => <article key={item.title}><span>{item.title}</span><h3>{item.value}</h3><p>{item.description}</p></article>)}
      </section>

      {warning ? <section className="backup-management__alert is-warning" role="note">{warning}</section> : null}
      {statusMessage ? <section className={`backup-management__alert is-${statusType}`} role={statusType === "error" ? "alert" : "status"}>{statusMessage}</section> : null}

      <section className="backup-management__product-steps" aria-label="Quy trình an toàn">
        <article><span>1</span><strong>Kiểm tra</strong><p>Rà soát báo cáo, đối soát và phạm vi.</p></article>
        <article><span>2</span><strong>Tải file</strong><p>Chọn hạng mục cần lưu và tải file về máy.</p></article>
        <article><span>3</span><strong>Khôi phục</strong><p>Xem trước thay đổi, xử lý trùng dữ liệu rồi xác nhận.</p></article>
      </section>

      <section className="backup-management__run-workflow" aria-label="Checklist an toàn">
        <div className="backup-management__run-editor">
          <div>
            <span>Checklist an toàn</span>
            <h3>Chuẩn bị trước khi sao lưu</h3>
            <p>Đánh dấu các bước đã kiểm tra để người vận hành sau này biết file được tạo trong điều kiện an toàn.</p>
          </div>
          <div className="backup-management__run-actions">
            <button type="button" onClick={createRun} disabled={!restaurantId || createRunState.loading}>{createRunState.loading ? "Đang tạo..." : "Tạo lần chuẩn bị"}</button>
            <button type="button" onClick={() => saveRun()} disabled={!selectedRun?.id || updateRunState.loading}>{updateRunState.loading ? "Đang lưu..." : "Lưu checklist"}</button>
            <button type="button" onClick={() => saveRun("cancelled")} disabled={!selectedRun?.id || updateRunState.loading}>Hủy lần này</button>
          </div>
          <div className="backup-management__check-scope-grid">
            <div>
              <h4>Việc cần xác nhận</h4>
              {Object.entries(CHECKLIST_LABELS).map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(runDraft.checklist[key])} onChange={(event) => updateDraftChecklist(key, event.target.checked)} />{label}</label>)}
            </div>
            <div>
              <h4>Phạm vi cần lưu</h4>
              {Object.entries(SCOPE_LABELS).map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(runDraft.scope[key])} onChange={(event) => updateDraftScope(key, event.target.checked)} />{label}</label>)}
            </div>
          </div>
          <label className="backup-management__run-note">Ghi chú nội bộ
            <textarea value={runDraft.note} maxLength={1000} onChange={(event) => setRunDraft((prev) => ({ ...prev, note: event.target.value }))} placeholder="VD: file đã lưu tại Drive nội bộ, đã đối soát ca tối, người thực hiện..." />
            <small>{runDraft.note.length}/1000 ký tự</small>
          </label>
        </div>
        <aside className="backup-management__run-detail">
          <h3>Lần chuẩn bị đang chọn</h3>
          {selectedRun ? <><p><strong>{statusLabel(selectedRun.status)}</strong> • tạo {formatDate(selectedRun.createdAt)}</p><p>Hoàn tất: {selectedRun.completedAt ? formatDate(selectedRun.completedAt) : "Chưa hoàn tất"}</p><p>Cập nhật: {formatDate(selectedRun.updatedAt)}</p><p>Ghi chú: {selectedRun.note || "Chưa có"}</p><label>Lịch sử<select value={selectedRun?.id || ""} onChange={(event) => setSelectedRunId(event.target.value)}>{runs.map((run) => <option key={run.id} value={run.id}>{statusLabel(run.status)} • {formatDate(run.createdAt)}</option>)}</select></label></> : <div className="backup-management__empty">Chưa có lần chuẩn bị. Hãy tạo lần mới để bắt đầu.</div>}
        </aside>
      </section>

      <section className="backup-management__flow" aria-label="Sao lưu và khôi phục cấu hình">
        <section className="backup-management__config-panel backup-management__config-panel--export" aria-label="Tải file sao lưu">
          <div>
            <span className="backup-management__panel-kicker">Sao lưu</span>
            <h3>Tải file sao lưu</h3>
            <p>Chọn các hạng mục cấu hình cần lưu. File tải về có thể cất ở Drive nội bộ hoặc nơi lưu trữ an toàn của nhà hàng.</p>
          </div>
          <label>Nhà hàng nguồn
            <select value={restaurantId} onChange={(event) => setRestaurantId(event.target.value)}>
              {restaurants.map((restaurant) => <option key={restaurantOptionId(restaurant)} value={restaurantOptionId(restaurant)}>{restaurantOptionName(restaurant)}</option>)}
            </select>
          </label>
          <div className="backup-management__section-list">
            {CONFIG_SECTIONS.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(exportSections[key])} onChange={() => toggleSection(setExportSections, key)} />{label}</label>)}
          </div>
          <div className="backup-management__actions">
            <button type="button" onClick={handlePreviewExport} disabled={!restaurantId || previewExportState.loading}>{previewExportState.loading ? "Đang kiểm tra..." : "Kiểm tra nội dung"}</button>
            <button type="button" onClick={handleDownloadExport} disabled={!restaurantId || exportBackupState.loading}>{exportBackupState.loading ? "Đang tạo file..." : "Tải file sao lưu"}</button>
          </div>
          {exportPreview ? <div className="backup-management__result"><h4>Sẵn sàng tải file</h4><p>Tên file: {exportPreview.fileName}</p><ul>{exportPreview.counts.map((item) => <li key={item.key}>{item.label}: {item.enabled ? `${item.count} mục` : "Không chọn"}</li>)}</ul>{exportWarnings.map((item) => <p key={item}>{item}</p>)}</div> : null}
        </section>

        <section className="backup-management__config-panel backup-management__config-panel--import" aria-label="Khôi phục cấu hình">
          <div>
            <span className="backup-management__panel-kicker">Khôi phục</span>
            <h3>Khôi phục từ file</h3>
            <p>Chọn file đã lưu, xem trước tác động rồi xác nhận. Hệ thống sẽ không áp dụng thay đổi nếu còn mục bắt buộc chưa xử lý.</p>
          </div>
          <ol className="backup-management__wizard" aria-label="Các bước khôi phục">
            <li className={selectedFile ? "is-done" : ""}>1. Chọn file</li>
            <li className={importPreview ? "is-done" : ""}>2. Xem trước</li>
            <li className={!importConflicts.length && importPreview ? "is-done" : ""}>3. Xử lý mục trùng</li>
            <li className={confirmedImport ? "is-done" : ""}>4. Xác nhận</li>
          </ol>
          <label>File sao lưu
            <input type="file" accept=".json,application/json" onChange={handleFileChange} />
          </label>
          {selectedFile ? <p className="backup-management__note">Đã chọn: {selectedFile.name}</p> : <div className="backup-management__empty" role="status">Chưa chọn file sao lưu. Hãy chọn file để xem trước.</div>}
          <label>Khôi phục vào nhà hàng
            <select value={targetRestaurantId} onChange={(event) => setTargetRestaurantId(event.target.value)}>
              {restaurants.map((restaurant) => <option key={restaurantOptionId(restaurant)} value={restaurantOptionId(restaurant)}>{restaurantOptionName(restaurant)}</option>)}
            </select>
          </label>
          <label>Cách áp dụng
            <select value={importMode} onChange={(event) => { setImportMode(event.target.value); setConfirmedImport(false); setConflictResolutions({}); }}>
              {IMPORT_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="backup-management__section-list">
            {CONFIG_SECTIONS.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(importSections[key])} onChange={() => toggleSection(setImportSections, key)} />{label}</label>)}
          </div>
          <label className="backup-management__confirm"><input type="checkbox" checked={confirmedImport} onChange={(event) => setConfirmedImport(event.target.checked)} />Tôi đã xem trước và đồng ý áp dụng thay đổi vào nhà hàng đã chọn</label>
          <div className="backup-management__actions">
            <button type="button" onClick={handlePreviewImport} disabled={!fileContentBase64 || !targetRestaurantId || previewImportState.loading}>{previewImportState.loading ? "Đang xem trước..." : "Xem trước khôi phục"}</button>
            <button type="button" onClick={handleImport} disabled={!importCanRun || importBackupState.loading}>{importBackupState.loading ? "Đang áp dụng..." : "Áp dụng khôi phục"}</button>
          </div>
          {importPreview ? <div className="backup-management__result"><h4>{importPreview.valid ? "Có thể khôi phục" : "Chưa thể khôi phục"}</h4><p>Nguồn file: {importPreview.sourceRestaurantName || "-"} • Cách áp dụng: {modeLabel(importPreview.mode)}</p><ul>{importPreview.changes.map((item) => <li key={`${item.section}-${item.action}`}>{item.label || sectionLabel(item.section)}: {actionLabel(item.action)} {item.count} mục</li>)}</ul>{importWarnings.map((item) => <p key={item}>{item}</p>)}{importPreview.errors.map((item) => <p key={item} className="backup-management__error">{item}</p>)}</div> : null}

          {importConflicts.length ? (
            <section className="backup-management__conflicts" aria-label="Xử lý mục trùng khi khôi phục">
              <h3>Mục cần chọn cách xử lý</h3>
              <p>Những mục dưới đây đã có dữ liệu tương tự trong nhà hàng đích. Chọn cách xử lý trước khi áp dụng.</p>
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
                  <option value="all">Tất cả mức độ</option>
                  <option value="blocking">Cần chọn cách xử lý</option>
                  <option value="warning">Nên kiểm tra</option>
                  <option value="info">Thông tin</option>
                </select>
                <select aria-label="Lọc cách xử lý xung đột" value={conflictFilter.resolution} onChange={(event) => setConflictFilter((prev) => ({ ...prev, resolution: event.target.value }))}>
                  <option value="all">Tất cả cách xử lý</option>
                  {Object.keys(RESOLUTION_LABELS).map((key) => <option key={key} value={key}>{RESOLUTION_LABELS[key]}</option>)}
                </select>
                <input aria-label="Tìm xung đột" value={conflictFilter.search} onChange={(event) => setConflictFilter((prev) => ({ ...prev, search: event.target.value }))} placeholder="Tìm theo tên hoặc mã" />
              </div>
              <div className="backup-management__actions">
                <button type="button" onClick={() => setConflictResolutions(Object.fromEntries(importConflicts.map((conflict) => [conflict.id, { conflictId: conflict.id, resolution: conflict.defaultResolution, renameTo: "", fieldOverridesJson: "" }]))) }>Dùng đề xuất</button>
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
                      <header><strong>{sectionLabel(conflict.section)} • {conflict.label || conflict.entityKey}</strong><span className={`backup-management__severity is-${conflict.severity}`}>{severityLabel(conflict.severity)}</span></header>
                      <p>{friendlyReason(conflict.reason)}</p>
                      <p>Đề xuất: {RESOLUTION_LABELS[conflict.defaultResolution] || conflict.defaultResolution}</p>
                      <label>Cách xử lý
                        <select aria-label={`Cách xử lý ${conflict.entityKey}`} value={current.resolution} onChange={(event) => updateConflictResolution(conflict.id, { resolution: event.target.value })}>
                          {conflict.allowedResolutions.map((resolution) => <option key={resolution} value={resolution}>{RESOLUTION_LABELS[resolution] || resolution}</option>)}
                        </select>
                      </label>
                      {current.resolution === "rename_source" ? <label>Tên mới<input aria-label={`Tên mới ${conflict.entityKey}`} value={current.renameTo || ""} onChange={(event) => updateConflictResolution(conflict.id, { renameTo: event.target.value })} /></label> : null}
                      <details>
                        <summary>Xem khác biệt</summary>
                        <ul>{conflict.fieldDiffs.map((diff) => <li key={`${conflict.id}-${diff.field}`}>{fieldLabel(diff.field)}: file={diff.sourceValuePreview || "-"} / hiện tại={diff.targetValuePreview || "-"}</li>)}</ul>
                      </details>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
          {importResult ? (
            <div className="backup-management__result">
              <h4>Khôi phục {importResult.success ? "thành công" : "không thành công"}</h4>
              <p>Mã ghi nhận: {importResult.backupRun?.id || "-"}</p>
              {(importResult.appliedResolutions || []).length ? <p>Cách xử lý đã áp dụng: {(importResult.appliedResolutions || []).map((item) => `${RESOLUTION_LABELS[item.resolution] || item.resolution}${item.renameTo ? ` → ${item.renameTo}` : ""}`).join(", ")}</p> : null}
              {resultWarnings.map((item) => <p key={`import-warning-${item}`}>{item}</p>)}
              {(importResult.errors || []).map((item) => <p key={`import-error-${item}`} className="backup-management__error">{item}</p>)}
            </div>
          ) : null}
        </section>
      </section>

      <section className="backup-management__data-grid" aria-label="Phạm vi sao lưu cấu hình">
        <h3>Phạm vi đang theo dõi</h3>
        <div>{scopeItems.map((item) => <article key={item.key}><h4>{item.label}</h4><p>{item.enabled ? "Đang nằm trong kế hoạch" : "Không bao gồm"}</p></article>)}</div>
      </section>

      <section className="backup-management__risk-grid" aria-label="Điểm cần kiểm tra trước khi sao lưu">
        <h3>Điểm cần kiểm tra</h3>
        <div>{(readiness.risks || []).map((risk) => <article key={risk.key}><h4>{CHECKLIST_LABELS[risk.key] || risk.label}</h4><p>{risk.resolved ? "Đã xử lý" : "Cần hoàn tất trước khi chốt."}</p></article>)}</div>
      </section>

      <section className="backup-management__timeline" aria-label="Lịch sử sao lưu cấu hình">
        <h3>5 lần gần nhất</h3>
        <ol>{runs.length ? runs.map((run) => {
          const doneCount = toChecklistItems(run.checklist).filter((item) => item.done).length;
          const scopeCount = toScopeItems(run.scope).filter((item) => item.enabled).length;
          return <li key={run.id}><div><h4>{statusLabel(run.status)} • {formatDate(run.createdAt)}</h4><p>Checklist: {doneCount}/{checklistItems.length} bước hoàn tất</p><p>Phạm vi: {scopeCount}/{scopeItems.length} hạng mục</p>{run.completedAt ? <p>Hoàn tất lúc: {formatDate(run.completedAt)}</p> : null}{run.note ? <p>Ghi chú: {run.note}</p> : null}</div></li>;
        }) : <li><div><p>Chưa có lịch sử sao lưu.</p></div></li>}</ol>
      </section>
    </div>
  );
};

export default BackupManagement;
