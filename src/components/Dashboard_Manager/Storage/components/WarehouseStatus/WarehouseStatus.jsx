// src/components/Dashboard_Manager/Storage/layout/WarehouseStatus/WarehouseStatus.jsx
import React, { useContext } from "react";
import { CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import {
  hasAnyPermission,
  NO_PERMISSION_MESSAGE,
} from "@/utils/frontendPermissionAccess";
import "./WarehouseStatus.scss";

/**
 * Props:
 * - lowStockItems: Array [{ id, name, currentStock, minStock, unit }]
 * (Danh sách các mặt hàng dưới định mức)
 */
const DROPDOWN_ID = "warehouse-status-dropdown";

const WarehouseStatus = ({ lowStockItems = [], onCreatePO }) => {
  const { user } = useContext(AuthContext);
  const warnings = Array.isArray(lowStockItems) ? lowStockItems : [];
  const isSafe = warnings.length === 0;
  const canWriteStock = hasAnyPermission(user, ["stock.write", "inventory.write"]);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (isSafe) setIsOpen(false);
  }, [isSafe]);

  const openDropdown = () => {
    if (!isSafe) setIsOpen(true);
  };

  const closeDropdown = () => setIsOpen(false);

  const handleWrapperKeyDown = (event) => {
    if (event.key === "Escape") {
      closeDropdown();
      event.stopPropagation();
    }
  };

  const handleWrapperBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      closeDropdown();
    }
  };

  return (
    <div
      className={`warehouse-status-wrapper ${isSafe ? "safe" : "warning"} ${isOpen ? "open" : ""}`}
      onMouseEnter={openDropdown}
      onMouseLeave={closeDropdown}
      onBlurCapture={handleWrapperBlur}
      onKeyDown={handleWrapperKeyDown}
    >
      {/* --- Main Badge --- */}
      {isSafe ? (
        <div className="status-badge" aria-label="Kho ổn định">
          <CheckCircle2 size={18} className="icon safe-icon" />
          <span className="status-text">Kho ổn định</span>
        </div>
      ) : (
        <button
          type="button"
          className="status-badge"
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-controls={DROPDOWN_ID}
          aria-label={`${warnings.length} nguyên liệu sắp hết`}
          onClick={() => setIsOpen((value) => !value)}
        >
          <span className="pulse-ring" aria-hidden="true"></span>
          <AlertTriangle size={18} className="icon warning-icon" />
          <span className="status-text">
            {warnings.length} Nguyên liệu sắp hết
          </span>
          <ChevronDown size={14} className="arrow-down" />
        </button>
      )}

      {/* --- Tooltip Dropdown (Chỉ hiện khi có cảnh báo) --- */}
      {!isSafe && (
        <div id={DROPDOWN_ID} className="status-dropdown">
          <div className="dropdown-header">
            <span>Cần nhập gấp</span>
            <span className="count-badge">{warnings.length}</span>
          </div>
          <ul className="warning-list">
            {warnings.map((item) => (
              <li key={item.id} className="warning-item">
                <span className="item-name">{item.name}</span>
                <span className="item-stock">
                  Còn <strong>{item.currentStock}</strong> {item.unit}
                </span>
              </li>
            ))}
          </ul>
          <div className="dropdown-footer">
            {!canWriteStock ? (
              <p className="text-xs text-secondary">{NO_PERMISSION_MESSAGE}</p>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (!canWriteStock) return;
                closeDropdown();
                onCreatePO?.();
              }}
              disabled={!canWriteStock}
              title={!canWriteStock ? NO_PERMISSION_MESSAGE : undefined}
            >
              Tạo phiếu nhập ngay
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseStatus;
