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
  settingsReviewed: "Rà soát cấu hình hệ thống",
  exportPrepared: "Chuẩn bị dữ liệu sao lưu",
  safeCopyStored: "Lưu bản sao an toàn",
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
  ["restaurantProfile", "Hồ sơ nhà hàng"],
  ["systemSettings", "Cấu hình hệ thống"],
  ["printSettings", "Cấu hình in"],
  ["customerRankSettings", "Hạng khách hàng"],
  ["payrollSettings", "Lương"],
  ["schedulingPolicy", "Xếp ca"],
  ["floorTableLayout", "Sơ đồ tầng/bàn"],
  ["menuCatalog", "Menu/giá/công thức"],
  ["inventoryMaster", "Dữ liệu kho"],
  ["promotionConfig", "Khuyến mãi/coupon"],
  ["aiChatbotConfig", "AI chatbot"],
];

const IMPORT_MODES = [
  ["clone", "Nhân bản sang nhà hàng này"],
  ["same_restaurant_restore", "Khôi phục đúng nhà hàng gốc"],
  ["merge", "Gộp cấu hình"],
  ["replace", "Thay thế cấu hình đã chọn"],
];

const RESOLUTION_LABELS = {
  use_source: "Dùng dữ liệu trong file",
  keep_target: "Giữ cấu hình hiện tại",
  merge: "Gộp an toàn",
  create_copy: "Tạo bản sao mới",
  rename_source: "Đổi tên rồi tạo mới",
  skip: "Bỏ qua",
  replace_section: "Thay thế hạng mục",
};

const STATUS_LABELS = {
  planned: "Đang chuẩn bị",
  checklist_completed: "Đã hoàn tất checklist",
  cancelled: "Đã hủy",
};

const SEVERITY_LABELS = {
  blocking: "Bắt buộc xử lý",
  warning: "Cần chú ý",
  info: "Thông tin",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allSections = () => Object.fromEntries(CONFIG_SECTIONS.map(([key]) => [key, true]));
const toChecklistItems = (checklist = FALLBACK_CHECKLIST) => Object.entries(CHECKLIST_LABELS).map(([key, label]) => ({ key, label, done: Boolean(checklist?.[key]) }));
const toScopeItems = (scope = FALLBACK_SCOPE) => Object.entries(SCOPE_LABELS).map(([key, label]) => ({ key, label, enabled: Boolean(scope?.[key]) }));
const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("vi-VN");
};
const restaurantOptionId = (restaurant) => String(restaurant?.id || restaurant?._id || restaurant?.restaurantId || "");
const restaurantOptionName = (restaurant) => restaurant?.name || restaurant?.restaurantName || restaurant?.displayName || restaurantOptionId(restaurant);
const selectedSectionsPayload = (state) => Object.fromEntries(CONFIG_SECTIONS.map(([key]) => [key, Boolean(state[key])]));
const base64ToBlob = (base64, mimeType) => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType || "application/json" });
};
const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || "").split(",").pop() || "");
  reader.onerror = () => reject(reader.error || new Error("Không đọc được file JSON"));
  reader.readAsDataURL(file);
});
const sectionLabel = (key) => CONFIG_SECTIONS.find(([sectionKey]) => sectionKey === key)?.[1] || key;
const modeLabel = (value) => IMPORT_MODES.find(([mode]) => mode === value)?.[1] || value;
const statusLabel = (status) => STATUS_LABELS[status] || status || "Chưa xác định";
const severityLabel = (severity) => SEVERITY_LABELS[severity] || severity || "Thông tin";

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
  const [exportBackup, exportBackupState] = useMutation(M_EXPORT_CONFIG_BACKUP, { onError: (error) => setStatusMessage(`Không tải được file sao lưu JSON: ${error.message}`) });
  const [previewImport, previewImportState] = useMutation(M_PREVIEW_CONFIG_IMPORT, { onError: (error) => setStatusMessage(`Không thể xem trước khôi phục: ${error.message}`) });

  const afterRunMutation = () => {
    readinessQuery.refetch?.();
    runsQuery.refetch?.();
  };

  const [createBackupRun, createRunState] = useMutation(M_CREATE_BACKUP_RUN, {
    onCompleted: ({ createBackupRun: created }) => {
      setSelectedRunId(created?.id || "");
      setStatusMessage("Đã tạo lần sao lưu mới.");
      afterRunMutation();
    },
    onError: (error) => setStatusMessage(`Không tạo được lần sao lưu: ${error.message}`),
  });
  const [updateBackupRun, updateRunState] = useMutation(M_UPDATE_BACKUP_RUN, {
    onCompleted: ({ updateBackupRun: updated }) => {
      setSelectedRunId(updated?.id || "");
      setStatusMessage("Đã lưu checklist sao lưu.");
      afterRunMutation();
    },
    onError: (error) => setStatusMessage(`Không lưu được checklist sao lưu: ${error.message}`),
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
    if (selectedRun) setRunDraft({ checklist: { ...FALLBACK_CHECKLIST, ...(selectedRun.checklist || {}) }, scope: { ...FALLBACK_SCOPE, ...(selectedRun.scope || {}) }, note: selectedRun.note || "" });
    else setRunDraft((prev) => ({ checklist: { ...FALLBACK_CHECKLIST, ...prev.checklist }, scope: { ...FALLBACK_SCOPE, ...prev.scope }, note: prev.note || "" }));
  }, [selectedRun?.id]);

  const checklistItems = useMemo(() => toChecklistItems(readiness.checklist), [readiness.checklist]);
  const scopeItems = useMemo(() => toScopeItems(readiness.scope), [readiness.scope]);
  const unresolvedRisks = useMemo(() => (readiness.risks || []).filter((risk) => !risk.resolved), [readiness.risks]);
  const enabledScopeCount = scopeItems.filter((item) => item.enabled).length;
  const completedChecklistCount = checklistItems.filter((item) => item.done).length;
  const lastRunDate = readiness.lastRun?.completedAt || readiness.lastRun?.updatedAt || readiness.lastRun?.createdAt;
  const loading = readinessQuery.loading || runsQuery.loading;
  const warning = !restaurantId ? "Chưa chọn nhà hàng để đọc cấu hình sao lưu." : readinessQuery.error || runsQuery.error ? "Không đọc được trạng thái sao lưu, đang hiển thị checklist khuyến nghị." : "";

  const toggleSection = (setter, key) => setter((prev) => ({ ...prev, [key]: !prev[key] }));
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
  const updateDraftChecklist = (key, checked) => setRunDraft((prev) => ({ ...prev, checklist: { ...prev.checklist, [key]: checked } }));
  const updateDraftScope = (key, checked) => setRunDraft((prev) => ({ ...prev, scope: { ...prev.scope, [key]: checked } }));
  const createRun = () => createBackupRun({ variables: { input: { restaurantId, checklist: runDraft.checklist, scope: runDraft.scope, note: runDraft.note } } });
  const saveRun = (status) => {
    if (!selectedRun?.id) return;
    updateBackupRun({ variables: { input: { id: selectedRun.id, restaurantId, checklist: runDraft.checklist, scope: runDraft.scope, note: runDraft.note, ...(status ? { status } : {}) } } });
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
      setStatusMessage("File JSON quá lớn, giới hạn là 10MB.");
      return;
    }
    setFileContentBase64(await readFileAsBase64(file));
  };

  const importConflicts = importPreview?.conflicts || [];
  const conflictStats = useMemo(() => ({
    total: importConflicts.length,
    blocking: importConflicts.filter((conflict) => conflict.severity === "blocking").length,
    warning: importConflicts.filter((conflict) => conflict.severity === "warning").length,
    info: importConflicts.filter((conflict) => conflict.severity === "info").length,
    keepTarget: Object.values(conflictResolutions).filter((item) => item.resolution === "keep_target").length,
    useSource: Object.values(conflictResolutions).filter((item) => item.resolution === "use_source").length,
    merge: Object.values(conflictResolutions).filter((item) => item.resolution === "merge").length,
  }), [importConflicts, conflictResolutions]);
  const filteredConflicts = useMemo(() => importConflicts.filter((conflict) => {
    const current = conflictResolutions[conflict.id]?.resolution || conflict.defaultResolution;
    const searchText = `${conflict.entityKey} ${conflict.label || ""} ${conflict.reason}`.toLowerCase();
    return (conflictFilter.section === "all" || conflict.section === conflictFilter.section)
      && (conflictFilter.severity === "all" || conflict.severity === conflictFilter.severity)
      && (conflictFilter.resolution === "all" || current === conflictFilter.resolution)
      && (!conflictFilter.search || searchText.includes(conflictFilter.search.toLowerCase()));
  }), [importConflicts, conflictFilter, conflictResolutions]);
  const updateConflictResolution = (conflictId, patch) => setConflictResolutions((prev) => ({ ...prev, [conflictId]: { ...(prev[conflictId] || { conflictId }), ...patch } }));
  const applyBulkResolution = (resolution, predicate = () => true) => setConflictResolutions((prev) => {
    const next = { ...prev };
    for (const conflict of importConflicts) {
      if (!predicate(conflict) || !conflict.allowedResolutions.includes(resolution)) continue;
      next[conflict.id] = { ...(next[conflict.id] || { conflictId: conflict.id, renameTo: "", fieldOverridesJson: "" }), resolution };
    }
    return next;
  });
  const invalidConflictResolution = importConflicts.some((conflict) => {
    const current = conflictResolutions[conflict.id] || { resolution: conflict.defaultResolution, renameTo: "" };
    return !conflict.allowedResolutions.includes(current.resolution) || (current.resolution === "rename_source" && !current.renameTo?.trim()) || (conflict.severity === "blocking" && current.resolution === "skip");
  });
  const statusType = statusMessage.toLowerCase().includes("thất bại") || statusMessage.toLowerCase().includes("lỗi") || statusMessage.toLowerCase().includes("không") ? "error" : statusMessage.toLowerCase().includes("mã kiểm tra") || statusMessage.toLowerCase().includes("đã tạo") || statusMessage.toLowerCase().includes("đã lưu") ? "success" : "warning";
  const importCanRun = Boolean(importPreview?.valid && !(importPreview?.errors || []).length && confirmedImport && fileContentBase64 && !invalidConflictResolution);

  const importInput = (dryRun = true) => ({
    targetRestaurantId,
    fileContentBase64,
    mode: importMode,
    sections: selectedSectionsPayload(importSections),
    dryRun,
    replaceExisting: importMode === "replace" ? confirmedImport : false,
    conflictResolutions: Object.values(conflictResolutions),
  });
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
    { title: "Trạng thái", description: readiness.ready ? "Đủ điều kiện theo checklist hiện tại." : `Còn ${unresolvedRisks.length} rủi ro cần xử lý.` },
    { title: "Phạm vi", description: `${enabledScopeCount}/${scopeItems.length} hạng mục đang được đưa vào phạm vi sao lưu.` },
    { title: "Checklist", description: `${completedChecklistCount}/${checklistItems.length} bước đã hoàn tất.` },
    { title: "Lần gần nhất", description: lastRunDate ? formatDate(lastRunDate) : "Chưa có dữ liệu." },
  ];

  return (
    <div className="backup-management">
      <ManagementPageHeader
        eyebrow="Sao lưu & khôi phục"
        title="Sao lưu & khôi phục cấu hình"
        subtitle="Tạo file JSON cho cấu hình nhà hàng, xem trước thay đổi và khôi phục có xác nhận. Đây không phải bản sao lưu toàn bộ cơ sở dữ liệu."
        icon="🗄️"
        stats={[{ label: "Checklist", value: `${completedChecklistCount}/${checklistItems.length}`, icon: "✅" }, { label: "Lần sao lưu", value: runs.length, icon: "🧾" }]}
        customControls={(
          <div className="backup-management__badges" aria-label="Thiết lập sao lưu">
            <label>Nhà hàng đang sao lưu
              <select value={restaurantId} onChange={(event) => setRestaurantId(event.target.value)}>
                {restaurants.map((restaurant) => <option key={restaurantOptionId(restaurant)} value={restaurantOptionId(restaurant)}>{restaurantOptionName(restaurant)}</option>)}
              </select>
            </label>
            <span>Xem trước trước khi khôi phục</span>
            <span>Không thay thế sao lưu cơ sở dữ liệu</span>
          </div>
        )}
        showTimeWidget={false}
      />

      <section className="backup-management__hero" aria-label="Giới thiệu sao lưu cấu hình">
        <div><span>Trung tâm sao lưu cấu hình</span><h2>Snapshot JSON cho cấu hình, không thay thế database backup</h2><p>Tính năng này chỉ sao lưu cấu hình nhà hàng. File không bao gồm đơn hàng, thanh toán, đánh giá, lịch sử chat, mật khẩu, token hoặc khóa thanh toán.</p></div>
      </section>
      <section className={`backup-management__readiness ${readiness.ready ? "is-ready" : "is-risk"}`} aria-label="Tình trạng sẵn sàng sao lưu">
        <article><strong>{readiness.ready ? "Sẵn sàng" : "Cần rà soát"}</strong><span>Trạng thái</span></article><article><strong>{completedChecklistCount}/{checklistItems.length}</strong><span>Checklist</span></article><article><strong>{unresolvedRisks.length}</strong><span>Rủi ro mở</span></article><article><strong>{lastRunDate ? formatDate(lastRunDate) : "Chưa có"}</strong><span>Lần gần nhất</span></article>
      </section>
      {warning ? <section className="backup-management__alert is-warning" role="note">{warning}</section> : null}
      {statusMessage ? <section className={`backup-management__alert is-${statusType}`} role={statusType === "error" ? "alert" : "status"}>{statusMessage}</section> : null}

      <section className="backup-management__run-workflow" aria-label="Quy trình checklist sao lưu thủ công">
        <div className="backup-management__run-editor">
          <div>
            <span>Lần sao lưu thủ công</span>
            <h3>Checklist trước khi sao lưu cấu hình</h3>
            <p>Hoàn tất 6 điều kiện an toàn trước khi chốt checklist. Có thể hủy nếu lần sao lưu không còn hợp lệ.</p>
          </div>
          <div className="backup-management__run-actions">
            <button type="button" onClick={createRun} disabled={!restaurantId || createRunState.loading}>{createRunState.loading ? "Đang tạo..." : "Tạo lần sao lưu mới"}</button>
            <button type="button" onClick={() => saveRun()} disabled={!selectedRun?.id || updateRunState.loading}>{updateRunState.loading ? "Đang lưu..." : "Lưu checklist"}</button>
            <button type="button" onClick={() => saveRun("cancelled")} disabled={!selectedRun?.id || updateRunState.loading}>Hủy lần sao lưu</button>
          </div>
          <div className="backup-management__check-scope-grid">
            <div>
              <h4>Tiến độ checklist</h4>
              {Object.entries(CHECKLIST_LABELS).map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(runDraft.checklist[key])} onChange={(event) => updateDraftChecklist(key, event.target.checked)} />{label}</label>)}
            </div>
            <div>
              <h4>Phạm vi</h4>
              {Object.entries(SCOPE_LABELS).map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(runDraft.scope[key])} onChange={(event) => updateDraftScope(key, event.target.checked)} />{label}</label>)}
            </div>
          </div>
          <label className="backup-management__run-note">Ghi chú lưu trữ an toàn
            <textarea value={runDraft.note} maxLength={1000} onChange={(event) => setRunDraft((prev) => ({ ...prev, note: event.target.value }))} placeholder="VD: file đã lưu tại Google Drive nội bộ, người thực hiện, checklist đối soát..." />
            <small>{runDraft.note.length}/1000 ký tự</small>
          </label>
        </div>
        <aside className="backup-management__run-detail">
          <h3>Chi tiết lần sao lưu đang chọn</h3>
          {selectedRun ? <><p><strong>{statusLabel(selectedRun.status)}</strong> • tạo {formatDate(selectedRun.createdAt)}</p><p>Hoàn tất: {selectedRun.completedAt ? formatDate(selectedRun.completedAt) : "Chưa hoàn tất"}</p><p>Cập nhật: {formatDate(selectedRun.updatedAt)}</p><p>Ghi chú: {selectedRun.note || "Chưa có"}</p><label>Lịch sử lần sao lưu<select value={selectedRun?.id || ""} onChange={(event) => setSelectedRunId(event.target.value)}>{runs.map((run) => <option key={run.id} value={run.id}>{statusLabel(run.status)} • {formatDate(run.createdAt)}</option>)}</select></label></> : <div className="backup-management__empty">Chưa có lần sao lưu. Hãy tạo lần sao lưu mới để bắt đầu checklist.</div>}
        </aside>
      </section>

      <section className="backup-management__flow" aria-label="Xuất và khôi phục cấu hình">
      <section className="backup-management__config-panel backup-management__config-panel--export" aria-label="Xuất cấu hình">
        <div>
          <h3>Xuất cấu hình</h3>
          <p>Chọn nhà hàng và hạng mục để tạo file JSON UTF-8 tải về máy.</p>
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
          <button type="button" onClick={handlePreviewExport} disabled={!restaurantId || previewExportState.loading}>{previewExportState.loading ? "Đang xem trước..." : "Xem trước"}</button>
          <button type="button" onClick={handleDownloadExport} disabled={!restaurantId || exportBackupState.loading}>{exportBackupState.loading ? "Đang tạo file..." : "Tải file sao lưu JSON"}</button>
        </div>
        {exportPreview ? <div className="backup-management__result"><h4>{exportPreview.fileName}</h4><p>Phiên bản schema {exportPreview.schemaVersion} • {formatDate(exportPreview.createdAt)}</p><ul>{exportPreview.counts.map((item) => <li key={item.key}>{item.label}: {item.enabled ? item.count : "Tắt"}</li>)}</ul>{exportPreview.warnings.map((item) => <p key={item}>{item}</p>)}</div> : null}
      </section>

      <section className="backup-management__config-panel backup-management__config-panel--import" aria-label="Khôi phục cấu hình">
        <div>
          <h3>Khôi phục cấu hình</h3>
          <p>Quy trình an toàn: chọn file → xem trước thay đổi → xử lý xung đột → xác nhận áp dụng.</p>
        </div>
        <ol className="backup-management__wizard" aria-label="Các bước khôi phục">
          <li className={selectedFile ? "is-done" : ""}>1. Chọn file</li>
          <li className={importPreview ? "is-done" : ""}>2. Xem trước</li>
          <li className={!importConflicts.length && importPreview ? "is-done" : ""}>3. Xử lý xung đột</li>
          <li className={confirmedImport ? "is-done" : ""}>4. Xác nhận</li>
        </ol>
        <label>File sao lưu JSON
          <input type="file" accept=".json,application/json" onChange={handleFileChange} />
        </label>
        {selectedFile ? <p className="backup-management__note">Đã chọn: {selectedFile.name}</p> : <div className="backup-management__empty" role="status">Chưa chọn file sao lưu JSON. Hãy chọn file để xem trước khôi phục.</div>}
        <label>Nhà hàng đích
          <select value={targetRestaurantId} onChange={(event) => setTargetRestaurantId(event.target.value)}>
            {restaurants.map((restaurant) => <option key={restaurantOptionId(restaurant)} value={restaurantOptionId(restaurant)}>{restaurantOptionName(restaurant)}</option>)}
          </select>
        </label>
        <label>Cách khôi phục
          <select value={importMode} onChange={(event) => { setImportMode(event.target.value); setConfirmedImport(false); setConflictResolutions({}); }}>
            {IMPORT_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <div className="backup-management__section-list">
          {CONFIG_SECTIONS.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(importSections[key])} onChange={() => toggleSection(setImportSections, key)} />{label}</label>)}
        </div>
        <label className="backup-management__confirm"><input type="checkbox" checked={confirmedImport} onChange={(event) => setConfirmedImport(event.target.checked)} />Tôi hiểu thao tác khôi phục có thể ghi đè cấu hình hiện tại</label>
        <div className="backup-management__actions">
          <button type="button" onClick={handlePreviewImport} disabled={!fileContentBase64 || !targetRestaurantId || previewImportState.loading}>{previewImportState.loading ? "Đang xem trước..." : "Xem trước khôi phục"}</button>
          <button type="button" onClick={handleImport} disabled={!importCanRun || importBackupState.loading}>{importBackupState.loading ? "Đang áp dụng..." : "Áp dụng khôi phục"}</button>
        </div>
        {importPreview ? <div className="backup-management__result"><h4>Xem trước: {importPreview.valid ? "Hợp lệ" : "Không hợp lệ"}</h4><p>Nguồn: {importPreview.sourceRestaurantName || "-"} • Cách khôi phục: {modeLabel(importPreview.mode)}</p><ul>{importPreview.changes.map((item) => <li key={`${item.section}-${item.action}`}>{item.label}: {item.action} {item.count}</li>)}</ul>{importPreview.warnings.map((item) => <p key={item}>{item}</p>)}{importPreview.errors.map((item) => <p key={item} className="backup-management__error">{item}</p>)}</div> : null}
        {importConflicts.length ? (
          <section className="backup-management__conflicts" aria-label="Xử lý xung đột khôi phục">
            <h3>Xử lý xung đột khôi phục</h3>
            <div className="backup-management__conflict-summary">
              <article><strong>{conflictStats.total}</strong><span>Tổng xung đột</span></article>
              <article><strong>{conflictStats.blocking}</strong><span>Bắt buộc xử lý</span></article>
              <article><strong>{conflictStats.warning}</strong><span>Cần chú ý</span></article>
              <article><strong>{conflictStats.info}</strong><span>Thông tin</span></article>
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
                <option value="blocking">Bắt buộc xử lý</option>
                <option value="warning">Cần chú ý</option>
                <option value="info">Thông tin</option>
              </select>
              <select aria-label="Lọc cách xử lý xung đột" value={conflictFilter.resolution} onChange={(event) => setConflictFilter((prev) => ({ ...prev, resolution: event.target.value }))}>
                <option value="all">Tất cả cách xử lý</option>
                {Object.keys(RESOLUTION_LABELS).map((key) => <option key={key} value={key}>{RESOLUTION_LABELS[key]}</option>)}
              </select>
              <input aria-label="Tìm xung đột" value={conflictFilter.search} onChange={(event) => setConflictFilter((prev) => ({ ...prev, search: event.target.value }))} placeholder="Tìm mã hoặc tên cấu hình" />
            </div>
            <div className="backup-management__actions">
              <button type="button" onClick={() => setConflictResolutions(Object.fromEntries(importConflicts.map((conflict) => [conflict.id, { conflictId: conflict.id, resolution: conflict.defaultResolution, renameTo: "", fieldOverridesJson: "" }]))) }>Áp dụng mặc định</button>
              <button type="button" onClick={() => applyBulkResolution("keep_target")}>Giữ toàn bộ hiện tại</button>
              <button type="button" onClick={() => applyBulkResolution("use_source")}>Dùng toàn bộ từ file</button>
              <button type="button" onClick={() => applyBulkResolution("merge", (conflict) => conflict.severity !== "blocking")}>Gộp xung đột an toàn</button>
              <button type="button" onClick={() => applyBulkResolution("skip", (conflict) => conflict.severity === "warning")}>Bỏ qua cảnh báo</button>
            </div>
            {invalidConflictResolution ? <p className="backup-management__error">Cần xử lý xung đột bắt buộc hoặc nhập tên mới trước khi khôi phục.</p> : null}
            <div className="backup-management__conflict-list">
              {filteredConflicts.map((conflict) => {
                const current = conflictResolutions[conflict.id] || { conflictId: conflict.id, resolution: conflict.defaultResolution, renameTo: "" };
                return (
                  <article key={conflict.id}>
                    <header><strong>{sectionLabel(conflict.section)} • {conflict.entityType}</strong><span className={`backup-management__severity is-${conflict.severity}`}>{severityLabel(conflict.severity)}</span></header>
                    <p>{conflict.entityKey} {conflict.label ? `• ${conflict.label}` : ""}</p>
                    <p>{conflict.reason}</p>
                    <p>Mặc định: {RESOLUTION_LABELS[conflict.defaultResolution] || conflict.defaultResolution}</p>
                    <label>Cách xử lý
                      <select aria-label={`Cách xử lý ${conflict.entityKey}`} value={current.resolution} onChange={(event) => updateConflictResolution(conflict.id, { resolution: event.target.value })}>
                        {conflict.allowedResolutions.map((resolution) => <option key={resolution} value={resolution}>{RESOLUTION_LABELS[resolution] || resolution}</option>)}
                      </select>
                    </label>
                    {current.resolution === "rename_source" ? <label>Tên mới<input aria-label={`Tên mới ${conflict.entityKey}`} value={current.renameTo || ""} onChange={(event) => updateConflictResolution(conflict.id, { renameTo: event.target.value })} /></label> : null}
                    <details>
                      <summary>Khác biệt trường</summary>
                      <ul>{conflict.fieldDiffs.map((diff) => <li key={`${conflict.id}-${diff.field}`}>{diff.field}: file={diff.sourceValuePreview || "-"} / hiện tại={diff.targetValuePreview || "-"}</li>)}</ul>
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
            <p>Mã lần sao lưu: {importResult.backupRun?.id || "-"}</p>
            {(importResult.appliedResolutions || []).length ? <p>Cách xử lý đã áp dụng: {(importResult.appliedResolutions || []).map((item) => `${item.conflictId}:${RESOLUTION_LABELS[item.resolution] || item.resolution}${item.renameTo ? `→${item.renameTo}` : ""}`).join(", ")}</p> : null}
            {(importResult.warnings || []).map((item) => <p key={`import-warning-${item}`}>{item}</p>)}
            {(importResult.errors || []).map((item) => <p key={`import-error-${item}`} className="backup-management__error">{item}</p>)}
          </div>
        ) : null}
      </section>
      </section>

      <section className="backup-management__summary" aria-label="Tổng quan trước sao lưu">
        {loading ? <p className="backup-management__note">Đang tải trạng thái sao lưu...</p> : null}
        {summaryItems.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.description}</p></article>)}
      </section>

      <section className="backup-management__timeline" aria-label="Checklist sẵn sàng">
        <h3>Checklist sẵn sàng</h3>
        <ol>{checklistItems.map((item) => <li key={item.key}><div><h4>{item.label}</h4><p>{item.done ? "Hoàn tất" : "Chưa xong"}</p></div></li>)}</ol>
      </section>

      <section className="backup-management__data-grid" aria-label="Phạm vi sao lưu cấu hình">
        <h3>Phạm vi sao lưu cấu hình</h3>
        <div>{scopeItems.map((item) => <article key={item.key}><h4>{item.label}</h4><p>{item.enabled ? "Có trong phạm vi" : "Không bao gồm"}</p></article>)}</div>
      </section>

      <section className="backup-management__risk-grid" aria-label="Rủi ro trước khi sao lưu">
        <h3>Rủi ro trước khi sao lưu</h3>
        <div>{(readiness.risks || []).map((risk) => <article key={risk.key}><h4>{risk.label}</h4><p>{risk.description || "Không có mô tả."}</p><p>{risk.resolved ? "Đã xử lý" : "Cần xử lý"}</p></article>)}</div>
      </section>

      <section className="backup-management__timeline" aria-label="Lịch sử sao lưu cấu hình">
        <h3>5 lần sao lưu gần nhất</h3>
        <ol>{runs.length ? runs.map((run) => {
          const doneCount = toChecklistItems(run.checklist).filter((item) => item.done).length;
          const scopeCount = toScopeItems(run.scope).filter((item) => item.enabled).length;
          return <li key={run.id}><div><h4>{statusLabel(run.status)} • {formatDate(run.createdAt)}</h4><p>Checklist: {doneCount}/{checklistItems.length} bước hoàn tất</p><p>Phạm vi: {scopeCount}/{scopeItems.length} hạng mục</p>{run.completedAt ? <p>Hoàn tất lúc: {formatDate(run.completedAt)}</p> : null}<p>Cập nhật: {formatDate(run.updatedAt)}</p>{run.note ? <p>Ghi chú: {run.note}</p> : null}</div></li>;
        }) : <li><div><p>Chưa có lịch sử sao lưu.</p></div></li>}</ol>
      </section>
    </div>
  );
};

export default BackupManagement;
