// SupplyModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import Modal, { ModalFooter } from "../../../../common/Modal";
import "./SupplyModal.scss";

/**
 * SupplyModal
 * - Tạo/Sửa vật phẩm (không phải nhập/xuất kho)
 * - Đồng bộ FIFO: cung cấp nút mở nhanh "Nhập kho" / "Xuất kho" (optional)
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: fn()
 *  - initial: Supply | null
 *  - onSubmit: fn(input)  // { restaurantId?, name, category, unit, costPerUnit, minStock, isActive }
 *  - onOpenInbound?: fn(supply)   // Mở modal nhập kho (tuỳ chọn)
 *  - onOpenOutbound?: fn(supply)  // Mở modal xuất kho (tuỳ chọn)
 */
const UNITS = [
  { value: "unit", label: "unit" },
  { value: "piece", label: "piece" },
  { value: "bottle", label: "bottle" },
  { value: "can", label: "can" },
  { value: "pack", label: "pack" },
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "ml", label: "ml" },
  { value: "l", label: "l" },
  { value: "tbsp", label: "tbsp" },
  { value: "tsp", label: "tsp" },
];

const CATEGORIES = [
  { value: "drink", label: "Đồ uống" },
  { value: "tissue", label: "Khăn giấy" },
  { value: "cleaning", label: "Vệ sinh" },
  { value: "sauce", label: "Gia vị/đóng gói" },
  { value: "other", label: "Khác" },
];

const defaultForm = {
  name: "",
  category: "other",
  unit: "unit",
  costPerUnit: "",
  minStock: "",
  isActive: true,
  notes: "",
};

const SupplyModal = ({
  isOpen,
  onClose,
  initial = null,
  onSubmit,
  onOpenInbound,
  onOpenOutbound,
}) => {
  const isEditing = !!initial;
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});

  // derived subtitle (FIFO hint)
  const subtitle = useMemo(
    () =>
      isEditing
        ? "Chỉnh sửa vật phẩm. Gợi ý: nhập/xuất kho theo FIFO sẽ trừ từ lô cũ trước."
        : "Thêm vật phẩm mới. Kho sẽ quản lý theo lô và xuất FIFO.",
    [isEditing]
  );

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name ?? "",
        category: initial.category ?? "other",
        unit: initial.unit ?? "unit",
        costPerUnit:
          typeof initial.costPerUnit === "number"
            ? String(initial.costPerUnit)
            : "",
        minStock:
          typeof initial.minStock === "number" ? String(initial.minStock) : "",
        isActive: initial.isActive ?? true,
        notes: initial.notes ?? "",
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
    if (!form.unit) e.unit = "Bắt buộc";
    if (form.costPerUnit === "" || Number(form.costPerUnit) < 0)
      e.costPerUnit = "≥ 0";
    if (form.minStock === "" || Number(form.minStock) < 0) e.minStock = "≥ 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const payload = {
      name: form.name.trim(),
      category: form.category || "other",
      unit: form.unit || "unit",
      costPerUnit: Number(form.costPerUnit) || 0,
      minStock: Number(form.minStock) || 0,
      isActive: !!form.isActive,
      notes: form.notes?.trim() || "",
    };
    onSubmit?.(payload);
  };

  const openInbound = () => {
    if (!isEditing) return;
    onOpenInbound?.(initial);
  };

  const openOutbound = () => {
    if (!isEditing) return;
    onOpenOutbound?.(initial);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "✏️ Chỉnh sửa vật phẩm" : "➕ Thêm vật phẩm"}
      size="md"
    >
      <div className="supply-modal">
        <p className="supply-modal__subtitle">{subtitle}</p>

        <div className="grid-2">
          <label className="fm-field">
            <span className="fm-label">
              Tên vật phẩm <b className="req">*</b>
            </span>
            <input
              className="fm-input"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Ví dụ: Coca-Cola lon 330ml"
            />
            {errors.name && <small className="fm-error">{errors.name}</small>}
          </label>

          <label className="fm-field">
            <span className="fm-label">Danh mục</span>
            <select
              className="fm-input"
              value={form.category}
              onChange={(e) => set({ category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* row: unit + costPerUnit */}
        <div className="grid-3">
          <label className="fm-field">
            <span className="fm-label">
              Đơn vị <b className="req">*</b>
            </span>
            <select
              className="fm-input"
              value={form.unit}
              onChange={(e) => set({ unit: e.target.value })}
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
            {errors.unit && <small className="fm-error">{errors.unit}</small>}
          </label>

          <label className="fm-field">
            <span className="fm-label">
              Giá/đơn vị (VNĐ) <b className="req">*</b>
            </span>
            <input
              className="fm-input"
              type="number"
              min="0"
              step="1"
              value={form.costPerUnit}
              onChange={(e) => set({ costPerUnit: e.target.value })}
              placeholder="0"
            />
            {errors.costPerUnit && (
              <small className="fm-error">{errors.costPerUnit}</small>
            )}
          </label>

          <label className="fm-field">
            <span className="fm-label">
              Tồn tối thiểu <b className="req">*</b>
            </span>
            <input
              className="fm-input"
              type="number"
              min="0"
              step="0.01"
              value={form.minStock}
              onChange={(e) => set({ minStock: e.target.value })}
              placeholder="0"
            />
            {errors.minStock && (
              <small className="fm-error">{errors.minStock}</small>
            )}
          </label>
        </div>

        <div className="grid-2">
          <label className="fm-field">
            <span className="fm-label">Trạng thái</span>
            <select
              className="fm-input"
              value={form.isActive ? "1" : "0"}
              onChange={(e) => set({ isActive: e.target.value === "1" })}
            >
              <option value="1">Đang dùng</option>
              <option value="0">Ngừng</option>
            </select>
          </label>

          <label className="fm-field">
            <span className="fm-label">Ghi chú</span>
            <input
              className="fm-input"
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Mô tả ngắn…"
            />
          </label>
        </div>

        {isEditing && (onOpenInbound || onOpenOutbound) && (
          <div className="hint-box">
            <div className="hint-text">
              <b>FIFO:</b> Khi xuất kho, hệ thống sẽ tự động trừ từ những lô cũ
              nhất trước (ưu tiên lô sắp hết hạn).
            </div>
            <div className="hint-actions">
              {onOpenInbound && (
                <button
                  type="button"
                  className="btn btn--light"
                  onClick={openInbound}
                >
                  📦 Nhập kho
                </button>
              )}
              {onOpenOutbound && (
                <button
                  type="button"
                  className="btn btn--light"
                  onClick={openOutbound}
                >
                  📤 Xuất kho
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <ModalFooter>
        <button className="btn btn--secondary" onClick={onClose}>
          Hủy
        </button>
        <button className="btn btn--primary" onClick={handleSave}>
          {isEditing ? "Lưu thay đổi" : "Tạo vật phẩm"}
        </button>
      </ModalFooter>
    </Modal>
  );
};

export default SupplyModal;
