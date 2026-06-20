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
  label = "Chọn ảnh món",
  helperText = "Hỗ trợ JPG, PNG và WEBP. Ảnh sẽ được nén trước khi tải lên hệ thống.",
  placeholder = "Chưa có ảnh món",
  previewVariant = LOCAL_IMAGE_VARIANTS.PREVIEW,
  allowUrl = true,
  urlPlaceholder = "Dán đường dẫn ảnh tại đây",
  syncToServer = true,
  onStatusChange,
  maxFileSizeMb = 8,
  allowedImageTypes = DEFAULT_ALLOWED_IMAGE_TYPES,
}) => {
  const rootRef = useRef(null);
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

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form || !syncToServer) return undefined;

    const blockUnsyncedSubmit = (event) => {
      const hasPendingLocalPreview = Boolean(localPreviewValue);
      if (!isSaving && !hasPendingLocalPreview && !error) return;

      event.preventDefault();
      event.stopPropagation();

      const message = isSaving
        ? "Ảnh món vẫn đang được tải lên. Vui lòng đợi hoàn tất trước khi lưu món."
        : "Ảnh món chưa tải lên thành công. Hãy chọn lại ảnh hoặc xóa ảnh lỗi trước khi lưu món.";
      setError(message);
      setStatsText("Chưa thể lưu món khi ảnh chưa tải lên hoàn tất.");
      onStatusChange?.("error");
    };

    form.addEventListener("submit", blockUnsyncedSubmit, true);
    return () => form.removeEventListener("submit", blockUnsyncedSubmit, true);
  }, [error, isSaving, localPreviewValue, onStatusChange, syncToServer]);

  const displayValue = localPreviewValue || value || "";

  const handlePickFile = () => {
    if (disabled || isSaving) return;
    inputRef.current?.click();
  };

  const validateFile = (file) => {
    if (!file) return "Vui lòng chọn ảnh món.";
    if (!allowedImageTypes.includes(file.type)) {
      return "Định dạng ảnh không được hỗ trợ. Vui lòng dùng JPG, PNG hoặc WEBP.";
    }
    const maxBytes = Number(maxFileSizeMb || 8) * 1024 * 1024;
    if (file.size > maxBytes) {
      return `Dung lượng ảnh vượt quá ${maxFileSizeMb}MB. Vui lòng chọn ảnh nhỏ hơn.`;
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
        syncMessage = `Đã giảm dung lượng từ ${formatBytes(stats.originalSize)} xuống ${formatBytes(optimizedBytes)}`;
      }

      if (!syncToServer) {
        onChange?.(saved.uri);
        setStatsText(syncMessage || "Ảnh đã được tối ưu.");
        onStatusChange?.("localOnly");
        return;
      }

      const uploadFile = createPreviewUploadFile(saved);
      if (!uploadFile) {
        throw new Error("Không thể chuẩn bị ảnh để tải lên hệ thống.");
      }

      setStatsText(
        `${syncMessage || "Ảnh đã được tối ưu"}. Đang tải lên hệ thống...`,
      );
      const uploadResult = await uploadImage(uploadFile, {
        folder: "menu-images",
        type: purpose,
        context: ownerKey,
      });

      if (!uploadResult?.url) {
        throw uploadResult?.error || new Error("Không thể tải ảnh lên hệ thống.");
      }

      onChange?.(uploadResult.url);
      setLocalPreviewValue("");
      setError("");
      setStatsText(
        `${syncMessage || "Ảnh đã được tối ưu"}. Tải ảnh thành công.`,
      );
      onStatusChange?.("synced");
    } catch (err) {
      onStatusChange?.("error");
      setError(err?.message || "Không thể tải ảnh lên hệ thống.");
      setStatsText(
        "Ảnh chưa được lưu. Vui lòng chọn lại ảnh hoặc kiểm tra kết nối.",
      );
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
    <div
      ref={rootRef}
      className={`local-image-picker ${isSaving ? "is-uploading" : ""} ${error ? "has-error" : ""}`}
    >
      <div className="lip-preview">
        <LocalImageView
          src={displayValue}
          alt="Ảnh món xem trước"
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
              <X size={16} /> Xóa ảnh
            </button>
          )}
        </div>

        {allowUrl && (
          <input
            type="text"
            className="lip-url-input"
            value={value || ""}
            onChange={handleUrlChange}
            placeholder={urlPlaceholder}
            aria-label="Đường dẫn ảnh món"
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
