import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import useOrderManagement from "@/hooks/useOrderManagement";
import useSocketOrder from "@/hooks/useSocketOrder";
import { useNotification } from "@/hooks/useNotification";
import { getOrderLineDisplay } from "@/utils/orderLineDisplay";
import { resolveUserRoleName } from "@/utils/frontendRoleAccess";
import "./StaffKitchenPage.scss";

const ITEM_STATUS_LABELS = {
  pending: "Chờ nhận",
  confirmed: "Đã xác nhận",
  customer_attached: "Khách đã gắn món",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng",
  served: "Đã phục vụ",
  cancelled: "Đã hủy",
  returned: "Đã trả lại",
};

const ORDER_STATUS_LABELS = {
  pending: "Chờ xử lý",
  confirmed: "Đã xác nhận",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng",
  served: "Đã phục vụ",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
};

const ORDER_TYPE_LABELS = {
  delivery: "Giao hàng",
  takeaway: "Mang về",
  dine_in: "Tại bàn",
};

const STATUS_FILTER_OPTIONS = [
  { value: "active", label: "Cần xử lý" },
  { value: "pending", label: "Chờ nhận" },
  { value: "preparing", label: "Đang làm" },
  { value: "ready", label: "Sẵn sàng" },
  { value: "all", label: "Tất cả" },
];

const STATION_MODE_OPTIONS = [
  {
    value: "kitchen",
    label: "Chế độ bếp chính",
    description: "Món do bếp chính xử lý",
  },
  {
    value: "bar",
    label: "Chế độ quầy bar",
    description: "Đồ uống và món của quầy bar",
  },
  {
    value: "all",
    label: "Tổng hợp",
    description: "Theo dõi cả hai khu vực",
  },
];

const STATION_MODE_META = {
  kitchen: {
    eyebrow: "Kitchen dispatch",
    title: "Ưu tiên món đang chờ bếp",
    description:
      "Theo dõi món mới, nhận chế biến và báo sẵn sàng mà không phải rời khỏi bảng điều phối.",
    shortLabel: "Bếp chính",
    emptyTitle: "Bếp chính đang thông thoáng",
    emptyCopy: "Chưa có món nào phù hợp với bộ lọc hiện tại.",
  },
  bar: {
    eyebrow: "Bar dispatch",
    title: "Điều phối quầy bar theo thời gian thực",
    description:
      "Tập trung vào đồ uống cần nhận, món đang pha chế và các yêu cầu đã quá thời gian.",
    shortLabel: "Quầy bar",
    emptyTitle: "Quầy bar chưa có món chờ",
    emptyCopy: "Chưa có đồ uống hoặc món bar nào phù hợp với bộ lọc hiện tại.",
  },
  all: {
    eyebrow: "Kitchen / bar dispatch",
    title: "Một hàng chờ cho toàn bộ khu chế biến",
    description:
      "Xem nhanh tải công việc của bếp chính và quầy bar, sau đó chuyển đúng khu vực chỉ với một thao tác.",
    shortLabel: "Bếp / bar",
    emptyTitle: "Chưa có món cần xử lý",
    emptyCopy: "Hệ thống sẽ tự cập nhật khi có order mới đi vào khu chế biến.",
  },
};

const ROLE_STATION_MODE = {
  bartender: "bar",
  chef: "kitchen",
  cook: "kitchen",
  kitchen_helper: "kitchen",
};

const STATION_LABELS = {
  kitchen: "Bếp chính",
  bar: "Quầy bar",
  all: "Bếp / bar",
  unassigned: "Chưa phân khu",
};

const TIME_LEVEL_LABELS = {
  late: "Trễ",
  very_late: "Rất trễ",
};

const PENDING_ITEM_STATUSES = ["pending", "confirmed", "customer_attached"];
const HIDDEN_ITEM_STATUSES = ["cancelled", "returned", "served"];

const getRestaurantForStaffId = (restaurantForStaff) => {
  if (!restaurantForStaff) return null;
  if (typeof restaurantForStaff === "string") return restaurantForStaff;
  if (typeof restaurantForStaff === "object") {
    return restaurantForStaff.id || restaurantForStaff._id || null;
  }
  return null;
};

const getRestaurantForStaffName = (restaurantForStaff) => {
  if (!restaurantForStaff || typeof restaurantForStaff !== "object") return null;
  return restaurantForStaff.name || restaurantForStaff.restaurantName || null;
};

const normalizeStatus = (status) => String(status || "pending").toLowerCase();

const getItemBucket = (status) => {
  const normalized = normalizeStatus(status);
  if (PENDING_ITEM_STATUSES.includes(normalized)) return "pending";
  if (normalized === "preparing") return "preparing";
  if (normalized === "ready") return "ready";
  return "other";
};

const isVisibleItem = (item) => !HIDDEN_ITEM_STATUSES.includes(normalizeStatus(item?.status));

const matchesStatusFilter = (item, filter) => {
  const bucket = getItemBucket(item?.status);
  if (filter === "all") return isVisibleItem(item);
  if (filter === "active") return ["pending", "preparing"].includes(bucket);
  return bucket === filter;
};

const isRemoteStaffPendingOrder = (order) => {
  if (!order) return false;
  const typeOk = ["delivery", "takeaway"].includes(order.orderType);
  const statusOk = order.currentStatus === "pending";
  const meta = order.clientMeta || {};
  const source = String(meta.source || meta.clientSource || "").toLowerCase();
  const channel = String(meta.channel || "").toLowerCase();
  const clientType = String(meta.clientType || "").toLowerCase();
  return typeOk && statusOk && [source, channel, clientType].includes("staff_remote");
};

const getNextItemStatus = (status, station) => {
  const normalized = normalizeStatus(status);
  const isBar = station === "bar";
  if (PENDING_ITEM_STATUSES.includes(normalized)) {
    return {
      value: "preparing",
      label: isBar ? "Nhận tại quầy bar" : "Nhận vào bếp",
    };
  }
  if (normalized === "preparing") {
    return {
      value: "ready",
      label: isBar ? "Báo đồ uống sẵn sàng" : "Báo món sẵn sàng",
    };
  }
  return null;
};

const formatQuantity = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return value || "0";
  return Number.isInteger(number) ? String(number) : String(number).replace(/\.0+$/, "");
};

const getElapsedMinutes = (value) => {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
};

const getOrderAgeMinutes = (createdAt) => getElapsedMinutes(createdAt);

const normalizeStation = (station) => {
  const normalized = String(station || "").toLowerCase();
  if (["kitchen", "bar"].includes(normalized)) return normalized;
  return "unassigned";
};

const getItemStation = (item) => normalizeStation(item?.station || item?.workItemStation);

const matchesStationFilter = (item, stationFilter) => {
  if (stationFilter === "all") return true;
  return getItemStation(item) === stationFilter;
};

const hasLateOrUnacceptedSignal = (item) => {
  const timeLevel = String(item?.timeLevel || "").toLowerCase();
  return item?.unaccepted === true || ["late", "very_late"].includes(timeLevel);
};

const getUrgencyRank = (item) => {
  if (item?.unaccepted === true) return 0;
  const timeLevel = String(item?.timeLevel || "").toLowerCase();
  if (timeLevel === "very_late") return 1;
  if (timeLevel === "late") return 2;
  const bucket = getItemBucket(item?.status);
  if (bucket === "pending") return 3;
  if (bucket === "preparing") return 4;
  if (bucket === "ready") return 5;
  return 6;
};

const getItemStartedAt = (item, order) => {
  const value = item?.preparingAt || item?.kitchenEnteredAt || order?.createdAt;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getTimingBadges = (item) => {
  const badges = [];
  const timeLevel = String(item?.timeLevel || "").toLowerCase();
  if (item?.unaccepted === true) {
    badges.push({ key: "unaccepted", label: "Chưa nhận quá hạn", danger: true });
  }
  if (TIME_LEVEL_LABELS[timeLevel]) {
    badges.push({
      key: `time-${timeLevel}`,
      label: TIME_LEVEL_LABELS[timeLevel],
      danger: true,
    });
  }
  return badges;
};

const formatItemWaitTime = (item, order) => {
  const explicitActual = Number(item?.actualPrepMinutes);
  if (Number.isFinite(explicitActual) && explicitActual >= 0) {
    return `Đã chuẩn bị ${explicitActual} phút`;
  }

  const minutes = getElapsedMinutes(item?.preparingAt || item?.kitchenEnteredAt || order?.createdAt);
  return minutes > 0 ? `Đã chờ ${minutes} phút` : "Vừa vào khu chế biến";
};

const getRowStation = (items) => {
  const stations = [...new Set(items.map(({ item }) => getItemStation(item)))];
  return stations.length === 1 ? stations[0] : "all";
};

const LoadingSkeleton = () => (
  <div className="staff-kitchen-page__skeleton-grid" aria-label="Đang tải hàng chờ chế biến">
    {[0, 1, 2].map((key) => (
      <div className="staff-kitchen-page__skeleton" key={key} aria-hidden="true">
        <div className="staff-kitchen-page__skeleton-bar" />
        <div className="staff-kitchen-page__skeleton-body">
          <div className="staff-kitchen-page__skeleton-line staff-kitchen-page__skeleton-line--title" />
          <div className="staff-kitchen-page__skeleton-line staff-kitchen-page__skeleton-line--short" />
          <div className="staff-kitchen-page__skeleton-item" />
          <div className="staff-kitchen-page__skeleton-item" />
        </div>
      </div>
    ))}
  </div>
);

const StaffKitchenPage = () => {
  const { user } = useContext(AuthContext) || {};
  const role = resolveUserRoleName(user);
  const lockedStationMode = ROLE_STATION_MODE[role] || null;
  const restaurantForStaff = user?.restaurantForStaff;
  const restaurantId = getRestaurantForStaffId(restaurantForStaff);
  const restaurantName = getRestaurantForStaffName(restaurantForStaff);
  const [savingKey, setSavingKey] = useState(null);
  const [statusFilter, setStatusFilter] = useState("active");
  const [stationFilter, setStationFilter] = useState(() => lockedStationMode || "all");
  const { showNotification } = useNotification?.() || {
    showNotification: () => {},
  };

  const stationModeOptions = useMemo(
    () =>
      lockedStationMode
        ? STATION_MODE_OPTIONS.filter((option) => option.value === lockedStationMode)
        : STATION_MODE_OPTIONS,
    [lockedStationMode],
  );
  const activeMode = STATION_MODE_META[stationFilter] || STATION_MODE_META.all;

  useEffect(() => {
    if (lockedStationMode && stationFilter !== lockedStationMode) {
      setStationFilter(lockedStationMode);
    }
  }, [lockedStationMode, stationFilter]);

  const {
    ordersNow,
    ordersNowLoading,
    ordersNowError,
    loadOrdersNow,
    updateItemStatus,
  } = useOrderManagement();

  const reloadOrders = useCallback(
    (fetchPolicy = "network-only") => {
      if (!restaurantId || !loadOrdersNow) return;
      loadOrdersNow({
        variables: { restaurantId, limit: 100 },
        fetchPolicy,
      });
    },
    [loadOrdersNow, restaurantId],
  );

  useEffect(() => {
    reloadOrders();
  }, [reloadOrders]);

  useSocketOrder(restaurantId, {
    onAny: () => reloadOrders("network-only"),
  });

  const activeOrders = useMemo(() => {
    return (ordersNow || [])
      .filter((order) => {
        const status = normalizeStatus(order?.currentStatus);
        return (
          !["draft", "served", "completed", "cancelled", "failed"].includes(status) &&
          !isRemoteStaffPendingOrder(order)
        );
      })
      .sort((a, b) => {
        const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      });
  }, [ordersNow]);

  const stationQueueCounts = useMemo(() => {
    const counts = { kitchen: 0, bar: 0, all: 0 };
    for (const order of activeOrders) {
      for (const item of order.items || []) {
        if (!isVisibleItem(item) || !["pending", "preparing"].includes(getItemBucket(item.status))) {
          continue;
        }
        const station = getItemStation(item);
        counts.all += 1;
        if (station === "kitchen" || station === "bar") counts[station] += 1;
      }
    }
    return counts;
  }, [activeOrders]);

  const summary = useMemo(() => {
    let pending = 0;
    let preparing = 0;
    let ready = 0;
    let totalActive = 0;
    let late = 0;

    for (const order of activeOrders) {
      for (const item of order.items || []) {
        if (!isVisibleItem(item) || !matchesStationFilter(item, stationFilter)) continue;
        const bucket = getItemBucket(item.status);
        if (bucket === "pending") pending += 1;
        if (bucket === "preparing") preparing += 1;
        if (bucket === "ready") ready += 1;
        if (["pending", "preparing"].includes(bucket)) totalActive += 1;
        if (hasLateOrUnacceptedSignal(item)) late += 1;
      }
    }

    return { pending, preparing, ready, totalActive, late };
  }, [activeOrders, stationFilter]);

  const orderRows = useMemo(() => {
    return activeOrders
      .map((order) => {
        const visibleItems = (order.items || [])
          .map((item, index) => ({ item, index }))
          .filter(
            ({ item }) => isVisibleItem(item) && matchesStationFilter(item, stationFilter),
          );

        const filteredItems = visibleItems
          .filter(({ item }) => matchesStatusFilter(item, statusFilter))
          .sort((a, b) => {
            const urgency = getUrgencyRank(a.item) - getUrgencyRank(b.item);
            if (urgency !== 0) return urgency;
            return getItemStartedAt(a.item, order) - getItemStartedAt(b.item, order);
          });

        const urgentCount = filteredItems.filter(({ item }) =>
          hasLateOrUnacceptedSignal(item),
        ).length;
        const oldestAt = filteredItems.reduce((oldest, { item }) => {
          const startedAt = getItemStartedAt(item, order);
          return oldest === 0 || startedAt < oldest ? startedAt : oldest;
        }, 0);

        return {
          order,
          visibleItems,
          filteredItems,
          urgentCount,
          oldestAt,
          rowStation: getRowStation(filteredItems),
        };
      })
      .filter((row) => row.filteredItems.length > 0)
      .sort((a, b) => {
        if (a.urgentCount !== b.urgentCount) return b.urgentCount - a.urgentCount;
        return a.oldestAt - b.oldestAt;
      });
  }, [activeOrders, statusFilter, stationFilter]);

  const handleUpdateItemStatus = useCallback(
    async (order, item, index, nextStatus) => {
      if (!restaurantId || !order?.id || !nextStatus) return;
      const itemKey = item?._lineId || item?._id || index;
      const saveKey = `${order.id}:${itemKey}`;
      setSavingKey(saveKey);
      try {
        const result = await updateItemStatus({
          orderId: order.id,
          itemKey,
          status: nextStatus,
          restaurantId,
          tableCode: order?.tableCode,
          itemsSnapshot: order?.items,
          afterSuccess: () => reloadOrders("network-only"),
        });

        if (!result?.success) {
          throw new Error(result?.message || "Không thể cập nhật trạng thái món.");
        }
      } catch (error) {
        showNotification(error?.message || "Không thể cập nhật trạng thái món.", "error");
      } finally {
        setSavingKey(null);
      }
    },
    [restaurantId, reloadOrders, showNotification, updateItemStatus],
  );

  if (!restaurantId) {
    return (
      <section className="staff-kitchen-page">
        <div className="staff-kitchen-page__state staff-kitchen-page__state--error">
          <div className="staff-kitchen-page__state-inner">
            <div className="staff-kitchen-page__state-mark" aria-hidden="true">
              !
            </div>
            <h2>Tài khoản chưa được gán nhà hàng</h2>
            <p>Liên hệ quản lý để gán cơ sở trước khi mở bảng điều phối bếp và quầy bar.</p>
          </div>
        </div>
      </section>
    );
  }

  const hasActiveOrders = activeOrders.length > 0;
  const canSwitchToAll = !lockedStationMode && stationFilter !== "all";
  const canResetStatus = statusFilter !== "all";

  return (
    <section
      className="staff-kitchen-page"
      aria-busy={ordersNowLoading}
      aria-label="Bảng điều phối bếp và quầy bar"
    >
      <header className="staff-kitchen-page__hero" data-station={stationFilter}>
        <div className="staff-kitchen-page__hero-copy">
          <p className="staff-kitchen-page__eyebrow">{activeMode.eyebrow}</p>
          <h1 className="staff-kitchen-page__title">{activeMode.title}</h1>
          <p className="staff-kitchen-page__subtitle">{activeMode.description}</p>
        </div>
        <aside className="staff-kitchen-page__venue" aria-label="Cơ sở đang làm việc">
          <span className="staff-kitchen-page__venue-label">Cơ sở</span>
          <strong title={restaurantName || restaurantId}>{restaurantName || restaurantId}</strong>
          <span className="staff-kitchen-page__live" role="status">
            Cập nhật theo order mới
          </span>
        </aside>
      </header>

      <nav
        className={`staff-kitchen-page__mode-switcher ${
          lockedStationMode ? "staff-kitchen-page__mode-switcher--locked" : ""
        }`}
        aria-label="Chế độ điều phối"
      >
        {stationModeOptions.map((option) => {
          const isActive = stationFilter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`staff-kitchen-page__mode-button ${isActive ? "is-active" : ""}`}
              data-station={option.value}
              aria-label={option.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setStationFilter(option.value)}
            >
              <span className="staff-kitchen-page__mode-name">{option.label}</span>
              <span className="staff-kitchen-page__mode-count" aria-label={`${stationQueueCounts[option.value]} món cần xử lý`}>
                {stationQueueCounts[option.value]}
              </span>
              <span className="staff-kitchen-page__mode-description">{option.description}</span>
            </button>
          );
        })}
      </nav>

      <section className="staff-kitchen-page__overview" aria-label="Tổng quan hàng chờ">
        <div className="staff-kitchen-page__priority-card" data-station={stationFilter}>
          <div>
            <p className="staff-kitchen-page__priority-label">Cần xử lý · {activeMode.shortLabel}</p>
            <div className="staff-kitchen-page__priority-value">{summary.totalActive}</div>
          </div>
          <p className="staff-kitchen-page__priority-copy">
            Số dòng món đang chờ nhận hoặc đang được chuẩn bị.
          </p>
        </div>

        <div className="staff-kitchen-page__metrics">
          <div className="staff-kitchen-page__metric">
            <p className="staff-kitchen-page__metric-label">Chờ nhận</p>
            <strong className="staff-kitchen-page__metric-value">{summary.pending}</strong>
          </div>
          <div className="staff-kitchen-page__metric">
            <p className="staff-kitchen-page__metric-label">Đang làm</p>
            <strong className="staff-kitchen-page__metric-value">{summary.preparing}</strong>
          </div>
          <div className="staff-kitchen-page__metric">
            <p className="staff-kitchen-page__metric-label">Sẵn sàng</p>
            <strong className="staff-kitchen-page__metric-value">{summary.ready}</strong>
          </div>
          <div className="staff-kitchen-page__metric staff-kitchen-page__metric--danger">
            <p className="staff-kitchen-page__metric-label">Trễ / quá hạn</p>
            <strong className="staff-kitchen-page__metric-value">{summary.late}</strong>
          </div>
        </div>
      </section>

      <div className="staff-kitchen-page__controls" data-station={stationFilter}>
        <div className="staff-kitchen-page__status-tabs" role="group" aria-label="Lọc theo trạng thái món">
          {STATUS_FILTER_OPTIONS.map((option) => {
            const isActive = statusFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={`staff-kitchen-page__status-button ${isActive ? "is-active" : ""}`}
                aria-pressed={isActive}
                onClick={() => setStatusFilter(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="staff-kitchen-page__refresh"
          disabled={ordersNowLoading}
          onClick={() => reloadOrders("network-only")}
        >
          {ordersNowLoading ? "Đang làm mới…" : "Làm mới hàng chờ"}
        </button>
      </div>

      <div className="staff-kitchen-page__content" aria-live="polite">
        {ordersNowLoading ? (
          <LoadingSkeleton />
        ) : ordersNowError ? (
          <div className="staff-kitchen-page__state staff-kitchen-page__state--error" role="alert">
            <div className="staff-kitchen-page__state-inner">
              <div className="staff-kitchen-page__state-mark" aria-hidden="true">
                !
              </div>
              <h2>Không tải được hàng chờ</h2>
              <p>{ordersNowError.message || "Kết nối tới dữ liệu order thất bại."}</p>
              <div className="staff-kitchen-page__state-actions">
                <button
                  type="button"
                  className="staff-kitchen-page__state-action"
                  onClick={() => reloadOrders("network-only")}
                >
                  Thử tải lại
                </button>
              </div>
            </div>
          </div>
        ) : !hasActiveOrders ? (
          <div className="staff-kitchen-page__state">
            <div className="staff-kitchen-page__state-inner">
              <div className="staff-kitchen-page__state-mark" aria-hidden="true">
                0
              </div>
              <h2>Chưa có order cần chế biến</h2>
              <p>Trang đang lắng nghe order mới và sẽ tự cập nhật khi có món đi vào bếp hoặc quầy bar.</p>
              <div className="staff-kitchen-page__state-actions">
                <button
                  type="button"
                  className="staff-kitchen-page__state-action"
                  onClick={() => reloadOrders("network-only")}
                >
                  Kiểm tra ngay
                </button>
              </div>
            </div>
          </div>
        ) : orderRows.length === 0 ? (
          <div className="staff-kitchen-page__state">
            <div className="staff-kitchen-page__state-inner">
              <div className="staff-kitchen-page__state-mark" aria-hidden="true">
                ✓
              </div>
              <h2>{activeMode.emptyTitle}</h2>
              <p>{activeMode.emptyCopy}</p>
              <div className="staff-kitchen-page__state-actions">
                {canResetStatus ? (
                  <button
                    type="button"
                    className="staff-kitchen-page__state-action"
                    onClick={() => setStatusFilter("all")}
                  >
                    Xem tất cả trạng thái
                  </button>
                ) : null}
                {canSwitchToAll ? (
                  <button
                    type="button"
                    className="staff-kitchen-page__state-action"
                    onClick={() => setStationFilter("all")}
                  >
                    Mở chế độ tổng hợp
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="staff-kitchen-page__orders">
            {orderRows.map(
              ({ order, filteredItems, visibleItems, urgentCount, rowStation }) => {
                const ageMinutes = getOrderAgeMinutes(order.createdAt);
                const orderTitle = order.tableCode
                  ? `Bàn ${order.tableCode}`
                  : order.orderCode || `Đơn ${String(order.id).slice(-4)}`;

                return (
                  <article
                    key={order.id}
                    className={`staff-kitchen-page__order ${urgentCount > 0 ? "is-urgent" : ""}`}
                    data-station={rowStation}
                  >
                    <header className="staff-kitchen-page__order-header">
                      <div>
                        <p className="staff-kitchen-page__order-kicker">
                          {STATION_LABELS[rowStation] || STATION_LABELS.all} · {filteredItems.length} dòng món
                        </p>
                        <h2 className="staff-kitchen-page__order-title">{orderTitle}</h2>
                        <span className="staff-kitchen-page__order-code">
                          {order.orderCode || order.id} · {ORDER_STATUS_LABELS[normalizeStatus(order.currentStatus)] || order.currentStatus || "Không rõ"}
                        </span>
                      </div>
                      <time className="staff-kitchen-page__order-age" dateTime={order.createdAt || undefined}>
                        {ageMinutes > 0 ? `${ageMinutes} phút` : "Mới"}
                      </time>
                    </header>

                    <div className="staff-kitchen-page__order-meta">
                      <span className="staff-kitchen-page__badge">
                        {ORDER_TYPE_LABELS[order.orderType] || "Tại bàn"}
                      </span>
                      {rowStation !== "all" ? (
                        <span className="staff-kitchen-page__badge" data-station={rowStation}>
                          {STATION_LABELS[rowStation]}
                        </span>
                      ) : null}
                      {visibleItems.length > filteredItems.length ? (
                        <span className="staff-kitchen-page__badge">
                          {visibleItems.length} món trong khu vực
                        </span>
                      ) : null}
                      {urgentCount > 0 ? (
                        <span className="staff-kitchen-page__badge staff-kitchen-page__badge--danger">
                          {urgentCount} món cần chú ý
                        </span>
                      ) : null}
                    </div>

                    {order.note ? (
                      <p className="staff-kitchen-page__order-note">Ghi chú đơn: {order.note}</p>
                    ) : null}

                    <ul className="staff-kitchen-page__items">
                      {filteredItems.map(({ item, index }) => {
                        const status = normalizeStatus(item.status);
                        const itemKey = item?._lineId || item?._id || index;
                        const saveKey = `${order.id}:${itemKey}`;
                        const station = getItemStation(item);
                        const next = getNextItemStatus(status, station);
                        const timingBadges = getTimingBadges(item);
                        const lineDisplay = getOrderLineDisplay(item, { mode: "kitchen" });
                        const urgent = hasLateOrUnacceptedSignal(item);

                        return (
                          <li
                            key={itemKey}
                            className={`staff-kitchen-page__item ${urgent ? "is-urgent" : ""}`}
                            data-station={station}
                          >
                            <span className="staff-kitchen-page__quantity" aria-label={`Số lượng ${formatQuantity(lineDisplay.quantity)}`}>
                              ×{formatQuantity(lineDisplay.quantity)}
                            </span>

                            <div className="staff-kitchen-page__item-main">
                              <h3 className="staff-kitchen-page__item-name">
                                {lineDisplay.isComboLine ? "Combo · " : ""}
                                {lineDisplay.displayName}
                              </h3>

                              {lineDisplay.isComboLine && lineDisplay.childItems.length > 0 ? (
                                <ul className="staff-kitchen-page__combo-list" aria-label="Món con trong combo">
                                  {lineDisplay.childItems.map((child) => (
                                    <li key={child.key}>
                                      {child.qty}× {child.name}
                                      {child.note ? ` · ${child.note}` : ""}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}

                              <div className="staff-kitchen-page__item-badges">
                                <span className="staff-kitchen-page__badge">
                                  {ITEM_STATUS_LABELS[status] || status}
                                </span>
                                <span className="staff-kitchen-page__badge" data-station={station}>
                                  {STATION_LABELS[station] || STATION_LABELS.unassigned}
                                </span>
                                {timingBadges.map((badge) => (
                                  <span
                                    key={badge.key}
                                    className={`staff-kitchen-page__badge ${badge.danger ? "staff-kitchen-page__badge--danger" : ""}`}
                                  >
                                    {badge.label}
                                  </span>
                                ))}
                                {item.unit ? (
                                  <span className="staff-kitchen-page__badge">{item.unit}</span>
                                ) : null}
                              </div>

                              <p className="staff-kitchen-page__timing">
                                {formatItemWaitTime(item, order)}
                                {Number(item?.targetPrepMinutes) > 0
                                  ? ` · Mục tiêu ${item.targetPrepMinutes} phút`
                                  : ""}
                              </p>

                              {item.note ? (
                                <p className="staff-kitchen-page__item-note">Ghi chú món: {item.note}</p>
                              ) : null}

                              {item?.unacceptedReason ? (
                                <p className="staff-kitchen-page__unaccepted-reason">
                                  {item.unacceptedReason}
                                </p>
                              ) : null}
                            </div>

                            {next ? (
                              <button
                                type="button"
                                className="staff-kitchen-page__action"
                                data-station={station}
                                disabled={savingKey === saveKey}
                                onClick={() =>
                                  handleUpdateItemStatus(order, item, index, next.value)
                                }
                              >
                                {savingKey === saveKey ? "Đang lưu…" : next.label}
                              </button>
                            ) : (
                              <span className="staff-kitchen-page__ready-label" data-station={station}>
                                Đã sẵn sàng
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                );
              },
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default StaffKitchenPage;
