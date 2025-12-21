// src/components/.../ingredients/IngredientModal.jsx
import React, { useEffect, useState } from "react";
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
        sku: initial.sku || initial._raw?.sku || "",
        category: initial.category || "",
        baseUnit:
          initial.baseUnit || initial.unit || initial._raw?.baseUnit || "g",
        costPerBaseUnit:
          initial.costPerBaseUnit ??
          initial.costPrice ??
          initial._raw?.costPerBaseUnit ??
          "",
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
    if (!form.name.trim()) e.name = "Bắt buộc";
    if (!form.baseUnit) e.baseUnit = "Bắt buộc";
    if (form.costPerBaseUnit === "" || Number(form.costPerBaseUnit) < 0)
      e.costPerBaseUnit = "≥ 0";
    if (form.minStock === "" || Number(form.minStock) < 0) e.minStock = "≥ 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = (e) => {
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
    };

    const initialStockQty = Number(form.initialStockQty) || 0;

    onSubmit?.({
      payload,
      initialStockQty: canInitStock ? initialStockQty : 0,
      isEditing,
      id: initial?.id,
    });
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      title={isEditing ? "Sửa nguyên liệu" : "Thêm nguyên liệu"}
      size="md"
    >
      <div className="ingredient-modal">
        <form onSubmit={save} className="modal-body space-y-3">
          <div className="grid-2">
            <label>
              Tên nguyên liệu <span className="req">*</span>
              <input
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="VD: Thịt bò"
              />
              {errors.name && <small className="error">{errors.name}</small>}
            </label>

            <label>
              SKU <small className="hint">(Tuỳ chọn)</small>
              <input
                value={form.sku}
                onChange={(e) => set({ sku: e.target.value })}
                placeholder="SKU nội bộ"
              />
            </label>
          </div>

          <div className="grid-3">
            <label>
              Danh mục
              <input
                value={form.category}
                onChange={(e) => set({ category: e.target.value })}
                placeholder="VD: meat / vegetable / spice..."
              />
            </label>

            <label>
              Đơn vị gốc <span className="req">*</span>
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
              {errors.baseUnit && (
                <small className="error">{errors.baseUnit}</small>
              )}
            </label>

            <label>
              Giá/đơn vị (VNĐ) <span className="req">*</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.costPerBaseUnit}
                onChange={(e) => set({ costPerBaseUnit: e.target.value })}
                placeholder="0"
              />
              {errors.costPerBaseUnit && (
                <small className="error">{errors.costPerBaseUnit}</small>
              )}
            </label>
          </div>

          <div className="grid-3">
            <label>
              Tồn tối thiểu <span className="req">*</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.minStock}
                onChange={(e) => set({ minStock: e.target.value })}
                placeholder="0"
              />
              {errors.minStock && (
                <small className="error">{errors.minStock}</small>
              )}
            </label>

            <label>
              Trạng thái
              <select
                value={form.isActive ? "1" : "0"}
                onChange={(e) => set({ isActive: e.target.value === "1" })}
              >
                <option value="1">Đang dùng</option>
                <option value="0">Ngừng</option>
              </select>
            </label>

            {!isEditing && (
              <label>
                Nhập tồn ban đầu{" "}
                <small className="hint">
                  (
                  {canInitStock
                    ? defaultWarehouseName
                      ? `Kho: ${defaultWarehouseName}`
                      : "Kho mặc định"
                    : "Chưa có kho"}
                  )
                </small>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.initialStockQty}
                  onChange={(e) => set({ initialStockQty: e.target.value })}
                  placeholder="0"
                  disabled={!canInitStock}
                />
              </label>
            )}
          </div>

          <label>
            Ghi chú
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Mô tả, yêu cầu bảo quản..."
            />
          </label>

          <div className="modal-footer">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving
                ? "Đang lưu..."
                : isEditing
                ? "Lưu thay đổi"
                : "Tạo nguyên liệu"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default IngredientModal;
