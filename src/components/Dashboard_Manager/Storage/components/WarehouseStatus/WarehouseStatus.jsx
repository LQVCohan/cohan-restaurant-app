// src/components/Dashboard_Manager/Storage/layout/WarehouseStatus/WarehouseStatus.jsx
import React from "react";
import { CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react";
import "./WarehouseStatus.scss";

/**
 * Props:
 * - lowStockItems: Array [{ id, name, currentStock, minStock, unit }]
 * (Danh sách các mặt hàng dưới định mức)
 */
const WarehouseStatus = ({ lowStockItems = [], onCreatePO }) => {
  const warnings = Array.isArray(lowStockItems) ? lowStockItems : [];
  const isSafe = warnings.length === 0;

  return (
    <div className={`warehouse-status-wrapper ${isSafe ? "safe" : "warning"}`}>
      {/* --- Main Badge --- */}
      <div className="status-badge">
        {isSafe ? (
          <>
            <CheckCircle2 size={18} className="icon safe-icon" />
            <span className="status-text">Kho ổn định</span>
          </>
        ) : (
          <>
            <div className="pulse-ring"></div>
            <AlertTriangle size={18} className="icon warning-icon" />
            <span className="status-text">
              {warnings.length} Nguyên liệu sắp hết
            </span>
            <ChevronDown size={14} className="arrow-down" />
          </>
        )}
      </div>

      {/* --- Tooltip Dropdown (Chỉ hiện khi có cảnh báo) --- */}
      {!isSafe && (
        <div className="status-dropdown">
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
            <button onClick={onCreatePO}>Tạo phiếu nhập ngay</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseStatus;
