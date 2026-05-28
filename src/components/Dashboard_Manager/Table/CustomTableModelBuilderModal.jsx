import React, { useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import { TABLE_3D_TYPE_OPTIONS } from "@/config/table3dCatalog";
import {
  buildCustomTableCatalogItem,
  buildCustomUrlTableCatalogItem,
  CUSTOM_TABLE_SHAPES,
  DEFAULT_CUSTOM_TABLE_SPEC,
  DEFAULT_CUSTOM_URL_TABLE_SPEC,
  getCustomTableShapeLabel,
  normalizeCustomTableSpec,
} from "@/config/table3dCustomModelBuilder";
import {
  getTableAreaLabel,
  TABLE_AREA_OPTIONS,
} from "@/utils/tableManagementOptions";

const BUILDER_MODES = {
  PARAMETRIC: "parametric",
  URL: "url",
};

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());

const isAcceptedModelUrl = (value) => {
  if (!isHttpUrl(value)) return false;
  const withoutQuery = String(value).split(/[?#]/)[0].toLowerCase();
  return withoutQuery.endsWith(".glb") || withoutQuery.endsWith(".gltf");
};

const parseTags = (value) =>
  String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const CustomTableModelBuilderModal = ({ open, onClose, onApply }) => {
  const [mode, setMode] = useState(BUILDER_MODES.PARAMETRIC);
  const [form, setForm] = useState(DEFAULT_CUSTOM_TABLE_SPEC);
  const [urlForm, setUrlForm] = useState(DEFAULT_CUSTOM_URL_TABLE_SPEC);
  const [error, setError] = useState("");

  const normalizedPreview = useMemo(() => normalizeCustomTableSpec(form), [form]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateUrlField = (field, value) => {
    setUrlForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setError("");
  };

  const handleReferenceImage = (event) => {
    const file = event.target.files?.[0];
    updateField("referenceImageName", file?.name || "");
  };

  const validateUrlForm = () => {
    const nextErrors = [];
    const capacity = Number(urlForm.capacity);
    const defaultScale = Number(urlForm.defaultScale);

    if (!String(urlForm.modelUrl || "").trim()) {
      nextErrors.push("Model URL là bắt buộc.");
    } else if (!isAcceptedModelUrl(urlForm.modelUrl)) {
      nextErrors.push("Model URL phải bắt đầu bằng http:// hoặc https:// và kết thúc bằng .glb hoặc .gltf.");
    }

    if (urlForm.thumbnailUrl && !isHttpUrl(urlForm.thumbnailUrl)) {
      nextErrors.push("Thumbnail URL phải bắt đầu bằng http:// hoặc https://.");
    }

    if (!Number.isFinite(capacity) || capacity < 1) {
      nextErrors.push("Số ghế phải lớn hơn hoặc bằng 1.");
    }

    if (!Number.isFinite(defaultScale) || defaultScale < 0.2 || defaultScale > 3) {
      nextErrors.push("defaultScale phải nằm trong khoảng 0.2 đến 3.");
    }

    return nextErrors;
  };

  const handleApply = () => {
    if (mode === BUILDER_MODES.URL) {
      const validationErrors = validateUrlForm();
      if (validationErrors.length) {
        setError(validationErrors.join(" "));
        return;
      }

      const item = buildCustomUrlTableCatalogItem({
        ...urlForm,
        capacity: Number(urlForm.capacity),
        defaultScale: Number(urlForm.defaultScale),
        tags: parseTags(urlForm.tags),
      });
      onApply?.(item);
      onClose?.();
      return;
    }

    const spec = normalizeCustomTableSpec(form);
    const item = buildCustomTableCatalogItem(spec);
    onApply?.(item);
    onClose?.();
  };

  return (
    <Modal isOpen={open} onClose={onClose} size="lg">
      <div className="p-3">
        <h3>✨ Tạo mẫu bàn tùy chỉnh</h3>
        <p className="text-muted">
          Tạo mẫu bằng thông số hoặc thêm model 3D online bằng URL .glb/.gltf.
          Chưa hỗ trợ upload file hoặc AI dựng 3D từ ảnh trong phase này.
        </p>

        <div className="btn-group mt-2" role="tablist" aria-label="Chế độ tạo mẫu bàn tùy chỉnh">
          <Button
            type="button"
            variant={mode === BUILDER_MODES.PARAMETRIC ? "primary" : "secondary"}
            onClick={() => handleModeChange(BUILDER_MODES.PARAMETRIC)}
          >
            Tạo bằng thông số
          </Button>
          <Button
            type="button"
            variant={mode === BUILDER_MODES.URL ? "primary" : "secondary"}
            onClick={() => handleModeChange(BUILDER_MODES.URL)}
          >
            Thêm model 3D bằng URL
          </Button>
        </div>

        {error && <div className="alert alert-warning mt-3 mb-0">{error}</div>}

        {mode === BUILDER_MODES.PARAMETRIC ? (
          <>
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
                <input
                  className="form-control"
                  type="file"
                  accept="image/*"
                  onChange={handleReferenceImage}
                />
                <small className="text-muted">
                  {form.referenceImageName || "Chưa chọn ảnh"}
                </small>
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
          </>
        ) : (
          <div className="row g-3 mt-1">
            <div className="col-md-6">
              <label>Tên mẫu</label>
              <input
                className="form-control"
                value={urlForm.name}
                onChange={(e) => updateUrlField("name", e.target.value)}
                placeholder="Ví dụ: Bàn patio GLB 4 chỗ"
              />
            </div>
            <div className="col-md-6">
              <label>Loại bàn</label>
              <select
                className="form-select"
                value={urlForm.tableType}
                onChange={(e) => updateUrlField("tableType", e.target.value)}
              >
                {TABLE_3D_TYPE_OPTIONS.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label>Số ghế</label>
              <input
                className="form-control"
                type="number"
                min="1"
                value={urlForm.capacity}
                onChange={(e) => updateUrlField("capacity", e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label>defaultScale</label>
              <input
                className="form-control"
                type="number"
                min="0.2"
                max="3"
                step="0.05"
                value={urlForm.defaultScale}
                onChange={(e) => updateUrlField("defaultScale", e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label>Tags (dấu phẩy)</label>
              <input
                className="form-control"
                value={urlForm.tags}
                onChange={(e) => updateUrlField("tags", e.target.value)}
                placeholder="outdoor, wood, glb"
              />
            </div>
            <div className="col-12">
              <label>Model URL (.glb/.gltf)</label>
              <input
                className="form-control"
                value={urlForm.modelUrl}
                onChange={(e) => updateUrlField("modelUrl", e.target.value)}
                placeholder="https://example.com/table.glb"
              />
            </div>
            <div className="col-12">
              <label>Thumbnail URL</label>
              <input
                className="form-control"
                value={urlForm.thumbnailUrl}
                onChange={(e) => updateUrlField("thumbnailUrl", e.target.value)}
                placeholder="https://example.com/table-thumbnail.jpg"
              />
            </div>
            <div className="col-md-6">
              <label>Nguồn model / source URL hoặc label</label>
              <input
                className="form-control"
                value={urlForm.source}
                onChange={(e) => updateUrlField("source", e.target.value)}
                placeholder="https://source.example hoặc tên nguồn"
              />
            </div>
            <div className="col-md-6">
              <label>License / ghi chú quyền sử dụng</label>
              <input
                className="form-control"
                value={urlForm.licenseLabel}
                onChange={(e) => updateUrlField("licenseLabel", e.target.value)}
                placeholder="CC0, CC BY, nội bộ đã được phép..."
              />
            </div>
            <div className="col-md-3">
              <label>Rộng (cm)</label>
              <input
                className="form-control"
                type="number"
                min="1"
                value={urlForm.widthCm}
                onChange={(e) => updateUrlField("widthCm", e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label>Sâu (cm)</label>
              <input
                className="form-control"
                type="number"
                min="1"
                value={urlForm.depthCm}
                onChange={(e) => updateUrlField("depthCm", e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label>Cao (cm)</label>
              <input
                className="form-control"
                type="number"
                min="1"
                value={urlForm.heightCm}
                onChange={(e) => updateUrlField("heightCm", e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label>Đường kính (cm)</label>
              <input
                className="form-control"
                type="number"
                min="1"
                value={urlForm.diameterCm}
                onChange={(e) => updateUrlField("diameterCm", e.target.value)}
              />
            </div>
            <div className="col-12">
              <div className="alert alert-info mb-0">
                Phase này chỉ lưu URL online tới file .glb/.gltf. Không upload file, không upload thumbnail và không AI generate.
              </div>
            </div>
          </div>
        )}

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
