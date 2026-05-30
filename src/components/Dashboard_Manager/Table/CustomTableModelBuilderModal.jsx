import React, { useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import { getGraphqlUrl } from "@/lib/apiBaseUrl";
import { TABLE_3D_TYPE_OPTIONS } from "@/config/table3dCatalog";
import {
  buildCustomTableCatalogItem,
  buildCustomUrlTableCatalogItem,
  buildUploadedTableCatalogItem,
  CUSTOM_TABLE_SHAPES,
  DEFAULT_CUSTOM_TABLE_SPEC,
  DEFAULT_CUSTOM_UPLOAD_TABLE_SPEC,
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
  UPLOAD: "upload",
};

const MODEL_MAX_SIZE_BYTES = 15 * 1024 * 1024;
const THUMBNAIL_MAX_SIZE_BYTES = 3 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());

const isAcceptedModelUrl = (value) => {
  if (!isHttpUrl(value)) return false;
  const withoutQuery = String(value).split(/[?#]/)[0].toLowerCase();
  return withoutQuery.endsWith(".glb") || withoutQuery.endsWith(".gltf");
};

const parseTags = (value) =>
  Array.isArray(value)
    ? value.map(String).map((tag) => tag.trim()).filter(Boolean)
    : String(value || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

const formatFileSize = (bytes = 0) => {
  if (!bytes) return "0 B";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
};

const getApiBase = () => {
  const graphqlUrl = getGraphqlUrl();
  if (graphqlUrl.startsWith("/")) return "";
  return graphqlUrl.replace(/\/graphql\/?$/i, "").replace(/\/$/, "");
};

const isGlbFile = (file) => String(file?.name || "").toLowerCase().endsWith(".glb");

const validateSharedCatalogFields = (source) => {
  const nextErrors = [];
  const capacity = Number(source.capacity);
  const defaultScale = Number(source.defaultScale);

  if (!Number.isFinite(capacity) || capacity < 1) {
    nextErrors.push("Số ghế phải lớn hơn hoặc bằng 1.");
  }

  if (!Number.isFinite(defaultScale) || defaultScale < 0.2 || defaultScale > 3) {
    nextErrors.push("defaultScale phải nằm trong khoảng 0.2 đến 3.");
  }

  ["widthCm", "depthCm", "heightCm", "diameterCm"].forEach((field) => {
    if (source[field] === "" || source[field] == null) return;
    const value = Number(source[field]);
    if (!Number.isFinite(value) || value <= 0) {
      nextErrors.push("Kích thước nếu nhập phải là số dương.");
    }
  });

  return nextErrors;
};

const uploadTable3DAsset = ({ form, onProgress }) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${getApiBase()}/api/table-3d-assets/upload`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === "function") {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      let payload = {};
      try {
        payload = JSON.parse(xhr.responseText || "{}");
      } catch {
        reject(new Error(`Phản hồi upload không hợp lệ (HTTP ${xhr.status}).`));
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300 && payload?.ok && payload?.modelUrl) {
        resolve(payload);
        return;
      }
      reject(new Error(payload?.message || `Upload thất bại (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Không thể kết nối backend upload."));
    xhr.send(form);
  });

const CustomTableModelBuilderModal = ({ open, onClose, onApply }) => {
  const [mode, setMode] = useState(BUILDER_MODES.PARAMETRIC);
  const [form, setForm] = useState(DEFAULT_CUSTOM_TABLE_SPEC);
  const [urlForm, setUrlForm] = useState(DEFAULT_CUSTOM_URL_TABLE_SPEC);
  const [uploadForm, setUploadForm] = useState(DEFAULT_CUSTOM_UPLOAD_TABLE_SPEC);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const normalizedPreview = useMemo(() => normalizeCustomTableSpec(form), [form]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateUrlField = (field, value) => {
    setUrlForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateUploadField = (field, value) => {
    setUploadForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setError("");
    setUploadStatus("");
  };

  const handleReferenceImage = (event) => {
    const file = event.target.files?.[0];
    updateField("referenceImageName", file?.name || "");
  };

  const validateUrlForm = () => {
    const nextErrors = [];

    if (!String(urlForm.modelUrl || "").trim()) {
      nextErrors.push("Model URL là bắt buộc.");
    } else if (!isAcceptedModelUrl(urlForm.modelUrl)) {
      nextErrors.push("Model URL phải bắt đầu bằng http:// hoặc https:// và kết thúc bằng .glb hoặc .gltf.");
    }

    if (urlForm.thumbnailUrl && !isHttpUrl(urlForm.thumbnailUrl)) {
      nextErrors.push("Thumbnail URL phải bắt đầu bằng http:// hoặc https://.");
    }

    return [...nextErrors, ...validateSharedCatalogFields(urlForm)];
  };

  const validateUploadForm = () => {
    const nextErrors = [];
    const modelFile = uploadForm.modelFile;
    const thumbnailFile = uploadForm.thumbnailFile;

    if (!modelFile) {
      nextErrors.push("File model .glb là bắt buộc.");
    } else {
      if (!isGlbFile(modelFile)) nextErrors.push("Phase này chỉ hỗ trợ upload file .glb.");
      if (modelFile.size > MODEL_MAX_SIZE_BYTES) {
        nextErrors.push(`File model tối đa ${formatFileSize(MODEL_MAX_SIZE_BYTES)}.`);
      }
    }

    if (thumbnailFile) {
      if (!IMAGE_MIME_TYPES.has(thumbnailFile.type)) {
        nextErrors.push("Thumbnail phải là ảnh PNG, JPEG hoặc WebP.");
      }
      if (thumbnailFile.size > THUMBNAIL_MAX_SIZE_BYTES) {
        nextErrors.push(`Thumbnail tối đa ${formatFileSize(THUMBNAIL_MAX_SIZE_BYTES)}.`);
      }
    }

    return [...nextErrors, ...validateSharedCatalogFields(uploadForm)];
  };

  const handleUploadAndApply = async () => {
    const validationErrors = validateUploadForm();
    if (validationErrors.length) {
      setError(validationErrors.join(" "));
      return;
    }

    setError("");
    setUploadProgress(0);
    setUploadStatus("Đang upload file model...");
    setIsUploading(true);

    const formData = new FormData();
    formData.append("model", uploadForm.modelFile, uploadForm.modelFile.name);
    if (uploadForm.thumbnailFile) {
      formData.append("thumbnail", uploadForm.thumbnailFile, uploadForm.thumbnailFile.name);
    }

    try {
      const result = await uploadTable3DAsset({
        form: formData,
        onProgress: setUploadProgress,
      });
      setUploadStatus("Upload thành công. Đang lưu vào thư viện...");
      const item = buildUploadedTableCatalogItem({
        ...uploadForm,
        capacity: Number(uploadForm.capacity),
        defaultScale: Number(uploadForm.defaultScale),
        modelUrl: result.modelUrl,
        thumbnailUrl: result.thumbnailUrl || "",
        uploadedFileName: result.fileName || result.originalFileName || uploadForm.modelFile.name,
        uploadedSizeBytes: result.sizeBytes || uploadForm.modelFile.size,
        tags: parseTags(uploadForm.tags),
      });
      onApply?.(item);
      onClose?.();
    } catch (err) {
      setError(err?.message || "Upload thất bại, vui lòng thử lại.");
      setUploadStatus("Upload thất bại.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleApply = () => {
    if (mode === BUILDER_MODES.UPLOAD) {
      handleUploadAndApply();
      return;
    }

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

  const renderCatalogFields = (state, update, prefix) => (
    <>
      <div className="col-md-6">
        <label>Tên mẫu</label>
        <input
          className="form-control"
          value={state.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Ví dụ: Bàn patio GLB 4 chỗ"
        />
      </div>
      <div className="col-md-6">
        <label>Loại bàn</label>
        <select
          className="form-select"
          value={state.tableType}
          onChange={(e) => update("tableType", e.target.value)}
        >
          {TABLE_3D_TYPE_OPTIONS.map((type) => (
            <option key={`${prefix}-${type.value}`} value={type.value}>
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
          value={state.capacity}
          onChange={(e) => update("capacity", e.target.value)}
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
          value={state.defaultScale}
          onChange={(e) => update("defaultScale", e.target.value)}
        />
      </div>
      <div className="col-md-4">
        <label>Tags (dấu phẩy)</label>
        <input
          className="form-control"
          value={state.tags}
          onChange={(e) => update("tags", e.target.value)}
          placeholder="outdoor, wood, glb"
        />
      </div>
      <div className="col-md-6">
        <label>Nguồn model / ghi chú</label>
        <input
          className="form-control"
          value={state.source}
          onChange={(e) => update("source", e.target.value)}
          placeholder="Nội bộ, vendor, URL nguồn..."
        />
      </div>
      <div className="col-md-6">
        <label>License / ghi chú quyền sử dụng</label>
        <input
          className="form-control"
          value={state.licenseLabel}
          onChange={(e) => update("licenseLabel", e.target.value)}
          placeholder="CC0, CC BY, nội bộ đã được phép..."
        />
      </div>
      <div className="col-md-3">
        <label>Rộng (cm)</label>
        <input className="form-control" type="number" min="1" value={state.widthCm} onChange={(e) => update("widthCm", e.target.value)} />
      </div>
      <div className="col-md-3">
        <label>Sâu (cm)</label>
        <input className="form-control" type="number" min="1" value={state.depthCm} onChange={(e) => update("depthCm", e.target.value)} />
      </div>
      <div className="col-md-3">
        <label>Cao (cm)</label>
        <input className="form-control" type="number" min="1" value={state.heightCm} onChange={(e) => update("heightCm", e.target.value)} />
      </div>
      <div className="col-md-3">
        <label>Đường kính (cm)</label>
        <input className="form-control" type="number" min="1" value={state.diameterCm} onChange={(e) => update("diameterCm", e.target.value)} />
      </div>
    </>
  );

  return (
    <Modal isOpen={open} onClose={onClose} size="lg">
      <div className="p-3">
        <h3>✨ Tạo mẫu bàn tùy chỉnh</h3>
        <p className="text-muted">
          Tạo mẫu bằng thông số, thêm model 3D online bằng URL hoặc upload file .glb thật. Chưa hỗ trợ AI dựng 3D từ ảnh.
        </p>

        <div className="btn-group mt-2" role="tablist" aria-label="Chế độ tạo mẫu bàn tùy chỉnh">
          <Button type="button" variant={mode === BUILDER_MODES.PARAMETRIC ? "primary" : "secondary"} onClick={() => handleModeChange(BUILDER_MODES.PARAMETRIC)}>
            Tạo bằng thông số
          </Button>
          <Button type="button" variant={mode === BUILDER_MODES.URL ? "primary" : "secondary"} onClick={() => handleModeChange(BUILDER_MODES.URL)}>
            Thêm model 3D bằng URL
          </Button>
          <Button type="button" variant={mode === BUILDER_MODES.UPLOAD ? "primary" : "secondary"} onClick={() => handleModeChange(BUILDER_MODES.UPLOAD)}>
            Upload model 3D
          </Button>
        </div>

        {error && <div className="alert alert-warning mt-3 mb-0">{error}</div>}

        {mode === BUILDER_MODES.PARAMETRIC && (
          <>
            <div className="row g-3 mt-1">
              <div className="col-md-6">
                <label>Tên mẫu bàn</label>
                <input className="form-control" value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Ví dụ: Booth cửa sổ 6 chỗ" />
              </div>
              <div className="col-md-6">
                <label>Loại hình dáng</label>
                <select className="form-select" value={form.shape} onChange={(e) => updateField("shape", e.target.value)}>
                  {CUSTOM_TABLE_SHAPES.map((shape) => (
                    <option key={shape.value} value={shape.value}>{shape.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label>Khu vực</label>
                <select className="form-select" value={form.area} onChange={(e) => updateField("area", e.target.value)}>
                  {TABLE_AREA_OPTIONS.map((area) => (
                    <option key={area.value} value={area.value}>{area.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label>Số ghế</label>
                <input className="form-control" type="number" min="1" value={form.capacity} onChange={(e) => updateField("capacity", e.target.value)} />
              </div>
              <div className="col-md-3"><label>Rộng (cm)</label><input className="form-control" type="number" min="1" value={form.widthCm} onChange={(e) => updateField("widthCm", e.target.value)} /></div>
              <div className="col-md-3"><label>Sâu (cm)</label><input className="form-control" type="number" min="1" value={form.depthCm} onChange={(e) => updateField("depthCm", e.target.value)} /></div>
              <div className="col-md-3"><label>Cao (cm)</label><input className="form-control" type="number" min="1" value={form.heightCm} onChange={(e) => updateField("heightCm", e.target.value)} /></div>
              <div className="col-md-3"><label>Đường kính (cm)</label><input className="form-control" type="number" min="1" value={form.diameterCm} onChange={(e) => updateField("diameterCm", e.target.value)} /></div>
              <div className="col-md-6"><label>Chất liệu</label><input className="form-control" value={form.material} onChange={(e) => updateField("material", e.target.value)} /></div>
              <div className="col-md-6"><label>Màu</label><input className="form-control" type="color" value={form.color} onChange={(e) => updateField("color", e.target.value)} /></div>
              <div className="col-md-6"><label>Ảnh tham khảo nội bộ</label><input className="form-control" type="file" accept="image/*" onChange={handleReferenceImage} /></div>
              <div className="col-md-6"><label>Ghi chú</label><input className="form-control" value={form.notes} onChange={(e) => updateField("notes", e.target.value)} /></div>
              <div className="col-12">
                <div className="alert alert-info mb-0">
                  Preview: {getCustomTableShapeLabel(normalizedPreview.shape)} • {normalizedPreview.capacity} ghế • {normalizedPreview.widthCm} x {normalizedPreview.depthCm} x {normalizedPreview.heightCm} cm{normalizedPreview.shape === "round" ? ` • Ø ${normalizedPreview.diameterCm} cm` : ""} • Khu vực: {getTableAreaLabel(normalizedPreview.area)}
                </div>
              </div>
            </div>
          </>
        )}

        {mode === BUILDER_MODES.URL && (
          <div className="row g-3 mt-1">
            {renderCatalogFields(urlForm, updateUrlField, "url")}
            <div className="col-12">
              <label>Model URL (.glb/.gltf)</label>
              <input className="form-control" value={urlForm.modelUrl} onChange={(e) => updateUrlField("modelUrl", e.target.value)} placeholder="https://example.com/table.glb" />
            </div>
            <div className="col-12">
              <label>Thumbnail URL</label>
              <input className="form-control" value={urlForm.thumbnailUrl} onChange={(e) => updateUrlField("thumbnailUrl", e.target.value)} placeholder="https://example.com/table-thumbnail.jpg" />
            </div>
          </div>
        )}

        {mode === BUILDER_MODES.UPLOAD && (
          <div className="row g-3 mt-1">
            {renderCatalogFields(uploadForm, updateUploadField, "upload")}
            <div className="col-md-6">
              <label>File model .glb</label>
              <input className="form-control" type="file" accept=".glb,model/gltf-binary" onChange={(event) => updateUploadField("modelFile", event.target.files?.[0] || null)} />
              {uploadForm.modelFile && <small className="text-muted">{uploadForm.modelFile.name} • {formatFileSize(uploadForm.modelFile.size)}</small>}
            </div>
            <div className="col-md-6">
              <label>Thumbnail ảnh optional</label>
              <input className="form-control" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => updateUploadField("thumbnailFile", event.target.files?.[0] || null)} />
              {uploadForm.thumbnailFile && <small className="text-muted">{uploadForm.thumbnailFile.name} • {formatFileSize(uploadForm.thumbnailFile.size)}</small>}
            </div>
            <div className="col-12">
              <div className="alert alert-info mb-0">
                File model tối đa {formatFileSize(MODEL_MAX_SIZE_BYTES)}; thumbnail tối đa {formatFileSize(THUMBNAIL_MAX_SIZE_BYTES)}. Xóa mẫu khỏi thư viện chỉ xóa metadata trong trình duyệt, chưa xóa file trên server.
              </div>
            </div>
            {(uploadStatus || uploadProgress > 0) && (
              <div className="col-12">
                <div className="alert alert-secondary mb-0">
                  {uploadStatus || "Đang upload..."} {uploadProgress > 0 ? `(${uploadProgress}%)` : ""}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="d-flex justify-content-end gap-2 mt-3">
          <Button variant="secondary" onClick={onClose} disabled={isUploading}>Hủy</Button>
          <Button variant="primary" onClick={handleApply} disabled={isUploading}>
            {mode === BUILDER_MODES.UPLOAD ? (isUploading ? "Đang upload..." : "Upload & lưu vào thư viện") : "Lưu vào thư viện"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CustomTableModelBuilderModal;
