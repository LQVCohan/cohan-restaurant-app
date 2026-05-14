import React, { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, UploadCloud, X } from "lucide-react";
import LocalImageView from "./LocalImageView";
import { useAvatarUploadLocal } from "../../hooks/useAvatarUploadLocal";
import {
  getLocalImageStats,
  LOCAL_IMAGE_VARIANTS,
  saveLocalImage,
} from "../../utils/localImageStore";
import "./LocalImagePicker.scss";

const formatBytes = (bytes = 0) => {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "0KB";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
};

const getSyncedFileName = (saved) => {
  const baseName = String(saved?.originalName || "menu-image")
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
}) => {
  const inputRef = useRef(null);
  const { upload } = useAvatarUploadLocal();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [statsText, setStatsText] = useState("");

  const handlePickFile = () => {
    if (disabled || isSaving) return;
    inputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsSaving(true);
    setError("");
    setStatsText("");

    try {
      const saved = await saveLocalImage(file, { ownerKey, purpose });
      let nextValue = saved.uri;
      let syncMessage = "";

      const stats = await getLocalImageStats(saved.uri);
      if (stats) {
        const optimizedBytes =
          Number(stats.thumbSize || 0) + Number(stats.previewSize || 0);
        syncMessage = `Đã tối ưu: ${formatBytes(stats.originalSize)} → ${formatBytes(optimizedBytes)}`;
      }

      if (syncToServer) {
        const uploadFile = createPreviewUploadFile(saved);
        if (uploadFile) {
          try {
            setStatsText(`${syncMessage || "Đã tối ưu ảnh"}. Đang đồng bộ lên server...`);
            const remoteUrl = await upload(uploadFile);
            if (remoteUrl) {
              nextValue = remoteUrl;
              syncMessage = `${syncMessage || "Đã tối ưu ảnh"}. Đã đồng bộ server.`;
            }
          } catch (uploadError) {
            syncMessage = `${syncMessage || "Đã tối ưu ảnh"}. Upload server lỗi, tạm dùng ảnh local.`;
            setError(uploadError?.message || "Không thể đồng bộ ảnh lên server.");
          }
        }
      }

      onChange?.(nextValue);
      setStatsText(syncMessage || "Đã tối ưu ảnh.");
    } catch (err) {
      setError(err?.message || "Không thể lưu ảnh cục bộ.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    if (disabled || isSaving) return;
    // Không xóa blob ngay tại đây vì ảnh cũ có thể đang được menu/món đã lưu sử dụng.
    // Cleanup dài hạn được xử lý bởi pruneLocalImages/deleteStaleLocalImages trong localImageStore.
    onChange?.("");
    setStatsText("");
    setError("");
  };

  const handleUrlChange = (event) => {
    setError("");
    setStatsText("");
    onChange?.(event.target.value);
  };

  const fallback = (
    <div className="lip-preview-placeholder">
      <ImageIcon size={24} />
      <span>{placeholder}</span>
    </div>
  );

  return (
    <div className="local-image-picker">
      <div className="lip-preview">
        <LocalImageView
          src={value}
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
            {isSaving ? "Đang tối ưu/đồng bộ..." : label}
          </button>

          {value && (
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
            value={value || ""}
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
        accept="image/*"
        hidden
        onChange={handleFileChange}
      />
    </div>
  );
};

export default LocalImagePicker;
