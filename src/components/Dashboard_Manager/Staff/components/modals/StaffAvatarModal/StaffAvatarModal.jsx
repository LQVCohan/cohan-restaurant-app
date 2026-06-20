import React, { useEffect, useMemo, useState } from "react";
import { Image, Save } from "lucide-react";
import Modal from "../../../../../common/Modal";
import LoadingSpinner from "../../../../../common/LoadingSpinner";
import StaffAvatarField from "../../StaffAvatarField";
import "./StaffAvatarModal.scss";

const StaffAvatarModal = ({
  isOpen,
  employee,
  loading = false,
  onClose,
  onSubmit,
}) => {
  const [fileBase64, setFileBase64] = useState("");
  const [removed, setRemoved] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const employeeName = employee?.name || employee?.fullName || "Nhân viên";
  const currentAvatar = useMemo(
    () =>
      employee?.avatarUrl ||
      employee?.avatar ||
      employee?.raw?.avatarUrl ||
      "",
    [employee],
  );

  useEffect(() => {
    if (!isOpen) return;
    setFileBase64("");
    setRemoved(false);
    setSubmitError("");
  }, [employee?.id, isOpen]);

  const hasChange = Boolean(fileBase64 || (removed && currentAvatar));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!employee?.id || !hasChange || loading) return;

    setSubmitError("");
    try {
      await onSubmit?.({
        employee,
        fileBase64: fileBase64 || null,
        remove: removed && !fileBase64,
      });
      onClose?.();
    } catch (error) {
      setSubmitError(
        error?.graphQLErrors?.[0]?.message ||
          error?.networkError?.result?.errors?.[0]?.message ||
          error?.message ||
          "Không thể cập nhật ảnh đại diện.",
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? undefined : onClose}
      size="md"
      className="staff-avatar-modal"
    >
      <form onSubmit={handleSubmit}>
        <div className="staff-avatar-modal__header">
          <span className="staff-avatar-modal__icon" aria-hidden="true">
            <Image size={20} />
          </span>
          <div>
            <h2>Cập nhật ảnh đại diện</h2>
            <p>{employeeName}</p>
          </div>
        </div>

        <StaffAvatarField
          name={employeeName}
          currentAvatar={currentAvatar}
          value={fileBase64}
          removed={removed}
          disabled={loading}
          onChange={(nextValue) => {
            setFileBase64(nextValue);
            setRemoved(false);
            setSubmitError("");
          }}
          onRemove={() => {
            setFileBase64("");
            setRemoved(Boolean(currentAvatar));
            setSubmitError("");
          }}
        />

        <div className="staff-avatar-modal__note">
          Ảnh được chuẩn hóa thành WEBP, cắt vuông và lưu ở kích thước tối đa 512 × 512 px.
        </div>

        {submitError ? (
          <div className="staff-avatar-modal__error" role="alert">
            {submitError}
          </div>
        ) : null}

        <div className="staff-avatar-modal__footer">
          <button
            type="button"
            className="staff-avatar-modal__button is-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="staff-avatar-modal__button is-primary"
            disabled={!hasChange || loading}
          >
            {loading ? <LoadingSpinner size="sm" /> : <Save size={16} />}
            <span>{loading ? "Đang lưu..." : "Lưu ảnh"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default StaffAvatarModal;
