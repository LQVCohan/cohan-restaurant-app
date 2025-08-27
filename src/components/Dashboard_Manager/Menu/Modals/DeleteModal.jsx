import React from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "../../../common/Modal";
import Button from "../../../common/Button";
import "./DeleteModal.scss";

const DeleteModal = ({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  isLoading = false,
}) => {
  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        Hủy
      </Button>
      <Button variant="danger" onClick={onConfirm} loading={isLoading}>
        Xóa món
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xác nhận xóa"
      footer={footer}
      size="sm"
    >
      <div className="delete-modal">
        <div className="delete-modal__icon">
          <AlertTriangle size={48} />
        </div>
        <div className="delete-modal__content">
          <p className="delete-modal__question">
            Bạn có chắc chắn muốn xóa món:
          </p>
          <p className="delete-modal__item-name">{itemName}</p>
          <p className="delete-modal__warning">
            Hành động này không thể hoàn tác!
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteModal;
