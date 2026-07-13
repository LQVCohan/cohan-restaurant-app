import React, { useEffect, useMemo, useState } from "react";
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
import {
  clearAiTableCaptureDraft,
  getTable3DBuilderSessionState,
  loadAiTableCaptureDraft,
  processAiTableCapture,
  saveAiTableCaptureDraftSlot,
  setTable3DBuilderSessionState,
} from "@/utils/aiTableCaptureDraft";

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
    description: "Chụp 5 góc rồi tạo model",
  },
];

const AI_CAPTURE_STEPS = [
  {
    key: "front",
    label: "Chính diện",
    hint: "Đặt toàn bộ bàn trong khung hình, camera ngang mặt bàn.",
  },
  {
    key: "left",
    label: "Góc trái 45°",
    hint: "Di chuyển sang trái, giữ nguyên khoảng cách và ánh sáng.",
  },
  {
    key: "right",
    label: "Góc phải 45°",
    hint: "Di chuyển sang phải, chụp đủ mặt bàn và chân bàn.",
  },
  {
    key: "rear",
    label: "Mặt sau",
    hint: "Chụp phía đối diện ảnh chính diện để bổ sung phần khuất.",
  },
  {
    key: "top",
    label: "Từ trên xuống",
    hint: "Nâng camera cao, hướng xuống để thấy rõ hình dạng mặt bàn.",
  },
];

const MODEL_MAX_SIZE_BYTES = 15 * 1024 * 1024;
const THUMBNAIL_MAX_SIZE_BYTES = 3 * 1024 * 1024;
const AI_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const AI_REQUIRED_IMAGES = AI_CAPTURE_STEPS.length;
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
    idle: "Chưa gửi yêu cầu",
    submitting: "Đang gửi 5 ảnh",
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

const CustomTableModelBuilderModal = ({
  open,
  onClose,
  onApply,
  draftScope = "default",
}) => {
  const [mode, setMode] = useState(() =>
    getTable3DBuilderSessionState().mode === BUILDER_MODES.AI
      ? BUILDER_MODES.AI
      : BUILDER_MODES.PARAMETRIC,
  );
  const [form, setForm] = useState(DEFAULT_CUSTOM_TABLE_SPEC);
  const [urlForm, setUrlForm] = useState(DEFAULT_CUSTOM_URL_TABLE_SPEC);
  const [uploadForm, setUploadForm] = useState(
    DEFAULT_CUSTOM_UPLOAD_TABLE_SPEC,
  );
  const [aiForm, setAiForm] = useState({
    ...DEFAULT_AI_TABLE_SPEC,
    images: Array(AI_REQUIRED_IMAGES).fill(null),
  });
  const [aiJob, setAiJob] = useState(null);
  const [aiStatus, setAiStatus] = useState("idle");
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [aiImageMetadata, setAiImageMetadata] = useState(
    Array(AI_REQUIRED_IMAGES).fill(null),
  );
  const [aiCaptureProcessingIndex, setAiCaptureProcessingIndex] = useState(null);
  const [aiDraftMessage, setAiDraftMessage] = useState("");

  const normalizedPreview = useMemo(
    () => normalizeCustomTableSpec(form),
    [form],
  );
  const aiImages = useMemo(
    () =>
      AI_CAPTURE_STEPS.map((_, index) => aiForm.images?.[index] || null),
    [aiForm.images],
  );
  const capturedImageCount = aiImages.filter(Boolean).length;
  const isAiGenerating = ["submitting", "queued", "processing"].includes(
    aiStatus,
  );
  const isBusy =
    isUploading ||
    aiStatus === "submitting" ||
    aiCaptureProcessingIndex !== null;

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const sessionState = getTable3DBuilderSessionState();
    if (sessionState.mode === BUILDER_MODES.AI) setMode(BUILDER_MODES.AI);

    loadAiTableCaptureDraft(draftScope, AI_REQUIRED_IMAGES)
      .then(({ images, metadata }) => {
        if (cancelled) return;
        const restoredCount = images.filter(Boolean).length;
        if (restoredCount) {
          setAiForm((previous) => ({ ...previous, images }));
          setAiImageMetadata(metadata);
          const wasReloaded =
            Boolean(document.wasDiscarded) ||
            performance.getEntriesByType?.("navigation")?.[0]?.type === "reload";
          setAiDraftMessage(
            wasReloaded
              ? `Đã khôi phục ${restoredCount}/5 ảnh sau khi trang được tải lại.`
              : `Đã khôi phục ${restoredCount}/5 ảnh đã chụp trước đó.`,
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAiDraftMessage(
            "Trình duyệt không cho lưu bản nháp ảnh; hãy giữ trang mở cho đến khi gửi đủ 5 ảnh.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [draftScope, open]);

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

  const handleAiImageChange = async (index, file, inputElement) => {
    if (!file || aiCaptureProcessingIndex !== null) return;
    setError("");
    setAiDraftMessage("");
    setAiCaptureProcessingIndex(index);
    try {
      const processed = await processAiTableCapture(file);
      await saveAiTableCaptureDraftSlot(draftScope, index, processed);
      setAiForm((previous) => {
        const images = AI_CAPTURE_STEPS.map(
          (_, imageIndex) => previous.images?.[imageIndex] || null,
        );
        images[index] = processed.file;
        return { ...previous, images };
      });
      setAiImageMetadata((previous) => {
        const next = [...previous];
        next[index] = processed.metadata;
        return next;
      });
      setAiDraftMessage(
        `Đã tối ưu ảnh ${index + 1}: ${formatFileSize(
          processed.metadata.originalSize,
        )} → ${formatFileSize(processed.file.size)} và lưu bản nháp.`,
      );
    } catch (captureError) {
      setError(captureError?.message || "Không thể xử lý ảnh vừa chụp.");
    } finally {
      if (inputElement) inputElement.value = "";
      setAiCaptureProcessingIndex(null);
    }
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setTable3DBuilderSessionState({ open: true, mode: nextMode });
    setError("");
    setUploadStatus("");
    if (nextMode !== BUILDER_MODES.AI) setAiStatus("idle");
  };

  const handleClearAiImages = async () => {
    if (aiCaptureProcessingIndex !== null || isAiGenerating) return;
    await clearAiTableCaptureDraft(draftScope, AI_REQUIRED_IMAGES).catch(() => {});
    setAiForm((previous) => ({
      ...previous,
      images: Array(AI_REQUIRED_IMAGES).fill(null),
    }));
    setAiImageMetadata(Array(AI_REQUIRED_IMAGES).fill(null));
    setAiDraftMessage("Đã xóa bản nháp 5 ảnh trên thiết bị này.");
    setError("");
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
        nextErrors.push(
          `Thumbnail tối đa ${formatFileSize(THUMBNAIL_MAX_SIZE_BYTES)}.`,
        );
      }
    }

    nextErrors.push(...validateSharedCatalogFields(uploadForm));
    return nextErrors;
  };

  const validateAiForm = () => {
    const nextErrors = [];
    const images = aiImages.filter(Boolean);
    if (images.length !== AI_REQUIRED_IMAGES) {
      nextErrors.push(`Cần đủ ${AI_REQUIRED_IMAGES} ảnh theo hướng dẫn.`);
    }
    images.forEach((file) => {
      if (!IMAGE_MIME_TYPES.has(file.type)) {
        nextErrors.push(`${file.name}: chỉ hỗ trợ PNG, JPG hoặc WEBP.`);
      }
      if (file.size > AI_IMAGE_MAX_SIZE_BYTES) {
        nextErrors.push(
          `${file.name}: tối đa ${formatFileSize(AI_IMAGE_MAX_SIZE_BYTES)}.`,
        );
      }
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
    uploadPayload.append(
      "model",
      uploadForm.modelFile,
      uploadForm.modelFile.name,
    );
    if (uploadForm.thumbnailFile) {
      uploadPayload.append(
        "thumbnail",
        uploadForm.thumbnailFile,
        uploadForm.thumbnailFile.name,
      );
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
      setUploadStatus(
        "Đã upload model. Mẫu mới đã sẵn sàng để dùng trong sơ đồ bàn.",
      );
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
    aiImages.forEach((file) => formData.append("images", file, file.name));
    formData.append(
      "metadata",
      JSON.stringify({
        type: aiForm.type,
        label: aiForm.label,
        prompt: aiForm.prompt,
        capacity: Number(aiForm.capacity),
        area: aiForm.area,
        defaultScale: Number(aiForm.defaultScale),
        captureOrder: AI_CAPTURE_STEPS.map((step) => step.key),
        dimensionsCm: {
          width: Number(aiForm.widthCm) || null,
          depth: Number(aiForm.depthCm) || null,
          height: Number(aiForm.heightCm) || null,
          diameter: Number(aiForm.diameterCm) || null,
        },
        tags: parseTags(aiForm.tags),
      }),
    );

    setError("");
    setAiStatus("submitting");
    try {
      const payload = await requestAiTable3DGeneration(formData);
      setAiJob(payload);
      setAiStatus(payload.status || "queued");
      await clearAiTableCaptureDraft(draftScope, AI_REQUIRED_IMAGES).catch(() => {});
      setAiDraftMessage("Đã gửi đủ 5 ảnh; bản nháp trên thiết bị đã được xóa.");
      if (payload?.generatedModelUrl) {
        const item = buildAiGeneratedTableCatalogItem({
          ...aiForm,
          modelUrl: payload.generatedModelUrl,
          thumbnailUrl: payload.generatedThumbnailUrl,
          jobId: payload.jobId,
        });
        if (item) onApply(item);
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
        const item = buildAiGeneratedTableCatalogItem({
          ...aiForm,
          modelUrl: payload.generatedModelUrl,
          thumbnailUrl: payload.generatedThumbnailUrl,
          jobId,
        });
        if (item) onApply(item);
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
        <aside
          className="custom-table-builder__tabs"
          aria-label="Chọn cách tạo mẫu bàn"
        >
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
                  <input
                    value={form.label}
                    onChange={(event) => updateField("label", event.target.value)}
                  />
                </Field>
                <Field label="Loại bàn">
                  <select
                    value={form.type}
                    onChange={(event) => updateField("type", event.target.value)}
                  >
                    {TABLE_3D_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Khu vực gợi ý">
                  <select
                    value={form.area}
                    onChange={(event) => updateField("area", event.target.value)}
                  >
                    {TABLE_AREA_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {getTableAreaLabel(option.value)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Sức chứa">
                  <input
                    type="number"
                    min="1"
                    value={form.capacity}
                    onChange={(event) =>
                      updateField("capacity", event.target.value)
                    }
                  />
                </Field>
              </Section>
              <Section title="Kích thước & hiển thị" eyebrow="cm / scale">
                {CUSTOM_TABLE_SHAPES.map((shape) => (
                  <button
                    type="button"
                    key={shape.value}
                    className={`custom-table-builder__shape ${
                      form.shape === shape.value ? "active" : ""
                    }`}
                    onClick={() => updateField("shape", shape.value)}
                  >
                    {getCustomTableShapeLabel(shape.value)}
                  </button>
                ))}
                <Field label="Rộng (cm)">
                  <input
                    type="number"
                    value={form.widthCm}
                    onChange={(event) =>
                      updateField("widthCm", event.target.value)
                    }
                  />
                </Field>
                <Field label="Sâu (cm)">
                  <input
                    type="number"
                    value={form.depthCm}
                    onChange={(event) =>
                      updateField("depthCm", event.target.value)
                    }
                  />
                </Field>
                <Field label="Cao (cm)">
                  <input
                    type="number"
                    value={form.heightCm}
                    onChange={(event) =>
                      updateField("heightCm", event.target.value)
                    }
                  />
                </Field>
                <Field label="Đường kính (cm)">
                  <input
                    type="number"
                    value={form.diameterCm}
                    onChange={(event) =>
                      updateField("diameterCm", event.target.value)
                    }
                  />
                </Field>
                <Field label="Scale mặc định">
                  <input
                    type="number"
                    step="0.05"
                    value={form.defaultScale}
                    onChange={(event) =>
                      updateField("defaultScale", event.target.value)
                    }
                  />
                </Field>
                <Field label="Tag">
                  <input
                    value={form.tags}
                    onChange={(event) => updateField("tags", event.target.value)}
                    placeholder="wood, vip, sofa..."
                  />
                </Field>
                <Field
                  label="Ảnh tham chiếu"
                  hint="Chỉ lưu tên file để gợi ý, không upload ở chế độ này."
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReferenceImage}
                  />
                </Field>
              </Section>
              <StatusCard>
                Preview: {normalizedPreview.label} · {normalizedPreview.capacity}{" "}
                ghế · {getCustomTableShapeLabel(normalizedPreview.shape)}
              </StatusCard>
              <div className="custom-table-builder__actions">
                <Button variant="primary" onClick={handleApplyParametric}>
                  Dùng mẫu này
                </Button>
              </div>
            </>
          )}

          {mode === BUILDER_MODES.URL && (
            <>
              <Section title="Nguồn model online" eyebrow="GLB / GLTF">
                <Field label="Tên mẫu">
                  <input
                    value={urlForm.label}
                    onChange={(event) =>
                      updateUrlField("label", event.target.value)
                    }
                  />
                </Field>
                <Field
                  label="Model URL"
                  className="span-2"
                  hint="URL phải trỏ trực tiếp tới file .glb hoặc .gltf."
                >
                  <input
                    value={urlForm.modelUrl}
                    onChange={(event) =>
                      updateUrlField("modelUrl", event.target.value)
                    }
                  />
                </Field>
                <Field label="Thumbnail URL" className="span-2">
                  <input
                    value={urlForm.thumbnailUrl}
                    onChange={(event) =>
                      updateUrlField("thumbnailUrl", event.target.value)
                    }
                  />
                </Field>
                <Field label="Loại bàn">
                  <select
                    value={urlForm.type}
                    onChange={(event) =>
                      updateUrlField("type", event.target.value)
                    }
                  >
                    {TABLE_3D_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Sức chứa">
                  <input
                    type="number"
                    min="1"
                    value={urlForm.capacity}
                    onChange={(event) =>
                      updateUrlField("capacity", event.target.value)
                    }
                  />
                </Field>
                <Field label="Khu vực">
                  <select
                    value={urlForm.area}
                    onChange={(event) =>
                      updateUrlField("area", event.target.value)
                    }
                  >
                    {TABLE_AREA_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {getTableAreaLabel(option.value)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Scale">
                  <input
                    type="number"
                    step="0.05"
                    value={urlForm.defaultScale}
                    onChange={(event) =>
                      updateUrlField("defaultScale", event.target.value)
                    }
                  />
                </Field>
                <Field label="Tag">
                  <input
                    value={urlForm.tags}
                    onChange={(event) =>
                      updateUrlField("tags", event.target.value)
                    }
                  />
                </Field>
              </Section>
              <div className="custom-table-builder__actions">
                <Button variant="primary" onClick={handleApplyUrl}>
                  Dùng URL model
                </Button>
              </div>
            </>
          )}

          {mode === BUILDER_MODES.UPLOAD && (
            <>
              <Section title="Upload model thật" eyebrow="Local backend">
                <Field label="Tên mẫu">
                  <input
                    value={uploadForm.label}
                    onChange={(event) =>
                      updateUploadField("label", event.target.value)
                    }
                  />
                </Field>
                <Field
                  label="File model .glb"
                  hint={`Tối đa ${formatFileSize(MODEL_MAX_SIZE_BYTES)}.`}
                >
                  <input
                    type="file"
                    accept=".glb,model/gltf-binary"
                    onChange={(event) =>
                      updateUploadField(
                        "modelFile",
                        event.target.files?.[0] || null,
                      )
                    }
                  />
                </Field>
                <Field
                  label="Thumbnail"
                  hint={`PNG/JPG/WEBP, tối đa ${formatFileSize(
                    THUMBNAIL_MAX_SIZE_BYTES,
                  )}.`}
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) =>
                      updateUploadField(
                        "thumbnailFile",
                        event.target.files?.[0] || null,
                      )
                    }
                  />
                </Field>
                <Field label="Loại bàn">
                  <select
                    value={uploadForm.type}
                    onChange={(event) =>
                      updateUploadField("type", event.target.value)
                    }
                  >
                    {TABLE_3D_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Sức chứa">
                  <input
                    type="number"
                    min="1"
                    value={uploadForm.capacity}
                    onChange={(event) =>
                      updateUploadField("capacity", event.target.value)
                    }
                  />
                </Field>
                <Field label="Khu vực">
                  <select
                    value={uploadForm.area}
                    onChange={(event) =>
                      updateUploadField("area", event.target.value)
                    }
                  >
                    {TABLE_AREA_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {getTableAreaLabel(option.value)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Scale">
                  <input
                    type="number"
                    step="0.05"
                    value={uploadForm.defaultScale}
                    onChange={(event) =>
                      updateUploadField("defaultScale", event.target.value)
                    }
                  />
                </Field>
                <Field label="Tag">
                  <input
                    value={uploadForm.tags}
                    onChange={(event) =>
                      updateUploadField("tags", event.target.value)
                    }
                  />
                </Field>
              </Section>
              {uploadStatus && (
                <StatusCard>
                  {uploadStatus} {uploadProgress > 0 ? `${uploadProgress}%` : ""}
                </StatusCard>
              )}
              <div className="custom-table-builder__actions">
                <Button
                  variant="primary"
                  onClick={handleUploadModel}
                  disabled={isUploading}
                >
                  {isUploading ? "Đang upload..." : "Upload và dùng mẫu"}
                </Button>
              </div>
            </>
          )}

          {mode === BUILDER_MODES.AI && (
            <>
              <Section title="Tạo mẫu bằng AI" eyebrow="5 góc chụp">
                <Field label="Tên mẫu">
                  <input
                    value={aiForm.label}
                    onChange={(event) =>
                      updateAiField("label", event.target.value)
                    }
                  />
                </Field>
                <div className="custom-table-builder__field span-2">
                  <span className="custom-table-builder__label">
                    Chụp đủ 5 ảnh theo thứ tự
                  </span>
                  <small className="custom-table-builder__hint">
                    Giữ bàn đứng yên, dùng cùng khoảng cách và ánh sáng. Mỗi ảnh sẽ
                    được nén ngay và lưu bản nháp trên thiết bị trước khi chụp ảnh kế
                    tiếp.
                  </small>
                  <div className="custom-table-builder__image-list">
                    {AI_CAPTURE_STEPS.map((step, index) => {
                      const file = aiImages[index];
                      const metadata = aiImageMetadata[index];
                      return (
                        <div
                          key={step.key}
                          className="custom-table-builder__image-chip"
                        >
                          <span>
                            {index + 1}. {step.label}
                          </span>
                          <small>
                            {aiCaptureProcessingIndex === index
                              ? "Đang nén và lưu ảnh…"
                              : file
                                ? `${file.name}${
                                    metadata
                                      ? ` · ${formatFileSize(
                                          metadata.originalSize,
                                        )} → ${formatFileSize(file.size)}`
                                      : ""
                                  }`
                                : step.hint}
                          </small>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            aria-label={`Ảnh ${index + 1}: ${step.label}`}
                            disabled={
                              aiCaptureProcessingIndex !== null || isAiGenerating
                            }
                            onChange={(event) => {
                              const input = event.currentTarget;
                              void handleAiImageChange(
                                index,
                                input.files?.[0] || null,
                                input,
                              );
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <Field label="Prompt" className="span-2">
                  <textarea
                    value={aiForm.prompt}
                    onChange={(event) =>
                      updateAiField("prompt", event.target.value)
                    }
                    rows={4}
                  />
                </Field>
                <Field label="Loại bàn">
                  <select
                    value={aiForm.type}
                    onChange={(event) =>
                      updateAiField("type", event.target.value)
                    }
                  >
                    {TABLE_3D_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Sức chứa">
                  <input
                    type="number"
                    min="1"
                    value={aiForm.capacity}
                    onChange={(event) =>
                      updateAiField("capacity", event.target.value)
                    }
                  />
                </Field>
                <Field label="Khu vực">
                  <select
                    value={aiForm.area}
                    onChange={(event) =>
                      updateAiField("area", event.target.value)
                    }
                  >
                    {TABLE_AREA_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {getTableAreaLabel(option.value)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Scale">
                  <input
                    type="number"
                    step="0.05"
                    value={aiForm.defaultScale}
                    onChange={(event) =>
                      updateAiField("defaultScale", event.target.value)
                    }
                  />
                </Field>
                <Field label="Tag">
                  <input
                    value={aiForm.tags}
                    onChange={(event) =>
                      updateAiField("tags", event.target.value)
                    }
                  />
                </Field>
              </Section>
              {aiDraftMessage && <StatusCard>{aiDraftMessage}</StatusCard>}
              <StatusCard tone={aiStatus === "failed" ? "danger" : "info"}>
                Đã chụp {capturedImageCount}/{AI_REQUIRED_IMAGES} ảnh · Trạng thái:{" "}
                {getAiStatusLabel(aiStatus)}
                {aiJob?.message ? ` · ${aiJob.message}` : ""}
              </StatusCard>
              <div className="custom-table-builder__actions">
                <Button
                  variant="primary"
                  onClick={handleSubmitAi}
                  disabled={
                    isUploading ||
                    isAiGenerating ||
                    aiCaptureProcessingIndex !== null ||
                    capturedImageCount !== AI_REQUIRED_IMAGES
                  }
                >
                  {isAiGenerating ? "Đang tạo..." : "Gửi 5 ảnh tạo model"}
                </Button>
                {capturedImageCount > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleClearAiImages}
                    disabled={
                      aiCaptureProcessingIndex !== null || isAiGenerating
                    }
                  >
                    Xóa ảnh đã chụp
                  </Button>
                )}
                {aiJob?.jobId && (
                  <Button variant="secondary" onClick={handleRefreshAiJob}>
                    Kiểm tra job
                  </Button>
                )}
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
