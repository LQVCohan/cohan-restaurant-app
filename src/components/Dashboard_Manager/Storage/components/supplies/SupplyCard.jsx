import React, { useMemo } from "react";
import {
  ArrowRight as ArrowRightLeft,
  Box,
  Coffee as CupSoda,
  Droplet as Droplets,
  PackageOpen as PackagePlus,
  Package as PackageMinus,
  Edit as Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import Card from "../../../../common/Card";
import "./SupplyCard.scss";

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

  // Status calculation logic
  const status = useMemo(() => {
    if (onHand <= 0) return { text: "Hết hàng", cls: "is-out" };
    if (onHand < minStock) return { text: "Sắp hết", cls: "is-low" };
    return { text: "Còn hàng", cls: "is-stocked" };
  }, [onHand, minStock]);

  // Number Formatter
  const fmt = (n, opt = {}) =>
    (Number.isFinite(Number(n)) ? Number(n) : 0).toLocaleString("vi-VN", {
      maximumFractionDigits: 2,
      ...opt,
    });

  // Category Icon Mapper
  const renderCategoryIcon = (cat) => {
    switch ((cat || "").toLowerCase()) {
      case "drink":
        return <CupSoda size={22} strokeWidth={1.85} />;
      case "tissue":
        return <Box size={22} strokeWidth={1.85} />;
      case "clean":
        return <Sparkles size={22} strokeWidth={1.85} />;
      case "sauce":
        return <Droplets size={22} strokeWidth={1.85} />;
      default:
        return <Box size={22} strokeWidth={1.85} />;
    }
  };

  const costFromStock = Number(stockItem?.costPerUnit ?? NaN);
  const priceFromStock = Number(stockItem?.pricePerUnit ?? NaN);
  const noteFromStock = stockItem?.note || "";

  // Average Cost Calculation (fallback)
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
    if (Number.isFinite(costFromStock)) return costFromStock;
    if (sumQty > 0) return sumCost / sumQty;
    return Number(supply?.costPerUnit || 0);
  }, [costFromStock, stockItem?.batches, supply?.costPerUnit]);

  const sellingPrice =
    Number.isFinite(priceFromStock) && priceFromStock >= 0
      ? priceFromStock
      : Number(supply?.pricePerUnit ?? supply?.sellingPrice ?? supply?.retailPrice ?? 0) || 0;

  return (
    <Card className="supply-card" hover={false} padding="none">
      {/* --- Header --- */}
      <div className="supply-header">
        <div className="supply-flex-row">
          {/* Icon */}
          <div className="sc-icon-box">{renderCategoryIcon(supply?.category)}</div>

          {/* Meta Info */}
          <div className="sc-meta">
            <div className="sc-title-row">
              <h3 className="sc-name" title={supply?.name || ""}>
                {supply?.name || "-"}
              </h3>
              <div
                className={`sc-status-dot ${status.cls}`}
                title={status.text}
              />
            </div>

            <div className="sc-sub-info">
              <span className="sc-chip">
                {supply?.sku || supply?.category || "N/A"}
              </span>
              <span className="sc-sep">|</span>
              <span>{supply?.unit || "unit"}</span>
            </div>
          </div>

          {/* Quick Stock Action */}
          <button
            className="sc-stock-btn"
            title="Nhập nhanh"
            onClick={(e) => {
              e.stopPropagation();
              onStockClick?.(supply);
            }}
          >
            <span className="val">{fmt(onHand)}</span>
            <span className="lbl">Tồn</span>
          </button>
        </div>
      </div>

      {/* --- Body --- */}
      <div className="supply-body">
        {/* Stats Grid */}
        <div className="sc-stats-grid">
          <div className="sc-stat-item">
            <span className="sc-stat-lbl">Cảnh báo</span>
            <span className="sc-stat-val">{fmt(minStock)}</span>
          </div>
          <div className="sc-stat-item">
            <span className="sc-stat-lbl">Giá vốn</span>
            <span className="sc-stat-val">
              {fmt(avgCost, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="sc-stat-item">
            <span className="sc-stat-lbl">Giá bán</span>
            <span className="sc-stat-val highlight">
              {fmt(sellingPrice, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {noteFromStock && (
          <div className="sc-note">
            <span className="sc-note-label">Ghi chú:</span>{" "}
            <span className="sc-note-text">{noteFromStock}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="sc-actions">
          <div className="sc-group-left">
            <button
              className="sc-btn variant-ghost"
              onClick={(e) => {
                e.stopPropagation();
                onStockClick?.(supply);
              }}
              title="Nhập kho"
            >
              <PackagePlus size={15} /> Nhập
            </button>
            <button
              className="sc-btn variant-ghost"
              onClick={(e) => {
                e.stopPropagation();
                onStockOutClick?.(supply);
              }}
              title="Xuất kho"
            >
              <PackageMinus size={15} /> Xuất
            </button>
            <button
              className="sc-btn variant-icon"
              onClick={(e) => {
                e.stopPropagation();
                onTransferClick?.(supply);
              }}
              title="Chuyển kho"
            >
              <ArrowRightLeft size={15} />
            </button>
          </div>

          <div className="sc-group-right">
            <button
              className="sc-btn variant-icon"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(supply);
              }}
              title="Chỉnh sửa"
            >
              <Pencil size={15} />
            </button>
            <button
              className="sc-btn variant-icon danger"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(supply?.id);
              }}
              title="Xoá"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default SupplyCard;
