// src/components/Dashboard_Manager/Storage/components/ingredients/IngredientModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Type,
  Barcode,
  Tag,
  Scale,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Info,
} from "lucide-react";
import Modal from "../../../../common/Modal";
import Button from "../../../../common/Button";
import {
  convertAndRoundCurrencyAmount,
  convertCurrencyAmount,
  normalizeCurrency,
  roundCurrencyValue,
} from "../../../../../utils/currency";
import {
  suggestBaseUnitByIngredientName,
  suggestUnitOptionsByIngredientName,
} from "../../../../../utils/unitSuggestions";
import { toIngredientCategoryVi } from "../../../../../utils/ingredientCategoryI18n";
import useModalDraft from "../../../../../hooks/useModalDraft";
import { useNotification } from "../../../../../hooks/useNotification";
import "./IngredientModal.scss";

const ALL_UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "unit",
  "piece",
  "tbsp",
  "tsp",
  "pack",
  "bottle",
  "can",
];

const UNIT_LABELS = {
  g: "Gam (g)",
  kg: "Kilôgam (kg)",
  ml: "Mililít (ml)",
  l: "Lít (l)",
  unit: "Đơn vị",
  piece: "Cái",
  tbsp: "Muỗng canh",
  tsp: "Muỗng cà phê",
  pack: "Gói",
  bottle: "Chai",
  can: "Lon",
};

const UNIT_SUFFIXES = {
  unit: "đơn vị",
  piece: "cái",
  tbsp: "muỗng canh",
  tsp: "muỗng cà phê",
  pack: "gói",
  bottle: "chai",
  can: "lon",
};

const getUnitLabel = (unit) => UNIT_LABELS[unit] || unit || "Đơn vị";
const getUnitSuffix = (unit) => UNIT_SUFFIXES[unit] || unit || "đơn vị";

const defaultForm = {
  name: "",
  sku: "",
  ingredientCategoryId: "",
  baseUnit: "g",
  costPerBaseUnit: "",
  minStock: "",
  notes: "",
  isActive: true,
  initialStockQty: "",
};

const normalizeDraftText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const toComparableForm = (value = {}) => ({
  name: String(value?.name ?? "").trim(),
  sku: String(value?.sku ?? "").trim(),
  ingredientCategoryId: String(value?.ingredientCategoryId ?? "").trim(),
  baseUnit: value?.baseUnit || "g",
  costPerBaseUnit: String(value?.costPerBaseUnit ?? "").trim(),
  minStock: String(value?.minStock ?? "").trim(),
  notes: String(value?.notes ?? "").trim(),
  isActive: !!value?.isActive,
  initialStockQty: String(value?.initialStockQty ?? "").trim(),
});

const IngredientModal = ({
  isOpen,
  onClose,
  initial,
  isEditing,
  onSubmit,
  canInitStock = false,
  defaultWarehouseName = null,
  saving = false,
  currency = "VND",
  usdToVndRate = 26000,
  categoryOptions = [],
}) => {
  const activeCurrency = normalizeCurrency(currency, "VND");
  const currencySymbol = activeCurrency === "VND" ? "₫" : "$";
  const { showNotification } = useNotification();
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [prevCurrency, setPrevCurrency] = useState(activeCurrency);
  const [unitSuggested, setUnitSuggested] = useState(false);
  const submittedRef = useRef(false);

  const unitOptions = useMemo(() => {
    const suggested = suggestUnitOptionsByIngredientName(form.name);
    const selected = form.baseUnit || initial?.baseUnit || "g";
    const merged = [...new Set([...suggested, selected])];
    return merged.filter((unit) => ALL_UNITS.includes(unit));
  }, [form.name, form.baseUnit, initial?.baseUnit]);

  const normalizedCategoryOptions = useMemo(
    () => (Array.isArray(categoryOptions) ? categoryOptions : []),
    [categoryOptions],
  );

  const categoryNames = useMemo(() => {
    const options = normalizedCategoryOptions
      .map((category) => ({
        id: String(category?.id || ""),
        name: String(category?.name || "").trim(),
      }))
      .filter((category) => category.id && category.name);

    if (initial?.ingredientCategoryId && initial?.category) {
      options.push({
        id: String(initial.ingredientCategoryId),
        name: String(initial.category).trim(),
      });
    }

    return [...new Map(options.map((option) => [option.id, option])).values()];
  }, [
    normalizedCategoryOptions,
    initial?.ingredientCategoryId,
    initial?.category,
  ]);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || "",
        sku: initial.sku || "",
        ingredientCategoryId: initial.ingredientCategoryId || "",
        baseUnit: initial.baseUnit || "g",
        costPerBaseUnit: convertAndRoundCurrencyAmount(
          initial.costPerBaseUnit ?? "",
          "VND",
          activeCurrency,
          usdToVndRate,
          { usdDigits: 4 },
        ),
        minStock: initial.minStock ?? "",
        notes: initial.notes || "",
        isActive: initial.isActive ?? true,
        initialStockQty: "",
      });
    } else {
      setForm(defaultForm);
    }

    setErrors({});
    setPrevCurrency(activeCurrency);
    setUnitSuggested(false);
  }, [activeCurrency, initial, isOpen, usdToVndRate]);

  useEffect(() => {
    if (!isOpen || prevCurrency === activeCurrency) return;

    setForm((prev) => ({
      ...prev,
      costPerBaseUnit: convertAndRoundCurrencyAmount(
        Number(prev.costPerBaseUnit) || 0,
        prevCurrency,
        activeCurrency,
        usdToVndRate,
        { usdDigits: 4 },
      ),
    }));
    setPrevCurrency(activeCurrency);
  }, [activeCurrency, isOpen, prevCurrency, usdToVndRate]);

  useEffect(() => {
    if (isEditing || unitSuggested) return;
    const suggestion = suggestBaseUnitByIngredientName(form.name);
    if (suggestion && suggestion !== form.baseUnit) {
      setForm((prev) => ({ ...prev, baseUnit: suggestion }));
      setUnitSuggested(true);
    }
  }, [form.name, form.baseUnit, isEditing, unitSuggested]);

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  const baselineForm = useMemo(() => {
    if (!initial) return toComparableForm(defaultForm);

    return toComparableForm({
      name: initial.name || "",
      sku: initial.sku || "",
      ingredientCategoryId: initial.ingredientCategoryId || "",
      baseUnit: initial.baseUnit || "g",
      costPerBaseUnit: convertAndRoundCurrencyAmount(
        initial.costPerBaseUnit ?? "",
        "VND",
        activeCurrency,
        usdToVndRate,
        { usdDigits: 4 },
      ),
      minStock: initial.minStock ?? "",
      notes: initial.notes || "",
      isActive: initial.isActive ?? true,
      initialStockQty: "",
    });
  }, [activeCurrency, initial, usdToVndRate]);

  const isDirty = useMemo(() => {
    if (!isOpen) return false;
    return JSON.stringify(toComparableForm(form)) !== JSON.stringify(baselineForm);
  }, [baselineForm, form, isOpen]);

  const hasMeaningfulChanges = useMemo(() => {
    if (!isDirty) return false;
    const safeForm = toComparableForm(form);

    if (safeForm.baseUnit !== baselineForm.baseUnit) return true;
    if (safeForm.ingredientCategoryId !== baselineForm.ingredientCategoryId) return true;
    if (safeForm.isActive !== baselineForm.isActive) return true;
    if (normalizeDraftText(safeForm.name) !== normalizeDraftText(baselineForm.name)) return true;
    if (normalizeDraftText(safeForm.sku) !== normalizeDraftText(baselineForm.sku)) return true;
    if (normalizeDraftText(safeForm.notes) !== normalizeDraftText(baselineForm.notes)) return true;
    if (Number(safeForm.costPerBaseUnit || 0) !== Number(baselineForm.costPerBaseUnit || 0)) {
      return true;
    }
    if (Number(safeForm.minStock || 0) !== Number(baselineForm.minStock || 0)) return true;
    if (Number(safeForm.initialStockQty || 0) !== Number(baselineForm.initialStockQty || 0)) {
      return true;
    }
    return false;
  }, [baselineForm, form, isDirty]);

  const { requestCloseWithDraft, clearDraft } = useModalDraft({
    enabled: isOpen,
    draftIdentity: {
      module: "storage",
      modal: "ingredient-modal",
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: isEditing ? "edit" : "create",
      entityType: "ingredient",
      recordId: initial?.id || null,
      context: defaultWarehouseName || "global",
      schemaVersion: "1",
    },
    formValue: form,
    isDirty,
    sanitize: (value) =>
      hasMeaningfulChanges
        ? {
            name: value?.name || "",
            sku: value?.sku || "",
            ingredientCategoryId: value?.ingredientCategoryId || "",
            baseUnit: value?.baseUnit || "g",
            costPerBaseUnit: value?.costPerBaseUnit ?? "",
            minStock: value?.minStock ?? "",
            notes: value?.notes || "",
            isActive: !!value?.isActive,
            initialStockQty: value?.initialStockQty ?? "",
          }
        : null,
    canRestoreDraft: (draft) => {
      const restored = toComparableForm(draft);
      if (restored.baseUnit !== baselineForm.baseUnit) return true;
      if (restored.ingredientCategoryId !== baselineForm.ingredientCategoryId) return true;
      if (restored.isActive !== baselineForm.isActive) return true;
      if (normalizeDraftText(restored.name) !== normalizeDraftText(baselineForm.name)) return true;
      if (normalizeDraftText(restored.sku) !== normalizeDraftText(baselineForm.sku)) return true;
      if (normalizeDraftText(restored.notes) !== normalizeDraftText(baselineForm.notes)) return true;
      if (Number(restored.costPerBaseUnit || 0) !== Number(baselineForm.costPerBaseUnit || 0)) {
        return true;
      }
      if (Number(restored.minStock || 0) !== Number(baselineForm.minStock || 0)) return true;
      if (Number(restored.initialStockQty || 0) !== Number(baselineForm.initialStockQty || 0)) {
        return true;
      }
      return false;
    },
    onRestore: (draft) => setForm((prev) => ({ ...prev, ...draft })),
    notify: showNotification,
  });

  const validate = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Tên không được để trống";
    if (!form.baseUnit) nextErrors.baseUnit = "Chọn đơn vị";

    const cost = Number(form.costPerBaseUnit);
    if (!Number.isFinite(cost) || cost < 0) nextErrors.costPerBaseUnit = "Giá phải ≥ 0";

    const min = Number(form.minStock);
    if (!Number.isFinite(min) || min < 0) nextErrors.minStock = "Tồn tối thiểu ≥ 0";

    if (!isEditing && canInitStock) {
      const qty = form.initialStockQty === "" ? 0 : Number(form.initialStockQty);
      if (!Number.isFinite(qty) || qty < 0) nextErrors.initialStockQty = "Số lượng ≥ 0";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const save = async (event) => {
    event.preventDefault();
    if (saving || !validate()) return;

    const payload = {
      name: form.name.trim(),
      sku: form.sku?.trim() || null,
      ingredientCategoryId: form.ingredientCategoryId || null,
      category:
        categoryNames.find((category) => category.id === form.ingredientCategoryId)?.name || "",
      baseUnit: form.baseUnit,
      costPerBaseUnit:
        convertCurrencyAmount(
          Number(form.costPerBaseUnit) || 0,
          activeCurrency,
          "VND",
          usdToVndRate,
        ) || 0,
      minStock: Number(form.minStock) || 0,
      notes: form.notes?.trim() || "",
      isActive: !!form.isActive,
      conversions: initial?.conversions || [],
      photos: initial?.photos || [],
    };

    const initialStockQty =
      !isEditing && canInitStock ? Number(form.initialStockQty || 0) : 0;

    try {
      await onSubmit?.({ payload, initialStockQty, isEditing, id: initial?.id });
      submittedRef.current = true;
    } catch {
      submittedRef.current = false;
    }
  };

  useEffect(() => {
    if (isOpen) return;
    if (submittedRef.current && !saving) {
      clearDraft();
      submittedRef.current = false;
      showNotification(
        "Đã xóa dữ liệu nháp sau khi lưu thành công.",
        "success",
        2500,
      );
    }
  }, [clearDraft, isOpen, saving, showNotification]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : () => requestCloseWithDraft(onClose)}
      title={isEditing ? "Cập nhật nguyên vật liệu" : "Thêm nguyên vật liệu mới"}
      size="lg"
      closeOnOverlayClick={false}
      closeOnEscape={!saving}
      className="ingredient-modal-shell"
    >
      <Modal.Body className="ingredient-modal-body">
        <form
          id="ingredient-form"
          onSubmit={save}
          className="ingredient-form-premium"
          autoComplete="off"
        >
          <section className="form-section" aria-labelledby="ingredient-identity-title">
            <div className="im-section-header">
              <div className="icon-box" aria-hidden="true">
                <Info size={18} />
              </div>
              <div className="header-text">
                <h4 id="ingredient-identity-title" className="im-section-title">
                  Thông tin nguyên liệu
                </h4>
                <p className="im-section-desc">Định danh, phân loại và trạng thái sử dụng</p>
              </div>
            </div>

            <div className="form-grid-2">
              <div className={`form-group ${errors.name ? "has-error" : ""}`}>
                <label htmlFor="ingredient-name">
                  Tên nguyên liệu <span className="required">*</span>
                </label>
                <div className="input-with-icon">
                  <Type size={16} className="icon" aria-hidden="true" />
                  <input
                    id="ingredient-name"
                    name="ingredientName"
                    value={form.name}
                    onChange={(event) => set({ name: event.target.value })}
                    placeholder="VD: Thịt bò thăn ngoại…"
                    autoFocus
                    disabled={saving}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? "ingredient-name-error" : undefined}
                  />
                </div>
                {errors.name && (
                  <span id="ingredient-name-error" className="error-text">
                    {errors.name}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="ingredient-category">Danh mục</label>
                <div className="input-with-icon">
                  <Tag size={16} className="icon" aria-hidden="true" />
                  <select
                    id="ingredient-category"
                    name="ingredientCategoryId"
                    value={form.ingredientCategoryId}
                    onChange={(event) => set({ ingredientCategoryId: event.target.value })}
                    disabled={saving}
                  >
                    <option value="">Chưa phân loại</option>
                    {categoryNames.map((category) => (
                      <option key={category.id} value={category.id}>
                        {toIngredientCategoryVi(category.name)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="ingredient-sku">
                  Mã SKU <span className="hint">Tùy chọn</span>
                </label>
                <div className="input-with-icon">
                  <Barcode size={16} className="icon" aria-hidden="true" />
                  <input
                    id="ingredient-sku"
                    name="ingredientSku"
                    value={form.sku}
                    onChange={(event) => set({ sku: event.target.value })}
                    placeholder="VD: NL-BO-001"
                    spellCheck={false}
                    disabled={saving}
                  />
                </div>
              </div>

              <fieldset className="form-group status-fieldset">
                <legend>Trạng thái</legend>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={`segment ${form.isActive ? "active" : ""}`}
                    aria-pressed={form.isActive}
                    onClick={() => set({ isActive: true })}
                    disabled={saving}
                  >
                    <CheckCircle2 size={16} aria-hidden="true" /> Đang sử dụng
                  </button>
                  <button
                    type="button"
                    className={`segment error ${!form.isActive ? "active" : ""}`}
                    aria-pressed={!form.isActive}
                    onClick={() => set({ isActive: false })}
                    disabled={saving}
                  >
                    <XCircle size={16} aria-hidden="true" /> Tạm ngưng
                  </button>
                </div>
              </fieldset>
            </div>
          </section>

          <section className="form-section" aria-labelledby="ingredient-stock-title">
            <div className="im-section-header">
              <div className="icon-box warning" aria-hidden="true">
                <Scale size={18} />
              </div>
              <div className="header-text">
                <h4 id="ingredient-stock-title" className="im-section-title">
                  Định lượng và kiểm soát kho
                </h4>
                <p className="im-section-desc">
                  Đơn vị gốc, giá vốn và ngưỡng cảnh báo tồn
                </p>
              </div>
            </div>

            <div className="form-grid-2">
              <div className={`form-group ${errors.baseUnit ? "has-error" : ""}`}>
                <label htmlFor="ingredient-base-unit">
                  Đơn vị gốc <span className="required">*</span>
                </label>
                <select
                  id="ingredient-base-unit"
                  name="ingredientBaseUnit"
                  className="standard-input"
                  value={form.baseUnit}
                  onChange={(event) => set({ baseUnit: event.target.value })}
                  disabled={saving}
                  aria-invalid={Boolean(errors.baseUnit)}
                >
                  {unitOptions.map((unit) => (
                    <option key={unit} value={unit}>
                      {getUnitLabel(unit)}
                    </option>
                  ))}
                </select>
                {unitSuggested && (
                  <span className="help-text text-success">
                    Đơn vị được gợi ý theo tên nguyên liệu.
                  </span>
                )}
                {errors.baseUnit && <span className="error-text">{errors.baseUnit}</span>}
              </div>

              <div className={`form-group ${errors.costPerBaseUnit ? "has-error" : ""}`}>
                <label htmlFor="ingredient-cost">
                  Giá vốn tiêu chuẩn <span className="required">*</span>
                </label>
                <div className="input-addon-group">
                  <span className="addon-prefix currency-symbol" aria-hidden="true">
                    {currencySymbol}
                  </span>
                  <input
                    id="ingredient-cost"
                    name="ingredientCostPerBaseUnit"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={form.costPerBaseUnit}
                    onChange={(event) => set({ costPerBaseUnit: event.target.value })}
                    onBlur={() =>
                      set({
                        costPerBaseUnit: roundCurrencyValue(
                          Number(form.costPerBaseUnit) || 0,
                          activeCurrency,
                          { usdDigits: 4 },
                        ),
                      })
                    }
                    placeholder="0"
                    disabled={saving}
                    aria-invalid={Boolean(errors.costPerBaseUnit)}
                  />
                  <span className="addon-suffix">
                    {activeCurrency} / {getUnitSuffix(form.baseUnit)}
                  </span>
                </div>
                {errors.costPerBaseUnit && (
                  <span className="error-text">{errors.costPerBaseUnit}</span>
                )}
              </div>

              <div
                className={`form-group ${isEditing ? "form-group--full" : ""} ${
                  errors.minStock ? "has-error" : ""
                }`}
              >
                <label htmlFor="ingredient-min-stock">
                  Mức cảnh báo tồn thấp <span className="required">*</span>
                </label>
                <div className="input-addon-group">
                  <span className="addon-prefix" aria-hidden="true">
                    <AlertTriangle size={16} />
                  </span>
                  <input
                    id="ingredient-min-stock"
                    name="ingredientMinStock"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={form.minStock}
                    onChange={(event) => set({ minStock: event.target.value })}
                    placeholder="VD: 5"
                    disabled={saving}
                    aria-invalid={Boolean(errors.minStock)}
                  />
                  <span className="addon-suffix">{getUnitSuffix(form.baseUnit)}</span>
                </div>
                <span className="help-text">Cảnh báo khi tồn khả dụng chạm mức này.</span>
                {errors.minStock && <span className="error-text">{errors.minStock}</span>}
              </div>

              {!isEditing && (
                <div className={`form-group ${errors.initialStockQty ? "has-error" : ""}`}>
                  <label htmlFor="ingredient-initial-stock">
                    Tồn kho ban đầu
                    <span className="badge-hint">
                      {canInitStock
                        ? defaultWarehouseName || "Kho hiện tại"
                        : "Chưa cấu hình kho"}
                    </span>
                  </label>
                  <div className="input-addon-group">
                    <input
                      id="ingredient-initial-stock"
                      name="ingredientInitialStock"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={form.initialStockQty}
                      onChange={(event) => set({ initialStockQty: event.target.value })}
                      placeholder="Nhập số lượng hiện có…"
                      disabled={!canInitStock || saving}
                      aria-invalid={Boolean(errors.initialStockQty)}
                    />
                    <span className="addon-suffix">{getUnitSuffix(form.baseUnit)}</span>
                  </div>
                  {errors.initialStockQty && (
                    <span className="error-text">{errors.initialStockQty}</span>
                  )}
                </div>
              )}

              <div className="form-group form-group--full ingredient-notes-field">
                <label htmlFor="ingredient-notes">
                  <FileText size={16} aria-hidden="true" /> Ghi chú nghiệp vụ
                  <span className="hint">Tùy chọn</span>
                </label>
                <textarea
                  id="ingredient-notes"
                  name="ingredientNotes"
                  className="standard-textarea"
                  value={form.notes}
                  onChange={(event) => set({ notes: event.target.value })}
                  placeholder="Quy cách bảo quản, nhà cung cấp hoặc lưu ý khi sử dụng…"
                  rows={2}
                  disabled={saving}
                />
              </div>
            </div>
          </section>
        </form>
      </Modal.Body>

      <Modal.Footer className="ingredient-modal-actions">
        <span className="ingredient-modal-actions__meta">
          <span aria-hidden="true">*</span> Trường bắt buộc
        </span>
        <div className="ingredient-modal-actions__buttons">
          <Button
            type="button"
            variant="secondary"
            onClick={() => requestCloseWithDraft(onClose)}
            disabled={saving}
            className="btn-cancel"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            form="ingredient-form"
            variant="primary"
            disabled={saving}
            className="btn-save"
          >
            {saving ? (
              <span className="loading-state">
                <span className="spinner" aria-hidden="true" /> Đang xử lý…
              </span>
            ) : isEditing ? (
              "Lưu thay đổi"
            ) : (
              "Thêm nguyên liệu"
            )}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default IngredientModal;
