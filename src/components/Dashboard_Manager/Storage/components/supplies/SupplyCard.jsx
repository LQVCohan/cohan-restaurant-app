import React, { useMemo } from "react";
import Card from "../../../../common/Card";
import "./SupplyCard.scss";

/**
 * @param {Object} props
 * @param {Object} props.supply
 * @param {Object} props.stockItem  // { onHand, reserved, batches: [{qty, costPerBaseUnit}] }
 * @param {Function} props.onEdit
 * @param {Function} props.onDelete
 * @param {Function} props.onStockClick
 * @param {Function} props.onStockOutClick
 * @param {Function} props.onTransferClick
 */
const SupplyCard = ({
  supply,
  stockItem,
  onEdit,
  onDelete,
  onStockClick,
  onStockOutClick,
  onTransferClick,
}) => {
  const onHand = Number(stockItem?.onHand || 0);
  const minStock = Number(supply?.minStock || 0);

  const status = useMemo(() => {
    if (onHand <= 0) return { text: "Hết hàng", cls: "status-out" };
    if (onHand < minStock) return { text: "Sắp hết", cls: "status-low" };
    return { text: "Còn hàng", cls: "status-in" };
  }, [onHand, minStock]);

  const fmt = (n, opt = {}) =>
    (Number.isFinite(Number(n)) ? Number(n) : 0).toLocaleString("vi-VN", {
      maximumFractionDigits: 2,
      ...opt,
    });

  const iconByCategory = (cat) => {
    switch ((cat || "").toLowerCase()) {
      case "drink":
        return "🥤";
      case "tissue":
        return "🧻";
      case "clean":
        return "🧼";
      case "sauce":
        return "🧃";
      default:
        return "📦";
    }
  };

  // === Tính Giá vốn (avg cost) theo trọng số từ các batch ===
  // FIFO dùng cho xuất kho; để hiện thị giá vốn "đại diện" trên thẻ, ta dùng weighted-average cost hiện có.
  const avgCost = useMemo(() => {
    const batches = stockItem?.batches || [];
    let sumCost = 0;
    let sumQty = 0;
    for (const b of batches) {
      const q = Number(b.qty || 0);
      const c = Number(b.costPerBaseUnit || 0);
      if (q > 0 && c >= 0) {
        sumQty += q;
        sumCost += q * c;
      }
    }
    if (sumQty > 0) return sumCost / sumQty;
    // fallback: nếu chưa có lô hoặc chưa nhập giá → dùng giá nhập mặc định
    return Number(supply?.costPerUnit || 0);
  }, [stockItem?.batches, supply?.costPerUnit]);

  // Giá bán: ưu tiên sellingPrice → retailPrice → 0
  const sellingPrice =
    Number(supply?.sellingPrice ?? supply?.retailPrice ?? 0) || 0;

  return (
    <Card className="supply-card" hover padding="none">
      {/* Header */}
      <div className="supply-header">
        <div className="supply-left">
          <div className="supply-icon">{iconByCategory(supply?.category)}</div>

          <div className="supply-meta">
            <div className="supply-top">
              <h3 className="supply-name" title={supply?.name || ""}>
                {supply?.name || "-"}
              </h3>

              {/* Stock circle (click = nhập kho) */}
              <button
                className="stock-circle"
                title="Nhập kho"
                onClick={(e) => {
                  e.stopPropagation();
                  onStockClick?.(supply);
                }}
              >
                {fmt(onHand)}
              </button>
            </div>

            {/* category + unit + status */}
            <div className="supply-sub">
              <span className="chip">{supply?.category || "other"}</span>
              <span className="dot">•</span>
              <span className="chip chip-soft">{supply?.unit || "unit"}</span>
              <span className={`status-badge ${status.cls}`}>
                {status.text}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="supply-body">
        <div className="stats">
          <div className="stat">
            <div className="stat-label">Tồn kho</div>
            <div className="stat-value">
              {fmt(onHand)} <span className="unit">{supply?.unit}</span>
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">Cảnh báo</div>
            <div className="stat-value">
              {fmt(minStock)} <span className="unit">{supply?.unit}</span>
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">Giá vốn (ước tính)</div>
            <div className="stat-value">
              {fmt(avgCost, { maximumFractionDigits: 0 })}{" "}
              <span className="unit">đ/{supply?.unit || "unit"}</span>
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">Giá bán</div>
            <div className="stat-value">
              {fmt(sellingPrice, { maximumFractionDigits: 0 })}{" "}
              <span className="unit">đ/{supply?.unit || "unit"}</span>
            </div>
          </div>
        </div>

        <div className="actions">
          <button
            className="btn btn-in"
            title="Nhập kho"
            onClick={(e) => {
              e.stopPropagation();
              onStockClick?.(supply);
            }}
          >
            📦 Nhập
          </button>
          <button
            className="btn btn-out"
            title="Xuất kho"
            onClick={(e) => {
              e.stopPropagation();
              onStockOutClick?.(supply);
            }}
          >
            📤 Xuất
          </button>
          <button
            className="btn btn-transfer"
            title="Chuyển kho"
            onClick={(e) => {
              e.stopPropagation();
              onTransferClick?.(supply);
            }}
          >
            🔁 Chuyển
          </button>

          <div className="spacer" />

          <button
            className="icon-btn"
            title="Sửa"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(supply);
            }}
          >
            ✏️
          </button>
          <button
            className="icon-btn danger"
            title="Xoá"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(supply?.id);
            }}
          >
            🗑️
          </button>
        </div>
      </div>
    </Card>
  );
};

export default SupplyCard;
