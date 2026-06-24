import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import useOrderManagement from "@/hooks/useOrderManagement";
import useSocketOrder from "@/hooks/useSocketOrder";
import { useNotification } from "@/hooks/useNotification";
import { getOrderLineDisplay } from "@/utils/orderLineDisplay";

const ITEM_STATUS_LABELS = {
  pending: "Chờ bếp nhận",
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

const KITCHEN_FILTER_OPTIONS = [
  { value: "active", label: "Đang cần xử lý" },
  { value: "pending", label: "Chờ nhận" },
  { value: "preparing", label: "Đang làm" },
  { value: "ready", label: "Sẵn sàng" },
  { value: "all", label: "Tất cả" },
];

const STATION_FILTER_OPTIONS = [
  { value: "all", label: "Tất cả khu vực" },
  { value: "kitchen", label: "Bếp" },
  { value: "bar", label: "Bar" },
];

const STATION_LABELS = {
  kitchen: "Bếp",
  bar: "Bar",
  unassigned: "Chưa phân khu",
};

const TIME_LEVEL_LABELS = {
  late: "Trễ",
  very_late: "Rất trễ",
};

const PENDING_KITCHEN_ITEM_STATUSES = ["pending", "confirmed", "customer_attached"];
const HIDDEN_KITCHEN_ITEM_STATUSES = ["cancelled", "returned", "served"];

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

const getKitchenItemBucket = (status) => {
  const normalized = normalizeStatus(status);
  if (PENDING_KITCHEN_ITEM_STATUSES.includes(normalized)) return "pending";
  if (normalized === "preparing") return "preparing";
  if (normalized === "ready") return "ready";
  return "other";
};

const isKitchenVisibleItem = (item) => {
  const status = normalizeStatus(item?.status);
  return !HIDDEN_KITCHEN_ITEM_STATUSES.includes(status);
};

const matchesKitchenFilter = (item, filter) => {
  const bucket = getKitchenItemBucket(item?.status);
  if (filter === "all") return isKitchenVisibleItem(item);
  if (filter === "active") return ["pending", "preparing"].includes(bucket);
  return bucket === filter;
};

const getKitchenItemBadgeClassName = (status) => {
  const bucket = getKitchenItemBucket(status);
  if (bucket === "pending") return "bg-green-50 text-green-700";
  if (bucket === "preparing") return "bg-green-50 text-green-700";
  if (bucket === "ready") return "bg-green-50 text-green-700";
  return "bg-gray-100 text-gray-700";
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

const getNextKitchenStatus = (status) => {
  const normalized = normalizeStatus(status);
  if (["pending", "confirmed", "customer_attached"].includes(normalized)) {
    return { value: "preparing", label: "Nhận món vào chế biến" };
  }
  if (normalized === "preparing") {
    return { value: "ready", label: "Báo món đã sẵn sàng" };
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

const matchesKitchenAndStationFilters = (item, statusFilter, stationFilter) => {
  return matchesKitchenFilter(item, statusFilter) && matchesStationFilter(item, stationFilter);
};

const hasLateOrUnacceptedSignal = (item) => {
  const timeLevel = String(item?.timeLevel || "").toLowerCase();
  return item?.unaccepted === true || ["late", "very_late"].includes(timeLevel);
};

const getTimingBadges = (item) => {
  const badges = [];
  const timeLevel = String(item?.timeLevel || "").toLowerCase();
  if (item?.unaccepted === true) {
    badges.push({
      key: "unaccepted",
      label: "Chưa nhận quá hạn",
      className: "bg-red-50 text-red-700",
    });
  }
  if (TIME_LEVEL_LABELS[timeLevel]) {
    badges.push({
      key: `time-${timeLevel}`,
      label: TIME_LEVEL_LABELS[timeLevel],
      className:
        timeLevel === "very_late" ? "bg-red-100 text-red-800" : "bg-green-50 text-green-700",
    });
  }
  return badges;
};

const formatItemWaitTime = (item, order) => {
  const explicitActual = Number(item?.actualPrepMinutes);
  if (Number.isFinite(explicitActual) && explicitActual >= 0) {
    return `Thời gian chuẩn bị: ${explicitActual} phút`;
  }

  const startedAt = item?.preparingAt || item?.kitchenEnteredAt || order?.createdAt;
  const minutes = getElapsedMinutes(startedAt);
  return minutes > 0 ? `Đã chờ ${minutes} phút` : "Mới vào bếp/bar";
};

const StaffKitchenPage = () => {
  const { user } = useContext(AuthContext) || {};
  const restaurantForStaff = user?.restaurantForStaff;
  const restaurantId = getRestaurantForStaffId(restaurantForStaff);
  const restaurantName = getRestaurantForStaffName(restaurantForStaff);
  const [savingKey, setSavingKey] = useState(null);
  const [statusFilter, setStatusFilter] = useState("active");
  const [stationFilter, setStationFilter] = useState("all");
  const { showNotification } = useNotification?.() || {
    showNotification: () => {},
  };

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

  const activeKitchenOrders = useMemo(() => {
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

  const kitchenSummary = useMemo(() => {
    let pending = 0;
    let preparing = 0;
    let ready = 0;
    let totalActive = 0;

    for (const order of activeKitchenOrders) {
      for (const item of order.items || []) {
        if (!isKitchenVisibleItem(item) || !matchesStationFilter(item, stationFilter)) continue;
        const bucket = getKitchenItemBucket(item.status);
        if (bucket === "pending") pending += 1;
        if (bucket === "preparing") preparing += 1;
        if (bucket === "ready") ready += 1;
        if (["pending", "preparing"].includes(bucket)) totalActive += 1;
      }
    }

    const late = activeKitchenOrders.reduce((count, order) => {
      return (
        count +
        (order.items || []).filter(
          (item) =>
            isKitchenVisibleItem(item) &&
            matchesStationFilter(item, stationFilter) &&
            hasLateOrUnacceptedSignal(item),
        ).length
      );
    }, 0);

    return { pending, preparing, ready, totalActive, late };
  }, [activeKitchenOrders, stationFilter]);

  const kitchenOrderRows = useMemo(() => {
    return activeKitchenOrders
      .map((order) => {
        const visibleItems = (order.items || [])
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => isKitchenVisibleItem(item));
        const filteredItems = visibleItems.filter(({ item }) =>
          matchesKitchenAndStationFilters(item, statusFilter, stationFilter),
        );

        return {
          order,
          visibleItems,
          filteredItems,
        };
      })
      .filter((row) => row.filteredItems.length > 0);
  }, [activeKitchenOrders, statusFilter, stationFilter]);

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
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800 shadow-sm">
          <h1 className="text-lg font-semibold">Tài khoản chưa được gán nhà hàng.</h1>
          <p className="mt-1 text-sm">
            Vui lòng liên hệ quản lý để gán nhà hàng trước khi mở bảng điều phối bếp / bar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Staff kitchen/bar dispatch board reuses the order-management hook
          without rendering manager/cashier order actions. */}
      <div className="mb-5 flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-green-700">KITCHEN / BAR DISPATCH</p>
            <h1 className="text-2xl font-semibold text-gray-900">Bảng điều phối bếp / bar</h1>
            <p className="mt-1 text-sm text-gray-600">
              Xem món cần chuẩn bị theo khu vực bếp/bar và cập nhật trạng thái chế biến cho nhà hàng được gán.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm">
            <span className="font-medium">Nhà hàng:</span>{" "}
            {restaurantName || restaurantId}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-green-700">Cần xử lý</p>
            <p className="mt-2 text-2xl font-semibold text-green-900">{kitchenSummary.totalActive}</p>
          </div>
          <div className="rounded-xl border border-green-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-green-700">Chờ nhận</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{kitchenSummary.pending}</p>
          </div>
          <div className="rounded-xl border border-green-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-green-700">Đang làm</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{kitchenSummary.preparing}</p>
          </div>
          <div className="rounded-xl border border-green-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-green-700">Sẵn sàng</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{kitchenSummary.ready}</p>
          </div>
          <div className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-red-700">Món trễ / quá thời gian chuẩn bị</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{kitchenSummary.late}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Trạng thái bếp</p>
            <div className="flex flex-wrap gap-2">
          {KITCHEN_FILTER_OPTIONS.map((option) => {
            const isActive = statusFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "border-green-600 bg-green-600 text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-700 hover:border-green-200 hover:text-green-700"
                }`}
                onClick={() => setStatusFilter(option.value)}
              >
                {option.label}
              </button>
            );
          })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Khu vực bếp / bar</p>
            <div className="flex flex-wrap gap-2">
              {STATION_FILTER_OPTIONS.map((option) => {
                const isActive = stationFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      isActive
                        ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                        : "border-gray-200 bg-white text-gray-700 hover:border-indigo-200 hover:text-indigo-700"
                    }`}
                    onClick={() => setStationFilter(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {ordersNowLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Đang tải danh sách món cần chuẩn bị...
        </div>
      ) : ordersNowError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {ordersNowError.message || "Không thể tải danh sách đơn bếp."}
        </div>
      ) : activeKitchenOrders.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Hiện chưa có món nào cần chuẩn bị.
        </div>
      ) : kitchenOrderRows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Không có món nào trong bộ lọc trạng thái và khu vực hiện tại.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {kitchenOrderRows.map(({ order, filteredItems, visibleItems }) => {
            const ageMinutes = getOrderAgeMinutes(order.createdAt);
            return (
              <article key={order.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      {order.tableCode ? `Bàn ${order.tableCode}` : order.orderCode || `Đơn ${String(order.id).slice(-4)}`}
                    </h2>
                    <p className="mt-1 text-xs text-gray-500">
                      {order.orderCode || order.id} · {ORDER_STATUS_LABELS[normalizeStatus(order.currentStatus)] || order.currentStatus || "Không rõ"} · {ageMinutes > 0 ? `${ageMinutes} phút` : "Mới"}
                    </p>
                  </div>
                  <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                    {order.orderType === "delivery" ? "Giao hàng" : order.orderType === "takeaway" ? "Mang về" : "Tại bàn"}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500">
                  <span>{filteredItems.length} món</span>
                  {visibleItems.length > filteredItems.length ? (
                    <span>{visibleItems.length} món trong đơn</span>
                  ) : null}
                </div>

                {order.note ? (
                  <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">
                    Ghi chú: {order.note}
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  {filteredItems.map(({ item, index }) => {
                    const status = normalizeStatus(item.status);
                    const next = getNextKitchenStatus(status);
                    const itemKey = item?._lineId || item?._id || index;
                    const saveKey = `${order.id}:${itemKey}`;
                    const station = getItemStation(item);
                    const timingBadges = getTimingBadges(item);
                    const lineDisplay = getOrderLineDisplay(item, { mode: "kitchen" });
                    return (
                      <div key={itemKey} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-gray-900">
                              {lineDisplay.isComboLine ? "Combo: " : ""}x{formatQuantity(lineDisplay.quantity)} {lineDisplay.displayName}
                            </div>
                            {lineDisplay.isComboLine && lineDisplay.childItems.length > 0 ? (
                              <ul className="mt-2 space-y-1 border-l-2 border-green-200 pl-3 text-xs text-gray-700" aria-label="Món con trong combo">
                                {lineDisplay.childItems.map((child) => (
                                  <li key={child.key}>{child.qty}× {child.name}{child.note ? ` · ${child.note}` : ""}</li>
                                ))}
                              </ul>
                            ) : null}
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              <span className={`rounded-full px-2.5 py-1 font-medium ${getKitchenItemBadgeClassName(status)}`}>
                                {ITEM_STATUS_LABELS[status] || status}
                              </span>
                              <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700">
                                {STATION_LABELS[station] || STATION_LABELS.unassigned}
                              </span>
                              {timingBadges.map((badge) => (
                                <span key={badge.key} className={`rounded-full px-2.5 py-1 font-medium ${badge.className}`}>
                                  {badge.label}
                                </span>
                              ))}
                              {item.unit ? <span className="text-gray-500">{item.unit}</span> : null}
                            </div>
                          </div>
                          {next ? (
                            <button
                              type="button"
                              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
                              disabled={savingKey === saveKey}
                              onClick={() => handleUpdateItemStatus(order, item, index, next.value)}
                            >
                              {savingKey === saveKey ? "Đang lưu..." : next.label}
                            </button>
                          ) : (
                            <span className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                              Sẵn sàng
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          {formatItemWaitTime(item, order)}
                          {Number(item?.targetPrepMinutes) > 0 ? ` · Mục tiêu ${item.targetPrepMinutes} phút` : ""}
                        </div>
                        {item?.unacceptedReason ? (
                          <div className="mt-1 text-xs text-red-700">{item.unacceptedReason}</div>
                        ) : null}
                        {item.note ? (
                          <div className="mt-2 text-xs text-gray-600">Ghi chú món: {item.note}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StaffKitchenPage;
