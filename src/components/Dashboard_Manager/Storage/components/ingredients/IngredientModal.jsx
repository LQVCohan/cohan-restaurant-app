// src/components/Dashboard_Manager/Storage/components/ingredients/IngredientModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Type,
  Barcode,
  Tag,
  Scale,
  DollarSign,
  AlertTriangle,
  ToggleLeft,
  Archive,
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
  const { showNotification } = useNotification();
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [prevCurrency, setPrevCurrency] = useState(activeCurrency);
  const [unitSuggested, setUnitSuggested] = useState(false);
  const submittedRef = useRef(false);
  const unitOptions = React.useMemo(() => {
    const suggested = suggestUnitOptionsByIngredientName(form.name);
    const selected = form.baseUnit || initial?.baseUnit || "g";
    const merged = [...new Set([...suggested, selected])];
    return merged.filter((u) => ALL_UNITS.includes(u));
  }, [form.name, form.baseUnit, initial?.baseUnit]);
  const normalizedCategoryOptions = React.useMemo(
    () => (Array.isArray(categoryOptions) ? categoryOptions : []),
    [categoryOptions],
  );
  const categoryNames = React.useMemo(() => {
    const options = normalizedCategoryOptions
      .map((c) => ({ id: String(c?.id || ""), name: String(c?.name || "").trim() }))
      .filter((c) => c.id && c.name);
    if (initial?.ingredientCategoryId && initial?.category) {
      options.push({
        id: String(initial.ingredientCategoryId),
        name: String(initial.category).trim(),
      });
    }
    return [...new Map(options.map((x) => [x.id, x])).values()];
  }, [normalizedCategoryOptions, initial?.ingredientCategoryId, initial?.category]);

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

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const initialSnapshot = useMemo(() => JSON.stringify(initial || null), [initial]);
  const isDirty = useMemo(() => {
    if (!isOpen) return false;
    const baseline = initial
      ? {
          name: initial.name || "",
          sku: initial.sku || "",
          ingredientCategoryId: initial.ingredientCategoryId || "",
          baseUnit: initial.baseUnit || "g",
          costPerBaseUnit: String(
            convertAndRoundCurrencyAmount(
              initial.costPerBaseUnit ?? "",
              "VND",
              activeCurrency,
              usdToVndRate,
              { usdDigits: 4 },
            ),
          ),
          minStock: String(initial.minStock ?? ""),
          notes: initial.notes || "",
          isActive: initial.isActive ?? true,
          initialStockQty: "",
        }
      : { ...defaultForm };
    return JSON.stringify({ ...form, costPerBaseUnit: String(form.costPerBaseUnit ?? "") }) !== JSON.stringify(baseline);
  }, [activeCurrency, form, initial, isOpen, usdToVndRate]);

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
    sanitize: (v) => ({
      name: v?.name || "",
      sku: v?.sku || "",
      ingredientCategoryId: v?.ingredientCategoryId || "",
      baseUnit: v?.baseUnit || "g",
      costPerBaseUnit: v?.costPerBaseUnit ?? "",
      minStock: v?.minStock ?? "",
      notes: v?.notes || "",
      isActive: !!v?.isActive,
      initialStockQty: v?.initialStockQty ?? "",
    }),
    onRestore: (draft) => setForm((prev) => ({ ...prev, ...draft })),
    notify: showNotification,
  });

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Tên không được để trống";
    if (!form.baseUnit) e.baseUnit = "Chọn đơn vị";

    const cost = Number(form.costPerBaseUnit);
    if (!Number.isFinite(cost) || cost < 0) e.costPerBaseUnit = "Giá phải ≥ 0";

    const min = Number(form.minStock);
    if (!Number.isFinite(min) || min < 0) e.minStock = "Tồn tối thiểu ≥ 0";

    if (!isEditing && canInitStock) {
      const qty0 =
        form.initialStockQty === "" ? 0 : Number(form.initialStockQty);
      if (!Number.isFinite(qty0) || qty0 < 0)
        e.initialStockQty = "Số lượng ≥ 0";
      if (Number.isFinite(qty0) && qty0 !== Math.round(qty0)) {
        e.initialStockQty = "Phải là số nguyên";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      sku: form.sku?.trim() || null,
      ingredientCategoryId: form.ingredientCategoryId || null,
      category:
        categoryNames.find((c) => c.id === form.ingredientCategoryId)?.name || "",
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

    submittedRef.current = true;
    onSubmit?.({
      payload,
      initialStockQty,
      isEditing,
      id: initial?.id,
    });
  };

  useEffect(() => {
    if (isOpen) return;
    if (submittedRef.current && !saving) {
      clearDraft();
      submittedRef.current = false;
      showNotification("Đã xóa dữ liệu nháp sau khi lưu thành công.", "success", 2500);
    }
  }, [clearDraft, isOpen, saving, showNotification, initialSnapshot]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : () => requestCloseWithDraft(onClose)}
      title={isEditing ? "Cập nhật nguyên liệu" : "Thêm nguyên liệu mới"}
      size="md"
      closeOnOverlayClick={false}
    >
      <form onSubmit={save} className="il-modal-form">
        {/* --- Block 1: Thông tin cơ bản --- */}
        <div className="il-grid-2">
          <div className="il-form-group">
            <label>
              Tên nguyên liệu <span className="req">*</span>
            </label>
            <div className="il-input-wrapper">
              <Type size={16} className="il-input-icon" />
              <input
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="VD: Thịt bò thăn..."
                autoFocus
              />
            </div>
            {errors.name && <span className="il-error-msg">{errors.name}</span>}
          </div>

          <div className="il-form-group">
            <label>
              Mã SKU <span className="hint">(Tùy chọn)</span>
            </label>
            <div className="il-input-wrapper">
              <Barcode size={16} className="il-input-icon" />
              <input
                value={form.sku}
                onChange={(e) => set({ sku: e.target.value })}
                placeholder="Mã quản lý nội bộ"
              />
            </div>
          </div>
        </div>

        {/* --- Block 2: Phân loại & Đơn vị --- */}
        <div className="il-grid-3">
          <div className="il-form-group">
            <label>Danh mục</label>
            <div className="il-input-wrapper">
              <Tag size={16} className="il-input-icon" />
              <select
                value={form.ingredientCategoryId}
                onChange={(e) => set({ ingredientCategoryId: e.target.value })}
              >
                <option value="">Chưa phân loại</option>
                {categoryNames.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {toIngredientCategoryVi(cat.name)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="il-form-group">
            <label>
              Đơn vị gốc <span className="req">*</span>
            </label>
            <div className="il-input-wrapper">
                <Scale size={16} className="il-input-icon" />
                <select
                  value={form.baseUnit}
                  onChange={(e) => set({ baseUnit: e.target.value })}
                >
                {unitOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            {errors.baseUnit && (
              <span className="il-error-msg">{errors.baseUnit}</span>
            )}
            <span className="il-help-text">
              Gợi ý theo tên nguyên liệu để giảm danh sách đơn vị không phù hợp.
            </span>
          </div>

          <div className="il-form-group">
            <label>
              Giá vốn / đơn vị ({activeCurrency}) <span className="req">*</span>
            </label>
            <div className="il-input-wrapper">
              <DollarSign size={16} className="il-input-icon" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.costPerBaseUnit}
                onChange={(e) => set({ costPerBaseUnit: e.target.value })}
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
              />
            </div>
            {errors.costPerBaseUnit && (
              <span className="il-error-msg">{errors.costPerBaseUnit}</span>
            )}
          </div>
        </div>

        {/* --- Block 3: Tồn kho & Trạng thái --- */}
        <div className="il-grid-2">
          <div className="il-form-group">
            <label>
              Cảnh báo tồn thấp <span className="req">*</span>
            </label>
            <div className="il-input-wrapper">
              <AlertTriangle size={16} className="il-input-icon" />
              <input
                type="number"
                min="0"
                value={form.minStock}
                onChange={(e) => set({ minStock: e.target.value })}
                placeholder="Nhập số lượng tối thiểu"
              />
            </div>
            {errors.minStock && (
              <span className="il-error-msg">{errors.minStock}</span>
            )}
          </div>

          <div className="il-form-group">
            <label>Trạng thái sử dụng</label>
            <div className="il-status-toggle">
              <button
                type="button"
                className={form.isActive ? "active" : ""}
                onClick={() => set({ isActive: true })}
              >
                <ToggleLeft size={14} />
                Đang hoạt động
              </button>
              <button
                type="button"
                className={!form.isActive ? "active" : ""}
                onClick={() => set({ isActive: false })}
              >
                <ToggleLeft size={14} />
                Ngừng kinh doanh
              </button>
            </div>
          </div>
        </div>

        {/* --- Block 4: Nhập kho lần đầu (Chỉ hiện khi tạo mới) --- */}
        {!isEditing && (
          <div className="il-stock-init-section">
            <div className="il-form-group">
              <label
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <span>Khởi tạo tồn kho ban đầu</span>
                <span className="hint">
                  {canInitStock
                    ? defaultWarehouseName
                      ? `Tại: ${defaultWarehouseName}`
                      : "Kho đang chọn"
                    : "Vui lòng chọn kho bên ngoài trước"}
                </span>
              </label>
              <div className="il-input-wrapper">
                <Archive size={16} className="il-input-icon" />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.initialStockQty}
                  onChange={(e) => set({ initialStockQty: e.target.value })}
                  placeholder="Nhập số lượng tồn hiện có (nếu có)"
                  disabled={!canInitStock}
                />
                {canInitStock && (
                  <span
                    style={{
                      position: "absolute",
                      right: 12,
                      fontSize: "0.8rem",
                      color: "#64748b",
                    }}
                  >
                    {form.baseUnit}
                  </span>
                )}
              </div>
              {errors.initialStockQty && (
                <span className="il-error-msg">{errors.initialStockQty}</span>
              )}
            </div>
          </div>
        )}

        {/* --- Block 5: Ghi chú --- */}
        <div className="il-form-group">
          <label>Ghi chú thêm</label>
          <div className="il-input-wrapper" style={{ display: "block" }}>
            {/* Textarea custom style một chút */}
            <textarea
              className="il-textarea"
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Ghi chú về bảo quản, nhà cung cấp..."
            />
          </div>
        </div>

        {/* --- Footer Actions --- */}
        <div className="il-modal-footer">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Đóng
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Đang lưu...
              </>
            ) : isEditing ? (
              "Lưu thay đổi"
            ) : (
              "Tạo mới"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default IngredientModal;
