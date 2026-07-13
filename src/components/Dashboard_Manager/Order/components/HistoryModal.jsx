import React, { useEffect, useMemo, useState, useCallback } from "react";
import { X, Eye, Loader, Calendar, Filter, DollarSign } from "lucide-react";
import useOrderManagement from "../../../../hooks/useOrderManagement";
import "./HistoryModal.scss";
import { formatDiscountReasonLabel } from "@/utils/discountDisplay";
/* --- Helpers --- */
const toEpochMs = (v) => {
  if (v == null) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === "object" && "$date" in v) return toEpochMs(v.$date);
  if (typeof v === "number" && Number.isFinite(v))
    return v < 1e12 ? v * 1000 : v;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) {
    const n = Number(v.trim());
    return n < 1e12 ? n * 1000 : n;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.getTime();
};
const getOrderDiscountMeta = (order) => {
  const totals = order?.totals || {};
  const discount = Number(totals.discount || 0);
  const voucherCode = String(totals.voucherCode || "").trim();
  const promotionId = String(totals.promotionId || "").trim();
  const discountReason = formatDiscountReasonLabel(totals.discountReason);

  return {
    discount,
    voucherCode,
    promotionId,
    discountReason,
    hasDiscount:
      discount > 0 ||
      Boolean(voucherCode) ||
      Boolean(promotionId) ||
      Boolean(discountReason),
  };
};
const toDT = (v) => {
  const ms = toEpochMs(v);
  return ms ? new Date(ms) : null;
};

const formatCurrency = (n) =>
  Number(n || 0).toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
  });

const toViOrderType = (t) => {
  switch (t) {
    case "dine_in":
      return "Tại bàn";
    case "takeaway":
      return "Mang về";
    case "delivery":
      return "Giao hàng";
    default:
      return "Tại bàn";
  }
};

const formatDate = (date) => {
  if (!date) return "—";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
};

const VALID_HISTORY = new Set(["served", "completed", "cancelled"]);

const HistoryModal = ({ restaurantId, onClose, onViewOrder }) => {
  const { loadOrdersAll } = useOrderManagement();

  const [allOrders, setAllOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [pageInfo, setPageInfo] = useState({
    endCursor: null,
    hasNextPage: false,
  });

  const loadPage = useCallback(
    async (cursor = null) => {
      if (!restaurantId) {
        setErrorMsg("Thiếu restaurantId. Vui lòng chọn nhà hàng.");
        return;
      }
      setLoading(true);
      setErrorMsg("");
      try {
        const res = await loadOrdersAll({
          variables: { restaurantId, limit: 50, cursor },
          fetchPolicy: "network-only",
        });

        const conn = res?.data?.ordersByRestaurant;
        const edges = Array.isArray(conn?.edges) ? conn.edges : [];
        const nodes = edges.map((e) => e.node);

        // Filter local
        const filtered = nodes.filter((o) =>
          VALID_HISTORY.has(o?.currentStatus),
        );

        // Sort DESC
        filtered.sort((a, b) => {
          const ta = toEpochMs(a?.updatedAt || a?.createdAt) || 0;
          const tb = toEpochMs(b?.updatedAt || b?.createdAt) || 0;
          return tb - ta;
        });

        setAllOrders((prev) => (cursor ? [...prev, ...filtered] : filtered));
        setPageInfo({
          endCursor: conn?.pageInfo?.endCursor || null,
          hasNextPage: !!conn?.pageInfo?.hasNextPage,
        });
      } catch (err) {
        setErrorMsg(err?.message || "Không tải được lịch sử đơn.");
      } finally {
        setLoading(false);
      }
    },
    [restaurantId, loadOrdersAll],
  );

  useEffect(() => {
    loadPage(null);
  }, [loadPage]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const history = useMemo(() => {
    if (statusFilter === "all") return allOrders;
    return allOrders.filter((o) => o.currentStatus === statusFilter);
  }, [allOrders, statusFilter]);

  const summary = useMemo(() => {
    const served = allOrders.filter((o) => o.currentStatus === "served").length;
    const completed = allOrders.filter(
      (o) => o.currentStatus === "completed",
    ).length;
    const cancelled = allOrders.filter(
      (o) => o.currentStatus === "cancelled",
    ).length;
    return { served, completed, cancelled, total: allOrders.length };
  }, [allOrders]);

  return (
    <div
      className="hm-overlay"
      onClick={onClose}
    >
      <div
        className="hm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-history-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* --- HEADER --- */}
        <header className="hm-header">
          <div className="hm-header__title-group">
            <Calendar className="hm-header__icon" size={24} aria-hidden="true" />
            <div>
              <h3 id="order-history-title" className="hm-header__title">Lịch sử đơn hàng</h3>
              <p className="hm-header__subtitle">
                Xem lại các đơn đã hoàn thành hoặc hủy
              </p>
            </div>
          </div>
          <button type="button" className="hm-close-btn" onClick={onClose} aria-label="Đóng lịch sử đơn hàng">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* --- STATS BAR --- */}
        <div className="hm-stats" aria-label="Lọc lịch sử theo trạng thái">
          <button
            type="button"
            className={`hm-stat-item ${statusFilter === "all" ? "is-active" : ""}`}
            aria-pressed={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          >
            <span className="hm-stat-label">Tổng</span>
            <span className="hm-stat-val">{summary.total}</span>
          </button>
          <button
            type="button"
            className={`hm-stat-item hm-text-served ${statusFilter === "served" ? "is-active" : ""}`}
            aria-pressed={statusFilter === "served"}
            onClick={() => setStatusFilter("served")}
          >
            <span className="hm-stat-label">Đã phục vụ</span>
            <span className="hm-stat-val">{summary.served}</span>
          </button>
          <button
            type="button"
            className={`hm-stat-item hm-text-completed ${statusFilter === "completed" ? "is-active" : ""}`}
            aria-pressed={statusFilter === "completed"}
            onClick={() => setStatusFilter("completed")}
          >
            <span className="hm-stat-label">Hoàn thành</span>
            <span className="hm-stat-val">{summary.completed}</span>
          </button>
          <button
            type="button"
            className={`hm-stat-item hm-text-cancelled ${statusFilter === "cancelled" ? "is-active" : ""}`}
            aria-pressed={statusFilter === "cancelled"}
            onClick={() => setStatusFilter("cancelled")}
          >
            <span className="hm-stat-label">Đã hủy</span>
            <span className="hm-stat-val">{summary.cancelled}</span>
          </button>
        </div>

        {/* --- CONTENT --- */}
        <div className="hm-body custom-scrollbar">
          {errorMsg ? (
            <div className="hm-empty" role="alert">
              <p className="hm-empty__text hm-text-error">{errorMsg}</p>
            </div>
          ) : history.length === 0 && !loading ? (
            <div className="hm-empty">
              <div className="hm-empty__icon">
                <Filter size={32} aria-hidden="true" />
              </div>
              <h3>Không tìm thấy đơn hàng</h3>
              <p>Thử thay đổi bộ lọc hoặc tải lại trang</p>
            </div>
          ) : (
            <div className="hm-list">
              {history.map((order) => {
                const createdAt = toDT(order?.createdAt);
                const items = Array.isArray(order?.items) ? order.items : [];
                const visibleItems = items.slice(0, 5);
                const remaining = items.length - 5;
                const st = order.currentStatus;
                const discountMeta = getOrderDiscountMeta(order);
                return (
                  <div key={order.id} className="hm-card">
                    {/* Card Header */}
                    <div className="hm-card__header">
                      <div className="hm-card__id-group">
                        <span className="hm-card__code">
                          #{order.orderCode || String(order.id).slice(-4)}
                        </span>
                        <span className="hm-card__table">
                          {order.tableCode || "N/A"}
                        </span>
                      </div>
                      <div className={`hm-badge hm-badge--${st}`}>
                        {st === "served"
                          ? "Đã phục vụ"
                          : st === "completed"
                            ? "Hoàn thành"
                            : "Đã hủy"}
                      </div>
                    </div>

                    {/* Card Meta */}
                    <div className="hm-card__meta">
                      <span>{toViOrderType(order.orderType)}</span>
                      <span className="hm-dot">•</span>
                      <span>{formatDate(createdAt)}</span>
                      {order.user?.fullName && (
                        <>
                          <span className="hm-dot">•</span>
                          <span>{order.user.fullName}</span>
                        </>
                      )}
                    </div>

                    {/* Items */}
                    <div className="hm-card__items">
                      {visibleItems.map((item, idx) => (
                        <span key={idx} className="hm-item-tag">
                          <b>{item.quantity}</b> {item.name}
                        </span>
                      ))}
                      {remaining > 0 && (
                        <span className="hm-item-tag hm-item-tag--more">
                          +{remaining} món
                        </span>
                      )}
                    </div>
                    {discountMeta.hasDiscount && (
                      <div className="hm-card__discount">
                        <span className="hm-discount-label">Ưu đãi</span>
                        <div className="hm-discount-tags">
                          {discountMeta.voucherCode && (
                            <span className="hm-discount-tag">
                              Mã ưu đãi {discountMeta.voucherCode}
                            </span>
                          )}
                          {discountMeta.promotionId && (
                            <span className="hm-discount-tag">Ưu đãi tự động</span>
                          )}
                          {discountMeta.discount > 0 && (
                            <span className="hm-discount-tag hm-discount-tag--amount">
                              -{formatCurrency(discountMeta.discount)}
                            </span>
                          )}
                          {discountMeta.discountReason && (
                            <span className="hm-discount-tag hm-discount-tag--muted">
                              {discountMeta.discountReason}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Footer */}
                    <div className="hm-card__footer">
                      <div className="hm-card__total">
                        <DollarSign size={14} strokeWidth={3} aria-hidden="true" />
                        {formatCurrency(order?.totals?.grandTotal)}
                      </div>
                      <button
                        type="button"
                        className="hm-btn-view"
                        onClick={() => onViewOrder?.(order)}
                      >
                        <Eye size={16} aria-hidden="true" /> Chi tiết
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Loading / Load More */}
          <div className="hm-loader-area">
            {loading ? (
              <div className="hm-loading" role="status">
                <Loader className="animate-spin" size={20} aria-hidden="true" /> Đang tải thêm…
              </div>
            ) : (
              pageInfo.hasNextPage && (
                <button
                  type="button"
                  className="hm-btn-loadmore"
                  onClick={() => loadPage(pageInfo.endCursor)}
                >
                  Tải thêm đơn cũ hơn
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
