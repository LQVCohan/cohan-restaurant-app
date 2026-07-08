// src/components/Dashboard_Manager/Storage/components/supplies/SupplyList.jsx
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Search, Filter, Plus, RefreshCw, PackageOpen, Layers, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@apollo/client";
import Button from "../../../../common/Button";
import SupplyCard from "./SupplyCard";
import SupplyModal from "./SupplyModal";
import useSupply from "../../../../../hooks/useSupply";
import { useNotification } from "@/hooks/useNotification";
import { getSupplyActionErrorMessage } from "@/utils/inventorySupplySupplierPrintErrorMessages";
import StockOutModal from "../modals/StockOutModal";
import StockTransferModal from "../modals/StockTransferModal";
import QuickStockModal from "../ingredients/QuickStockModal";
import { Q_SUPPLY_TRASH, M_RESTORE_SUPPLY } from "../../graphql/supply.gql";
import {
  buildSupplyReportFiles,
  downloadSupplyImportErrors,
  downloadSupplyReportsZip,
  downloadSupplyTemplate,
  exportSuppliesFile,
  parseSupplyImportFile,
  validateAndNormalizeSupplyRow,
} from "./supplyImportExport";
import { debounce } from "../../../../../utils/debounce";
import "./SupplyList.scss";

const SupplyList = ({ restaurantId, warehouseId = null, warehouses = [], warehousesLoading = false, onRegisterActions }) => {
  const { showNotification } = useNotification();
  const { supplies, supplyCategories, getStockItem, loading, error, handleCreate, handleUpdate, handleDelete, handleInbound, handleOutbound, handleTransfer, refresh } = useSupply(restaurantId, warehouseId);
  const { data: trashData, loading: trashLoading, refetch: refetchTrash } = useQuery(Q_SUPPLY_TRASH, {
    variables: { restaurantId, warehouseId, limit: 200 },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });
  const [restoreSupply] = useMutation(M_RESTORE_SUPPLY);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [current, setCurrent] = useState(null);
  const [mode, setMode] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmittingStockOut, setIsSubmittingStockOut] = useState(false);
  const [editing, setEditing] = useState(null);
  const [quickEntries, setQuickEntries] = useState([]);
  const [busyAction, setBusyAction] = useState("");
  const [viewMode, setViewMode] = useState("active");
  const [trashBusyId, setTrashBusyId] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    setSearchInput("");
    setSearch("");
    setCategory("");
    setUnit("");
    setViewMode("active");
  }, [restaurantId, warehouseId]);

  const applyDebouncedSearch = useMemo(() => debounce((nextValue) => setSearch(nextValue), 250), []);
  useEffect(() => { applyDebouncedSearch(searchInput); }, [searchInput, applyDebouncedSearch]);

  const formatNum = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0).toLocaleString("vi-VN");
  const filterList = useCallback((list, useAdvancedFilters = true) => {
    let next = list || [];
    if (search.trim()) {
      const q = normalizeSearchText(search);
      next = next.filter((s) => normalizeSearchText(s?.name).includes(q) || normalizeSearchText(getSupplyCode(s)).includes(q));
    }
    if (useAdvancedFilters && category) next = next.filter((s) => normalizeFilterKey(s?.category) === normalizeFilterKey(category));
    if (useAdvancedFilters && unit) next = next.filter((s) => normalizeFilterKey(s?.unit) === normalizeFilterKey(unit));
    return next;
  }, [category, search, unit]);

  const activeFiltered = useMemo(() => filterList(supplies, true), [filterList, supplies]);
  const trashFiltered = useMemo(() => filterList(trashData?.supplyTrash || [], false), [filterList, trashData?.supplyTrash]);
  const filtered = viewMode === "trash" ? trashFiltered : activeFiltered;

  const refreshLists = useCallback(async () => {
    await Promise.allSettled([refresh?.(), refetchTrash?.()]);
  }, [refresh, refetchTrash]);

  const remainingDays = (row) => {
    const expires = row?.deleteExpiresAt ? new Date(row.deleteExpiresAt) : null;
    if (!expires || Number.isNaN(expires.getTime())) return "Không xác định";
    const diffMs = expires.getTime() - Date.now();
    if (diffMs <= 0) return "Hết hạn khôi phục";
    return `Còn ${Math.ceil(diffMs / 86400000)} ngày`;
  };

  const openCreate = () => { setEditing(null); setIsModalOpen(true); };
  const openEdit = (supply) => { setEditing(supply); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const submitSupply = async (values) => {
    try {
      if (editing) await handleUpdate(editing.id, { ...values, restaurantId });
      else await handleCreate({ ...values, restaurantId });
      closeModal();
      await refreshLists();
    } catch (err) {
      showNotification(getSupplyActionErrorMessage(err, err?.message || "Không thể lưu vật tư."), "error");
      throw err;
    }
  };

  const moveToTrash = async (id) => {
    if (!window.confirm("Chuyển vật tư này vào thùng rác? Bạn có thể khôi phục trong 30 ngày.")) return;
    try {
      await handleDelete(id);
      await refreshLists();
      showNotification({
        message: "Đã chuyển vật tư vào thùng rác.",
        actionLabel: "Hoàn tác",
        onAction: async () => {
          try {
            await restoreSupply({ variables: { id } });
            await refreshLists();
            showNotification("Đã khôi phục vật tư.", "success");
          } catch (err) {
            showNotification(getSupplyActionErrorMessage(err, "Không thể khôi phục vật tư."), "error");
          }
        },
      }, "success", 8000);
    } catch (err) {
      showNotification(getSupplyActionErrorMessage(err, err?.message || "Không thể chuyển vật tư vào thùng rác."), "error");
    }
  };

  const restoreFromTrash = async (id) => {
    try {
      setTrashBusyId(id);
      await restoreSupply({ variables: { id } });
      await refreshLists();
      showNotification("Đã khôi phục vật tư từ thùng rác.", "success");
    } catch (err) {
      showNotification(getSupplyActionErrorMessage(err, "Không thể khôi phục vật tư."), "error");
    } finally {
      setTrashBusyId("");
    }
  };

  const requireWarehouse = () => {
    if (!warehouseId) { showNotification("Vui lòng chọn kho cụ thể để thực hiện nhập/xuất.", "warning"); return false; }
    return true;
  };
  const openIn = (s) => { if (!requireWarehouse()) return; setCurrent(s); setMode("in"); setQuickEntries([{ id: s.id, type: "supply", name: s.name, unit: s.unit }]); };
  const openOut = (s) => { if (requireWarehouse()) { setCurrent(s); setMode("out"); } };
  const openTransfer = (s) => { setCurrent(s); setMode("transfer"); };
  const closeStockModal = () => { setCurrent(null); setMode(null); setIsSubmittingStockOut(false); };

  const submitInbound = async (values) => {
    if (!current) return;
    try { await handleInbound({ restaurantId, warehouseId, supplyId: current.id, ...values }); showNotification("Nhập kho vật tư thành công.", "success"); closeStockModal(); }
    catch (err) { showNotification(getSupplyActionErrorMessage(err, err?.message || "Không thể nhập kho vật tư."), "error"); throw err; }
  };
  const submitOutbound = async (values) => {
    if (!current) return;
    const stockItem = getStockItem(current.id);
    const nQty = Number(values.qty || 0);
    if ((stockItem?.id && Number(stockItem?.onHand || 0) < nQty) || !stockItem?.id) {
      showNotification(!stockItem?.id ? "Vật tư này chưa có tồn kho tại kho đang chọn." : `Không đủ tồn kho để xuất. Tồn hiện tại: ${formatNum(stockItem?.onHand)}.`, "error");
      return;
    }
    setIsSubmittingStockOut(true);
    try { await handleOutbound({ restaurantId, warehouseId, supplyId: current.id, qty: values.qty, reason: values.reason }); showNotification("Xuất kho vật tư thành công.", "success"); closeStockModal(); }
    catch (err) { showNotification(getSupplyActionErrorMessage(err, toFriendlyOutboundError(err)), "error"); }
    finally { setIsSubmittingStockOut(false); }
  };
  const submitTransfer = async (values) => {
    if (!current) return;
    try { await handleTransfer({ restaurantId, supplyId: current.id, ...values }); showNotification("Chuyển kho vật tư thành công.", "success"); closeStockModal(); }
    catch (err) { showNotification(getSupplyActionErrorMessage(err, err?.message || "Không thể chuyển kho vật tư."), "error"); throw err; }
  };

  const handleTemplate = useCallback(() => { downloadSupplyTemplate(); showNotification("Đã tải file mẫu vật tư.", "success"); }, [showNotification]);
  const handleExport = useCallback((format = "xlsx") => { exportSuppliesFile({ supplies: activeFiltered, format }); showNotification(`Đã xuất danh sách vật tư (${format.toUpperCase()}).`, "success"); }, [activeFiltered, showNotification]);
  const handleReport = useCallback(() => { const files = buildSupplyReportFiles({ supplies: activeFiltered }); downloadSupplyReportsZip(files); showNotification("Đã xuất gói báo cáo vật tư (.zip).", "success"); }, [activeFiltered, showNotification]);
  const handleImportClick = useCallback(() => fileInputRef.current?.click(), []);

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try {
      setBusyAction("import");
      const parsedRows = await parseSupplyImportFile(file);
      if (!parsedRows.length) throw new Error("File import không có dòng dữ liệu hợp lệ.");
      const prepared = parsedRows.map(validateAndNormalizeSupplyRow);
      const fileErrors = prepared.filter((r) => r.errors.length).flatMap((r) => r.errors.map((reason) => ({ rowNo: r.normalized.rowNo, name: r.normalized.name, sku: r.normalized.sku, type: "VALIDATION", reason })));
      const existingBySku = new Map(); const existingByName = new Map();
      (supplies || []).forEach((item) => { const skuKey = normalizeFilterKey(item.sku || ""); const nameKey = normalizeSearchText(item.name || ""); if (skuKey) existingBySku.set(skuKey, item); if (nameKey) existingByName.set(nameKey, item); });
      let successCount = 0;
      for (const { normalized: row } of prepared) {
        if (fileErrors.some((err) => err.rowNo === row.rowNo)) continue;
        try {
          const target = row.skuKey ? existingBySku.get(row.skuKey) : existingByName.get(row.nameKey);
          const payload = { restaurantId, name: row.name, sku: row.sku || "", category: row.category, unit: row.unit, costPerUnit: row.costPerUnit, pricePerUnit: row.pricePerUnit, minStock: row.minStock, isActive: row.isActive, notes: row.notes };
          if (target?.id) { await handleUpdate(target.id, payload); if (row.openingStock > 0 && warehouseId) await handleInbound({ restaurantId, warehouseId, supplyId: target.id, qty: row.openingStock, reason: "Nhập tồn đầu kỳ vật tư từ Excel" }); }
          else { await handleCreate(payload); if (row.openingStock > 0) fileErrors.push({ rowNo: row.rowNo, name: row.name, sku: row.sku, type: "INFO", reason: "Đã tạo vật tư mới; vui lòng nhập tồn đầu kỳ bằng nút Nhập sau khi tạo." }); }
          successCount += 1;
        } catch (err) { fileErrors.push({ rowNo: row.rowNo, name: row.name, sku: row.sku, type: "PROCESS", reason: err?.message || "Không thể import dòng này" }); }
      }
      await refreshLists(); if (fileErrors.length) downloadSupplyImportErrors(fileErrors);
      showNotification(`Import vật tư hoàn tất: ${successCount} dòng thành công, ${fileErrors.length} dòng cần kiểm tra.`, fileErrors.length ? "warning" : "success");
    } catch (err) { showNotification(err?.message || "Import vật tư thất bại.", "error"); }
    finally { setBusyAction(""); }
  };

  const registeredActions = useMemo(() => ({ import: handleImportClick, exportXlsx: () => handleExport("xlsx"), exportCsv: () => handleExport("csv"), template: handleTemplate, report: handleReport, busy: Boolean(busyAction || loading) }), [busyAction, handleExport, handleImportClick, handleReport, handleTemplate, loading]);
  useEffect(() => { onRegisterActions?.(registeredActions); return () => onRegisterActions?.(null); }, [onRegisterActions, registeredActions]);
  const renderSkeletons = () => <div className="sl-grid">{[...Array(6)].map((_, i) => <div key={i} className="sl-skeleton-card" />)}</div>;

  return (
    <div className="supply-list-container">
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="sl-file-input" onChange={handleImportFile} />
      <div className="sl-toolbar"><div className="sl-toolbar__left"><div className="sl-input-group sl-search-box"><Search size={18} className="sl-icon" /><input aria-label="Tìm kiếm vật tư" type="text" placeholder={viewMode === "trash" ? "Tìm trong thùng rác..." : "Tìm kiếm vật tư..."} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} /></div>{viewMode === "active" && <><div className="sl-input-group sl-filter-box"><Filter size={16} className="sl-icon" /><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Tất cả danh mục</option><option value="drink">Nước uống</option><option value="tissue">Khăn giấy</option><option value="clean">Vệ sinh</option><option value="sauce">Gia vị</option><option value="other">Khác</option></select></div><div className="sl-input-group sl-filter-box"><Layers size={16} className="sl-icon" /><select value={unit} onChange={(e) => setUnit(e.target.value)}><option value="">Đơn vị</option><option value="unit">Cái</option><option value="piece">Mảnh</option><option value="pack">Gói</option><option value="bottle">Chai</option><option value="can">Lon</option></select></div></>}</div><div className="sl-toolbar__right" aria-label="Thao tác nhanh vật tư"><span className="sl-count-chip" title="Số vật tư đang hiển thị"><Layers size={14} aria-hidden="true" /><b>{formatNum(filtered.length)}</b><span>{viewMode === "trash" ? "trong thùng rác" : "vật tư"}</span></span><button className={`sl-btn-icon sl-btn-trash-toggle ${viewMode === "trash" ? "active" : ""}`} onClick={() => setViewMode((prev) => (prev === "active" ? "trash" : "active"))} type="button"><Trash2 size={16} /><span>{viewMode === "active" ? "Thùng rác" : "Danh sách"}</span></button><button className="sl-btn-icon sl-btn-refresh" onClick={refreshLists} disabled={loading || trashLoading} type="button" aria-label="Tải lại danh sách vật tư"><RefreshCw size={17} className={loading || trashLoading ? "spin" : ""} /></button><button type="button" onClick={openCreate} className="sl-btn-add" disabled={viewMode !== "active"}><Plus size={16} /><span>Thêm vật tư</span></button></div></div>
      <div className="sl-content">{error ? <div className="sl-state-box error"><p>Đã xảy ra lỗi: {error.message}</p><Button size="sm" onClick={refresh}>Thử lại</Button></div> : ((viewMode === "active" && loading) || (viewMode === "trash" && trashLoading)) ? renderSkeletons() : viewMode === "trash" ? (filtered.length === 0 ? <div className="sl-state-box empty"><div className="icon-circle"><Trash2 size={40} /></div><h3>Thùng rác vật tư đang trống</h3><p>Vật tư đã chuyển vào đây sẽ được giữ trong 30 ngày.</p></div> : <div className="sl-trash-list">{filtered.map((row) => <div className="sl-trash-item" key={row.id}><div className="sl-trash-info"><strong>{row.name}</strong><p>Chuyển lúc: {row.deletedAt ? new Date(row.deletedAt).toLocaleString("vi-VN") : "Không xác định"} • {remainingDays(row)}</p></div><button type="button" className="sl-btn-add sl-btn-restore" disabled={Boolean(trashBusyId)} onClick={() => restoreFromTrash(row.id)}>Khôi phục</button></div>)}</div>) : filtered.length === 0 ? <div className="sl-state-box empty"><div className="icon-circle"><PackageOpen size={40} /></div><h3>Không tìm thấy vật tư nào</h3><p>Thử thay đổi bộ lọc hoặc thêm vật tư mới</p><Button variant="primary" onClick={openCreate}>Thêm vật tư ngay</Button></div> : <div className="sl-grid">{filtered.map((supply) => <SupplyCard key={supply.id} supply={supply} stockItem={getStockItem(supply.id)} onEdit={() => openEdit(supply)} onDelete={async () => moveToTrash(supply.id)} onStockClick={openIn} onStockOutClick={openOut} onTransferClick={openTransfer} />)}</div>}</div>
      {isModalOpen && <SupplyModal isOpen onClose={closeModal} initial={editing} restaurantId={restaurantId} categoryOptions={supplyCategories} onSubmit={submitSupply} />}
      {mode === "in" && current && <QuickStockModal isOpen onClose={closeStockModal} entries={quickEntries} onSubmit={async (rows) => { try { await Promise.all(rows.map((row) => submitInbound({ qty: row.qty, costPerBaseUnit: Number(row.unitPrice) / Number(row.qty), lot: row.lot, expiry: row.expiry, supplier: row.supplier, reason: buildReason(row) }))); showNotification("Nhập kho vật tư thành công.", "success"); closeStockModal(); } catch (err) { showNotification(toFriendlyInboundError(err), "error"); } }} />}
      {mode === "out" && current && <StockOutModal isOpen onClose={closeStockModal} onConfirm={submitOutbound} supply={current} isSubmitting={isSubmittingStockOut} />}
      {mode === "transfer" && current && <StockTransferModal isOpen onClose={closeStockModal} onConfirm={submitTransfer} supply={current} warehouses={warehouses || []} />}
    </div>
  );
};
export default SupplyList;
function buildReason(row) { const parts = []; if (row.supplier) parts.push(`Nguồn: ${row.supplier}`); if (row.datetime) parts.push(`Thời gian: ${row.datetime}`); if (row.note) parts.push(`Ghi chú: ${row.note}`); return parts.join(" | ") || "Nhập kho nhanh"; }
function normalizeSearchText(value) { return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim(); }
function getSupplyCode(supply) { return supply?.sku || ""; }
function normalizeFilterKey(value) { return String(value || "").trim().toLowerCase(); }
function toFriendlyInboundError(error) { const graphQLErrors = error?.graphQLErrors || error?.networkError?.result?.errors || []; const message = graphQLErrors[0]?.message || error?.message || ""; const code = graphQLErrors[0]?.extensions?.code || ""; if (code === "BAD_USER_INPUT") return "Dữ liệu nhập kho chưa hợp lệ. Vui lòng kiểm tra lại."; if (/Invalid IDs/i.test(message)) return "Thông tin kho hoặc vật tư không hợp lệ."; if (/qty must be > 0/i.test(message)) return "Số lượng nhập phải lớn hơn 0."; return message.replace(/^GraphQL error:\s*/i, "").trim() || "Nhập kho vật tư thất bại."; }
function toFriendlyOutboundError(error) { const graphQLErrors = error?.graphQLErrors || error?.networkError?.result?.errors || []; const message = graphQLErrors[0]?.message || error?.message || ""; const code = graphQLErrors[0]?.extensions?.code || ""; const currentOnHand = graphQLErrors[0]?.extensions?.currentOnHand; if (code === "STOCK_ITEM_NOT_FOUND" || /Stock item not found/i.test(message)) return "Vật tư này chưa có tồn kho tại kho đang chọn."; if (code === "INSUFFICIENT_STOCK" || /Insufficient stock/i.test(message)) { if (Number.isFinite(Number(currentOnHand))) return `Không đủ tồn kho để xuất. Tồn hiện tại: ${Number(currentOnHand).toLocaleString("vi-VN")}.`; return "Không đủ tồn kho để xuất."; } if (code === "BAD_USER_INPUT") return "Dữ liệu xuất kho chưa hợp lệ. Vui lòng kiểm tra lại."; return message.replace(/^GraphQL error:\s*/i, "").trim() || "Xuất kho vật tư thất bại."; }
