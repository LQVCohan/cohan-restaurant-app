// src/components/Dashboard_Manager/Storage/components/ingredients/IngredientModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Type,
  Barcode,
  Tag,
  Scale,
  DollarSign,
  AlertTriangle,
  Archive,
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
  // ... [GIỮ NGUYÊN TOÀN BỘ LOGIC XỬ LÝ (useEffect, useMemo, validate, save...) CỦA BẠN]
  // Để code gọn trong câu trả lời, tôi giả định bạn giữ nguyên các hàm logic ở đây
  const activeCurrency = normalizeCurrency(currency, "VND");
  const { showNotification } = useNotification();
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [prevCurrency, setPrevCurrency] = useState(activeCurrency);
  const [unitSuggested, setUnitSuggested] = useState(false);
  const submittedRef = useRef(false);

  // ... (Giữ nguyên useMemo cho unitOptions, categoryNames)
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
      .map((c) => ({
        id: String(c?.id || ""),
        name: String(c?.name || "").trim(),
      }))
      .filter((c) => c.id && c.name);
    if (initial?.ingredientCategoryId && initial?.category) {
      options.push({
        id: String(initial.ingredientCategoryId),
        name: String(initial.category).trim(),
      });
    }
    return [...new Map(options.map((x) => [x.id, x])).values()];
  }, [
    normalizedCategoryOptions,
    initial?.ingredientCategoryId,
    initial?.category,
  ]);

  // ... (Giữ nguyên các useEffect)
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
  const initialSnapshot = useMemo(
    () => JSON.stringify(initial || null),
    [initial],
  );

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
    return (
      JSON.stringify({
        ...form,
        costPerBaseUnit: String(form.costPerBaseUnit ?? ""),
      }) !== JSON.stringify(baseline)
    );
  }, [activeCurrency, form, initial, isOpen, usdToVndRate]);

  const { requestCloseWithDraft, clearDraft } = useModalDraft({
    enabled: isOpen,
    draftIdentity: {
      module: "storage",
      modal: "ingredient-modal",
      route:
        typeof window !== "undefined" ? window.location.pathname : "unknown",
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
      if (Number.isFinite(qty0) && qty0 !== Math.round(qty0))
        e.initialStockQty = "Phải là số nguyên";
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
        categoryNames.find((c) => c.id === form.ingredientCategoryId)?.name ||
        "",
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
    onSubmit?.({ payload, initialStockQty, isEditing, id: initial?.id });
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
  }, [clearDraft, isOpen, saving, showNotification, initialSnapshot]);

  // ===== BẮT ĐẦU PHẦN RENDER GIAO DIỆN PREMIUM (ĐÃ FIX LỖI LAYOUT) =====
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : () => requestCloseWithDraft(onClose)}
      title={
        isEditing ? "Cập nhật nguyên vật liệu" : "Thêm nguyên vật liệu mới"
      }
      size="lg"
      closeOnOverlayClick={false}
    >
      <Modal.Body>
        <form onSubmit={save} className="ingredient-form-premium">
        {/* SECTION 1: THÔNG TIN CƠ BẢN */}
        <div className="form-section">
          {/* Đã đổi class để tránh xung đột */}
          <div className="im-section-header">
            <div className="icon-box">
              <Info size={18} />
            </div>
            <div className="header-text">
              <h4 className="im-section-title">Thông tin định danh</h4>
              <p className="im-section-desc">
                Tên gọi, danh mục và trạng thái hoạt động
              </p>
            </div>
          </div>

          <div className="form-grid-2">
            <div className={`form-group ${errors.name ? "has-error" : ""}`}>
              <label>
                Tên nguyên liệu <span className="required">*</span>
              </label>
              <div className="input-with-icon">
                <Type size={16} className="icon" />
                <input
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="VD: Thịt bò thăn ngoại..."
                  autoFocus
                  disabled={saving}
                />
              </div>
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label>Danh mục</label>
              <div className="input-with-icon">
                <Tag size={16} className="icon" />
                <select
                  value={form.ingredientCategoryId}
                  onChange={(e) =>
                    set({ ingredientCategoryId: e.target.value })
                  }
                  disabled={saving}
                >
                  <option value="">-- Chưa phân loại --</option>
                  {categoryNames.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {toIngredientCategoryVi(cat.name)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>
                Mã SKU <span className="hint">(Tùy chọn)</span>
              </label>
              <div className="input-with-icon">
                <Barcode size={16} className="icon" />
                <input
                  value={form.sku}
                  onChange={(e) => set({ sku: e.target.value })}
                  placeholder="VD: NL-BO-001"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Trạng thái</label>
              <div className="segmented-control">
                <div
                  className={`segment ${form.isActive ? "active" : ""}`}
                  onClick={() => !saving && set({ isActive: true })}
                >
                  <CheckCircle2 size={16} /> Đang bán
                </div>
                <div
                  className={`segment error ${!form.isActive ? "active" : ""}`}
                  onClick={() => !saving && set({ isActive: false })}
                >
                  <XCircle size={16} /> Tạm ngưng
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: ĐỊNH LƯỢNG & ĐỊNH GIÁ */}
        <div className="form-section">
          <div className="im-section-header">
            <div className="icon-box warning">
              <Scale size={18} />
            </div>
            <div className="header-text">
              <h4 className="im-section-title">Định lượng & Giá vốn</h4>
              <p className="im-section-desc">
                Đơn vị tính gốc và chi phí tiêu chuẩn
              </p>
            </div>
          </div>

          <div className="form-grid-2">
            <div className={`form-group ${errors.baseUnit ? "has-error" : ""}`}>
              <label>
                Đơn vị gốc <span className="required">*</span>
              </label>
              <select
                className="standard-input"
                value={form.baseUnit}
                onChange={(e) => set({ baseUnit: e.target.value })}
                disabled={saving}
              >
                {unitOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              {unitSuggested && (
                <span className="help-text text-success">
                  Gợi ý tự động từ AI.
                </span>
              )}
              {errors.baseUnit && (
                <span className="error-text">{errors.baseUnit}</span>
              )}
            </div>

            <div
              className={`form-group ${errors.costPerBaseUnit ? "has-error" : ""}`}
            >
              <label>
                Giá vốn tiêu chuẩn <span className="required">*</span>
              </label>
              <div className="input-addon-group">
                <span className="addon-prefix">
                  <DollarSign size={16} />
                </span>
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
                  placeholder="0.00"
                  disabled={saving}
                />
                <span className="addon-suffix">
                  {activeCurrency} / {form.baseUnit}
                </span>
              </div>
              {errors.costPerBaseUnit && (
                <span className="error-text">{errors.costPerBaseUnit}</span>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: KIỂM SOÁT TỒN KHO */}
        <div className="form-section elevated-section">
          <div className="im-section-header">
            <div className="icon-box danger">
              <Archive size={18} />
            </div>
            <div className="header-text">
              <h4 className="im-section-title">Kiểm soát kho</h4>
              <p className="im-section-desc">
                Cảnh báo và khởi tạo số lượng ban đầu
              </p>
            </div>
          </div>

          <div className="form-grid-2">
            <div className={`form-group ${errors.minStock ? "has-error" : ""}`}>
              <label>
                Mức cảnh báo tồn thấp <span className="required">*</span>
              </label>
              <div className="input-addon-group">
                <span className="addon-prefix">
                  <AlertTriangle size={16} />
                </span>
                <input
                  type="number"
                  min="0"
                  value={form.minStock}
                  onChange={(e) => set({ minStock: e.target.value })}
                  placeholder="VD: 5"
                  disabled={saving}
                />
                <span className="addon-suffix">{form.baseUnit}</span>
              </div>
              {errors.minStock && (
                <span className="error-text">{errors.minStock}</span>
              )}
            </div>

            {!isEditing && (
              <div
                className={`form-group ${errors.initialStockQty ? "has-error" : ""}`}
              >
                <label>
                  Tồn kho ban đầu
                  <span className="badge-hint">
                    {canInitStock
                      ? defaultWarehouseName || "Kho hiện tại"
                      : "Chưa cấu hình kho"}
                  </span>
                </label>
                <div className="input-addon-group">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.initialStockQty}
                    onChange={(e) => set({ initialStockQty: e.target.value })}
                    placeholder="Nhập số lượng hiện có"
                    disabled={!canInitStock || saving}
                  />
                  <span className="addon-suffix">{form.baseUnit}</span>
                </div>
                {errors.initialStockQty && (
                  <span className="error-text">{errors.initialStockQty}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 4: GHI CHÚ */}
        <div className="form-section borderless">
          <div className="form-group">
            <label>
              <FileText size={16} /> Ghi chú nghiệp vụ
            </label>
            <textarea
              className="standard-textarea"
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Ghi chú quy cách bảo quản, thông tin nhà cung cấp..."
              rows={3}
              disabled={saving}
            />
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="form-actions-premium">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={saving}
            className="btn-cancel"
          >
            Hủy thao tác
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
            className="btn-save"
          >
            {saving ? (
              <span className="loading-state">
                <span className="spinner"></span> Đang xử lý...
              </span>
            ) : isEditing ? (
              "Lưu thay đổi"
            ) : (
              "Hoàn tất thêm mới"
            )}
          </Button>
        </div>
        </form>
      </Modal.Body>
    </Modal>
  );
};

export default IngredientModal;
