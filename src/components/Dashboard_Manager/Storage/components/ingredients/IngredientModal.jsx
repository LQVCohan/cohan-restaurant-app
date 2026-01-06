// src/components/Dashboard_Manager/Storage/components/ingredients/IngredientModal.jsx
import React, { useEffect, useState } from "react";
import {
  Type,
  Barcode,
  Tag,
  Scale,
  DollarSign,
  AlertTriangle,
  ToggleLeft,
  Box,
  FileText,
  Archive,
} from "lucide-react";
import Modal from "../../../../common/Modal";
import Button from "../../../../common/Button";
import "./IngredientModal.scss";

const UNITS = [
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
  category: "",
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
}) => {
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || "",
        sku: initial.sku || "",
        category: initial.category || "",
        baseUnit: initial.baseUnit || "g",
        costPerBaseUnit: initial.costPerBaseUnit ?? "",
        minStock: initial.minStock ?? "",
        notes: initial.notes || "",
        isActive: initial.isActive ?? true,
        initialStockQty: "",
      });
    } else {
      setForm(defaultForm);
    }
    setErrors({});
  }, [initial, isOpen]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

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
      category: form.category?.trim() || "",
      baseUnit: form.baseUnit,
      costPerBaseUnit: Number(form.costPerBaseUnit) || 0,
      minStock: Number(form.minStock) || 0,
      notes: form.notes?.trim() || "",
      isActive: !!form.isActive,
      conversions: initial?.conversions || [],
      photos: initial?.photos || [],
    };

    const initialStockQty =
      !isEditing && canInitStock ? Number(form.initialStockQty || 0) : 0;

    onSubmit?.({
      payload,
      initialStockQty,
      isEditing,
      id: initial?.id,
    });
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      title={isEditing ? "Cập nhật nguyên liệu" : "Thêm nguyên liệu mới"}
      size="md"
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
              <input
                value={form.category}
                onChange={(e) => set({ category: e.target.value })}
                placeholder="VD: Meat, Veg..."
                list="category-suggestions"
              />
              {/* Gợi ý danh mục có sẵn */}
              <datalist id="category-suggestions">
                <option value="Meat" />
                <option value="Vegetable" />
                <option value="Spice" />
                <option value="Dry" />
              </datalist>
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
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            {errors.baseUnit && (
              <span className="il-error-msg">{errors.baseUnit}</span>
            )}
          </div>

          <div className="il-form-group">
            <label>
              Giá vốn / đơn vị <span className="req">*</span>
            </label>
            <div className="il-input-wrapper">
              <DollarSign size={16} className="il-input-icon" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.costPerBaseUnit}
                onChange={(e) => set({ costPerBaseUnit: e.target.value })}
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
            <div className="il-input-wrapper">
              <ToggleLeft size={16} className="il-input-icon" />
              <select
                value={form.isActive ? "1" : "0"}
                onChange={(e) => set({ isActive: e.target.value === "1" })}
              >
                <option value="1">Đang hoạt động</option>
                <option value="0">Ngừng kinh doanh</option>
              </select>
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
