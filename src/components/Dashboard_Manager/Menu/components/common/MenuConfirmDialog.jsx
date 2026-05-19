import React from "react";
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiXCircle } from "react-icons/fi";
import Modal from "../../../../common/Modal";
import "./MenuConfirmDialog.scss";

const TONE_META = { default: { icon: FiInfo, className: "default" }, danger: { icon: FiXCircle, className: "danger" }, warning: { icon: FiAlertTriangle, className: "warning" }, success: { icon: FiCheckCircle, className: "success" } };
const MenuConfirmDialog = ({ isOpen, title, message, description, tone = "default", confirmText = "Xác nhận", cancelText = "Hủy", isLoading = false, onConfirm, onCancel, children }) => {
  const toneMeta = TONE_META[tone] || TONE_META.default;
  const ToneIcon = toneMeta.icon;
  return (<Modal isOpen={isOpen} onClose={() => !isLoading && onCancel?.()} size="sm" className={`menu-confirm-dialog menu-confirm-dialog--${toneMeta.className}`} closeOnEscape={!isLoading} closeOnOverlayClick={!isLoading}><Modal.Header onClose={() => !isLoading && onCancel?.()}>{title}</Modal.Header><Modal.Body><div className="menu-confirm-dialog__content"><div className="menu-confirm-dialog__hero"><ToneIcon size={18} /><p>{message}</p></div>{description ? <p className="menu-confirm-dialog__description">{description}</p> : null}{children ? <div className="menu-confirm-dialog__preview">{children}</div> : null}</div></Modal.Body><Modal.Footer><button type="button" className="menu-confirm-dialog__btn cancel" onClick={onCancel} disabled={isLoading}>{cancelText}</button><button type="button" className="menu-confirm-dialog__btn confirm" onClick={onConfirm} disabled={isLoading}>{isLoading ? "Đang xử lý..." : confirmText}</button></Modal.Footer></Modal>);
};
export default MenuConfirmDialog;
