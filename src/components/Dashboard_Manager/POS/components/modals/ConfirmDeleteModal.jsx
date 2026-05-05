import React, { useState } from "react";
import "./ConfirmDeleteModal.scss"; // Import styles
import useModalKeyboardClose from "./useModalKeyboardClose";

const ConfirmDeleteModal = ({
  isOpen,
  onClose,
  onConfirm,
  // when true, show choice between clearing items only or clearing the table
  showScopeChoice = false,
  requireReason = true,
}) => {
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [action, setAction] = useState(
    showScopeChoice ? "clear_items" : "delete_item",
  );
  useModalKeyboardClose({ isOpen, onClose });

  const handleConfirm = () => {
    const finalReason = requireReason ? selectedReason : "";
    const finalCustom = requireReason ? customReason : "";
    onConfirm(action, finalReason, finalCustom);
    onClose();
  };

  if (!isOpen) return null; // Nếu modal không mở thì không render gì

  return (
    <div
      className="modal-overlay-delete"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="delete-modal-container"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2>Xác nhận xóa món</h2>
        {requireReason && <p>Vui lòng chọn lý do xóa món:</p>}

        <div className="reason-group">
          {showScopeChoice && (
            <div className="scope-choice">
              <label>
                <input
                  type="radio"
                  name="scope"
                  value="clear_items"
                  checked={action === "clear_items"}
                  onChange={() => setAction("clear_items")}
                />
                Chỉ xóa món (giữ thông tin bàn)
              </label>
              <label>
                <input
                  type="radio"
                  name="scope"
                  value="clear_table"
                  checked={action === "clear_table"}
                  onChange={() => setAction("clear_table")}
                />
                Xóa bàn (xóa hết món và đặt trạng thái bàn về Trống)
              </label>
            </div>
          )}
          {requireReason && (
            <>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="reason-select"
              >
                <option value="">Chọn lý do</option>
                <option value="Out of stock">Hết hàng</option>
                <option value="Mistake">Nhầm lẫn</option>
                <option value="Not needed">Không cần nữa</option>
                <option value="Other">Lý do khác</option>
              </select>

              {selectedReason === "Other" && (
                <textarea
                  placeholder="Nhập lý do khác"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="custom-reason-input"
                />
              )}
            </>
          )}
        </div>

        <div className="modal-buttons">
          <button className="btn-cancel" onClick={onClose}>
            Hủy
          </button>
          <button
            className="btn-confirm"
            onClick={handleConfirm}
            disabled={
              requireReason &&
              (!selectedReason || (selectedReason === "Other" && !customReason))
            }
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
