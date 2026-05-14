import React, { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, UploadCloud, X } from "lucide-react";
import LocalImageView from "./LocalImageView";
import {
  deleteLocalImage,
  getLocalImageStats,
  isLocalImageUri,
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
}) => {
  const inputRef = useRef(null);
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
      if (value && isLocalImageUri(value)) {
        deleteLocalImage(value).catch(() => {});
      }

      const saved = await saveLocalImage(file, { ownerKey, purpose });
      onChange?.(saved.uri);

      const stats = await getLocalImageStats(saved.uri);
      if (stats) {
        const optimizedBytes = Number(stats.thumbSize || 0) + Number(stats.previewSize || 0);
        setStatsText(
          `Đã tối ưu: ${formatBytes(stats.originalSize)} → ${formatBytes(optimizedBytes)}`
        );
      }
    } catch (err) {
      setError(err?.message || "Không thể lưu ảnh cục bộ.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    if (disabled || isSaving) return;
    if (value && isLocalImageUri(value)) {
      deleteLocalImage(value).catch(() => {});
    }
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
            {isSaving ? <Loader2 size={16} className="lip-spin" /> : <UploadCloud size={16} />}
            {isSaving ? "Đang tối ưu..." : label}
          </button>

          {value && (
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
