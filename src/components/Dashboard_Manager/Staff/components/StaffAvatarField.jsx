import React, { useId, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import StaffAvatarMedia from "./StaffAvatarMedia";
import "./StaffAvatarField.scss";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 2 * 1024 * 1024;

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không thể đọc tệp ảnh đã chọn."));
    reader.readAsDataURL(file);
  });

const StaffAvatarField = ({
  name,
  currentAvatar = "",
  value = "",
  removed = false,
  onChange,
  onRemove,
  disabled = false,
}) => {
  const inputId = useId();
  const inputRef = useRef(null);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  const previewAvatar = useMemo(
    () => (removed ? "" : value || currentAvatar || ""),
    [currentAvatar, removed, value],
  );

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.has(file.type)) {
      setError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Ảnh đại diện không được vượt quá 2 MB.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setError("");
      setFileName(file.name);
      onChange?.(dataUrl, file);
    } catch (readError) {
      setError(readError?.message || "Không thể đọc tệp ảnh đã chọn.");
    }
  };

  const handleRemove = () => {
    setError("");
    setFileName("");
    onRemove?.();
  };

  return (
    <div className="staff-avatar-field">
      <div className="staff-avatar-field__preview">
        <StaffAvatarMedia
          employee={{ avatarUrl: previewAvatar }}
          name={name}
          className="staff-avatar-field__image"
          eager
          iconSize={28}
        />
        <span className="staff-avatar-field__camera" aria-hidden="true">
          <Camera size={14} />
        </span>
      </div>

      <div className="staff-avatar-field__content">
        <div>
          <strong>Ảnh đại diện nhân viên</strong>
          <p>JPG, PNG hoặc WEBP. Dung lượng tối đa 2 MB.</p>
          {fileName ? (
            <span className="staff-avatar-field__file">Đã chọn: {fileName}</span>
          ) : null}
          {removed && currentAvatar && !value ? (
            <span className="staff-avatar-field__file is-removed">
              Ảnh hiện tại sẽ được xóa sau khi lưu.
            </span>
          ) : null}
          {error ? (
            <span className="staff-avatar-field__error" role="alert">
              {error}
            </span>
          ) : null}
        </div>

        <div className="staff-avatar-field__actions">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Chọn ảnh đại diện nhân viên"
            onChange={handleFileChange}
            disabled={disabled}
            hidden
          />
          <button
            type="button"
            className="staff-avatar-field__button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            <ImagePlus size={16} />
            <span>{previewAvatar ? "Đổi ảnh" : "Chọn ảnh"}</span>
          </button>
          {(previewAvatar || currentAvatar) && (
            <button
              type="button"
              className="staff-avatar-field__button is-danger"
              onClick={handleRemove}
              disabled={disabled}
            >
              <Trash2 size={16} />
              <span>Xóa ảnh</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export { ACCEPTED_TYPES, MAX_FILE_SIZE, readFileAsDataUrl };
export default StaffAvatarField;
