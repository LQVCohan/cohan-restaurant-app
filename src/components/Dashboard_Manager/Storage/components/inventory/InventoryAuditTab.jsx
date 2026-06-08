import React, { useMemo, useState } from "react";
import { AlertCircle, ArrowDownUp, Boxes, History, Search } from "lucide-react";
import "./InventoryAuditTab.scss";

const PAGE_SIZE = 10;

const movementLabel = {
  inbound: "Nhập",
  outbound: "Xuất",
  adjustment: "Điều chỉnh",
  transfer: "Chuyển kho",
};

function InventoryAuditTab({
  ingredients = [],
  stockItems = [],
  movements = [],
  warehouses = [],
  loading = false,
  error = null,
}) {
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [page, setPage] = useState(1);

  const ingredientMap = useMemo(() => {
    const m = new Map();
    ingredients.forEach((it) => m.set(it.id, it));
    return m;
  }, [ingredients]);
  const warehouseMap = useMemo(() => {
    const m = new Map();
    warehouses.forEach((w) => m.set(String(w.id), w.name || w.id));
    return m;
  }, [warehouses]);

  const rows = useMemo(() => {
    const agg = new Map();

    for (const s of stockItems) {
      const key = s.ingredientId;
      if (!key) continue;
      const current = agg.get(key) || {
        ingredientId: key,
        onHand: 0,
        reserved: 0,
        available: 0,
        warehouseCount: 0,
      };

      const onHand = Number(s.onHand) || 0;
      const reserved = Number(s.reserved) || 0;

      current.onHand += onHand;
      current.reserved += reserved;
      current.available += onHand - reserved;
      current.warehouseCount += 1;

      agg.set(key, current);
    }

    const q = search.trim().toLowerCase();

    let list = Array.from(agg.values()).map((it) => {
      const ing = ingredientMap.get(it.ingredientId);
      const minStock = Number(ing?.minStock) || 0;
      let status = "ok";
      if (it.available <= 0) status = "out";
      else if (it.available <= minStock) status = "low";

      return {
        ...it,
        name: ing?.name || "(Không xác định)",
        sku: ing?.sku || "",
        unit: ing?.baseUnit || "",
        minStock,
        status,
      };
    });

    if (q) {
      list = list.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.sku.toLowerCase().includes(q) ||
          String(it.ingredientId).toLowerCase().includes(q),
      );
    }

    if (stockFilter !== "all") {
      list = list.filter((it) => it.status === stockFilter);
    }

    list.sort((a, b) => {
      if (sortBy === "available") return b.available - a.available;
      if (sortBy === "status") return a.status.localeCompare(b.status);
      return a.name.localeCompare(b.name, "vi");
    });

    return list;
  }, [ingredientMap, search, stockFilter, sortBy, stockItems]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const movementRows = useMemo(() => {
    return movements
      .map((mv) => {
        const ing = ingredientMap.get(mv.ingredientId);
        const unit = ing?.baseUnit || "";
        const cost = Number(mv?.meta?.costPerBaseUnit);
        const totalValue =
          Number(mv?.meta?.totalValue) ||
          ((Number(mv.qty) || 0) * (Number.isFinite(cost) ? cost : 0));
        return {
          ...mv,
          ingredientName: ing?.name || mv.ingredientId,
          unit,
          warehouseName: warehouseMap.get(String(mv.warehouseId)) || mv.warehouseId,
          toWarehouseName:
            warehouseMap.get(String(mv?.meta?.toWarehouseId)) ||
            mv?.meta?.toWarehouseId,
          fromWarehouseName:
            warehouseMap.get(String(mv?.meta?.fromWarehouseId)) ||
            mv?.meta?.fromWarehouseId,
          cost: Number.isFinite(cost) ? cost : null,
          totalValue: Number.isFinite(totalValue) ? totalValue : null,
        };
      })
      .slice(0, 30);
  }, [ingredientMap, movements, warehouseMap]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, it) => {
        acc.total += 1;
        if (it.status === "low") acc.low += 1;
        if (it.status === "out") acc.out += 1;
        return acc;
      },
      { total: 0, low: 0, out: 0 },
    );
  }, [rows]);

  if (loading) {
    return (
      <div className="inventory-audit-tab" aria-label="Đang tải kiểm kê">
        <div className="inv-summary-grid inv-summary-grid--skeleton">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="inv-summary-card inv-skeleton" key={index} aria-hidden="true" />
          ))}
        </div>
        <div className="inv-skeleton inv-skeleton--toolbar" aria-hidden="true" />
        <div className="inv-table-wrap inv-skeleton-table" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="inv-state inv-state--error">
        <AlertCircle size={18} /> Không tải được kiểm kê: {error.message}
      </div>
    );
  }

  return (
    <div className="inventory-audit-tab">
      <div className="inv-summary-grid">
        <div className="inv-summary-card">
          <Boxes size={16} /> Tổng mặt hàng: <b>{summary.total}</b>
        </div>
        <div className="inv-summary-card inv-summary-card--warn">
          <AlertCircle size={16} /> Sắp hết: <b>{summary.low}</b>
        </div>
        <div className="inv-summary-card inv-summary-card--danger">
          <AlertCircle size={16} /> Hết hàng: <b>{summary.out}</b>
        </div>
      </div>

      <div className="inv-toolbar">
        <label className="inv-search">
          <Search size={16} />
          <input
            aria-label="Tìm kiếm kiểm kê theo tên hoặc SKU"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Tìm theo tên/SKU"
          />
        </label>

        <select
          aria-label="Lọc trạng thái tồn kho"
          value={stockFilter}
          onChange={(e) => {
            setPage(1);
            setStockFilter(e.target.value);
          }}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="ok">Còn hàng</option>
          <option value="low">Sắp hết</option>
          <option value="out">Hết hàng</option>
        </select>

        <button
          type="button"
          className="inv-sort-btn"
          onClick={() =>
            setSortBy((s) =>
              s === "name" ? "available" : s === "available" ? "status" : "name",
            )
          }
        >
          <ArrowDownUp size={16} /> Sắp xếp: {sortBy}
        </button>
      </div>

      <div className="inv-table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              <th>Nguyên liệu</th>
              <th>SKU</th>
              <th>Tồn khả dụng</th>
              <th>Định mức</th>
              <th>Kho</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((it) => (
              <tr key={it.ingredientId}>
                <td>{it.name}</td>
                <td>{it.sku || "—"}</td>
                <td>
                  {it.available} {it.unit}
                </td>
                <td>
                  {it.minStock} {it.unit}
                </td>
                <td>{it.warehouseCount}</td>
                <td>
                  <span className={`inv-badge inv-badge--${it.status}`}>
                    {it.status === "ok"
                      ? "Còn hàng"
                      : it.status === "low"
                        ? "Sắp hết"
                        : "Hết hàng"}
                  </span>
                </td>
              </tr>
            ))}
            {!pagedRows.length && (
              <tr>
                <td colSpan={6} className="inv-empty-row">
                  Không có dữ liệu phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="inv-pagination">
        <button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>
          Trước
        </button>
        <span>
          Trang {safePage}/{totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Sau
        </button>
      </div>

      <div className="inv-movement-block">
        <h4>
          <History size={16} /> Lịch sử biến động gần nhất
        </h4>
        <div className="inv-movement-list">
          {movementRows.map((mv) => (
            <div key={mv.id} className="inv-movement-item">
              <strong>{mv.ingredientName}</strong>
              <span>{movementLabel[mv.type] || mv.type}</span>
              <span>
                {mv.qty > 0 ? `+${mv.qty}` : mv.qty} {mv.unit}
              </span>
              <span>{mv.warehouseName}</span>
              {mv.toWarehouseName && <span>→ {mv.toWarehouseName}</span>}
              {mv.fromWarehouseName && <span>← {mv.fromWarehouseName}</span>}
              <span>
                {mv.cost !== null
                  ? `${Number(mv.cost).toLocaleString("vi-VN")} đ/${mv.unit}`
                  : "—"}
              </span>
              <span>
                {mv.totalValue !== null
                  ? `${Number(mv.totalValue).toLocaleString("vi-VN")} đ`
                  : "—"}
              </span>
              {mv.reason && <span>{mv.reason}</span>}
              <span>{new Date(mv.createdAt).toLocaleString("vi-VN")}</span>
            </div>
          ))}
          {!movementRows.length && <div className="inv-state">Chưa có biến động.</div>}
        </div>
      </div>
    </div>
  );
}

export default InventoryAuditTab;
