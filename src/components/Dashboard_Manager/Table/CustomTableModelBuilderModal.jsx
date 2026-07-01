import React, { useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import { toBackendRootUrl } from "@/lib/apiBaseUrl";
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

const BUILDER_TABS = [
  {
    value: BUILDER_MODES.PARAMETRIC,
    icon: "▦",
    label: "Thông số",
    description: "Dựng nhanh bằng kích thước",
  },
  {
    value: BUILDER_MODES.URL,
    icon: "🔗",
    label: "URL model",
    description: "Dùng file .glb/.gltf online",
  },
  {
    value: BUILDER_MODES.UPLOAD,
    icon: "⬆",
    label: "Upload .glb",
    description: "Tải model thật lên server",
  },
  {
    value: BUILDER_MODES.AI,
    icon: "✦",
    label: "AI từ ảnh",
    description: "Tạo job khi provider sẵn sàng",
  },
];

const MODEL_MAX_SIZE_BYTES = 15 * 1024 * 1024;
const THUMBNAIL_MAX_SIZE_BYTES = 3 * 1024 * 1024;
const AI_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const AI_MIN_IMAGES = 3;
const AI_MAX_IMAGES = 4;
const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());

const isAcceptedModelUrl = (value) => {
  if (!isHttpUrl(value)) return false;
  const withoutQuery = String(value).split(/[?#]/)[0].toLowerCase();
  return withoutQuery.endsWith(".glb") || withoutQuery.endsWith(".gltf");
};

const parseTags = (value) =>
  Array.isArray(value)
    ? value
        .map(String)
        .map((tag) => tag.trim())
        .filter(Boolean)
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

const isGlbFile = (file) =>
  String(file?.name || "")
    .toLowerCase()
    .endsWith(".glb");

const validateSharedCatalogFields = (source) => {
  const nextErrors = [];
  const capacity = Number(source.capacity);
  const defaultScale = Number(source.defaultScale);

  if (!Number.isFinite(capacity) || capacity < 1) {
    nextErrors.push("Số ghế phải lớn hơn hoặc bằng 1.");
  }

  if (
    !Number.isFinite(defaultScale) ||
    defaultScale < 0.2 ||
    defaultScale > 3
  ) {
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
    xhr.open("POST", toBackendRootUrl("/table-3d-assets/upload"));
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

      if (
        xhr.status >= 200 &&
        xhr.status < 300 &&
        payload?.ok &&
        payload?.modelUrl
      ) {
        resolve(payload);
        return;
      }
      reject(
        new Error(payload?.message || `Upload thất bại (HTTP ${xhr.status}).`),
      );
    };
    xhr.onerror = () => reject(new Error("Không thể kết nối backend upload."));
    xhr.send(form);
  });

const requestAiTable3DGeneration = (formData) =>
  fetch(toBackendRootUrl("/table-3d-ai/generate"), {
    method: "POST",
    credentials: "include",
    body: formData,
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok && !payload?.status) {
      throw new Error(
        payload?.message || `Yêu cầu AI thất bại (HTTP ${response.status}).`,
      );
    }
    return payload;
  });

const fetchAiTable3DJobStatus = (jobId) =>
  fetch(toBackendRootUrl(`/table-3d-ai/jobs/${encodeURIComponent(jobId)}`), {
    credentials: "include",
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok && !payload?.status) {
      throw new Error(
        payload?.message ||
          `Kiểm tra trạng thái AI thất bại (HTTP ${response.status}).`,
      );
    }
    return payload;
  });

const getAiStatusLabel = (status) =>
  ({
    idle: "Chưa cấu hình AI provider",
    submitting: "Đang gửi yêu cầu",
    queued: "Đã tạo job",
    processing: "Đang xử lý",
    completed: "Hoàn tất",
    failed: "Lỗi",
    not_configured: "Chưa cấu hình AI provider",
    pending_provider: "Chờ tích hợp provider",
    demo_only: "Mock/dev demo_only",
  })[status] ||
  status ||
  "Chưa gửi yêu cầu";

const Field = ({ label, hint, children, className = "" }) => (
  <label className={`custom-table-builder__field ${className}`.trim()}>
    <span className="custom-table-builder__label">{label}</span>
    {children}
    {hint && <small className="custom-table-builder__hint">{hint}</small>}
  </label>
);

const Section = ({ title, eyebrow, children, className = "" }) => (
  <section className={`custom-table-builder__section ${className}`.trim()}>
    <div className="custom-table-builder__section-heading">
      {eyebrow && <span>{eyebrow}</span>}
      <h4>{title}</h4>
    </div>
    <div className="custom-table-builder__grid">{children}</div>
  </section>
);

const StatusCard = ({ tone = "info", children }) => (
  <div
    className={`custom-table-builder__status custom-table-builder__status--${tone}`}
  >
    {children}
  </div>
);

const CustomTableModelBuilderModal = ({ open, onClose, onApply }) => {
  const [mode, setMode] = useState(BUILDER_MODES.PARAMETRIC);
  const [form, setForm] = useState(DEFAULT_CUSTOM_TABLE_SPEC);
  const [urlForm, setUrlForm] = useState(DEFAULT_CUSTOM_URL_TABLE_SPEC);
  const [uploadForm, setUploadForm] = useState(
    DEFAULT_CUSTOM_UPLOAD_TABLE_SPEC,
  );
  const [aiForm, setAiForm] = useState(DEFAULT_AI_TABLE_SPEC);
  const [aiJob, setAiJob] = useState(null);
  const [aiStatus, setAiStatus] = useState("idle");
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const normalizedPreview = useMemo(
    () => normalizeCustomTableSpec(form),
    [form],
  );

  const activeTab =
    BUILDER_TABS.find((tab) => tab.value === mode) || BUILDER_TABS[0];
  const isAiGenerating = ["submitting", "queued", "processing"].includes(aiStatus);
  const isBusy = isUploading || aiStatus === "submitting";

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
      nextErrors.push(
        "Model URL phải bắt đầu bằng http:// hoặc https:// và kết thúc bằng .glb hoặc .gltf.",
      );
    }

    if (urlForm.thumbnailUrl && !isHttpUrl(urlForm.thumbnailUrl)) {
      nextErrors.push("Thumbnail URL phải bắt đầu bằng http:// hoặc https://.");
    }

    nextErrors.push(...validateSharedCatalogFields(urlForm));
    return nextErrors;
  };

  const validateUploadForm = () => {
    const nextErrors = [];
    const modelFile = uploadForm.modelFile;
    const thumbnailFile = uploadForm.thumbnailFile;

    if (!modelFile) {
      nextErrors.push("Vui lòng chọn file model .glb.");
    } else {
      if (!isGlbFile(modelFile)) {
        nextErrors.push("Chỉ hỗ trợ file .glb cho model tải lên.");
      }
      if (modelFile.size > MODEL_MAX_SIZE_BYTES) {
        nextErrors.push(`Model tối đa ${formatFileSize(MODEL_MAX_SIZE_BYTES)}.`);
      }
    }

    if (thumbnailFile) {
      if (!IMAGE_MIME_TYPES.has(thumbnailFile.type)) {
        nextErrors.push("Thumbnail chỉ hỗ trợ PNG, JPG hoặc WEBP.");
      }
      if (thumbnailFile.size > THUMBNAIL_MAX_SIZE_BYTES) {
        nextErrors.push(`Thumbnail tối đa ${formatFileSize(THUMBNAIL_MAX_SIZE_BYTES)}.`);
      }
    }

    nextErrors.push(...validateSharedCatalogFields(uploadForm));
    return nextErrors;
  };

  const validateAiForm = () => {
    const nextErrors = [];
    const images = Array.from(aiForm.images || []);
    if (images.length < AI_MIN_IMAGES) nextErrors.push("Cần ít nhất 3 ảnh tham chiếu.");
    if (images.length > AI_MAX_IMAGES) nextErrors.push("Tối đa 4 ảnh tham chiếu.");
    images.forEach((file) => {
      if (!IMAGE_MIME_TYPES.has(file.type)) nextErrors.push(`${file.name}: chỉ hỗ trợ PNG, JPG hoặc WEBP.`);
      if (file.size > AI_IMAGE_MAX_SIZE_BYTES) nextErrors.push(`${file.name}: tối đa ${formatFileSize(AI_IMAGE_MAX_SIZE_BYTES)}.`);
    });
    nextErrors.push(...validateSharedCatalogFields(aiForm));
    return nextErrors;
  };

  const handleApplyParametric = () => {
    const errors = validateSharedCatalogFields(form);
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    onApply(buildCustomTableCatalogItem(form));
    onClose?.();
  };

  const handleApplyUrl = () => {
    const errors = validateUrlForm();
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    onApply(buildCustomUrlTableCatalogItem(urlForm));
    onClose?.();
  };

  const handleUploadModel = async () => {
    const errors = validateUploadForm();
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }

    const uploadPayload = new FormData();
    uploadPayload.append("model", uploadForm.modelFile, uploadForm.modelFile.name);
    if (uploadForm.thumbnailFile) {
      uploadPayload.append("thumbnail", uploadForm.thumbnailFile, uploadForm.thumbnailFile.name);
    }

    uploadPayload.append(
      "metadata",
      JSON.stringify({
        type: uploadForm.type,
        label: uploadForm.label,
        capacity: Number(uploadForm.capacity),
        area: uploadForm.area,
        defaultScale: Number(uploadForm.defaultScale),
        dimensionsCm: {
          width: Number(uploadForm.widthCm) || null,
          depth: Number(uploadForm.depthCm) || null,
          height: Number(uploadForm.heightCm) || null,
          diameter: Number(uploadForm.diameterCm) || null,
        },
        tags: parseTags(uploadForm.tags),
      }),
    );

    setError("");
    setUploadProgress(0);
    setUploadStatus("Đang tải model 3D lên server...");
    setIsUploading(true);

    try {
      const payload = await uploadTable3DAsset({
        form: uploadPayload,
        onProgress: setUploadProgress,
      });
      const item = buildUploadedTableCatalogItem({
        ...uploadForm,
        modelUrl: payload.modelUrl,
        thumbnailUrl: payload.thumbnailUrl,
        fileName: payload.fileName,
        sizeBytes: payload.sizeBytes,
      });
      setUploadStatus("Đã upload model. Mẫu mới đã sẵn sàng để dùng trong sơ đồ bàn.");
      onApply(item);
      onClose?.();
    } catch (err) {
      setError(err?.message || "Không thể tải model lên server.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmitAi = async () => {
    if (isAiGenerating) return;
    const errors = validateAiForm();
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }

    const formData = new FormData();
    Array.from(aiForm.images || []).forEach((file) => formData.append("images", file, file.name));
    formData.append("metadata", JSON.stringify({
      type: aiForm.type,
      label: aiForm.label,
      prompt: aiForm.prompt,
      capacity: Number(aiForm.capacity),
      area: aiForm.area,
      defaultScale: Number(aiForm.defaultScale),
      dimensionsCm: {
        width: Number(aiForm.widthCm) || null,
        depth: Number(aiForm.depthCm) || null,
        height: Number(aiForm.heightCm) || null,
        diameter: Number(aiForm.diameterCm) || null,
      },
      tags: parseTags(aiForm.tags),
    }));

    setError("");
    setAiStatus("submitting");
    try {
      const payload = await requestAiTable3DGeneration(formData);
      setAiJob(payload);
      setAiStatus(payload.status || "queued");
      if (payload?.generatedModelUrl) {
        onApply(buildAiGeneratedTableCatalogItem({
          ...aiForm,
          modelUrl: payload.generatedModelUrl,
          thumbnailUrl: payload.generatedThumbnailUrl,
          jobId: payload.jobId,
        }));
      }
    } catch (err) {
      setAiStatus("failed");
      setError(err?.message || "Không thể tạo job AI.");
    }
  };

  const handleRefreshAiJob = async () => {
    const jobId = aiJob?.jobId;
    if (!jobId) return;
    setAiStatus("processing");
    try {
      const payload = await fetchAiTable3DJobStatus(jobId);
      setAiJob((prev) => ({ ...(prev || {}), ...payload }));
      setAiStatus(payload.status || "processing");
      if (payload?.generatedModelUrl) {
        onApply(buildAiGeneratedTableCatalogItem({
          ...aiForm,
          modelUrl: payload.generatedModelUrl,
          thumbnailUrl: payload.generatedThumbnailUrl,
          jobId,
        }));
      }
    } catch (err) {
      setAiStatus("failed");
      setError(err?.message || "Không kiểm tra được trạng thái job AI.");
    }
  };

  if (!open) return null;

  return (
    <Modal
      isOpen={open}
      onClose={isBusy ? undefined : onClose}
      title="Tạo mẫu bàn tùy chỉnh"
      size="xl"
      className="custom-table-builder-modal"
    >
      <div className="custom-table-builder">
        <aside className="custom-table-builder__tabs" aria-label="Chọn cách tạo mẫu bàn">
          {BUILDER_TABS.map((tab) => (
            <button
              type="button"
              key={tab.value}
              className={mode === tab.value ? "active" : ""}
              onClick={() => handleModeChange(tab.value)}
              disabled={isBusy}
            >
              <span className="custom-table-builder__tab-icon">{tab.icon}</span>
              <strong>{tab.label}</strong>
              <small>{tab.description}</small>
            </button>
          ))}
        </aside>

        <main className="custom-table-builder__content">
          {mode === BUILDER_MODES.PARAMETRIC && (
            <>
              <Section title="Thông tin mẫu" eyebrow="Tùy chỉnh nhanh">
                <Field label="Tên mẫu">
                  <input value={form.label} onChange={(e) => updateField("label", e.target.value)} />
                </Field>
                <Field label="Loại bàn">
                  <select value={form.type} onChange={(e) => updateField("type", e.target.value)}>
                    {TABLE_3D_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Khu vực gợi ý">
                  <select value={form.area} onChange={(e) => updateField("area", e.target.value)}>
                    {TABLE_AREA_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{getTableAreaLabel(option.value)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Sức chứa">
                  <input type="number" min="1" value={form.capacity} onChange={(e) => updateField("capacity", e.target.value)} />
                </Field>
              </Section>
              <Section title="Kích thước & hiển thị" eyebrow="cm / scale">
                {CUSTOM_TABLE_SHAPES.map((shape) => (
                  <button
                    type="button"
                    key={shape}
                    className={`custom-table-builder__shape ${form.shape === shape ? "active" : ""}`}
                    onClick={() => updateField("shape", shape)}
                  >
                    {getCustomTableShapeLabel(shape)}
                  </button>
                ))}
                <Field label="Rộng (cm)"><input type="number" value={form.widthCm} onChange={(e) => updateField("widthCm", e.target.value)} /></Field>
                <Field label="Sâu (cm)"><input type="number" value={form.depthCm} onChange={(e) => updateField("depthCm", e.target.value)} /></Field>
                <Field label="Cao (cm)"><input type="number" value={form.heightCm} onChange={(e) => updateField("heightCm", e.target.value)} /></Field>
                <Field label="Đường kính (cm)"><input type="number" value={form.diameterCm} onChange={(e) => updateField("diameterCm", e.target.value)} /></Field>
                <Field label="Scale mặc định"><input type="number" step="0.05" value={form.defaultScale} onChange={(e) => updateField("defaultScale", e.target.value)} /></Field>
                <Field label="Tag"><input value={form.tags} onChange={(e) => updateField("tags", e.target.value)} placeholder="wood, vip, sofa..." /></Field>
                <Field label="Ảnh tham chiếu" hint="Chỉ lưu tên file để gợi ý, không upload ở chế độ này.">
                  <input type="file" accept="image/*" onChange={handleReferenceImage} />
                </Field>
              </Section>
              <StatusCard>
                Preview: {normalizedPreview.label} · {normalizedPreview.capacity} ghế · {getCustomTableShapeLabel(normalizedPreview.shape)}
              </StatusCard>
              <div className="custom-table-builder__actions"><Button variant="primary" onClick={handleApplyParametric}>Dùng mẫu này</Button></div>
            </>
          )}

          {mode === BUILDER_MODES.URL && (
            <>
              <Section title="Nguồn model online" eyebrow="GLB / GLTF">
                <Field label="Tên mẫu"><input value={urlForm.label} onChange={(e) => updateUrlField("label", e.target.value)} /></Field>
                <Field label="Model URL" className="span-2" hint="URL phải trỏ trực tiếp tới file .glb hoặc .gltf."><input value={urlForm.modelUrl} onChange={(e) => updateUrlField("modelUrl", e.target.value)} /></Field>
                <Field label="Thumbnail URL" className="span-2"><input value={urlForm.thumbnailUrl} onChange={(e) => updateUrlField("thumbnailUrl", e.target.value)} /></Field>
                <Field label="Loại bàn"><select value={urlForm.type} onChange={(e) => updateUrlField("type", e.target.value)}>{TABLE_3D_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                <Field label="Sức chứa"><input type="number" min="1" value={urlForm.capacity} onChange={(e) => updateUrlField("capacity", e.target.value)} /></Field>
                <Field label="Khu vực"><select value={urlForm.area} onChange={(e) => updateUrlField("area", e.target.value)}>{TABLE_AREA_OPTIONS.map((option) => <option key={option.value} value={option.value}>{getTableAreaLabel(option.value)}</option>)}</select></Field>
                <Field label="Scale"><input type="number" step="0.05" value={urlForm.defaultScale} onChange={(e) => updateUrlField("defaultScale", e.target.value)} /></Field>
                <Field label="Tag"><input value={urlForm.tags} onChange={(e) => updateUrlField("tags", e.target.value)} /></Field>
              </Section>
              <div className="custom-table-builder__actions"><Button variant="primary" onClick={handleApplyUrl}>Dùng URL model</Button></div>
            </>
          )}

          {mode === BUILDER_MODES.UPLOAD && (
            <>
              <Section title="Upload model thật" eyebrow="Local backend">
                <Field label="Tên mẫu"><input value={uploadForm.label} onChange={(e) => updateUploadField("label", e.target.value)} /></Field>
                <Field label="File model .glb" hint={`Tối đa ${formatFileSize(MODEL_MAX_SIZE_BYTES)}.`}>
                  <input type="file" accept=".glb,model/gltf-binary" onChange={(e) => updateUploadField("modelFile", e.target.files?.[0] || null)} />
                </Field>
                <Field label="Thumbnail" hint={`PNG/JPG/WEBP, tối đa ${formatFileSize(THUMBNAIL_MAX_SIZE_BYTES)}.`}>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => updateUploadField("thumbnailFile", e.target.files?.[0] || null)} />
                </Field>
                <Field label="Loại bàn"><select value={uploadForm.type} onChange={(e) => updateUploadField("type", e.target.value)}>{TABLE_3D_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                <Field label="Sức chứa"><input type="number" min="1" value={uploadForm.capacity} onChange={(e) => updateUploadField("capacity", e.target.value)} /></Field>
                <Field label="Khu vực"><select value={uploadForm.area} onChange={(e) => updateUploadField("area", e.target.value)}>{TABLE_AREA_OPTIONS.map((option) => <option key={option.value} value={option.value}>{getTableAreaLabel(option.value)}</option>)}</select></Field>
                <Field label="Scale"><input type="number" step="0.05" value={uploadForm.defaultScale} onChange={(e) => updateUploadField("defaultScale", e.target.value)} /></Field>
                <Field label="Tag"><input value={uploadForm.tags} onChange={(e) => updateUploadField("tags", e.target.value)} /></Field>
              </Section>
              {uploadStatus && <StatusCard>{uploadStatus} {uploadProgress > 0 ? `${uploadProgress}%` : ""}</StatusCard>}
              <div className="custom-table-builder__actions"><Button variant="primary" onClick={handleUploadModel} disabled={isUploading}>{isUploading ? "Đang upload..." : "Upload và dùng mẫu"}</Button></div>
            </>
          )}

          {mode === BUILDER_MODES.AI && (
            <>
              <Section title="Tạo mẫu bằng AI" eyebrow="Preview provider">
                <Field label="Tên mẫu"><input value={aiForm.label} onChange={(e) => updateAiField("label", e.target.value)} /></Field>
                <Field label="Ảnh tham chiếu" className="span-2" hint="Cần 3–4 ảnh từ nhiều góc để tạo job.">
                  <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => updateAiField("images", Array.from(e.target.files || []))} />
                </Field>
                <Field label="Prompt" className="span-2"><textarea value={aiForm.prompt} onChange={(e) => updateAiField("prompt", e.target.value)} rows={4} /></Field>
                <Field label="Loại bàn"><select value={aiForm.type} onChange={(e) => updateAiField("type", e.target.value)}>{TABLE_3D_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                <Field label="Sức chứa"><input type="number" min="1" value={aiForm.capacity} onChange={(e) => updateAiField("capacity", e.target.value)} /></Field>
                <Field label="Khu vực"><select value={aiForm.area} onChange={(e) => updateAiField("area", e.target.value)}>{TABLE_AREA_OPTIONS.map((option) => <option key={option.value} value={option.value}>{getTableAreaLabel(option.value)}</option>)}</select></Field>
                <Field label="Scale"><input type="number" step="0.05" value={aiForm.defaultScale} onChange={(e) => updateAiField("defaultScale", e.target.value)} /></Field>
                <Field label="Tag"><input value={aiForm.tags} onChange={(e) => updateAiField("tags", e.target.value)} /></Field>
              </Section>
              <StatusCard tone={aiStatus === "failed" ? "danger" : "info"}>
                Trạng thái: {getAiStatusLabel(aiStatus)}
                {aiJob?.message ? ` · ${aiJob.message}` : ""}
              </StatusCard>
              <div className="custom-table-builder__actions">
                <Button variant="primary" onClick={handleSubmitAi} disabled={isUploading || isAiGenerating}>{isAiGenerating ? "Đang tạo..." : "Gửi job AI"}</Button>
                {aiJob?.jobId && <Button variant="secondary" onClick={handleRefreshAiJob}>Kiểm tra job</Button>}
              </div>
            </>
          )}

          {error && <StatusCard tone="danger">{error}</StatusCard>}
        </main>
      </div>
    </Modal>
  );
};

export default CustomTableModelBuilderModal;
