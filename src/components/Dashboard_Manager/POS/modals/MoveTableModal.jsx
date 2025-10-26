import React, { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useTables } from "../../../../hooks/useTables";
import Modal from "../../../common/Modal";
import Button from "../../../common/Button";
import toast from "react-hot-toast";
import "./MoveTableModal.scss";

export default function MoveTableModal({
  isOpen,
  open,
  onClose,
  sourceTableCode,
}) {
  const visible = isOpen ?? open;
  const { tables, moveTable, findTableByCode } = useTables();
  const [selectedTargetTable, setSelectedTargetTable] = useState("");

  const sourceTable = findTableByCode(sourceTableCode);
  const availableTables = Object.values(tables)
    .flat()
    .filter(
      (table) => table.code !== sourceTableCode && table.status === "available"
    );

  const handleMove = () => {
    if (!selectedTargetTable) {
      toast.error("Vui lòng chọn bàn đích!");
      return;
    }
    moveTable(sourceTableCode, selectedTargetTable);
    onClose?.();
  };

  const handleClose = () => {
    setSelectedTargetTable("");
    onClose?.();
  };
  if (!visible || !sourceTable) return null;

  return (
    <Modal
      isOpen={visible}
      onClose={handleClose}
      title={`Chuyển bàn ${sourceTableCode}`}
      size="md"
    >
      <div className="move-table-modal">
        <div className="source-table-info">
          <h4>Thông tin bàn hiện tại:</h4>
          <div className="table-card">
            <div className="table-header">
              <span className="table-code">{sourceTable.code}</span>
              <span className="table-capacity">{sourceTable.capacity} chỗ</span>
            </div>
            {sourceTable.customerName && (
              <div className="customer-info">
                <div>Khách: {sourceTable.customerName}</div>
                {sourceTable.phone && <div>SĐT: {sourceTable.phone}</div>}
                {sourceTable.guestCount > 0 && (
                  <div>Số khách: {sourceTable.guestCount}</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="target-table-selection">
          <h4>Chọn bàn trống:</h4>
          {availableTables.length === 0 ? (
            <div className="no-tables">Không có bàn trống phù hợp</div>
          ) : (
            <div className="tables-grid">
              {availableTables.map((table) => (
                <div
                  key={table.code}
                  className={`table-option ${
                    selectedTargetTable === table.code ? "selected" : ""
                  }`}
                  onClick={() => setSelectedTargetTable(table.code)}
                >
                  <div className="table-code">{table.code}</div>
                  <div className="table-capacity">{table.capacity} chỗ</div>
                  <div className="status-badge available">Trống</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <Button variant="secondary" onClick={handleClose}>
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={handleMove}
            disabled={!selectedTargetTable}
          >
            <RotateCcw size={16} /> Chuyển
          </Button>
        </div>
      </div>
    </Modal>
  );
}
