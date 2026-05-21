import React, { useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import {
  buildCustomTableCatalogItem,
  CUSTOM_TABLE_SHAPES,
  DEFAULT_CUSTOM_TABLE_SPEC,
  getCustomTableShapeLabel,
  normalizeCustomTableSpec,
} from "@/config/table3dCustomModelBuilder";
import { getTableAreaLabel, TABLE_AREA_OPTIONS } from "@/utils/tableManagementOptions";

const CustomTableModelBuilderModal = ({ open, onClose, onApply }) => {
  const [form, setForm] = useState(DEFAULT_CUSTOM_TABLE_SPEC);

  const normalizedPreview = useMemo(() => normalizeCustomTableSpec(form), [form]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleReferenceImage = (event) => {
    const file = event.target.files?.[0];
    updateField("referenceImageName", file?.name || "");
  };

  const handleApply = () => {
    const spec = normalizeCustomTableSpec(form);
    const item = buildCustomTableCatalogItem(spec);
    onApply?.(item);
    onClose?.();
  };

  return (
    <Modal isOpen={open} onClose={onClose} size="lg">
      <div className="p-3">
        <h3>✨ Tạo mẫu bàn tùy chỉnh</h3>
        <p className="text-muted">Nhập thông tin để tạo mẫu parametric. Mẫu sẽ được lưu trên trình duyệt hiện tại để dùng lại khi mô phỏng 3D.</p>

        <div className="row g-3 mt-1">
          <div className="col-md-6">
            <label>Tên mẫu bàn</label>
            <input
              className="form-control"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Ví dụ: Booth cửa sổ 6 chỗ"
            />
          </div>
          <div className="col-md-6">
            <label>Loại hình dáng</label>
            <select
              className="form-select"
              value={form.shape}
              onChange={(e) => updateField("shape", e.target.value)}
            >
              {CUSTOM_TABLE_SHAPES.map((shape) => (
                <option key={shape.value} value={shape.value}>
                  {shape.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-6">
            <label>Khu vực</label>
            <select
              className="form-select"
              value={form.area}
              onChange={(e) => updateField("area", e.target.value)}
            >
              {TABLE_AREA_OPTIONS.map((area) => (
                <option key={area.value} value={area.value}>
                  {area.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label>Số ghế</label>
            <input
              className="form-control"
              type="number"
              min="1"
              value={form.capacity}
              onChange={(e) => updateField("capacity", e.target.value)}
            />
          </div>

          <div className="col-md-3">
            <label>Rộng (cm)</label>
            <input
              className="form-control"
              type="number"
              min="1"
              value={form.widthCm}
              onChange={(e) => updateField("widthCm", e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <label>Sâu (cm)</label>
            <input
              className="form-control"
              type="number"
              min="1"
              value={form.depthCm}
              onChange={(e) => updateField("depthCm", e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <label>Cao (cm)</label>
            <input
              className="form-control"
              type="number"
              min="1"
              value={form.heightCm}
              onChange={(e) => updateField("heightCm", e.target.value)}
            />
          </div>
          {normalizedPreview.shape === "round" && (
            <div className="col-md-3">
              <label>Đường kính (cm)</label>
              <input
                className="form-control"
                type="number"
                min="1"
                value={form.diameterCm}
                onChange={(e) => updateField("diameterCm", e.target.value)}
              />
            </div>
          )}

          <div className="col-md-6">
            <label>Chất liệu</label>
            <input
              className="form-control"
              value={form.material}
              onChange={(e) => updateField("material", e.target.value)}
              placeholder="wood, metal..."
            />
          </div>
          <div className="col-md-6">
            <label>Màu</label>
            <input
              className="form-control form-control-color"
              type="color"
              value={form.color}
              onChange={(e) => updateField("color", e.target.value)}
            />
          </div>

          <div className="col-md-6">
            <label>Ảnh tham khảo (local)</label>
            <input className="form-control" type="file" accept="image/*" onChange={handleReferenceImage} />
            <small className="text-muted">{form.referenceImageName || "Chưa chọn ảnh"}</small>
          </div>
          <div className="col-md-6">
            <label>Ghi chú</label>
            <textarea
              className="form-control"
              rows="2"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
            />
          </div>
        </div>

        <div className="card mt-3">
          <div className="card-body">
            <h6 className="card-title">Preview summary</h6>
            <ul className="mb-0">
              <li>Tên mẫu: {normalizedPreview.name || "Mẫu bàn tùy chỉnh"}</li>
              <li>Loại bàn: {getCustomTableShapeLabel(normalizedPreview.shape)}</li>
              <li>Số ghế: {normalizedPreview.capacity}</li>
              <li>
                Kích thước: {normalizedPreview.widthCm} x {normalizedPreview.depthCm} x {normalizedPreview.heightCm} cm
                {normalizedPreview.shape === "round" ? ` • Ø ${normalizedPreview.diameterCm} cm` : ""}
              </li>
              <li>Khu vực: {getTableAreaLabel(normalizedPreview.area)}</li>
            </ul>
          </div>
        </div>

        <div className="d-flex justify-content-end gap-2 mt-3">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="primary" onClick={handleApply}>
            Lưu vào thư viện
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CustomTableModelBuilderModal;
