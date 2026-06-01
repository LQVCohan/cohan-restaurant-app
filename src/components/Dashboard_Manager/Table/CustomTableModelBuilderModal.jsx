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
  <div className={`custom-table-builder__status custom-table-builder__status--${tone}`}>
    {children}
  </div>
);

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

  const activeTab = BUILDER_TABS.find((tab) => tab.value === mode) || BUILDER_TABS[0];
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

  const renderDimensionsFields = (state, update, prefix) => (
    <>
      <Field label="Rộng (cm)">
        <input className="form-control" type="number" min="1" value={state.widthCm} onChange={(e) => update("widthCm", e.target.value)} />
      </Field>
      <Field label="Sâu (cm)">
        <input className="form-control" type="number" min="1" value={state.depthCm} onChange={(e) => update("depthCm", e.target.value)} />
      </Field>
      <Field label="Cao (cm)">
        <input className="form-control" type="number" min="1" value={state.heightCm} onChange={(e) => update("heightCm", e.target.value)} />
      </Field>
      <Field label="Đường kính (cm)" hint={prefix === "parametric" ? "Dùng cho bàn tròn" : "Tuỳ chọn"}>
        <input className="form-control" type="number" min="1" value={state.diameterCm} onChange={(e) => update("diameterCm", e.target.value)} />
      </Field>
    </>
  );

  const renderCatalogCoreSections = (state, update, prefix) => (
    <>
      <Section title="Thông tin mẫu" eyebrow="01">
        <Field label="Tên mẫu">
          <input
            className="form-control"
            value={state.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Ví dụ: Bàn patio GLB 4 chỗ"
          />
        </Field>
        <Field label="Loại bàn">
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
        </Field>
        <Field label="Số ghế">
          <input
            className="form-control"
            type="number"
            min="1"
            value={state.capacity}
            onChange={(e) => update("capacity", e.target.value)}
          />
        </Field>
        <Field label="defaultScale" hint="0.2–3">
          <input
            className="form-control"
            type="number"
            min="0.2"
            max="3"
            step="0.05"
            value={state.defaultScale}
            onChange={(e) => update("defaultScale", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Kích thước thực tế" eyebrow="02">
        {renderDimensionsFields(state, update, prefix)}
      </Section>

      <Section title="Nguồn và quyền sử dụng" eyebrow="03">
        <Field label="Nguồn model / ghi chú" className="custom-table-builder__field--wide">
          <input
            className="form-control"
            value={state.source}
            onChange={(e) => update("source", e.target.value)}
            placeholder="Nội bộ, vendor, URL nguồn..."
          />
        </Field>
        <Field label="License / ghi chú quyền sử dụng" className="custom-table-builder__field--wide">
          <input
            className="form-control"
            value={state.licenseLabel}
            onChange={(e) => update("licenseLabel", e.target.value)}
            placeholder="CC0, CC BY, nội bộ đã được phép..."
          />
        </Field>
        <Field label="Tags" hint="Ngăn cách bằng dấu phẩy" className="custom-table-builder__field--wide">
          <input
            className="form-control"
            value={state.tags}
            onChange={(e) => update("tags", e.target.value)}
            placeholder="outdoor, wood, glb"
          />
        </Field>
      </Section>
    </>
  );

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="xl"
      className="custom-table-builder-modal"
      autoWrapBody={false}
    >
      <div className="custom-table-builder">
        <div className="custom-table-builder__header">
          <div className="custom-table-builder__icon" aria-hidden="true">✦</div>
          <div>
            <span className="custom-table-builder__eyebrow">Thư viện bàn 3D</span>
            <h3>Tạo mẫu bàn tùy chỉnh</h3>
            <p>
              Tạo mẫu bằng thông số, URL, upload .glb hoặc gửi yêu cầu AI dựng model từ ảnh tham khảo.
            </p>
          </div>
        </div>

        <div className="custom-table-builder__tabs" role="tablist" aria-label="Chế độ tạo mẫu bàn tùy chỉnh">
          {BUILDER_TABS.map((tab) => {
            const isActive = mode === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`custom-table-builder__tab${isActive ? " active" : ""}`}
                onClick={() => handleModeChange(tab.value)}
              >
                <span className="custom-table-builder__tab-icon" aria-hidden="true">{tab.icon}</span>
                <span>
                  <strong>{tab.label}</strong>
                  <small>{tab.description}</small>
                </span>
              </button>
            );
          })}
        </div>

        <div className="custom-table-builder__active-summary">
          <span>{activeTab.icon}</span>
          <div>
            <strong>{activeTab.label}</strong>
            <p>{activeTab.description}</p>
          </div>
        </div>

        {error && <StatusCard tone="warning">{error}</StatusCard>}

        <div className="custom-table-builder__body">
          {mode === BUILDER_MODES.PARAMETRIC && (
            <>
              <Section title="Thông tin mẫu" eyebrow="01">
                <Field label="Tên mẫu bàn">
                  <input className="form-control" value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Ví dụ: Booth cửa sổ 6 chỗ" />
                </Field>
                <Field label="Loại hình dáng">
                  <select className="form-select" value={form.shape} onChange={(e) => updateField("shape", e.target.value)}>
                    {CUSTOM_TABLE_SHAPES.map((shape) => (
                      <option key={shape.value} value={shape.value}>{shape.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Khu vực">
                  <select className="form-select" value={form.area} onChange={(e) => updateField("area", e.target.value)}>
                    {TABLE_AREA_OPTIONS.map((area) => (
                      <option key={area.value} value={area.value}>{area.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Số ghế">
                  <input className="form-control" type="number" min="1" value={form.capacity} onChange={(e) => updateField("capacity", e.target.value)} />
                </Field>
              </Section>

              <Section title="Kích thước và chất liệu" eyebrow="02">
                {renderDimensionsFields(form, updateField, "parametric")}
                <Field label="Chất liệu">
                  <input className="form-control" value={form.material} onChange={(e) => updateField("material", e.target.value)} placeholder="Gỗ, đá, kim loại..." />
                </Field>
                <Field label="Màu">
                  <input className="form-control custom-table-builder__color-input" type="color" value={form.color} onChange={(e) => updateField("color", e.target.value)} />
                </Field>
              </Section>

              <Section title="Ảnh tham khảo và ghi chú" eyebrow="03">
                <Field label="Ảnh tham khảo nội bộ" hint={form.referenceImageName || "Chỉ lưu tên ảnh để ghi chú mẫu"}>
                  <input className="form-control" type="file" accept="image/*" onChange={handleReferenceImage} />
                </Field>
                <Field label="Ghi chú" className="custom-table-builder__field--wide">
                  <input className="form-control" value={form.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Vị trí dùng, style, lưu ý vận hành..." />
                </Field>
              </Section>

              <StatusCard tone="info">
                <strong>Preview:</strong> {getCustomTableShapeLabel(normalizedPreview.shape)} • {normalizedPreview.capacity} ghế • {normalizedPreview.widthCm} x {normalizedPreview.depthCm} x {normalizedPreview.heightCm} cm{normalizedPreview.shape === "round" ? ` • Ø ${normalizedPreview.diameterCm} cm` : ""} • Khu vực: {getTableAreaLabel(normalizedPreview.area)}
              </StatusCard>
            </>
          )}

          {mode === BUILDER_MODES.URL && (
            <>
              {renderCatalogCoreSections(urlForm, updateUrlField, "url")}
              <Section title="Model URL" eyebrow="04">
                <Field label="Model URL (.glb/.gltf)" hint="Nên dùng .glb để model-viewer tải ổn định hơn .gltf." className="custom-table-builder__field--wide">
                  <input className="form-control" value={urlForm.modelUrl} onChange={(e) => updateUrlField("modelUrl", e.target.value)} placeholder="https://example.com/table.glb" />
                </Field>
                <Field label="Thumbnail URL" className="custom-table-builder__field--wide">
                  <input className="form-control" value={urlForm.thumbnailUrl} onChange={(e) => updateUrlField("thumbnailUrl", e.target.value)} placeholder="https://example.com/table-thumbnail.jpg" />
                </Field>
              </Section>
            </>
          )}

          {mode === BUILDER_MODES.UPLOAD && (
            <>
              {renderCatalogCoreSections(uploadForm, updateUploadField, "upload")}
              <Section title="Tải file model" eyebrow="04" className="custom-table-builder__section--upload">
                <Field label="File model .glb" hint={uploadForm.modelFile ? `${uploadForm.modelFile.name} • ${formatFileSize(uploadForm.modelFile.size)}` : `Tối đa ${formatFileSize(MODEL_MAX_SIZE_BYTES)}`}>
                  <div className="custom-table-builder__file-card">
                    <input className="form-control" type="file" accept=".glb,model/gltf-binary" onChange={(event) => updateUploadField("modelFile", event.target.files?.[0] || null)} />
                  </div>
                </Field>
                <Field label="Thumbnail ảnh optional" hint={uploadForm.thumbnailFile ? `${uploadForm.thumbnailFile.name} • ${formatFileSize(uploadForm.thumbnailFile.size)}` : `PNG/JPEG/WebP, tối đa ${formatFileSize(THUMBNAIL_MAX_SIZE_BYTES)}`}>
                  <div className="custom-table-builder__file-card">
                    <input className="form-control" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => updateUploadField("thumbnailFile", event.target.files?.[0] || null)} />
                  </div>
                </Field>
              </Section>

              <StatusCard tone="info">
                File model tối đa {formatFileSize(MODEL_MAX_SIZE_BYTES)}; thumbnail tối đa {formatFileSize(THUMBNAIL_MAX_SIZE_BYTES)}. Xóa mẫu khỏi thư viện chỉ xóa metadata trong trình duyệt, chưa xóa file trên server.
              </StatusCard>

              {(uploadStatus || uploadProgress > 0) && (
                <StatusCard tone="neutral">
                  <div className="custom-table-builder__progress-row">
                    <span>{uploadStatus || "Đang upload..."}</span>
                    {uploadProgress > 0 && <strong>{uploadProgress}%</strong>}
                  </div>
                  {uploadProgress > 0 && (
                    <div className="custom-table-builder__progress" aria-hidden="true">
                      <span style={{ width: `${Math.min(uploadProgress, 100)}%` }} />
                    </div>
                  )}
                </StatusCard>
              )}
            </>
          )}

          {mode === BUILDER_MODES.AI && (
            <>
              {renderCatalogCoreSections(aiForm, updateAiField, "ai")}
              <Section title="Mô tả để AI dựng model" eyebrow="04">
                <Field label="Chất liệu">
                  <input className="form-control" value={aiForm.material} onChange={(e) => updateAiField("material", e.target.value)} placeholder="gỗ, đá, kim loại..." />
                </Field>
                <Field label="Màu sắc">
                  <input className="form-control" value={aiForm.color} onChange={(e) => updateAiField("color", e.target.value)} placeholder="nâu gỗ, đen mờ..." />
                </Field>
                <Field label="Ghi chú mô tả" className="custom-table-builder__field--wide">
                  <textarea className="form-control" rows="3" value={aiForm.notes} onChange={(e) => updateAiField("notes", e.target.value)} placeholder="Mô tả mặt bàn, chân bàn, cạnh bo, phong cách..." />
                </Field>
              </Section>

              <Section title="Ảnh tham khảo" eyebrow="05">
                <Field label="Chọn 3–5 ảnh" hint={`Mỗi ảnh tối đa ${formatFileSize(AI_IMAGE_MAX_SIZE_BYTES)}.`} className="custom-table-builder__field--wide">
                  <div className="custom-table-builder__file-card custom-table-builder__file-card--ai">
                    <input className="form-control" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={handleAiImagesSelected} />
                    <p>Mặt trước, mặt bên, mặt trên hoặc ảnh có vật chuẩn kích thước sẽ giúp provider dựng chính xác hơn.</p>
                  </div>
                </Field>

                {(aiForm.referenceImages || []).length > 0 && (
                  <div className="custom-table-builder__image-list custom-table-builder__field--wide">
                    {(aiForm.referenceImages || []).map((file, index) => (
                      <div className="custom-table-builder__image-chip" key={`${file.name}-${file.size}-${index}`}>
                        <span>{index + 1}. {file.name}</span>
                        <small>{formatFileSize(file.size)}</small>
                        <Button type="button" size="sm" variant="secondary" onClick={() => removeAiImage(index)}>Remove</Button>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <StatusCard tone="info">
                <strong>Quy tắc ảnh:</strong> ảnh sáng rõ; thấy toàn bộ bàn; ít vật che khuất; nền sạch; không có người/khách hàng/thông tin nhạy cảm; nên có vật chuẩn hoặc nhập kích thước thật.
              </StatusCard>

              <StatusCard tone={aiStatus === "failed" ? "warning" : "neutral"}>
                <div className="custom-table-builder__job-status">
                  <span>Trạng thái</span>
                  <strong>{getAiStatusLabel(aiStatus)}</strong>
                </div>
                {aiJob?.jobId && <p>Job: {aiJob.jobId}</p>}
                {aiJob?.message ? <p>{aiJob.message}</p> : null}
                {aiJob?.warnings?.length ? <p>Cảnh báo: {aiJob.warnings.join(", ")}</p> : null}
                {aiJob?.jobId && (
                  <Button type="button" size="sm" variant="secondary" onClick={handleAiCheckStatus} disabled={aiStatus === "submitting"}>
                    Kiểm tra trạng thái
                  </Button>
                )}
              </StatusCard>
            </>
          )}
        </div>

        <div className="custom-table-builder__footer">
          <p>{activeTab.description}</p>
          <div className="custom-table-builder__footer-actions">
            <Button variant="secondary" onClick={onClose} disabled={isBusy}>Hủy</Button>
            <Button variant="primary" onClick={handleApply} disabled={isBusy}>
              {mode === BUILDER_MODES.UPLOAD
                ? (isUploading ? "Đang upload..." : "Upload & lưu")
                : mode === BUILDER_MODES.AI
                  ? (aiStatus === "submitting" ? "Đang gửi..." : "Gửi yêu cầu AI")
                  : "Lưu vào thư viện"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CustomTableModelBuilderModal;
