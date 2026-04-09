import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../../../common/Modal";
import useModalDraft from "../../../../../hooks/useModalDraft";
import { useNotification } from "../../../../../hooks/useNotification";
import "./SupplyModal.scss";

/**
 * SupplyModal - Nâng cấp giao diện Luxury/Minimalist
 */
const UNITS = [
  { value: "unit", label: "Đơn vị (unit)" },
  { value: "piece", label: "Cái (piece)" },
  { value: "bottle", label: "Chai (bottle)" },
  { value: "can", label: "Lon (can)" },
  { value: "pack", label: "Gói (pack)" },
  { value: "g", label: "Gram (g)" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "l", label: "Lít (l)" },
  { value: "tbsp", label: "Muỗng canh (tbsp)" },
  { value: "tsp", label: "Muỗng cà phê (tsp)" },
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
  pricePerUnit: "",
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
  const { showNotification } = useNotification();
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});

  const subtitle = useMemo(
    () =>
      isEditing
        ? "Điều chỉnh thông tin vật phẩm và quản lý lô hàng."
        : "Thiết lập vật phẩm mới vào hệ thống quản lý kho.",
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
        pricePerUnit:
          typeof initial.pricePerUnit === "number"
            ? String(initial.pricePerUnit)
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
  const isDirty = useMemo(() => {
    const base = initial
      ? {
          name: initial.name ?? "",
          category: initial.category ?? "other",
          unit: initial.unit ?? "unit",
          costPerUnit:
            typeof initial.costPerUnit === "number"
              ? String(initial.costPerUnit)
              : "",
          pricePerUnit:
            typeof initial.pricePerUnit === "number"
              ? String(initial.pricePerUnit)
              : "",
          minStock:
            typeof initial.minStock === "number" ? String(initial.minStock) : "",
          isActive: initial.isActive ?? true,
          notes: initial.notes ?? "",
        }
      : defaultForm;
    return JSON.stringify(form) !== JSON.stringify(base);
  }, [form, initial]);

  const { requestCloseWithDraft, clearDraft } = useModalDraft({
    enabled: isOpen,
    draftIdentity: {
      module: "storage",
      modal: "supply-modal",
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: isEditing ? "edit" : "create",
      entityType: "supply",
      recordId: initial?.id || null,
      context: "supply-list",
      schemaVersion: "1",
    },
    formValue: form,
    isDirty,
    sanitize: (v) => ({
      name: v?.name || "",
      category: v?.category || "other",
      unit: v?.unit || "unit",
      costPerUnit: v?.costPerUnit ?? "",
      pricePerUnit: v?.pricePerUnit ?? "",
      minStock: v?.minStock ?? "",
      isActive: !!v?.isActive,
      notes: v?.notes || "",
    }),
    onRestore: (draft) => setForm((prev) => ({ ...prev, ...draft })),
    notify: showNotification,
  });

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Vui lòng nhập tên vật phẩm";
    if (!form.unit) e.unit = "Chọn đơn vị";
    if (form.costPerUnit === "" || Number(form.costPerUnit) < 0)
      e.costPerUnit = "Giá trị không hợp lệ";
    if (form.pricePerUnit === "" || Number(form.pricePerUnit) < 0)
      e.pricePerUnit = "Giá trị không hợp lệ";
    if (form.minStock === "" || Number(form.minStock) < 0) e.minStock = "≥ 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const payload = {
      name: form.name.trim(),
      category: form.category || "other",
      unit: form.unit || "unit",
      costPerUnit: Number(form.costPerUnit) || 0,
      pricePerUnit: Number(form.pricePerUnit) || 0,
      minStock: Number(form.minStock) || 0,
      isActive: !!form.isActive,
      notes: form.notes?.trim() || "",
    };
    try {
      await onSubmit?.(payload);
      clearDraft();
      showNotification("Đã xóa dữ liệu nháp sau khi hoàn tất lưu.", "success", 2200);
    } catch {
      // giữ draft khi submit lỗi
    }
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
      onClose={() => requestCloseWithDraft(onClose)}
      title={isEditing ? "Chỉnh Sửa Vật Phẩm" : "Thêm Vật Phẩm Mới"}
      size="md"
    >
      <div className="sm-container">
        <div className="sm-header-note">
          <i className="note-icon">ℹ️</i>
          <span>{subtitle}</span>
        </div>

        {/* --- Block 1: Định danh --- */}
        <div className="sm-grid-2">
          <label className="sm-field">
            <span className="sm-label">
              Tên vật phẩm <b className="req">*</b>
            </span>
            <input
              className={`sm-input ${errors.name ? "error" : ""}`}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="VD: Coca-Cola 330ml"
            />
            {errors.name && <small className="sm-msg">{errors.name}</small>}
          </label>

          <label className="sm-field">
            <span className="sm-label">Danh mục</span>
            <select
              className="sm-input"
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

        {/* --- Block 2: Định lượng & Giá --- */}
        <div className="sm-grid-3">
          <label className="sm-field">
            <span className="sm-label">
              Đơn vị <b className="req">*</b>
            </span>
            <select
              className={`sm-input ${errors.unit ? "error" : ""}`}
              value={form.unit}
              onChange={(e) => set({ unit: e.target.value })}
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
            {errors.unit && <small className="sm-msg">{errors.unit}</small>}
          </label>

          <label className="sm-field">
            <span className="sm-label">
              Giá nhập (VNĐ) <b className="req">*</b>
            </span>
            <input
              className={`sm-input ${errors.costPerUnit ? "error" : ""}`}
              type="number"
              min="0"
              value={form.costPerUnit}
              onChange={(e) => set({ costPerUnit: e.target.value })}
              placeholder="0"
            />
          </label>

          <label className="sm-field">
            <span className="sm-label">
              Giá bán (VNĐ) <b className="req">*</b>
            </span>
            <input
              className={`sm-input ${errors.pricePerUnit ? "error" : ""}`}
              type="number"
              min="0"
              value={form.pricePerUnit}
              onChange={(e) => set({ pricePerUnit: e.target.value })}
              placeholder="0"
            />
            {errors.pricePerUnit && (
              <small className="sm-msg">{errors.pricePerUnit}</small>
            )}
          </label>

          <label className="sm-field">
            <span className="sm-label">
              Tồn tối thiểu <b className="req">*</b>
            </span>
            <input
              className={`sm-input ${errors.minStock ? "error" : ""}`}
              type="number"
              min="0"
              step="0.01"
              value={form.minStock}
              onChange={(e) => set({ minStock: e.target.value })}
              placeholder="0"
            />
          </label>
        </div>

        {/* --- Block 3: Trạng thái & Ghi chú --- */}
        <div className="sm-grid-2">
          <label className="sm-field">
            <span className="sm-label">Trạng thái</span>
            <select
              className="sm-input"
              value={form.isActive ? "1" : "0"}
              onChange={(e) => set({ isActive: e.target.value === "1" })}
            >
              <option value="1">🟢 Đang hoạt động</option>
              <option value="0">🔴 Ngưng sử dụng</option>
            </select>
          </label>

          <label className="sm-field">
            <span className="sm-label">Ghi chú</span>
            <input
              className="sm-input"
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Ghi chú nội bộ..."
            />
          </label>
        </div>

        {/* --- Block 4: Quick Actions (Chỉ hiện khi edit) --- */}
        {isEditing && (onOpenInbound || onOpenOutbound) && (
          <div className="sm-quick-actions">
            <div className="qa-info">
              <span className="qa-badge">FIFO System</span>
              <p>
                Hệ thống tự động ưu tiên xuất các lô hàng cũ nhất để đảm bảo
                tuổi thọ sản phẩm.
              </p>
            </div>
            <div className="qa-buttons">
              {onOpenInbound && (
                <button
                  type="button"
                  className="sm-btn-ghost"
                  onClick={openInbound}
                >
                  📥 Nhập kho
                </button>
              )}
              {onOpenOutbound && (
                <button
                  type="button"
                  className="sm-btn-ghost"
                  onClick={openOutbound}
                >
                  📤 Xuất kho
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal.Footer>
        <button className="sm-btn-cancel" onClick={onClose}>
          Hủy bỏ
        </button>
        <button className="sm-btn-submit" onClick={handleSave}>
          {isEditing ? "Lưu Thay Đổi" : "Xác Nhận Tạo"}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default SupplyModal;
