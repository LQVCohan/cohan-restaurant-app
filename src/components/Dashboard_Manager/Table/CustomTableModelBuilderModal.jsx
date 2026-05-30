import React, { useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import { getGraphqlUrl } from "@/lib/apiBaseUrl";
import { TABLE_3D_TYPE_OPTIONS } from "@/config/table3dCatalog";
import {
  buildAiGeneratedTableCatalogItem,
  buildCustomTableCatalogItem,
  buildCustomUrlTableCatalogItem,
  buildUploadedTableCatalogItem,
  CUSTOM_TABLE_SHAPES,
  DEFAULT_AI_TABLE_SPEC,
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
  AI: "ai",
};

const MODEL_MAX_SIZE_BYTES = 15 * 1024 * 1024;
const THUMBNAIL_MAX_SIZE_BYTES = 3 * 1024 * 1024;
const AI_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const AI_MIN_IMAGES = 3;
const AI_MAX_IMAGES = 5;
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


const requestAiTable3DGeneration = (formData) =>
  fetch(`${getApiBase()}/api/table-3d-ai/generate`, {
    method: "POST",
    credentials: "include",
    body: formData,
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok && !payload?.status) {
      throw new Error(payload?.message || `Yêu cầu AI thất bại (HTTP ${response.status}).`);
    }
    return payload;
  });

const fetchAiTable3DJobStatus = (jobId) =>
  fetch(`${getApiBase()}/api/table-3d-ai/jobs/${encodeURIComponent(jobId)}`, {
    credentials: "include",
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok && !payload?.status) {
      throw new Error(payload?.message || `Kiểm tra trạng thái AI thất bại (HTTP ${response.status}).`);
    }
    return payload;
  });

const getAiStatusLabel = (status) => ({
  idle: "Chưa cấu hình AI provider",
  submitting: "Đang gửi yêu cầu",
  queued: "Đã tạo job",
  processing: "Đang xử lý",
  completed: "Hoàn tất",
  failed: "Lỗi",
  not_configured: "Chưa cấu hình AI provider",
  pending_provider: "Chờ tích hợp provider",
  demo_only: "Mock/dev demo_only",
}[status] || status || "Chưa gửi yêu cầu");

const CustomTableModelBuilderModal = ({ open, onClose, onApply }) => {
  const [mode, setMode] = useState(BUILDER_MODES.PARAMETRIC);
  const [form, setForm] = useState(DEFAULT_CUSTOM_TABLE_SPEC);
  const [urlForm, setUrlForm] = useState(DEFAULT_CUSTOM_URL_TABLE_SPEC);
  const [uploadForm, setUploadForm] = useState(DEFAULT_CUSTOM_UPLOAD_TABLE_SPEC);
  const [aiForm, setAiForm] = useState(DEFAULT_AI_TABLE_SPEC);
  const [aiJob, setAiJob] = useState(null);
  const [aiStatus, setAiStatus] = useState("idle");
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

  const updateAiField = (field, value) => {
    setAiForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setError("");
    setUploadStatus("");
    if (nextMode !== BUILDER_MODES.AI) setAiStatus("idle");
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


  const handleAiImagesSelected = (event) => {
    const selected = Array.from(event.target.files || []);
    const nextImages = [...(aiForm.referenceImages || []), ...selected].slice(0, AI_MAX_IMAGES);
    updateAiField("referenceImages", nextImages);
    event.target.value = "";
  };

  const removeAiImage = (index) => {
    updateAiField("referenceImages", (aiForm.referenceImages || []).filter((_, imageIndex) => imageIndex !== index));
  };

  const validateAiForm = () => {
    const nextErrors = [];
    const images = aiForm.referenceImages || [];
    if (!String(aiForm.name || "").trim()) nextErrors.push("Tên mẫu là bắt buộc.");
    if (!String(aiForm.tableType || "").trim()) nextErrors.push("Loại bàn là bắt buộc.");
    if (images.length < AI_MIN_IMAGES) nextErrors.push("Cần ít nhất 3 ảnh tham khảo.");
    if (images.length > AI_MAX_IMAGES) nextErrors.push("Tối đa 5 ảnh tham khảo.");
    images.forEach((file) => {
      if (!IMAGE_MIME_TYPES.has(file.type)) nextErrors.push(`${file.name}: chỉ hỗ trợ PNG, JPEG hoặc WebP.`);
      if (file.size > AI_IMAGE_MAX_SIZE_BYTES) nextErrors.push(`${file.name}: tối đa ${formatFileSize(AI_IMAGE_MAX_SIZE_BYTES)}.`);
    });
    return [...nextErrors, ...validateSharedCatalogFields(aiForm)];
  };

  const handleAiSubmit = async () => {
    const validationErrors = validateAiForm();
    if (validationErrors.length) {
      setError(validationErrors.join(" "));
      return;
    }

    setError("");
    setAiStatus("submitting");
    const formData = new FormData();
    formData.append("metadata", JSON.stringify({
      name: aiForm.name,
      tableType: aiForm.tableType,
      capacity: Number(aiForm.capacity),
      defaultScale: Number(aiForm.defaultScale),
      dimensions: {
        width: aiForm.widthCm,
        depth: aiForm.depthCm,
        height: aiForm.heightCm,
        diameter: aiForm.diameterCm,
      },
      material: aiForm.material,
      color: aiForm.color,
      notes: aiForm.notes,
      tags: parseTags(aiForm.tags),
      licenseLabel: aiForm.licenseLabel,
    }));
    (aiForm.referenceImages || []).forEach((file) => formData.append("images", file, file.name));

    try {
      const result = await requestAiTable3DGeneration(formData);
      setAiJob(result);
      setAiStatus(result.status || (result.ok ? "queued" : "failed"));
      if (result.status === "not_configured") {
        setError("Tính năng AI đang chờ cấu hình dịch vụ sinh model 3D.");
      } else if (result.status === "pending_provider") {
        setError(result.message || "Provider AI đã khai báo nhưng adapter sinh model 3D chưa được tích hợp.");
      }
    } catch (err) {
      setAiStatus("failed");
      setError(err?.message || "Không gửi được yêu cầu AI.");
    }
  };

  const handleAiCheckStatus = async () => {
    if (!aiJob?.jobId) return;
    setError("");
    try {
      const result = await fetchAiTable3DJobStatus(aiJob.jobId);
      setAiJob((prev) => ({ ...(prev || {}), ...result }));
      setAiStatus(result.status || "processing");
      if (result.status === "not_configured") {
        setError("Tính năng AI đang chờ cấu hình dịch vụ sinh model 3D.");
        return;
      }
      if (result.status === "completed" && result.generatedModelUrl) {
        const item = buildAiGeneratedTableCatalogItem({
          ...aiForm,
          capacity: Number(aiForm.capacity),
          defaultScale: Number(aiForm.defaultScale),
          tags: parseTags(aiForm.tags),
          generatedModelUrl: result.generatedModelUrl,
          generatedThumbnailUrl: result.generatedThumbnailUrl || "",
          aiJobId: result.jobId || aiJob.jobId,
          aiProvider: result.aiProvider || result.provider || aiJob.provider || "",
          generationStatus: result.status,
        });
        if (item) {
          onApply?.(item);
          onClose?.();
        }
      }
    } catch (err) {
      setAiStatus("failed");
      setError(err?.message || "Không kiểm tra được trạng thái job AI.");
    }
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

    if (mode === BUILDER_MODES.AI) {
      handleAiSubmit();
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
          Tạo mẫu bằng thông số, thêm model 3D online bằng URL, upload file .glb thật hoặc gửi yêu cầu AI dựng model từ ảnh tham khảo khi provider được cấu hình.
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
          <Button type="button" variant={mode === BUILDER_MODES.AI ? "primary" : "secondary"} onClick={() => handleModeChange(BUILDER_MODES.AI)}>
            Tạo model 3D bằng AI
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

        {mode === BUILDER_MODES.AI && (
          <div className="row g-3 mt-1">
            {renderCatalogFields(aiForm, updateAiField, "ai")}
            <div className="col-md-6"><label>Chất liệu</label><input className="form-control" value={aiForm.material} onChange={(e) => updateAiField("material", e.target.value)} placeholder="gỗ, đá, kim loại..." /></div>
            <div className="col-md-6"><label>Màu sắc</label><input className="form-control" value={aiForm.color} onChange={(e) => updateAiField("color", e.target.value)} placeholder="nâu gỗ, đen mờ..." /></div>
            <div className="col-12"><label>Ghi chú mô tả</label><textarea className="form-control" rows="2" value={aiForm.notes} onChange={(e) => updateAiField("notes", e.target.value)} placeholder="Mô tả chi tiết mặt bàn, chân bàn, cạnh bo, phong cách..." /></div>
            <div className="col-12">
              <label>Ảnh tham khảo (3–5 ảnh)</label>
              <input className="form-control" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={handleAiImagesSelected} />
              <small className="text-muted">Gợi ý: mặt trước, mặt bên, mặt trên nếu có, ảnh có vật chuẩn kích thước nếu có. Mỗi ảnh tối đa {formatFileSize(AI_IMAGE_MAX_SIZE_BYTES)}.</small>
            </div>
            {(aiForm.referenceImages || []).length > 0 && (
              <div className="col-12">
                <div className="list-group">
                  {(aiForm.referenceImages || []).map((file, index) => (
                    <div className="list-group-item d-flex justify-content-between align-items-center" key={`${file.name}-${file.size}-${index}`}>
                      <span>{index + 1}. {file.name} • {formatFileSize(file.size)}</span>
                      <Button type="button" variant="secondary" onClick={() => removeAiImage(index)}>Remove</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="col-12">
              <div className="alert alert-info mb-0">
                <strong>Quy tắc ảnh:</strong> ảnh sáng rõ; thấy toàn bộ bàn; ít vật che khuất; nền càng sạch càng tốt; không có người/khách hàng/thông tin nhạy cảm; nên có vật chuẩn hoặc nhập kích thước thật.
              </div>
            </div>
            <div className="col-12">
              <div className="alert alert-secondary mb-0">
                Trạng thái: <strong>{getAiStatusLabel(aiStatus)}</strong>{aiJob?.jobId ? ` • Job: ${aiJob.jobId}` : ""}
                {aiJob?.message ? <div>{aiJob.message}</div> : null}
                {aiJob?.warnings?.length ? <div>Cảnh báo: {aiJob.warnings.join(", ")}</div> : null}
              </div>
            </div>
            {aiJob?.jobId && (
              <div className="col-12">
                <Button type="button" variant="secondary" onClick={handleAiCheckStatus} disabled={aiStatus === "submitting"}>Kiểm tra trạng thái</Button>
              </div>
            )}
          </div>
        )}

        <div className="d-flex justify-content-end gap-2 mt-3">
          <Button variant="secondary" onClick={onClose} disabled={isUploading || aiStatus === "submitting"}>Hủy</Button>
          <Button variant="primary" onClick={handleApply} disabled={isUploading || aiStatus === "submitting"}>
            {mode === BUILDER_MODES.UPLOAD
              ? (isUploading ? "Đang upload..." : "Upload & lưu vào thư viện")
              : mode === BUILDER_MODES.AI
                ? (aiStatus === "submitting" ? "Đang gửi yêu cầu..." : "Gửi yêu cầu AI")
                : "Lưu vào thư viện"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CustomTableModelBuilderModal;
