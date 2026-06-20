import React, { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, UploadCloud, X } from "lucide-react";
import LocalImageView from "./LocalImageView";
import { useImageUploadLocal } from "../../hooks/useImageUploadLocal";
import {
  getLocalImageStats,
  LOCAL_IMAGE_VARIANTS,
  saveLocalImage,
} from "../../utils/localImageStore";
import "./LocalImagePicker.scss";

const DEFAULT_ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const formatBytes = (bytes = 0) => {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "0KB";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
};

const getSyncedFileName = (saved) => {
  const baseName =
    String(saved?.originalName || "menu-image")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "menu-image";
  const extension = String(saved?.mimeType || "image/webp").includes("jpeg")
    ? "jpg"
    : "webp";
  return `${baseName}.${extension}`;
};

const createPreviewUploadFile = (saved) => {
  const blob = saved?.previewBlob || saved?.thumbBlob;
  if (!blob) return null;
  return new File([blob], getSyncedFileName(saved), {
    type: saved.mimeType || blob.type || "image/webp",
    lastModified: Date.now(),
  });
};

const LocalImagePicker = ({
  value,
  onChange,
  disabled = false,
  ownerKey,
  purpose = "menu-image",
  label = "Chọn ảnh",
  helperText = "Ảnh sẽ được tự resize và nén trước khi lưu cục bộ.",
  placeholder = "Chưa có ảnh",
  previewVariant = LOCAL_IMAGE_VARIANTS.PREVIEW,
  allowUrl = true,
  urlPlaceholder = "https://example.com/image.jpg hoặc local-image://...",
  syncToServer = true,
  onStatusChange,
  maxFileSizeMb = 8,
  allowedImageTypes = DEFAULT_ALLOWED_IMAGE_TYPES,
}) => {
  const inputRef = useRef(null);
  const { uploadImage } = useImageUploadLocal();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [statsText, setStatsText] = useState("");
  const [localPreviewValue, setLocalPreviewValue] = useState("");

  useEffect(() => {
    if (value && !String(value).startsWith("local-image://")) {
      setLocalPreviewValue("");
    }
  }, [value]);

  const displayValue = localPreviewValue || value || "";

  const handlePickFile = () => {
    if (disabled || isSaving) return;
    inputRef.current?.click();
  };

  const validateFile = (file) => {
    if (!file) return "Vui lòng chọn một tệp ảnh.";
    if (!allowedImageTypes.includes(file.type)) {
      return "Định dạng ảnh chưa được hỗ trợ. Hãy dùng JPG, PNG, WEBP hoặc GIF.";
    }
    const maxBytes = Number(maxFileSizeMb || 8) * 1024 * 1024;
    if (file.size > maxBytes) {
      return `Ảnh vượt quá ${maxFileSizeMb}MB. Vui lòng chọn ảnh nhẹ hơn.`;
    }
    return "";
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setStatsText("");
      onStatusChange?.("error");
      return;
    }

    setIsSaving(true);
    setError("");
    setStatsText("");
    onStatusChange?.("uploading");

    try {
      const saved = await saveLocalImage(file, { ownerKey, purpose });
      setLocalPreviewValue(saved.uri);

      let syncMessage = "";
      const stats = await getLocalImageStats(saved.uri);
      if (stats) {
        const optimizedBytes =
          Number(stats.thumbSize || 0) + Number(stats.previewSize || 0);
        syncMessage = `Đã tối ưu: ${formatBytes(stats.originalSize)} → ${formatBytes(optimizedBytes)}`;
      }

      if (!syncToServer) {
        onChange?.(saved.uri);
        setStatsText(syncMessage || "Đã tối ưu ảnh.");
        onStatusChange?.("localOnly");
        return;
      }

      const uploadFile = createPreviewUploadFile(saved);
      if (!uploadFile) {
        throw new Error("Không thể tạo tệp ảnh tối ưu để tải lên server.");
      }

      setStatsText(`${syncMessage || "Đã tối ưu ảnh"}. Đang đồng bộ lên server...`);
      const uploadResult = await uploadImage(uploadFile, {
        folder: "menu-images",
        type: purpose,
        context: ownerKey,
      });

      if (!uploadResult?.url) {
        throw uploadResult?.error || new Error("Không thể đồng bộ ảnh lên server.");
      }

      onChange?.(uploadResult.url);
      setLocalPreviewValue("");
      setStatsText(`${syncMessage || "Đã tối ưu ảnh"}. Đã đồng bộ server.`);
      onStatusChange?.("synced");
    } catch (err) {
      // Keep the local preview so the user can see the selected file, but do not
      // write local-image:// into the form when server sync is required. This
      // prevents saving an image URL that other devices/pages cannot resolve.
      onStatusChange?.("error");
      setError(err?.message || "Không thể tải ảnh lên server.");
      setStatsText("Ảnh chưa được lưu. Vui lòng chọn lại hoặc kiểm tra kết nối server.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    if (disabled || isSaving) return;
    setLocalPreviewValue("");
    onChange?.("");
    onStatusChange?.("idle");
    setStatsText("");
    setError("");
  };

  const handleUrlChange = (event) => {
    setLocalPreviewValue("");
    setError("");
    setStatsText("");
    onStatusChange?.("idle");
    onChange?.(event.target.value);
  };

  const fallback = (
    <div className="lip-preview-placeholder">
      <ImageIcon size={24} />
      <span>{placeholder}</span>
    </div>
  );

  return (
    <div className={`local-image-picker ${isSaving ? "is-uploading" : ""}`}>
      <div className="lip-preview">
        <LocalImageView
          src={displayValue}
          alt="Preview"
          variant={previewVariant}
          fallback={fallback}
        />
      </div>

      <div className="lip-controls">
        <div className="lip-actions">
          <button
            type="button"
            className="lip-btn lip-btn-primary"
            onClick={handlePickFile}
            disabled={disabled || isSaving}
          >
            {isSaving ? (
              <Loader2 size={16} className="lip-spin" />
            ) : (
              <UploadCloud size={16} />
            )}
            {isSaving ? "Đang tải ảnh..." : label}
          </button>

          {(displayValue || value) && (
            <button
              type="button"
              className="lip-btn lip-btn-ghost"
              onClick={handleClear}
              disabled={disabled || isSaving}
            >
              <X size={16} /> Xóa ảnh khỏi form
            </button>
          )}
        </div>

        {allowUrl && (
          <input
            type="text"
            className="lip-url-input"
            value={localPreviewValue ? value || "" : value || ""}
            onChange={handleUrlChange}
            placeholder={urlPlaceholder}
            disabled={disabled || isSaving}
          />
        )}

        <small className="lip-helper">{statsText || helperText}</small>
        {error && <small className="lip-error">{error}</small>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={allowedImageTypes.join(",")}
        hidden
        onChange={handleFileChange}
      />
    </div>
  );
};

export default LocalImagePicker;
