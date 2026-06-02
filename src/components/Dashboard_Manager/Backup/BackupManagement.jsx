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
  settingsReviewed: "Kiểm tra cấu hình hệ thống",
  exportPrepared: "Chuẩn bị dữ liệu export/snapshot",
  safeCopyStored: "Lưu bản sao an toàn",
  operatorRecorded: "Ghi nhận người thực hiện và thời điểm",
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
  ["inventoryMaster", "Kho master data"],
  ["promotionConfig", "Khuyến mãi/coupon"],
  ["aiChatbotConfig", "AI chatbot"],
];

const IMPORT_MODES = [
  ["clone", "Clone sang nhà hàng này"],
  ["same_restaurant_restore", "Khôi phục cùng nhà hàng"],
  ["merge", "Merge"],
  ["replace", "Replace"],
];

const RESOLUTION_LABELS = {
  use_source: "Dùng dữ liệu file",
  keep_target: "Giữ cấu hình hiện tại",
  merge: "Gộp an toàn",
  create_copy: "Tạo bản sao",
  rename_source: "Đổi tên/code rồi tạo",
  skip: "Bỏ qua",
  replace_section: "Replace section",
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
  const [previewExport, previewExportState] = useLazyQuery(Q_CONFIG_BACKUP_PREVIEW, { fetchPolicy: "network-only", onError: (error) => setStatusMessage(`Backend chưa hỗ trợ preview export hoặc có lỗi: ${error.message}`) });
  const [exportBackup, exportBackupState] = useMutation(M_EXPORT_CONFIG_BACKUP, { onError: (error) => setStatusMessage(`Không tải được file backup JSON: ${error.message}`) });
  const [previewImport, previewImportState] = useMutation(M_PREVIEW_CONFIG_IMPORT, { onError: (error) => setStatusMessage(`Không preview được file import: ${error.message}`) });
  const [importBackup, importBackupState] = useMutation(M_IMPORT_CONFIG_BACKUP, {
    onError: (error) => setStatusMessage(`Import thất bại: ${error.message}`),
    onCompleted: () => {
      readinessQuery.refetch?.();
      runsQuery.refetch?.();
    },
  });

  const readiness = readinessQuery.data?.backupReadiness || FALLBACK_READINESS;
  const runs = Array.isArray(runsQuery.data?.backupRuns) ? runsQuery.data.backupRuns : [];
  const checklistItems = useMemo(() => toChecklistItems(readiness.checklist), [readiness.checklist]);
  const scopeItems = useMemo(() => toScopeItems(readiness.scope), [readiness.scope]);
  const unresolvedRisks = useMemo(() => (readiness.risks || []).filter((risk) => !risk.resolved), [readiness.risks]);
  const enabledScopeCount = scopeItems.filter((item) => item.enabled).length;
  const completedChecklistCount = checklistItems.filter((item) => item.done).length;
  const lastRunDate = readiness.lastRun?.completedAt || readiness.lastRun?.updatedAt || readiness.lastRun?.createdAt;
  const loading = readinessQuery.loading || runsQuery.loading;
  const warning = !restaurantId ? "Chưa xác định nhà hàng để đọc cấu hình" : readinessQuery.error || runsQuery.error ? "Không đọc được trạng thái backup, đang hiển thị checklist khuyến nghị." : "";
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
    anchor.download = file.fileName || "restaurant-config-snapshot.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatusMessage(`Đã tạo file ${file.fileName}. Checksum: ${file.checksum}`);
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
      setStatusMessage("File JSON quá lớn, giới hạn frontend là 10MB.");
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
    { title: "Trạng thái", description: readiness.ready ? "Đủ điều kiện theo checklist metadata hiện tại." : `Còn ${unresolvedRisks.length} rủi ro cần xử lý.` },
    { title: "Phạm vi", description: `${enabledScopeCount}/${scopeItems.length} hạng mục đang được đưa vào phạm vi backup metadata.` },
    { title: "Checklist", description: `${completedChecklistCount}/${checklistItems.length} bước đã hoàn tất.` },
    { title: "Lần chạy gần nhất", description: lastRunDate ? formatDate(lastRunDate) : "Chưa có dữ liệu." },
  ];

  return (
    <div className="backup-management">
      <ManagementPageHeader
        eyebrow="BACKUP CENTER"
        title="Sao lưu & khôi phục cấu hình"
        subtitle="Export/import Restaurant Configuration Snapshot dạng JSON; không phải full database backup vận hành."
        icon="🗄️"
        stats={[{ label: "Checklist", value: `${completedChecklistCount}/${checklistItems.length}`, icon: "✅" }, { label: "Backup runs", value: runs.length, icon: "🧾" }]}
        customControls={<div className="backup-management__badges" aria-label="Trạng thái trang"><span>Config snapshot JSON</span><span>Preview/dry-run</span><span>Không thay thế DB backup</span></div>}
        showTimeWidget={false}
      />

      <section className="backup-management__alert" role="note">
        Tính năng này backup cấu hình nhà hàng, không thay thế database backup vận hành. Snapshot không bao gồm orders, payments, reviews, chat history, passwordHash, refresh token hoặc payment secrets.
      </section>
      {warning ? <section className="backup-management__alert" role="note">{warning}</section> : null}
      {statusMessage ? <section className="backup-management__alert" role="status">{statusMessage}</section> : null}

      <section className="backup-management__config-panel" aria-label="Export cấu hình">
        <div>
          <h3>Export cấu hình</h3>
          <p>Chọn nhà hàng và section để tạo file JSON UTF-8 tải về máy.</p>
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
          <button type="button" onClick={handlePreviewExport} disabled={!restaurantId || previewExportState.loading}>{previewExportState.loading ? "Đang preview..." : "Xem trước"}</button>
          <button type="button" onClick={handleDownloadExport} disabled={!restaurantId || exportBackupState.loading}>{exportBackupState.loading ? "Đang tạo file..." : "Tải file backup JSON"}</button>
        </div>
        {exportPreview ? <div className="backup-management__result"><h4>{exportPreview.fileName}</h4><p>Schema v{exportPreview.schemaVersion} • {formatDate(exportPreview.createdAt)}</p><ul>{exportPreview.counts.map((item) => <li key={item.key}>{item.label}: {item.enabled ? item.count : "Tắt"}</li>)}</ul>{exportPreview.warnings.map((item) => <p key={item}>{item}</p>)}</div> : null}
      </section>

      <section className="backup-management__config-panel" aria-label="Import / Khôi phục">
        <div>
          <h3>Import / Khôi phục</h3>
          <p>Chọn file JSON, preview dry-run trước, sau đó xác nhận mới chạy import thật.</p>
        </div>
        <label>File snapshot JSON
          <input type="file" accept=".json,application/json" onChange={handleFileChange} />
        </label>
        {selectedFile ? <p className="backup-management__note">Đã chọn: {selectedFile.name}</p> : null}
        <label>Nhà hàng đích
          <select value={targetRestaurantId} onChange={(event) => setTargetRestaurantId(event.target.value)}>
            {restaurants.map((restaurant) => <option key={restaurantOptionId(restaurant)} value={restaurantOptionId(restaurant)}>{restaurantOptionName(restaurant)}</option>)}
          </select>
        </label>
        <label>Mode
          <select value={importMode} onChange={(event) => { setImportMode(event.target.value); setConfirmedImport(false); setConflictResolutions({}); }}>
            {IMPORT_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <div className="backup-management__section-list">
          {CONFIG_SECTIONS.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(importSections[key])} onChange={() => toggleSection(setImportSections, key)} />{label}</label>)}
        </div>
        <label className="backup-management__confirm"><input type="checkbox" checked={confirmedImport} onChange={(event) => setConfirmedImport(event.target.checked)} />Tôi hiểu import có thể ghi đè cấu hình hiện tại</label>
        <div className="backup-management__actions">
          <button type="button" onClick={handlePreviewImport} disabled={!fileContentBase64 || !targetRestaurantId || previewImportState.loading}>{previewImportState.loading ? "Đang preview..." : "Preview import"}</button>
          <button type="button" onClick={handleImport} disabled={!importCanRun || importBackupState.loading}>{importBackupState.loading ? "Đang import..." : "Import thật"}</button>
        </div>
        {importPreview ? <div className="backup-management__result"><h4>Preview: {importPreview.valid ? "Hợp lệ" : "Không hợp lệ"}</h4><p>Nguồn: {importPreview.sourceRestaurantName || "-"} • Mode: {importPreview.mode}</p><ul>{importPreview.changes.map((item) => <li key={`${item.section}-${item.action}`}>{item.label}: {item.action} {item.count}</li>)}</ul>{importPreview.warnings.map((item) => <p key={item}>{item}</p>)}{importPreview.errors.map((item) => <p key={item} className="backup-management__error">{item}</p>)}</div> : null}
        {importConflicts.length ? (
          <section className="backup-management__conflicts" aria-label="Xử lý xung đột import">
            <h3>Xử lý xung đột import</h3>
            <div className="backup-management__conflict-summary">
              <article><strong>{conflictStats.total}</strong><span>Tổng conflicts</span></article>
              <article><strong>{conflictStats.blocking}</strong><span>Blocking</span></article>
              <article><strong>{conflictStats.warning}</strong><span>Warning</span></article>
              <article><strong>{conflictStats.info}</strong><span>Info</span></article>
              <article><strong>{conflictStats.keepTarget}</strong><span>keep_target</span></article>
              <article><strong>{conflictStats.useSource}</strong><span>use_source</span></article>
              <article><strong>{conflictStats.merge}</strong><span>merge</span></article>
            </div>
            <div className="backup-management__conflict-filters">
              <select aria-label="Lọc section conflict" value={conflictFilter.section} onChange={(event) => setConflictFilter((prev) => ({ ...prev, section: event.target.value }))}>
                <option value="all">Tất cả section</option>
                {[...new Set(importConflicts.map((conflict) => conflict.section))].map((section) => <option key={section} value={section}>{section}</option>)}
              </select>
              <select aria-label="Lọc severity conflict" value={conflictFilter.severity} onChange={(event) => setConflictFilter((prev) => ({ ...prev, severity: event.target.value }))}>
                <option value="all">Tất cả severity</option>
                <option value="blocking">blocking</option>
                <option value="warning">warning</option>
                <option value="info">info</option>
              </select>
              <select aria-label="Lọc resolution conflict" value={conflictFilter.resolution} onChange={(event) => setConflictFilter((prev) => ({ ...prev, resolution: event.target.value }))}>
                <option value="all">Tất cả resolution</option>
                {Object.keys(RESOLUTION_LABELS).map((key) => <option key={key} value={key}>{key}</option>)}
              </select>
              <input aria-label="Tìm conflict" value={conflictFilter.search} onChange={(event) => setConflictFilter((prev) => ({ ...prev, search: event.target.value }))} placeholder="Tìm key/label" />
            </div>
            <div className="backup-management__actions">
              <button type="button" onClick={() => setConflictResolutions(Object.fromEntries(importConflicts.map((conflict) => [conflict.id, { conflictId: conflict.id, resolution: conflict.defaultResolution, renameTo: "", fieldOverridesJson: "" }]))) }>Apply default</button>
              <button type="button" onClick={() => applyBulkResolution("keep_target")}>Keep all target</button>
              <button type="button" onClick={() => applyBulkResolution("use_source")}>Use all source</button>
              <button type="button" onClick={() => applyBulkResolution("merge", (conflict) => conflict.severity !== "blocking")}>Merge all safe conflicts</button>
              <button type="button" onClick={() => applyBulkResolution("skip", (conflict) => conflict.severity === "warning")}>Skip all warning conflicts</button>
            </div>
            {invalidConflictResolution ? <p className="backup-management__error">Cần xử lý blocking conflict hoặc nhập renameTo trước khi import thật.</p> : null}
            <div className="backup-management__conflict-list">
              {filteredConflicts.map((conflict) => {
                const current = conflictResolutions[conflict.id] || { conflictId: conflict.id, resolution: conflict.defaultResolution, renameTo: "" };
                return (
                  <article key={conflict.id}>
                    <header><strong>{conflict.section} • {conflict.entityType}</strong><span>{conflict.severity}</span></header>
                    <p>{conflict.entityKey} {conflict.label ? `• ${conflict.label}` : ""}</p>
                    <p>{conflict.reason}</p>
                    <p>Default: {conflict.defaultResolution}</p>
                    <label>Resolution
                      <select aria-label={`Resolution ${conflict.entityKey}`} value={current.resolution} onChange={(event) => updateConflictResolution(conflict.id, { resolution: event.target.value })}>
                        {conflict.allowedResolutions.map((resolution) => <option key={resolution} value={resolution}>{RESOLUTION_LABELS[resolution] || resolution}</option>)}
                      </select>
                    </label>
                    {current.resolution === "rename_source" ? <label>Rename to<input aria-label={`Rename ${conflict.entityKey}`} value={current.renameTo || ""} onChange={(event) => updateConflictResolution(conflict.id, { renameTo: event.target.value })} /></label> : null}
                    <details>
                      <summary>Field diffs</summary>
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
            <h4>Import {importResult.success ? "thành công" : "không thành công"}</h4>
            <p>BackupRun: {importResult.backupRun?.id || "-"}</p>
            {(importResult.appliedResolutions || []).length ? <p>Applied resolutions: {(importResult.appliedResolutions || []).map((item) => `${item.conflictId}:${item.resolution}${item.renameTo ? `→${item.renameTo}` : ""}`).join(", ")}</p> : null}
            {(importResult.warnings || []).map((item) => <p key={`import-warning-${item}`}>{item}</p>)}
            {(importResult.errors || []).map((item) => <p key={`import-error-${item}`} className="backup-management__error">{item}</p>)}
          </div>
        ) : null}
      </section>

      <section className="backup-management__summary" aria-label="Tổng quan trước sao lưu">
        {loading ? <p className="backup-management__note">Đang tải trạng thái backup...</p> : null}
        {summaryItems.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.description}</p></article>)}
      </section>

      <section className="backup-management__timeline" aria-label="Checklist readiness">
        <h3>Checklist readiness</h3>
        <ol>{checklistItems.map((item) => <li key={item.key}><div><h4>{item.label}</h4><p>{item.done ? "Hoàn tất" : "Chưa xong"}</p></div></li>)}</ol>
      </section>

      <section className="backup-management__data-grid" aria-label="Phạm vi backup metadata">
        <h3>Phạm vi backup metadata</h3>
        <div>{scopeItems.map((item) => <article key={item.key}><h4>{item.label}</h4><p>{item.enabled ? "Có trong phạm vi" : "Không bao gồm"}</p></article>)}</div>
      </section>

      <section className="backup-management__risk-grid" aria-label="Rủi ro trước khi backup">
        <h3>Rủi ro trước khi backup</h3>
        <div>{(readiness.risks || []).map((risk) => <article key={risk.key}><h4>{risk.label}</h4><p>{risk.description || "Không có mô tả."}</p><p>{risk.resolved ? "Đã xử lý" : "Cần xử lý"}</p></article>)}</div>
      </section>

      <section className="backup-management__timeline" aria-label="Lịch sử backup run metadata">
        <h3>5 backup runs gần nhất (metadata)</h3>
        <ol>{runs.length ? runs.map((run) => {
          const doneCount = toChecklistItems(run.checklist).filter((item) => item.done).length;
          const scopeCount = toScopeItems(run.scope).filter((item) => item.enabled).length;
          return <li key={run.id}><div><h4>{run.status || "unknown"} • {formatDate(run.createdAt)}</h4><p>Checklist: {doneCount}/{checklistItems.length} bước hoàn tất</p><p>Phạm vi: {scopeCount}/{scopeItems.length} hạng mục</p>{run.completedAt ? <p>Hoàn tất lúc: {formatDate(run.completedAt)}</p> : null}<p>Cập nhật: {formatDate(run.updatedAt)}</p>{run.note ? <p>Ghi chú: {run.note}</p> : null}</div></li>;
        }) : <li><div><p>Chưa có lịch sử backup runs.</p></div></li>}</ol>
      </section>
    </div>
  );
};

export default BackupManagement;
