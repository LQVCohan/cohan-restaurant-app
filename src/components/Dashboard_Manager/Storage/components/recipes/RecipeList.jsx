// src/components/Dashboard_Manager/Storage/components/recipes/RecipeList.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, ChefHat, Clock, Filter, X, AlertCircle, Loader2, Trash2, RotateCcw } from "lucide-react";
import { useMutation, useQuery } from "@apollo/client";
import RecipeCard from "./RecipeCard";
import RecipeModal from "./RecipeModal";
import RecipeDetailModal from "./RecipeDetailModal";
import RecipeDishPickerModal from "./RecipeDishPickerModal";
import { Q_RECIPE_TRASH, M_RESTORE_RECIPE } from "../../graphql/recipeTrash.gql";
import {
  buildRecipeImportPayloads,
  buildRecipeReportFiles,
  downloadRecipeImportErrors,
  downloadRecipeReportsZip,
  downloadRecipeTemplate,
  exportRecipesFile,
  parseRecipeImportFile,
} from "./recipeImportExport";
import { useNotification } from "@/hooks/useNotification";
import { toBaseQty } from "../../../../../utils/unitConversion";
import "./RecipeList.scss";
import "./RecipeTrashFlow.css";

const getVariantLines = (v) => {
  if (!v) return [];
  if (Array.isArray(v.ingredients)) return v.ingredients;
  if (Array.isArray(v.Ingredients)) return v.Ingredients;
  if (Array.isArray(v.components)) return v.components;
  if (Array.isArray(v.recipeItems)) return v.recipeItems;
  return [];
};

const normalizeLineQty = (line) => {
  const q = Number(line?.qty ?? line?.quantify ?? line?.quantity ?? 0);
  return Number.isFinite(q) ? q : 0;
};

const normalizeUnitCost = (line) => {
  const c = Number(line?.costPerBaseUnit ?? line?.unitCost ?? 0);
  return Number.isFinite(c) ? c : 0;
};

const calcVariantCost = (variant, ingredientById) => {
  const lines = getVariantLines(variant);
  let hasCostLine = false;
  let estimatedCostValid = true;
  const total = lines.reduce((sum, line) => {
    const qty = normalizeLineQty(line);
    const wastePct = Number(line?.wastePct) || 0;
    const unitCost = normalizeUnitCost(line);
    if (qty <= 0 || unitCost <= 0) return sum;

    const ingredient = ingredientById.get(String(line?.ingredientId || ""));
    const baseUnit = line?.baseUnit || ingredient?.baseUnit || line?.unit;
    const qtyBase = toBaseQty(
      qty,
      line?.unit || baseUnit,
      baseUnit,
      ingredient?.conversions || [],
    );
    if (!Number.isFinite(qtyBase) || qtyBase <= 0) {
      estimatedCostValid = false;
      return sum;
    }

    hasCostLine = true;
    return sum + qtyBase * (1 + wastePct / 100) * unitCost;
  }, 0);
  return { total, hasCostLine, estimatedCostValid };
};

const calcMinCost = (recipe, ingredientById, canDetectMissingIngredients) => {
  const variants = Array.isArray(recipe?.servingVariants) ? recipe.servingVariants : [];
  if (!variants.length) return { minCost: 0, hasAnyCost: false, estimatedCostValid: true, hasNoReplacementIngredient: false };
  let estimatedCostValid = true;
  let hasNoReplacementIngredient = false;
  const costs = variants
    .map((variant) => {
      const lines = getVariantLines(variant);
      const hasMissingReplacement = canDetectMissingIngredients
        ? lines.some((line) => {
            const id = String(line?.ingredientId || "").trim();
            return id && !ingredientById.has(id);
          })
        : false;
      if (hasMissingReplacement) {
        estimatedCostValid = false;
        hasNoReplacementIngredient = true;
        return 0;
      }
      const result = calcVariantCost(variant, ingredientById);
      if (!result.estimatedCostValid) estimatedCostValid = false;
      return result.hasCostLine ? result.total : 0;
    })
    .filter((n) => n > 0);
  if (!estimatedCostValid) return { minCost: 0, hasAnyCost: false, estimatedCostValid: false, hasNoReplacementIngredient };
  if (!costs.length) return { minCost: 0, hasAnyCost: false, estimatedCostValid: true, hasNoReplacementIngredient: false };
  return { minCost: Math.min(...costs), hasAnyCost: true, estimatedCostValid: true, hasNoReplacementIngredient: false };
};

const hasRecipeData = (row) => {
  if (!row) return false;
  const variants = Array.isArray(row?.servingVariants) ? row.servingVariants : [];
  return Boolean(row?.recipeId || row?.hasRecipe || row?._meta?.hasRecipe || variants.length || row?.components?.length || row?.recipeItems?.length);
};

const getMenuItemPrice = (item, fallback = 0) => Number(item?.price ?? item?.basePrice ?? item?.menuPrice ?? fallback ?? 0);

const normalizeMenuItemFromDishRow = (row) => {
  const raw = row?._rawMenuItem || row || {};
  return {
    ...raw,
    id: raw.id || row?.id || row?.menuItemId || "",
    name: raw.name || row?.name || row?.menuItemName || "Chưa có tên",
    code: raw.code || raw.sku || row?.code || row?.sku || "",
    description: raw.description || row?.description || row?.menuItemDescription || "",
    price: getMenuItemPrice(raw, getMenuItemPrice(row)),
    basePrice: getMenuItemPrice(raw, getMenuItemPrice(row)),
    menuPrice: getMenuItemPrice(raw, getMenuItemPrice(row)),
    status: raw.status || row?.status || "ACTIVE",
    imageUrl: raw.imageUrl || raw.image || row?.imageUrl || row?.image || "",
  };
};

const getRemainingDaysLabel = (row) => {
  const expires = row?.deleteExpiresAt ? new Date(row.deleteExpiresAt) : null;
  if (!expires || Number.isNaN(expires.getTime())) return "Không xác định";
  const diffMs = expires.getTime() - Date.now();
  if (diffMs <= 0) return "Hết hạn khôi phục";
  return `Còn ${Math.ceil(diffMs / 86400000)} ngày`;
};

const RecipeList = ({
  restaurantId,
  recipes = [],
  loading = false,
  error = null,
  pageInfo = { hasNextPage: false },
  total,
  onTimeSlotChange,
  onSearchChange,
  onCategoryChange,
  loadMore,
  onAddRecipe,
  onUpdateRecipe,
  onDeleteRecipe,
  onRecipeRestored,
  onRegisterActions,
  ingredients = [],
  categoryOptions = [],
  activeCurrency = "VND",
  usdToVndRate = 26000,
}) => {
  const { showNotification } = useNotification();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [viewMode, setViewMode] = useState("active");
  const [trashBusyId, setTrashBusyId] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDishPicker, setShowDishPicker] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [viewingRecipe, setViewingRecipe] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const fileInputRef = useRef(null);

  const { data: trashData, loading: trashLoading, refetch: refetchTrash } = useQuery(Q_RECIPE_TRASH, {
    variables: { restaurantId, limit: 200 },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });
  const [restoreRecipeMu] = useMutation(M_RESTORE_RECIPE);

  const recipesWithMeta = useMemo(() => {
    const ingredientById = new Map(
      (ingredients || []).map((ingredient) => [String(ingredient?.id || ""), ingredient]),
    );
    const ingredientIdSet = new Set([...ingredientById.keys()].filter(Boolean));
    const categoryLabelById = new Map(
      (categoryOptions || []).map((option) => [String(option?.value || ""), option?.label]),
    );
    const canDetectMissingIngredients = ingredientIdSet.size > 0;

    return (recipes || []).map((r) => {
      const variants = (Array.isArray(r?.servingVariants) ? r.servingVariants : []).map((variant) => {
        const lines = getVariantLines(variant).map((line) => {
          const ingredient = ingredientById.get(String(line?.ingredientId || ""));
          return {
            ...line,
            ingredientName: line?.ingredientName || line?.name || ingredient?.name || "",
            name: line?.name || line?.ingredientName || ingredient?.name || "",
            unit: line?.unit || line?.baseUnit || ingredient?.baseUnit || "",
            baseUnit: line?.baseUnit || ingredient?.baseUnit || "",
            costPerBaseUnit:
              line?.costPerBaseUnit ?? line?.unitCost ?? ingredient?.costPerBaseUnit ?? 0,
          };
        });
        return { ...variant, ingredients: lines, components: lines };
      });
      const normalizedRecipe = {
        ...r,
        category:
          r?.category ||
          categoryLabelById.get(String(r?.categoryId || "")) ||
          (r?.categoryId ? "Đã phân loại" : ""),
        servingVariants: variants,
      };
      const ids = new Set();
      const missingIds = new Set();
      variants.forEach((v) => {
        getVariantLines(v).forEach((c) => {
          const id = c?.ingredientId;
          if (!id) return;
          const normalizedId = String(id);
          ids.add(normalizedId);
          if (canDetectMissingIngredients && !ingredientIdSet.has(normalizedId)) missingIds.add(normalizedId);
        });
      });
      const { minCost, hasAnyCost, estimatedCostValid, hasNoReplacementIngredient } = calcMinCost(normalizedRecipe, ingredientById, canDetectMissingIngredients);
      const hasRecipe = variants.length > 0 || Boolean(r?.hasRecipe || r?.recipeId);
      return {
        ...normalizedRecipe,
        _meta: {
          hasRecipe,
          totalVariants: variants.length,
          totalIngredients: ids.size,
          minCost,
          hasAnyCost,
          hasMissingCost: hasRecipe && estimatedCostValid && !hasAnyCost,
          hasMissingIngredient: missingIds.size > 0,
          hasNoReplacementIngredient,
          estimatedCostValid,
          missingIngredientCount: missingIds.size,
          missingIngredientIds: Array.from(missingIds),
          canDetectMissingIngredients,
        },
      };
    });
  }, [recipes, ingredients, categoryOptions]);

  const recipeTrashRows = useMemo(() => {
    return (trashData?.recipeTrash || []).map((row) => {
      const recipe = row?.recipe || {};
      const menuItem = row?.menuItem || {};
      const menuItemId = String(recipe?.menuItemId || menuItem?.id || "");
      return {
        id: menuItemId || String(recipe?.id || ""),
        menuItemId,
        name: menuItem?.name || "Món không xác định",
        description: menuItem?.description || "",
        deletedAt: recipe?.deletedAt,
        deleteExpiresAt: recipe?.deleteExpiresAt,
        recipe,
        menuItem,
      };
    });
  }, [trashData?.recipeTrash]);

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    onSearchChange?.(viewMode === "active" && val?.trim() ? val : null);
  };
  const handleCategoryFilter = (e) => { const val = e.target.value; setCategory(val); onCategoryChange?.(val || null); };
  const handleTimeSlotFilter = (e) => { const val = e.target.value; setTimeSlot(val); onTimeSlotChange?.(val || null); };
  const clearFilters = () => { setSearch(""); setCategory(""); setTimeSlot(""); onSearchChange?.(null); onCategoryChange?.(null); onTimeSlotChange?.(null); };
  const hasActiveFilters = search || category || timeSlot;

  const handleAdd = () => { setEditingRecipe(null); setSelectedMenuItem(null); setShowDishPicker(true); };
  const handlePickDishForCreate = (row) => { const nextMenuItem = normalizeMenuItemFromDishRow(row); setSelectedMenuItem(nextMenuItem); setEditingRecipe(hasRecipeData(row) ? row : null); setShowDishPicker(false); setShowModal(true); };
  const handleEdit = (menuItemId) => { const r = (recipesWithMeta || []).find((x) => x.id === menuItemId); setEditingRecipe(r || null); setSelectedMenuItem(r ? normalizeMenuItemFromDishRow(r) : null); setShowModal(true); };
  const handleViewDetails = (menuItemId) => { const r = (recipesWithMeta || []).find((x) => x.id === menuItemId); setViewingRecipe(r || null); setShowDetailModal(true); };

  const restoreFromTrash = async (menuItemId) => {
    try {
      setTrashBusyId(menuItemId);
      await restoreRecipeMu({ variables: { restaurantId, menuItemId } });
      await Promise.allSettled([refetchTrash?.(), onRecipeRestored?.()]);
      showNotification("Đã khôi phục công thức.", "success");
    } catch (err) {
      showNotification(err?.message || "Không thể khôi phục công thức.", "error");
    } finally {
      setTrashBusyId("");
    }
  };

  const handleDelete = async (menuItemId) => {
    if (!window.confirm("Chuyển công thức này vào thùng rác? Bạn có thể khôi phục trong 30 ngày.")) return;
    await onDeleteRecipe?.(menuItemId);
    await refetchTrash?.();
    showNotification({
      message: "Đã chuyển công thức vào thùng rác.",
      actionLabel: "Hoàn tác",
      onAction: () => restoreFromTrash(menuItemId),
    }, "success", 8000);
  };

  const handleSave = async (formData) => {
    const payload = {
      ...formData,
      servingVariants: formData?.servingVariants || formData?.variants || [],
    };
    if (editingRecipe && hasRecipeData(editingRecipe)) await onUpdateRecipe?.(editingRecipe.id, payload);
    else await onAddRecipe?.(payload);
    setShowModal(false); setEditingRecipe(null); setSelectedMenuItem(null); await refetchTrash?.();
  };

  const handleTemplate = useCallback(() => { downloadRecipeTemplate(); showNotification("Đã tải file mẫu công thức.", "success"); }, [showNotification]);
  const handleExport = useCallback((format = "xlsx") => { exportRecipesFile({ recipes: recipesWithMeta, format }); showNotification(`Đã xuất danh sách công thức (${format.toUpperCase()}).`, "success"); }, [recipesWithMeta, showNotification]);
  const handleReport = useCallback(() => { const files = buildRecipeReportFiles({ recipes: recipesWithMeta }); downloadRecipeReportsZip(files); showNotification("Đã xuất gói báo cáo công thức (.zip).", "success"); }, [recipesWithMeta, showNotification]);
  const handleImportClick = useCallback(() => fileInputRef.current?.click(), []);
  const handleImportFile = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try {
      setBusyAction("import");
      const rows = await parseRecipeImportFile(file);
      if (!rows.length) throw new Error("File nhập không có dòng dữ liệu hợp lệ.");
      const { payloads, errors } = buildRecipeImportPayloads(rows, recipesWithMeta);
      let successCount = 0; const fileErrors = [...errors];
      for (const item of payloads) {
        try { await onUpdateRecipe?.(item.menuItemId, item.formData); successCount += 1; }
        catch (err) { fileErrors.push({ rowNo: "", menuItemId: item.menuItemId, ingredientId: "", type: "PROCESS", reason: err?.message || "Không thể nhập công thức này" }); }
      }
      if (fileErrors.length) downloadRecipeImportErrors(fileErrors);
      showNotification(`Nhập công thức hoàn tất: ${successCount} món thành công, ${fileErrors.length} dòng cần kiểm tra.`, fileErrors.length ? "warning" : "success");
    } catch (err) { showNotification(err?.message || "Nhập công thức thất bại.", "error"); }
    finally { setBusyAction(""); }
  };

  const registeredActions = useMemo(() => ({ import: handleImportClick, exportXlsx: () => handleExport("xlsx"), exportCsv: () => handleExport("csv"), template: handleTemplate, report: handleReport, busy: Boolean(busyAction || loading) }), [busyAction, handleExport, handleImportClick, handleReport, handleTemplate, loading]);
  useEffect(() => { onRegisterActions?.(registeredActions); return () => onRegisterActions?.(null); }, [onRegisterActions, registeredActions]);
  const handleModalClose = () => { setShowModal(false); setEditingRecipe(null); setSelectedMenuItem(null); };

  const renderTrash = () => {
    const q = search.trim().toLowerCase();
    const rows = q ? recipeTrashRows.filter((r) => String(r.name || "").toLowerCase().includes(q)) : recipeTrashRows;
    if (trashLoading) return <div className="rl-loading-state"><Loader2 className="spinner" size={32} /><p>Đang tải thùng rác công thức...</p></div>;
    if (!rows.length) return <div className="rl-empty-state"><div className="rl-empty-icon"><Trash2 strokeWidth={1} /></div><h3>Thùng rác công thức đang trống</h3><p>Công thức đã chuyển vào đây sẽ được giữ trong 30 ngày.</p></div>;
    return <div className="rl-trash-list">{rows.map((row) => <div className="rl-trash-item" key={row.id}><div className="rl-trash-main"><strong>{row.name}</strong><span>{row.description || "Không có mô tả"}</span><p>Chuyển lúc: {row.deletedAt ? new Date(row.deletedAt).toLocaleString("vi-VN") : "Không xác định"} • {getRemainingDaysLabel(row)}</p></div><button type="button" className="rl-btn-secondary rl-btn-restore" disabled={Boolean(trashBusyId)} onClick={() => restoreFromTrash(row.menuItemId)}><RotateCcw size={15} /> Khôi phục</button></div>)}</div>;
  };

  return (
    <div className="rl-container">
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="rl-file-input" onChange={handleImportFile} />
      <header className="rl-header"><div className="rl-header-left"><div className="rl-title-group"><h2 className="rl-title">Công thức món ăn</h2><span className="rl-badge">{viewMode === "trash" ? `${recipeTrashRows.length} đã xóa` : `${typeof total === "number" ? total : recipes.length} món`}</span></div><p className="rl-subtitle">Quản lý định lượng, biến thể và giá vốn của từng món.</p></div></header>
      <div className="rl-toolbar"><div className="rl-toolbar-filters"><div className="rl-input-group"><Search className="rl-icon-left" size={18} /><input aria-label="Tìm kiếm công thức" type="text" className="rl-input-search" placeholder={viewMode === "trash" ? "Tìm trong thùng rác..." : "Tìm món ăn..."} value={search} onChange={handleSearch} />{search && <button type="button" className="rl-btn-clear" onClick={() => { setSearch(""); onSearchChange?.(null); }}><X size={14} /></button>}</div>{viewMode === "active" && <><div className="rl-select-group"><Filter className="rl-icon-left" size={16} /><select className="rl-select" value={category} onChange={handleCategoryFilter}><option value="">Tất cả danh mục</option>{categoryOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div><div className="rl-select-group"><Clock className="rl-icon-left" size={16} /><select className="rl-select" value={timeSlot} onChange={handleTimeSlotFilter}><option value="">Tất cả khung giờ</option><option value="breakfast">Bữa sáng</option><option value="lunch">Bữa trưa</option><option value="dinner">Bữa tối</option><option value="late_night">Bữa khuya</option></select></div>{hasActiveFilters && <button type="button" className="rl-btn-reset" onClick={clearFilters} title="Xóa bộ lọc"><X size={18} /></button>}</>}</div><div className="rl-toolbar-actions"><button type="button" className={`rl-btn-secondary rl-trash-toggle ${viewMode === "trash" ? "active" : ""}`} onClick={() => { setViewMode((prev) => (prev === "active" ? "trash" : "active")); onSearchChange?.(null); }}><Trash2 size={16} />{viewMode === "active" ? "Thùng rác" : "Danh sách"}</button>{viewMode === "active" && <button type="button" className="rl-btn-primary" onClick={handleAdd} disabled={!restaurantId}><Plus size={18} /><span>Thêm công thức</span></button>}</div></div>
      <div className="rl-content">{viewMode === "trash" ? renderTrash() : loading && !recipesWithMeta.length ? <div className="rl-loading-state"><Loader2 className="spinner" size={32} /><p>Đang tải danh sách công thức...</p></div> : error ? <div className="rl-error-box"><AlertCircle size={20} /><span>Lỗi: {error.message}</span></div> : recipesWithMeta.length > 0 ? <><div className="rl-grid">{recipesWithMeta.map((r) => <RecipeCard key={r.id} recipe={r} currency={activeCurrency} usdToVndRate={usdToVndRate} onEdit={handleEdit} onViewDetails={handleViewDetails} onDelete={handleDelete} />)}</div>{pageInfo?.hasNextPage && <div className="rl-load-more"><button type="button" className="rl-btn-secondary" onClick={loadMore} disabled={loading}>{loading ? <Loader2 className="spinner-sm" size={16} /> : null}{loading ? "Đang tải thêm..." : "Xem thêm công thức"}</button></div>}</> : <div className="rl-empty-state"><div className="rl-empty-icon"><ChefHat strokeWidth={1} /></div><h3>Không tìm thấy công thức</h3><p>{hasActiveFilters ? "Hãy thử thay đổi hoặc xóa bộ lọc." : "Chưa có công thức. Hãy thêm công thức đầu tiên."}</p>{hasActiveFilters && <button type="button" className="rl-link-btn" onClick={clearFilters}>Xóa bộ lọc</button>}</div>}</div>
      <RecipeDishPickerModal isOpenPicker={showDishPicker} onRequestClose={() => setShowDishPicker(false)} dishRows={recipesWithMeta} onPickDishRow={handlePickDishForCreate} />
      <RecipeModal isOpen={showModal} onClose={handleModalClose} onSave={handleSave} onDelete={handleDelete} recipe={editingRecipe} menuItem={selectedMenuItem || (editingRecipe ? normalizeMenuItemFromDishRow(editingRecipe) : null)} menuItems={recipesWithMeta} ingredients={ingredients} currency={activeCurrency} usdToVndRate={usdToVndRate} />
      <RecipeDetailModal isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setViewingRecipe(null); }} recipe={viewingRecipe} ingredients={ingredients} currency={activeCurrency} usdToVndRate={usdToVndRate} />
    </div>
  );
};

export default RecipeList;
