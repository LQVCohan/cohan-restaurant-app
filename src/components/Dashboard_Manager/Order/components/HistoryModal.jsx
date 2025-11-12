import React, { useEffect, useMemo, useState, useCallback } from "react";
import { X, Eye, Loader } from "lucide-react";
import useOrderManagement from "../../../../hooks/useOrderManagement";
import "./HistoryModal.scss";

/* helpers */
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
const toDT = (v) => {
  const ms = toEpochMs(v);
  return ms ? new Date(ms) : null;
};
const formatCurrency = (n) =>
  Number(n || 0).toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
  });
const toViOrderType = (t) =>
  t === "dine_in"
    ? "Tại bàn"
    : t === "takeaway"
    ? "Mang về"
    : t === "delivery"
    ? "Giao hàng"
    : t || "Tại bàn";

const VALID_HISTORY = new Set(["completed", "cancelled"]);

const HistoryModal = ({ restaurantId, onClose, onViewOrder }) => {
  const { loadOrdersAll } = useOrderManagement();

  const [allOrders, setAllOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all"); // all | completed | cancelled
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

        // chỉ nhận completed/cancelled
        const filtered = nodes.filter((o) =>
          VALID_HISTORY.has(o?.currentStatus)
        );

        // sort updatedAt desc (fallback createdAt)
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
    [restaurantId, loadOrdersAll]
  );

  useEffect(() => {
    loadPage(null);
  }, [loadPage]);

  // áp dụng filter
  const history = useMemo(() => {
    if (statusFilter === "completed")
      return allOrders.filter((o) => o.currentStatus === "completed");
    if (statusFilter === "cancelled")
      return allOrders.filter((o) => o.currentStatus === "cancelled");
    return allOrders;
  }, [allOrders, statusFilter]);

  const summary = useMemo(() => {
    const completed = allOrders.filter(
      (o) => o.currentStatus === "completed"
    ).length;
    const cancelled = allOrders.filter(
      (o) => o.currentStatus === "cancelled"
    ).length;
    return { completed, cancelled, total: allOrders.length };
  }, [allOrders]);

  return (
    <div
      className="modal_hisOverlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="modal_his" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal_hisHeader">
          <h3 className="modal_hisTitle">Lịch sử đơn hàng</h3>
          <button
            className="modal_hisClose"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal_hisContent">
          {/* Summary + Filter */}
          <div className="hisTopRow">
            <p className="hisSummary">
              Hoàn thành: <strong>{summary.completed}</strong> • Hủy:{" "}
              <strong>{summary.cancelled}</strong> • Tổng:{" "}
              <strong>{summary.total}</strong>
            </p>

            <div className="hisFilters">
              <button
                className={`hisChip ${statusFilter === "all" ? "active" : ""}`}
                onClick={() => setStatusFilter("all")}
              >
                Tất cả
              </button>
              <button
                className={`hisChip ${
                  statusFilter === "completed" ? "active" : ""
                }`}
                onClick={() => setStatusFilter("completed")}
              >
                Hoàn thành
              </button>
              <button
                className={`hisChip ${
                  statusFilter === "cancelled" ? "active" : ""
                }`}
                onClick={() => setStatusFilter("cancelled")}
              >
                Đã hủy
              </button>
              {statusFilter !== "all" && (
                <button
                  className="hisClear"
                  onClick={() => setStatusFilter("all")}
                >
                  Xóa lọc
                </button>
              )}
            </div>
          </div>

          {/* trạng thái */}
          {errorMsg && (
            <div className="emptyState">
              <h3>Lỗi</h3>
              <p>{errorMsg}</p>
            </div>
          )}

          {!errorMsg && history.length === 0 && !loading && (
            <div className="emptyState">
              <h3>Không có đơn phù hợp</h3>
              <p>Hãy thay đổi bộ lọc hoặc thử lại sau.</p>
            </div>
          )}

          {/* List */}
          <div className="historyList">
            {history.map((o) => {
              const createdAt = toDT(o?.createdAt);
              const updatedAt = toDT(o?.updatedAt);
              const items = Array.isArray(o?.items) ? o.items : [];
              const tags = items.slice(0, 6);
              return (
                <div key={o.id} className="historyItem">
                  <div className="itemHeader">
                    <div>
                      <h4 className="orderTitle">
                        #{String(o.id).slice(-6)} • {o.orderCode || "—"}
                      </h4>
                      <p className="tableInfo">
                        Bàn: <strong>{o.tableCode || "—"}</strong> • Loại:{" "}
                        <strong>{toViOrderType(o?.orderType)}</strong>
                      </p>
                    </div>

                    {o.currentStatus === "completed" ? (
                      <span className="completedBadge">Hoàn thành</span>
                    ) : (
                      <span className="cancelledBadge">Đã hủy</span>
                    )}
                  </div>

                  <div className="timeInfo">
                    <div>
                      <span className="timeLabel">Tạo lúc:</span>{" "}
                      <span className="timeValue">
                        {createdAt
                          ? createdAt.toLocaleString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "2-digit",
                              month: "2-digit",
                            })
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="timeLabel">Cập nhật:</span>{" "}
                      <span className="timeValue">
                        {updatedAt
                          ? updatedAt.toLocaleString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "2-digit",
                              month: "2-digit",
                            })
                          : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="itemsInfo">
                    <div className="itemsLabel">Các món:</div>
                    <div className="itemsTags">
                      {tags.map((it, idx) => (
                        <span key={idx} className="itemTag">
                          {it.quantity}× {it.name}
                        </span>
                      ))}
                      {items.length > tags.length && (
                        <span className="itemTag">
                          +{items.length - tags.length} món
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="itemFooter">
                    <div className="totalAmount">
                      {formatCurrency(o?.totals?.grandTotal)}
                    </div>
                    <button
                      className="hisViewButton"
                      onClick={() => onViewOrder?.(o)}
                      aria-label="Xem chi tiết"
                    >
                      <Eye size={16} />
                      Xem chi tiết
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load more */}
          <div className="hisLoadMoreRow">
            {loading ? (
              <div className="hisLoading">
                <Loader size={16} className="animate-spin" /> Đang tải...
              </div>
            ) : pageInfo.hasNextPage ? (
              <button
                className="hisViewButton"
                onClick={() => loadPage(pageInfo.endCursor)}
              >
                Tải thêm
              </button>
            ) : history.length > 0 ? (
              <div className="itemsLabel">Đã hết kết quả</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
