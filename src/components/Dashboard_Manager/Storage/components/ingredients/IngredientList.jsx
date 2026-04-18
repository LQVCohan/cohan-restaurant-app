// src/components/Dashboard_Manager/Storage/components/ingredients/IngredientList.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Filter,
  Plus,
  X,
  PackageOpen,
  AlertCircle,
  ListFilter,
} from "lucide-react";
import { useApolloClient, useQuery } from "@apollo/client";
import IngredientCard from "./IngredientCard";
import IngredientModal from "./IngredientModal";
import QuickStockModal from "./QuickStockModal";
import IngredientCategoryManagerModal from "./IngredientCategoryManagerModal";
import { useIngredients } from "@/hooks/useIngredients";
import { useNotification } from "@/hooks/useNotification";
import { toIngredientCategoryVi } from "@/utils/ingredientCategoryI18n";
import {
  INGREDIENTS_QUERY,
  INGREDIENT_CATEGORIES_QUERY,
  STOCK_MOVEMENTS_QUERY,
} from "../../graphql/inventory.gql";
import {
  buildIngredientReportFiles,
  downloadImportErrors,
  downloadIngredientTemplate,
  downloadReportsZip,
  exportIngredientsFile,
  normalizeSku,
  normalizeText,
  parseIngredientImportFile,
  validateAndNormalizeImportRow,
} from "./ingredientImportExport";
import "./IngredientList.scss";

const IngredientList = ({
  restaurantId,
  selectedWarehouseId = undefined,
  activeCurrency = "VND",
  usdToVndRate = 26000,
  onRegisterActions,
}) => {
  const { showNotification } = useNotification();
  const {
    loading,
    error,
    filteredIngredients,
    filters,
    setFilters,
    addIngredient,
    updateIngredient,
    deleteIngredient,
    receiveStock,
    updateCostPerBaseUnit,
    getStockStatus,
    warehouses,
    effectiveWarehouseId,
    getPriceSuggestions,
    ingredientCategories,
    ingredientCategorySyncLogs,
    createIngredientCategory,
    updateIngredientCategory,
    deleteIngredientCategory,
    syncIngredientCategories,
    refetch,
  } = useIngredients(restaurantId, selectedWarehouseId, {
    withStock: true,
    withWarehouses: true,
  });

  const defaultWarehouseName = useMemo(() => {
    if (!warehouses?.length) return null;
    if (typeof effectiveWarehouseId !== "string") return null;
    const wh = warehouses.find((w) => w.id === effectiveWarehouseId);
    return wh?.name || null;
  }, [warehouses, effectiveWarehouseId]);

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const isEditing = Boolean(editingItem?.id);
  const [saving, setSaving] = useState(false);
  const [quickStockOpen, setQuickStockOpen] = useState(false);
  const [quickEntries, setQuickEntries] = useState([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const [busyAction, setBusyAction] = useState("");
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const fileInputRef = useRef(null);
  const apolloClient = useApolloClient();

  const { data: movementData } = useQuery(STOCK_MOVEMENTS_QUERY, {
    variables: {
      restaurantId,
      warehouseId:
        effectiveWarehouseId === undefined ? null : effectiveWarehouseId,
      limit: 1000,
      sort: -1,
    },
    skip: !restaurantId || effectiveWarehouseId === undefined,
    fetchPolicy: "cache-and-network",
  });
  const movements = useMemo(() => movementData?.stockMovements || [], [movementData]);

  // --- Handlers ---
  const handleSearch = (e) =>
    setFilters({ ...filters, search: e.target.value });
  const handleCategoryFilter = (e) =>
    setFilters({ ...filters, category: e.target.value });
  const handleStatusFilter = (e) =>
    setFilters({ ...filters, status: e.target.value });

  const clearFilters = () => {
    setFilters({ search: "", category: "", status: "" });
  };

  const hasActiveFilters = filters.search || filters.category || filters.status;

  const handleAddStock = async (id) => {
    const ing = filteredIngredients.find((i) => i.id === id);
    if (!ing) return;
    setQuickEntries([
      {
        id: ing.id,
        type: "ingredient",
        name: ing.name,
        unit: ing.baseUnit,
      },
    ]);
    setQuickStockOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa nguyên liệu này?")) return;
    try {
      await deleteIngredient(id);
      showNotification("Đã xoá nguyên liệu thành công.", "success");
    } catch (e) {
      showNotification(e?.message || "Có lỗi khi xóa nguyên liệu", "error");
    }
  };

  const openCreate = () => {
    setEditingItem(null);
    setShowModal(true);
  };

  const openEdit = (ingredient) => {
    setEditingItem(ingredient);
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setEditingItem(null);
  };

  const handleSubmit = async ({ payload, initialStockQty, isEditing: editing, id }) => {
    try {
      setSaving(true);
      if (editing && id) {
        await updateIngredient(id, { payload });
        showNotification("Đã cập nhật nguyên liệu.", "success");
      } else {
        await addIngredient({ payload, initialStockQty });
        showNotification("Đã thêm nguyên liệu mới.", "success");
      }
      setShowModal(false);
      setEditingItem(null);
    } catch (e) {
      showNotification(e?.message || "Có lỗi khi lưu nguyên liệu", "error");
    } finally {
      setSaving(false);
    }
  };

  const loadAllIngredients = async () => {
    const res = await apolloClient.query({
      query: INGREDIENTS_QUERY,
      variables: { restaurantId, search: null, limit: 1000 },
      fetchPolicy: "network-only",
    });
    return res?.data?.ingredients || [];
  };

  const resolveCategoryId = async (categoryName, categoryCache) => {
    const name = String(categoryName || "").trim();
    if (!name) return null;
    const key = normalizeText(name);
    if (categoryCache.has(key)) return categoryCache.get(key);

    await createIngredientCategory(name);
    const categoryRes = await apolloClient.query({
      query: INGREDIENT_CATEGORIES_QUERY,
      variables: { restaurantId, includeInactive: false, limit: 500 },
      fetchPolicy: "network-only",
    });
    const found = (categoryRes?.data?.ingredientCategories || []).find(
      (cat) => normalizeText(cat.name) === key
    );
    if (found?.id) {
      categoryCache.set(key, found.id);
      return found.id;
    }
    return null;
  };

  const handleTemplate = async () => {
    downloadIngredientTemplate();
    showNotification("Đã tải file mẫu nguyên liệu.", "success");
  };

  const handleExport = async (format = "xlsx") => {
    exportIngredientsFile({
      ingredients: filteredIngredients,
      format,
      warehouseLabel:
        effectiveWarehouseId === null
          ? "Tất cả kho"
          : defaultWarehouseName || "Chưa chọn kho",
    });
    showNotification(`Đã xuất danh sách nguyên liệu (${format.toUpperCase()}).`, "success");
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setBusyAction("import");
      const parsedRows = await parseIngredientImportFile(file);
      if (!parsedRows.length) throw new Error("File import không có dòng dữ liệu hợp lệ.");

      const prepared = parsedRows.map(validateAndNormalizeImportRow);
      const normalizedRows = prepared.map((r) => r.normalized);
      const fileErrors = prepared
        .filter((r) => r.errors.length)
        .flatMap((r) =>
          r.errors.map((reason) => ({
            rowNo: r.normalized.rowNo,
            name: r.normalized.name,
            sku: r.normalized.sku,
            type: "VALIDATION",
            reason,
          }))
        );

      const hasOpeningStock = normalizedRows.some((r) => r.openingStock > 0);
      if (hasOpeningStock && typeof effectiveWarehouseId !== "string") {
        throw new Error(
          "File có tồn đầu kỳ > 0. Vui lòng chọn 1 kho cụ thể (không ở chế độ Tất cả kho)."
        );
      }

      const existingIngredients = await loadAllIngredients();
      const bySku = new Map();
      const byName = new Map();
      existingIngredients.forEach((ing) => {
        const skuKey = normalizeSku(ing.sku || "");
        const nameKey = normalizeText(ing.name || "");
        if (skuKey) bySku.set(skuKey, ing);
        if (nameKey) byName.set(nameKey, ing);
      });

      const categoryCache = new Map(
        (ingredientCategories || []).map((cat) => [normalizeText(cat.name), cat.id])
      );

      let successCount = 0;
      for (const row of normalizedRows) {
        if (fileErrors.some((err) => err.rowNo === row.rowNo)) continue;

        try {
          const matchBySku = row.skuKey ? bySku.get(row.skuKey) : null;
          const matchByName = byName.get(row.nameKey) || null;
          if (matchBySku && matchByName && String(matchBySku.id) !== String(matchByName.id)) {
            fileErrors.push({
              rowNo: row.rowNo,
              name: row.name,
              sku: row.sku,
              type: "CONFLICT",
              reason: "SKU trỏ tới bản ghi khác với tên nguyên liệu.",
            });
            continue;
          }

          const target = matchBySku || matchByName;
          const ingredientCategoryId = await resolveCategoryId(row.categoryName, categoryCache);
          const payload = {
            name: row.name,
            sku: row.sku || null,
            category: row.categoryName || "",
            ingredientCategoryId,
            baseUnit: row.baseUnit,
            conversions: target?.conversions || [],
            costPerBaseUnit: row.costPerBaseUnit,
            photos: target?.photos || [],
            minStock: row.minStock,
            notes: row.notes,
            isActive: row.isActive,
          };

          if (target?.id) {
            await updateIngredient(target.id, { payload });
            if (row.openingStock > 0) {
              await receiveStock(target.id, {
                qty: row.openingStock,
                unit: row.baseUnit,
                unitPrice: row.openingStock * row.costPerBaseUnit,
                reason: "Nhập tồn đầu kỳ từ Excel",
                lot: "INIT-IMPORT",
              });
            }
          } else {
            await addIngredient({ payload, initialStockQty: row.openingStock });
          }
          successCount += 1;
        } catch (err) {
          fileErrors.push({
            rowNo: row.rowNo,
            name: row.name,
            sku: row.sku,
            type: "PROCESS",
            reason: err?.message || "Không thể import dòng này",
          });
        }
      }

      await refetch?.();
      if (fileErrors.length) downloadImportErrors(fileErrors);

      showNotification(
        `Import hoàn tất: ${successCount} dòng thành công, ${fileErrors.length} dòng lỗi.`,
        fileErrors.length ? "warning" : "success"
      );
    } catch (e) {
      showNotification(e?.message || "Import thất bại.", "error");
    } finally {
      setBusyAction("");
    }
  };

  const applyPreset = (preset) => {
    const now = new Date();
    let start = new Date(now);
    if (preset === "7d") start.setDate(now.getDate() - 6);
    if (preset === "30d") start.setDate(now.getDate() - 29);
    if (preset === "month") start = new Date(now.getFullYear(), now.getMonth(), 1);
    setReportFrom(start.toISOString().slice(0, 10));
    setReportTo(now.toISOString().slice(0, 10));
  };

  const openReportModal = () => {
    applyPreset("30d");
    setReportModalOpen(true);
  };

  const handleGenerateReport = async () => {
    try {
      setBusyAction("report");
      const from = reportFrom || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
      const to = reportTo || new Date().toISOString().slice(0, 10);
      const inRangeMovements = movements.filter((m) => {
        const d = String(m.createdAt || "").slice(0, 10);
        return d >= from && d <= to;
      });

      const files = buildIngredientReportFiles({
        ingredients: filteredIngredients,
        movements: inRangeMovements,
        fromDate: from,
        toDate: to,
        warehouseLabel:
          effectiveWarehouseId === null
            ? "Tất cả kho"
            : defaultWarehouseName || "Chưa chọn kho",
      });

      downloadReportsZip(files);
      setReportModalOpen(false);
      showNotification("Đã xuất gói báo cáo nguyên liệu (.zip).", "success");
    } catch (e) {
      showNotification(e?.message || "Không thể xuất báo cáo.", "error");
    } finally {
      setBusyAction("");
    }
  };

  useEffect(() => {
    onRegisterActions?.({
      import: handleImportClick,
      exportXlsx: () => handleExport("xlsx"),
      exportCsv: () => handleExport("csv"),
      template: handleTemplate,
      report: openReportModal,
      busy: Boolean(busyAction),
    });
    return () => onRegisterActions?.(null);
  }, [
    busyAction,
    onRegisterActions,
    filteredIngredients,
    effectiveWarehouseId,
    defaultWarehouseName,
    handleExport,
    handleTemplate,
    openReportModal,
  ]);

  const canInitStock =
    !isEditing &&
    typeof effectiveWarehouseId === "string" &&
    Boolean(defaultWarehouseName);

  return (
    <div className="ing-storage-wrapper">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: "none" }}
        onChange={handleImportFile}
      />
      {/* 1. Header Section */}
      <div className="il-header">
        <div className="il-header__left">
          <h2>Danh sách nguyên liệu</h2>
          <span className="il-badge">
            {loading ? "..." : filteredIngredients.length}
          </span>
        </div>

        {(effectiveWarehouseId === null ||
          effectiveWarehouseId === undefined) && (
          <div className="il-header__alert">
            <AlertCircle size={16} />
            <span>
              {effectiveWarehouseId === null
                ? "Đang xem toàn bộ kho"
                : "Chưa chọn kho hàng"}
            </span>
          </div>
        )}
      </div>

      {/* 2. Toolbar Actions */}
      <div className="il-toolbar">
        <div className="il-toolbar__filters">
          {/* Search Input */}
          <div className="il-input-group">
            <Search size={18} className="il-icon-left" />
            <input
              type="text"
              className="il-input-search"
              placeholder="Tìm tên, mã nguyên liệu..."
              value={filters.search}
              onChange={handleSearch}
            />
            {filters.search && (
              <button
                className="il-btn-clear"
                onClick={() => setFilters({ ...filters, search: "" })}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="il-select-group">
            <Filter size={16} className="il-icon-left" />
            <select
              className="il-select"
              value={filters.category}
              onChange={handleCategoryFilter}
            >
              <option value="">Tất cả danh mục</option>
              {(ingredientCategories || []).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {toIngredientCategoryVi(cat.name)}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="il-select-group">
            <ListFilter size={16} className="il-icon-left" />
            <select
              className="il-select"
              value={filters.status}
              onChange={handleStatusFilter}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="in-stock">Còn hàng</option>
              <option value="low-stock">Sắp hết</option>
              <option value="out-of-stock">Hết hàng</option>
            </select>
          </div>

          {/* Reset Button */}
          {hasActiveFilters && (
            <button
              className="il-btn-icon"
              onClick={clearFilters}
              title="Xóa bộ lọc"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="il-toolbar__actions">
          <button
            className="il-btn-icon"
            onClick={() => setCategoryModalOpen(true)}
            title="Quản lý danh mục"
          >
            Danh mục
          </button>
          <button
            className="il-btn-primary"
            onClick={openCreate}
            disabled={!restaurantId || saving}
          >
            <Plus size={18} /> Thêm mới
          </button>
        </div>
      </div>

      {/* 3. Content Area */}
      <div className="il-content">
        {error && (
          <div className="il-error">
            <AlertCircle size={20} />
            <span>{error.message}</span>
          </div>
        )}

        {loading ? (
          <div className="il-empty">
            <div
              className="spinner"
              style={{
                display: "inline-block",
                width: 30,
                height: 30,
                border: "3px solid #ccc",
                borderTopColor: "#333",
                borderRadius: "50%",
                animation: "spin 1s infinite",
              }}
            ></div>
            <p>Đang tải dữ liệu...</p>
          </div>
        ) : filteredIngredients.length > 0 ? (
          <div className="il-grid">
            {filteredIngredients.map((ingredient) => (
              <IngredientCard
                key={ingredient.id}
                ingredient={ingredient}
                currency={activeCurrency}
                usdToVndRate={usdToVndRate}
                onEdit={() => openEdit(ingredient)}
                onDelete={handleDelete}
                onAddStock={handleAddStock}
                onShowUsage={undefined}
                getStockStatus={getStockStatus}
                onUpdateCostPerBaseUnit={updateCostPerBaseUnit}
              />
            ))}
          </div>
        ) : (
          <div className="il-empty">
            <div className="il-empty__icon">
              <PackageOpen size={48} />
            </div>
            <h3>Không tìm thấy nguyên liệu</h3>
            <p>
              {hasActiveFilters
                ? "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."
                : "Danh sách trống. Hãy thêm nguyên liệu đầu tiên!"}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters}>Xóa tất cả bộ lọc</button>
            )}
          </div>
        )}
      </div>

      <IngredientModal
        isOpen={showModal}
        onClose={closeModal}
        initial={editingItem}
        isEditing={isEditing}
        onSubmit={handleSubmit}
        canInitStock={canInitStock}
        defaultWarehouseName={defaultWarehouseName}
        saving={saving}
        currency={activeCurrency}
        usdToVndRate={usdToVndRate}
        categoryOptions={ingredientCategories}
      />

      <QuickStockModal
        isOpen={quickStockOpen}
        onClose={() => setQuickStockOpen(false)}
        entries={quickEntries}
        ingredients={filteredIngredients}
        onGetPriceSuggestions={getPriceSuggestions}
        currency={activeCurrency}
        usdToVndRate={usdToVndRate}
        onSubmit={async (rows) => {
          if (!rows?.length) {
            showNotification("Danh sách nhập kho đang trống.", "warning");
            return;
          }

          await Promise.all(
            rows.map((row) =>
              receiveStock(row.id, {
                qty: row.qty,
                unit: row.unit,
                unitPrice: row.unitPrice,
                reason: buildReason(row),
                lot: row.lot,
                expiry: row.expiry,
                supplierNote: row.supplier,
              })
            )
          );

          setQuickStockOpen(false);
          showNotification(
            `Nhập kho thành công ${rows.length} nguyên liệu.`,
            "success"
          );
        }}
      />

      <IngredientCategoryManagerModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        categories={ingredientCategories}
        syncLogs={ingredientCategorySyncLogs}
        onCreate={async (name) => {
          await createIngredientCategory(name);
          showNotification("Đã thêm danh mục.", "success");
        }}
        onRename={async (id, name) => {
          await updateIngredientCategory(id, { name });
          showNotification("Đã đổi tên danh mục.", "success");
        }}
        onDelete={async (id) => {
          await deleteIngredientCategory(id);
          showNotification("Đã xóa danh mục.", "success");
        }}
        onSync={async () => {
          const report = await syncIngredientCategories();
          showNotification(
            report?.summaryText || "Đã đồng bộ danh mục từ nguyên liệu.",
            "success"
          );
          return report;
        }}
      />

      {reportModalOpen && (
        <div className="il-report-modal-overlay">
          <div className="il-report-modal">
            <h3>Xuất báo cáo nguyên liệu</h3>
            <div className="il-report-preset">
              <button onClick={() => applyPreset("7d")}>7 ngày</button>
              <button onClick={() => applyPreset("30d")}>30 ngày</button>
              <button onClick={() => applyPreset("month")}>Tháng này</button>
            </div>
            <div className="il-report-range">
              <label>Từ ngày</label>
              <input
                type="date"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
              />
              <label>Đến ngày</label>
              <input
                type="date"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
              />
            </div>
            <div className="il-report-actions">
              <button className="il-btn-icon" onClick={() => setReportModalOpen(false)}>
                Huỷ
              </button>
              <button
                className="il-btn-primary"
                disabled={busyAction === "report"}
                onClick={handleGenerateReport}
              >
                Xuất .zip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function buildReason(row) {
  const parts = [];
  if (row.supplier) parts.push(`Nguồn: ${row.supplier}`);
  if (row.datetime) parts.push(`Thời gian: ${row.datetime}`);
  if (row.note) parts.push(`Ghi chú: ${row.note}`);
  return parts.join(" | ") || "Nhập bổ sung";
}

export default IngredientList;
