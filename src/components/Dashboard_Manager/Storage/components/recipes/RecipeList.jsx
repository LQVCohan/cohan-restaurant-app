// src/components/Dashboard_Manager/Storage/components/recipes/RecipeList.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Plus,
  ChefHat,
  Clock,
  Filter,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import RecipeCard from "./RecipeCard";
import RecipeModal from "./RecipeModal";
import RecipeDetailModal from "./RecipeDetailModal";
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
import "./RecipeList.scss";

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

  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [viewingRecipe, setViewingRecipe] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const fileInputRef = useRef(null);

  const getVariantLines = (v) => {
    if (!v) return [];
    if (Array.isArray(v.ingredients)) return v.ingredients;
    if (Array.isArray(v.Ingredients)) return v.Ingredients;
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

  const calcVariantCost = (variant) => {
    const lines = getVariantLines(variant);
    let hasCostLine = false;
    const total = lines.reduce((sum, line) => {
      const qty = normalizeLineQty(line);
      const unitCost = normalizeUnitCost(line);
      if (qty <= 0 || unitCost <= 0) return sum;
      hasCostLine = true;
      return sum + qty * unitCost;
    }, 0);
    return { total, hasCostLine };
  };

  const calcMinCost = (recipe, ingredientIdSet, canDetectMissingIngredients) => {
    const variants = Array.isArray(recipe?.servingVariants) ? recipe.servingVariants : [];
    if (!variants.length) {
      return { minCost: 0, hasAnyCost: false, estimatedCostValid: true, hasNoReplacementIngredient: false };
    }

    let estimatedCostValid = true;
    let hasNoReplacementIngredient = false;
    const costs = variants
      .map((variant) => {
        const lines = getVariantLines(variant);
        const hasMissingReplacement = canDetectMissingIngredients
          ? lines.some((line) => {
              const id = String(line?.ingredientId || "").trim();
              return id && !ingredientIdSet.has(id);
            })
          : false;

        if (hasMissingReplacement) {
          estimatedCostValid = false;
          hasNoReplacementIngredient = true;
          return 0;
        }

        const result = calcVariantCost(variant);
        return result.hasCostLine ? result.total : 0;
      })
      .filter((n) => n > 0);

    if (!estimatedCostValid) {
      return { minCost: 0, hasAnyCost: false, estimatedCostValid: false, hasNoReplacementIngredient };
    }

    if (!costs.length) {
      return { minCost: 0, hasAnyCost: false, estimatedCostValid: true, hasNoReplacementIngredient: false };
    }

    return { minCost: Math.min(...costs), hasAnyCost: true, estimatedCostValid: true, hasNoReplacementIngredient: false };
  };

  const recipesWithMeta = useMemo(() => {
    const ingredientIdSet = new Set((ingredients || []).map((ing) => String(ing?.id || "")).filter(Boolean));
    const canDetectMissingIngredients = ingredientIdSet.size > 0;

    return (recipes || []).map((r) => {
      const variants = Array.isArray(r?.servingVariants) ? r.servingVariants : [];
      const ids = new Set();
      const missingIds = new Set();
      variants.forEach((v) => {
        getVariantLines(v).forEach((c) => {
          const id = c?.ingredientId;
          if (!id) return;
          const normalizedId = String(id);
          ids.add(normalizedId);
          if (canDetectMissingIngredients && !ingredientIdSet.has(normalizedId)) {
            missingIds.add(normalizedId);
          }
        });
      });

      const { minCost, hasAnyCost, estimatedCostValid, hasNoReplacementIngredient } = calcMinCost(r, ingredientIdSet, canDetectMissingIngredients);
      const hasRecipe = variants.length > 0;

      return {
        ...r,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes, ingredients]);

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    onSearchChange?.(val?.trim() ? val : null);
  };

  const handleCategoryFilter = (e) => {
    const val = e.target.value;
    setCategory(val);
    onCategoryChange?.(val || null);
  };

  const handleTimeSlotFilter = (e) => {
    const val = e.target.value;
    setTimeSlot(val);
    onTimeSlotChange?.(val || null);
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("");
    setTimeSlot("");
    onSearchChange?.(null);
    onCategoryChange?.(null);
    onTimeSlotChange?.(null);
  };

  const hasActiveFilters = search || category || timeSlot;

  const handleAdd = () => {
    setEditingRecipe(null);
    setShowModal(true);
  };

  const handleEdit = (menuItemId) => {
    const r = (recipesWithMeta || []).find((x) => x.id === menuItemId);
    setEditingRecipe(r || null);
    setShowModal(true);
  };

  const handleViewDetails = (menuItemId) => {
    const r = (recipesWithMeta || []).find((x) => x.id === menuItemId);
    setViewingRecipe(r || null);
    setShowDetailModal(true);
  };

  const handleDelete = async (menuItemId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa công thức này?")) return;
    await onDeleteRecipe?.(menuItemId);
  };

  const handleSave = async (formData) => {
    if (editingRecipe) {
      await onUpdateRecipe?.(editingRecipe.id, formData);
    } else {
      await onAddRecipe?.(formData);
    }
    setShowModal(false);
    setEditingRecipe(null);
  };

  const handleTemplate = useCallback(() => {
    downloadRecipeTemplate();
    showNotification("Đã tải file mẫu công thức.", "success");
  }, [showNotification]);

  const handleExport = useCallback((format = "xlsx") => {
    exportRecipesFile({ recipes: recipesWithMeta, format });
    showNotification(`Đã xuất danh sách công thức (${format.toUpperCase()}).`, "success");
  }, [recipesWithMeta, showNotification]);

  const handleReport = useCallback(() => {
    const files = buildRecipeReportFiles({ recipes: recipesWithMeta });
    downloadRecipeReportsZip(files);
    showNotification("Đã xuất gói báo cáo công thức (.zip).", "success");
  }, [recipesWithMeta, showNotification]);

  const handleImportClick = useCallback(() => fileInputRef.current?.click(), []);

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setBusyAction("import");
      const rows = await parseRecipeImportFile(file);
      if (!rows.length) throw new Error("File import không có dòng dữ liệu hợp lệ.");
      const { payloads, errors } = buildRecipeImportPayloads(rows, recipesWithMeta);
      let successCount = 0;
      const fileErrors = [...errors];
      for (const item of payloads) {
        try {
          await onUpdateRecipe?.(item.menuItemId, item.formData);
          successCount += 1;
        } catch (err) {
          fileErrors.push({
            rowNo: "",
            menuItemId: item.menuItemId,
            ingredientId: "",
            type: "PROCESS",
            reason: err?.message || "Không thể import công thức này",
          });
        }
      }
      if (fileErrors.length) downloadRecipeImportErrors(fileErrors);
      showNotification(
        `Import công thức hoàn tất: ${successCount} món thành công, ${fileErrors.length} dòng cần kiểm tra.`,
        fileErrors.length ? "warning" : "success",
      );
    } catch (err) {
      showNotification(err?.message || "Import công thức thất bại.", "error");
    } finally {
      setBusyAction("");
    }
  };

  const registeredActions = useMemo(() => ({
    import: handleImportClick,
    exportXlsx: () => handleExport("xlsx"),
    exportCsv: () => handleExport("csv"),
    template: handleTemplate,
    report: handleReport,
    busy: Boolean(busyAction || loading),
  }), [busyAction, handleExport, handleImportClick, handleReport, handleTemplate, loading]);

  useEffect(() => {
    onRegisterActions?.(registeredActions);
    return () => onRegisterActions?.(null);
  }, [onRegisterActions, registeredActions]);

  const handleModalClose = () => {
    setShowModal(false);
    setEditingRecipe(null);
  };

  return (
    <div className="rl-container">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="rl-file-input"
        onChange={handleImportFile}
      />

      <header className="rl-header">
        <div className="rl-header-left">
          <div className="rl-title-group">
            <h2 className="rl-title">Công Thức Món Ăn</h2>
            <span className="rl-badge">{typeof total === "number" ? total : recipes.length} món</span>
          </div>
          <p className="rl-subtitle">Quản lý định lượng (Recipe), Variants và Giá vốn (Cost).</p>
        </div>
      </header>

      <div className="rl-toolbar">
        <div className="rl-toolbar-filters">
          <div className="rl-input-group">
            <Search className="rl-icon-left" size={18} />
            <input
              aria-label="Tìm kiếm công thức"
              type="text"
              className="rl-input-search"
              placeholder="Tìm món ăn..."
              value={search}
              onChange={handleSearch}
            />
            {search && (
              <button type="button" className="rl-btn-clear" onClick={() => { setSearch(""); onSearchChange?.(null); }}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="rl-select-group">
            <Filter className="rl-icon-left" size={16} />
            <select className="rl-select" value={category} onChange={handleCategoryFilter}>
              <option value="">Tất cả danh mục</option>
              {categoryOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div className="rl-select-group">
            <Clock className="rl-icon-left" size={16} />
            <select className="rl-select" value={timeSlot} onChange={handleTimeSlotFilter}>
              <option value="">Tất cả buổi</option>
              <option value="breakfast">Sáng</option>
              <option value="lunch">Trưa</option>
              <option value="dinner">Tối</option>
              <option value="late_night">Đêm</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button type="button" className="rl-btn-reset" onClick={clearFilters} title="Xóa bộ lọc">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="rl-toolbar-actions">
          <button type="button" className="rl-btn-primary" onClick={handleAdd} disabled={!restaurantId}>
            <Plus size={18} />
            <span>Thêm Công Thức</span>
          </button>
        </div>
      </div>

      <div className="rl-content">
        {loading && !recipesWithMeta.length ? (
          <div className="rl-loading-state"><Loader2 className="spinner" size={32} /><p>Đang tải danh sách công thức...</p></div>
        ) : error ? (
          <div className="rl-error-box"><AlertCircle size={20} /><span>Lỗi: {error.message}</span></div>
        ) : recipesWithMeta.length > 0 ? (
          <>
            <div className="rl-grid">
              {recipesWithMeta.map((r) => (
                <RecipeCard
                  key={r.id}
                  recipe={r}
                  currency={activeCurrency}
                  usdToVndRate={usdToVndRate}
                  onEdit={handleEdit}
                  onViewDetails={handleViewDetails}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {pageInfo?.hasNextPage && (
              <div className="rl-load-more">
                <button type="button" className="rl-btn-secondary" onClick={loadMore} disabled={loading}>
                  {loading ? <Loader2 className="spinner-sm" size={16} /> : null}
                  {loading ? "Đang tải thêm..." : "Xem thêm công thức"}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="rl-empty-state">
            <div className="rl-empty-icon"><ChefHat strokeWidth={1} /></div>
            <h3>Không tìm thấy công thức</h3>
            <p>{hasActiveFilters ? "Thử thay đổi bộ lọc tìm kiếm của bạn." : "Danh sách trống. Hãy thêm công thức đầu tiên!"}</p>
            {hasActiveFilters && <button type="button" className="rl-link-btn" onClick={clearFilters}>Xóa bộ lọc</button>}
          </div>
        )}
      </div>

      <RecipeModal
        isOpen={showModal}
        onClose={handleModalClose}
        onSave={handleSave}
        onDelete={handleDelete}
        menuItemRecipeRows={recipes}
        recipe={editingRecipe}
        menuItemName={editingRecipe?.name}
        restaurantId={restaurantId}
        ingredients={ingredients}
        currency={activeCurrency}
        usdToVndRate={usdToVndRate}
      />

      <RecipeDetailModal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setViewingRecipe(null); }}
        recipe={viewingRecipe}
        ingredients={ingredients}
        currency={activeCurrency}
        usdToVndRate={usdToVndRate}
      />
    </div>
  );
};

export default RecipeList;
