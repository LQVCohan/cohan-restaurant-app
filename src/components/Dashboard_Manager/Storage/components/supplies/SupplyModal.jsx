import React, { useEffect, useState, useCallback, useMemo } from "react";
import Modal, { ModalFooter } from "../../../../common/Modal";
import "./SupplyModal.scss";

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

const DEFAULT_FORM = {
  name: "",
  sku: "",
  category: "",
  unit: "unit",
  costPerUnit: "",
  pricePerUnit: "",
  minStock: "",
  notes: "",
  isActive: true,
};

const SupplyModal = ({
  isOpen,
  onClose,
  initial = null,
  onSubmit, // ({ payload, isEditing, id })
  onDelete, // (id) => Promise<void>  | optional
}) => {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isEditing = !!initial;

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial?.name || "",
        sku: initial?.sku || "",
        category: initial?.category || "",
        unit: initial?.unit || "unit",
        costPerUnit: initial?.costPerUnit ?? "",
        pricePerUnit: initial?.pricePerUnit ?? "",
        minStock: initial?.minStock ?? "",
        notes: initial?.notes || "",
        isActive: initial?.isActive ?? true,
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setErrors({});
    setSaving(false);
    setDeleting(false);
  }, [initial, isOpen]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const validate = useCallback(() => {
    const e = {};
    if (!form.name.trim()) e.name = "Tên vật phẩm là bắt buộc";
    if (!form.unit) e.unit = "Bắt buộc";
    if (form.costPerUnit === "" || Number(form.costPerUnit) < 0)
      e.costPerUnit = "Giá nhập phải ≥ 0";
    if (form.pricePerUnit !== "" && Number(form.pricePerUnit) < 0)
      e.pricePerUnit = "Giá bán phải ≥ 0";
    if (form.minStock === "" || Number(form.minStock) < 0)
      e.minStock = "Tồn tối thiểu phải ≥ 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form]);

  const payload = useMemo(
    () => ({
      name: form.name.trim(),
      sku: form.sku?.trim() || undefined,
      category: form.category?.trim() || "",
      unit: form.unit,
      costPerUnit: Number(form.costPerUnit) || 0,
      pricePerUnit: form.pricePerUnit === "" ? null : Number(form.pricePerUnit),
      minStock: Number(form.minStock) || 0,
      notes: form.notes?.trim() || "",
      isActive: !!form.isActive,
    }),
    [form]
  );

  const doSave = useCallback(
    async (closeAfter = true) => {
      if (saving) return;
      if (!validate()) return;
      try {
        setSaving(true);
        await onSubmit?.({ payload, isEditing, id: initial?.id });
        if (closeAfter) onClose?.();
        else {
          // Lưu & tạo mới → reset form giữ trạng thái isActive/đơn vị
          setForm((f) => ({
            ...DEFAULT_FORM,
            unit: f.unit,
            isActive: f.isActive,
          }));
          setErrors({});
        }
      } finally {
        setSaving(false);
      }
    },
    [saving, validate, onSubmit, payload, isEditing, initial?.id, onClose]
  );

  const doDelete = useCallback(async () => {
    if (!isEditing || !onDelete || deleting) return;
    if (!window.confirm("Bạn có chắc muốn xóa vật phẩm này?")) return;
    try {
      setDeleting(true);
      await onDelete(initial.id);
      onClose?.();
    } finally {
      setDeleting(false);
    }
  }, [isEditing, onDelete, deleting, initial, onClose]);

  // Ctrl/⌘ + Enter => Lưu
  const onKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      doSave(true);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving || deleting ? () => {} : onClose}
      title={isEditing ? "Sửa vật phẩm" : "Thêm vật phẩm"}
      size="md"
      closeOnOverlayClick={!saving && !deleting}
    >
      {/* nội dung trong modal__content để ăn style của Modal.scss */}
      <div className="supply-modal-content" onKeyDown={onKeyDown}>
        {/* Hàng 1 */}
        <div className="grid-2">
          <div className="field">
            <label className="label">
              Tên vật phẩm <span className="req">*</span>
            </label>
            <input
              className="control"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="VD: Nước suối Lavie"
              disabled={saving || deleting}
            />
            {errors.name && <div className="error">{errors.name}</div>}
          </div>

          <div className="field">
            <label className="label">
              SKU <span className="hint">(tùy chọn)</span>
            </label>
            <input
              className="control"
              value={form.sku}
              onChange={(e) => set({ sku: e.target.value })}
              placeholder="Mã hàng"
              disabled={saving || deleting}
            />
          </div>
        </div>

        {/* Hàng 2 */}
        <div className="grid-3">
          <div className="field">
            <label className="label">Danh mục</label>
            <input
              className="control"
              value={form.category}
              onChange={(e) => set({ category: e.target.value })}
              placeholder="VD: beverage / tissue / supply"
              disabled={saving || deleting}
            />
          </div>

          <div className="field">
            <label className="label">
              Đơn vị tính <span className="req">*</span>
            </label>
            <select
              className="control"
              value={form.unit}
              onChange={(e) => set({ unit: e.target.value })}
              disabled={saving || deleting}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            {errors.unit && <div className="error">{errors.unit}</div>}
          </div>

          <div className="field">
            <label className="label">Trạng thái</label>
            <select
              className="control"
              value={form.isActive ? "1" : "0"}
              onChange={(e) => set({ isActive: e.target.value === "1" })}
              disabled={saving || deleting}
            >
              <option value="1">Đang dùng</option>
              <option value="0">Ngừng</option>
            </select>
          </div>
        </div>

        {/* Hàng 3 */}
        <div className="grid-3">
          <div className="field">
            <label className="label">
              Giá nhập (VNĐ) <span className="req">*</span>
            </label>
            <div className="input-with-prefix">
              <span className="prefix">₫</span>
              <input
                className="control"
                type="number"
                min="0"
                step="0.01"
                value={form.costPerUnit}
                onChange={(e) => set({ costPerUnit: e.target.value })}
                placeholder="0"
                disabled={saving || deleting}
              />
            </div>
            {errors.costPerUnit && (
              <div className="error">{errors.costPerUnit}</div>
            )}
          </div>

          <div className="field">
            <label className="label">Giá bán (VNĐ)</label>
            <div className="input-with-prefix">
              <span className="prefix">₫</span>
              <input
                className="control"
                type="number"
                min="0"
                step="0.01"
                value={form.pricePerUnit}
                onChange={(e) => set({ pricePerUnit: e.target.value })}
                placeholder="0"
                disabled={saving || deleting}
              />
            </div>
            {errors.pricePerUnit && (
              <div className="error">{errors.pricePerUnit}</div>
            )}
          </div>

          <div className="field">
            <label className="label">
              Tồn tối thiểu <span className="req">*</span>
            </label>
            <input
              className="control"
              type="number"
              min="0"
              step="0.01"
              value={form.minStock}
              onChange={(e) => set({ minStock: e.target.value })}
              placeholder="0"
              disabled={saving || deleting}
            />
            {errors.minStock && <div className="error">{errors.minStock}</div>}
          </div>
        </div>

        {/* Ghi chú */}
        <div className="field">
          <label className="label">Ghi chú</label>
          <textarea
            className="control"
            rows={3}
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Ghi chú về vật phẩm..."
            disabled={saving || deleting}
          />
        </div>
      </div>

      {/* Footer đồng bộ style Modal */}
      <ModalFooter>
        {!isEditing && (
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setForm(DEFAULT_FORM)}
            disabled={saving || deleting}
            title="Xóa hết dữ liệu vừa nhập"
          >
            Reset
          </button>
        )}

        {isEditing && onDelete && (
          <button
            type="button"
            className="btn btn--danger"
            onClick={doDelete}
            disabled={saving || deleting}
            title="Xóa vật phẩm này"
          >
            {deleting ? "Đang xóa..." : "Xóa"}
          </button>
        )}

        <button
          type="button"
          className="btn btn--secondary"
          onClick={onClose}
          disabled={saving || deleting}
        >
          Hủy
        </button>

        {!isEditing && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => doSave(false)}
            disabled={saving || deleting}
            title="Lưu và tiếp tục thêm mới"
          >
            {saving ? "Đang lưu..." : "Lưu & tạo mới"}
          </button>
        )}

        <button
          type="button"
          className="btn btn--primary"
          onClick={() => doSave(true)}
          disabled={saving || deleting}
        >
          {saving ? "Đang lưu..." : isEditing ? "Lưu thay đổi" : "Tạo vật phẩm"}
        </button>
      </ModalFooter>
    </Modal>
  );
};

export default SupplyModal;
